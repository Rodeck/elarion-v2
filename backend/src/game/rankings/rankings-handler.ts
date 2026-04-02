import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { getSnapshot, getPlayerRanks } from './rankings-service';

export async function handleRankingsGet(session: AuthenticatedSession, _payload: unknown): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) {
    sendToSession(session, 'server.error', { code: 'INVALID_REQUEST', message: 'No active character.' });
    return;
  }

  const snap = getSnapshot();

  if (!snap) {
    // Rankings not yet computed — return empty snapshot
    log('debug', 'rankings', 'snapshot_not_ready', { characterId });
    sendToSession(session, 'rankings.data', {
      updated_at: new Date().toISOString(),
      total_players: 0,
      top_level: [],
      top_fighters: [],
      top_crafters: [],
      top_questers: [],
      top_arena: [],
      map_population: [],
      my_ranks: {
        level: { rank: 0, value: 0 },
        fighters: { rank: 0, value: 0 },
        crafters: { rank: 0, value: 0 },
        questers: { rank: 0, value: 0 },
        arena: { rank: 0, value: 0 },
      },
    });
    return;
  }

  const myRanks = await getPlayerRanks(characterId);

  sendToSession(session, 'rankings.data', {
    updated_at: snap.updated_at,
    total_players: snap.total_players,
    top_level: snap.top_level,
    top_fighters: snap.top_fighters,
    top_crafters: snap.top_crafters,
    top_questers: snap.top_questers,
    top_arena: snap.top_arena,
    map_population: snap.map_population,
    my_ranks: myRanks,
  });
}
