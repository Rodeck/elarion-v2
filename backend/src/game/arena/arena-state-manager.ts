import { log } from '../../logger';
import {
  getAllParticipants,
  updateParticipantCombatState,
  updateParticipantHp as dbUpdateParticipantHp,
  clearPreFightHp,
} from '../../db/queries/arenas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArenaParticipantState {
  characterId: string;
  name: string;
  classId: number;
  level: number;
  currentHp: number;
  maxHp: number;
  inCombat: boolean;
  fightingCharacterId: string | null;
  canLeaveAt: Date;
  currentStreak: number;
  arenaPvpWins: number;
  socket: any;
}

export interface ArenaState {
  arenaId: number;
  participants: Map<string, ArenaParticipantState>;
}

// ---------------------------------------------------------------------------
// In-memory store: arenaId -> ArenaState
// ---------------------------------------------------------------------------

export const arenaStates = new Map<number, ArenaState>();

// ---------------------------------------------------------------------------
// Participant management
// ---------------------------------------------------------------------------

export function addParticipant(arenaId: number, state: ArenaParticipantState): void {
  let arena = arenaStates.get(arenaId);
  if (!arena) {
    arena = { arenaId, participants: new Map() };
    arenaStates.set(arenaId, arena);
  }
  arena.participants.set(state.characterId, state);

  log('info', 'arena', 'participant_added', {
    arena_id: arenaId,
    character_id: state.characterId,
    name: state.name,
    participant_count: arena.participants.size,
  });
}

export function removeParticipant(arenaId: number, characterId: string): void {
  const arena = arenaStates.get(arenaId);
  if (!arena) return;

  arena.participants.delete(characterId);

  log('info', 'arena', 'participant_removed', {
    arena_id: arenaId,
    character_id: characterId,
    participant_count: arena.participants.size,
  });

  // Clean up empty arena state
  if (arena.participants.size === 0) {
    arenaStates.delete(arenaId);
  }
}

export function getParticipant(
  characterId: string,
): { arenaId: number; participant: ArenaParticipantState } | null {
  for (const [arenaId, arena] of arenaStates) {
    const participant = arena.participants.get(characterId);
    if (participant) {
      return { arenaId, participant };
    }
  }
  return null;
}

export function getArenaParticipants(arenaId: number): ArenaParticipantState[] {
  const arena = arenaStates.get(arenaId);
  if (!arena) return [];
  return Array.from(arena.participants.values());
}

export function getParticipantBySocket(
  socket: any,
): { arenaId: number; participant: ArenaParticipantState } | null {
  for (const [arenaId, arena] of arenaStates) {
    for (const participant of arena.participants.values()) {
      if (participant.socket === socket) {
        return { arenaId, participant };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Combat state updates
// ---------------------------------------------------------------------------

export function setInCombat(
  characterId: string,
  fighting: boolean,
  fightingCharacterId?: string,
): void {
  const found = getParticipant(characterId);
  if (!found) return;

  found.participant.inCombat = fighting;
  found.participant.fightingCharacterId = fighting ? (fightingCharacterId ?? null) : null;

  log('info', 'arena', 'combat_state_changed', {
    arena_id: found.arenaId,
    character_id: characterId,
    in_combat: fighting,
    fighting_character_id: fightingCharacterId ?? null,
  });
}

export function updateHp(characterId: string, hp: number): void {
  const found = getParticipant(characterId);
  if (!found) return;

  found.participant.currentHp = hp;
}

// ---------------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------------

export function broadcastToArena(
  arenaId: number,
  type: string,
  payload: unknown,
  excludeCharacterId?: string,
): void {
  const arena = arenaStates.get(arenaId);
  if (!arena) return;

  const message = JSON.stringify({ type, v: 1, payload });

  for (const participant of arena.participants.values()) {
    if (excludeCharacterId && participant.characterId === excludeCharacterId) continue;

    try {
      if (participant.socket && participant.socket.readyState === 1) {
        participant.socket.send(message);
      }
    } catch {
      // Socket send failed — participant may have disconnected
    }
  }
}

// ---------------------------------------------------------------------------
// Crash recovery — load from DB on server startup
// ---------------------------------------------------------------------------

export async function loadFromDb(): Promise<void> {
  const rows = await getAllParticipants();

  for (const row of rows) {
    // If participant was in_combat when server crashed, reset their state
    if (row.in_combat) {
      const restoredHp = row.pre_fight_hp ?? row.current_hp;

      await updateParticipantCombatState(row.character_id, false, null);
      await dbUpdateParticipantHp(row.character_id, restoredHp);
      await clearPreFightHp(row.character_id);

      log('info', 'arena', 'reset_combat_on_init', {
        arena_id: row.arena_id,
        character_id: row.character_id,
        restored_hp: restoredHp,
      });

      // Add to in-memory state with reset values
      addParticipant(row.arena_id, {
        characterId: row.character_id,
        name: row.name,
        classId: row.class_id,
        level: row.level,
        currentHp: restoredHp,
        maxHp: row.max_hp,
        inCombat: false,
        fightingCharacterId: null,
        canLeaveAt: new Date(row.can_leave_at),
        currentStreak: (row as unknown as { current_streak: number }).current_streak ?? 0,
        arenaPvpWins: row.arena_pvp_wins ?? 0,
        socket: null,
      });
    } else {
      // Normal participant — load as-is
      addParticipant(row.arena_id, {
        characterId: row.character_id,
        name: row.name,
        classId: row.class_id,
        level: row.level,
        currentHp: row.current_hp,
        maxHp: row.max_hp,
        inCombat: false,
        fightingCharacterId: null,
        canLeaveAt: new Date(row.can_leave_at),
        currentStreak: (row as unknown as { current_streak: number }).current_streak ?? 0,
        arenaPvpWins: row.arena_pvp_wins ?? 0,
        socket: null,
      });
    }
  }

  log('info', 'arena', 'initialized', {
    arena_count: arenaStates.size,
    participant_count: rows.length,
  });
}
