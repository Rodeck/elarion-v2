import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { findByAccountId, updateCharacter } from '../../db/queries/characters';
import { getSpellById, getSpellLevelStats, getSpellCosts } from '../../db/queries/spells';
import { getSpellProgress } from '../../db/queries/spell-progress';
import { getBuffBySpell, upsertBuff } from '../../db/queries/spell-buffs';
import { getInventoryItemsByDefId, updateInventoryQuantity, deleteInventoryItem } from '../../db/queries/inventory';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { sendSpellState } from './spell-state-handler';
import { sendCharacterStatsRefresh } from './spell-stats-refresh';
import { getClient } from '../../db/connection';
import { getSessionByCharacterId } from '../../websocket/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendRejected(session: AuthenticatedSession, spellId: number, reason: string, message: string): void {
  sendToSession(session, 'spell.cast_rejected', { spell_id: spellId, reason, message });
}

// ---------------------------------------------------------------------------
// spell.cast (self-cast)
// ---------------------------------------------------------------------------

async function handleSpellCast(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { spell_id } = payload as { spell_id: number };
  const characterId = session.characterId;
  if (!characterId) return;

  const character = await findByAccountId(session.accountId);
  if (!character) return;

  if (character.in_combat) {
    sendRejected(session, spell_id, 'in_combat', 'Cannot cast spells while in combat.');
    return;
  }

  await executeCast(session, characterId, character, spell_id, characterId);
}

// ---------------------------------------------------------------------------
// spell.cast_on_player
// ---------------------------------------------------------------------------

async function handleSpellCastOnPlayer(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { spell_id, target_character_id } = payload as { spell_id: number; target_character_id: string };
  const characterId = session.characterId;
  if (!characterId) return;

  const character = await findByAccountId(session.accountId);
  if (!character) return;

  if (character.in_combat) {
    sendRejected(session, spell_id, 'in_combat', 'Cannot cast spells while in combat.');
    return;
  }

  // Validate target exists and is in same location (same node)
  const { query } = await import('../../db/connection');
  const targetResult = await query<{ id: string; name: string; current_node_id: number | null }>(
    'SELECT id, name, current_node_id FROM characters WHERE id = $1',
    [target_character_id],
  );
  const target = targetResult.rows[0];
  if (!target) {
    sendRejected(session, spell_id, 'target_not_found', 'Target player not found.');
    return;
  }

  if (target.current_node_id !== character.current_node_id) {
    sendRejected(session, spell_id, 'target_not_in_location', 'Target player is not in your location.');
    return;
  }

  await executeCast(session, characterId, character, spell_id, target_character_id);
}

// ---------------------------------------------------------------------------
// Shared cast logic
// ---------------------------------------------------------------------------

