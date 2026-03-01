import { query } from '../connection';

export interface ChatMessage {
  id: string;
  sender_character_id: string;
  channel: 'local' | 'global';
  zone_id: number | null;
  message: string;
  sent_at: Date;
}

export async function insertChatMessage(
  senderId: string,
  channel: 'local' | 'global',
  zoneId: number | null,
  message: string,
): Promise<ChatMessage> {
  const result = await query<ChatMessage>(
    `INSERT INTO chat_messages (sender_character_id, channel, zone_id, message)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [senderId, channel, zoneId, message],
  );
  return result.rows[0];
}

export async function getRecentZoneMessages(zoneId: number, limit = 50): Promise<(ChatMessage & { sender_name: string })[]> {
  const result = await query<ChatMessage & { sender_name: string }>(
    `SELECT cm.*, c.name AS sender_name
     FROM chat_messages cm
     JOIN characters c ON c.id = cm.sender_character_id
     WHERE cm.zone_id = $1
     ORDER BY cm.sent_at DESC
     LIMIT $2`,
    [zoneId, limit],
  );
  return result.rows.reverse();
}
