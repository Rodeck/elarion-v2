import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId, updateCharacter } from '../../db/queries/characters';
import { getInventorySlotById, updateInventoryQuantity, deleteInventoryItem } from '../../db/queries/inventory';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { log } from '../../logger';
import type { InventoryUseItemPayload, InventoryUseRejectedPayload } from '@elarion/protocol';

function reject(session: AuthenticatedSession, reason: InventoryUseRejectedPayload['reason'], message: string): void {
  sendToSession(session, 'inventory.use_rejected', { reason, message } satisfies InventoryUseRejectedPayload);
}

export async function handleInventoryUseItem(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { inventory_item_id } = payload as InventoryUseItemPayload;
  const characterId = session.characterId;
  if (!characterId) {
    reject(session, 'not_found', 'No character found.');
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    reject(session, 'not_found', 'Character not found.');
    return;
  }

  if (character.in_combat) {
    reject(session, 'in_combat', 'Cannot use items while in combat.');
    return;
  }

  const slotId = Number(inventory_item_id);
  const slot = await getInventorySlotById(slotId, characterId);
  if (!slot) {
    reject(session, 'not_found', 'Item not found in your inventory.');
    return;
  }

  const category = slot.def_category;

  if (category === 'food') {
    const foodPower = slot.def_food_power ?? 0;
    if (foodPower <= 0) {
      reject(session, 'not_consumable', 'This item has no energy value.');
      return;
    }
    if (character.current_energy >= character.max_energy) {
      reject(session, 'energy_full', 'Energy is already full.');
      return;
    }

    const newEnergy = Math.min(character.current_energy + foodPower, character.max_energy);
    await updateCharacter(characterId, { current_energy: newEnergy as number });

    // Decrement quantity
    const newQty = slot.quantity - 1;
    if (newQty <= 0) {
      await deleteInventoryItem(slotId, characterId);
    } else {
      await updateInventoryQuantity(slotId, newQty);
    }

    sendToSession(session, 'character.energy_changed', {
      current_energy: newEnergy,
      max_energy: character.max_energy,
    });
    sendToSession(session, 'inventory.use_result', {
      inventory_item_id: String(slotId),
      item_def_id: slot.item_def_id,
      remaining_quantity: Math.max(0, newQty),
      effect: 'energy',
      amount_restored: newEnergy - character.current_energy,
      new_value: newEnergy,
      max_value: character.max_energy,
    });

    await sendInventoryState(session);
    log('info', 'inventory', 'item_used', { characterId, slotId, category, foodPower, newEnergy });

  } else if (category === 'heal') {
    const healPower = slot.def_heal_power ?? 0;
    if (healPower <= 0) {
      reject(session, 'not_consumable', 'This item has no healing value.');
      return;
    }
    if (character.current_hp >= character.max_hp) {
      reject(session, 'hp_full', 'HP is already full.');
      return;
    }

    const newHp = Math.min(character.current_hp + healPower, character.max_hp);
    await updateCharacter(characterId, { current_hp: newHp as number });

    // Decrement quantity
    const newQty = slot.quantity - 1;
    if (newQty <= 0) {
      await deleteInventoryItem(slotId, characterId);
    } else {
      await updateInventoryQuantity(slotId, newQty);
    }

    sendToSession(session, 'character.hp_changed', {
      current_hp: newHp,
      max_hp: character.max_hp,
    });
    sendToSession(session, 'inventory.use_result', {
      inventory_item_id: String(slotId),
      item_def_id: slot.item_def_id,
      remaining_quantity: Math.max(0, newQty),
      effect: 'hp',
      amount_restored: newHp - character.current_hp,
      new_value: newHp,
      max_value: character.max_hp,
    });

    await sendInventoryState(session);
    log('info', 'inventory', 'item_used', { characterId, slotId, category, healPower, newHp });

  } else {
    reject(session, 'not_consumable', 'This item cannot be consumed.');
  }
}
