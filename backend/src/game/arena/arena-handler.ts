/**
 * arena-handler.ts
 *
 * Handles arena enter, leave, and kick operations.
 * Players enter an arena from a building action, fight monsters or other
 * players inside, and leave (or get kicked) when done.
 */

import { config } from '../../config';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import { registerHandler } from '../../websocket/dispatcher';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId } from '../../db/queries/characters';
import { getBuildingActions } from '../../db/queries/city-maps';
import {
  getArenaById,
  getArenaMonstersWithDetails,
  insertParticipant,
  deleteParticipant,
  setCharacterArenaId,
  setCharacterArenaCooldown,
  getCharacterArenaCooldown,
} from '../../db/queries/arenas';
import {
  addParticipant,
  removeParticipant,
  getParticipant,
  getArenaParticipants,
  broadcastToArena,
} from './arena-state-manager';
import { registerArenaCombatHandlers } from './arena-combat-handler';
import { removePlayer, addPlayer, getPlayerState } from '../world/zone-registry';
import { broadcastPlayerLeft, broadcastPlayerEntered } from '../world/zone-broadcasts';
import { sendWorldState } from '../../websocket/handlers/world-state-handler';
import type {
  ArenaEnteredPayload,
  ArenaEnterRejectedPayload,
  ArenaLeftPayload,
  ArenaLeaveRejectedPayload,
  ArenaKickedPayload,
  ArenaParticipantDto,
  MonsterCombatDto,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// arena:enter — player enters the arena
// ---------------------------------------------------------------------------

async function handleArenaEnter(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { action_id } = payload as { action_id: number };
  const characterId = session.characterId;

  if (!characterId) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'not_found',
      message: 'Character required.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'not_found',
      message: 'Character not found.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Gate: not in combat
  if (character.in_combat) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'in_combat',
      message: 'You cannot enter the arena while in combat.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Gate: not gathering
  if (character.in_gathering) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'in_gathering',
      message: 'You cannot enter the arena while gathering.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Gate: not already in an arena
  const existingParticipant = getParticipant(characterId);
  if (existingParticipant) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'already_in_arena',
      message: 'You are already in an arena.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Gate: cooldown
  const cooldownUntil = await getCharacterArenaCooldown(characterId);
  if (cooldownUntil && cooldownUntil > new Date()) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'cooldown',
      message: 'You must wait before entering an arena again.',
      cooldown_until: cooldownUntil.toISOString(),
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Look up the building action to get the arena_id from config
  const zoneId = character.zone_id;
  const currentNodeId = (character as unknown as { current_node_id: number | null }).current_node_id;

  // Find the action across all buildings the character might be at
  let arenaId: number | null = null;
  // We need building_id from the action. Query all actions matching action_id.
  const { query: dbQuery } = await import('../../db/connection');
  const actionRow = await dbQuery<{ config: Record<string, unknown>; action_type: string }>(
    'SELECT config, action_type FROM building_actions WHERE id = $1',
    [action_id],
  );
  const actionData = actionRow.rows[0];
  if (!actionData || actionData.action_type !== 'arena') {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'not_found',
      message: 'Arena action not found.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  const cfg = actionData.config;
  arenaId = Number(cfg['arena_id'] ?? 0);

  if (!arenaId) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'not_found',
      message: 'Arena not configured.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Get arena definition
  const arena = await getArenaById(arenaId);
  if (!arena) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'not_found',
      message: 'Arena not found.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  if (!arena.is_active) {
    sendToSession(session, 'arena:enter_rejected', {
      reason: 'inactive',
      message: 'This arena is currently closed.',
    } satisfies ArenaEnterRejectedPayload);
    return;
  }

  // Calculate can_leave_at
  const canLeaveAt = new Date(Date.now() + arena.min_stay_seconds * 1000);

  // Insert DB participant row
  await insertParticipant({
    arena_id: arenaId,
    character_id: characterId,
    current_hp: character.current_hp,
    can_leave_at: canLeaveAt,
  });

  // Set character's arena_id
  await setCharacterArenaId(characterId, arenaId);

  // Clear any leftover cooldown
  await setCharacterArenaCooldown(characterId, null);

  // Add to in-memory state
  addParticipant(arenaId, {
    characterId,
    name: character.name,
    classId: character.class_id,
    level: character.level,
    currentHp: character.current_hp,
    maxHp: character.max_hp,
    inCombat: false,
    fightingCharacterId: null,
    canLeaveAt,
    currentStreak: 0,
    arenaPvpWins: (character as unknown as { arena_pvp_wins: number }).arena_pvp_wins ?? 0,
    socket: session.socket,
  });

  // Remove from zone registry and broadcast departure
  removePlayer(zoneId, characterId);
  broadcastPlayerLeft(zoneId, characterId);

  // Get current arena state to send to the entering player
  const participants = getArenaParticipants(arenaId);
  const monsters = await getArenaMonstersWithDetails(arenaId);

  const participantDtos: ArenaParticipantDto[] = participants.map((p) => ({
    character_id: p.characterId,
    name: p.name,
    class_id: p.classId,
    level: p.level,
    in_combat: p.inCombat,
    entered_at: new Date().toISOString(),
    current_streak: p.currentStreak,
    arena_pvp_wins: p.arenaPvpWins,
  }));

  const monsterDtos: MonsterCombatDto[] = monsters.map((m) => ({
    id: m.monster_id,
    name: m.name ?? 'Unknown',
    icon_url: m.icon_filename ? `${config.adminBaseUrl}/monster-icons/${m.icon_filename}` : null,
    max_hp: m.hp ?? 0,
    attack: m.attack ?? 0,
    defence: m.defense ?? 0,
  }));

  const enteredPayload: ArenaEnteredPayload = {
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
    can_leave_at: canLeaveAt.toISOString(),
    current_hp: character.current_hp,
    max_hp: character.max_hp,
  };

  sendToSession(session, 'arena:entered', enteredPayload);

  // Broadcast to other participants that a new player entered
  const newParticipantDto: ArenaParticipantDto = {
    character_id: characterId,
    name: character.name,
    class_id: character.class_id,
    level: character.level,
    in_combat: false,
    entered_at: new Date().toISOString(),
    current_streak: 0,
    arena_pvp_wins: (character as unknown as { arena_pvp_wins: number }).arena_pvp_wins ?? 0,
  };
  broadcastToArena(arenaId, 'arena:player_entered', { participant: newParticipantDto }, characterId);

  log('info', 'arena', 'player_entered', {
    character_id: characterId,
    arena_id: arenaId,
    arena_name: arena.name,
    can_leave_at: canLeaveAt.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// arena:leave — player voluntarily leaves the arena
// ---------------------------------------------------------------------------

async function handleArenaLeave(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { arena_id } = payload as { arena_id: number };
  const characterId = session.characterId;

  if (!characterId) {
    sendToSession(session, 'arena:leave_rejected', {
      reason: 'in_combat',
      message: 'Character required.',
      can_leave_at: new Date().toISOString(),
    } satisfies ArenaLeaveRejectedPayload);
    return;
  }

  const found = getParticipant(characterId);
  if (!found || found.arenaId !== arena_id) {
    sendToSession(session, 'arena:leave_rejected', {
      reason: 'in_combat',
      message: 'You are not in this arena.',
      can_leave_at: new Date().toISOString(),
    } satisfies ArenaLeaveRejectedPayload);
    return;
  }

  const { participant } = found;

  // Gate: must not be in combat
  if (participant.inCombat) {
    sendToSession(session, 'arena:leave_rejected', {
      reason: 'in_combat',
      message: 'You cannot leave while in combat.',
      can_leave_at: participant.canLeaveAt.toISOString(),
    } satisfies ArenaLeaveRejectedPayload);
    return;
  }

  // Gate: minimum stay time
  if (participant.canLeaveAt > new Date()) {
    sendToSession(session, 'arena:leave_rejected', {
      reason: 'too_early',
      message: 'You must wait before you can leave the arena.',
      can_leave_at: participant.canLeaveAt.toISOString(),
    } satisfies ArenaLeaveRejectedPayload);
    return;
  }

  // Get arena config for cooldown
  const arena = await getArenaById(arena_id);
  const cooldownSeconds = arena?.reentry_cooldown_seconds ?? 1800;
  const cooldownUntil = new Date(Date.now() + cooldownSeconds * 1000);

  // Remove from DB
  await deleteParticipant(characterId);

  // Update character: clear arena, set cooldown, sync HP
  await setCharacterArenaId(characterId, null);
  await setCharacterArenaCooldown(characterId, cooldownUntil);

  // Sync HP from arena state back to character
  const { query: dbQuery } = await import('../../db/connection');
  await dbQuery(
    'UPDATE characters SET current_hp = $1 WHERE id = $2',
    [Math.max(0, participant.currentHp), characterId],
  );

  // Remove from in-memory state
  removeParticipant(arena_id, characterId);

  // Re-add to zone via sendWorldState (handles addPlayer + broadcastPlayerEntered)
  await sendWorldState(session);

  // Send confirmation to the leaving player
  const leftPayload: ArenaLeftPayload = {
    arena_id,
    cooldown_until: cooldownUntil.toISOString(),
  };
  sendToSession(session, 'arena:left', leftPayload);

  // Broadcast to remaining participants
  broadcastToArena(arena_id, 'arena:player_left', { character_id: characterId });

  log('info', 'arena', 'player_left', {
    character_id: characterId,
    arena_id,
    cooldown_until: cooldownUntil.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// kickFromArena — reusable for combat loss, admin kick, arena closure
// ---------------------------------------------------------------------------

export async function kickFromArena(
  characterId: string,
  reason: 'defeat' | 'admin' | 'arena_closed',
  applyCooldown: boolean,
): Promise<void> {
  const found = getParticipant(characterId);
  if (!found) {
    log('warn', 'arena', 'kick_no_participant', { character_id: characterId, reason });
    return;
  }

  const { arenaId, participant } = found;

  // Get arena config for cooldown
  const arena = await getArenaById(arenaId);
  const cooldownSeconds = arena?.reentry_cooldown_seconds ?? 1800;
  const cooldownUntil = applyCooldown
    ? new Date(Date.now() + cooldownSeconds * 1000)
    : new Date(); // no effective cooldown

  // Remove from DB
  await deleteParticipant(characterId);

  // Update character: clear arena, optionally set cooldown, sync HP
  await setCharacterArenaId(characterId, null);
  if (applyCooldown) {
    await setCharacterArenaCooldown(characterId, cooldownUntil);
  }

  // Sync HP from arena state back to character
  const { query: dbQuery } = await import('../../db/connection');
  await dbQuery(
    'UPDATE characters SET current_hp = $1 WHERE id = $2',
    [Math.max(0, participant.currentHp), characterId],
  );

  // Remove from in-memory state
  removeParticipant(arenaId, characterId);

  // Re-add to zone if the participant has a live socket
  if (participant.socket && participant.socket.readyState === 1) {
    // We need the session object to call sendWorldState.
    // Query the character directly for zone re-add
    const charRow = await dbQuery<{
      zone_id: number;
      pos_x: number;
      pos_y: number;
      current_node_id: number | null;
      name: string;
      class_id: number;
      level: number;
    }>(
      'SELECT zone_id, pos_x, pos_y, current_node_id, name, class_id, level FROM characters WHERE id = $1',
      [characterId],
    );

    const c = charRow.rows[0];
    if (c) {
      const playerState = {
        characterId,
        name: c.name,
        classId: c.class_id,
        level: c.level,
        posX: c.pos_x,
        posY: c.pos_y,
        currentNodeId: c.current_node_id,
        socket: participant.socket,
      };
      addPlayer(c.zone_id, playerState);
      broadcastPlayerEntered(c.zone_id, playerState);
    }
  }

  // Send kick notification to the player
  const reasonMessages: Record<string, string> = {
    defeat: 'You have been defeated and removed from the arena.',
    admin: 'You have been removed from the arena by an administrator.',
    arena_closed: 'The arena has been closed.',
  };

  const kickedPayload: ArenaKickedPayload = {
    reason,
    message: reasonMessages[reason] ?? 'You have been removed from the arena.',
    cooldown_until: cooldownUntil.toISOString(),
  };

  try {
    if (participant.socket && participant.socket.readyState === 1) {
      participant.socket.send(JSON.stringify({ type: 'arena:kicked', v: 1, payload: kickedPayload }));
    }
  } catch {
    // Socket may already be closed
  }

  // Broadcast to remaining participants
  broadcastToArena(arenaId, 'arena:player_left', { character_id: characterId });

  log('info', 'arena', 'player_kicked', {
    character_id: characterId,
    arena_id: arenaId,
    reason,
    apply_cooldown: applyCooldown,
    cooldown_until: cooldownUntil.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Arena deactivation — kick all participants without cooldown
// ---------------------------------------------------------------------------

export async function handleArenaDeactivation(arenaId: number): Promise<void> {
  const participants = getArenaParticipants(arenaId);
  if (participants.length === 0) {
    log('info', 'arena', 'deactivation_no_participants', { arena_id: arenaId });
    return;
  }

  log('info', 'arena', 'deactivation_start', {
    arena_id: arenaId,
    participant_count: participants.length,
  });

  for (const p of participants) {
    await kickFromArena(p.characterId, 'arena_closed', false);
  }

  log('info', 'arena', 'deactivation_complete', { arena_id: arenaId });
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

export function registerArenaHandlers(): void {
  registerHandler('arena:enter', handleArenaEnter);
  registerHandler('arena:leave', handleArenaLeave);
  registerArenaCombatHandlers();
  log('info', 'arena', 'handlers_registered', {});
}
