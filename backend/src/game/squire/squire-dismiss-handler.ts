/**
 * squire-dismiss-handler.ts
 *
 * Handles squire dismissal via NPC interaction.
 * Player talks to a dismisser NPC, selects an idle squire, confirms dismissal.
 */

import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { query } from '../../db/connection';
import {
  getIdleSquiresForCharacter,
  getCharacterSquireById,
  getActiveExpeditionForSquire,
  deleteSquire,
} from '../../db/queries/squires';
import { buildCharacterSquireDto, buildSquireRosterDto } from './squire-grant-service';
import type {
  SquireDismissListPayload,
  SquireDismissConfirmPayload,
  SquireDismissRejectedPayload,
} from '@elarion/protocol';

// ─── squire.dismiss_list ─────────────────────────────────────────────────────

export async function handleSquireDismissList(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) return;

  const { npc_id } = payload as SquireDismissListPayload;

  // Validate NPC is a squire dismisser
  const npcResult = await query<{ is_squire_dismisser: boolean }>(
    `SELECT is_squire_dismisser FROM npcs WHERE id = $1`,
    [npc_id],
  );
  if (!npcResult.rows[0]?.is_squire_dismisser) {
    const reject: SquireDismissRejectedPayload = { reason: 'NPC_NOT_DISMISSER' };
    sendToSession(session, 'squire.dismiss_rejected', reject);
    return;
  }

  const idleSquires = await getIdleSquiresForCharacter(characterId);
  const squireDtos = idleSquires.map((s) => buildCharacterSquireDto(s, false));

  sendToSession(session, 'squire.dismiss_list_result', { squires: squireDtos });
}

// ─── squire.dismiss_confirm ──────────────────────────────────────────────────

export async function handleSquireDismissConfirm(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) return;

  const { squire_id } = payload as SquireDismissConfirmPayload;

  // Validate squire exists and belongs to character
  const squire = await getCharacterSquireById(squire_id);
  if (!squire || squire.character_id !== characterId) {
    const reject: SquireDismissRejectedPayload = { reason: 'NOT_FOUND' };
    sendToSession(session, 'squire.dismiss_rejected', reject);
    return;
  }

  // Validate squire is not on expedition
  const expedition = await getActiveExpeditionForSquire(squire_id);
  if (expedition) {
    const reject: SquireDismissRejectedPayload = { reason: 'ON_EXPEDITION' };
    sendToSession(session, 'squire.dismiss_rejected', reject);
    return;
  }

  // Dismiss the squire
  const squireName = squire.name;
  await deleteSquire(squire_id);

  log('info', 'squire', 'squire_dismissed', {
    characterId,
    squireId: squire_id,
    squireName,
  });

  const roster = await buildSquireRosterDto(characterId);
  sendToSession(session, 'squire.dismissed', {
    squire_id,
    squire_name: squireName,
    updated_roster: roster,
  });
}
