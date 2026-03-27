import * as ws from 'ws';

export interface PlayerState {
  characterId: string;
  name: string;
  classId: number;
  level: number;
  posX: number;
  posY: number;
  currentNodeId: number | null;
  socket: ws.WebSocket;
}

// zoneId → (characterId → PlayerState)
const registry = new Map<number, Map<string, PlayerState>>();

function ensureZone(zoneId: number): Map<string, PlayerState> {
  if (!registry.has(zoneId)) registry.set(zoneId, new Map());
  return registry.get(zoneId)!;
}

export function addPlayer(zoneId: number, state: PlayerState): void {
  ensureZone(zoneId).set(state.characterId, state);
}

export function removePlayer(zoneId: number, characterId: string): void {
  registry.get(zoneId)?.delete(characterId);
}

export function getZonePlayers(zoneId: number): PlayerState[] {
  return Array.from(registry.get(zoneId)?.values() ?? []);
}

export function getPlayerState(characterId: string): { zoneId: number; state: PlayerState } | undefined {
  for (const [zoneId, players] of registry) {
    const state = players.get(characterId);
    if (state) return { zoneId, state };
  }
  return undefined;
}

export function getAllZonePlayerCounts(): Map<number, number> {
  const counts = new Map<number, number>();
  for (const [zoneId, players] of registry) {
    counts.set(zoneId, players.size);
  }
  return counts;
}

export function getTotalOnlinePlayers(): number {
  let total = 0;
  for (const players of registry.values()) {
    total += players.size;
  }
  return total;
}

export function movePlayer(characterId: string, x: number, y: number): void {
  for (const players of registry.values()) {
    const state = players.get(characterId);
    if (state) {
      state.posX = x;
      state.posY = y;
      return;
    }
  }
}

export function movePlayerToNode(characterId: string, nodeId: number, x: number, y: number): void {
  for (const players of registry.values()) {
    const state = players.get(characterId);
    if (state) {
      state.currentNodeId = nodeId;
      state.posX = x;
      state.posY = y;
      return;
    }
  }
}
