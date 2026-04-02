import { query } from '../../db/connection';
import type { DerivedCombatStats } from './combat-engine';

const DEFAULT_MAX_MANA = 100;
const DEFAULT_MANA_ON_HIT = 10;        // mana gained per attack landed
const DEFAULT_MANA_ON_DAMAGE_TAKEN = 5; // mana gained when hit
const DEFAULT_MANA_REGEN = 3;           // mana regenerated per turn
const DEFAULT_CRIT_DAMAGE = 150;

interface CharacterWithAttrs {
  max_hp: number;
  attack_power: number;
  defence: number;
  attr_constitution: number;
  attr_strength: number;
  attr_intelligence: number;
  attr_dexterity: number;
  attr_toughness: number;
  base_hp: number;
  base_attack: number;
  base_defence: number;
}

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
  // Load character attributes + class base stats
  const charResult = await query<CharacterWithAttrs>(
    `SELECT c.max_hp, c.attack_power, c.defence,
            c.attr_constitution, c.attr_strength, c.attr_intelligence,
            c.attr_dexterity, c.attr_toughness,
            cc.base_hp, cc.base_attack, cc.base_defence
     FROM characters c
     JOIN character_classes cc ON cc.id = c.class_id
     WHERE c.id = $1`,
    [characterId],
  );
  const char = charResult.rows[0];
  if (!char) throw new Error(`Character ${characterId} not found`);

  // Derive base stats from class + attributes
  const derivedMaxHp = char.base_hp + char.attr_constitution * 4;
  const derivedAttack = char.base_attack + char.attr_constitution * 1 + char.attr_strength * 2;
  const derivedDefence = char.base_defence + char.attr_toughness * 1;

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
  let maxMana = DEFAULT_MAX_MANA + char.attr_intelligence * 8;
  let manaOnHit = DEFAULT_MANA_ON_HIT;
  let manaOnDamageTaken = DEFAULT_MANA_ON_DAMAGE_TAKEN;
  let manaRegen = DEFAULT_MANA_REGEN;
  let dodgeChance = char.attr_dexterity * 0.1;
  let critChance = char.attr_dexterity * 0.1;
  let critDamage = DEFAULT_CRIT_DAMAGE + char.attr_strength * 0.3;
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
    critDamage = DEFAULT_CRIT_DAMAGE + char.attr_strength * 0.3;
  }

  return {
    attack:            derivedAttack + bonusAttack,
    defence:           derivedDefence + bonusDefence,
    maxHp:             derivedMaxHp,
    maxMana:           maxMana,
    manaOnHit:         manaOnHit,
    manaOnDamageTaken: manaOnDamageTaken,
    manaRegen:         manaRegen,
    dodgeChance:       Math.min(95, dodgeChance),   // cap dodge at 95%
    critChance:        Math.min(100, critChance),
    critDamage:        critDamage,
  };
}
