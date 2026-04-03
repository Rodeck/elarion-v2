# Data Model: NPC Stat Training

**Date**: 2026-04-02 | **Branch**: `031-stat-training`

## New Table: `stat_training_items`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| item_def_id | INTEGER | NOT NULL, FK → item_definitions(id), UNIQUE | The item used for training |
| stat_name | TEXT | NOT NULL, CHECK IN ('constitution','strength','intelligence','dexterity','toughness') | Which stat this item trains |
| tier | SMALLINT | NOT NULL, CHECK 1-3 | Item tier (affects success rate decay) |
| base_chance | SMALLINT | NOT NULL, CHECK 1-100 | Base success percentage before level decay |
| decay_per_level | NUMERIC(4,2) | NOT NULL, CHECK > 0 | Percentage points subtracted per character level |
| npc_id | INTEGER | NOT NULL, FK → npcs(id) | The trainer NPC who accepts this item |

**Indexes**: Primary key on `id`, unique on `item_def_id`.

## Altered Table: `npcs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| trainer_stat | TEXT | DEFAULT NULL, CHECK NULL OR IN ('constitution','strength','intelligence','dexterity','toughness') | Which stat this NPC trains via consumable items. Null = not a stat trainer. |

**Note**: This is independent of the existing `is_trainer` boolean, which controls the point allocation system. An NPC can have both.

## Entity Relationships

```text
npcs (1) ──── (many) stat_training_items (many) ──── (1) item_definitions
  │                       │
  │ trainer_stat           │ stat_name, tier, base_chance, decay_per_level
  │                       │
  └── Determines which    └── Determines which items are
      stat the NPC trains     accepted and their success rates
```

## Validation Rules

- `item_def_id` must reference an existing item definition
- `npc_id` must reference an existing NPC
- One item can only be mapped to one stat training configuration (UNIQUE on item_def_id)
- `base_chance` between 1 and 100 inclusive
- `decay_per_level` must be positive (> 0)
- `tier` between 1 and 3 inclusive
- `stat_name` must be one of the 5 valid attribute names

## State Transitions

Training attempt flow (server-side):

```text
IDLE ──[stat-training.open]──► VIEWING
  │                              │
  │                    [stat-training.attempt]
  │                              │
  │                     ┌────────┴────────┐
  │                     │                 │
  │               validate item     reject (error msg)
  │               validate cap      (no item consumed)
  │               validate combat
  │                     │
  │              consume 1x item
  │                     │
  │              roll RNG vs chance
  │                     │
  │              ┌──────┴──────┐
  │              │             │
  │          SUCCESS       FAILURE
  │          stat += 1     stat unchanged
  │          recalc stats
  │              │             │
  │              └──────┬──────┘
  │                     │
  │              send result
  │              send updated state
  │                     │
  └─────────────────────┘
```
