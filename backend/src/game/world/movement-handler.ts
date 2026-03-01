import { isPassable } from './zone-loader';
import { getPlayerState, movePlayer } from './zone-registry';
import { broadcastToZone } from './zone-broadcasts';
import { checkMoveRateLimit } from './movement-rate-limiter';
import { updateCharacter } from '../../db/queries/characters';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import type { PlayerMovePayload } from '@elarion/protocol';

type Direction = 'n' | 's' | 'e' | 'w';

const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  n: { dx: 0,  dy: -1 },
  s: { dx: 0,  dy: 1 },
  e: { dx: 1,  dy: 0 },
  w: { dx: -1, dy: 0 },
};

export async function handlePlayerMove(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { direction } = payload as PlayerMovePayload;

  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'You need a character to move.',
    });
    return;
  }

  const found = getPlayerState(session.characterId);
  if (!found) {
    log('warn', 'movement', 'player_not_in_registry', { characterId: session.characterId });
    return;
  }

  const { zoneId, state } = found;

  // In-combat check
  if (state.socket !== session.socket) {
    // Session mismatch — stale reference
    return;
  }

  // Rate limit
  const rateCheck = checkMoveRateLimit(session.characterId);
  if (!rateCheck.allowed) {
    sendToSession(session, 'player.move_rejected', {
      pos_x: state.posX,
      pos_y: state.posY,
      reason: 'RATE_LIMITED',
    });
    sendToSession(session, 'server.rate_limited', {
      action: 'player.move',
      retry_after_ms: rateCheck.retryAfterMs ?? 100,
    });
    return;
  }

  const delta = DIRECTION_DELTA[direction];
  if (!delta) {
    log('warn', 'movement', 'invalid_direction', { characterId: session.characterId, direction });
    return;
  }

  const targetX = state.posX + delta.dx;
  const targetY = state.posY + delta.dy;

  // Zone boundary check
  if (!isPassable(zoneId, targetX, targetY)) {
    const reason = targetX < 0 || targetY < 0 ? 'ZONE_BOUNDARY' : 'BLOCKED_TILE';
    sendToSession(session, 'player.move_rejected', {
      pos_x: state.posX,
      pos_y: state.posY,
      reason,
    });
    log('debug', 'movement', 'move_rejected', {
      characterId: session.characterId,
      from: { x: state.posX, y: state.posY },
      to: { x: targetX, y: targetY },
      reason,
    });
    return;
  }

  // Apply move
  movePlayer(session.characterId, targetX, targetY);

  // Persist async (fire-and-forget with error logging)
  updateCharacter(session.characterId, { pos_x: targetX, pos_y: targetY }).catch((err: unknown) => {
    log('error', 'movement', 'db_persist_failed', {
      characterId: session.characterId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Broadcast to all players in zone
  broadcastToZone(zoneId, 'player.moved', {
    character_id: session.characterId,
    pos_x: targetX,
    pos_y: targetY,
  });

  log('debug', 'movement', 'moved', {
    characterId: session.characterId,
    from: { x: state.posX, y: state.posY },
    to: { x: targetX, y: targetY },
  });
}
