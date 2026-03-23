# Data Model: Tool Durability & Gathering System

**Feature Branch**: `020-tool-gathering`
**Date**: 2026-03-19

## Migration 021: Tool Gathering

### Schema Changes

#### item_definitions — add tool columns

```sql
ALTER TABLE item_definitions
  ADD COLUMN tool_type    VARCHAR(16) DEFAULT NULL
    CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe')),
  ADD COLUMN max_durability INTEGER DEFAULT NULL
    CHECK (max_durability IS NULL OR max_durability > 0),
  ADD COLUMN power        SMALLINT DEFAULT NULL
    CHECK (power IS NULL OR power > 0);

-- Enforce: tool columns only set when category = 'tool'
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_tool_fields_check
    CHECK (
      (category = 'tool' AND tool_type IS NOT NULL AND max_durability IS NOT NULL)
      OR
      (category != 'tool' AND tool_type IS NULL AND max_durability IS NULL AND power IS NULL)
    );
```

#### inventory_items — add durability tracking

```sql
ALTER TABLE inventory_items
  ADD COLUMN current_durability INTEGER DEFAULT NULL
    CHECK (current_durability IS NULL OR current_durability >= 0);
```

#### building_actions — extend action_type CHECK

```sql
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;

ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather'));
```

#### characters — add gathering lock

```sql
ALTER TABLE characters
  ADD COLUMN in_gathering BOOLEAN NOT NULL DEFAULT false;
```

## Entity Definitions

### ItemDefinition (extended)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| tool_type | VARCHAR(16) | Yes | 'pickaxe' or 'axe'; NULL for non-tools |
| max_durability | INTEGER | Yes | Max durability; NULL for non-tools |
| power | SMALLINT | Yes | Tool power rating; NULL for non-tools |

Constraint: When `category = 'tool'`, `tool_type` and `max_durability` are required. When `category != 'tool'`, all three must be NULL.

### InventoryItem (extended)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| current_durability | INTEGER | Yes | Current durability for tool instances; NULL for non-tools |

Initialized to `item_definitions.max_durability` when a tool is granted to inventory.

### Character (extended)

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| in_gathering | BOOLEAN | No | false | True while player is in active gathering session |

### GatherActionConfig (JSONB in building_actions.config)

```typescript
interface GatherActionConfig {
  required_tool_type: 'pickaxe' | 'axe';
  durability_per_second: number;  // durability consumed per tick
  min_seconds: number;            // minimum gathering duration
  max_seconds: number;            // maximum gathering duration
  events: GatherEventConfig[];    // weighted event list
}

interface GatherEventConfig {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing';
  weight: number;                 // relative weight for probability
  // resource-specific
  item_def_id?: number;
  quantity?: number;
  // gold-specific
  min_amount?: number;
  max_amount?: number;
  // monster-specific
  monster_id?: number;
  // accident-specific
  hp_damage?: number;
  // shared
  message?: string;               // display message for resource, gold, accident
}
```

### GatheringSession (in-memory only)

```typescript
interface GatheringSession {
  characterId: string;
  actionId: number;
  buildingId: number;
  toolSlotId: number;             // inventory_items.id of the tool being used
  chosenDuration: number;         // seconds chosen by player
  totalDurabilityCost: number;    // chosenDuration * durability_per_second
  config: GatherActionConfig;     // snapshot of action config at start
  currentTick: number;            // seconds elapsed (0-based)
  eventLog: GatherEventResult[];  // events that occurred
  paused: boolean;                // true during combat encounters
  timer: NodeJS.Timeout | null;   // interval handle
}

interface GatherEventResult {
  tick: number;
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing';
  message?: string;
  // type-specific results
  item_name?: string;
  quantity?: number;
  crowns?: number;
  hp_damage?: number;
  combat_result?: 'win' | 'loss';
}
```

## Relationships

```
item_definitions  1──*  inventory_items  (item_def_id FK)
characters        1──*  inventory_items  (character_id FK)
buildings         1──*  building_actions  (building_id FK)
building_actions  ───>  item_definitions  (via config.events[].item_def_id, logical not FK)
building_actions  ───>  monsters          (via config.events[].monster_id, logical not FK)
```

## State Transitions

### Gathering Session Lifecycle

```
IDLE
  │ player requests gather (validates tool, HP, not busy)
  ▼
GATHERING
  │ each second: roll event, consume durability
  ├──> COMBAT (if monster event) → in_combat=true, pause timer
  │      │ combat ends
  │      ├──> GATHERING (if HP > 0, resume timer)
  │      └──> ENDED (if HP == 0)
  ├──> ENDED (if HP reaches 0 from accident)
  ├──> ENDED (player cancels early)
  └──> ENDED (timer completes all ticks)

ENDED
  │ apply full durability cost to tool
  │ destroy tool if durability <= 0
  │ set in_gathering = false
  │ send summary to player
  ▼
IDLE
```
