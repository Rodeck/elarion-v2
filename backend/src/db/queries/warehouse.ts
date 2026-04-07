import { query } from '../connection';
import type { ItemDefinition } from './inventory';

// ---------------------------------------------------------------------------
// TypeScript interfaces for DB rows
// ---------------------------------------------------------------------------

export interface WarehouseSlotRow {
  id: number;
  character_id: string;
  building_id: number;
  extra_slots: number;
  created_at: Date;
}

export interface WarehouseItemRow {
  id: number;
  character_id: string;
  building_id: number;
  item_def_id: number;
  quantity: number;
  current_durability: number | null;
  instance_attack: number | null;
  instance_defence: number | null;
  instance_crit_chance: number | null;
  instance_additional_attacks: number | null;
  instance_armor_penetration: number | null;
  instance_max_mana: number | null;
  instance_mana_on_hit: number | null;
  instance_mana_regen: number | null;
  instance_quality_tier: number | null;
  created_at: Date;
}

export interface WarehouseItemWithDefinition extends WarehouseItemRow {
  def_name: string;
  def_description: string | null;
  def_category: string;
  def_weapon_subtype: string | null;
  def_attack: number | null;
  def_defence: number | null;
  def_heal_power: number | null;
  def_food_power: number | null;
  def_stack_size: number | null;
  def_icon_filename: string | null;
  def_max_mana: number;
  def_mana_on_hit: number;
  def_mana_on_damage_taken: number;
  def_mana_regen: number;
  def_dodge_chance: number;
  def_crit_chance: number;
  def_crit_damage: number;
  def_tool_type: string | null;
  def_max_durability: number | null;
  def_power: number | null;
  def_ability_id: number | null;
  def_armor_penetration: number;
  def_additional_attacks: number;
}

const DEFAULT_SLOTS = 15;

// ---------------------------------------------------------------------------
// Warehouse Slots (capacity management)
// ---------------------------------------------------------------------------

export async function getOrCreateWarehouseSlots(
  characterId: string,
  buildingId: number,
): Promise<WarehouseSlotRow> {
  // Try to get existing
  const existing = await query<WarehouseSlotRow>(
    `SELECT * FROM warehouse_slots WHERE character_id = $1 AND building_id = $2`,
    [characterId, buildingId],
  );
  if (existing.rows[0]) return existing.rows[0];

  // Create on first visit
  const inserted = await query<WarehouseSlotRow>(
    `INSERT INTO warehouse_slots (character_id, building_id, extra_slots)
     VALUES ($1, $2, 0)
     ON CONFLICT (character_id, building_id) DO NOTHING
     RETURNING *`,
    [characterId, buildingId],
  );
  if (inserted.rows[0]) return inserted.rows[0];

  // Race condition: another request created it
  const retry = await query<WarehouseSlotRow>(
    `SELECT * FROM warehouse_slots WHERE character_id = $1 AND building_id = $2`,
    [characterId, buildingId],
  );
  return retry.rows[0]!;
}

export function getWarehouseCapacity(slotsRow: WarehouseSlotRow): number {
  return DEFAULT_SLOTS + slotsRow.extra_slots;
}

export function computeSlotCost(extraSlotsPurchased: number): number {
  // cost = 1000 * (2^(n+1) - 1) where n = extraSlotsPurchased
  return 1000 * (Math.pow(2, extraSlotsPurchased + 1) - 1);
}

export async function incrementWarehouseSlots(
  characterId: string,
  buildingId: number,
): Promise<WarehouseSlotRow> {
  const result = await query<WarehouseSlotRow>(
    `UPDATE warehouse_slots SET extra_slots = extra_slots + 1
     WHERE character_id = $1 AND building_id = $2
     RETURNING *`,
    [characterId, buildingId],
  );
  return result.rows[0]!;
}

// ---------------------------------------------------------------------------
// Warehouse Items (storage)
// ---------------------------------------------------------------------------

const WAREHOUSE_ITEMS_SELECT = `
  wi.id,
  wi.character_id,
  wi.building_id,
  wi.item_def_id,
  wi.quantity,
  wi.current_durability,
  wi.instance_attack,
  wi.instance_defence,
  wi.instance_crit_chance,
  wi.instance_additional_attacks,
  wi.instance_armor_penetration,
  wi.instance_max_mana,
  wi.instance_mana_on_hit,
  wi.instance_mana_regen,
  wi.instance_quality_tier,
  wi.created_at,
  d.name                  AS def_name,
  d.description           AS def_description,
  d.category              AS def_category,
  d.weapon_subtype        AS def_weapon_subtype,
  d.attack                AS def_attack,
  d.defence               AS def_defence,
  d.heal_power            AS def_heal_power,
  d.food_power            AS def_food_power,
  d.stack_size            AS def_stack_size,
  d.icon_filename         AS def_icon_filename,
  d.max_mana              AS def_max_mana,
  d.mana_on_hit           AS def_mana_on_hit,
  d.mana_on_damage_taken  AS def_mana_on_damage_taken,
  d.mana_regen            AS def_mana_regen,
  d.dodge_chance          AS def_dodge_chance,
  d.crit_chance           AS def_crit_chance,
  d.crit_damage           AS def_crit_damage,
  d.tool_type             AS def_tool_type,
  d.max_durability        AS def_max_durability,
  d.power                 AS def_power,
  d.ability_id            AS def_ability_id,
  d.armor_penetration     AS def_armor_penetration,
  d.additional_attacks    AS def_additional_attacks`;

