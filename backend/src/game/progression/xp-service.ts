import { findByAccountId, findClassById, updateCharacter } from '../../db/queries/characters';
import { checkLevelUp } from './level-up-service';
import { getSessionByCharacterId, sendToSocket } from '../../websocket/server';
import { log } from '../../logger';
import { QuestTracker } from '../quest/quest-tracker';

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400];

export interface XpAwardResult {
  newXp: number;
  levelledUp: boolean;
  newLevel?: number;
  newMaxHp?: number;
  newAttackPower?: number;
  newDefence?: number;
}

export async function awardXp(characterId: string, amount: number): Promise<XpAwardResult> {
  // We need the character by ID; findByAccountId isn't right here — use a direct query
  const { query } = await import('../../db/connection');
  const result = await query<{
    id: string; account_id: string; level: number; experience: number;
    max_hp: number; current_hp: number; attack_power: number; defence: number;
    class_id: number; zone_id: number; pos_x: number; pos_y: number;
    current_node_id: number | null; in_combat: boolean; in_gathering: boolean; crowns: number; updated_at: Date; name: string;
  }>('SELECT * FROM characters WHERE id = $1', [characterId]);

  const character = result.rows[0];
  if (!character) {
    log('warn', 'xp-service', 'character_not_found', { characterId });
    return { newXp: 0, levelledUp: false };
  }

  const newXp = character.experience + amount;
  const cls = await findClassById(character.class_id);

  if (!cls) {
    log('error', 'xp-service', 'class_not_found', { classId: character.class_id });
    await updateCharacter(characterId, { experience: newXp });
    return { newXp, levelledUp: false };
  }

  const levelResult = checkLevelUp(character, cls, newXp);

  if (levelResult.levelledUp) {
    await updateCharacter(characterId, {
      experience: newXp,
      level: levelResult.newLevel,
      max_hp: levelResult.newMaxHp,
      current_hp: levelResult.newMaxHp, // restore to full HP on level up
      attack_power: levelResult.newAttackPower,
      defence: levelResult.newDefence,
    });

    const nextThreshold = XP_THRESHOLDS[levelResult.newLevel] ?? 9999;
    void nextThreshold;

    // Emit level-up notification to the player
    const session = getSessionByCharacterId(characterId);
    if (session) {
      sendToSocket(session.socket, 'character.levelled_up', {
        new_level: levelResult.newLevel,
        new_max_hp: levelResult.newMaxHp,
        new_attack_power: levelResult.newAttackPower,
        new_defence: levelResult.newDefence,
        new_experience: newXp,
      });
    }

    // Quest tracking: level up (best-effort, progress picked up on next quest log if session unavailable)
    try {
      await QuestTracker.onLevelUp(characterId, levelResult.newLevel!);
    } catch {
      // silently ignore — quest progress will be picked up on next quest log request
    }

    log('info', 'xp-service', 'xp_awarded_with_level_up', {
      characterId,
      amount,
      newXp,
      newLevel: levelResult.newLevel,
    });

    return {
      newXp,
      levelledUp: true,
      newLevel: levelResult.newLevel,
      newMaxHp: levelResult.newMaxHp,
      newAttackPower: levelResult.newAttackPower,
      newDefence: levelResult.newDefence,
    };
  }

  await updateCharacter(characterId, { experience: newXp });

  log('debug', 'xp-service', 'xp_awarded', { characterId, amount, newXp });
  return { newXp, levelledUp: false };
}

// Re-export for use as a drop-in replacement for the stub in combat-end-handler
export { awardXp as default };
