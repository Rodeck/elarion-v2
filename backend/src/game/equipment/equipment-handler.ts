import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { equipItem, unequipItem, getEquipmentState } from '../../db/queries/equipment';
import { getCharacterEffectiveStats } from '../../db/queries/inventory';
import { findByAccountId } from '../../db/queries/characters';
import type {
  EquipmentEquipPayload,
  EquipmentUnequipPayload,
  EquipSlot,
} from '../../../../shared/protocol/index';

const VALID_SLOTS: EquipSlot[] = ['helmet', 'chestplate', 'left_arm', 'right_arm', 'greaves', 'bracer', 'boots'];

function isValidSlot(value: unknown): value is EquipSlot {
  return typeof value === 'string' && VALID_SLOTS.includes(value as EquipSlot);
}

export async function handleEquipmentEquip(
  session: AuthenticatedSession,
  rawPayload: unknown,
): Promise<void> {
  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'A character is required to equip items.',
    });
    return;
  }

  const characterId = session.characterId;

  // Gate: must not be gathering
  const char = await findByAccountId(session.accountId);
  if (char?.in_gathering) {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: 0,
      slot_name: 'weapon' as EquipSlot,
      reason: 'IN_GATHERING' as 'ITEM_NOT_FOUND',
    });
    return;
  }

  const payload = rawPayload as EquipmentEquipPayload;
  const slotId = payload.slot_id;
  const slotName = payload.slot_name;

  // Validate slot_id is a positive integer
  if (!Number.isInteger(slotId) || slotId <= 0) {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: slotId,
      slot_name: slotName,
      reason: 'ITEM_NOT_FOUND',
    });
    log('warn', 'equipment', 'equip_rejected', {
      character_id: characterId,
      slot_id: slotId,
      slot_name: slotName,
      reason: 'invalid_slot_id',
    });
    return;
  }

  // Validate slot_name
  if (!isValidSlot(slotName)) {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: slotId,
      slot_name: slotName,
      reason: 'WRONG_SLOT_TYPE',
    });
    log('warn', 'equipment', 'equip_rejected', {
      character_id: characterId,
      slot_id: slotId,
      slot_name: slotName,
      reason: 'invalid_slot_name',
    });
    return;
  }

  // Perform the equip transaction
  const result = await equipItem(characterId, slotId, slotName);

  if (result === 'ITEM_NOT_FOUND') {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: slotId,
      slot_name: slotName,
      reason: 'ITEM_NOT_FOUND',
    });
    log('warn', 'equipment', 'equip_rejected', {
      character_id: characterId,
      slot_id: slotId,
      slot_name: slotName,
      reason: 'ITEM_NOT_FOUND',
    });
    return;
  }

  if (result === 'WRONG_SLOT_TYPE') {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: slotId,
      slot_name: slotName,
      reason: 'WRONG_SLOT_TYPE',
    });
    log('warn', 'equipment', 'equip_rejected', {
      character_id: characterId,
      slot_id: slotId,
      slot_name: slotName,
      reason: 'WRONG_SLOT_TYPE',
    });
    return;
  }

  if (result === 'TWO_HANDED_BLOCKS') {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: slotId,
      slot_name: slotName,
      reason: 'TWO_HANDED_BLOCKS',
    });
    log('warn', 'equipment', 'equip_rejected', {
      character_id: characterId,
      slot_id: slotId,
      slot_name: slotName,
      reason: 'TWO_HANDED_BLOCKS',
    });
    return;
  }

  if (result === 'INVENTORY_FULL') {
    sendToSession(session, 'equipment.equip_rejected', {
      slot_id: slotId,
      slot_name: slotName,
      reason: 'INVENTORY_FULL',
    });
    log('warn', 'equipment', 'equip_rejected', {
      character_id: characterId,
      slot_id: slotId,
      slot_name: slotName,
      reason: 'INVENTORY_FULL',
    });
    return;
  }

  // Success — fetch updated state
  const [slots, effectiveStats] = await Promise.all([
    getEquipmentState(characterId),
    getCharacterEffectiveStats(characterId),
  ]);

  sendToSession(session, 'equipment.changed', {
    slots,
    effective_attack:  effectiveStats.effective_attack,
    effective_defence: effectiveStats.effective_defence,
    inventory_added:   result.inventory_added,
    inventory_removed: result.inventory_removed,
  });

  log('info', 'equipment', 'item_equipped', {
    character_id: characterId,
    slot_id: slotId,
    slot_name: slotName,
    inventory_added_count:   result.inventory_added.length,
    inventory_removed_count: result.inventory_removed.length,
    effective_attack:  effectiveStats.effective_attack,
    effective_defence: effectiveStats.effective_defence,
  });
}

export async function handleEquipmentUnequip(
  session: AuthenticatedSession,
  rawPayload: unknown,
): Promise<void> {
  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'A character is required to unequip items.',
    });
    return;
  }

  const characterId = session.characterId;

  // Gate: must not be gathering
  const charUneq = await findByAccountId(session.accountId);
  if (charUneq?.in_gathering) {
    sendToSession(session, 'equipment.unequip_rejected', {
      slot_name: 'weapon' as EquipSlot,
      reason: 'IN_GATHERING' as 'SLOT_EMPTY',
    });
    return;
  }

  const payload = rawPayload as EquipmentUnequipPayload;
  const slotName = payload.slot_name;

  // Validate slot_name
  if (!isValidSlot(slotName)) {
    sendToSession(session, 'equipment.unequip_rejected', {
      slot_name: slotName,
      reason: 'SLOT_EMPTY',
    });
    log('warn', 'equipment', 'unequip_rejected', {
      character_id: characterId,
      slot_name: slotName,
      reason: 'invalid_slot_name',
    });
    return;
  }

  // Perform the unequip transaction
  const result = await unequipItem(characterId, slotName);

  if (result === 'SLOT_EMPTY') {
    sendToSession(session, 'equipment.unequip_rejected', {
      slot_name: slotName,
      reason: 'SLOT_EMPTY',
    });
    log('warn', 'equipment', 'unequip_rejected', {
      character_id: characterId,
      slot_name: slotName,
      reason: 'SLOT_EMPTY',
    });
    return;
  }

  if (result === 'INVENTORY_FULL') {
    sendToSession(session, 'equipment.unequip_rejected', {
      slot_name: slotName,
      reason: 'INVENTORY_FULL',
    });
    log('warn', 'equipment', 'unequip_rejected', {
      character_id: characterId,
      slot_name: slotName,
      reason: 'INVENTORY_FULL',
    });
    return;
  }

  // Success — fetch updated state
  const [slots, effectiveStats] = await Promise.all([
    getEquipmentState(characterId),
    getCharacterEffectiveStats(characterId),
  ]);

  sendToSession(session, 'equipment.changed', {
    slots,
    effective_attack:  effectiveStats.effective_attack,
    effective_defence: effectiveStats.effective_defence,
    inventory_added:   [result],
    inventory_removed: [],
  });

  log('info', 'equipment', 'item_unequipped', {
    character_id: characterId,
    slot_name: slotName,
    slot_id: result.slot_id,
    effective_attack:  effectiveStats.effective_attack,
    effective_defence: effectiveStats.effective_defence,
  });
}
