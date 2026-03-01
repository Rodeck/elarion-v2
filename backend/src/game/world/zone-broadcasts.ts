import * as ws from 'ws';
import { getZonePlayers } from './zone-registry';
import type { PlayerState } from './zone-registry';

function sendJson(socket: ws.WebSocket, type: string, payload: unknown): void {
  if (socket.readyState === ws.WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, v: 1, payload }));
  }
}

export function broadcastToZone(zoneId: number, type: string, payload: unknown, excludeCharacterId?: string): void {
  for (const player of getZonePlayers(zoneId)) {
    if (player.characterId === excludeCharacterId) continue;
    sendJson(player.socket, type, payload);
  }
}

export function broadcastPlayerEntered(zoneId: number, newPlayer: PlayerState): void {
  broadcastToZone(
    zoneId,
    'player.entered_zone',
    {
      character: {
        id: newPlayer.characterId,
        name: newPlayer.name,
        class_id: newPlayer.classId,
        level: newPlayer.level,
        pos_x: newPlayer.posX,
        pos_y: newPlayer.posY,
      },
    },
    newPlayer.characterId, // don't send to the entering player
  );
}

export function broadcastPlayerLeft(zoneId: number, characterId: string): void {
  broadcastToZone(zoneId, 'player.left_zone', { character_id: characterId }, characterId);
}
