/**
 * gathering-handler.ts
 *
 * WebSocket message handler for gathering.start and gathering.cancel.
 */

import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId } from '../../db/queries/characters';
import { getBuildingActions, getBuildingById } from '../../db/queries/city-maps';
import { getInventoryWithDefinitions } from '../../db/queries/inventory';
import { getCityMapCache } from '../world/city-map-loader';
import { GatheringSessionManager } from './gathering-service';
import type { GatheringStartPayload } from '../../../../shared/protocol/index';

interface GatherEventConfig {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing';
  weight: number;
  item_def_id?: number;
  quantity?: number;
  min_amount?: number;
  max_amount?: number;
  monster_id?: number;
  hp_damage?: number;
  message?: string;
}

interface GatherActionConfig {
  required_tool_type: string;
  durability_per_second: number;
  min_seconds: number;
  max_seconds: number;
  energy_per_second: number;
  events: GatherEventConfig[];
}

export async function handleGatheringStart(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, action_id, duration } = payload as GatheringStartPayload;

  if (!session.characterId) {
    sendToSession(session, 'gathering.rejected', { reason: 'NOT_AT_BUILDING', message: 'No character.' });
    return;
  }
  const characterId = session.characterId;

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'gathering.rejected', { reason: 'NOT_AT_BUILDING', message: 'Character not found.' });
    return;
  }

  // Gate: must be on a city map
  const cityCache = getCityMapCache(character.zone_id);
  if (!cityCache) {
    sendToSession(session, 'gathering.rejected', { reason: 'NOT_AT_BUILDING', message: 'Not on a city map.' });
    return;
  }

  // Gate: must be at the building
  const currentNodeId = (character as unknown as { current_node_id: number | null }).current_node_id;
  const building = await getBuildingById(building_id);
  if (!building || building.zone_id !== character.zone_id || building.node_id !== currentNodeId) {
    sendToSession(session, 'gathering.rejected', { reason: 'NOT_AT_BUILDING', message: 'You are not at this building.' });
    return;
  }

  // Gate: action must exist and be gather type
  const actions = await getBuildingActions(building_id);
  const action = actions.find((a) => a.id === action_id && a.action_type === 'gather');
  if (!action) {
    sendToSession(session, 'gathering.rejected', { reason: 'INVALID_ACTION', message: 'Invalid gather action.' });
    return;
  }

  const rawConfig = action.config as unknown as Record<string, unknown>;
  const gatherConfig: GatherActionConfig = {
    required_tool_type: String(rawConfig.required_tool_type ?? ''),
    durability_per_second: Number(rawConfig.durability_per_second ?? 0),
    min_seconds: Number(rawConfig.min_seconds ?? 0),
    max_seconds: Number(rawConfig.max_seconds ?? 0),
    energy_per_second: Number(rawConfig.energy_per_second ?? 0),
    events: (rawConfig.events ?? []) as GatherActionConfig['events'],
  };

  // Find all matching tools sorted by durability ascending (lowest first)
  const allSlots = await getInventoryWithDefinitions(characterId);
  const toolSlots = allSlots
    .filter((s) => s.def_category === 'tool' && s.def_tool_type === gatherConfig.required_tool_type && (s.current_durability ?? 0) > 0)
    .sort((a, b) => (a.current_durability ?? 0) - (b.current_durability ?? 0));

  if (toolSlots.length === 0) {
    sendToSession(session, 'gathering.rejected', {
      reason: 'NO_TOOL',
      message: `No ${gatherConfig.required_tool_type} in your inventory.`,
    });
    return;
  }

  // Gate: energy check
  if (character.current_energy <= 0) {
    sendToSession(session, 'gathering.rejected', {
      reason: 'insufficient_energy',
      message: 'Not enough energy.',
    });
    return;
  }

  const totalDurability = toolSlots.reduce((sum, s) => sum + (s.current_durability ?? 0), 0);
  const toolSlotIds = toolSlots.map((s) => s.id);

  log('info', 'gathering', 'gathering_start_request', {
    characterId,
    actionId: action_id,
    buildingId: building_id,
    duration,
    toolSlotIds,
    totalDurability,
  });

  // Delegate to the service (which does remaining validation)
  await GatheringSessionManager.start(
    session,
    character,
    building_id,
    action_id,
    gatherConfig,
    toolSlotIds,
    totalDurability,
    duration,
  );
}

export async function handleGatheringCancel(
  session: AuthenticatedSession,
  _payload: unknown,
): Promise<void> {
  if (!session.characterId) return;
  await GatheringSessionManager.cancel(session.characterId);
}
