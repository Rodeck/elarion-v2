# Research: City Map System

**Feature Branch**: `003-city-map-system`
**Date**: 2026-03-02

## R-001: Map Editor Port Conflict

**Decision**: The map editor will run on port **4001** (configurable via `EDITOR_PORT` env var). The WS game server already occupies port 4000 (default `WS_PORT`).

**Rationale**: The backend's `config.ts` defaults `WS_PORT` to 4000. Running both on 4000 is impossible. Port 4001 is adjacent, memorable, and avoids collision. The user requested `:4000` but this is the existing WS port — using 4001 is the minimal-conflict resolution.

**Alternatives considered**:
- Move WS server to a different port → breaks existing clients, higher migration cost
- Multiplex HTTP + WS on same port → adds complexity (Express + ws upgrade), violates YAGNI

## R-002: Map Editor Technology

**Decision**: The map editor will be a standalone Vite + TypeScript web app in a new `admin/` top-level directory. It will use HTML5 Canvas (via the native Canvas 2D API) for the editing surface and plain fetch calls to a lightweight HTTP REST API served by a new admin backend process.

**Rationale**:
- The map editor is an admin tool, not part of the game client. Keeping it separate respects Independent Deployability (Constitution V).
- HTML5 Canvas 2D API is sufficient for placing nodes, drawing edges, and positioning shapes. No game engine needed.
- No React/Vue — plain TypeScript + DOM keeps dependencies minimal (YAGNI, Constitution III).
- REST is acceptable here because map editing is NOT game state mutation — it's admin content authoring (Constitution quality gate 1 allows REST for non-game-state operations).

**Alternatives considered**:
- Phaser for editor → overkill for a node/edge drawing tool, adds unnecessary game engine overhead
- React/Vue → adds framework dependency for what is essentially a canvas + forms tool
- Embed editor in game client → violates separation of concerns, bloats player bundle

## R-003: Admin Backend Architecture

**Decision**: A new `admin/backend/` Express server that:
1. Serves the admin editor static files
2. Provides REST API endpoints for CRUD on maps, nodes, edges, buildings
3. Handles PNG file upload via `multer`
4. Connects to the same PostgreSQL database
5. Uses the same JWT auth (with an `is_admin` column check on `accounts`)

**Rationale**: The admin backend is a simple CRUD app. Express is the de facto Node.js HTTP framework and adds minimal weight. It needs to be a separate process from the game WS server to maintain independent deployability.

**Alternatives considered**:
- Add HTTP routes to the existing WS server → couples admin tooling with game server lifecycle, violates Constitution V
- Use the `ws` server to handle admin commands via WS → REST is simpler for CRUD operations on map data; WS is unnecessary for non-real-time admin editing

## R-004: Image Storage Strategy

**Decision**: Store uploaded PNG files on the filesystem at `backend/assets/maps/images/` with a UUID-based filename. The database stores the filename reference. The admin backend serves these files statically. The game client fetches them via a configurable base URL.

**Rationale**: Filesystem storage is simplest for single-server deployment. S3/cloud storage is YAGNI for now. UUID filenames prevent collisions and path traversal issues.

**Alternatives considered**:
- Store images as binary blobs in PostgreSQL → adds DB size bloat, complicates serving
- S3/cloud storage → unnecessary for current single-server deployment, adds external dependency

## R-005: Path Graph Data Structure & Pathfinding

**Decision**:
- **Server-side**: Store the graph as a node list + edge list (adjacency list). Pathfinding uses BFS (unweighted graph).
- **Client-side**: Receive the full graph on map load. Client runs BFS locally for click-to-move path calculation. Server validates the destination node and movement.
- **Movement protocol**: Client sends target node ID → server validates reachability via BFS → server moves player node-by-node, broadcasting position at each node.

