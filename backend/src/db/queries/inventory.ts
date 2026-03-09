import { query } from '../connection';

// ---------------------------------------------------------------------------
// TypeScript interfaces for DB rows
// ---------------------------------------------------------------------------

export interface ItemDefinition {
  id: number;
  name: string;
  description: string | null;
  category: string;
  weapon_subtype: string | null;
  attack: number | null;
  defence: number | null;
  heal_power: number | null;
  food_power: number | null;
  stack_size: number | null;
  icon_filename: string | null;
  created_at: Date;
}

export interface InventoryItem {
  id: number;
  character_id: string;
  item_def_id: number;
  quantity: number;
  created_at: Date;
}

export interface InventoryItemWithDefinition extends InventoryItem {
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
}

export interface CreateItemDefinitionData {
  name: string;
  description?: string | null;
  category: string;
  weapon_subtype?: string | null;
  attack?: number | null;
  defence?: number | null;
  heal_power?: number | null;
  food_power?: number | null;
  stack_size?: number | null;
  icon_filename?: string | null;
}

export interface UpdateItemDefinitionData {
  name?: string;
  description?: string | null;
  category?: string;
  weapon_subtype?: string | null;
  attack?: number | null;
  defence?: number | null;
  heal_power?: number | null;
  food_power?: number | null;
  stack_size?: number | null;
  icon_filename?: string | null;
}

// ---------------------------------------------------------------------------
// Admin CRUD functions
// ---------------------------------------------------------------------------

export async function getItemDefinitions(category?: string): Promise<ItemDefinition[]> {
  if (category) {
    const result = await query<ItemDefinition>(
      `SELECT * FROM item_definitions WHERE category = $1 ORDER BY name`,
      [category],
    );
    return result.rows;
  }
  const result = await query<ItemDefinition>(
    `SELECT * FROM item_definitions ORDER BY name`,
  );
  return result.rows;
}

