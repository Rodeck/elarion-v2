# WebSocket Contract: Crafting System

**Feature**: 017-crafting-system | **Protocol Version**: v1 | **Date**: 2026-03-17

## Message Types

### Client → Server

#### `crafting.open`

Request the list of recipes and active sessions for an NPC.

```typescript
// Client sends:
{
  type: 'crafting.open',
  v: 1,
  payload: {
    npc_id: number;       // NPC the player is interacting with
  }
}
```

**Validation**: Player must be at a building containing this NPC. NPC must have `is_crafter = true`.

---

#### `crafting.start`

Start crafting a recipe.

```typescript
// Client sends:
{
  type: 'crafting.start',
  v: 1,
  payload: {
    npc_id: number;       // NPC to craft at
    recipe_id: number;    // Recipe to craft
    quantity: number;      // Number of units (positive integer)
  }
}
```

**Validation**:
- Player at correct building/NPC
- NPC is a crafter with this recipe
- Player has sufficient materials (unequipped inventory only)
- Player has sufficient crowns
- No active session for this recipe at this NPC
- Quantity is a positive integer

---

#### `crafting.cancel`

Cancel an in-progress crafting session.

```typescript
// Client sends:
{
  type: 'crafting.cancel',
  v: 1,
  payload: {
    session_id: number;   // Crafting session to cancel
  }
}
```

**Validation**:
- Session belongs to this player
- Session status is 'in_progress'
- Player has inventory space for refunded materials

---

#### `crafting.collect`

Collect finished crafted items.

```typescript
// Client sends:
{
  type: 'crafting.collect',
  v: 1,
  payload: {
    session_id: number;   // Crafting session to collect
  }
}
```

**Validation**:
- Session belongs to this player
- Session status is 'completed' (or elapsed time indicates completion)
- Player has sufficient inventory space for output items

---

### Server → Client

#### `crafting.state`

Full crafting state for an NPC (response to `crafting.open`).

```typescript
{
  type: 'crafting.state',
  v: 1,
  payload: {
    npc_id: number;
    recipes: CraftingRecipeDto[];
    active_sessions: CraftingSessionDto[];
  }
}
```

---

#### `crafting.started`

Confirmation that crafting has begun (response to `crafting.start`).

```typescript
{
  type: 'crafting.started',
  v: 1,
  payload: {
    session: CraftingSessionDto;
    new_crowns: number;               // Updated crown balance
    updated_slots: InventorySlotDto[]; // Updated inventory slots (after material deduction)
  }
}
```

---

#### `crafting.cancelled`

Confirmation of cancellation with refund details (response to `crafting.cancel`).

```typescript
{
  type: 'crafting.cancelled',
  v: 1,
  payload: {
    session_id: number;
    refunded_crowns: number;
    refunded_items: { item_def_id: number; quantity: number }[];
    new_crowns: number;
    updated_slots: InventorySlotDto[];
  }
}
```

---

#### `crafting.collected`

Confirmation of item collection (response to `crafting.collect`).

```typescript
{
  type: 'crafting.collected',
  v: 1,
  payload: {
    session_id: number;
    items_received: { item_def_id: number; quantity: number }[];
    updated_slots: InventorySlotDto[];
  }
}
```

---

#### `crafting.rejected`

Rejection of any crafting action with reason.

```typescript
{
  type: 'crafting.rejected',
  v: 1,
  payload: {
    action: 'open' | 'start' | 'cancel' | 'collect';
    reason: CraftingRejectionReason;
    details?: string;   // Human-readable explanation
  }
}
```

**Rejection reasons**:
```typescript
type CraftingRejectionReason =
  | 'NOT_AT_NPC'
  | 'NPC_NOT_CRAFTER'
  | 'RECIPE_NOT_FOUND'
  | 'INSUFFICIENT_MATERIALS'
  | 'INSUFFICIENT_CROWNS'
  | 'ALREADY_CRAFTING'
  | 'INVALID_QUANTITY'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_IN_PROGRESS'
  | 'SESSION_NOT_COMPLETED'
  | 'INVENTORY_FULL'
  | 'ITEM_DEF_NOT_FOUND';
```

---

#### `crafting.sessions_updated`

Sent when admin force-finishes sessions (player may be online).

```typescript
{
  type: 'crafting.sessions_updated',
  v: 1,
  payload: {
    finished_count: number;
    message: string;
  }
}
```

---

## DTO Definitions

### CraftingRecipeDto

```typescript
interface CraftingRecipeDto {
  id: number;
  npc_id: number;
  name: string;
  description: string | null;
  output_item: ItemDefinitionDto;
  output_quantity: number;
  cost_crowns: number;
  craft_time_seconds: number;
  ingredients: CraftingIngredientDto[];
}
```

### CraftingIngredientDto

```typescript
interface CraftingIngredientDto {
  item_def_id: number;
  item_name: string;
  item_icon_url: string;
  quantity: number;          // Per 1x craft
}
```

### CraftingSessionDto

```typescript
interface CraftingSessionDto {
  id: number;
  recipe_id: number;
  npc_id: number;
  quantity: number;
  started_at: string;         // ISO 8601 timestamp
  total_duration_seconds: number;
  status: 'in_progress' | 'completed';
  progress_percent: number;   // 0–100, computed server-side
  remaining_seconds: number;  // 0 if completed, computed server-side
}
```

## Backward Compatibility

- **New message types only**: No existing messages are modified.
- **NPC DTO extension**: `NpcDto` gains optional `is_crafter: boolean` field (defaults to `false` if absent — backward compatible).
- **Protocol version**: Remains `v: 1`. New message types are additive.
