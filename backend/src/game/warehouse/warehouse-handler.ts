import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { config } from '../../config';
import { findByAccountId } from '../../db/queries/characters';
import { getCityMapCache } from '../world/city-map-loader';
import { getBuildingActions, getBuildingById } from '../../db/queries/city-maps';
import {
  getOrCreateWarehouseSlots,
  getWarehouseItems,
  getWarehouseItemById,
  countWarehouseItems,
  getWarehouseCapacity,
  computeSlotCost,
  findStackableWarehouseItem,
  insertWarehouseItem,
  updateWarehouseItemQuantity,
  deleteWarehouseItem,
  incrementWarehouseSlots,
  getWarehouseItemDefIds,
} from '../../db/queries/warehouse';
import type { WarehouseItemWithDefinition } from '../../db/queries/warehouse';
import {
  getInventoryWithDefinitions,
  getInventorySlotById,
  getInventorySlotCount,
  findStackableSlot,
  insertInventoryItemWithStats,
  updateInventoryQuantity,
  deleteInventoryItem,
} from '../../db/queries/inventory';
import type { InventoryItemWithDefinition } from '../../db/queries/inventory';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { query } from '../../db/connection';
import type {
  WarehouseDepositPayload,
  WarehouseWithdrawPayload,
  WarehouseBulkToInventoryPayload,
  WarehouseBulkToWarehousePayload,
  WarehouseMergePayload,
  WarehouseBuySlotPayload,
  WarehouseSlotDto,
  ItemCategory,
  WeaponSubtype,
  QualityTier,
} from '../../../../shared/protocol/index';
import { QUALITY_LABELS } from '../../../../shared/protocol/index';

const INVENTORY_CAPACITY = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

function toWarehouseSlotDto(row: WarehouseItemWithDefinition): WarehouseSlotDto {
  const tier = row.instance_quality_tier as QualityTier | null;
  return {
    slot_id: row.id,
    item_def_id: row.item_def_id,
    quantity: row.quantity,
    current_durability: row.current_durability ?? undefined,
    instance_attack: row.instance_attack ?? null,
    instance_defence: row.instance_defence ?? null,
    instance_crit_chance: row.instance_crit_chance ?? null,
    instance_additional_attacks: row.instance_additional_attacks ?? null,
    instance_armor_penetration: row.instance_armor_penetration ?? null,
    instance_max_mana: row.instance_max_mana ?? null,
    instance_mana_on_hit: row.instance_mana_on_hit ?? null,
    instance_mana_regen: row.instance_mana_regen ?? null,
    quality_tier: tier,
    quality_label: tier ? QUALITY_LABELS[tier] : null,
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
      armor_penetration: row.def_armor_penetration ?? 0,
      additional_attacks: row.def_additional_attacks ?? 0,
      tool_type: row.def_tool_type ?? null,
      max_durability: row.def_max_durability ?? null,
      power: row.def_power ?? null,
      ability_id: row.def_ability_id ?? null,
    },
  };
}

async function sendWarehouseState(
  session: AuthenticatedSession,
  characterId: string,
  buildingId: number,
): Promise<void> {
  const slotsRow = await getOrCreateWarehouseSlots(characterId, buildingId);
  const items = await getWarehouseItems(characterId, buildingId);
  const capacity = getWarehouseCapacity(slotsRow);

  sendToSession(session, 'warehouse.state', {
    building_id: buildingId,
    slots: items.map(toWarehouseSlotDto),
    total_capacity: capacity,
    used_slots: items.length,
    extra_slots_purchased: slotsRow.extra_slots,
    next_slot_cost: computeSlotCost(slotsRow.extra_slots),
  });
}

function extractInstanceStats(row: InventoryItemWithDefinition | WarehouseItemWithDefinition) {
  return {
    current_durability: row.current_durability,
    instance_attack: row.instance_attack,
    instance_defence: row.instance_defence,
    instance_crit_chance: row.instance_crit_chance,
    instance_additional_attacks: row.instance_additional_attacks,
    instance_armor_penetration: row.instance_armor_penetration,
    instance_max_mana: row.instance_max_mana,
    instance_mana_on_hit: row.instance_mana_on_hit,
    instance_mana_regen: row.instance_mana_regen,
    instance_quality_tier: row.instance_quality_tier,
  };
}

// ---------------------------------------------------------------------------
// Deposit: inventory → warehouse
// ---------------------------------------------------------------------------

