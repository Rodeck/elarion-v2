# WebSocket Contract: Character Rankings

**Feature**: 026-character-rankings | **Version**: 1

## Messages

### Client → Server

#### `rankings.get`

Request the current ranking snapshot. Client sends this when the rankings panel is opened.

**Payload**: `{}` (empty object)

**Preconditions**: Player must be authenticated with an active character.

---

### Server → Client

#### `rankings.data`

Response containing the full ranking snapshot plus the requesting player's own ranks.

**Payload**:

```typescript
interface RankingsDataPayload {
  updated_at: string;           // ISO 8601 timestamp of last calculation
  total_players: number;        // Total character count on server

  top_level: LeaderboardEntryDto[];      // Top 20 by level
  top_fighters: LeaderboardEntryDto[];   // Top 20 by combat wins
  top_crafters: LeaderboardEntryDto[];   // Top 20 by completed crafts
  top_questers: LeaderboardEntryDto[];   // Top 20 by completed quests
  map_population: MapPopulationDto[];    // All zones with player counts

  // Requesting player's own rank in each category
  my_ranks: {
    level: { rank: number; value: number };
    fighters: { rank: number; value: number };
    crafters: { rank: number; value: number };
    questers: { rank: number; value: number };
  };
}

interface LeaderboardEntryDto {
  rank: number;            // 1-based position
  character_id: string;    // UUID
  character_name: string;
  class_id: number;
  value: number;           // The ranked metric (level, wins, crafts, quests)
}

interface MapPopulationDto {
  zone_id: number;
  zone_name: string;
  player_count: number;
}
```

**Notes**:
- `my_ranks` is computed per-request for the authenticated player
- Leaderboard arrays are pre-sorted descending by value
- `map_population` is sorted by `player_count` descending
- If rankings haven't been calculated yet (server just started), `updated_at` is the server start time and arrays may be empty

## Error Cases

| Condition | Response |
|-----------|----------|
| No active character | `server.error` with code `INVALID_REQUEST` |
| Rankings not yet computed | Returns empty arrays with current timestamp |

## Backward Compatibility

New message types — no breaking changes to existing protocol.
