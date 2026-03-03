# Data Model: City Map System

**Feature Branch**: `003-city-map-system`
**Date**: 2026-03-02

## Entity Relationship Overview

```
accounts (existing)
  └─ is_admin (new column)

map_zones (existing, extended)
  └─ map_type: 'tile' | 'city'
  └─ image_filename (nullable, for city maps)
  └─ image_width_px, image_height_px (nullable, for city maps)

path_nodes
  ├─ belongs to: map_zones (zone_id FK)
  ├─ has many: path_edges (as from_node or to_node)
  └─ has one (optional): building

path_edges
  ├─ from_node → path_nodes
  └─ to_node → path_nodes

buildings
  ├─ belongs to: map_zones (zone_id FK)
  ├─ associated with: path_nodes (node_id FK)
  └─ optional hotspot shape (rect or circle)

characters (existing, extended)
  └─ current_node_id → path_nodes (nullable, for city maps)
```

## New Tables

### path_nodes

| Column      | Type           | Constraints                              | Description                         |
| ----------- | -------------- | ---------------------------------------- | ----------------------------------- |
| id          | SERIAL         | PK                                       | Unique node ID                      |
| zone_id     | SMALLINT       | NOT NULL, FK → map_zones(id) ON DELETE CASCADE | Which map this node belongs to      |
| x           | REAL           | NOT NULL                                 | X position in pixels on the map image |
| y           | REAL           | NOT NULL                                 | Y position in pixels on the map image |
| is_spawn    | BOOLEAN        | NOT NULL DEFAULT FALSE                   | Whether this is the map's spawn node |
| created_at  | TIMESTAMPTZ    | NOT NULL DEFAULT NOW()                   |                                     |

**Constraints**:
- Unique spawn per zone: Only one node per zone can have `is_spawn = true` (enforced via partial unique index)
- Index on `zone_id` for efficient zone-scoped queries

### path_edges

| Column       | Type    | Constraints                                    | Description                    |
| ------------ | ------- | ---------------------------------------------- | ------------------------------ |
| id           | SERIAL  | PK                                             | Unique edge ID                 |
| zone_id      | SMALLINT | NOT NULL, FK → map_zones(id) ON DELETE CASCADE | Which map this edge belongs to |
| from_node_id | INTEGER | NOT NULL, FK → path_nodes(id) ON DELETE CASCADE | Start node                     |
| to_node_id   | INTEGER | NOT NULL, FK → path_nodes(id) ON DELETE CASCADE | End node                       |

**Constraints**:
- Unique edge: `UNIQUE(zone_id, from_node_id, to_node_id)` — prevents duplicate edges
- Edges are bidirectional: the application treats `(A, B)` and `(B, A)` as the same path. Only one row is stored (enforced by `CHECK(from_node_id < to_node_id)`)
- Index on `zone_id` for efficient zone-scoped queries

### buildings

| Column        | Type         | Constraints                                    | Description                              |
| ------------- | ------------ | ---------------------------------------------- | ---------------------------------------- |
| id            | SERIAL       | PK                                             | Unique building ID                       |
| zone_id       | SMALLINT     | NOT NULL, FK → map_zones(id) ON DELETE CASCADE | Which map this building belongs to       |
| node_id       | INTEGER      | NOT NULL, FK → path_nodes(id) ON DELETE CASCADE | Associated path node for navigation      |
| name          | VARCHAR(64)  | NOT NULL                                       | Building display name                    |
| label_offset_x | REAL       | NOT NULL DEFAULT 0                             | Label X offset from node position        |
| label_offset_y | REAL       | NOT NULL DEFAULT -20                           | Label Y offset from node position        |
| hotspot_type  | VARCHAR(8)   | CHECK (hotspot_type IN ('rect', 'circle', NULL)) | NULL = building node only, no hotspot shape |
| hotspot_x     | REAL         |                                                | Hotspot origin X (top-left for rect, center for circle) |
| hotspot_y     | REAL         |                                                | Hotspot origin Y (top-left for rect, center for circle) |
| hotspot_w     | REAL         |                                                | Width (rect only)                        |
| hotspot_h     | REAL         |                                                | Height (rect only)                       |
| hotspot_r     | REAL         |                                                | Radius (circle only)                     |