export async function getWarehouseItems(
  characterId: string,
  buildingId: number,
): Promise<WarehouseItemWithDefinition[]> {
  const result = await query<WarehouseItemWithDefinition>(
    `SELECT ${WAREHOUSE_ITEMS_SELECT}
     FROM warehouse_items wi
     JOIN item_definitions d ON d.id = wi.item_def_id
     WHERE wi.character_id = $1 AND wi.building_id = $2
     ORDER BY wi.created_at ASC`,
    [characterId, buildingId],
  );
  return result.rows;
}

export async function getWarehouseItemById(
  warehouseItemId: number,
  characterId: string,
): Promise<WarehouseItemWithDefinition | null> {
  const result = await query<WarehouseItemWithDefinition>(
    `SELECT ${WAREHOUSE_ITEMS_SELECT}
     FROM warehouse_items wi
     JOIN item_definitions d ON d.id = wi.item_def_id
     WHERE wi.id = $1 AND wi.character_id = $2`,
    [warehouseItemId, characterId],
  );
  return result.rows[0] ?? null;
}

export async function countWarehouseItems(
  characterId: string,
  buildingId: number,
): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM warehouse_items
     WHERE character_id = $1 AND building_id = $2`,
    [characterId, buildingId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function findStackableWarehouseItem(
  characterId: string,
  buildingId: number,
  itemDefId: number,
): Promise<WarehouseItemRow | null> {
  const result = await query<WarehouseItemRow>(
    `SELECT wi.*
     FROM warehouse_items wi
     JOIN item_definitions d ON d.id = wi.item_def_id
     WHERE wi.character_id = $1
       AND wi.building_id = $2
       AND wi.item_def_id = $3
       AND d.stack_size IS NOT NULL
       AND wi.quantity < d.stack_size
     ORDER BY wi.created_at ASC
     LIMIT 1`,
    [characterId, buildingId, itemDefId],
  );
  return result.rows[0] ?? null;
}

export async function insertWarehouseItem(
  characterId: string,
  buildingId: number,
  itemDefId: number,
  quantity: number,
  stats: {
    current_durability: number | null;
    instance_attack: number | null;
    instance_defence: number | null;
    instance_crit_chance: number | null;
    instance_additional_attacks: number | null;
    instance_armor_penetration: number | null;
    instance_max_mana: number | null;
    instance_mana_on_hit: number | null;
    instance_mana_regen: number | null;
    instance_quality_tier: number | null;
  },
): Promise<WarehouseItemRow> {
  const result = await query<WarehouseItemRow>(
    `INSERT INTO warehouse_items (
       character_id, building_id, item_def_id, quantity,
       current_durability,
       instance_attack, instance_defence, instance_crit_chance,
       instance_additional_attacks, instance_armor_penetration,
       instance_max_mana, instance_mana_on_hit, instance_mana_regen,
       instance_quality_tier
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      characterId, buildingId, itemDefId, quantity,
      stats.current_durability,
      stats.instance_attack, stats.instance_defence, stats.instance_crit_chance,
      stats.instance_additional_attacks, stats.instance_armor_penetration,
      stats.instance_max_mana, stats.instance_mana_on_hit, stats.instance_mana_regen,
      stats.instance_quality_tier,
    ],
  );
  return result.rows[0]!;
}

export async function updateWarehouseItemQuantity(
  warehouseItemId: number,
  quantity: number,
): Promise<WarehouseItemRow | null> {
  const result = await query<WarehouseItemRow>(
    `UPDATE warehouse_items SET quantity = $1 WHERE id = $2 RETURNING *`,
    [quantity, warehouseItemId],
  );
  return result.rows[0] ?? null;
}

export async function deleteWarehouseItem(
  warehouseItemId: number,
  characterId: string,
): Promise<boolean> {
  const result = await query(
    `DELETE FROM warehouse_items WHERE id = $1 AND character_id = $2`,
    [warehouseItemId, characterId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getWarehouseItemDefIds(
  characterId: string,
  buildingId: number,
): Promise<Set<number>> {
  const result = await query<{ item_def_id: number }>(
    `SELECT DISTINCT item_def_id FROM warehouse_items
     WHERE character_id = $1 AND building_id = $2`,
    [characterId, buildingId],
  );
  return new Set(result.rows.map((r) => r.item_def_id));
}
