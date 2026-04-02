import { query } from '../../db/connection';
import { log } from '../../logger';
import { getAllZonePlayerCounts, getTotalOnlinePlayers } from '../world/zone-registry';
import type { LeaderboardEntryDto, MapPopulationDto } from '@elarion/protocol';

// ---------------------------------------------------------------------------
// In-memory ranking snapshot
// ---------------------------------------------------------------------------

interface RankingSnapshot {
  updated_at: string;
  total_players: number;
  top_level: LeaderboardEntryDto[];
  top_fighters: LeaderboardEntryDto[];
  top_crafters: LeaderboardEntryDto[];
  top_questers: LeaderboardEntryDto[];
  top_arena: LeaderboardEntryDto[];
  map_population: MapPopulationDto[];
}

let snapshot: RankingSnapshot | null = null;

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Snapshot access
// ---------------------------------------------------------------------------

export function getSnapshot(): RankingSnapshot | null {
  return snapshot;
}

// ---------------------------------------------------------------------------
// Player rank computation (per-request)
// ---------------------------------------------------------------------------

export async function getPlayerRanks(characterId: string): Promise<{
  level: { rank: number; value: number };
  fighters: { rank: number; value: number };
  crafters: { rank: number; value: number };
  questers: { rank: number; value: number };
  arena: { rank: number; value: number };
}> {
  const [levelRes, fightersRes, craftersRes, questersRes, arenaRes] = await Promise.all([
    query<{ rank: string; value: number }>(
      `SELECT
         (SELECT COUNT(*) + 1 FROM characters c2
          WHERE c2.level > c.level OR (c2.level = c.level AND c2.experience > c.experience)) AS rank,
         c.level AS value
       FROM characters c WHERE c.id = $1`,
      [characterId]
    ),
    query<{ rank: string; value: number }>(
      `SELECT
         (SELECT COUNT(*) + 1 FROM characters c2 WHERE c2.combat_wins > c.combat_wins) AS rank,
         c.combat_wins AS value
       FROM characters c WHERE c.id = $1`,
      [characterId]
    ),
    query<{ rank: string; value: number }>(
      `WITH player_crafts AS (
         SELECT COUNT(*) AS cnt FROM crafting_sessions
         WHERE character_id = $1 AND status IN ('completed', 'collected')
       ),
       all_crafts AS (
         SELECT character_id, COUNT(*) AS cnt FROM crafting_sessions
         WHERE status IN ('completed', 'collected') GROUP BY character_id
       )
       SELECT
         (SELECT COUNT(*) + 1 FROM all_crafts WHERE cnt > (SELECT cnt FROM player_crafts)) AS rank,
         (SELECT cnt FROM player_crafts) AS value`,
      [characterId]
    ),
    query<{ rank: string; value: number }>(
      `WITH player_quests AS (
         SELECT COUNT(*) AS cnt FROM character_quests
         WHERE character_id = $1 AND status = 'completed'
       ),
       all_quests AS (
         SELECT character_id, COUNT(*) AS cnt FROM character_quests
         WHERE status = 'completed' GROUP BY character_id
       )
       SELECT
         (SELECT COUNT(*) + 1 FROM all_quests WHERE cnt > (SELECT cnt FROM player_quests)) AS rank,
         (SELECT cnt FROM player_quests) AS value`,
      [characterId]
    ),
    query<{ rank: string; value: number }>(
      `SELECT
         (SELECT COUNT(*) + 1 FROM characters c2 WHERE c2.arena_pvp_wins > c.arena_pvp_wins) AS rank,
         c.arena_pvp_wins AS value
       FROM characters c WHERE c.id = $1`,
      [characterId]
    ),
  ]);

  return {
    level:    { rank: Number(levelRes.rows[0]?.rank ?? 1),    value: Number(levelRes.rows[0]?.value ?? 0) },
    fighters: { rank: Number(fightersRes.rows[0]?.rank ?? 1), value: Number(fightersRes.rows[0]?.value ?? 0) },
    crafters: { rank: Number(craftersRes.rows[0]?.rank ?? 1), value: Number(craftersRes.rows[0]?.value ?? 0) },
    questers: { rank: Number(questersRes.rows[0]?.rank ?? 1), value: Number(questersRes.rows[0]?.value ?? 0) },
    arena:    { rank: Number(arenaRes.rows[0]?.rank ?? 1),    value: Number(arenaRes.rows[0]?.value ?? 0) },
  };
}

// ---------------------------------------------------------------------------
// Periodic computation
// ---------------------------------------------------------------------------

