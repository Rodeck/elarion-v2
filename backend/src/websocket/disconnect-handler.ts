import { getPlayerState, removePlayer } from '../game/world/zone-registry';
import { broadcastPlayerLeft } from '../game/world/zone-broadcasts';
import { clearRateWindow } from '../game/world/movement-rate-limiter';
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
