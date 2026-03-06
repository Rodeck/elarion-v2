# WebSocket Contract: Squire Expeditions
**Version**: 1.0 | **Protocol Version**: v=1 | **Branch**: `009-squire-expeditions`

All messages follow the existing envelope: `{ type: string, v: 1, payload: T }`.

---

## Client → Server

### `expedition.dispatch`

Sent when a player dispatches a squire on an expedition from a building.

**Payload**:
```typescript
interface ExpeditionDispatchPayload {
  building_id: number;    // ID of the building with the expedition action
  action_id: number;      // ID of the building_action (must be type 'expedition')
  duration_hours: 1 | 3 | 6;
}
```

**Server validations** (any failure → `expedition.dispatch_rejected`):
1. Player has a character
2. Character is on a city map
3. Character is not in combat
4. Character is at the building's node (`current_node_id === building.node_id`)
5. `action_id` belongs to `building_id` and has `action_type = 'expedition'`
6. `duration_hours` is 1, 3, or 6
7. Character has at least one idle squire (no uncollected expedition row)

---

### `expedition.collect`

Sent when a player collects rewards from a completed expedition at a building.

**Payload**:
```typescript
interface ExpeditionCollectPayload {
  expedition_id: number;
}
```

**Server validations** (any failure → `expedition.collect_rejected`):
1. Player has a character
2. Expedition row exists
3. `character_id` on expedition matches the requesting character
4. `completes_at <= now()` (expedition is complete)
5. `collected_at IS NULL` (not already collected)

---

## Server → Client

### `expedition.dispatched`

Confirms successful squire dispatch.

```typescript
interface ExpeditionDispatchedPayload {
  expedition_id: number;
  squire_name: string;
  building_name: string;
  duration_hours: 1 | 3 | 6;
  completes_at: string;  // ISO 8601 UTC timestamp
}
```

---

### `expedition.dispatch_rejected`

Sent when dispatch validation fails.

```typescript
interface ExpeditionDispatchRejectedPayload {
  reason:
    | 'NO_SQUIRE_AVAILABLE'   // all squires are currently exploring
    | 'INVALID_DURATION'      // duration_hours not in [1, 3, 6]
    | 'NOT_AT_BUILDING'       // character is not at the specified building
    | 'NO_EXPEDITION_CONFIG'  // action_id not found or not type 'expedition'
    | 'IN_COMBAT'             // character is in combat
    | 'NOT_CITY_MAP';         // character not on a city map
}
```

---

### `expedition.completed`

Pushed to the player when a squire's expedition has finished and has not yet been
notified. Sent during `sendWorldState` on every player connect/reconnect.
Multiple may be sent if multiple completions are pending.

```typescript
interface ExpeditionCompletedPayload {
  expedition_id: number;
  squire_name: string;
  building_name: string;
}
```

**Frontend behavior**: Display as a system message in the chat log, e.g.:
> "Squire Aldric has finished exploring at The Wanderer's Inn. Visit to collect rewards."

---

### `expedition.collect_result`

Confirms successful reward collection.

```typescript
interface ExpeditionCollectResultPayload {
  squire_name: string;
  rewards: {
    gold: number;
    exp: number;
    items: {
      item_def_id: number;
      name: string;
      quantity: number;
    }[];
  };
  items_skipped: boolean;  // true if any items could not be granted (inventory full)
}
```

Note: gold and exp are always credited in full regardless of inventory state.
Each item that fits is granted via the existing `inventory.item_received` message.
Items that don't fit emit `inventory.full`.

---

### `expedition.collect_rejected`

Sent when collect validation fails.

```typescript
interface ExpeditionCollectRejectedPayload {
  expedition_id: number;
  reason:
    | 'NOT_FOUND'          // expedition_id does not exist
    | 'NOT_OWNER'          // expedition belongs to a different character
    | 'NOT_COMPLETE'       // completes_at is still in the future
    | 'ALREADY_COLLECTED'; // collected_at is not null
}
```

---

## Modified Payload: `city.building_arrived`

The existing `CityBuildingArrivedPayload` gains an optional `expedition_state` field
populated only when the building has an active expedition action.

```typescript
// Existing fields unchanged:
interface CityBuildingArrivedPayload {
  building_id: number;
  building_name: string;
  node_id: number;

  // NEW: only present when building has an expedition action
  expedition_state?: ExpeditionStateDto;
}

type SquireStatus = 'idle' | 'exploring' | 'ready';

interface ExpeditionStateDto {
  action_id: number;
  squire_name: string;
  squire_status: SquireStatus;

  // When status === 'exploring'
  expedition_id?: number;
  completes_at?: string;  // ISO 8601

  // When status === 'ready'
  expedition_id?: number;
  collectable_rewards?: {
    gold: number;
    exp: number;
    items: { name: string; quantity: number }[];
  };

  // When status === 'idle' — duration options with estimated rewards
  duration_options?: {
    duration_hours: 1 | 3 | 6;
    est_gold: number;
    est_exp: number;
    items: { name: string; quantity: number }[];
  }[];
}
```

---

## Admin REST: New Expedition Action Type

The existing `POST /maps/:id/buildings/:buildingId/actions` endpoint is extended
to accept `action_type: "expedition"`.

**Request body** (when `action_type = "expedition"`):
```json
{
  "action_type": "expedition",
  "sort_order": 0,
  "config": {
    "base_gold": 50,
    "base_exp": 100,
    "items": [
      { "item_def_id": 3, "base_quantity": 2 }
    ]
  }
}
```

**Validations**:
- `base_gold` — integer ≥ 0
- `base_exp` — integer ≥ 0
- `items` — array (may be empty)
  - `item_def_id` — must reference a valid `item_definitions` row
  - `base_quantity` — integer ≥ 1

`PUT /maps/:id/buildings/:buildingId/actions/:actionId` also extended to allow
updating expedition configs.

---

## Protocol Backward Compatibility

- All new message types are additive — no existing messages are removed or changed
  (other than adding the optional `expedition_state` to `city.building_arrived`).
- Clients that do not handle the new messages will silently ignore them (existing
  dispatch pattern).
- The optional `expedition_state` field on `city.building_arrived` is safe for older
  clients that destructure only `building_id`, `building_name`, and `node_id`.
