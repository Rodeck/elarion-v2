# WebSocket Message Contracts: City Map System

**Feature Branch**: `003-city-map-system`
**Protocol Version**: `v: 1` (backward compatible extension)
**Date**: 2026-03-02

## Modified Messages

### `world.state` (Server → Client) — EXTENDED

Existing payload fields are unchanged. A new optional `city_map` field is added when the zone has `map_type = 'city'`.

```typescript
interface WorldStatePayload {
  // ... existing fields unchanged ...
  zone_id: number;
  zone_name: string;
  map_type: 'tile' | 'city';           // NEW
  my_character: CharacterData;          // EXTENDED: adds current_node_id
  players: PlayerSummary[];
  monsters: MonsterSummary[];           // empty array for city maps

  // NEW — present only when map_type === 'city'
  city_map?: {
    image_url: string;                  // URL to fetch the background PNG
    image_width: number;                // px
    image_height: number;               // px
    nodes: CityMapNode[];
    edges: CityMapEdge[];
    buildings: CityMapBuilding[];
    spawn_node_id: number;
  };
}

interface CityMapNode {
  id: number;
  x: number;                            // px position on image
  y: number;
}

interface CityMapEdge {
  from_node_id: number;
  to_node_id: number;
}

interface CityMapBuilding {
  id: number;
  name: string;
  node_id: number;                      // associated path node
  label_x: number;                      // label position (absolute px)
  label_y: number;
  hotspot?: {
    type: 'rect' | 'circle';
    x: number;
    y: number;
    w?: number;                         // rect only
    h?: number;                         // rect only
    r?: number;                         // circle only
  };
}
```

### `CharacterData` — EXTENDED

```typescript
interface CharacterData {
  // ... existing fields unchanged ...
  current_node_id: number | null;       // NEW — non-null when on a city map
}
```

## New Messages

### `city.move` (Client → Server)

Player requests movement to a target node on a city map.

```typescript
// type: 'city.move', v: 1
interface CityMovePayload {
  target_node_id: number;
}
```

**Server validation**:
1. Player must be on a city-type map
2. Player must not be in combat
3. `target_node_id` must exist in the player's current zone
4. A path must exist from the player's `current_node_id` to `target_node_id` (BFS)
5. Rate limiting applied (same as existing movement)

**Server behavior on success**:
1. Compute shortest path (BFS): `[current_node, ..., target_node]`
2. For each node in path (after current):
   a. Update `characters.current_node_id` to this node
   b. Broadcast `city.player_moved` to all zone players
   c. If node is a building node, send `city.building_arrived` to the moving player
3. Movement speed: configurable delay between nodes (default 300ms)

### `city.player_moved` (Server → Client)

Broadcast to all players in the zone when any player moves to a new node.

```typescript
// type: 'city.player_moved', v: 1
interface CityPlayerMovedPayload {
  character_id: string;
  node_id: number;                      // the node the player just arrived at
  x: number;                            // node's x position (px) for rendering
  y: number;                            // node's y position (px) for rendering
}
```

### `city.building_arrived` (Server → Client)

Sent only to the moving player when they arrive at a building node.

```typescript
// type: 'city.building_arrived', v: 1
interface CityBuildingArrivedPayload {
  building_id: number;
  building_name: string;
  node_id: number;
}
```

### `city.move_rejected` (Server → Client)

Sent to the requesting player when movement is rejected.

```typescript
// type: 'city.move_rejected', v: 1
interface CityMoveRejectedPayload {
  current_node_id: number;
  reason: 'NO_PATH' | 'INVALID_NODE' | 'IN_COMBAT' | 'NOT_CITY_MAP' | 'RATE_LIMITED';
}
```

## Admin REST API Contracts

**Base URL**: `http://localhost:4001/api`
**Auth**: `Authorization: Bearer <jwt>` header with `is_admin = true` account

### Maps

| Method | Path            | Body                                                     | Response                              |
| ------ | --------------- | -------------------------------------------------------- | ------------------------------------- |
| GET    | `/maps`         | —                                                        | `{ maps: MapSummary[] }`              |
| GET    | `/maps/:id`     | —                                                        | `{ map: MapFull }`                    |
| POST   | `/maps`         | `{ name, image_width_px, image_height_px }`              | `{ map: MapFull }`                    |
| PUT    | `/maps/:id`     | `{ name?, image_width_px?, image_height_px? }`           | `{ map: MapFull }`                    |
| DELETE | `/maps/:id`     | —                                                        | `{ success: true }`                   |

### Map Image Upload

| Method | Path                    | Body                  | Response                              |
| ------ | ----------------------- | --------------------- | ------------------------------------- |
| POST   | `/maps/:id/image`       | `multipart/form-data` (field: `image`, PNG, max 10MB) | `{ image_url: string }` |

### Nodes

| Method | Path                         | Body                | Response                  |
| ------ | ---------------------------- | ------------------- | ------------------------- |
| GET    | `/maps/:id/nodes`            | —                   | `{ nodes: PathNode[] }`   |
| POST   | `/maps/:id/nodes`            | `{ x, y, is_spawn? }` | `{ node: PathNode }`   |
| PUT    | `/maps/:id/nodes/:nodeId`    | `{ x?, y?, is_spawn? }` | `{ node: PathNode }` |
| DELETE | `/maps/:id/nodes/:nodeId`    | —                   | `{ success: true }`       |

### Edges

| Method | Path                         | Body                          | Response                  |
| ------ | ---------------------------- | ----------------------------- | ------------------------- |
| GET    | `/maps/:id/edges`            | —                             | `{ edges: PathEdge[] }`   |
| POST   | `/maps/:id/edges`            | `{ from_node_id, to_node_id }` | `{ edge: PathEdge }`   |
| DELETE | `/maps/:id/edges/:edgeId`    | —                             | `{ success: true }`       |

### Buildings

| Method | Path                              | Body                                                                        | Response                      |
| ------ | --------------------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| GET    | `/maps/:id/buildings`             | —                                                                           | `{ buildings: Building[] }`   |
| POST   | `/maps/:id/buildings`             | `{ node_id, name, label_offset_x?, label_offset_y?, hotspot? }`            | `{ building: Building }`      |
| PUT    | `/maps/:id/buildings/:buildingId` | `{ name?, node_id?, label_offset_x?, label_offset_y?, hotspot? }`          | `{ building: Building }`      |
| DELETE | `/maps/:id/buildings/:buildingId` | —                                                                           | `{ success: true }`           |

### Map Validation

| Method | Path                      | Body | Response                                                |
| ------ | ------------------------- | ---- | ------------------------------------------------------- |
| POST   | `/maps/:id/validate`      | —    | `{ valid: boolean, errors: string[] }`                  |

Validation checks:
- At least one node exists
- Exactly one spawn node is set
- Path graph is connected (BFS from spawn reaches all nodes)
- All buildings have a valid `node_id`

### Response Types

```typescript
interface MapSummary {
  id: number;
  name: string;
  map_type: 'city';
  image_filename: string | null;
  image_width_px: number;
  image_height_px: number;
  node_count: number;
  building_count: number;
}

interface MapFull extends MapSummary {
  nodes: PathNode[];
  edges: PathEdge[];
  buildings: Building[];
}
```
