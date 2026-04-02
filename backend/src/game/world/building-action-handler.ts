import { getCityMapCache } from './city-map-loader';
import { removePlayer } from './zone-registry';
import { broadcastPlayerLeft } from './zone-broadcasts';
import { sendWorldState } from '../../websocket/handlers/world-state-handler';
import { findByAccountId } from '../../db/queries/characters';
import { getBuildingActions, getBuildingById, getMapById } from '../../db/queries/city-maps';
import type { TravelActionConfig, ExploreActionConfig } from '../../db/queries/city-maps';
import { query } from '../../db/connection';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import type { CityBuildingActionPayload } from '@elarion/protocol';
import { resolveExplore } from '../combat/explore-combat-service';

export async function handleBuildingAction(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, action_id, action_type } = payload as CityBuildingActionPayload;

  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'You need a character to perform building actions.',
    });
    return;
  }

  const characterId = session.characterId;

  // Fetch authoritative character state
  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'server.error', { code: 'INTERNAL_ERROR', message: 'Character not found.' });
    return;
  }

  const zoneId = character.zone_id;
  const currentNodeId = (character as unknown as { current_node_id: number | null }).current_node_id;

  // Gate 1: Must be on a city-type map
  const cityCache = getCityMapCache(zoneId);
  if (!cityCache) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'NOT_CITY_MAP' });
    log('debug', 'building-action', 'rejected_not_city_map', { characterId, zoneId });
    return;
  }

  // Gate 2: Must not be in combat
  if (character.in_combat) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'IN_COMBAT' });
    log('debug', 'building-action', 'rejected_in_combat', { characterId });
    return;
  }

  // Gate 2b: Must not be gathering
  if (character.in_gathering) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'IN_GATHERING' });
    log('debug', 'building-action', 'rejected_in_gathering', { characterId });
    return;
  }

  // Gate 3: building must exist and player must be at its node
  const building = await getBuildingById(building_id);
  if (!building || building.zone_id !== zoneId || building.node_id !== currentNodeId) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'NOT_AT_BUILDING' });
    log('debug', 'building-action', 'rejected_not_at_building', {
      characterId,
      building_id,
      current_node_id: currentNodeId,
    });
    return;
  }

  // Gate 4: action must belong to the building with the right type
  const actions = await getBuildingActions(building_id);
  const action = actions.find((a) => a.id === action_id && a.action_type === action_type);
  if (!action) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'INVALID_ACTION' });
    log('debug', 'building-action', 'rejected_invalid_action', { characterId, building_id, action_id });
    return;
  }

  // Gate 5: building must not be blocked by a boss
  const { isBossBlocking } = await import('../boss/boss-instance-manager');
  if (isBossBlocking(building_id)) {
    sendToSession(session, 'city.building_action_rejected', {
      reason: 'BOSS_BLOCKING',
      message: 'A powerful guardian blocks this building. Defeat the boss to gain access.',
    });
    log('debug', 'building-action', 'rejected_boss_blocking', { characterId, building_id });
    return;
  }

  // ── Branch on action type ────────────────────────────────────────────────

  if (action.action_type === 'marketplace') {
    sendToSession(session, 'marketplace.open', {
      building_id,
      config: action.config,
    });
    log('debug', 'building-action', 'marketplace_opened', { characterId, building_id, action_id });
    return;
  }

  if (action.action_type === 'fishing') {
    // Fishing is initiated by the client sending fishing.cast after seeing the action
    // Just acknowledge the spot is available — the client triggers the cast separately
    sendToSession(session, 'fishing.spot_available', {
      building_id,
      action_id,
      config: action.config,
    });
    log('debug', 'building-action', 'fishing_spot_available', { characterId, building_id, action_id });
    return;
  }

  if (action.action_type === 'arena') {
    const cfg = action.config as Record<string, unknown>;
    sendToSession(session, 'arena.open', {
      building_id,
      action_id,
      arena_id: Number(cfg['arena_id'] ?? 0),
    });
    log('debug', 'building-action', 'arena_opened', { characterId, building_id, action_id });
    return;
  }

  if (action.action_type === 'explore') {
    const exploreConfig = action.config as ExploreActionConfig;

    try {
      const result = await resolveExplore(session, character, action_id, exploreConfig);
      sendToSession(session, 'building.explore_result', result);
    } catch (err) {
      log('error', 'building-action', 'explore_failed', { characterId, action_id, error: String(err) });
      sendToSession(session, 'city.building_action_rejected', { reason: 'EXPLORE_FAILED' });
    }
    return;
  }

  // ── Travel action ────────────────────────────────────────────────────────

  // Gate 5: destination must still exist
  const { target_zone_id, target_node_id } = action.config as TravelActionConfig;
  const targetZone = await getMapById(target_zone_id);
  if (!targetZone) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'INVALID_DESTINATION' });
    log('warn', 'building-action', 'rejected_invalid_destination_zone', {
      characterId,
      target_zone_id,
    });
    return;
  }
  const targetNodeExists = await query<{ id: number }>(
    'SELECT id FROM path_nodes WHERE id = $1 AND zone_id = $2',
    [target_node_id, target_zone_id],
  );
  if (targetNodeExists.rows.length === 0) {
    sendToSession(session, 'city.building_action_rejected', { reason: 'INVALID_DESTINATION' });
    log('warn', 'building-action', 'rejected_invalid_destination_node', {
      characterId,
      target_zone_id,
      target_node_id,
    });
    return;
  }

  // ── Execute travel ──────────────────────────────────────────────────────
  // Resolve destination coordinates
  const targetNodeRow = await query<{ x: number; y: number }>(
    'SELECT x, y FROM path_nodes WHERE id = $1',
    [target_node_id],
  );
  const targetCoords = targetNodeRow.rows[0] ?? { x: 0, y: 0 };

  // Remove from old zone
  removePlayer(zoneId, characterId);
  broadcastPlayerLeft(zoneId, characterId);

  // Update character in DB
  await query(
    `UPDATE characters
     SET zone_id = $1, current_node_id = $2, pos_x = $3, pos_y = $4, updated_at = now()
     WHERE id = $5`,
    [target_zone_id, target_node_id, targetCoords.x, targetCoords.y, characterId],
  );

  // Send world.state for new zone (handles addPlayer + broadcastPlayerEntered internally)
  await sendWorldState(session);

  log('info', 'building-action', 'player_travel', {
    character_id: characterId,
    from_zone_id: zoneId,
    to_zone_id: target_zone_id,
    building_id,
    action_id,
    timestamp: new Date().toISOString(),
  });
}
