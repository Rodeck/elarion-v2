/**
 * disassembly-handler.ts
 *
 * WebSocket message handlers for disassembly.open, disassembly.preview,
 * and disassembly.execute.
 */

import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { getNpcById } from '../../db/queries/npcs';
import { computePreview, executeDisassembly } from './disassembly-service';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import type {
  DisassemblyOpenPayload,
  DisassemblyPreviewPayload,
  DisassemblyExecutePayload,
  DisassemblyRejectionReason,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reject(
  session: AuthenticatedSession,
  action: 'open' | 'preview' | 'execute',
  reason: DisassemblyRejectionReason,
  details?: string,
): void {
  sendToSession(session, 'disassembly.rejected', { action, reason, details });
}

/**
 * Parse a rejection reason from an error message thrown by the service.
 * Service errors use the format "REASON_CODE:Human readable details."
 */
function parseServiceError(err: unknown): { reason: DisassemblyRejectionReason; details: string } {
  const message = err instanceof Error ? err.message : String(err);
  const colonIdx = message.indexOf(':');
  if (colonIdx > 0) {
    const code = message.substring(0, colonIdx);
    const knownReasons: DisassemblyRejectionReason[] = [
      'NO_CHARACTER', 'NPC_NOT_FOUND', 'NPC_NOT_DISASSEMBLER', 'NOT_AT_BUILDING',
      'IN_COMBAT', 'NO_KILN', 'INSUFFICIENT_KILN_DURABILITY', 'INSUFFICIENT_CROWNS',
      'INSUFFICIENT_INVENTORY_SPACE', 'ITEM_NOT_DISASSEMBLABLE', 'INVALID_ITEM', 'GRID_EMPTY',
    ];
    if (knownReasons.includes(code as DisassemblyRejectionReason)) {
      return { reason: code as DisassemblyRejectionReason, details: message.substring(colonIdx + 1) };
    }
  }
  return { reason: 'INVALID_ITEM', details: message };
}

// ---------------------------------------------------------------------------
// disassembly.open
// ---------------------------------------------------------------------------

async function handleDisassemblyOpen(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { npc_id } = payload as DisassemblyOpenPayload;
  const characterId = session.characterId;

  if (!characterId) {
    reject(session, 'open', 'NO_CHARACTER', 'No character.');
    return;
  }

  const npc = await getNpcById(npc_id);
  if (!npc) {
    reject(session, 'open', 'NPC_NOT_FOUND', 'NPC not found.');
    log('warn', 'disassembly', 'disassembly_rejected', { character_id: characterId, action: 'open', reason: 'NPC_NOT_FOUND' });
    return;
  }

  if (!npc.is_disassembler) {
    reject(session, 'open', 'NPC_NOT_DISASSEMBLER', 'This NPC does not offer disassembly.');
    log('warn', 'disassembly', 'disassembly_rejected', { character_id: characterId, action: 'open', reason: 'NPC_NOT_DISASSEMBLER' });
    return;
  }

  log('info', 'disassembly', 'disassembly_open', { character_id: characterId, npc_id });

  sendToSession(session, 'disassembly.state', { npc_id });
}

// ---------------------------------------------------------------------------
// disassembly.preview
// ---------------------------------------------------------------------------

async function handleDisassemblyPreview(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { npc_id, slot_ids, kiln_slot_id } = payload as DisassemblyPreviewPayload;
  const characterId = session.characterId;

  if (!characterId) {
    reject(session, 'preview', 'NO_CHARACTER', 'No character.');
    return;
  }

  if (!slot_ids || slot_ids.length === 0) {
    reject(session, 'preview', 'GRID_EMPTY', 'No items selected.');
    return;
  }

  try {
    const result = await computePreview(characterId, slot_ids, kiln_slot_id);
    sendToSession(session, 'disassembly.preview_result', result);
  } catch (err) {
    const { reason, details } = parseServiceError(err);
    reject(session, 'preview', reason, details);
    log('warn', 'disassembly', 'disassembly_rejected', { character_id: characterId, action: 'preview', reason });
  }
}

// ---------------------------------------------------------------------------
// disassembly.execute
// ---------------------------------------------------------------------------

async function handleDisassemblyExecute(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { npc_id, slot_ids, kiln_slot_id } = payload as DisassemblyExecutePayload;
  const characterId = session.characterId;

  if (!characterId) {
    reject(session, 'execute', 'NO_CHARACTER', 'No character.');
    return;
  }

  // Re-validate NPC
  const npc = await getNpcById(npc_id);
  if (!npc) {
    reject(session, 'execute', 'NPC_NOT_FOUND', 'NPC not found.');
    log('warn', 'disassembly', 'disassembly_rejected', { character_id: characterId, action: 'execute', reason: 'NPC_NOT_FOUND' });
    return;
  }

  if (!npc.is_disassembler) {
    reject(session, 'execute', 'NPC_NOT_DISASSEMBLER', 'This NPC does not offer disassembly.');
    log('warn', 'disassembly', 'disassembly_rejected', { character_id: characterId, action: 'execute', reason: 'NPC_NOT_DISASSEMBLER' });
    return;
  }

  if (!slot_ids || slot_ids.length === 0) {
    reject(session, 'execute', 'GRID_EMPTY', 'No items selected.');
    return;
  }

  try {
    const result = await executeDisassembly(characterId, slot_ids, kiln_slot_id);
    sendToSession(session, 'disassembly.result', result);
    // Refresh full inventory so client stays in sync
    await sendInventoryState(session);
  } catch (err) {
    const { reason, details } = parseServiceError(err);
    reject(session, 'execute', reason, details);
    log('warn', 'disassembly', 'disassembly_rejected', { character_id: characterId, action: 'execute', reason });
  }
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerDisassemblyHandlers(): void {
  registerHandler('disassembly.open', handleDisassemblyOpen);
  registerHandler('disassembly.preview', handleDisassemblyPreview);
  registerHandler('disassembly.execute', handleDisassemblyExecute);
  log('info', 'disassembly', 'handlers_registered', {});
}
