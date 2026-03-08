# WebSocket Contract: Equipment System (011)

**Protocol version**: v1 (no version bump — additive change only)
**Branch**: `011-equipment-system`
**File**: `shared/protocol/index.ts` additions

All messages follow the existing `WsMessage<T>` envelope:
```
{ type: string, v: 1, payload: T }
```

---

## Shared Sub-types

### `EquipSlot`

```typescript
export type EquipSlot =
  | 'helmet'
  | 'chestplate'
  | 'left_arm'
  | 'right_arm'
  | 'greaves'
  | 'bracer'
  | 'boots';
```

### `EquipmentSlotsDto`

Maps each slot name to the currently equipped item, or `null` if the slot is empty.

```typescript
export interface EquipmentSlotsDto {
  helmet:     InventorySlotDto | null;
  chestplate: InventorySlotDto | null;
  left_arm:   InventorySlotDto | null;
  right_arm:  InventorySlotDto | null;
  greaves:    InventorySlotDto | null;
  bracer:     InventorySlotDto | null;
  boots:      InventorySlotDto | null;
}
```

---

## Client → Server Messages

### `equipment.equip`

Equip an item from the player's inventory into a specific slot.

```typescript
export interface EquipmentEquipPayload {
  slot_id:   number;    // inventory_items.id to equip
  slot_name: EquipSlot; // target equipment slot
}
```

**Validation rules (server-enforced)**:
- `slot_id` must be a positive integer.
- Item must exist in the player's inventory (`equipped_slot IS NULL`).
- `item_definitions.category` must match the accepted category for `slot_name`.
- If `slot_name === 'left_arm'`: the item in `right_arm` (if any) must not be a two-handed weapon.
- If equipping a two-handed weapon to `right_arm` and `left_arm` has a shield: the shield is auto-returned to inventory; this is blocked if unequipping the shield would push inventory count to 21+.
- If the target slot is occupied: the existing item is returned to inventory; this is blocked if returning it would push inventory count over 20 (non-equipped items).

### `equipment.unequip`

Unequip the item currently in the specified slot and return it to inventory.

```typescript
export interface EquipmentUnequipPayload {
  slot_name: EquipSlot; // slot to unequip
}
```

**Validation rules (server-enforced)**:
- `slot_name` must be a valid `EquipSlot`.
- The slot must currently have an item equipped.
- Non-equipped inventory count must be < 20 before unequip (space required for the returned item).

---

## Server → Client Messages

### `equipment.state`

Full equipment state sent on session start, alongside `inventory.state`. Also sent after the character's world state is established.

```typescript
export interface EquipmentStatePayload {
  slots: EquipmentSlotsDto;
}
```

### `equipment.changed`

Sent after any successful equip or unequip action. Carries the complete new equipment state, updated effective stats, and inventory changes so the client can update both panels atomically.

```typescript
export interface EquipmentChangedPayload {
  slots:             EquipmentSlotsDto;
  effective_attack:  number;   // base attack_power + sum of equipped attack bonuses
  effective_defence: number;   // base defence + sum of equipped defence bonuses
  // Inventory delta — items the frontend must add/remove from the inventory panel
  inventory_added:   InventorySlotDto[];   // items returned to inventory (previously equipped, now unequipped)
  inventory_removed: number[];             // slot_ids removed from free inventory (newly equipped items)
}
```

### `equipment.equip_rejected`

```typescript
export type EquipRejectReason =
  | 'ITEM_NOT_FOUND'      // slot_id not in player's inventory
  | 'WRONG_SLOT_TYPE'     // item category doesn't match slot
  | 'TWO_HANDED_BLOCKS'   // trying to equip shield while 2H weapon is in right_arm
  | 'INVENTORY_FULL'      // swap/auto-unequip would exceed 20-slot cap
  | 'NOT_AUTHENTICATED';  // character session not established

export interface EquipmentEquipRejectedPayload {
  slot_id:   number;
  slot_name: EquipSlot;
  reason:    EquipRejectReason;
}
```

### `equipment.unequip_rejected`

```typescript
export type UnequipRejectReason =
  | 'SLOT_EMPTY'          // nothing equipped in the requested slot
  | 'INVENTORY_FULL'      // no room to return item to inventory
  | 'NOT_AUTHENTICATED';

export interface EquipmentUnequipRejectedPayload {
  slot_name: EquipSlot;
  reason:    UnequipRejectReason;
}
```

---

## Changes to Existing Messages

### `InventoryStatePayload` (modified — backward-compatible)

No change to the TypeScript interface. Behavioural change: the server now **excludes equipped items** (`equipped_slot IS NOT NULL`) from the `slots` array. Clients that already handle fewer-than-20 slots are unaffected.

### `CharacterData` (modified — backward-compatible)

No change to the interface. Behavioural change: `attack_power` and `defence` fields in `CharacterData` now reflect **effective stats** (base + equipment bonuses) rather than base-only values. Clients consuming these fields gain accuracy automatically.

---

## Message Type Aliases (to add to `shared/protocol/index.ts`)

```typescript
export type EquipmentEquipMessage         = WsMessage<EquipmentEquipPayload>;
export type EquipmentUnequipMessage       = WsMessage<EquipmentUnequipPayload>;
export type EquipmentStateMessage         = WsMessage<EquipmentStatePayload>;
export type EquipmentChangedMessage       = WsMessage<EquipmentChangedPayload>;
export type EquipmentEquipRejectedMessage = WsMessage<EquipmentEquipRejectedPayload>;
export type EquipmentUnequipRejectedMessage = WsMessage<EquipmentUnequipRejectedPayload>;
```

Add to `AnyClientMessage` union:
```typescript
| EquipmentEquipMessage
| EquipmentUnequipMessage
```

Add to `AnyServerMessage` union:
```typescript
| EquipmentStateMessage
| EquipmentChangedMessage
| EquipmentEquipRejectedMessage
| EquipmentUnequipRejectedMessage
```
