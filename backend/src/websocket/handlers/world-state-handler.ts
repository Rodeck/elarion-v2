import { findByAccountId, findClassById } from '../../db/queries/characters';
import { getDto as getDayCycleDto } from '../../game/world/day-cycle-service';
import { sendInventoryState } from './inventory-state-handler';
import { getCharacterEffectiveStats } from '../../db/queries/inventory';
import { addPlayer } from '../../game/world/zone-registry';
import { broadcastPlayerEntered } from '../../game/world/zone-broadcasts';
import { onClientReconnect } from '../disconnect-handler';
import { log } from '../../logger';
import { config } from '../../config';
import { sendToSession } from '../server';
import type { AuthenticatedSession } from '../server';
import { getCityMapCache } from '../../game/world/city-map-loader';
import { getExpeditionStatesForBuilding } from '../../game/world/city-movement-handler';
import { getSpawnNodeForZone } from '../../db/queries/city-maps';
import { setCharacterInCombat } from '../../db/queries/loadouts';
import { CombatSessionManager } from '../../game/combat/combat-session-manager';
import { updateCharacter } from '../../db/queries/characters';
import { GatheringSessionManager } from '../../game/gathering/gathering-service';
import {
  getUnnotifiedCompletedExpeditions,
  markExpeditionNotified,
} from '../../db/queries/squires';
import { buildSquireRosterDto } from '../../game/squire/squire-grant-service';
import { query } from '../../db/connection';

let getZonePlayers: ((zoneId: number) => { characterId: string; name: string; classId: number; level: number; posX: number; posY: number; currentNodeId: number | null }[]) | null = null;

export function setZonePlayersGetter(fn: typeof getZonePlayers): void {
  getZonePlayers = fn;
}

