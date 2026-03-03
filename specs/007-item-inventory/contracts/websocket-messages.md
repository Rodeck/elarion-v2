# WebSocket Contracts: Item and Inventory System (007)

**Branch**: `007-item-inventory` | **Protocol Version**: v1 (no version bump — additive only) | **Date**: 2026-03-03

All messages follow the existing envelope: `{ type: string, v: 1, payload: T }`.

Shared type definitions live in `shared/protocol/index.ts`.

---

## New Shared Types

```typescript
// shared/protocol/index.ts — additions

export type ItemCategory =
  | 'resource' | 'food' | 'heal' | 'weapon'
  | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool';

export type WeaponSubtype =
  | 'one_handed' | 'two_handed' | 'dagger' | 'wand' | 'staff' | 'bow';

/** A single resolved item definition as sent to the client. */
export interface ItemDefinitionDto {
  id: number;
  name: string;
  description: string;        // empty string if null in DB
  category: ItemCategory;
  weapon_subtype: WeaponSubtype | null;  // non-null only for 'weapon'
  attack: number | null;
  defence: number | null;
  heal_power: number | null;
  food_power: number | null;
  stack_size: number | null;  // null = not stackable
  icon_url: string | null;    // absolute URL or null (use placeholder)
}

/** A single occupied inventory slot as sent to the client. */
export interface InventorySlotDto {
  slot_id: number;            // inventory_items.id — used for deletion
  item_def_id: number;
  quantity: number;
  definition: ItemDefinitionDto;
}
```

---

## Message Catalog

### Server → Client: `inventory.state`

**Purpose**: Full inventory snapshot. Sent immediately after `world.state` on every connection/reconnection. The client initialises (or re-initialises) the inventory panel from this message.

**Trigger**: `sendWorldState()` in `world-state-handler.ts`

**Handler file**: `backend/src/websocket/handlers/inventory-state-handler.ts` (new)

```typescript
// Payload type (add to shared/protocol/index.ts)
export interface InventoryStatePayload {
  slots: InventorySlotDto[];  // ordered by created_at ASC; max 20 entries
  capacity: number;           // always 20 for now
}
```

**Example**:
```json
{
  "type": "inventory.state",
  "v": 1,
  "payload": {
    "capacity": 20,
    "slots": [
      {
        "slot_id": 42,
        "item_def_id": 3,
        "quantity": 5,
        "definition": {
          "id": 3,
          "name": "Healing Potion",
          "description": "Restores 50 HP.",
          "category": "heal",
          "weapon_subtype": null,
          "attack": null,
          "defence": null,
          "heal_power": 50,
          "food_power": null,
          "stack_size": 10,
          "icon_url": "http://localhost:4001/item-icons/abc123.png"
        }
      },
      {
        "slot_id": 43,
        "item_def_id": 7,
        "quantity": 1,
        "definition": {
          "id": 7,
          "name": "Iron Sword",
          "description": "A sturdy one-handed sword.",
          "category": "weapon",
          "weapon_subtype": "one_handed",
          "attack": 15,
          "defence": null,
          "heal_power": null,
          "food_power": null,
          "stack_size": null,
          "icon_url": "http://localhost:4001/item-icons/def456.png"
        }
      }
    ]
  }
}
```

---

### Server → Client: `inventory.item_received`

**Purpose**: Notify the client that a new item was added to (or stacked in) the inventory. The client adds or updates the slot in its local inventory state.

**Trigger**: Any backend path that grants an item to a player (e.g., building action reward, future combat loot).

```typescript
export interface InventoryItemReceivedPayload {
  slot: InventorySlotDto;     // full slot (new or updated)
  stacked: boolean;           // true if quantity was incremented on an existing slot
}
```

**Behaviour on client**:
- If `stacked: true` → find existing slot by `slot_id`, update `quantity`.
- If `stacked: false` → append new slot to inventory grid.

---

### Server → Client: `inventory.full`

**Purpose**: Inform the player their inventory is full and the item could not be received.

**Trigger**: Inventory count = 20 and no stackable slot available.

```typescript
export interface InventoryFullPayload {
  item_name: string;  // name of the item that couldn't be added
}
```

**Behaviour on client**: Display a transient notification (e.g., "Inventory full — could not receive Iron Sword").

---

### Client → Server: `inventory.delete_item`

**Purpose**: Player requests to permanently delete one item slot from their inventory.

**Handler file**: `backend/src/game/inventory/inventory-delete-handler.ts` (new)

**Registration**: `registerHandler('inventory.delete_item', handleInventoryDeleteItem)` in `backend/src/index.ts`

```typescript
export interface InventoryDeleteItemPayload {
  slot_id: number;   // inventory_items.id to delete
}
```

**Server validation gates** (sequential, early exit):
1. Session must have authenticated character.
2. `slot_id` must be a positive integer.
3. Row `inventory_items WHERE id = slot_id AND character_id = characterId` must exist.
4. Delete the row.

---

### Server → Client: `inventory.item_deleted`

**Purpose**: Confirm that the item slot was deleted. Client removes the slot from the inventory grid.

```typescript
export interface InventoryItemDeletedPayload {
  slot_id: number;  // the slot that was removed
}
```

---

### Server → Client: `inventory.delete_rejected`

**Purpose**: Deletion failed. Client re-enables the delete button and shows an error.

```typescript
export interface InventoryDeleteRejectedPayload {
  slot_id: number;
  reason: 'NOT_FOUND' | 'NOT_OWNER';
}
```

---

## Message Flow Diagram

```
CLIENT                          SERVER
  |                               |
  |--- (connect / reconnect) ---->|
  |                               |--- world.state -------->|
  |<--- world.state --------------|                          |
  |<--- inventory.state --------------- (immediately after world.state)
  |                               |
  |--- inventory.delete_item ---->|
  |                               |-- validate ownership -->|
  |<--- inventory.item_deleted ---|  (success)              |
  |<--- inventory.delete_rejected |  (failure)              |
  |                               |
  |       [item granted by game mechanism]                  |
  |<--- inventory.item_received --|  (if space available)   |
  |<--- inventory.full ---------- |  (if no space)          |
```

---

## Protocol Compatibility

All new message types are **additive**. Existing clients that do not register handlers for `inventory.*` messages will simply ignore them (handled by `WSClient.on()` — unknown types drop silently). No `v` version bump required.

Future changes that modify existing message payload shapes MUST increment the protocol version and add a migration note here.
