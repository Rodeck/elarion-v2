# Data Model: Item Disassembly System

**Feature Branch**: `025-item-disassembly`
**Date**: 2026-03-27
**Migration file**: `027_item_disassembly.sql`

## Schema Changes

### New Tables

#### `disassembly_recipes`

Stores chance entries for disassembling an item definition. All entries for the same `item_def_id` must sum to exactly 100% (enforced at application layer).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PRIMARY KEY | |
| `item_def_id` | INTEGER | NOT NULL, FK → item_definitions(id) ON DELETE CASCADE | The item that can be disassembled |
| `chance_percent` | SMALLINT | NOT NULL, CHECK (>= 1 AND <= 100) | Probability of this outcome |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | Display ordering in admin |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Index**: `CREATE INDEX idx_disassembly_recipes_item ON disassembly_recipes(item_def_id);`

#### `disassembly_recipe_outputs`

Stores the output items for each chance entry. One chance entry can produce multiple different items.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PRIMARY KEY | |
| `recipe_id` | INTEGER | NOT NULL, FK → disassembly_recipes(id) ON DELETE CASCADE | Parent chance entry |
| `output_item_def_id` | INTEGER | NOT NULL, FK → item_definitions(id) | Output item type |
| `quantity` | SMALLINT | NOT NULL, CHECK (>= 1) | How many of this item |

**Index**: `CREATE INDEX idx_disassembly_recipe_outputs_recipe ON disassembly_recipe_outputs(recipe_id);`

### Altered Tables

#### `item_definitions` — add column

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `disassembly_cost` | INTEGER | NOT NULL DEFAULT 0, CHECK (>= 0) | Gold (crowns) cost per unit to disassemble |

#### `item_definitions` — extend `tool_type` CHECK

```sql
-- Old constraint
CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe', 'fishing_rod'))

-- New constraint
CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe', 'fishing_rod', 'kiln'))
```

#### `npcs` — add column

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `is_disassembler` | BOOLEAN | NOT NULL DEFAULT false | Enables disassembly dialog option |

### No changes to

- `inventory_items` — existing `current_durability` column handles kiln durability
- `characters` — existing `crowns` column handles gold deduction
- `building_actions` — disassembly is NPC-dialog-based, not a building action type
- `building_npcs` — existing join table handles NPC-to-building assignment

## Entity Relationships

```
item_definitions (1) ──< disassembly_recipes (N)
  │                          │
  │ disassembly_cost         │ chance_percent (sum = 100% per item_def_id)
  │                          │
  │                     disassembly_recipe_outputs (N)
  │                          │
  └──────────────────────────┘ output_item_def_id → item_definitions

npcs
  │ is_disassembler: boolean
  │
  └──< building_npcs ──> buildings

inventory_items
  │ current_durability (for kiln instances)
  │ item_def_id → item_definitions (where tool_type = 'kiln')
```

## State Transitions

### Disassembly Operation (atomic)

```
Pre-state:
  - Player has items in disassembly grid (inventory_items rows)
  - Player has kiln in kiln slot (inventory_items row with tool_type='kiln')
  - Player has sufficient crowns

Post-state (all or nothing):
  1. Input inventory_items rows → DELETED
  2. characters.crowns → DECREMENTED by total cost
  3. Kiln inventory_items.current_durability → DECREMENTED by total item quantity
  4. If kiln durability reaches 0 → kiln inventory_items row DELETED
  5. Output inventory_items rows → INSERTED (new items) or quantity INCREMENTED (existing stacks)
```

### Kiln Lifecycle

```
Created (admin grants or crafted) → current_durability = max_durability
  │
  ├─ Used in disassembly → current_durability -= items_disassembled
  │
  ├─ current_durability > 0 → remains in inventory
  │
  └─ current_durability = 0 → row DELETED from inventory_items
```

## Migration SQL (027_item_disassembly.sql)

```sql
-- 1. Add disassembly cost to item definitions
ALTER TABLE item_definitions
  ADD COLUMN disassembly_cost INTEGER NOT NULL DEFAULT 0
  CHECK (disassembly_cost >= 0);

-- 2. Extend tool_type to include 'kiln'
ALTER TABLE item_definitions DROP CONSTRAINT item_definitions_tool_type_check;
ALTER TABLE item_definitions ADD CONSTRAINT item_definitions_tool_type_check
  CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe', 'fishing_rod', 'kiln'));

-- 3. Add is_disassembler flag to NPCs
ALTER TABLE npcs
  ADD COLUMN is_disassembler BOOLEAN NOT NULL DEFAULT false;

-- 4. Create disassembly recipe tables
CREATE TABLE disassembly_recipes (
  id            SERIAL PRIMARY KEY,
  item_def_id   INTEGER NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  chance_percent SMALLINT NOT NULL CHECK (chance_percent >= 1 AND chance_percent <= 100),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disassembly_recipes_item ON disassembly_recipes(item_def_id);

CREATE TABLE disassembly_recipe_outputs (
  id                 SERIAL PRIMARY KEY,
  recipe_id          INTEGER NOT NULL REFERENCES disassembly_recipes(id) ON DELETE CASCADE,
  output_item_def_id INTEGER NOT NULL REFERENCES item_definitions(id),
  quantity           SMALLINT NOT NULL CHECK (quantity >= 1)
);

CREATE INDEX idx_disassembly_recipe_outputs_recipe ON disassembly_recipe_outputs(recipe_id);
```
