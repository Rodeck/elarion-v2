import type { ItemDefinition } from '../../db/queries/inventory';
import type { QualityTier } from '../../../../shared/protocol/index';
import { QUALITY_LABELS } from '../../../../shared/protocol/index';

// Per-instance stat overrides returned by the roll service
export interface InstanceStats {
  instance_attack: number | null;
  instance_defence: number | null;
  instance_crit_chance: number | null;
  instance_additional_attacks: number | null;
  instance_armor_penetration: number | null;
  instance_max_mana: number | null;
  instance_mana_on_hit: number | null;
  instance_mana_regen: number | null;
  instance_quality_tier: QualityTier;
  quality_label: string;
}

const ARMOR_CATEGORIES = new Set(['helmet', 'chestplate', 'shield', 'greaves', 'bracer', 'boots']);
const EXCLUDED_CATEGORIES = new Set(['ring', 'amulet', 'resource', 'food', 'heal', 'tool', 'skill_book']);

/**
 * Weighted roll toward lower values (~30% average of max).
 * Uses 1 - random()^2 distribution.
 */
function weightedRoll(max: number): number {
  if (max <= 0) return 0;
  return Math.floor(max * Math.random() ** 2);
}

/**
 * Compute quality tier from roll percentage (0-1).
 * 0-25% = Poor, 26-50% = Common, 51-75% = Fine, 76-100% = Superior
 */
export function computeQualityTier(rollPct: number): QualityTier {
  if (rollPct <= 0.25) return 1;
  if (rollPct <= 0.50) return 2;
  if (rollPct <= 0.75) return 3;
  return 4;
}

/**
 * Roll per-instance stats for an item based on its definition.
 * Returns null for items that don't get variation (stackables, rings, amulets, tools, skill books).
 */
export function rollItemStats(def: ItemDefinition): InstanceStats | null {
  // Stackable items and excluded categories never get variation
  if (def.stack_size != null) return null;
  if (EXCLUDED_CATEGORIES.has(def.category)) return null;

  const stats: InstanceStats = {
    instance_attack: null,
    instance_defence: null,
    instance_crit_chance: null,
    instance_additional_attacks: null,
    instance_armor_penetration: null,
    instance_max_mana: null,
    instance_mana_on_hit: null,
    instance_mana_regen: null,
    instance_quality_tier: 1,
    quality_label: 'Poor',
  };

  let rollPct = 0;

  if (def.category === 'weapon' && def.weapon_subtype) {
    switch (def.weapon_subtype) {
      case 'dagger': {
        const base = def.crit_chance ?? 0;
        const rolled = weightedRoll(base);
        stats.instance_crit_chance = rolled;
        rollPct = base > 0 ? rolled / base : 0;
        break;
      }
      case 'bow': {
        const base = def.additional_attacks ?? 0;
        const rolled = weightedRoll(base);
        stats.instance_additional_attacks = rolled;
        rollPct = base > 0 ? rolled / base : 0;
        break;
      }
      case 'staff': {
        const base = def.armor_penetration ?? 0;
        const rolled = weightedRoll(base);
        stats.instance_armor_penetration = rolled;
        rollPct = base > 0 ? rolled / base : 0;
        break;
      }
      case 'wand': {
        const baseMana = def.max_mana ?? 0;
        const baseHit = def.mana_on_hit ?? 0;
        const baseRegen = def.mana_regen ?? 0;
        const rolledMana = weightedRoll(baseMana);
        const rolledHit = weightedRoll(baseHit);
        const rolledRegen = weightedRoll(baseRegen);
        stats.instance_max_mana = rolledMana;
        stats.instance_mana_on_hit = rolledHit;
        stats.instance_mana_regen = rolledRegen;
        // Average roll percentage across all wand stats
        const total = baseMana + baseHit + baseRegen;
        rollPct = total > 0 ? (rolledMana + rolledHit + rolledRegen) / total : 0;
        break;
      }
      case 'one_handed':
      case 'two_handed': {
        const base = def.attack ?? 0;
        const maxBonus = Math.floor(base * 0.2);
        const bonus = weightedRoll(maxBonus);
        stats.instance_attack = base + bonus;
        rollPct = maxBonus > 0 ? bonus / maxBonus : 0;
        break;
      }
    }
  } else if (ARMOR_CATEGORIES.has(def.category)) {
    // Armor: +0-20% defence bonus
    const base = def.defence ?? 0;
    const maxBonus = Math.floor(base * 0.2);
    const bonus = weightedRoll(maxBonus);
    stats.instance_defence = base + bonus;
    rollPct = maxBonus > 0 ? bonus / maxBonus : 0;
  } else {
    // Unknown equippable category without weapon_subtype — no variation
    return null;
  }

  stats.instance_quality_tier = computeQualityTier(rollPct);
  stats.quality_label = QUALITY_LABELS[stats.instance_quality_tier];

  return stats;
}