**Rationale**: BFS is optimal for unweighted graphs and trivially simple. The graph will be small (tens to low hundreds of nodes) so performance is not a concern. Sending the full graph to the client enables responsive click-to-move without round-trip latency for path preview, while the server remains authoritative for actual movement.

**Alternatives considered**:
- Dijkstra → unnecessary for unweighted edges, BFS is simpler and equivalent
- A* → overkill for small graphs with <200 nodes
- Server-only pathfinding → adds latency to every click, poor UX for path preview

## R-006: Map Editor Canvas Interaction Model

**Decision**: The editor will have a toolbar with modes:
1. **Node mode**: Click to place nodes, click existing node to select it
2. **Edge mode**: Click node A then node B to create an edge
3. **Building mode**: Click node to mark as building node; or drag to create rect/circle hotspot, then assign to nearest node
4. **Select mode**: Click to select nodes/buildings for editing properties (name, label position)
5. **Delete mode**: Click nodes/buildings/edges to remove them

**Rationale**: Mode-based interaction is standard for spatial editors. Clear separation of modes prevents accidental operations. Each mode maps directly to a spec requirement.

**Alternatives considered**:
- Context menus on right-click → less discoverable, harder on touch devices
- Floating property panels → more complex, YAGNI for initial implementation

## R-007: Admin Authentication

**Decision**: Add an `is_admin BOOLEAN DEFAULT FALSE` column to the `accounts` table. The admin backend validates JWT tokens from the existing auth system and checks `is_admin = true`. Initial admin account is set via a database seed or manual SQL.

**Rationale**: Reuses the existing JWT infrastructure. A simple boolean flag is sufficient for the current two-role model (player vs admin). No need for a full RBAC system (YAGNI).

**Alternatives considered**:
- Separate admin accounts table → unnecessary duplication
- Role-based system with permissions → overkill for a single admin role
- Hardcoded admin credentials → security risk, non-scalable

## R-008: Player Position Model Change

**Decision**: The `characters` table currently stores `pos_x SMALLINT, pos_y SMALLINT` (tile coordinates). For city maps, player position will be stored as `current_node_id` referencing a path node. The existing `pos_x`/`pos_y` columns will be retained for backward compatibility with future world maps (tile-based), and a new `current_node_id INTEGER REFERENCES path_nodes(id)` column will be added to `characters`.

**Rationale**: On city maps, position is defined by which node the player is at (or between). Storing a node ID is the natural representation. Keeping the old tile columns avoids a destructive migration and preserves the option for tile-based world maps later.

**Alternatives considered**:
- Replace pos_x/pos_y entirely → destructive, blocks future tile-based world maps
- Store pixel coordinates → doesn't represent the graph position, harder to validate server-side

## R-009: Map Type Differentiation

**Decision**: Add a `map_type VARCHAR(16) DEFAULT 'tile'` column to `map_zones`. Values: `'tile'` (existing behavior) and `'city'` (new path-graph behavior). The game client and server use this field to determine rendering and movement logic.

**Rationale**: The existing `map_zones` table and zone system already handle zone lookup, spawn points, and player assignment. Adding a type discriminator is the minimal change to support both map types through the same zone infrastructure.

**Alternatives considered**:
- Separate `city_maps` table → duplicates zone infrastructure, complicates zone lookup
- Replace all maps with city type → breaks existing functionality, out of scope

## R-010: Client Map Loading

**Decision**: When a player enters a city-type zone, the server sends the full map data (nodes, edges, buildings, image URL) in the `world.state` payload (extended with a `city_map` field). The client detects `map_type: 'city'` and renders accordingly instead of building a tile grid.

**Rationale**: The `world.state` message is already sent on zone entry. Extending it with city map data avoids adding a new message type for initial load. The data is small enough (JSON of nodes/edges/buildings) to include inline.

**Alternatives considered**:
- Separate `city_map.data` message → adds complexity for no benefit; the data is needed immediately on zone entry
- Client fetches map data via REST → adds latency, requires HTTP endpoint on game server (violates architecture)
