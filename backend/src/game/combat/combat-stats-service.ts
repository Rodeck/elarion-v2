import { query } from '../../db/connection';
import type { DerivedCombatStats } from './combat-engine';

const DEFAULT_MAX_MANA = 100;
const DEFAULT_MANA_ON_HIT = 10;        // mana gained per attack landed
const DEFAULT_MANA_ON_DAMAGE_TAKEN = 5; // mana gained when hit
const DEFAULT_MANA_REGEN = 3;           // mana regenerated per turn
const DEFAULT_CRIT_DAMAGE = 150;

interface EquippedItemStats {
  attack: number | null;
  defence: number | null;
  max_mana: number;
  mana_on_hit: number;
  mana_on_damage_taken: number;
  mana_regen: number;
  dodge_chance: number;
  crit_chance: number;
  crit_damage: number;
}

export async function computeCombatStats(
  characterId: string,
): Promise<DerivedCombatStats & { maxHp: number }> {
  // Load character base stats
  const charResult = await query<{
    max_hp: number;
    attack_power: number;
    defence: number;
  }>(
    'SELECT max_hp, attack_power, defence FROM characters WHERE id = $1',
    [characterId],
  );
  const char = charResult.rows[0];
  if (!char) throw new Error(`Character ${characterId} not found`);

  // Load all equipped item stats (items with equipped_slot set)
  const itemResult = await query<EquippedItemStats>(
    `SELECT
       id.attack,
       id.defence,
       id.max_mana,
       id.mana_on_hit,
       id.mana_on_damage_taken,
       id.mana_regen,
       id.dodge_chance,
       id.crit_chance,
       id.crit_damage
     FROM inventory_items ii
     JOIN item_definitions id ON id.id = ii.item_def_id
     WHERE ii.character_id = $1 AND ii.equipped_slot IS NOT NULL`,
    [characterId],
  );

  // Aggregate stats across all equipped items
  let bonusAttack = 0;
  let bonusDefence = 0;
  let maxMana = DEFAULT_MAX_MANA;
  let manaOnHit = DEFAULT_MANA_ON_HIT;
  let manaOnDamageTaken = DEFAULT_MANA_ON_DAMAGE_TAKEN;
  let manaRegen = DEFAULT_MANA_REGEN;
  let dodgeChance = 0;
  let critChance = 0;
  let critDamage = DEFAULT_CRIT_DAMAGE;
  let critDamageSet = false;

  for (const item of itemResult.rows) {
    bonusAttack    += item.attack   ?? 0;
    bonusDefence   += item.defence  ?? 0;
    maxMana        += item.max_mana;
    manaOnHit      += item.mana_on_hit;
    manaOnDamageTaken += item.mana_on_damage_taken;
    manaRegen      += item.mana_regen;
    dodgeChance    += item.dodge_chance;
    critChance     += item.crit_chance;
    if (item.crit_damage > DEFAULT_CRIT_DAMAGE) {
      critDamage = Math.max(critDamage, item.crit_damage);
      critDamageSet = true;
    }
  }

  if (!critDamageSet && itemResult.rows.length === 0) {
    critDamage = DEFAULT_CRIT_DAMAGE;
  }

  return {
    attack:            char.attack_power + bonusAttack,
    defence:           char.defence      + bonusDefence,
    maxHp:             char.max_hp,
    maxMana:           maxMana,
    manaOnHit:         manaOnHit,
    manaOnDamageTaken: manaOnDamageTaken,
    manaRegen:         manaRegen,
    dodgeChance:       Math.min(95, dodgeChance),   // cap dodge at 95%
    critChance:        Math.min(100, critChance),
    critDamage:        critDamage,
  };
}
