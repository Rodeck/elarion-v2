# WebSocket Contract: Stat Training Messages

**Date**: 2026-04-02 | **Branch**: `031-stat-training` | **Protocol Version**: v1

## Client → Server Messages

### `stat-training.open`

Opens the stat training interface for a specific trainer NPC.

**Payload**:
```typescript
interface StatTrainingOpenPayload {
  npc_id: number;  // ID of the trainer NPC
}
```

**Preconditions**:
- Player must have an active character
- NPC must exist and have `trainer_stat` set (non-null)
- Player must not be in combat

**Server Response**: `stat-training.state`

---

### `stat-training.attempt`

Attempts to train a stat by consuming one training item.

**Payload**:
```typescript
interface StatTrainingAttemptPayload {
  npc_id: number;      // ID of the trainer NPC
  item_def_id: number; // ID of the training item to consume
}
```

**Preconditions**:
- Player must have an active character
- NPC must exist and have `trainer_stat` set
- Player must not be in combat
- Item must be a valid training item for this NPC (exists in `stat_training_items` with matching npc_id)
- Player must own at least 1x of the item in inventory
- Player's stat must be below the per-stat cap (`10 * (level - 1)`)

**Server Response**: `stat-training.result` followed by `stat-training.state`

---

## Server → Client Messages

### `stat-training.state`

Sent after `stat-training.open` or after a training attempt. Contains the current training state.

**Payload**:
```typescript
interface StatTrainingStatePayload {
  stat_name: string;           // 'constitution' | 'strength' | 'intelligence' | 'dexterity' | 'toughness'
  current_value: number;       // Current stat value (allocated + trained)
  per_stat_cap: number;        // Maximum value for this stat at current level
  level: number;               // Character level (for display)
  items: StatTrainingItemDto[]; // Available training items the player owns
}

interface StatTrainingItemDto {
  item_def_id: number;
  name: string;
  icon_url: string | null;
  tier: number;              // 1, 2, or 3
  success_chance: number;    // Computed percentage (5-95), already accounting for level
  owned_quantity: number;    // How many the player currently has
}
```

---

### `stat-training.result`

Sent after a training attempt with the outcome.

**Payload**:
```typescript
interface StatTrainingResultPayload {
  success: boolean;
  stat_name: string;
  new_value: number;         // Updated stat value (same as before if failed)
  message: string;           // Human-readable result message
}
```

---

### `stat-training.error`

Sent when a training action is rejected.

**Payload**:
```typescript
interface StatTrainingErrorPayload {
  message: string;  // Human-readable error description
}
```

**Error Messages**:
- `"No character."` — no active character on session
- `"This NPC does not offer stat training."` — NPC has no `trainer_stat`
- `"Cannot train while in combat."` — player is in combat
- `"Your [stat] has reached its maximum for your level."` — stat at cap
- `"You don't have that item."` — item not in inventory
- `"That item cannot be used for training here."` — item not mapped to this NPC
- `"Training is available from level 2."` — level 1 character (cap is 0)

---

## Message Flow Diagrams

### Happy Path: Successful Training
```
Client                          Server
  │                               │
  ├──stat-training.open──────────►│  Validate NPC, query items
  │                               │
  │◄──stat-training.state─────────┤  Send stat info + item list
  │                               │
  ├──stat-training.attempt───────►│  Validate, consume item, roll RNG
  │                               │  (success) increment stat, recalc
  │◄──stat-training.result────────┤  {success: true, new_value: N+1}
  │◄──stat-training.state─────────┤  Updated state (new value, qty-1)
  │                               │
```

### Rejection: Stat at Cap
```
Client                          Server
  │                               │
  ├──stat-training.attempt───────►│  Check stat vs cap → at cap
  │                               │  (NO item consumed)
  │◄──stat-training.error─────────┤  "Your strength has reached..."
  │                               │
```

### Rejection: No Item
```
Client                          Server
  │                               │
  ├──stat-training.attempt───────►│  Check inventory → 0 quantity
  │                               │  (NO item consumed)
  │◄──stat-training.error─────────┤  "You don't have that item."
  │                               │
```