async function handleDeposit(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { building_id, inventory_slot_id, quantity } = payload as WarehouseDepositPayload;
  const characterId = session.characterId!;

  // Validate slot exists, is unequipped, and belongs to character
  const invSlot = await getInventorySlotById(inventory_slot_id, characterId);
  if (!invSlot) {
    sendToSession(session, 'warehouse.rejected', { reason: 'item_not_found', message: 'Item not found in inventory.' });
    return;
  }

  // Check for equipped items (equipped_slot column from the raw query)
  const equippedCheck = await query<{ equipped_slot: string | null }>(
    'SELECT equipped_slot FROM inventory_items WHERE id = $1',
    [inventory_slot_id],
  );
  if (equippedCheck.rows[0]?.equipped_slot) {
    sendToSession(session, 'warehouse.rejected', { reason: 'equipped_item', message: 'Cannot store equipped items.' });
    return;
  }

  const depositQty = Math.min(quantity, invSlot.quantity);
  if (depositQty <= 0) {
    sendToSession(session, 'warehouse.rejected', { reason: 'invalid_quantity', message: 'Invalid quantity.' });
    return;
  }

  // Check warehouse capacity
  const slotsRow = await getOrCreateWarehouseSlots(characterId, building_id);
  const capacity = getWarehouseCapacity(slotsRow);
  const usedCount = await countWarehouseItems(characterId, building_id);

  // Try to stack into existing warehouse slot
  const stackable = await findStackableWarehouseItem(characterId, building_id, invSlot.item_def_id);
  if (stackable) {
    const stackSize = invSlot.def_stack_size ?? 1;
    const canStack = Math.min(depositQty, stackSize - stackable.quantity);
    if (canStack > 0) {
      await updateWarehouseItemQuantity(stackable.id, stackable.quantity + canStack);
      // Update or delete inventory
      if (canStack >= invSlot.quantity) {
        await deleteInventoryItem(inventory_slot_id, characterId);
      } else {
        await updateInventoryQuantity(inventory_slot_id, invSlot.quantity - canStack);
      }
      log('info', 'warehouse', 'deposit', { character_id: characterId, building_id, item_def_id: invSlot.item_def_id, quantity: canStack });
      await sendWarehouseState(session, characterId, building_id);
      await sendInventoryState(session);
      return;
    }
  }

  // New slot needed
  if (usedCount >= capacity) {
    sendToSession(session, 'warehouse.rejected', { reason: 'warehouse_full', message: 'Warehouse is full.' });
    return;
  }

  await insertWarehouseItem(characterId, building_id, invSlot.item_def_id, depositQty, extractInstanceStats(invSlot));

  if (depositQty >= invSlot.quantity) {
    await deleteInventoryItem(inventory_slot_id, characterId);
  } else {
    await updateInventoryQuantity(inventory_slot_id, invSlot.quantity - depositQty);
  }

  log('info', 'warehouse', 'deposit', { character_id: characterId, building_id, item_def_id: invSlot.item_def_id, quantity: depositQty });
  await sendWarehouseState(session, characterId, building_id);
  await sendInventoryState(session);
}

// ---------------------------------------------------------------------------
// Withdraw: warehouse → inventory
// ---------------------------------------------------------------------------

async function handleWithdraw(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { building_id, warehouse_slot_id, quantity } = payload as WarehouseWithdrawPayload;
  const characterId = session.characterId!;

  const whItem = await getWarehouseItemById(warehouse_slot_id, characterId);
  if (!whItem || whItem.building_id !== building_id) {
    sendToSession(session, 'warehouse.rejected', { reason: 'item_not_found', message: 'Item not found in warehouse.' });
    return;
  }

  const withdrawQty = Math.min(quantity, whItem.quantity);
  if (withdrawQty <= 0) {
    sendToSession(session, 'warehouse.rejected', { reason: 'invalid_quantity', message: 'Invalid quantity.' });
    return;
  }

  // Check inventory capacity
  const invCount = await getInventorySlotCount(characterId);

  // Try to stack into existing inventory slot
  const stackable = await findStackableSlot(characterId, whItem.item_def_id);
  if (stackable) {
    const stackSize = whItem.def_stack_size ?? 1;
    const canStack = Math.min(withdrawQty, stackSize - stackable.quantity);
    if (canStack > 0) {
      await updateInventoryQuantity(stackable.id, stackable.quantity + canStack);
      if (canStack >= whItem.quantity) {
        await deleteWarehouseItem(warehouse_slot_id, characterId);
      } else {
        await updateWarehouseItemQuantity(warehouse_slot_id, whItem.quantity - canStack);
      }
      log('info', 'warehouse', 'withdraw', { character_id: characterId, building_id, item_def_id: whItem.item_def_id, quantity: canStack });
      await sendWarehouseState(session, characterId, building_id);
      await sendInventoryState(session);
      return;
    }
  }

  // New inventory slot needed
  if (invCount >= INVENTORY_CAPACITY) {
    sendToSession(session, 'warehouse.rejected', { reason: 'inventory_full', message: 'Inventory is full.' });
    return;
  }

  await insertInventoryItemWithStats(characterId, whItem.item_def_id, withdrawQty, extractInstanceStats(whItem));

  if (withdrawQty >= whItem.quantity) {
    await deleteWarehouseItem(warehouse_slot_id, characterId);
  } else {
    await updateWarehouseItemQuantity(warehouse_slot_id, whItem.quantity - withdrawQty);
  }

  log('info', 'warehouse', 'withdraw', { character_id: characterId, building_id, item_def_id: whItem.item_def_id, quantity: withdrawQty });
  await sendWarehouseState(session, characterId, building_id);
  await sendInventoryState(session);
}

