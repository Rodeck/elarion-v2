import { log } from '../../logger';
import type { Character, CharacterClass } from '../../db/queries/characters';

export interface LevelUpResult {
  levelledUp: boolean;
  newLevel: number;
  newMaxHp: number;
  newAttackPower: number;
  newDefence: number;
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
      newMaxHp: character.max_hp,
      newAttackPower: character.attack_power,
      newDefence: character.defence,
    };
  }

  const levelsGained = newLevel - character.level;
  const newMaxHp = character.max_hp + cls.hp_per_level * levelsGained;
  const newAttackPower = character.attack_power + cls.attack_per_level * levelsGained;
  const newDefence = character.defence + cls.defence_per_level * levelsGained;

  log('info', 'progression', 'level_up', {
    characterId: character.id,
    from: character.level,
    to: newLevel,
    newMaxHp,
    newAttackPower,
    newDefence,
  });

  return { levelledUp: true, newLevel, newMaxHp, newAttackPower, newDefence };
}
