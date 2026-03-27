# Data Model: Character Rankings

**Feature**: 026-character-rankings | **Date**: 2026-03-27

## Schema Changes

### Modified Table: `characters`

| Column | Type | Default | Constraint | Notes |
|--------|------|---------|------------|-------|
| `combat_wins` | `INTEGER` | `0` | `NOT NULL` | Incremented on player-controlled monster fight victory only |

### No New Tables

Rankings are computed from existing tables (`characters`, `crafting_sessions`, `character_quests`, `map_zones`) via periodic queries. Snapshots are cached in-memory, not persisted.

## Migration: `028_character_rankings.sql`

```sql
ALTER TABLE characters ADD COLUMN combat_wins INTEGER NOT NULL DEFAULT 0;
```

## Entities (In-Memory)

### RankingSnapshot

Cached in-memory on the game server. Rebuilt every 5 minutes.

| Field | Type | Description |
|-------|------|-------------|
| `updated_at` | `string` (ISO 8601) | Timestamp of last calculation |
| `total_players` | `number` | Total character count |
| `top_level` | `LeaderboardEntry[]` | Top 20 by level |
| `top_fighters` | `LeaderboardEntry[]` | Top 20 by combat_wins |
| `top_crafters` | `LeaderboardEntry[]` | Top 20 by completed crafts |
| `top_questers` | `LeaderboardEntry[]` | Top 20 by completed quests |
| `map_population` | `MapPopulationEntry[]` | All zones with player counts |

### LeaderboardEntry

| Field | Type | Description |
|-------|------|-------------|
| `rank` | `number` | Position (1-based) |
| `character_id` | `string` | UUID |
| `character_name` | `string` | Display name |
| `class_id` | `number` | Character class identifier |
| `value` | `number` | The ranked metric value |

### MapPopulationEntry

| Field | Type | Description |
|-------|------|-------------|
| `zone_id` | `number` | Map zone identifier |
| `zone_name` | `string` | Display name |
| `player_count` | `number` | Characters currently in zone |

### PlayerRankInfo

Per-request computation for the requesting player's own rank in each category.

| Field | Type | Description |
|-------|------|-------------|
| `level_rank` | `number` | Player's rank in top level |
| `level_value` | `number` | Player's level |
| `fighters_rank` | `number` | Player's rank in top fighters |
| `fighters_value` | `number` | Player's combat_wins |
| `crafters_rank` | `number` | Player's rank in top crafters |
| `crafters_value` | `number` | Player's completed crafts count |
| `questers_rank` | `number` | Player's rank in top questers |
| `questers_value` | `number` | Player's completed quests count |

## Query Sources

| Ranking | Source Table(s) | Metric | Tiebreaker |
|---------|----------------|--------|------------|
| Top Level | `characters` | `level DESC` | `experience DESC`, then `name ASC` |
| Top Fighters | `characters` | `combat_wins DESC` | `name ASC` |
| Top Crafters | `characters` + `crafting_sessions` | `COUNT(completed sessions) DESC` | `name ASC` |
| Top Questers | `characters` + `character_quests` | `COUNT(completed quests) DESC` | `name ASC` |
| Map Population | `map_zones` + `characters` | `COUNT(characters) DESC` | `zone_name ASC` |

## Relationships

```
characters.combat_wins ← incremented by CombatSession.endCombat('win')
characters.zone_id → map_zones.id (existing FK, used for map population)
crafting_sessions.character_id → characters.id (existing FK, aggregated for crafters)
character_quests.character_id → characters.id (existing FK, aggregated for questers)
```
