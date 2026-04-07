import { getActiveBuffs } from '../../db/queries/spell-buffs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpellBuffModifiers {
  attackPct: number;
  defencePct: number;
  critChancePct: number;
  critDamagePct: number;
  movementSpeed: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Aggregate percentage modifiers from all active spell buffs on a character.
 * Flat effects (heal, energy) are applied at cast time, not here.
 */
export async function getActiveSpellBuffModifiers(
  characterId: string,
): Promise<SpellBuffModifiers> {
  const buffs = await getActiveBuffs(characterId);

  const mods: SpellBuffModifiers = {
    attackPct: 0,
    defencePct: 0,
    critChancePct: 0,
    critDamagePct: 0,
    movementSpeed: 0,
  };

  for (const buff of buffs) {
    switch (buff.effect_type) {
      case 'attack_pct':
        mods.attackPct += buff.effect_value;
        break;
      case 'defence_pct':
        mods.defencePct += buff.effect_value;
        break;
      case 'crit_chance_pct':
        mods.critChancePct += buff.effect_value;
        break;
      case 'crit_damage_pct':
        mods.critDamagePct += buff.effect_value;
        break;
      case 'movement_speed':
        mods.movementSpeed += buff.effect_value;
        break;
      // 'heal' and 'energy' are instant effects — not ongoing modifiers
    }
  }

  return mods;
}
