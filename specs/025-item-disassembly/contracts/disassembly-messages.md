# WebSocket Contract: Disassembly Messages

**Feature Branch**: `025-item-disassembly`
**Protocol Version**: v1
**Domain**: `disassembly.*`

## Message Types

### Client → Server

#### `disassembly.open`

Sent when player clicks "Disassemble" in NPC dialog. Server responds with the NPC's disassembly availability confirmation.

```typescript
// Payload
interface DisassemblyOpenPayload {
  npc_id: number;
}
```

#### `disassembly.preview`

Sent when items are added/removed from the disassembly grid. Server responds with computed output summary.

```typescript
// Payload
interface DisassemblyPreviewPayload {
  npc_id: number;
  slot_ids: number[];       // inventory_items.id for each grid slot
  kiln_slot_id: number;     // inventory_items.id of selected kiln
}
```

#### `disassembly.execute`

Sent when player clicks "Disassemble" button. Server validates and performs atomic disassembly.

```typescript
// Payload
interface DisassemblyExecutePayload {
  npc_id: number;
  slot_ids: number[];       // inventory_items.id for each grid slot
  kiln_slot_id: number;     // inventory_items.id of selected kiln
}
```

### Server → Client

#### `disassembly.state`

Response to `disassembly.open`. Confirms NPC is a valid disassembler.

```typescript
// Payload
interface DisassemblyStatePayload {
  npc_id: number;
}
```

#### `disassembly.preview_result`

Response to `disassembly.preview`. Shows computed output summary.

```typescript
// Payload
interface DisassemblyPreviewResultPayload {
  possible_outputs: DisassemblyOutputPreview[];
  total_cost: number;           // total crowns cost
  total_item_count: number;     // sum of all stack quantities
  max_output_slots: number;     // max possible output item count (for inventory check)
}

interface DisassemblyOutputPreview {
  item_def_id: number;
  item_name: string;
  icon_url: string | null;
  min_quantity: number;
  max_quantity: number;
}
```

#### `disassembly.result`

Response to successful `disassembly.execute`.

```typescript
// Payload
interface DisassemblyResultPayload {
  received_items: DisassemblyReceivedItem[];
  new_crowns: number;                     // player's updated crown balance
  updated_slots: InventorySlotDto[];      // updated/new inventory slots
  removed_slot_ids: number[];             // consumed input item slot IDs
  kiln_slot: InventorySlotDto | null;     // updated kiln (null if destroyed)
}

interface DisassemblyReceivedItem {
  item_def_id: number;
  item_name: string;
  icon_url: string | null;
  quantity: number;
}
```

#### `disassembly.rejected`

Response to any failed disassembly action.

```typescript
// Payload
interface DisassemblyRejectedPayload {
  action: 'open' | 'preview' | 'execute';
  reason: DisassemblyRejectionReason;
  details?: string;
}

type DisassemblyRejectionReason =
  | 'NO_CHARACTER'
  | 'NPC_NOT_FOUND'
  | 'NPC_NOT_DISASSEMBLER'
  | 'NOT_AT_BUILDING'
  | 'IN_COMBAT'
  | 'NO_KILN'
  | 'INSUFFICIENT_KILN_DURABILITY'
  | 'INSUFFICIENT_CROWNS'
  | 'INSUFFICIENT_INVENTORY_SPACE'
  | 'ITEM_NOT_DISASSEMBLABLE'
  | 'INVALID_ITEM'
  | 'GRID_EMPTY';
```

## Message Flow

### Happy Path

```
Client                          Server
  │                               │
  ├─ disassembly.open ──────────>│  (player clicks NPC dialog)
  │<──────── disassembly.state ──┤  (confirm NPC valid)
  │                               │
  ├─ disassembly.preview ───────>│  (items added to grid)
  │<── disassembly.preview_result┤  (output summary)
  │                               │
  ├─ disassembly.preview ───────>│  (more items added/removed)
  │<── disassembly.preview_result┤  (updated summary)
  │                               │
  ├─ disassembly.execute ───────>│  (player confirms)
  │<──── disassembly.result ─────┤  (items consumed, outputs granted)
  │                               │
```

### Error Path

```
Client                          Server
  │                               │
  ├─ disassembly.execute ───────>│  (player confirms)
  │<── disassembly.rejected ─────┤  (reason: INSUFFICIENT_CROWNS)
  │                               │
```

## Backward Compatibility

- New message domain (`disassembly.*`) — no existing messages affected.
- New NPC flag (`is_disassembler`) defaults to `false` — no existing NPCs affected.
- New `disassembly_cost` column defaults to `0` — no existing items affected.
- New `tool_type` value (`'kiln'`) — no existing tools affected.
