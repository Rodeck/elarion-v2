# Research: Character Rankings

**Feature**: 026-character-rankings | **Date**: 2026-03-27

## Decision 1: Combat Win Tracking Mechanism

**Decision**: Add `combat_wins INTEGER NOT NULL DEFAULT 0` column to `characters` table. Increment on player-controlled monster fight victory only.

**Rationale**: Combat sessions are in-memory (`CombatSession` class). The victory path is in `CombatSession.endCombat('win')` at `backend/src/game/combat/combat-session.ts:351`. Adding a simple counter column avoids a new table. The increment goes right after `awardXp()` (line 355), inside the existing win block. Squire expeditions resolve via a different code path (`squire-expedition-service.ts`) and are excluded per clarification.

**Alternatives considered**:
- Separate `character_combat_stats` table — rejected; overkill for a single counter. Can migrate later if more stats needed.
- Derived from XP/level — rejected; doesn't accurately reflect fight count (XP also comes from quests).

## Decision 2: Periodic Ranking Calculation Strategy

**Decision**: Use `setInterval` on the backend game server to recalculate rankings every 5 minutes. Store the latest snapshot in-memory as a shared object. No database table for snapshots.

**Rationale**: The backend already uses `setInterval` for gathering ticks and `setTimeout` for day/night cycle. In-memory caching is simpler and sufficient — rankings are derived from DB queries but served from cache. The cache is a single JSON object rebuilt every interval. On server restart, it rebuilds on first tick.

**Alternatives considered**:
- Database materialized view — rejected; PostgreSQL materialized views require `REFRESH` and add complexity for a read-only leaderboard.
- Redis cache — rejected per constitution (deferred until measured need).
- On-demand query per request — rejected; would hit DB on every panel open, not scalable.

## Decision 3: Client-Server Communication Pattern

**Decision**: Client sends `rankings.get` WebSocket message when panel opens. Server responds with `rankings.data` containing the cached snapshot. No server-push; client always requests.

**Rationale**: Follows the existing quest.log request/response pattern. The handler reads from the in-memory cache (no DB hit per request). The cache includes the player's own rank for each category, computed per-request from the full snapshot using binary search or scan.

**Alternatives considered**:
- Server push on interval — rejected; wasteful if player doesn't have panel open.
- REST endpoint — rejected; violates constitution Principle I (WebSocket for all game state communication).

## Decision 4: Ranking Computation Queries

**Decision**: Five SQL queries run sequentially every 5 minutes:

1. **Top Level**: `SELECT id, name, class_id, level, experience FROM characters ORDER BY level DESC, experience DESC LIMIT 20`
2. **Top Fighters**: `SELECT id, name, class_id, combat_wins FROM characters ORDER BY combat_wins DESC, name ASC LIMIT 20`
3. **Top Crafters**: `SELECT c.id, c.name, c.class_id, COUNT(*) as crafts FROM characters c JOIN crafting_sessions cs ON cs.character_id = c.id WHERE cs.status IN ('completed','collected') GROUP BY c.id, c.name, c.class_id ORDER BY crafts DESC, c.name ASC LIMIT 20`
4. **Top Questers**: `SELECT c.id, c.name, c.class_id, COUNT(*) as quests FROM characters c JOIN character_quests cq ON cq.character_id = c.id WHERE cq.status = 'completed' GROUP BY c.id, c.name, c.class_id ORDER BY quests DESC, c.name ASC LIMIT 20`
5. **Map Population**: `SELECT mz.id, mz.name, COUNT(c.id) as player_count FROM map_zones mz LEFT JOIN characters c ON c.zone_id = mz.id GROUP BY mz.id, mz.name ORDER BY player_count DESC`
6. **Total players**: `SELECT COUNT(*) FROM characters`

For "player's own rank" (FR-005a), each category also runs a rank query per requesting player: `SELECT COUNT(*)+1 FROM characters WHERE <metric> > (SELECT <metric> FROM characters WHERE id = $1)`.

**Rationale**: Simple, efficient queries. The periodic 5-min interval means these only run ~288 times/day regardless of player count. No index needed initially — character tables are small for an indie game.

**Alternatives considered**:
- Window functions (RANK()) — considered but not needed since we only need top 20 + individual rank.
- Pre-computing all ranks into a table — rejected; unnecessary complexity for current scale.

## Decision 5: UI Panel Design

**Decision**: Model the RankingsPanel after QuestLog — absolute-positioned overlay, dark medieval theme, close button, tab navigation for categories. Mounted in `#game` container.

**Rationale**: QuestLog is the closest UI precedent — overlay panel opened from a top-bar button. Same pattern: toggle visibility, fetch data on show, render categories. The tabbed interface for categories mirrors how QuestLog sections separate quest types.

**Alternatives considered**:
- Modal dialog — rejected; feels too heavy for a reference panel players check frequently.
- Sidebar — rejected; game canvas is already flanked by panels.

## Decision 6: Migration Number

**Decision**: Migration file `028_character_rankings.sql`. Latest existing migration is `027_item_disassembly.sql`.

**Rationale**: Sequential numbering per project convention.
