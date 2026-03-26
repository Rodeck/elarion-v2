# Data Model: Squire System Overhaul

**Branch**: `022-squire-overhaul` | **Date**: 2026-03-24

## Migration: `023_squire_overhaul.sql`

### New Table: `squire_definitions`

Admin-managed squire templates (analogous to `item_definitions`).

```sql
CREATE TABLE squire_definitions (
  id              SERIAL       PRIMARY KEY,
  name            TEXT         NOT NULL UNIQUE,
  icon_filename   TEXT,                          -- nullable until icon uploaded
  power_level     INTEGER      NOT NULL DEFAULT 0 CHECK (power_level >= 0 AND power_level <= 100),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | Auto-increment |
| name | TEXT | NOT NULL UNIQUE | Display name (e.g., "Brand", "Aldric") |
| icon_filename | TEXT | nullable | PNG filename in `backend/assets/squires/icons/` |
| power_level | INTEGER | 0–100 | Expedition bonus percentage at max rank |
| is_active | BOOLEAN | DEFAULT true | false = hidden from future drops, still owned by players |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### New Table: `character_squires`

Player-owned squire instances (replaces existing `squires` table).

```sql
CREATE TABLE character_squires (
  id                SERIAL       PRIMARY KEY,
  character_id      UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  squire_def_id     INTEGER      NOT NULL REFERENCES squire_definitions(id),
  level             INTEGER      NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 20),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_character_squires_character_id ON character_squires(character_id);
CREATE INDEX idx_character_squires_def ON character_squires(squire_def_id);
```

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | Auto-increment, replaces old squires.id |
| character_id | UUID | FK → characters | Owner |
| squire_def_id | INTEGER | FK → squire_definitions | Template reference |
| level | INTEGER | 1–20 | Determines rank name display |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### New Table: `monster_squire_loot`

Squire drops from monsters (parallel to `monster_loot` for items).

```sql
CREATE TABLE monster_squire_loot (
  id              SERIAL       PRIMARY KEY,
  monster_id      INTEGER      NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  squire_def_id   INTEGER      NOT NULL REFERENCES squire_definitions(id),
  drop_chance     INTEGER      NOT NULL CHECK (drop_chance >= 1 AND drop_chance <= 100),
  squire_level    INTEGER      NOT NULL DEFAULT 1 CHECK (squire_level >= 1 AND squire_level <= 20)
);

CREATE INDEX idx_monster_squire_loot_monster ON monster_squire_loot(monster_id);
```

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| monster_id | INTEGER | FK → monsters | Which monster drops this |
| squire_def_id | INTEGER | FK → squire_definitions | Which squire definition |
| drop_chance | INTEGER | 1–100 | Percentage chance per kill |
| squire_level | INTEGER | 1–20, DEFAULT 1 | Level of squire granted |

### Altered Table: `characters`

```sql
ALTER TABLE characters
  ADD COLUMN squire_slots_unlocked INTEGER NOT NULL DEFAULT 2;
```

New column:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| squire_slots_unlocked | INTEGER | NOT NULL DEFAULT 2 | Number of squire slots currently available (max 5) |

### Altered Table: `npcs`

```sql
ALTER TABLE npcs
  ADD COLUMN is_squire_dismisser BOOLEAN NOT NULL DEFAULT false;
```

### Altered Table: `quest_rewards`

```sql
ALTER TABLE quest_rewards
  DROP CONSTRAINT quest_rewards_reward_type_check;

ALTER TABLE quest_rewards
  ADD CONSTRAINT quest_rewards_reward_type_check
    CHECK (reward_type IN ('item', 'xp', 'crowns', 'squire'));
```

When `reward_type = 'squire'`: `target_id` references `squire_definitions.id`, `quantity` is the squire level (1–20).

### Updated Table: `squire_expeditions`

Update FK from old `squires` to new `character_squires`:

```sql
-- squire_expeditions.squire_id now references character_squires.id
-- Handled as part of migration (data migration renames squires → character_squires)
```

### Migration Strategy (Data)

```sql
-- 1. Create squire_definitions table
-- 2. Insert a default "Legacy Squire" definition (power_level = 0)
-- 3. Rename squires → character_squires, add squire_def_id and level columns
-- 4. Set all existing rows: squire_def_id = legacy_def.id, level = 1
-- 5. Add NOT NULL constraint and FK to squire_def_id
-- 6. Update squire_expeditions FK if needed
-- 7. Add characters.squire_slots_unlocked column
-- 8. Create monster_squire_loot table
-- 9. Alter quest_rewards CHECK
-- 10. Alter npcs with is_squire_dismisser
```

## Constants (Shared Code)

### Squire Ranks (`shared/protocol/index.ts`)

```typescript
export const SQUIRE_RANKS: readonly string[] = [
  'Peasant',        // Level 1
  'Commoner',       // Level 2
  'Servant',        // Level 3
  'Page',           // Level 4
  'Yeoman',         // Level 5
  'Footman',        // Level 6
  'Squire',         // Level 7
  'Sergeant',       // Level 8
  'Man-at-Arms',    // Level 9
  'Knight-Errant',  // Level 10
  'Knight',         // Level 11
  'Knight-Captain', // Level 12
  'Baron',          // Level 13
  'Viscount',       // Level 14
  'Count',          // Level 15
  'Earl',           // Level 16
  'Marquess',       // Level 17
  'Duke',           // Level 18
  'Prince',         // Level 19
  'Sovereign',      // Level 20
] as const;

export const MAX_SQUIRE_SLOTS = 5;
export const DEFAULT_UNLOCKED_SLOTS = 2;
export const MAX_SQUIRE_LEVEL = 20;
export const MAX_POWER_LEVEL = 100;

export function getSquireRank(level: number): string {
  return SQUIRE_RANKS[Math.max(0, Math.min(level - 1, SQUIRE_RANKS.length - 1))];
}
```

## Gathering Event Extension

The `GatherEventConfig` interface in `backend/src/game/gathering/gathering-service.ts` adds a new event type:

```typescript
interface GatherEventConfig {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing' | 'squire';
  weight: number;
  item_def_id?: number;     // for 'resource'
  quantity?: number;         // for 'resource'
  min_amount?: number;       // for 'gold'
  max_amount?: number;       // for 'gold'
  monster_id?: number;       // for 'monster'
  hp_damage?: number;        // for 'accident'
  message?: string;
  squire_def_id?: number;    // for 'squire' — NEW
  squire_level?: number;     // for 'squire' — NEW
}
```

Similarly, `GatheringTickEvent` in `shared/protocol/index.ts`:

```typescript
export interface GatheringTickEvent {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing' | 'squire';
  message?: string;
  item_name?: string;
  item_icon_url?: string;
  quantity?: number;
  crowns?: number;
  squire_name?: string;      // NEW — for 'squire' type
  squire_icon_url?: string;  // NEW
  squire_rank?: string;      // NEW
}
```

## Entity Relationship Summary

```
squire_definitions (admin template)
  ├── character_squires.squire_def_id (player instances)
  │     └── squire_expeditions.squire_id (active expeditions)
  ├── monster_squire_loot.squire_def_id (monster drops)
  ├── quest_rewards.target_id (when reward_type = 'squire')
  └── gathering config JSONB.squire_def_id (gathering events)

characters
  ├── character_squires.character_id (owned squires)
  └── .squire_slots_unlocked (slot capacity)

npcs
  └── .is_squire_dismisser (dismissal flag)
```
