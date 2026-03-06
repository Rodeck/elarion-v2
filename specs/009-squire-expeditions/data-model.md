# Data Model: Squire Expeditions

## Migration: `012_squire_expeditions.sql`

### 1. Extend `building_actions.action_type` constraint

The existing CHECK constraint allows `'travel'` only (per migration 009); migration 010
amended it to include `'explore'`. This migration adds `'expedition'`.

```sql
-- Drop old constraint and replace with extended one
ALTER TABLE building_actions
  DROP CONSTRAINT IF EXISTS building_actions_action_type_check;

ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore', 'expedition'));
```

### 2. `squires` table

Represents a player-owned companion. One row per squire per character.

```sql
CREATE TABLE IF NOT EXISTS squires (
  id           SERIAL       PRIMARY KEY,
  character_id TEXT         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squires_character_id ON squires(character_id);
```

**Fields:**
- `id` — surrogate PK
- `character_id` — owning character; one-to-many (currently one squire per character)
- `name` — system-assigned name (e.g. "Aldric"), immutable

**Status derivation** (no status column — derived from `squire_expeditions`):
- `idle` — no row in `squire_expeditions` where `collected_at IS NULL`
- `exploring` — uncollected row exists with `completes_at > now()`
- `ready` — uncollected row exists with `completes_at <= now()`

---

### 3. `squire_expeditions` table

Captures one dispatched expedition. Row persists until collected.

```sql
CREATE TABLE IF NOT EXISTS squire_expeditions (
  id              SERIAL       PRIMARY KEY,
  squire_id       INTEGER      NOT NULL REFERENCES squires(id) ON DELETE CASCADE,
  character_id    TEXT         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  building_id     INTEGER      NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  action_id       INTEGER      NOT NULL REFERENCES building_actions(id) ON DELETE CASCADE,
  duration_hours  INTEGER      NOT NULL CHECK (duration_hours IN (1, 3, 6)),
  reward_snapshot JSONB        NOT NULL,
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completes_at    TIMESTAMPTZ  NOT NULL,
  collected_at    TIMESTAMPTZ  NULL,
  notified_at     TIMESTAMPTZ  NULL
);

CREATE INDEX IF NOT EXISTS idx_squire_expeditions_squire_id
  ON squire_expeditions(squire_id);

CREATE INDEX IF NOT EXISTS idx_squire_expeditions_character_id
  ON squire_expeditions(character_id)
  WHERE collected_at IS NULL;
```

**Fields:**
- `squire_id` — which squire is exploring
- `character_id` — denormalized owner (avoids join on collect/notify)
- `building_id` / `action_id` — where the expedition was dispatched from
- `duration_hours` — 1, 3, or 6
- `reward_snapshot` — computed at dispatch, immutable
  ```json
  { "gold": 120, "exp": 240, "items": [{ "item_def_id": 3, "name": "Health Potion", "quantity": 4 }] }
  ```
- `started_at` — dispatch timestamp
- `completes_at` — `started_at + duration_hours * interval '1 hour'`
- `collected_at` — set when player collects; NULL = uncollected
- `notified_at` — set when `expedition.completed` WS message is delivered; NULL = not yet notified

---

## Expedition Action Config (JSONB in `building_actions.config`)

When `action_type = 'expedition'`, the config field holds:

```json
{
  "base_gold": 50,
  "base_exp": 100,
  "items": [
    { "item_def_id": 3, "base_quantity": 2 }
  ]
}
```

**Fields:**
- `base_gold` — gold reward at 1× scale (1h baseline); must be ≥ 0
- `base_exp` — experience reward at 1× scale; must be ≥ 0
- `items` — array of item rewards (may be empty)
  - `item_def_id` — must reference a valid `item_definitions.id`
  - `base_quantity` — integer ≥ 1 (quantity at 1× scale)

---

## Scaling Constants

Defined in `expedition-service.ts`, not in the database:

```
DURATION_MULTIPLIERS = {
  1: 1.0,
  3: 2.4,
  6: 4.0,
}
```

Scaled reward = `Math.floor(base * multiplier)`.
Items with scaled quantity = 0 are excluded from snapshot.

---

## Entity Relationships

```
characters ──< squires ──< squire_expeditions
                                │
                         building_actions ──> buildings
```

- One character → one squire (at launch; designed to support N)
- One squire → zero or one active expedition (enforced by server validation, not DB constraint)
- One expedition → one action_id + building_id snapshot FK

---

## TypeScript Interfaces (backend queries module)

```typescript
export interface Squire {
  id: number;
  character_id: string;
  name: string;
  created_at: Date;
}

export interface SquireExpedition {
  id: number;
  squire_id: number;
  character_id: string;
  building_id: number;
  action_id: number;
  duration_hours: 1 | 3 | 6;
  reward_snapshot: ExpeditionRewardSnapshot;
  started_at: Date;
  completes_at: Date;
  collected_at: Date | null;
  notified_at: Date | null;
}

export interface ExpeditionRewardSnapshot {
  gold: number;
  exp: number;
  items: { item_def_id: number; name: string; quantity: number }[];
}

export interface ExpeditionActionConfig {
  base_gold: number;
  base_exp: number;
  items: { item_def_id: number; base_quantity: number }[];
}
```
