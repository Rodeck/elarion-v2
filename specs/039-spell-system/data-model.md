# Data Model: Spell System

**Feature**: 039-spell-system  
**Migration**: `043_spell_system.sql`

## New Tables

### `spells`

Spell definitions — analogous to `abilities` but for non-combat buff spells.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| name | VARCHAR(64) | NOT NULL UNIQUE | Display name |
| icon_filename | VARCHAR(256) | | Icon file in `backend/assets/spells/icons/` |
| description | TEXT | NOT NULL DEFAULT '' | Flavour text shown to player |
| effect_type | VARCHAR(24) | NOT NULL, CHECK | One of: `attack_pct`, `defence_pct`, `crit_chance_pct`, `crit_damage_pct`, `heal`, `movement_speed`, `energy` |
| effect_value | INTEGER | NOT NULL DEFAULT 0 | Base effect value (level 1 default) |
| duration_seconds | INTEGER | NOT NULL DEFAULT 0 | Base duration in seconds (level 1 default) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**CHECK constraint**: `effect_type IN ('attack_pct', 'defence_pct', 'crit_chance_pct', 'crit_damage_pct', 'heal', 'movement_speed', 'energy')`

### `spell_levels`

Per-level stat overrides — analogous to `ability_levels`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| spell_id | INTEGER | NOT NULL, FK → spells(id) ON DELETE CASCADE | |
| level | SMALLINT | NOT NULL, CHECK (1–5) | |
| effect_value | INTEGER | NOT NULL DEFAULT 0 | Override effect at this level |
| duration_seconds | INTEGER | NOT NULL DEFAULT 0 | Override duration at this level |
| gold_cost | INTEGER | NOT NULL DEFAULT 0 | Gold required to cast at this level |

**Primary key**: `(spell_id, level)`

### `spell_costs`

Item costs per spell level — supports multiple item types per level.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| spell_id | INTEGER | NOT NULL, FK → spells(id) ON DELETE CASCADE | |
| level | SMALLINT | NOT NULL, CHECK (1–5) | |
| item_def_id | INTEGER | NOT NULL, FK → item_definitions(id) ON DELETE CASCADE | Required item |
| quantity | SMALLINT | NOT NULL, CHECK (>= 1) | Number of items consumed |

**Primary key**: `(spell_id, level, item_def_id)`

### `character_spells`

Tracks which spells a character has learned + training progress — analogous to `character_owned_abilities` + `character_ability_progress` combined.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| character_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | |
| spell_id | INTEGER | NOT NULL, FK → spells(id) ON DELETE CASCADE | |
| current_level | SMALLINT | NOT NULL DEFAULT 1, CHECK (1–5) | |
| current_points | SMALLINT | NOT NULL DEFAULT 0, CHECK (0–99) | Progress toward next level |
| last_book_used_at | TIMESTAMPTZ | | 6-hour training cooldown |
| obtained_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Primary key**: `(character_id, spell_id)`

### `active_spell_buffs`

Active buffs on characters — persisted for server restart survival.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| character_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | Buff recipient |
| spell_id | INTEGER | NOT NULL, FK → spells(id) ON DELETE CASCADE | Source spell |
| caster_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | Who cast it |
| level | SMALLINT | NOT NULL | Level at time of cast |
| effect_type | VARCHAR(24) | NOT NULL | Cached from spell definition |
| effect_value | INTEGER | NOT NULL | Cached from spell level |
| expires_at | TIMESTAMPTZ | NOT NULL | Absolute expiry time |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Unique constraint**: `(character_id, spell_id)` — only one buff per spell per character.

**Index**: `ON active_spell_buffs (character_id) WHERE expires_at > NOW()` — for fast lookup of active buffs.

## Altered Tables

### `item_definitions`

```sql
-- Add spell_id column (mirrors ability_id for skill books)
ALTER TABLE item_definitions
  ADD COLUMN spell_id INTEGER REFERENCES spells(id) ON DELETE SET NULL;

-- Extend category CHECK to include spell_book_spell
ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_category_check;
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_category_check
  CHECK (category IN (
    'resource', 'food', 'heal', 'weapon',
    'boots', 'shield', 'greaves', 'bracer', 'tool',
    'helmet', 'chestplate',
    'ring', 'amulet',
    'skill_book', 'spell_book_spell'
  ));
```

## Entity Relationships

```
spells 1──N spell_levels        (per-level stat overrides)
spells 1──N spell_costs          (per-level item costs, multiple items per level)
spells 1──N character_spells     (which characters have learned this spell)
spells 1──N active_spell_buffs   (active buffs from this spell)
spells 1──N item_definitions     (spell book items linking to this spell via spell_id)

characters 1──N character_spells       (spells the character knows)
characters 1──N active_spell_buffs     (buffs on this character, as recipient)
characters 1──N active_spell_buffs     (buffs cast by this character, as caster)

item_definitions 1──N spell_costs      (items required as spell costs)
```

## State Transitions

### Character Spell Lifecycle
```
[No spell] → (use spell book) → [Level 1, 0 pts]
[Level N, X pts] → (use spell book) → [Level N, X+roll pts] or [Level N+1, 0 pts]
[Level 5, any] → (use spell book) → REJECTED (max level)
```

### Active Buff Lifecycle
```
[No buff] → (cast spell) → [Active buff, expires_at set]
[Active buff Lv N] → (cast same spell Lv >= N) → [Refreshed, new expires_at]
[Active buff Lv N] → (cast same spell Lv < N) → REJECTED
[Active buff] → (expires_at reached) → [Expired, row deleted]
```

## Cleanup Strategy

Expired buff rows are cleaned up lazily:
1. On query — `WHERE expires_at > NOW()` filters them out
2. On cast — old row for same `(character_id, spell_id)` is replaced via UPSERT
3. Periodic cleanup — optional scheduled DELETE of expired rows (low priority)
