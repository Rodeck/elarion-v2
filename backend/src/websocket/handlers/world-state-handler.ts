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
import { getParticipant, addParticipant as addArenaParticipant } from '../../game/arena/arena-state-manager';
import { getArenaById, getParticipantByCharacterId, getParticipantsByArena, getArenaMonstersWithDetails } from '../../db/queries/arenas';
import type { ArenaParticipantDto, MonsterCombatDto } from '@elarion/protocol';

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

  // Ensure session has characterId set (may be null after reconnect with old JWT)
  if (!session.characterId) {
    session.characterId = character.id;
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

  // ── Arena restore on reconnect ─────────────────────────────────────
  const charArenaId = character.arena_id;
  if (charArenaId != null) {
    // Player was in an arena when they disconnected / server restarted.
    // Restore them to the arena lobby instead of placing them on the map.
    const arena = await getArenaById(charArenaId);
    const dbParticipant = await getParticipantByCharacterId(character.id);
    if (arena && dbParticipant) {
      // Re-attach socket in state manager
      const existing = getParticipant(character.id);
      if (existing) {
        existing.participant.socket = session.socket;
      } else {
        // State manager didn't have them (shouldn't happen, but handle gracefully)
        addArenaParticipant(charArenaId, {
          characterId: character.id,
          name: character.name,
          classId: character.class_id,
          level: character.level,
          currentHp: dbParticipant.current_hp,
          maxHp: character.max_hp,
          inCombat: false,
          fightingCharacterId: null,
          canLeaveAt: new Date(dbParticipant.can_leave_at),
          currentStreak: (dbParticipant as unknown as { current_streak: number }).current_streak ?? 0,
          arenaPvpWins: character.arena_pvp_wins ?? 0,
          socket: session.socket,
        });
      }

      onClientReconnect(character.id);

      // Build arena:entered payload and send to client
      const participants = await getParticipantsByArena(charArenaId);
      const participantDtos: ArenaParticipantDto[] = participants.map(p => ({
        character_id: p.character_id,
        name: p.name,
        class_id: p.class_id,
        level: p.level,
        in_combat: p.in_combat,
        entered_at: p.entered_at.toISOString(),
        current_streak: (p as unknown as { current_streak: number }).current_streak ?? 0,
        arena_pvp_wins: 0, // will be populated from state manager if available
      }));

      const monsters = await getArenaMonstersWithDetails(charArenaId);
      const monsterDtos: MonsterCombatDto[] = monsters.map(m => ({
        id: m.monster_id,
        name: m.name ?? 'Unknown',
        icon_url: m.icon_filename ? `${config.adminBaseUrl}/monster-icons/${m.icon_filename}` : null,
        max_hp: m.hp ?? 0,
        attack: m.attack ?? 0,
        defence: m.defense ?? 0,
      }));

      sendToSession(session, 'arena:entered', {
        arena: {
          id: arena.id,
          name: arena.name,
          building_id: arena.building_id,
          min_stay_seconds: arena.min_stay_seconds,
          reentry_cooldown_seconds: arena.reentry_cooldown_seconds,
          level_bracket: arena.level_bracket,
        },
        participants: participantDtos,
        monsters: monsterDtos,
        can_leave_at: dbParticipant.can_leave_at.toISOString(),
        current_hp: dbParticipant.current_hp,
        max_hp: character.max_hp,
      });

      log('info', 'world-state', 'arena_restored', {
        characterId: character.id,
        arenaId: charArenaId,
        currentHp: dbParticipant.current_hp,
      });

      // Fall through to send world.state normally (so stats bar, map, inventory
      // all initialize), but we'll skip zone registry add below. The arena:entered
      // message will overlay the arena panel on top of the canvas.
    } else {
      // Arena no longer exists — clear the stale arena_id
      await query('UPDATE characters SET arena_id = NULL WHERE id = $1', [character.id]);
      log('warn', 'world-state', 'stale_arena_id_cleared', { characterId: character.id, arenaId: charArenaId });
    }
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
  // (skip if player is inside an arena — they should not appear on the map)
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
  onClientReconnect(character.id); // cancel any pending disconnect grace timer
  if (character.arena_id == null) {
    addPlayer(character.zone_id, playerState);
    broadcastPlayerEntered(character.zone_id, playerState);
  }

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

  // Compute full combat stats for weapon attributes display
  const { computeCombatStats } = await import('../../game/combat/combat-stats-service');
  const combatStats = await computeCombatStats(character.id);

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
      rod_upgrade_points: character.rod_upgrade_points,
      attr_constitution: character.attr_constitution,
      attr_strength: character.attr_strength,
      attr_intelligence: character.attr_intelligence,
      attr_dexterity: character.attr_dexterity,
      attr_toughness: character.attr_toughness,
      stat_points_unspent: character.stat_points_unspent,
      armor_penetration: combatStats.armorPenetration,
      additional_attacks: combatStats.additionalAttacks,
      gear_crit_chance: Math.round(combatStats.critChance - character.attr_dexterity * 0.1),
      max_energy: character.max_energy,
      current_energy: character.current_energy,
      movement_speed: character.movement_speed,
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

  // Include boss data for the zone
  const { getBossesForZone } = await import('../../game/boss/boss-instance-manager');
  worldStatePayload.bosses = getBossesForZone(character.zone_id);

  // Include UI icon URLs (XP, Crowns) from admin config
  const { getConfigValue: getAdminConfigValue } = await import('../../db/queries/admin-config');
  const xpIconFilename = await getAdminConfigValue('xp_icon_filename');
  const crownsIconFilename = await getAdminConfigValue('crowns_icon_filename');
  const rodPtsIconFilename = await getAdminConfigValue('rod_upgrade_points_icon_filename');
  (worldStatePayload as Record<string, unknown>)['ui_icons'] = {
    xp_icon_url: xpIconFilename ? `${config.adminBaseUrl}/ui-icons/${xpIconFilename}` : null,
    crowns_icon_url: crownsIconFilename ? `${config.adminBaseUrl}/ui-icons/${crownsIconFilename}` : null,
    rod_upgrade_points_icon_url: rodPtsIconFilename ? `${config.adminBaseUrl}/ui-icons/${rodPtsIconFilename}` : null,
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

  // Reconcile collect_item quest progress against current inventory
  // (catches items granted while offline via admin commands, marketplace, etc.)
  try {
    const { QuestTracker } = await import('../../game/quest/quest-tracker');
    const questProgress = await QuestTracker.onInventoryChanged(character.id);
    for (const p of questProgress) {
      sendToSession(session, 'quest.progress', p);
    }
  } catch (qErr) {
    log('warn', 'world-state', 'login_quest_reconcile_error', { characterId: character.id, err: qErr });
  }

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
