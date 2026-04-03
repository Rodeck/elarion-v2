# Data Model: Skill Development System

**Date**: 2026-04-03  
**Feature**: 032-skill-development

## New Tables

### ability_levels

Per-ability, per-level stat definitions. Admins define how ability stats scale at each level.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| ability_id | INTEGER | NOT NULL, FK → abilities(id) ON DELETE CASCADE | Parent ability |
| level | SMALLINT | NOT NULL, CHECK (1-5) | Skill level (1 = base) |
| effect_value | INTEGER | NOT NULL, DEFAULT 0 | Level-scaled effect value |
| mana_cost | SMALLINT | NOT NULL, DEFAULT 0, CHECK (>= 0) | Level-scaled mana cost |
| duration_turns | SMALLINT | NOT NULL, DEFAULT 0, CHECK (>= 0) | Level-scaled duration |
| cooldown_turns | SMALLINT | NOT NULL, DEFAULT 0, CHECK (>= 0) | Level-scaled cooldown |

**Primary Key**: (ability_id, level)

**Notes**:
- Level 1 rows are seeded from current base ability stats during migration
- Levels 2-5 are optional (partial definitions allowed)
- If a player reaches a level without a defined row, combat falls back to the highest defined level's stats

### character_ability_progress

Per-character, per-ability skill progress tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| character_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | Owning character |
| ability_id | INTEGER | NOT NULL, FK → abilities(id) ON DELETE CASCADE | Target ability |
| current_level | SMALLINT | NOT NULL, DEFAULT 1, CHECK (1-5) | Current skill level |
| current_points | SMALLINT | NOT NULL, DEFAULT 0, CHECK (0-99) | Points toward next level |
| last_book_used_at | TIMESTAMPTZ | NULL | Timestamp of last skill book usage (null = never used / no cooldown) |

**Primary Key**: (character_id, ability_id)

**Notes**:
- Rows are created on first skill book usage (upsert pattern)
- Characters without a progress row default to level 1 with 0 points
- `last_book_used_at` is per-ability — each ability tracks its own 6-hour cooldown independently

## Altered Tables

### item_definitions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| ability_id | INTEGER | NULL, FK → abilities(id) ON DELETE SET NULL | Links skill book items to their ability (null for non-skill-book items) |

**Additional changes**:
- Extend `category` CHECK constraint to include `'skill_book'`

## Entity Relationships

```
abilities (1) ──── (0..5) ability_levels
    │                        [level-scaled stats per ability]
    │
    ├──── (0..N) character_ability_progress
    │                [per-character level + points + cooldown]
    │
    └──── (0..N) item_definitions (where category = 'skill_book')
                     [skill book items linked via ability_id]

characters (1) ──── (0..N) character_ability_progress
                             [one row per owned+progressed ability]
```

## State Transitions

### Ability Progress State Machine

```
[NO PROGRESS ROW]          ← Character owns ability but never used a book
    │
    │ (first skill book use)
    ▼
[LEVEL 1, X points]        ← Progress row created, points from first roll
    │
    │ (accumulate to 100 points)
    ▼
[LEVEL 2, carry-over pts]  ← Level incremented, points reset with carry-over
    │
    │ (repeat)
    ▼
[LEVEL 5, 0-99 points]     ← Max level reached, skill book usage rejected
    = MASTERED
```

### Skill Book Usage Flow

```
[IDLE]
    │
    │ player clicks "Use" on skill book
    ▼
[VALIDATE] ── fail ──► [ERROR: not owned / cooldown / max level / in combat]
    │
    │ pass
    ▼
[CONSUME ITEM] ── decrement quantity or delete slot
    │
    ▼
[ROLL POINTS] ── 60%→10, 30%→20, 9%→30, 1%→50
    │
    ▼
[UPDATE PROGRESS]
    │
    ├── points < 100 ──► [SAVE: same level, new points]
    │
    └── points >= 100 ──► [SAVE: level + 1, points - 100]
    │
    ▼
[SET COOLDOWN] ── last_book_used_at = now()
    │
    ▼
[SEND RESULT] ── skill-book.result + inventory.state + loadout:state
```

## Data Volume Estimates

- `ability_levels`: 9 abilities × 5 levels = 45 rows (static, admin-managed)
- `character_ability_progress`: up to 9 rows per character (one per ability). At 1000 characters: 9,000 rows max.
- `item_definitions`: +9 new skill book items (one per ability)
- No performance concerns at this scale.

## Migration File

`backend/src/db/migrations/035_skill_development.sql`

Key operations:
1. ALTER `item_definitions` — add `ability_id` column, extend `category` CHECK
2. CREATE `ability_levels` — with composite PK
3. CREATE `character_ability_progress` — with composite PK
4. INSERT INTO `ability_levels` — seed level 1 rows from existing ability base stats