async function computeSnapshot(): Promise<void> {
  const start = Date.now();
  try {
    const [levelRes, fightersRes, craftersRes, questersRes, arenaRes, zoneNamesRes] = await Promise.all([
      // Top Level
      query<{ id: string; name: string; class_id: number; class_name: string; value: number }>(
        `SELECT c.id, c.name, c.class_id, cc.name AS class_name, c.level AS value
         FROM characters c
         JOIN character_classes cc ON cc.id = c.class_id
         ORDER BY c.level DESC, c.experience DESC, c.name ASC
         LIMIT 20`
      ),
      // Top Fighters
      query<{ id: string; name: string; class_id: number; class_name: string; value: number }>(
        `SELECT c.id, c.name, c.class_id, cc.name AS class_name, c.combat_wins AS value
         FROM characters c
         JOIN character_classes cc ON cc.id = c.class_id
         ORDER BY c.combat_wins DESC, c.name ASC
         LIMIT 20`
      ),
      // Top Crafters
      query<{ id: string; name: string; class_id: number; class_name: string; value: string }>(
        `SELECT c.id, c.name, c.class_id, cc.name AS class_name, COUNT(cs.id)::text AS value
         FROM characters c
         JOIN character_classes cc ON cc.id = c.class_id
         LEFT JOIN crafting_sessions cs ON cs.character_id = c.id AND cs.status IN ('completed', 'collected')
         GROUP BY c.id, c.name, c.class_id, cc.name
         HAVING COUNT(cs.id) > 0
         ORDER BY COUNT(cs.id) DESC, c.name ASC
         LIMIT 20`
      ),
      // Top Questers
      query<{ id: string; name: string; class_id: number; class_name: string; value: string }>(
        `SELECT c.id, c.name, c.class_id, cc.name AS class_name, COUNT(cq.id)::text AS value
         FROM characters c
         JOIN character_classes cc ON cc.id = c.class_id
         LEFT JOIN character_quests cq ON cq.character_id = c.id AND cq.status = 'completed'
         GROUP BY c.id, c.name, c.class_id, cc.name
         HAVING COUNT(cq.id) > 0
         ORDER BY COUNT(cq.id) DESC, c.name ASC
         LIMIT 20`
      ),
      // Top Arena PvP
      query<{ id: string; name: string; class_id: number; class_name: string; value: number }>(
        `SELECT c.id, c.name, c.class_id, cc.name AS class_name, c.arena_pvp_wins AS value
         FROM characters c
         JOIN character_classes cc ON cc.id = c.class_id
         WHERE c.arena_pvp_wins > 0
         ORDER BY c.arena_pvp_wins DESC, c.name ASC
         LIMIT 20`
      ),
      // Map zone names (for labeling online player counts)
      query<{ id: number; name: string }>('SELECT id, name FROM map_zones ORDER BY name ASC'),
    ]);

    // Map population from in-memory zone registry (online players only)
    const zoneCounts = getAllZonePlayerCounts();
    const totalOnline = getTotalOnlinePlayers();

    const toEntry = (row: { id: string; name: string; class_id: number; class_name: string; value: number | string }, idx: number): LeaderboardEntryDto => ({
      rank: idx + 1,
      character_id: row.id,
      character_name: row.name,
      class_id: row.class_id,
      class_name: row.class_name,
      value: Number(row.value),
    });

    // Build map population from zone names + online player counts
    const zoneNameMap = new Map(zoneNamesRes.rows.map((r) => [r.id, r.name]));
    const mapPopulation: MapPopulationDto[] = [];
    for (const [zoneId, name] of zoneNameMap) {
      mapPopulation.push({
        zone_id: zoneId,
        zone_name: name,
        player_count: zoneCounts.get(zoneId) ?? 0,
      });
    }
    mapPopulation.sort((a, b) => b.player_count - a.player_count || a.zone_name.localeCompare(b.zone_name));

    snapshot = {
      updated_at: new Date().toISOString(),
      total_players: totalOnline,
      top_level: levelRes.rows.map(toEntry),
      top_fighters: fightersRes.rows.map(toEntry),
      top_crafters: craftersRes.rows.map(toEntry),
      top_questers: questersRes.rows.map(toEntry),
      top_arena: arenaRes.rows.map(toEntry),
      map_population: mapPopulation,
    };

    const elapsed = Date.now() - start;
    log('info', 'rankings', 'snapshot_computed', { elapsed_ms: elapsed, total_players: snapshot.total_players });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'rankings', 'snapshot_compute_failed', { error: message, elapsed_ms: Date.now() - start });
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function startRankingsService(): void {
  // Compute immediately on startup, then every 5 minutes
  void computeSnapshot();
  setInterval(() => void computeSnapshot(), REFRESH_INTERVAL_MS);
  log('info', 'rankings', 'service_started', { interval_ms: REFRESH_INTERVAL_MS });
}
