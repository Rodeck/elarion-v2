# WebSocket Protocol Contract: NPC System

**Feature**: 014-npc-system
**Date**: 2026-03-09
**Protocol Version**: v1 (no envelope version bump — additive payload change)

## Summary of Changes

This feature extends the existing `world.state` message payload. No new message types are introduced. The `CityMapBuilding` object within the `buildings` array gains an `npcs` field.

NPC data is **read-only** from the client perspective — no new client→server messages are required for this feature. The NPC click interaction (future dialog) is out of scope.

---

## Modified Message: `world.state` (Server → Client)

### Envelope (unchanged)

```json
{
  "type": "world.state",
  "v": 1,
  "payload": { ... }
}
```

### Payload Change: `CityMapBuilding.npcs` field added

**Location in payload**: `payload.city_map.buildings[*].npcs`

**Before** (implicit — field was absent):
```json
{
  "id": 3,
  "name": "The Blacksmith",
  "description": "A sturdy forge...",
  "node_id": 12,
  "label_x": 0,
  "label_y": -20,
  "actions": [...],
  "hotspot": { "type": "rect", "x": 100, "y": 200, "w": 60, "h": 80 }
}
```

**After** (npcs field always present):
```json
{
  "id": 3,
  "name": "The Blacksmith",
  "description": "A sturdy forge...",
  "node_id": 12,
  "label_x": 0,
  "label_y": -20,
  "actions": [...],
  "hotspot": { "type": "rect", "x": 100, "y": 200, "w": 60, "h": 80 },
  "npcs": [
    {
      "id": 1,
      "name": "Garrett the Smith",
      "icon_url": "/npc-icons/a1b2c3d4-uuid.png"
    }
  ]
}
```

**Building with no NPCs**:
```json
{
  "id": 5,
  "name": "Town Gate",
  ...
  "npcs": []
}
```

### `NpcDto` Schema

| Field      | Type     | Description                                   |
|------------|----------|-----------------------------------------------|
| `id`       | `number` | NPC database ID                               |
| `name`     | `string` | Display name of the NPC                       |
| `icon_url` | `string` | Absolute URL path to the NPC's icon image     |

### TypeScript Interface (in `shared/protocol/index.ts`)

```typescript
export interface NpcDto {
  id: number;
  name: string;
  icon_url: string;
}

// CityMapBuilding — add npcs field
export interface CityMapBuilding {
  id: number;
  name: string;
  description: string;
  node_id: number;
  label_x: number;
  label_y: number;
  actions: BuildingActionDto[];
  hotspot?: {
    type: 'rect' | 'circle';
    x: number;
    y: number;
    w?: number;
    h?: number;
    r?: number;
  };
  npcs: NpcDto[];  // NEW — always present, empty array when no NPCs assigned
}
```

---

## Backward Compatibility

- **Protocol envelope**: Unchanged (`"v": 1`).
- **`npcs` field presence**: The field is **always present** in the `CityMapBuilding` object (never omitted). This prevents optional-chaining issues in the frontend. An empty array `[]` signals no NPCs.
- **Client impact**: Clients that do not yet render NPCs will safely receive the extra field and ignore it (TypeScript spreads or JSON parsing are unaffected).
- **Backend query change**: The backend `world.state` builder must JOIN `building_npcs` and `npcs` when constructing the buildings array. Existing integration tests that snapshot `world.state` will need updating to include the `npcs: []` field.

---

## Admin REST API Contracts

The admin panel communicates via REST (not WebSocket — admin operations are not game state). These are documented here for completeness.

### NPC Management (`admin/backend`)

#### `GET /api/npcs`
Returns all NPCs.

**Response** `200 OK`:
```json
[
  {
    "id": 1,
    "name": "Garrett the Smith",
    "description": "A veteran blacksmith...",
    "icon_url": "/npc-icons/abc.png",
    "created_at": "2026-03-09T10:00:00Z"
  }
]
```

#### `POST /api/npcs`
Create a new NPC. Icon must be uploaded separately first.

**Request body**:
```json
{
  "name": "Garrett the Smith",
  "description": "A veteran blacksmith...",
  "icon_filename": "abc123-uuid.png"
}
```

**Response** `201 Created`:
```json
{ "id": 1, "name": "Garrett the Smith", "description": "...", "icon_url": "/npc-icons/abc123-uuid.png" }
```

**Error** `400 Bad Request` (validation failure):
```json
{ "error": "NAME_REQUIRED" }
```

#### `PUT /api/npcs/:id`
Update an existing NPC.

**Request body**: Same shape as POST (all fields required).

**Response** `200 OK`: Updated NPC object.

**Error** `404 Not Found`:
```json
{ "error": "NPC_NOT_FOUND" }
```

#### `DELETE /api/npcs/:id`
Delete an NPC (cascades to remove all building assignments).

**Response** `204 No Content`

#### `POST /api/npcs/upload`
Upload a PNG icon for an NPC.

**Request**: `multipart/form-data` with `icon` file field.

**Response** `200 OK`:
```json
{ "icon_filename": "abc123-uuid.png", "icon_url": "/npc-icons/abc123-uuid.png" }
```

**Error** `400 Bad Request` (invalid format or size):
```json
{ "error": "INVALID_IMAGE" }
```

---

### Building NPC Assignment (`admin/backend`)

#### `GET /api/maps/:mapId/buildings/:buildingId/npcs`
List NPCs assigned to a building.

**Response** `200 OK`:
```json
[
  { "id": 1, "name": "Garrett the Smith", "icon_url": "/npc-icons/abc.png", "sort_order": 0 }
]
```

#### `POST /api/maps/:mapId/buildings/:buildingId/npcs`
Assign an NPC to a building.

**Request body**:
```json
{ "npc_id": 1 }
```

**Response** `201 Created`: The assignment row.

**Error** `409 Conflict` (already assigned):
```json
{ "error": "ALREADY_ASSIGNED" }
```

#### `DELETE /api/maps/:mapId/buildings/:buildingId/npcs/:npcId`
Remove an NPC assignment from a building.

**Response** `204 No Content`
