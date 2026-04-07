import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { findByAccountId } from '../../db/queries/characters';
import { getInventorySlotById, deleteInventoryItem, updateInventoryQuantity } from '../../db/queries/inventory';
import { getSpellById } from '../../db/queries/spells';
import { getSpellProgress, upsertSpellProgress, grantSpellToCharacter } from '../../db/queries/spell-progress';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { sendSpellState } from './spell-state-handler';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SPELL_LEVEL = 5;
const POINTS_TO_LEVEL = 100;
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendError(session: AuthenticatedSession, message: string): void {
  sendToSession(session, 'spell-book-spell.error', { message });
}

function rollPoints(): number {
  const rand = Math.random();
  if (rand < 0.60) return 10;
  if (rand < 0.90) return 20;
  if (rand < 0.99) return 30;
  return 50;
}

// ---------------------------------------------------------------------------
// spell-book-spell.use
// ---------------------------------------------------------------------------

async function handleSpellBookUse(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { slot_id } = payload as { slot_id: number };
  const characterId = session.characterId;

  if (!characterId) {
    sendError(session, 'No character.');
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendError(session, 'Character not found.');
    return;
  }

  if (character.in_combat) {
    log('warn', 'spell-book', 'spell_book_rejected', {
      character_id: characterId, reason: 'in_combat',
    });
    sendError(session, 'Cannot use spell books while in combat.');
    return;
  }

  const slot = await getInventorySlotById(slot_id, characterId);
  if (!slot) {
    log('warn', 'spell-book', 'spell_book_rejected', {
      character_id: characterId, reason: 'slot_not_found', slot_id,
    });
    sendError(session, 'Item not found in your inventory.');
    return;
  }

  if (slot.def_category !== 'spell_book_spell') {
    log('warn', 'spell-book', 'spell_book_rejected', {
      character_id: characterId, reason: 'wrong_category', category: slot.def_category,
    });
    sendError(session, 'This item is not a spell book.');
    return;
  }

  const spellId = slot.def_spell_id;
  if (!spellId) {
    log('warn', 'spell-book', 'spell_book_rejected', {
      character_id: characterId, reason: 'no_spell_id', item_def_id: slot.item_def_id,
    });
    sendError(session, 'Spell book references an unknown spell.');
    return;
  }

  const spell = await getSpellById(spellId);
  const spellName = spell?.name ?? 'Unknown Spell';

  // Grant spell if not owned
  let progress = await getSpellProgress(characterId, spellId);
  if (!progress) {
    await grantSpellToCharacter(characterId, spellId);
    progress = await getSpellProgress(characterId, spellId);
  }

  const currentLevel = progress?.current_level ?? 1;
  const currentPoints = progress?.current_points ?? 0;

  if (currentLevel >= MAX_SPELL_LEVEL) {
    log('warn', 'spell-book', 'spell_book_rejected', {
      character_id: characterId, reason: 'max_level', spell_id: spellId, current_level: currentLevel,
    });
    sendError(session, `${spellName} is already at maximum level.`);
    return;
  }

  if (progress?.last_book_used_at) {
    const elapsed = Date.now() - new Date(progress.last_book_used_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - elapsed;
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      log('warn', 'spell-book', 'spell_book_rejected', {
        character_id: characterId, reason: 'cooldown', spell_id: spellId,
        remaining_ms: remainingMs,
      });
      sendError(session, `Cooldown: ${remainingHours}h ${remainingMinutes}m remaining.`);
      return;
    }
  }

  // Consume item
  if (slot.quantity <= 1) {
    await deleteInventoryItem(slot.id, characterId);
  } else {
    await updateInventoryQuantity(slot.id, slot.quantity - 1);
  }

  // Roll points
  const pointsGained = rollPoints();

  let newLevel = currentLevel;
  let newPoints = currentPoints + pointsGained;
  let leveledUp = false;

  if (newPoints >= POINTS_TO_LEVEL) {
    newLevel = Math.min(newLevel + 1, MAX_SPELL_LEVEL);
    newPoints -= POINTS_TO_LEVEL;
    leveledUp = true;
  }

  await upsertSpellProgress(characterId, spellId, newLevel, newPoints, new Date());

  log('info', 'spell-book', 'spell_book_used', {
    character_id: characterId,
    spell_id: spellId,
    spell_name: spellName,
    points_gained: pointsGained,
    new_level: newLevel,
    new_points: newPoints,
    leveled_up: leveledUp,
  });

  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  sendToSession(session, 'spell-book-spell.result', {
    spell_id: spellId,
    spell_name: spellName,
    points_gained: pointsGained,
    new_points: newPoints,
    new_level: newLevel,
    leveled_up: leveledUp,
    cooldown_until: cooldownUntil,
  });

  await sendInventoryState(session);
  await sendSpellState(session, characterId);
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerSpellBookHandlers(): void {
  registerHandler('spell-book-spell.use', handleSpellBookUse);
}
