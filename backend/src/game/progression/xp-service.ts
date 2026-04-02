import { findByAccountId, findClassById, updateCharacter, type Character } from '../../db/queries/characters';
import { checkLevelUp } from './level-up-service';
import { getSessionByCharacterId, sendToSocket } from '../../websocket/server';
import { log } from '../../logger';
import { QuestTracker } from '../quest/quest-tracker';

export interface XpAwardResult {
  newXp: number;
  levelledUp: boolean;
  newLevel?: number;
  statPointsGained?: number;
  statPointsUnspent?: number;
}

export async function awardXp(characterId: string, amount: number): Promise<XpAwardResult> {
  // We need the character by ID; findByAccountId isn't right here — use a direct query
  const { query } = await import('../../db/connection');
  const result = await query<Character>('SELECT * FROM characters WHERE id = $1', [characterId]);

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
      stat_points_unspent: levelResult.statPointsUnspent,
    });

    // Emit level-up notification to the player
    const session = getSessionByCharacterId(characterId);
    if (session) {
      sendToSocket(session.socket, 'character.levelled_up', {
        new_level: levelResult.newLevel,
        new_max_hp: character.max_hp,
        new_attack_power: character.attack_power,
        new_defence: character.defence,
        new_experience: newXp,
        stat_points_gained: levelResult.statPointsGained,
        stat_points_unspent: levelResult.statPointsUnspent,
      });
    }

    // Quest tracking: level up
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
      statPointsGained: levelResult.statPointsGained,
    });

    return {
      newXp,
      levelledUp: true,
      newLevel: levelResult.newLevel,
      statPointsGained: levelResult.statPointsGained,
      statPointsUnspent: levelResult.statPointsUnspent,
    };
  }

  await updateCharacter(characterId, { experience: newXp });

  log('debug', 'xp-service', 'xp_awarded', { characterId, amount, newXp });
  return { newXp, levelledUp: false };
}

// Re-export for use as a drop-in replacement for the stub in combat-end-handler
export { awardXp as default };