// ---------------------------------------------------------------------------
// Bulk: all warehouse → inventory
// ---------------------------------------------------------------------------

async function handleBulkToInventory(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { building_id } = payload as WarehouseBulkToInventoryPayload;
  const characterId = session.characterId!;

  const whItems = await getWarehouseItems(characterId, building_id);
  let transferred = 0;
  let skipped = 0;

  for (const item of whItems) {
    const invCount = await getInventorySlotCount(characterId);
    // Try stacking first
    const stackable = await findStackableSlot(characterId, item.item_def_id);
    if (stackable) {
      const stackSize = item.def_stack_size ?? 1;
      const canStack = Math.min(item.quantity, stackSize - stackable.quantity);
      if (canStack > 0) {
        await updateInventoryQuantity(stackable.id, stackable.quantity + canStack);
        if (canStack >= item.quantity) {
          await deleteWarehouseItem(item.id, characterId);
        } else {
          await updateWarehouseItemQuantity(item.id, item.quantity - canStack);
        }
        transferred++;
        continue;
      }
    }

    if (invCount >= INVENTORY_CAPACITY) {
      skipped++;
      continue;
    }

    await insertInventoryItemWithStats(characterId, item.item_def_id, item.quantity, extractInstanceStats(item));
    await deleteWarehouseItem(item.id, characterId);
    transferred++;
  }

  log('info', 'warehouse', 'bulk_to_inventory', { character_id: characterId, building_id, transferred, skipped });
  await sendWarehouseState(session, characterId, building_id);
  await sendInventoryState(session);
  sendToSession(session, 'warehouse.bulk_result', { transferred_count: transferred, skipped_count: skipped, partial: skipped > 0 });
}

// ---------------------------------------------------------------------------
// Bulk: all inventory → warehouse
// ---------------------------------------------------------------------------

async function handleBulkToWarehouse(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { building_id } = payload as WarehouseBulkToWarehousePayload;
  const characterId = session.characterId!;

  const slotsRow = await getOrCreateWarehouseSlots(characterId, building_id);
  const capacity = getWarehouseCapacity(slotsRow);
  const invItems = await getInventoryWithDefinitions(characterId);
  let transferred = 0;
  let skipped = 0;

  for (const item of invItems) {
    const usedCount = await countWarehouseItems(characterId, building_id);
    // Try stacking first
    const stackable = await findStackableWarehouseItem(characterId, building_id, item.item_def_id);
    if (stackable) {
      const stackSize = item.def_stack_size ?? 1;
      const canStack = Math.min(item.quantity, stackSize - stackable.quantity);
      if (canStack > 0) {
        await updateWarehouseItemQuantity(stackable.id, stackable.quantity + canStack);
        if (canStack >= item.quantity) {
          await deleteInventoryItem(item.id, characterId);
        } else {
          await updateInventoryQuantity(item.id, item.quantity - canStack);
        }
        transferred++;
        continue;
      }
    }

    if (usedCount >= capacity) {
      skipped++;
      continue;
    }

    await insertWarehouseItem(characterId, building_id, item.item_def_id, item.quantity, extractInstanceStats(item));
    await deleteInventoryItem(item.id, characterId);
    transferred++;
  }

  log('info', 'warehouse', 'bulk_to_warehouse', { character_id: characterId, building_id, transferred, skipped });
  await sendWarehouseState(session, characterId, building_id);
  await sendInventoryState(session);
  sendToSession(session, 'warehouse.bulk_result', { transferred_count: transferred, skipped_count: skipped, partial: skipped > 0 });
}

