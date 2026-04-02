import { getPlayerState, removePlayer } from '../game/world/zone-registry';
import { broadcastPlayerLeft } from '../game/world/zone-broadcasts';
import { clearRateWindow } from '../game/world/movement-rate-limiter';
import { setCharacterInCombat } from '../db/queries/loadouts';
import { CombatSessionManager } from '../game/combat/combat-session-manager';
import { handleArenaDisconnect, handleArenaNpcDisconnect, isInPvpCombat, isInNpcCombat } from '../game/arena/arena-combat-handler';
import { log } from '../logger';
import type { AuthenticatedSession } from './server';

const GRACE_PERIOD_MS = 5000;

// characterId → timer handle
const gracePendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function onClientDisconnect(session: AuthenticatedSession): void {
  if (!session.characterId) return;

  const { characterId } = session;
  log('info', 'disconnect', 'player_disconnected', { characterId, accountId: session.accountId });

  // Start grace period before removing from zone
  const timer = setTimeout(() => {
    gracePendingTimers.delete(characterId);
    const found = getPlayerState(characterId);
    if (found) {
      removePlayer(found.zoneId, characterId);
      broadcastPlayerLeft(found.zoneId, characterId);
      clearRateWindow(characterId);
      log('info', 'disconnect', 'player_removed_after_grace', { characterId });
    }
    // End any active combat session and clear the DB flag so the player
    // is not permanently locked when they reconnect.
    const combatSession = CombatSessionManager.get(characterId);
    if (combatSession) {
      combatSession.abort();
    } else if (isInPvpCombat(characterId)) {
      handleArenaDisconnect(characterId).catch((err) => {
        log('error', 'disconnect', 'arena_pvp_disconnect_error', { characterId, err });
      });
    } else if (isInNpcCombat(characterId)) {
      handleArenaNpcDisconnect(characterId).catch((err) => {
        log('error', 'disconnect', 'arena_npc_disconnect_error', { characterId, err });
      });
    } else {
      setCharacterInCombat(characterId, false).catch(() => undefined);
    }
  }, GRACE_PERIOD_MS);

  gracePendingTimers.set(characterId, timer);
}

export function onClientReconnect(characterId: string): void {
  const timer = gracePendingTimers.get(characterId);
  if (timer) {
    clearTimeout(timer);
    gracePendingTimers.delete(characterId);
    log('info', 'disconnect', 'reconnect_within_grace', { characterId });
  }
}
