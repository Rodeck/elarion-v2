# Data Model: Arena System

**Branch**: `029-arena-system` | **Date**: 2026-04-01

## Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────────┐
│    buildings      │       │      monsters         │
│    (existing)     │       │      (existing)        │
└────────┬─────────┘       └──────────┬────────────┘
         │ 1                          │ 1
         │                            │
         │ 1                          │ *
┌────────┴─────────┐       ┌──────────┴────────────┐
│     arenas        │───────│    arena_monsters      │
│                   │ 1   * │                        │
└────────┬─────────┘       └────────────────────────┘
         │ 1
         │
         │ *
┌────────┴──────────────┐       ┌──────────────────┐
│  arena_participants    │───────│   characters       │
│                        │ *   1 │   (existing)       │
└────────────────────────┘       │  + arena_id FK     │
                                 │  + arena_cooldown  │
                                 └──────────────────┘
```

## Entities

### `arenas`

Arena definitions — one per fighting venue. Linked 1:1 to a building.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| building_id | INTEGER | REFERENCES buildings(id) ON DELETE CASCADE, UNIQUE | The building that houses this arena |
| name | TEXT | NOT NULL | Display name (e.g., "The Blood Pit") |
| min_stay_seconds | INTEGER | NOT NULL, DEFAULT 3600 | Minimum time before player can voluntarily leave |
| reentry_cooldown_seconds | INTEGER | NOT NULL, DEFAULT 1800 | Global cooldown after leaving/being kicked |
| winner_xp | INTEGER | NOT NULL, DEFAULT 50 | XP granted to PvP winner |
| loser_xp | INTEGER | NOT NULL, DEFAULT 10 | XP granted to PvP loser |
| winner_crowns | INTEGER | NOT NULL, DEFAULT 25 | Crowns granted to PvP winner |
| loser_crowns | INTEGER | NOT NULL, DEFAULT 0 | Crowns granted to PvP loser |
| level_bracket | INTEGER | NOT NULL, DEFAULT 5 | Max level difference allowed for PvP challenges |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Whether the arena accepts new entrants |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Validation rules**:
- `building_id` must reference an existing building (FK enforced)
- `min_stay_seconds` must be >= 0
- `reentry_cooldown_seconds` must be >= 0
- `winner_xp`, `loser_xp`, `winner_crowns`, `loser_crowns` must be >= 0
- `level_bracket` must be >= 1

---

### `arena_monsters`

Join table linking arenas to their assigned NPC fighters (monsters).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| arena_id | INTEGER | REFERENCES arenas(id) ON DELETE CASCADE | The arena |
| monster_id | INTEGER | REFERENCES monsters(id) ON DELETE CASCADE | The assigned monster/fighter |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Display ordering in the fighter list |

**Validation rules**:
- UNIQUE(arena_id, monster_id) — a monster can only be assigned once per arena
- `sort_order` must be >= 0

---

### `arena_participants`

Tracks players currently inside an arena. Rows are inserted on entry and deleted on exit/kick.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| arena_id | INTEGER | REFERENCES arenas(id) ON DELETE CASCADE | Which arena the player is in |
| character_id | UUID | REFERENCES characters(id) ON DELETE CASCADE, UNIQUE | The participating character (one arena at a time) |
| entered_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the player entered |
| current_hp | INTEGER | NOT NULL | Player's current HP in the arena (persists between fights) |
| pre_fight_hp | INTEGER | NULL | HP snapshot taken before combat starts; used for crash recovery. NULL when not in combat |
| in_combat | BOOLEAN | NOT NULL, DEFAULT false | Whether the player is currently in a fight |
| fighting_character_id | UUID | REFERENCES characters(id) ON DELETE SET NULL, NULL | Opponent's character ID during PvP (NULL when not fighting or fighting NPC) |
| can_leave_at | TIMESTAMPTZ | NOT NULL | Earliest time the player can voluntarily leave |

**Validation rules**:
- `current_hp` must be >= 1 (player must have HP to be in the arena)
- `character_id` UNIQUE — a character can only be in one arena at a time
- When `in_combat = true`, `pre_fight_hp` must not be NULL

**State transitions**:
```
[Not in arena] ──enter──► [In Lobby] ──challenge──► [In Combat]
                               ▲                         │
                               │                    win  │  lose
                               │                         │
                          [In Lobby] ◄──win──────────────┤
                                                         │
                          [Not in arena] ◄──lose/kick────┘
```

---

### `characters` (existing — ALTER)

Two new columns added to the existing `characters` table.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| arena_id | INTEGER | REFERENCES arenas(id) ON DELETE SET NULL, NULL | Currently occupied arena (NULL = not in arena). Used for quick lookups and zone visibility filtering |
| arena_cooldown_until | TIMESTAMPTZ | NULL | Global arena re-entry cooldown expiry. NULL = no active cooldown |

---

### `building_actions` (existing — ALTER constraint)

The `action_type` CHECK constraint is extended to include `'arena'`.

```sql
CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing', 'arena'))
```

Arena building action config JSONB shape: `{ "arena_id": <integer> }`

---

## Shared Protocol Types (DTOs)

### ArenaDto

Sent to the player on arena entry. Describes the arena's public configuration.

```typescript
interface ArenaDto {
  id: number;
  name: string;
  building_id: number;
  min_stay_seconds: number;
  reentry_cooldown_seconds: number;
  level_bracket: number;
}
```

### ArenaParticipantDto

Represents a player currently in the arena. Shown in the lobby participant list.

```typescript
interface ArenaParticipantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  in_combat: boolean;
  entered_at: string; // ISO 8601
}
```

### ArenaCombatantDto

Opponent stats shown in PvP combat. Includes exact HP (not bracket-hidden).

```typescript
interface ArenaCombatantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  max_hp: number;
  attack: number;
  defence: number;
}
```

### ArenaBuildingActionDto

Building action DTO for the `'arena'` action type.

```typescript
interface ArenaBuildingActionDto {
  id: number;
  action_type: 'arena';
  sort_order: number;
  arena_id: number;
  arena_name: string;
}
```

### In-Memory State (not persisted)

```typescript
// Per-arena in-memory state
interface ArenaState {
  arenaId: number;
  participants: Map<string, ArenaParticipantState>; // characterId → state
}

interface ArenaParticipantState {
  characterId: string;
  name: string;
  classId: number;
  level: number;
  currentHp: number;
  maxHp: number;
  inCombat: boolean;
  canLeaveAt: Date;
  socket: WebSocket;
}

// PvP combat session (keyed by combatId)
interface PvpCombatSession {
  combatId: string;
  arenaId: number;
  challengerId: string;
  defenderId: string;
  challengerStats: DerivedCombatStats;
  defenderStats: DerivedCombatStats;
  challengerMaxMana: number;
  defenderMaxMana: number;
  challengerLoadout: CombatLoadout;
  defenderLoadout: CombatLoadout;
  challengerState: EngineState;  // "player" = challenger, "enemy" = defender
  defenderState: EngineState;    // "player" = defender, "enemy" = challenger
  turn: number;
  phase: 'player_turn' | 'active_window' | 'enemy_turn' | 'ended';
  activeWindowTimer: NodeJS.Timeout | null;
  challengerActedThisTurn: boolean;
  defenderActedThisTurn: boolean;
}
```
