import { findByAccountId, findClassById } from '../../db/queries/characters';
import { sendInventoryState } from './inventory-state-handler';
import { addPlayer } from '../../game/world/zone-registry';
import { broadcastPlayerEntered } from '../../game/world/zone-broadcasts';
import { onClientReconnect } from '../disconnect-handler';
import { log } from '../../logger';
import { sendToSession } from '../server';
import type { AuthenticatedSession } from '../server';
import { getCityMapCache } from '../../game/world/city-map-loader';
import { getSpawnNodeForZone } from '../../db/queries/city-maps';
import { query } from '../../db/connection';

let getZonePlayers: ((zoneId: number) => { characterId: string; name: string; classId: number; level: number; posX: number; posY: number }[]) | null = null;

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

  const cls = await findClassById(character.class_id);

  // Register the player in the zone registry and notify others in the zone
  const playerState = {
    characterId: character.id,
    name: character.name,
    classId: character.class_id,
    level: character.level,
    posX: character.pos_x,
    posY: character.pos_y,
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
        }))
    : [];

  // Determine map type and build city map data if applicable
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

  log('info', 'world-state', 'sent', {
    accountId: session.accountId,
    zone_id: character.zone_id,
    map_type: mapType,
    players: players.length,
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
      attack_power: character.attack_power,
      defence: character.defence,
      zone_id: character.zone_id,
      pos_x: character.pos_x,
      pos_y: character.pos_y,
      current_node_id: currentNodeId,
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

  sendToSession(session, 'world.state', worldStatePayload);

  // Send inventory state immediately after world state
  await sendInventoryState(session);
}
