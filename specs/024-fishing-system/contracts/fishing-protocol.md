# WebSocket Protocol Contract: Fishing System

**Feature**: 024-fishing-system | **Protocol Version**: v1 | **Date**: 2026-03-26

All messages use the standard envelope: `{ type: string, v: 1, payload: T }`

## Client → Server Messages

### fishing.cast

Initiates a fishing attempt at a fishing spot.

```typescript
interface FishingCastPayload {
  building_id: number;
  action_id: number;
}
```

**Preconditions**: Player has fishing rod equipped, is at building with fishing action, rod durability > 1, not in combat, not gathering, not already fishing.

### fishing.complete

Submits player timing data after the mini-game completes on the client.

```typescript
interface FishingCompletePayload {
  session_id: string;
  input_timestamps: number[];   // ms offsets from session start for each tension input
  reel_timestamp: number;       // ms offset when player attempted reel-in
}
```

**Preconditions**: Active fishing session exists for this character with matching session_id.

### fishing.cancel

Player cancels an active fishing session (e.g., walks away).

```typescript
interface FishingCancelPayload {
  session_id: string;
}
```

## Server → Client Messages

### fishing.session_start

Sent after successful cast validation. Contains all mini-game parameters for client rendering.

```typescript
interface FishingSessionStartPayload {
  session_id: string;
  bite_delay_ms: number;            // 2000–8000, randomized per cast
  pull_pattern: PullPatternDto;     // Parameters for tension meter behavior
  catch_window: CatchWindowDto;     // Timing window for reel-in
  fish_silhouette: string;          // Visual hint (e.g., 'small', 'medium', 'large')
}

interface PullPatternDto {
  type: 'aggressive' | 'erratic' | 'steady';
  segments: PullSegmentDto[];       // Sequence of pull behaviors
  green_zone_width: number;         // 0.0–1.0, fraction of meter that is "safe"
}

interface PullSegmentDto {
  duration_ms: number;              // How long this segment lasts
  speed: number;                    // Pull speed (pixels/sec equivalent)
  direction: 'up' | 'down';        // Pull direction on tension meter
  pause_ms: number;                 // Pause before next segment
}

interface CatchWindowDto {
  window_start_ms: number;          // ms offset from tension phase start
  window_duration_ms: number;       // How long the reel-in window is open
}
```

### fishing.result

Sent after server validates the player's timing data.

```typescript
interface FishingResultPayload {
  success: boolean;
  fish_name: string | null;         // null if failed
  fish_icon_url: string | null;
  items_received: FishingLootDto[];  // Empty if failed
  rod_durability_remaining: number;
  rod_locked: boolean;              // true if durability hit 1
  snap_check_failed: boolean;       // true if anti-bot triggered
}

interface FishingLootDto {
  slot_id: number;
  item_def_id: number;
  item_name: string;
  icon_url: string;
  quantity: number;
  category: string;
}
```

### fishing.rejected

Sent when a fishing action is rejected by the server.

```typescript
interface FishingRejectedPayload {
  action: 'cast' | 'complete' | 'cancel';
  reason: FishingRejectionReason;
  message: string;
}

type FishingRejectionReason =
  | 'NO_ROD_EQUIPPED'
  | 'ROD_LOCKED'
  | 'NOT_AT_FISHING_SPOT'
  | 'IN_COMBAT'
  | 'ALREADY_FISHING'
  | 'ALREADY_GATHERING'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'INVENTORY_FULL';
```

## Fishing-Adjacent Messages (Existing Patterns)

### Rod Upgrade

Uses existing NPC interaction pattern. The Fisherman NPC provides a building action for upgrades. The upgrade flow reuses the NPC/crafting interaction model:

- Client: `npc.interact` → shows upgrade UI with costs
- Client: `fishing.upgrade_rod` (new)
- Server: `fishing.upgrade_result` (new)

```typescript
interface FishingUpgradeRodPayload {
  npc_id: number;
}

interface FishingUpgradeResultPayload {
  success: boolean;
  new_tier: number;
  new_max_durability: number;
  new_durability: number;
  points_remaining: number;
  reason?: string;              // If failed: 'INSUFFICIENT_POINTS' | 'INSUFFICIENT_RESOURCES' | 'MAX_TIER'
  updated_slots: InventorySlotDto[];
}
```

### Rod Repair

```typescript
// Client → Server
interface FishingRepairRodPayload {
  npc_id: number;
}

// Server → Client
interface FishingRepairResultPayload {
  success: boolean;
  new_durability: number;
  crowns_remaining: number;
  reason?: string;              // If failed: 'INSUFFICIENT_CROWNS' | 'INSUFFICIENT_RESOURCES' | 'ROD_NOT_LOCKED'
  updated_slots: InventorySlotDto[];
}
```

## New DTO Extensions

### EquipmentSlotsDto (extended)

```typescript
export interface EquipmentSlotsDto {
  helmet:     InventorySlotDto | null;
  chestplate: InventorySlotDto | null;
  left_arm:   InventorySlotDto | null;
  right_arm:  InventorySlotDto | null;
  greaves:    InventorySlotDto | null;
  bracer:     InventorySlotDto | null;
  boots:      InventorySlotDto | null;
  ring:       InventorySlotDto | null;   // NEW
  amulet:     InventorySlotDto | null;   // NEW
}
```

### ItemCategory (extended)

```typescript
export type ItemCategory =
  | 'resource' | 'food' | 'heal' | 'weapon'
  | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool'
  | 'helmet' | 'chestplate'
  | 'ring' | 'amulet';               // NEW
```

### EquipSlot (extended)

```typescript
export type EquipSlot =
  | 'helmet' | 'chestplate' | 'left_arm' | 'right_arm'
  | 'greaves' | 'bracer' | 'boots'
  | 'ring' | 'amulet';               // NEW
```

### RewardType (extended)

```typescript
export type RewardType = 'item' | 'xp' | 'crowns' | 'squire' | 'rod_upgrade_points';  // NEW
```

### BuildingActionDto (extended)

```typescript
export interface FishingBuildingActionDto {
  id: number;
  action_type: 'fishing';
  label: string;
  config: {
    min_rod_tier?: number;          // Optional: minimum rod tier for this spot
  };
}

// Add to union:
export type BuildingActionDto =
  | TravelBuildingActionDto
  | ExploreBuildingActionDto
  | ExpeditionBuildingActionDto
  | GatherBuildingActionDto
  | MarketplaceBuildingActionDto
  | FishingBuildingActionDto;       // NEW
```

## Message Type Registry

| Type String | Direction | Payload Type |
|-------------|-----------|--------------|
| `fishing.cast` | C→S | FishingCastPayload |
| `fishing.complete` | C→S | FishingCompletePayload |
| `fishing.cancel` | C→S | FishingCancelPayload |
| `fishing.session_start` | S→C | FishingSessionStartPayload |
| `fishing.result` | S→C | FishingResultPayload |
| `fishing.rejected` | S→C | FishingRejectedPayload |
| `fishing.upgrade_rod` | C→S | FishingUpgradeRodPayload |
| `fishing.upgrade_result` | S→C | FishingUpgradeResultPayload |
| `fishing.repair_rod` | C→S | FishingRepairRodPayload |
| `fishing.repair_result` | S→C | FishingRepairResultPayload |
