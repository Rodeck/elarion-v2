import { checkChatRateLimit } from './chat-rate-limiter';
import { insertChatMessage } from '../../db/queries/chat';
import { findByAccountId } from '../../db/queries/characters';
import { getZonePlayers } from '../world/zone-registry';
import { getSessions, sendToSocket } from '../../websocket/server';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import type { ChatSendPayload } from '@elarion/protocol';

export async function handleChatSend(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { channel, message } = payload as ChatSendPayload;

  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'You need a character to chat.',
    });
    return;
  }

  // Validate channel
  if (channel !== 'local' && channel !== 'global') {
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Invalid channel. Use "local" or "global".',
    });
    return;
  }

  // Validate message
  if (!message || message.length < 1 || message.length > 256) {
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Message must be 1–256 characters.',
    });
    return;
  }

  // Rate limit
  const rateCheck = checkChatRateLimit(session.characterId);
  if (!rateCheck.allowed) {
    sendToSession(session, 'server.rate_limited', {
      action: 'chat.send',
      retry_after_ms: rateCheck.retryAfterMs ?? 3000,
    });
    log('info', 'chat', 'rate_limited', { characterId: session.characterId, channel });
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) return;

  const timestamp = new Date().toISOString();
  const zoneId = channel === 'local' ? character.zone_id : null;

  // Persist
  await insertChatMessage(session.characterId, channel, zoneId, message);

  const outbound = {
    channel,
    sender_name: character.name,
    message,
    timestamp,
  };

  if (channel === 'local') {
    // Send to all players in the same zone
    const zonePlayers = getZonePlayers(character.zone_id);
    for (const player of zonePlayers) {
      sendToSocket(player.socket, 'chat.message', outbound);
    }
  } else {
    // Broadcast to all active connections
    for (const [socket] of getSessions()) {
      sendToSocket(socket, 'chat.message', outbound);
    }
  }

  log('info', 'chat', 'message_sent', {
    characterId: session.characterId,
    channel,
    length: message.length,
  });
}
