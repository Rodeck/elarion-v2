# Data Model: Day/Night Cycle

**Branch**: `013-day-night-cycle` | **Date**: 2026-03-09

## Database Changes

### New Table: `map_random_encounter_tables`

Stores per-map encounter configuration for night random encounters. Each row defines one possible enemy type for a given map, with a relative weight used for weighted-random selection.

```sql
-- Migration 015: Day/Night Cycle
CREATE TABLE map_random_encounter_tables (
  id         SERIAL PRIMARY KEY,
  zone_id    INT NOT NULL REFERENCES map_zones(id) ON DELETE CASCADE,
  monster_id INT NOT NULL REFERENCES monsters(id)  ON DELETE CASCADE,
  weight     INT NOT NULL DEFAULT 1 CHECK (weight > 0),
  UNIQUE (zone_id, monster_id)
);

CREATE INDEX idx_random_encounters_zone ON map_random_encounter_tables(zone_id);
```

**Fields**:
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Surrogate key |
| `zone_id` | INT FK → map_zones | The map this entry belongs to |
| `monster_id` | INT FK → monsters | The monster type that can appear |
| `weight` | INT > 0 | Relative spawn weight (higher = more frequent) |

**Constraints**:
- `UNIQUE(zone_id, monster_id)` — a map cannot have the same monster listed twice.
- `weight > 0` — zero-weight entries are equivalent to deletion and disallowed.
- Cascade delete: if the map or monster is deleted, the encounter entry is removed.

**Example data**:
```
zone_id | monster_id | weight
--------+------------+-------
1       | 5          | 33     -- rat
1       | 6          | 66     -- dog
1       | 7          | 1      -- stone golem
```
Selection: a random number in `[0, totalWeight)` is drawn; entries are scanned in insertion order until the cumulative weight exceeds the roll. This is identical to the existing `pickMonster()` algorithm in `explore-combat-service.ts`.

---

## In-Memory State (Not Persisted)

### DayCycleService State

The cycle state lives exclusively in memory. It is **not** stored in PostgreSQL. On server restart, the cycle resets to the beginning of day.

```typescript
interface DayCycleState {
  phase: 'day' | 'night';
  phaseStartedAt: number;   // Date.now() when the current phase began
  dayDurationMs: number;    // 45 * 60 * 1000 (constant)
  nightDurationMs: number;  // 15 * 60 * 1000 (constant)
}
```

**Derived values** (computed on demand, not stored):
- `elapsed = Date.now() - phaseStartedAt`
- `remaining = currentPhaseDuration - elapsed`
- `progress = elapsed / currentPhaseDuration` (0.0–1.0, used by frontend progress bar)

---

## Protocol Types (shared/protocol additions)

### New payload: `DayNightStateDto`

Reusable sub-type embedded in `WorldStatePayload` and sent standalone in `world.day_night_changed`.

```typescript
export interface DayNightStateDto {
  phase: 'day' | 'night';
  phase_started_at: number;   // Unix timestamp ms — epoch when current phase began
  day_duration_ms: number;    // 2_700_000 (45 min)
  night_duration_ms: number;  // 900_000  (15 min)
}
```

The frontend derives `remaining` and `progress` locally from `phase_started_at` + the duration fields, refreshing every second via `setInterval`. This avoids sending a new message every second.

### Modified payload: `WorldStatePayload`

Added field:

```typescript
export interface WorldStatePayload {
  // ... existing fields unchanged ...
  day_night_state: DayNightStateDto;  // always present
}
```

### New payload: `NightEncounterResultPayload`

Sent to a single player when a random night encounter resolves (both city and tile movement).

```typescript
export interface NightEncounterResultPayload {
  outcome: 'no_encounter' | 'combat';

  // Present when outcome === 'combat':
  monster?: {
    id: number;
    name: string;
    icon_url: string | null;
    max_hp: number;       // already includes 1.1× night bonus
    attack: number;       // already includes 1.1× night bonus
    defense: number;      // already includes 1.1× night bonus
  };
  rounds?: CombatRoundRecord[];
  combat_result?: 'win' | 'loss';
  xp_gained?: number;
  items_dropped?: ItemDroppedDto[];
}
```

---

## Entity Relationships

```
map_zones (existing)
  └─── map_random_encounter_tables (NEW, zone_id FK)
             └─── monsters (existing, monster_id FK)

DayCycleService (in-memory singleton)
  ├── affects: NightEncounterResultPayload (stat multiplier)
  ├── affects: explore-combat-service (stat multiplier)
  └── broadcasts: world.day_night_changed → all sessions
                  world.state (day_night_state field) → connecting player
```
