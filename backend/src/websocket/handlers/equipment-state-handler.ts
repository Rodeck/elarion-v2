import { sendToSession } from '../server';
import type { AuthenticatedSession } from '../server';
import { log } from '../../logger';
import { getEquipmentState } from '../../db/queries/equipment';

export async function sendEquipmentState(session: AuthenticatedSession): Promise<void> {
  if (!session.characterId) return;

  const slots = await getEquipmentState(session.characterId);

  sendToSession(session, 'equipment.state', { slots });

  log('info', 'equipment', 'equipment_state_sent', {
    character_id: session.characterId,
  });
}