export async function getItemDefinitionById(id: number): Promise<ItemDefinition | null> {
  const result = await query<ItemDefinition>(
    `SELECT * FROM item_definitions WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createItemDefinition(data: CreateItemDefinitionData): Promise<ItemDefinition> {
  const result = await query<ItemDefinition>(
    `INSERT INTO item_definitions
       (name, description, category, weapon_subtype, attack, defence, heal_power, food_power, stack_size, icon_filename)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.description ?? null,
      data.category,
      data.weapon_subtype ?? null,
      data.attack ?? null,
      data.defence ?? null,
      data.heal_power ?? null,
      data.food_power ?? null,
      data.stack_size ?? null,
      data.icon_filename ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function updateItemDefinition(id: number, data: UpdateItemDefinitionData): Promise<ItemDefinition | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined)           { fields.push(`name = $${paramIdx++}`);           values.push(data.name); }
  if (data.description !== undefined)    { fields.push(`description = $${paramIdx++}`);    values.push(data.description); }
  if (data.category !== undefined)       { fields.push(`category = $${paramIdx++}`);       values.push(data.category); }
  if (data.weapon_subtype !== undefined) { fields.push(`weapon_subtype = $${paramIdx++}`); values.push(data.weapon_subtype); }
  if (data.attack !== undefined)         { fields.push(`attack = $${paramIdx++}`);         values.push(data.attack); }
  if (data.defence !== undefined)        { fields.push(`defence = $${paramIdx++}`);        values.push(data.defence); }
  if (data.heal_power !== undefined)     { fields.push(`heal_power = $${paramIdx++}`);     values.push(data.heal_power); }
  if (data.food_power !== undefined)     { fields.push(`food_power = $${paramIdx++}`);     values.push(data.food_power); }
  if (data.stack_size !== undefined)     { fields.push(`stack_size = $${paramIdx++}`);     values.push(data.stack_size); }
  if (data.icon_filename !== undefined)  { fields.push(`icon_filename = $${paramIdx++}`);  values.push(data.icon_filename); }

  if (fields.length === 0) {
    return getItemDefinitionById(id);
  }

  values.push(id);
  const result = await query<ItemDefinition>(
    `UPDATE item_definitions SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteItemDefinition(id: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM item_definitions WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Inventory query functions
// ---------------------------------------------------------------------------

export async function getInventoryWithDefinitions(characterId: string): Promise<InventoryItemWithDefinition[]> {
  const result = await query<InventoryItemWithDefinition>(
    `SELECT
       ii.id,
       ii.character_id,
       ii.item_def_id,
       ii.quantity,
       ii.created_at,
       d.name          AS def_name,
       d.description   AS def_description,
       d.category      AS def_category,
       d.weapon_subtype AS def_weapon_subtype,
       d.attack        AS def_attack,
       d.defence       AS def_defence,
       d.heal_power    AS def_heal_power,
       d.food_power    AS def_food_power,
       d.stack_size    AS def_stack_size,
       d.icon_filename AS def_icon_filename
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.character_id = $1
       AND ii.equipped_slot IS NULL
     ORDER BY ii.created_at ASC`,
    [characterId],
  );
  return result.rows;
}

export async function getInventorySlotCount(characterId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM inventory_items WHERE character_id = $1 AND equipped_slot IS NULL`,
    [characterId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

// ---------------------------------------------------------------------------
// Effective stats query
// ---------------------------------------------------------------------------

export interface CharacterEffectiveStats {
  effective_attack:  number;
  effective_defence: number;
}

export async function getCharacterEffectiveStats(characterId: string): Promise<CharacterEffectiveStats> {
  const result = await query<{ effective_attack: string; effective_defence: string }>(
    `SELECT
       c.attack_power + COALESCE(SUM(d.attack), 0)   AS effective_attack,
       c.defence      + COALESCE(SUM(d.defence), 0)  AS effective_defence
     FROM characters c
     LEFT JOIN inventory_items ii
       ON ii.character_id = c.id AND ii.equipped_slot IS NOT NULL
     LEFT JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE c.id = $1
     GROUP BY c.id, c.attack_power, c.defence`,
    [characterId],
  );
  const row = result.rows[0];
  return {
    effective_attack:  parseInt(row?.effective_attack  ?? '0', 10),
    effective_defence: parseInt(row?.effective_defence ?? '0', 10),
  };
}

export async function findStackableSlot(characterId: string, itemDefId: number): Promise<InventoryItem | null> {
  const result = await query<InventoryItem>(
    `SELECT ii.*
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.character_id = $1
       AND ii.item_def_id = $2
       AND d.stack_size IS NOT NULL
       AND ii.quantity < d.stack_size
     ORDER BY ii.created_at ASC
     LIMIT 1`,
    [characterId, itemDefId],
  );
  return result.rows[0] ?? null;
}

export async function insertInventoryItem(characterId: string, itemDefId: number, quantity: number): Promise<InventoryItem> {
  const result = await query<InventoryItem>(
    `INSERT INTO inventory_items (character_id, item_def_id, quantity)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [characterId, itemDefId, quantity],
  );
  return result.rows[0]!;
}

export async function updateInventoryQuantity(slotId: number, quantity: number): Promise<InventoryItem | null> {
  const result = await query<InventoryItem>(
    `UPDATE inventory_items SET quantity = $1 WHERE id = $2 RETURNING *`,
    [quantity, slotId],
  );
  return result.rows[0] ?? null;
}

/** Deletes all inventory rows for a character (including equipped items). Returns the count of deleted rows. */
export async function clearAllInventory(characterId: string): Promise<number> {
  const result = await query(
    `DELETE FROM inventory_items WHERE character_id = $1`,
    [characterId],
  );
  return result.rowCount ?? 0;
}

/** Returns true if a row was deleted, false if the slot was not found or doesn't belong to the character. */
export async function deleteInventoryItem(slotId: number, characterId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM inventory_items WHERE id = $1 AND character_id = $2`,
    [slotId, characterId],
  );
  return (result.rowCount ?? 0) > 0;
}
