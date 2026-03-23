import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { deleteInventoryItem } from '../../db/queries/inventory';
import { findByAccountId } from '../../db/queries/characters';
import type { InventoryDeleteItemPayload } from '../../../../shared/protocol/index';

export async function handleInventoryDeleteItem(
  session: AuthenticatedSession,
  rawPayload: unknown,
): Promise<void> {
  const payload = rawPayload as InventoryDeleteItemPayload;
  // 1. Character must be authenticated
  if (!session.characterId) {
    return;
  }

  const characterId = session.characterId;

  // Gate: must not be gathering
  const char = await findByAccountId(session.accountId);
  if (char?.in_gathering) {
    sendToSession(session, 'inventory.delete_rejected', {
      slot_id: payload.slot_id,
      reason: 'NOT_FOUND' as 'NOT_FOUND',
    });
    return;
  }

  const slotId = payload.slot_id;

  // 2. Validate slot_id is a positive integer
  if (!Number.isInteger(slotId) || slotId <= 0) {
    sendToSession(session, 'inventory.delete_rejected', {
      slot_id: slotId,
      reason: 'NOT_FOUND',
    });
    log('warn', 'inventory', 'inventory_delete_rejected', {
      character_id: characterId,
      slot_id: slotId,
      reason: 'invalid_slot_id',
    });
    return;
  }

  // 3. Delete — returns false if not found or not owned by this character
  const deleted = await deleteInventoryItem(slotId, characterId);

  if (!deleted) {
    sendToSession(session, 'inventory.delete_rejected', {
      slot_id: slotId,
      reason: 'NOT_FOUND',
    });
    log('warn', 'inventory', 'inventory_delete_rejected', {
      character_id: characterId,
      slot_id: slotId,
      reason: 'not_found_or_not_owner',
    });
    return;
  }

  // 4. Success
  sendToSession(session, 'inventory.item_deleted', { slot_id: slotId });
  log('info', 'inventory', 'inventory_item_deleted', {
    character_id: characterId,
    slot_id: slotId,
  });
}
