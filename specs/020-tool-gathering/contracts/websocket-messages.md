# WebSocket Contract: Tool Gathering Messages

**Feature Branch**: `020-tool-gathering`
**Protocol Version**: Increment from current

## New Client → Server Messages

### `gathering.start`

Player requests to begin a gathering session at a building.

```typescript
interface GatheringStartPayload {
  building_id: number;
  action_id: number;
  duration: number;        // seconds, must be within [min_seconds, max_seconds]
  tool_slot_id: number;    // inventory_items.id of the tool to use
}
```

**Validation (server-side)**:
- Character is on city map at the specified building
- Character is not in combat (`in_combat = false`)
- Character is not already gathering (`in_gathering = false`)
- Character HP > 0
- Action exists, is type 'gather', belongs to the building
- Duration is within action's [min_seconds, max_seconds] range
- Tool slot belongs to the character
- Tool's item_definition.tool_type matches action's required_tool_type
- Tool's current_durability >= duration * durability_per_second

### `gathering.cancel`

Player requests to end gathering early.

```typescript
interface GatheringCancelPayload {
  // no fields needed — server identifies session by character ID
}
```

## New Server → Client Messages

### `gathering.started`

Confirms gathering session has begun.

```typescript
interface GatheringStartedPayload {
  action_id: number;
  building_id: number;
  duration: number;              // chosen duration in seconds
  durability_cost: number;       // total durability that will be consumed
  tool_slot_id: number;
  started_at: string;            // ISO 8601 timestamp
}
```

### `gathering.tick`

Sent each second with the event result for that tick.

```typescript
interface GatheringTickPayload {
  tick: number;                  // 1-based tick counter
  total_ticks: number;           // chosen duration
  event: GatheringTickEvent;
  current_hp: number;            // player HP after this tick
  tool_durability: number;       // remaining durability after this tick (display only)
}

interface GatheringTickEvent {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing';
  message?: string;
  // resource
  item_name?: string;
  quantity?: number;
  // gold
  crowns?: number;
  // accident
  hp_damage?: number;
  // monster — combat starts, separate combat.start message follows
  monster_name?: string;
}
```

### `gathering.combat_pause`

Sent when a monster event triggers combat. Gathering timer pauses.

```typescript
interface GatheringCombatPausePayload {
  tick: number;                  // tick at which combat was triggered
  monster_name: string;
}
```

Note: The standard `combat.start` message follows immediately after this message.

### `gathering.combat_resume`

Sent after combat ends if the player survived (HP > 0). Gathering timer resumes.

```typescript
interface GatheringCombatResumePayload {
  tick: number;                  // tick at which gathering resumes
  remaining_ticks: number;       // ticks left
  combat_result: 'win' | 'loss'; // loss is possible if HP > 0 (fled/partial)
  current_hp: number;
}
```

### `gathering.ended`

Sent when gathering ends (any reason: completion, cancel, death).

```typescript
interface GatheringEndedPayload {
  reason: 'completed' | 'cancelled' | 'death';
  ticks_completed: number;
  total_ticks: number;
  summary: GatheringSummary;
  tool_destroyed: boolean;
  tool_remaining_durability: number | null;  // null if destroyed
}

interface GatheringSummary {
  resources_gained: { item_name: string; quantity: number }[];
  crowns_gained: number;
  combats_fought: number;
  combats_won: number;
  accidents: number;
  total_hp_lost: number;
}
```

### `gathering.rejected`

Sent when a gathering start request fails validation.

```typescript
interface GatheringRejectedPayload {
  reason:
    | 'NOT_AT_BUILDING'
    | 'IN_COMBAT'
    | 'IN_GATHERING'
    | 'HP_ZERO'
    | 'INVALID_ACTION'
    | 'INVALID_DURATION'
    | 'NO_TOOL'
    | 'WRONG_TOOL_TYPE'
    | 'INSUFFICIENT_DURABILITY'
    | 'INVENTORY_FULL';         // reserved for future use
  message: string;               // human-readable reason
}
```

## Modified Messages

### `city.building_action_rejected`

Extended to include gathering-related rejection reasons.

New reason values: `'IN_GATHERING'`, `'HP_ZERO'`

### `inventory.state` / `inventory.item_received`

`InventorySlotDto` extended with optional `current_durability`:

```typescript
interface InventorySlotDto {
  slot_id: number;
  item_def_id: number;
  quantity: number;
  current_durability?: number | null;  // NEW — present for tool items
  definition: ItemDefinitionDto;
}
```

### `ItemDefinitionDto`

Extended with tool fields:

```typescript
interface ItemDefinitionDto {
  // ... existing fields ...
  tool_type?: string | null;        // NEW — 'pickaxe', 'axe', or null
  max_durability?: number | null;   // NEW
  power?: number | null;            // NEW
}
```

## Building Action DTO Extension

### `GatherActionDto`

New member of the `BuildingActionDto` union:

```typescript
interface GatherActionDto {
  id: number;
  action_type: 'gather';
  label: string;
  config: {
    required_tool_type: 'pickaxe' | 'axe';
    durability_per_second: number;
    min_seconds: number;
    max_seconds: number;
    // events are server-only, not sent to client
  };
}
```

## Backward Compatibility

- All new messages use new type strings — no collision with existing messages.
- Extended DTOs (`InventorySlotDto`, `ItemDefinitionDto`) add optional fields — existing clients ignore them.
- Building action type 'gather' is a new variant — existing clients that don't handle it will show it as an unknown action (graceful degradation).
