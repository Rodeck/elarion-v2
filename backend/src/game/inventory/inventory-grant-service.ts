import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { config } from '../../config';
import {
  getItemDefinitionById,
  findStackableSlot,
  updateInventoryQuantity,
  getInventorySlotCount,
  insertInventoryItem,
  getInventoryWithDefinitions,
} from '../../db/queries/inventory';
import type { InventorySlotDto, ItemCategory, WeaponSubtype } from '../../../../shared/protocol/index';

const INVENTORY_CAPACITY = 20;

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

/**
 * Grant an item to a character, handling stacking logic and capacity checks.
 * Emits inventory.item_received or inventory.full to the session.
 */
export async function grantItemToCharacter(
  session: AuthenticatedSession,
  characterId: string,
  itemDefId: number,
  quantityToGrant: number,
): Promise<void> {
  const def = await getItemDefinitionById(itemDefId);
  if (!def) {
    log('warn', 'inventory', 'grant_item_def_not_found', { character_id: characterId, item_def_id: itemDefId });
    return;
  }

  const isStackable = def.stack_size != null;

  if (isStackable) {
    // Try to stack onto an existing slot
    const existingSlot = await findStackableSlot(characterId, itemDefId);
    if (existingSlot && existingSlot.quantity + quantityToGrant <= def.stack_size!) {
      // Stack fits — increment quantity
      const newQuantity = existingSlot.quantity + quantityToGrant;
      const updatedSlot = await updateInventoryQuantity(existingSlot.id, newQuantity);
      if (!updatedSlot) return;

      const slotDto: InventorySlotDto = {
        slot_id: updatedSlot.id,
        item_def_id: def.id,
        quantity: updatedSlot.quantity,
        definition: {
          id: def.id,
          name: def.name,
          description: def.description ?? '',
          category: def.category as ItemCategory,
          weapon_subtype: (def.weapon_subtype as WeaponSubtype) ?? null,
          attack: def.attack,
          defence: def.defence,
          heal_power: def.heal_power,
          food_power: def.food_power,
          stack_size: def.stack_size,
          icon_url: buildIconUrl(def.icon_filename),
        },
      };

      sendToSession(session, 'inventory.item_received', { slot: slotDto, stacked: true });
      log('info', 'inventory', 'inventory_item_received', {
        character_id: characterId,
        item_def_id: itemDefId,
        quantity: quantityToGrant,
        stacked: true,
      });
      return;
    }
  }

  // Need a new slot — check capacity
  const slotCount = await getInventorySlotCount(characterId);
  if (slotCount >= INVENTORY_CAPACITY) {
    sendToSession(session, 'inventory.full', { item_name: def.name });
    log('info', 'inventory', 'inventory_full', {
      character_id: characterId,
      item_def_id: itemDefId,
      item_name: def.name,
    });
    return;
  }

  // Insert new slot
  const newSlot = await insertInventoryItem(characterId, itemDefId, quantityToGrant);

  // Fetch with definition for the full DTO
  const allSlots = await getInventoryWithDefinitions(characterId);
  const newSlotWithDef = allSlots.find((s) => s.id === newSlot.id);
  if (!newSlotWithDef) return;

  const slotDto: InventorySlotDto = {
    slot_id: newSlotWithDef.id,
    item_def_id: newSlotWithDef.item_def_id,
    quantity: newSlotWithDef.quantity,
    definition: {
      id: newSlotWithDef.item_def_id,
      name: newSlotWithDef.def_name,
      description: newSlotWithDef.def_description ?? '',
      category: newSlotWithDef.def_category as ItemCategory,
      weapon_subtype: (newSlotWithDef.def_weapon_subtype as WeaponSubtype) ?? null,
      attack: newSlotWithDef.def_attack,
      defence: newSlotWithDef.def_defence,
      heal_power: newSlotWithDef.def_heal_power,
      food_power: newSlotWithDef.def_food_power,
      stack_size: newSlotWithDef.def_stack_size,
      icon_url: buildIconUrl(newSlotWithDef.def_icon_filename),
    },
  };

  sendToSession(session, 'inventory.item_received', { slot: slotDto, stacked: false });
  log('info', 'inventory', 'inventory_item_received', {
    character_id: characterId,
    item_def_id: itemDefId,
    quantity: quantityToGrant,
    stacked: false,
  });
}