**Constraints**:
- Index on `zone_id`
- If `hotspot_type = 'rect'` then `hotspot_x`, `hotspot_y`, `hotspot_w`, `hotspot_h` must be NOT NULL
- If `hotspot_type = 'circle'` then `hotspot_x`, `hotspot_y`, `hotspot_r` must be NOT NULL
- If `hotspot_type IS NULL` then all hotspot geometry columns must be NULL

## Modified Tables

### map_zones (existing — add columns)

| Column          | Type         | Change      | Description                                 |
| --------------- | ------------ | ----------- | ------------------------------------------- |
| map_type        | VARCHAR(16)  | ADD, DEFAULT 'tile' | Discriminator: 'tile' or 'city'   |
| image_filename  | VARCHAR(256) | ADD, nullable | PNG filename for city maps (UUID-based)     |
| image_width_px  | INTEGER      | ADD, nullable | Background image width in pixels            |
| image_height_px | INTEGER      | ADD, nullable | Background image height in pixels           |

Existing columns (`tmx_filename`, `width_tiles`, `height_tiles`, `spawn_x`, `spawn_y`) remain for tile-type maps. For city maps, `tmx_filename` is NULL and spawn is determined by `path_nodes.is_spawn`.

### characters (existing — add column)

| Column          | Type    | Change      | Description                               |
| --------------- | ------- | ----------- | ----------------------------------------- |
| current_node_id | INTEGER | ADD, nullable, FK → path_nodes(id) ON SET NULL | Player's current node on city maps |

When on a city map, `current_node_id` is set. When on a tile map, `pos_x`/`pos_y` is used and `current_node_id` is NULL.

### accounts (existing — add column)

| Column   | Type    | Change                  | Description        |
| -------- | ------- | ----------------------- | ------------------ |
| is_admin | BOOLEAN | ADD, DEFAULT FALSE | Admin privilege flag |

## State Transitions

### Player Movement on City Maps

```
IDLE (at node N)
  ├─ Player clicks node M → Server validates path exists (BFS) →
  │   ├─ Path found → MOVING (traverse node sequence N → ... → M)
  │   └─ No path → IDLE (reject, no change)
  └─ Player clicks building → resolve to building's node_id → same as clicking node

MOVING (traversing path N₁ → N₂ → ... → Nₖ)
  ├─ Reach next node → update current_node_id, broadcast position
  │   ├─ Node is building → fire building.arrived event
  │   └─ More nodes → continue MOVING
  ├─ Player clicks new destination → cancel current path, pathfind from nearest node
  └─ Arrive at final node → IDLE
```

### Map Lifecycle (Admin)

```
NEW → DRAFT (canvas created, no nodes)
  → EDITING (nodes/edges/buildings being placed)
  → VALIDATION (save triggered)
    ├─ Pass (connected graph, spawn set) → SAVED
    └─ Fail → EDITING (show warnings)
SAVED → EDITING (admin reopens for edit)
```

## Migration Plan

**Migration 008**: `008_city_maps.sql`
1. `ALTER TABLE accounts ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE`
2. `ALTER TABLE map_zones ADD COLUMN map_type VARCHAR(16) NOT NULL DEFAULT 'tile'`
3. `ALTER TABLE map_zones ADD COLUMN image_filename VARCHAR(256)`
4. `ALTER TABLE map_zones ADD COLUMN image_width_px INTEGER`
5. `ALTER TABLE map_zones ADD COLUMN image_height_px INTEGER`
6. `CREATE TABLE path_nodes (...)`
7. `CREATE UNIQUE INDEX idx_path_nodes_spawn ON path_nodes (zone_id) WHERE is_spawn = true`
8. `CREATE TABLE path_edges (...)`
9. `CREATE TABLE buildings (...)`
10. `ALTER TABLE characters ADD COLUMN current_node_id INTEGER REFERENCES path_nodes(id) ON DELETE SET NULL`
