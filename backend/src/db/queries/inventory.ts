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
  max_mana: number;
  mana_on_hit: number;
  mana_on_damage_taken: number;
  mana_regen: number;
  dodge_chance: number;
  crit_chance: number;
  crit_damage: number;
  tool_type: string | null;
  max_durability: number | null;
  power: number | null;
  disassembly_cost: number;
  ability_id: number | null;
  armor_penetration: number;
  additional_attacks: number;
  created_at: Date;
}

export interface InventoryItem {
  id: number;
  character_id: string;
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

export interface InventoryItemWithDefinition extends Omit<InventoryItem, never> {
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
  current_durability: number | null;
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
  tool_type?: string | null;
  max_durability?: number | null;
  power?: number | null;
  disassembly_cost?: number;
  ability_id?: number | null;
  armor_penetration?: number;
  additional_attacks?: number;
  crit_chance?: number;
  max_mana?: number;
  mana_on_hit?: number;
  mana_on_damage_taken?: number;
  mana_regen?: number;
  dodge_chance?: number;
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
  tool_type?: string | null;
  max_durability?: number | null;
  power?: number | null;
  disassembly_cost?: number;
  ability_id?: number | null;
  armor_penetration?: number;
  additional_attacks?: number;
  crit_chance?: number;
  max_mana?: number;
  mana_on_hit?: number;
  mana_on_damage_taken?: number;
  mana_regen?: number;
  dodge_chance?: number;
}

// ---------------------------------------------------------------------------
// Random item from category (used by loot system)
// ---------------------------------------------------------------------------

export async function getRandomItemByCategory(category: string): Promise<{ id: number; name: string; icon_filename: string | null } | null> {
  const result = await query<{ id: number; name: string; icon_filename: string | null }>(
    `SELECT id, name, icon_filename FROM item_definitions WHERE category = $1 ORDER BY random() LIMIT 1`,
    [category],
  );
  return result.rows[0] ?? null;
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
       (name, description, category, weapon_subtype, attack, defence, heal_power, food_power, stack_size, icon_filename, tool_type, max_durability, power, disassembly_cost, ability_id, armor_penetration, additional_attacks, crit_chance, max_mana, mana_on_hit, mana_on_damage_taken, mana_regen, dodge_chance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
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
      data.tool_type ?? null,
      data.max_durability ?? null,
      data.power ?? null,
      data.disassembly_cost ?? 0,
      data.ability_id ?? null,
      data.armor_penetration ?? 0,
      data.additional_attacks ?? 0,
      data.crit_chance ?? 0,
      data.max_mana ?? 0,
      data.mana_on_hit ?? 0,
      data.mana_on_damage_taken ?? 0,
      data.mana_regen ?? 0,
      data.dodge_chance ?? 0,
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
  if (data.tool_type !== undefined)      { fields.push(`tool_type = $${paramIdx++}`);      values.push(data.tool_type); }
  if (data.max_durability !== undefined) { fields.push(`max_durability = $${paramIdx++}`); values.push(data.max_durability); }
  if (data.power !== undefined)          { fields.push(`power = $${paramIdx++}`);          values.push(data.power); }
  if (data.disassembly_cost !== undefined) { fields.push(`disassembly_cost = $${paramIdx++}`); values.push(data.disassembly_cost); }
  if (data.ability_id !== undefined)      { fields.push(`ability_id = $${paramIdx++}`);      values.push(data.ability_id); }
  if (data.armor_penetration !== undefined) { fields.push(`armor_penetration = $${paramIdx++}`); values.push(data.armor_penetration); }
  if (data.additional_attacks !== undefined) { fields.push(`additional_attacks = $${paramIdx++}`); values.push(data.additional_attacks); }
  if (data.crit_chance !== undefined) { fields.push(`crit_chance = $${paramIdx++}`); values.push(data.crit_chance); }
  if (data.max_mana !== undefined) { fields.push(`max_mana = $${paramIdx++}`); values.push(data.max_mana); }
  if (data.mana_on_hit !== undefined) { fields.push(`mana_on_hit = $${paramIdx++}`); values.push(data.mana_on_hit); }
  if (data.mana_on_damage_taken !== undefined) { fields.push(`mana_on_damage_taken = $${paramIdx++}`); values.push(data.mana_on_damage_taken); }
  if (data.mana_regen !== undefined) { fields.push(`mana_regen = $${paramIdx++}`); values.push(data.mana_regen); }
  if (data.dodge_chance !== undefined) { fields.push(`dodge_chance = $${paramIdx++}`); values.push(data.dodge_chance); }

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
       ii.current_durability,
       ii.created_at,
       ii.instance_attack,
       ii.instance_defence,
       ii.instance_crit_chance,
       ii.instance_additional_attacks,
       ii.instance_armor_penetration,
       ii.instance_max_mana,
       ii.instance_mana_on_hit,
       ii.instance_mana_regen,
       ii.instance_quality_tier,
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
       d.additional_attacks    AS def_additional_attacks
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
       c.attack_power + COALESCE(SUM(COALESCE(ii.instance_attack, d.attack)), 0)   AS effective_attack,
       c.defence      + COALESCE(SUM(COALESCE(ii.instance_defence, d.defence)), 0)  AS effective_defence
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

export interface InstanceStatsInsert {
  instance_attack: number | null;
  instance_defence: number | null;
  instance_crit_chance: number | null;
  instance_additional_attacks: number | null;
  instance_armor_penetration: number | null;
  instance_max_mana: number | null;
  instance_mana_on_hit: number | null;
  instance_mana_regen: number | null;
  instance_quality_tier: number | null;
}

export async function insertInventoryItemWithStats(
  characterId: string,
  itemDefId: number,
  quantity: number,
  stats: InstanceStatsInsert,
): Promise<InventoryItem> {
  const result = await query<InventoryItem>(
    `INSERT INTO inventory_items (
       character_id, item_def_id, quantity,
       instance_attack, instance_defence, instance_crit_chance,
       instance_additional_attacks, instance_armor_penetration,
       instance_max_mana, instance_mana_on_hit, instance_mana_regen,
       instance_quality_tier
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      characterId, itemDefId, quantity,
      stats.instance_attack, stats.instance_defence, stats.instance_crit_chance,
      stats.instance_additional_attacks, stats.instance_armor_penetration,
      stats.instance_max_mana, stats.instance_mana_on_hit, stats.instance_mana_regen,
      stats.instance_quality_tier,
    ],
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

// ---------------------------------------------------------------------------
// Tool durability functions
// ---------------------------------------------------------------------------

export async function updateToolDurability(slotId: number, newDurability: number): Promise<void> {
  await query(
    `UPDATE inventory_items SET current_durability = $1 WHERE id = $2`,
    [newDurability, slotId],
  );
}

export async function insertToolInventoryItem(
  characterId: string,
  itemDefId: number,
  durability: number,
): Promise<InventoryItem> {
  const result = await query<InventoryItem>(
    `INSERT INTO inventory_items (character_id, item_def_id, quantity, current_durability)
     VALUES ($1, $2, 1, $3)
     RETURNING *`,
    [characterId, itemDefId, durability],
  );
  return result.rows[0]!;
}

/** Find the first tool of a given type in a character's inventory (unequipped), ordered by oldest first. */
export async function findToolByType(
  characterId: string,
  toolType: string,
): Promise<(InventoryItem & { def_max_durability: number; def_power: number | null }) | null> {
  const result = await query<InventoryItem & { def_max_durability: number; def_power: number | null }>(
    `SELECT ii.*, d.max_durability AS def_max_durability, d.power AS def_power
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.character_id = $1
       AND d.tool_type = $2
       AND ii.equipped_slot IS NULL
     ORDER BY ii.created_at ASC
     LIMIT 1`,
    [characterId, toolType],
  );
  return result.rows[0] ?? null;
}

/** Get a single inventory slot by id with its definition, for the given character. */
export async function getInventorySlotById(
  slotId: number,
  characterId: string,
): Promise<InventoryItemWithDefinition | null> {
  const result = await query<InventoryItemWithDefinition>(
    `SELECT
       ii.id,
       ii.character_id,
       ii.item_def_id,
       ii.quantity,
       ii.current_durability,
       ii.created_at,
       ii.instance_attack,
       ii.instance_defence,
       ii.instance_crit_chance,
       ii.instance_additional_attacks,
       ii.instance_armor_penetration,
       ii.instance_max_mana,
       ii.instance_mana_on_hit,
       ii.instance_mana_regen,
       ii.instance_quality_tier,
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
       d.additional_attacks    AS def_additional_attacks
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.id = $1 AND ii.character_id = $2`,
    [slotId, characterId],
  );
  return result.rows[0] ?? null;
}