async function executeCast(
  session: AuthenticatedSession,
  casterId: string,
  casterCharacter: { name: string; crowns: number },
  spellId: number,
  targetId: string,
): Promise<void> {
  // Validate caster owns spell
  const progress = await getSpellProgress(casterId, spellId);
  if (!progress) {
    sendRejected(session, spellId, 'not_owned', 'You have not learned this spell.');
    return;
  }

  const spell = await getSpellById(spellId);
  if (!spell) {
    sendRejected(session, spellId, 'not_owned', 'Spell not found.');
    return;
  }

  const levelStats = await getSpellLevelStats(spellId, progress.current_level);
  const effectValue = levelStats?.effect_value ?? spell.effect_value;
  const durationSeconds = levelStats?.duration_seconds ?? spell.duration_seconds;
  const goldCost = levelStats?.gold_cost ?? 0;

  // Check buff replacement rule
  const existingBuff = await getBuffBySpell(targetId, spellId);
  if (existingBuff && existingBuff.level > progress.current_level) {
    sendRejected(session, spellId, 'higher_level_active', `Target already has ${spell.name} at a higher level.`);
    return;
  }

  // Check gold cost
  if (goldCost > 0 && casterCharacter.crowns < goldCost) {
    sendRejected(session, spellId, 'insufficient_resources', `Not enough gold. Need ${goldCost}, have ${casterCharacter.crowns}.`);
    return;
  }

  // Check item costs
  const itemCosts = await getSpellCosts(spellId, progress.current_level);
  for (const cost of itemCosts) {
    const items = await getInventoryItemsByDefId(casterId, cost.item_def_id);
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQty < cost.quantity) {
      sendRejected(session, spellId, 'insufficient_resources', `Not enough ${cost.item_name ?? 'items'}. Need ${cost.quantity}, have ${totalQty}.`);
      return;
    }
  }

  // Deduct resources atomically
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Deduct gold
    if (goldCost > 0) {
      await client.query(
        'UPDATE characters SET crowns = crowns - $1 WHERE id = $2',
        [goldCost, casterId],
      );
    }

    // Deduct items
    for (const cost of itemCosts) {
      let remaining = cost.quantity;
      const items = await getInventoryItemsByDefId(casterId, cost.item_def_id);
      for (const item of items) {
        if (remaining <= 0) break;
        if (item.quantity <= remaining) {
          await client.query('DELETE FROM inventory_items WHERE id = $1', [item.id]);
          remaining -= item.quantity;
        } else {
          await client.query('UPDATE inventory_items SET quantity = quantity - $1 WHERE id = $2', [remaining, item.id]);
          remaining = 0;
        }
      }
    }

    // Apply buff
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    await client.query(
      `INSERT INTO active_spell_buffs (character_id, spell_id, caster_id, level, effect_type, effect_value, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (character_id, spell_id) DO UPDATE
         SET caster_id = $3, level = $4, effect_type = $5, effect_value = $6, expires_at = $7, created_at = NOW()`,
      [targetId, spellId, casterId, progress.current_level, spell.effect_type, effectValue, expiresAt],
    );

    // Apply instant effects
    if (spell.effect_type === 'heal') {
      await client.query(
        'UPDATE characters SET current_hp = LEAST(current_hp + $1, max_hp) WHERE id = $2',
        [effectValue, targetId],
      );
    } else if (spell.effect_type === 'energy') {
      await client.query(
        'UPDATE characters SET current_energy = LEAST(current_energy + $1, max_energy) WHERE id = $2',
        [effectValue, targetId],
      );
    }

    await client.query('COMMIT');

    log('info', 'spell-cast', 'spell_cast_success', {
      caster_id: casterId,
      target_id: targetId,
      spell_id: spellId,
      spell_name: spell.name,
      level: progress.current_level,
      effect_type: spell.effect_type,
      effect_value: effectValue,
      duration_seconds: durationSeconds,
    });

    // Send result to caster
    sendToSession(session, 'spell.cast_result', {
      spell_id: spellId,
      spell_name: spell.name,
      target_character_id: targetId,
      level: progress.current_level,
      effect_type: spell.effect_type,
      effect_value: effectValue,
      duration_seconds: durationSeconds,
      expires_at: expiresAt.toISOString(),
    });

    // Refresh caster state
    await sendInventoryState(session);
    await sendSpellState(session, casterId);
    await sendCharacterStatsRefresh(session, casterId);

    // If casting on another player, notify them
    if (targetId !== casterId) {
      const targetSession = getSessionByCharacterId(targetId);
      if (targetSession) {
        sendToSession(targetSession, 'spell.buff_received', {
          spell_id: spellId,
          spell_name: spell.name,
          caster_name: casterCharacter.name,
          level: progress.current_level,
          effect_type: spell.effect_type,
          effect_value: effectValue,
          duration_seconds: durationSeconds,
          expires_at: expiresAt.toISOString(),
          icon_url: null, // Will be resolved client-side from spell state
        });
        await sendSpellState(targetSession, targetId);
        await sendCharacterStatsRefresh(targetSession, targetId);
      }
    }

  } catch (err) {
    await client.query('ROLLBACK');
    log('error', 'spell-cast', 'spell_cast_failed', {
      caster_id: casterId, spell_id: spellId, error: String(err),
    });
    sendRejected(session, spellId, 'insufficient_resources', 'Failed to cast spell. Please try again.');
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerSpellCastHandlers(): void {
  registerHandler('spell.cast', handleSpellCast);
  registerHandler('spell.cast_on_player', handleSpellCastOnPlayer);
}
