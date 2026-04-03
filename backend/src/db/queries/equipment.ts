import { query } from '../connection';
import { config } from '../../config';
import type {
  EquipmentSlotsDto,
  EquipSlot,
  InventorySlotDto,
  ItemCategory,
  WeaponSubtype,
} from '../../../../shared/protocol/index';
import type { InventoryItemWithDefinition } from './inventory';

// ---------------------------------------------------------------------------
// Slot → allowed item categories mapping
// ---------------------------------------------------------------------------

const SLOT_CATEGORY_MAP: Record<string, string[]> = {
  right_arm:  ['weapon'],
  left_arm:   ['shield'],
  helmet:     ['helmet'],
  chestplate: ['chestplate'],
  greaves:    ['greaves'],
  bracer:     ['bracer'],
  boots:      ['boots'],
  ring:       ['ring'],
  amulet:     ['amulet'],
};

const TWO_HANDED_SUBTYPES = ['two_handed', 'staff'];

// ---------------------------------------------------------------------------
// Internal DB row types
// ---------------------------------------------------------------------------

interface EquippedItemRow extends InventoryItemWithDefinition {
  equipped_slot: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

function buildInventorySlotDto(row: InventoryItemWithDefinition): InventorySlotDto {
  return {
    slot_id: row.id,
    item_def_id: row.item_def_id,
    quantity: row.quantity,
    current_durability: row.current_durability ?? undefined,
    definition: {
      id: row.item_def_id,
      name: row.def_name,
      description: row.def_description ?? '',
      category: row.def_category as ItemCategory,
      weapon_subtype: (row.def_weapon_subtype as WeaponSubtype) ?? null,
      attack: row.def_attack,
      defence: row.def_defence,
      heal_power: row.def_heal_power,
      food_power: row.def_food_power,
      stack_size: row.def_stack_size,
      icon_url: buildIconUrl(row.def_icon_filename),
      max_mana: row.def_max_mana,
      mana_on_hit: row.def_mana_on_hit,
      mana_on_damage_taken: row.def_mana_on_damage_taken,
      mana_regen: row.def_mana_regen,
      dodge_chance: row.def_dodge_chance,
      crit_chance: row.def_crit_chance,
      crit_damage: row.def_crit_damage,
      tool_type: row.def_tool_type ?? null,
      max_durability: row.def_max_durability ?? null,
      power: row.def_power ?? null,
      ability_id: row.def_ability_id ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// getEquipmentState
// ---------------------------------------------------------------------------

export async function getEquipmentState(characterId: string): Promise<EquipmentSlotsDto> {
  const result = await query<EquippedItemRow>(
    `SELECT
       ii.id,
       ii.character_id,
       ii.item_def_id,
       ii.quantity,
       ii.created_at,
       ii.equipped_slot,
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
       ii.current_durability
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.character_id = $1
       AND ii.equipped_slot IS NOT NULL`,
    [characterId],
  );

  const slots: EquipmentSlotsDto = {
    helmet:     null,
    chestplate: null,
    left_arm:   null,
    right_arm:  null,
    greaves:    null,
    bracer:     null,
    boots:      null,
    ring:       null,
    amulet:     null,
  };

  for (const row of result.rows) {
    const slotName = row.equipped_slot as EquipSlot;
    if (slotName in slots) {
      slots[slotName] = buildInventorySlotDto(row);
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// equipItem result type
// ---------------------------------------------------------------------------

export interface EquipResult {
  inventory_added:   InventorySlotDto[];
  inventory_removed: number[];
}

// ---------------------------------------------------------------------------
// equipItem
// ---------------------------------------------------------------------------

export async function equipItem(
  characterId: string,
  slotId: number,
  slotName: EquipSlot,
): Promise<EquipResult | 'ITEM_NOT_FOUND' | 'WRONG_SLOT_TYPE' | 'TWO_HANDED_BLOCKS' | 'INVENTORY_FULL'> {
  try {
    await query('BEGIN');

    // 1. Fetch the item to equip — must be owned and currently unequipped
    const itemResult = await query<EquippedItemRow>(
      `SELECT
         ii.id,
         ii.character_id,
         ii.item_def_id,
         ii.quantity,
         ii.created_at,
         ii.equipped_slot,
         d.name           AS def_name,
         d.description    AS def_description,
         d.category       AS def_category,
         d.weapon_subtype AS def_weapon_subtype,
         d.attack         AS def_attack,
         d.defence        AS def_defence,
         d.heal_power     AS def_heal_power,
         d.food_power     AS def_food_power,
         d.stack_size     AS def_stack_size,
         d.icon_filename  AS def_icon_filename,
         d.tool_type      AS def_tool_type,
         d.max_durability AS def_max_durability,
         d.power          AS def_power,
         ii.current_durability
       FROM inventory_items ii
       JOIN item_definitions d ON d.id = ii.item_def_id
       WHERE ii.id = $1 AND ii.character_id = $2 AND ii.equipped_slot IS NULL`,
      [slotId, characterId],
    );

    if (itemResult.rows.length === 0) {
      await query('ROLLBACK');
      return 'ITEM_NOT_FOUND';
    }

    const itemRow = itemResult.rows[0]!;

    // 2. Validate category matches slot
    const allowedCategories = SLOT_CATEGORY_MAP[slotName] ?? [];
    if (!allowedCategories.includes(itemRow.def_category)) {
      await query('ROLLBACK');
      return 'WRONG_SLOT_TYPE';
    }

    const inventory_added: InventorySlotDto[] = [];
    const inventory_removed: number[] = [slotId];

    // 3. Check if this is a two-handed weapon being equipped to right_arm
    const isTwoHanded = slotName === 'right_arm' && TWO_HANDED_SUBTYPES.includes(itemRow.def_weapon_subtype ?? '');

    // 4. Find currently occupied target slot (if any)
    const currentInSlotResult = await query<EquippedItemRow>(
      `SELECT
         ii.id,
         ii.character_id,
         ii.item_def_id,
         ii.quantity,
         ii.created_at,
         ii.equipped_slot,
         d.name           AS def_name,
         d.description    AS def_description,
         d.category       AS def_category,
         d.weapon_subtype AS def_weapon_subtype,
         d.attack         AS def_attack,
         d.defence        AS def_defence,
         d.heal_power     AS def_heal_power,
         d.food_power     AS def_food_power,
         d.stack_size     AS def_stack_size,
         d.icon_filename  AS def_icon_filename,
         d.tool_type      AS def_tool_type,
         d.max_durability AS def_max_durability,
         d.power          AS def_power,
         ii.current_durability
       FROM inventory_items ii
       JOIN item_definitions d ON d.id = ii.item_def_id
       WHERE ii.character_id = $1 AND ii.equipped_slot = $2`,
      [characterId, slotName],
    );

    // 5. Find shield in left_arm if equipping 2H weapon
    let shieldRow: EquippedItemRow | null = null;
    if (isTwoHanded) {
      const shieldResult = await query<EquippedItemRow>(
        `SELECT
           ii.id,
           ii.character_id,
           ii.item_def_id,
           ii.quantity,
           ii.created_at,
           ii.equipped_slot,
           d.name           AS def_name,
           d.description    AS def_description,
           d.category       AS def_category,
           d.weapon_subtype AS def_weapon_subtype,
           d.attack         AS def_attack,
           d.defence        AS def_defence,
           d.heal_power     AS def_heal_power,
           d.food_power     AS def_food_power,
           d.stack_size     AS def_stack_size,
           d.icon_filename  AS def_icon_filename,
           d.tool_type      AS def_tool_type,
           d.max_durability AS def_max_durability,
           d.power          AS def_power,
           ii.current_durability
         FROM inventory_items ii
         JOIN item_definitions d ON d.id = ii.item_def_id
         WHERE ii.character_id = $1 AND ii.equipped_slot = 'left_arm'`,
        [characterId],
      );
      shieldRow = shieldResult.rows[0] ?? null;
    }

    // 6. Check inventory capacity for items that need to be returned
    //    Count current non-equipped items (not counting the item we're equipping)
    const nonEquippedCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inventory_items WHERE character_id = $1 AND equipped_slot IS NULL AND id != $2`,
      [characterId, slotId],
    );
    const nonEquippedCount = parseInt(nonEquippedCountResult.rows[0]?.count ?? '0', 10);

    // How many items will be returned to inventory?
    const returnCount = (currentInSlotResult.rows.length > 0 ? 1 : 0) + (shieldRow ? 1 : 0);

    if (nonEquippedCount + returnCount > 20) {
      await query('ROLLBACK');
      return 'INVENTORY_FULL';
    }

    // 7. Return item currently in target slot to inventory
    if (currentInSlotResult.rows.length > 0) {
      const oldItem = currentInSlotResult.rows[0]!;
      await query(
        `UPDATE inventory_items SET equipped_slot = NULL WHERE id = $1`,
        [oldItem.id],
      );
      inventory_added.push(buildInventorySlotDto(oldItem));
    }

    // 8. Auto-return shield if equipping 2H weapon
    if (shieldRow) {
      await query(
        `UPDATE inventory_items SET equipped_slot = NULL WHERE id = $1`,
        [shieldRow.id],
      );
      inventory_added.push(buildInventorySlotDto(shieldRow));
    }

    // 9. Equip the new item
    await query(
      `UPDATE inventory_items SET equipped_slot = $1 WHERE id = $2 AND character_id = $3`,
      [slotName, slotId, characterId],
    );

    await query('COMMIT');

    return { inventory_added, inventory_removed };
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// unequipItem
// ---------------------------------------------------------------------------

export async function unequipItem(
  characterId: string,
  slotName: EquipSlot,
): Promise<InventorySlotDto | 'SLOT_EMPTY' | 'INVENTORY_FULL'> {
  try {
    await query('BEGIN');

    // 1. Find item in the slot
    const slotResult = await query<EquippedItemRow>(
      `SELECT
         ii.id,
         ii.character_id,
         ii.item_def_id,
         ii.quantity,
         ii.created_at,
         ii.equipped_slot,
         d.name           AS def_name,
         d.description    AS def_description,
         d.category       AS def_category,
         d.weapon_subtype AS def_weapon_subtype,
         d.attack         AS def_attack,
         d.defence        AS def_defence,
         d.heal_power     AS def_heal_power,
         d.food_power     AS def_food_power,
         d.stack_size     AS def_stack_size,
         d.icon_filename  AS def_icon_filename,
         d.tool_type      AS def_tool_type,
         d.max_durability AS def_max_durability,
         d.power          AS def_power,
         ii.current_durability
       FROM inventory_items ii
       JOIN item_definitions d ON d.id = ii.item_def_id
       WHERE ii.character_id = $1 AND ii.equipped_slot = $2`,
      [characterId, slotName],
    );

    if (slotResult.rows.length === 0) {
      await query('ROLLBACK');
      return 'SLOT_EMPTY';
    }

    const equippedItem = slotResult.rows[0]!;

    // 2. Check free inventory capacity
    const nonEquippedCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inventory_items WHERE character_id = $1 AND equipped_slot IS NULL`,
      [characterId],
    );
    const nonEquippedCount = parseInt(nonEquippedCountResult.rows[0]?.count ?? '0', 10);

    if (nonEquippedCount >= 20) {
      await query('ROLLBACK');
      return 'INVENTORY_FULL';
    }

    // 3. Unequip the item
    await query(
      `UPDATE inventory_items SET equipped_slot = NULL WHERE id = $1 AND character_id = $2`,
      [equippedItem.id, characterId],
    );

    await query('COMMIT');

    return buildInventorySlotDto(equippedItem);
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}
