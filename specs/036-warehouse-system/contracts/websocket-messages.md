# WebSocket Message Contract: Warehouse System

**Feature**: 036-warehouse-system  
**Protocol Version**: Extends existing v1 envelope

## Message Types

### Client → Server

#### `warehouse.deposit`
Transfer an item from inventory to warehouse.

```typescript
interface WarehouseDepositPayload {
  building_id: number;
  inventory_slot_id: number;  // inventory_items.id
  quantity: number;           // how many to deposit (for partial stack)
}
```

#### `warehouse.withdraw`
Transfer an item from warehouse to inventory.

```typescript
interface WarehouseWithdrawPayload {
  building_id: number;
  warehouse_slot_id: number;  // warehouse_items.id
  quantity: number;            // how many to withdraw (for partial stack)
}
```

#### `warehouse.bulk_to_inventory`
Move all warehouse items to inventory.

```typescript
interface WarehouseBulkToInventoryPayload {
  building_id: number;
}
```

#### `warehouse.bulk_to_warehouse`
Move all inventory items to warehouse.

```typescript
interface WarehouseBulkToWarehousePayload {
  building_id: number;
}
```

#### `warehouse.merge`
Move inventory items to warehouse where matching item types already exist.

```typescript
interface WarehouseMergePayload {
  building_id: number;
}
```

#### `warehouse.buy_slot`
Purchase one additional warehouse slot.

```typescript
interface WarehouseBuySlotPayload {
  building_id: number;
}
```

### Server → Client

#### `warehouse.state`
Full warehouse state — sent on open and after every operation.

```typescript
interface WarehouseStatePayload {
  building_id: number;
  slots: WarehouseSlotDto[];
  total_capacity: number;       // 15 + extra_slots
  used_slots: number;
  extra_slots_purchased: number;
  next_slot_cost: number;       // crowns for next purchase
}

interface WarehouseSlotDto {
  slot_id: number;              // warehouse_items.id
  item_def_id: number;
  quantity: number;
  current_durability?: number | null;
  definition: ItemDefinitionDto;
  instance_attack?: number | null;
  instance_defence?: number | null;
  instance_crit_chance?: number | null;
  instance_additional_attacks?: number | null;
  instance_armor_penetration?: number | null;
  instance_max_mana?: number | null;
  instance_mana_on_hit?: number | null;
  instance_mana_regen?: number | null;
  quality_tier?: QualityTier | null;
  quality_label?: string | null;
}
```

#### `warehouse.buy_slot_result`
Result of slot purchase.

```typescript
interface WarehouseBuySlotResultPayload {
  success: boolean;
  new_total_capacity: number;
  extra_slots_purchased: number;
  next_slot_cost: number;
  new_crowns: number;           // updated crown balance
}
```

#### `warehouse.rejected`
Server rejection for any warehouse operation.

```typescript
interface WarehouseRejectedPayload {
  reason: 'warehouse_full' | 'inventory_full' | 'insufficient_crowns' 
        | 'item_not_found' | 'not_at_warehouse' | 'invalid_quantity'
        | 'equipped_item';
  message: string;              // human-readable message
}
```

#### `warehouse.bulk_result`
Result of a bulk transfer operation.

```typescript
interface WarehouseBulkResultPayload {
  transferred_count: number;    // items successfully moved
  skipped_count: number;        // items that couldn't move (no space)
  partial: boolean;             // true if some items couldn't transfer
}
```

## Message Flow

### Open Warehouse
```
Client: 'city:building_action' {building_id, action_id, action_type: 'warehouse'}
Server: 'warehouse.state' {building_id, slots, total_capacity, ...}
```

### Deposit Item
```
Client: 'warehouse.deposit' {building_id, inventory_slot_id, quantity}
Server: 'warehouse.state' {updated state}
Server: 'inventory:state' {updated inventory}
  — OR —
Server: 'warehouse.rejected' {reason, message}
```

### Withdraw Item
```
Client: 'warehouse.withdraw' {building_id, warehouse_slot_id, quantity}
Server: 'warehouse.state' {updated state}
Server: 'inventory:state' {updated inventory}
  — OR —
Server: 'warehouse.rejected' {reason, message}
```

### Bulk Transfer
```
Client: 'warehouse.bulk_to_inventory' | 'warehouse.bulk_to_warehouse' | 'warehouse.merge'
Server: 'warehouse.state' {updated state}
Server: 'inventory:state' {updated inventory}
Server: 'warehouse.bulk_result' {transferred_count, skipped_count, partial}
```

### Buy Slot
```
Client: 'warehouse.buy_slot' {building_id}
Server: 'warehouse.buy_slot_result' {success, new_total_capacity, ...}
Server: 'warehouse.state' {updated state with new capacity}
  — OR —
Server: 'warehouse.rejected' {reason: 'insufficient_crowns', message}
```

## Backward Compatibility

- New message types only — no modifications to existing messages.
- Existing `city:building_action` dispatch extended with new `'warehouse'` branch.
- Clients that don't understand `warehouse.*` messages will ignore them (standard behavior).