export async function sendWorldState(session: AuthenticatedSession): Promise<void> {
  if (!session.accountId) return;

  const character = await findByAccountId(session.accountId);
  if (!character) {
    log('info', 'world-state', 'session_restore_no_character', { accountId: session.accountId });
    sendToSession(session, 'auth.session_info', { has_character: false });
    return;
  }

  // If the DB says in_combat but there is no live session (server restarted),
  // clear the flag so the player is not permanently locked.
  if (character.in_combat && !CombatSessionManager.has(character.id)) {
    await setCharacterInCombat(character.id, false).catch(() => undefined);
    character.in_combat = false;
    log('warn', 'world-state', 'stale_in_combat_cleared', { characterId: character.id });
  }

  // Same for in_gathering — clear stale flag if no live session exists.
  if (character.in_gathering && !GatheringSessionManager.has(character.id)) {
    await updateCharacter(character.id, { in_gathering: false }).catch(() => undefined);
    character.in_gathering = false;
    log('warn', 'world-state', 'stale_in_gathering_cleared', { characterId: character.id });
  }

  const cls = await findClassById(character.class_id);

  // Determine map type and resolve authoritative node position first,
  // so playerState registered in the zone has the correct currentNodeId.
  const cityCache = getCityMapCache(character.zone_id);
  const mapType = cityCache ? 'city' : 'tile';

  // For city maps: assign spawn node if player has no current_node_id
  let currentNodeId = character.current_node_id ?? null;
  if (cityCache && currentNodeId === null) {
    const spawnNode = await getSpawnNodeForZone(character.zone_id);
    if (spawnNode) {
      currentNodeId = spawnNode.id;
      await query('UPDATE characters SET current_node_id = $1 WHERE id = $2', [spawnNode.id, character.id]);
      log('info', 'world-state', 'spawn_node_assigned', {
        characterId: character.id,
        zone_id: character.zone_id,
        node_id: spawnNode.id,
      });
    }
  }

  // For city maps: if current_node_id references a deleted node, reset to spawn
  if (cityCache && currentNodeId !== null) {
    const nodeExists = cityCache.mapData.nodes.some((n) => n.id === currentNodeId);
    if (!nodeExists) {
      const spawnNode = await getSpawnNodeForZone(character.zone_id);
      if (spawnNode) {
        currentNodeId = spawnNode.id;
        await query('UPDATE characters SET current_node_id = $1 WHERE id = $2', [spawnNode.id, character.id]);
        log('warn', 'world-state', 'node_reset_to_spawn', {
          characterId: character.id,
          zone_id: character.zone_id,
          old_node_id: character.current_node_id,
          new_node_id: spawnNode.id,
        });
      }
    }
  }

  // Register the player in the zone registry and notify others in the zone
  const playerState = {
    characterId: character.id,
    name: character.name,
    classId: character.class_id,
    level: character.level,
    posX: character.pos_x,
    posY: character.pos_y,
    currentNodeId: currentNodeId,
    socket: session.socket,
  };
  addPlayer(character.zone_id, playerState);
  onClientReconnect(character.id); // cancel any pending disconnect grace timer
  broadcastPlayerEntered(character.zone_id, playerState);

  const players = getZonePlayers
    ? getZonePlayers(character.zone_id)
        .filter((p) => p.characterId !== character.id)
        .map((p) => ({
          id: p.characterId,
          name: p.name,
          class_id: p.classId,
          level: p.level,
          pos_x: p.posX,
          pos_y: p.posY,
          current_node_id: p.currentNodeId,
        }))
    : [];

  // Compute effective stats (base + equipped item bonuses)
  const effectiveStats = await getCharacterEffectiveStats(character.id);

  log('info', 'world-state', 'sent', {
    characterId: character.id,
    characterName: character.name,
    zone_id: character.zone_id,
    map_type: mapType,
    players_count: players.length,
    players_ids: players.map((p) => `${p.id}(${p.name})`),
    effective_attack: effectiveStats.effective_attack,
    effective_defence: effectiveStats.effective_defence,
  });

  const worldStatePayload: Record<string, unknown> = {
    zone_id: character.zone_id,
    zone_name: cls ? `Zone ${character.zone_id}` : 'Unknown Zone',
    map_type: mapType,
    my_character: {
      id: character.id,
      name: character.name,
      class_id: character.class_id,
      class_name: cls?.name ?? 'Unknown',
      level: character.level,
      experience: character.experience,
      max_hp: character.max_hp,
      current_hp: character.current_hp,
      attack_power: effectiveStats.effective_attack,
      defence: effectiveStats.effective_defence,
      zone_id: character.zone_id,
      pos_x: character.pos_x,
      pos_y: character.pos_y,
      current_node_id: currentNodeId,
      crowns: character.crowns,
    },
    players,
  };

  // Include city map data when applicable
  if (cityCache) {
    worldStatePayload.city_map = {
      image_url: cityCache.imageFilename ? `/images/${cityCache.imageFilename}` : null,
      image_width: cityCache.imageWidth,
      image_height: cityCache.imageHeight,
      nodes: cityCache.mapData.nodes,
      edges: cityCache.mapData.edges,
      buildings: cityCache.mapData.buildings,
      spawn_node_id: cityCache.mapData.spawn_node_id,
    };
  }

  worldStatePayload.day_night_state = getDayCycleDto();

  // Include UI icon URLs (XP, Crowns) from admin config
  const { getConfigValue: getAdminConfigValue } = await import('../../db/queries/admin-config');
  const xpIconFilename = await getAdminConfigValue('xp_icon_filename');
  const crownsIconFilename = await getAdminConfigValue('crowns_icon_filename');
  (worldStatePayload as Record<string, unknown>)['ui_icons'] = {
    xp_icon_url: xpIconFilename ? `${config.adminBaseUrl}/ui-icons/${xpIconFilename}` : null,
    crowns_icon_url: crownsIconFilename ? `${config.adminBaseUrl}/ui-icons/${crownsIconFilename}` : null,
  };

  sendToSession(session, 'world.state', worldStatePayload);

  // If the player is already at a building node, send city.building_arrived so the
  // building panel opens with full expedition state (same as arriving via movement).
  if (cityCache && currentNodeId !== null) {
    const building = cityCache.mapData.buildings.find((b) => b.node_id === currentNodeId);
    if (building) {
      const expedition_states = await getExpeditionStatesForBuilding(character.id, building).catch(() => []);
      sendToSession(session, 'city.building_arrived', {
        building_id: building.id,
        building_name: building.name,
        node_id: currentNodeId,
        ...(expedition_states.length > 0 ? { expedition_state: expedition_states[0] } : {}),
        expedition_states,
      });
    }
  }

  // Send inventory state immediately after world state
  await sendInventoryState(session);

  // Send squire roster on connect
  const squireRoster = await buildSquireRosterDto(character.id);
  sendToSession(session, 'squire.roster_update', squireRoster);

  // Notify player of any expeditions that completed while they were offline
  if (character.id) {
    const completed = await getUnnotifiedCompletedExpeditions(character.id);
    for (const row of completed) {
      sendToSession(session, 'expedition.completed', {
        expedition_id: row.id,
        squire_name: row.squire_name,
        building_name: row.building_name,
      });
      await markExpeditionNotified(row.id);
      log('info', 'expedition', 'expedition.notify_on_connect', {
        character_id: character.id,
        expedition_id: row.id,
        squire_name: row.squire_name,
        building_name: row.building_name,
      });
    }
  }
}
