import { log } from '../../logger';
import type { Character, CharacterClass } from '../../db/queries/characters';

const STAT_POINTS_PER_LEVEL = 7;

export interface LevelUpResult {
  levelledUp: boolean;
  newLevel: number;
  statPointsGained: number;
  statPointsUnspent: number;
}

export function checkLevelUp(character: Character, cls: CharacterClass, newXp: number): LevelUpResult {
  const curve: number[] = Array.isArray(cls.xp_curve) ? cls.xp_curve : [];

  // Find the highest level index where xp_curve[index] <= newXp
  // xp_curve[0] = XP required for level 2, xp_curve[1] = for level 3, etc.
  let newLevel = character.level;
  for (let i = 0; i < curve.length; i++) {
    const threshold = curve[i];
    if (threshold !== undefined && newXp >= threshold) {
      newLevel = i + 2; // level 2 at index 0, level 3 at index 1, etc.
    } else {
      break;
    }
  }

  if (newLevel <= character.level) {
    return {
      levelledUp: false,
      newLevel: character.level,
      statPointsGained: 0,
      statPointsUnspent: character.stat_points_unspent,
    };
  }

  const levelsGained = newLevel - character.level;
  const statPointsGained = STAT_POINTS_PER_LEVEL * levelsGained;
  const statPointsUnspent = character.stat_points_unspent + statPointsGained;

  log('info', 'progression', 'level_up', {
    characterId: character.id,
    from: character.level,
    to: newLevel,
    statPointsGained,
    statPointsUnspent,
  });

  return { levelledUp: true, newLevel, statPointsGained, statPointsUnspent };
}