// ---------------------------------------------------------------------------
// Merge: inventory items matching warehouse → warehouse
// ---------------------------------------------------------------------------

async function handleMerge(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { building_id } = payload as WarehouseMergePayload;
  const characterId = session.characterId!;

  const warehouseDefIds = await getWarehouseItemDefIds(characterId, building_id);
  const slotsRow = await getOrCreateWarehouseSlots(characterId, building_id);
  const capacity = getWarehouseCapacity(slotsRow);
  const invItems = await getInventoryWithDefinitions(characterId);
  let transferred = 0;
  let skipped = 0;

  for (const item of invItems) {
    if (!warehouseDefIds.has(item.item_def_id)) continue;

    const usedCount = await countWarehouseItems(characterId, building_id);
    const stackable = await findStackableWarehouseItem(characterId, building_id, item.item_def_id);
    if (stackable) {
      const stackSize = item.def_stack_size ?? 1;
      const canStack = Math.min(item.quantity, stackSize - stackable.quantity);
      if (canStack > 0) {
        await updateWarehouseItemQuantity(stackable.id, stackable.quantity + canStack);
        if (canStack >= item.quantity) {
          await deleteInventoryItem(item.id, characterId);
        } else {
          await updateInventoryQuantity(item.id, item.quantity - canStack);
        }
        transferred++;
        continue;
      }
    }

    if (usedCount >= capacity) {
      skipped++;
      continue;
    }

    await insertWarehouseItem(characterId, building_id, item.item_def_id, item.quantity, extractInstanceStats(item));
    await deleteInventoryItem(item.id, characterId);
    transferred++;
  }

  log('info', 'warehouse', 'merge', { character_id: characterId, building_id, transferred, skipped });
  await sendWarehouseState(session, characterId, building_id);
  await sendInventoryState(session);
  sendToSession(session, 'warehouse.bulk_result', { transferred_count: transferred, skipped_count: skipped, partial: skipped > 0 });
}

// ---------------------------------------------------------------------------
// Buy Slot
// ---------------------------------------------------------------------------

async function handleBuySlot(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { building_id } = payload as WarehouseBuySlotPayload;
  const characterId = session.characterId!;

  const slotsRow = await getOrCreateWarehouseSlots(characterId, building_id);
  const cost = computeSlotCost(slotsRow.extra_slots);

  // Check crowns
  const charRow = await query<{ crowns: number }>('SELECT crowns FROM characters WHERE id = $1', [characterId]);
  const crowns = charRow.rows[0]?.crowns ?? 0;
  if (crowns < cost) {
    sendToSession(session, 'warehouse.rejected', { reason: 'insufficient_crowns', message: `You need ${cost} crowns but only have ${crowns}.` });
    return;
  }

  // Deduct crowns
  await query('UPDATE characters SET crowns = crowns - $1 WHERE id = $2', [cost, characterId]);
  const updated = await incrementWarehouseSlots(characterId, building_id);
  const newCapacity = getWarehouseCapacity(updated);
  const newCrowns = crowns - cost;

  sendToSession(session, 'warehouse.buy_slot_result', {
    success: true,
    new_total_capacity: newCapacity,
    extra_slots_purchased: updated.extra_slots,
    next_slot_cost: computeSlotCost(updated.extra_slots),
    new_crowns: newCrowns,
  });

  log('info', 'warehouse', 'buy_slot', {
    character_id: characterId,
    building_id,
    cost,
    new_extra_slots: updated.extra_slots,
    new_capacity: newCapacity,
    remaining_crowns: newCrowns,
  });

  await sendWarehouseState(session, characterId, building_id);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export { sendWarehouseState };

export function registerWarehouseHandlers(): void {
  registerHandler('warehouse.deposit', handleDeposit);
  registerHandler('warehouse.withdraw', handleWithdraw);
  registerHandler('warehouse.bulk_to_inventory', handleBulkToInventory);
  registerHandler('warehouse.bulk_to_warehouse', handleBulkToWarehouse);
  registerHandler('warehouse.merge', handleMerge);
  registerHandler('warehouse.buy_slot', handleBuySlot);
}
