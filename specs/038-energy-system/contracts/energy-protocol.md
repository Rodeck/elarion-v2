# WebSocket Protocol Contract: Energy & Movement Speed

**Branch**: `038-energy-system` | **Protocol Version**: Current + energy extensions

## Extended Types

### CharacterData (extended)

Three new fields added to `CharacterData` interface:

```typescript
export interface CharacterData {
  // ... existing fields ...
  max_energy: number;        // NEW: energy cap (default 1000)
  current_energy: number;    // NEW: current energy (0..max_energy)
  movement_speed: number;    // NEW: base movement speed (default 100)
}
```

Sent in: `world.state`, `character.created`

### GatherBuildingActionDto config (extended)

```typescript
export interface GatherBuildingActionDto {
  id: number;
  action_type: 'gather';
  label: string;
  config: {
    required_tool_type: string;
    durability_per_second: number;
    min_seconds: number;
    max_seconds: number;
    energy_per_second: number;   // NEW: energy cost per second (0 = free)
  };
}
```

## New Messages (Server → Client)

### `character.energy_changed`

Sent when energy changes (regen tick, action consumption, item use, death penalty).

```typescript
export interface EnergyChangedPayload {
  current_energy: number;
  max_energy: number;
}
```

### `inventory.use_result`

Sent after successful item consumption.

```typescript
export interface InventoryUseResultPayload {
  inventory_item_id: string;
  item_def_id: number;
  remaining_quantity: number;   // 0 if stack consumed entirely
  effect: 'energy' | 'hp';
  amount_restored: number;
  new_value: number;            // new current_energy or current_hp
  max_value: number;            // max_energy or max_hp
}
```

### `inventory.use_rejected`

Sent when item use is refused.

```typescript
export interface InventoryUseRejectedPayload {
  reason: 'not_found' | 'not_consumable' | 'energy_full' | 'hp_full' | 'in_combat';
  message: string;
}
```

## New Messages (Client → Server)

### `inventory.use_item`

Player requests to consume an item from inventory.

```typescript
export interface InventoryUseItemPayload {
  inventory_item_id: string;
}
```

## Extended Rejection Messages

The following existing rejection messages gain a new `reason` value:

| Message | New Reason | When |
|---------|-----------|------|
| `arena:enter_rejected` | `'insufficient_energy'` | Energy < 20 |
| `boss:challenge_rejected` | `'insufficient_energy'` | Energy < 20 |
| `fishing:rejected` | `'insufficient_energy'` | Energy < 10 |
| `building_action.rejected` | `'insufficient_energy'` | Energy < 10 (explore) |
| `gathering:rejected` | `'insufficient_energy'` | Energy = 0 at start |
| `gathering:ended` | `'energy_depleted'` | Energy hit 0 during gathering |

## Unchanged

- Tile-map movement (`player.move`) — no energy cost, no protocol changes
- Squire expeditions — no energy cost, no protocol changes
- `character.hp_changed` — unchanged payload shape, now also sent on heal item use
