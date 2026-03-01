import { query } from '../../db/connection';
import { updateCharacter } from '../../db/queries/characters';
import { insertCharacterItem, findItemById } from '../../db/queries/items';
import { killInstance, getParticipants } from '../world/monster-registry';
import { broadcastToZone } from '../world/zone-broadcasts';
import { getZone } from '../world/zone-loader';
import { getSessionByCharacterId, sendToSocket } from '../../websocket/server';
import { log } from '../../logger';
import type { MonsterInstance } from '../world/monster-registry';
import type { Character } from '../../db/queries/characters';
import type { CombatRound } from './combat-engine';

import { awardXp } from '../progression/xp-service';

export async function handleCombatEnd(
  combatId: string,
  character: Character,
  monster: MonsterInstance,
  rounds: CombatRound[],
  playerSurvived: boolean,
  finalPlayerHp: number,
): Promise<void> {
  const outcome = playerSurvived ? 'victory' : 'defeat';
  const participants = getParticipants(monster.instanceId);

  // Persist simulation outcome
  await query(
    `UPDATE combat_simulations
     SET ended_at = now(), outcome = $2, xp_awarded = $3, rounds = $4
     WHERE id = $1`,
    [
      combatId,
      outcome,
      playerSurvived ? monster.xpReward : 0,
      JSON.stringify(rounds),
    ],
  );

  // Process each participant
  for (const characterId of participants) {
    const session = getSessionByCharacterId(characterId);

    // Roll loot independently
    const itemsGained: { item_id: number; name: string; type: string; quantity: number }[] = [];
    if (playerSurvived) {
      for (const lootEntry of monster.lootTable) {
        if (Math.random() * 100 < lootEntry.drop_chance_pct) {
          const item = await findItemById(lootEntry.item_id);
          if (item) {
            await insertCharacterItem(characterId, lootEntry.item_id, lootEntry.quantity);
            itemsGained.push({ item_id: item.id, name: item.name, type: item.type, quantity: lootEntry.quantity });
          }
        }
      }

      // Award XP (T056 — real implementation)
      await awardXp(characterId, monster.xpReward);
    }

    if (session) {
      sendToSocket(session.socket, 'combat.ended', {
        combat_id: combatId,
        outcome,
        xp_gained: playerSurvived ? monster.xpReward : 0,
        items_gained: itemsGained,
      });
    }

    // Mark player no longer in combat
    await updateCharacter(characterId, { in_combat: false, current_hp: finalPlayerHp });

    if (!playerSurvived) {
      // Respawn at zone spawn point
      const zone = getZone(character.zone_id);
      const spawnX = zone?.spawnX ?? 5;
      const spawnY = zone?.spawnY ?? 5;
      await updateCharacter(characterId, { pos_x: spawnX, pos_y: spawnY, current_hp: Math.floor(character.max_hp * 0.5) });
      log('info', 'combat', 'player_defeated_respawned', { characterId, spawnX, spawnY });
    }
  }

  // Remove monster from registry and broadcast despawn
  killInstance(monster.instanceId);
  broadcastToZone(monster.zoneId, 'monster.despawned', { instance_id: monster.instanceId });

  // Schedule respawn (get template info from DB)
  void query<{ respawn_seconds: number }>(
    `SELECT respawn_seconds FROM monsters WHERE id = $1`,
    [monster.templateId],
  ).then((r) => {
    const seconds = r.rows[0]?.respawn_seconds ?? 30;
    void scheduleRespawnAfterDelay(monster, seconds);
  });

  log('info', 'combat', 'ended', {
    combatId,
    outcome,
    monsterName: monster.name,
    participants: participants.length,
  });
}

async function scheduleRespawnAfterDelay(monster: MonsterInstance, seconds: number): Promise<void> {
  const { scheduleMonsterRespawn } = await import('../world/monster-spawner');
  scheduleMonsterRespawn({
    id: monster.templateId,
    name: monster.name,
    zone_id: monster.zoneId,
    max_hp: monster.maxHp,
    attack_power: monster.attackPower,
    defence: monster.defence,
    xp_reward: monster.xpReward,
    loot_table: monster.lootTable,
    respawn_seconds: seconds,
  } as Parameters<typeof scheduleMonsterRespawn>[0]);
}
