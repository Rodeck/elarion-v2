# Tasks: City Map System

**Input**: Design documents from `/specs/003-city-map-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket-messages.md

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize admin application projects and shared directory structure

- [x] T001 Create admin backend project with package.json, tsconfig.json, and Express + multer + cors + jose + pg dependencies in `admin/backend/`
- [x] T002 Create admin frontend project with package.json, tsconfig.json, vite.config.ts (proxy `/api` to port 4001) and index.html in `admin/frontend/`
- [x] T003 Create uploaded image storage directory at `backend/assets/maps/images/` with a `.gitkeep` file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration, shared protocol types, and admin auth infrastructure. MUST complete before ANY user story.

- [x] T004 Write migration `backend/src/db/migrations/008_city_maps.sql` — ALTER accounts (add is_admin), ALTER map_zones (add map_type, image_filename, image_width_px, image_height_px), CREATE TABLE path_nodes with partial unique index on is_spawn, CREATE TABLE path_edges with CHECK(from_node_id < to_node_id) and UNIQUE constraint, CREATE TABLE buildings, ALTER characters (add current_node_id FK)
- [x] T005 Add new TypeScript interfaces to `shared/protocol/index.ts` — CityMapNode, CityMapEdge, CityMapBuilding, CityMovePayload, CityPlayerMovedPayload, CityBuildingArrivedPayload, CityMoveRejectedPayload. Extend WorldStatePayload with map_type and optional city_map field. Extend CharacterData with current_node_id.
- [x] T006 [P] Implement admin auth middleware in `admin/backend/src/middleware/auth.ts` — validate JWT (using jose, same JWT_SECRET as game backend), query accounts table for is_admin=true, reject with 401/403
- [x] T007 [P] Implement admin backend config in `admin/backend/src/config.ts` — read EDITOR_PORT (default 4001), DATABASE_URL, JWT_SECRET from env vars via dotenv
- [x] T008 [P] Implement DB query module for city maps in `backend/src/db/queries/city-maps.ts` — functions: getMapById, getMapsByType, getNodesForZone, getEdgesForZone, getBuildingsForZone, createMap, updateMap, deleteMap, createNode, updateNode, deleteNode, createEdge, deleteEdge, createBuilding, updateBuilding, deleteBuilding, getSpawnNodeForZone. All queries parameterized against SQL injection.
- [x] T009 Implement admin backend Express bootstrap in `admin/backend/src/index.ts` — create Express app, apply cors + json middleware, mount auth middleware on /api routes, serve static files from `backend/assets/maps/images/` at `/images/`, import and mount all route modules, listen on EDITOR_PORT, structured JSON startup log

**Checkpoint**: Foundation ready — admin auth works, migration applied, protocol types defined, DB queries available

---

## Phase 3: User Story 1 — Admin Creates a New City Map (Priority: P1) MVP

**Goal**: Admin can open the map editor, create a new city map with dimensions, upload a PNG background, place path nodes, connect them with edges, designate a spawn node, and save.

**Independent Test**: Open editor at localhost:4002, create a map, upload image, place 5+ nodes, connect them, set spawn, save. Verify data in DB.

### Implementation for User Story 1

- [x] T010 [US1] Implement map CRUD routes in `admin/backend/src/routes/maps.ts` — GET /api/maps (list all city maps with node/building counts), GET /api/maps/:id (full map with nodes/edges/buildings), POST /api/maps (create with name, image_width_px, image_height_px, inserts into map_zones with map_type='city'), PUT /api/maps/:id (update name/dimensions), DELETE /api/maps/:id (cascade deletes nodes/edges/buildings). All responses use structured JSON. Add structured request/response logging.
- [x] T011 [US1] Implement image upload route in `admin/backend/src/routes/upload.ts` — POST /api/maps/:id/image using multer (10MB limit, PNG-only mimetype filter), generate UUID filename, save to `backend/assets/maps/images/`, update map_zones.image_filename, return image_url. Validate file is valid PNG (check magic bytes). Log upload events.
- [x] T012 [US1] Implement node CRUD routes in `admin/backend/src/routes/nodes.ts` — GET /api/maps/:id/nodes, POST /api/maps/:id/nodes (x, y, is_spawn — enforce single spawn via DB constraint), PUT /api/maps/:id/nodes/:nodeId (update position, toggle spawn), DELETE /api/maps/:id/nodes/:nodeId (prevent deletion of spawn node, cascade delete edges). Log operations.
- [x] T013 [US1] Implement edge CRUD routes in `admin/backend/src/routes/edges.ts` — GET /api/maps/:id/edges, POST /api/maps/:id/edges (from_node_id, to_node_id — enforce from < to ordering, validate both nodes exist in same zone), DELETE /api/maps/:id/edges/:edgeId. Log operations.
- [x] T014 [US1] Implement REST API client in `admin/frontend/src/editor/api.ts` — typed fetch wrappers for all map/node/edge/building/upload/validate endpoints, JWT token from localStorage, error handling with structured error messages
- [x] T015 [US1] Implement map list and creation UI in `admin/frontend/src/ui/map-list.ts` — list existing city maps (name, node count, building count), "New Map" button opening a form for name + width + height, click map to open editor. Simple DOM-based UI (no framework). Include JWT login form if no token stored.
- [x] T016 [US1] Implement canvas rendering engine in `admin/frontend/src/editor/canvas.ts` — HTML5 Canvas 2D wrapper: render background image, render nodes as circles (blue=regular, green=spawn), render edges as lines between nodes, pan (middle-mouse drag) and zoom (scroll wheel), coordinate transforms (screen ↔ canvas), hit-testing for nodes (point-in-circle) and edges (point-near-line)
- [x] T017 [US1] Implement editor mode state machine in `admin/frontend/src/editor/modes.ts` — modes: 'node' (click to place node, click existing to select), 'edge' (click first node, click second to create edge), 'select' (click to select node for property editing), 'delete' (click node or edge to remove). Mode switching via toolbar. Canvas cursor changes per mode. Dispatch mode-specific click/drag events to canvas.
- [x] T018 [US1] Implement toolbar UI in `admin/frontend/src/ui/toolbar.ts` — mode buttons (Node, Edge, Select, Delete), active mode highlight, "Upload Image" button triggering file input, "Set Spawn" toggle for selected node, "Save" button calling save flow, "Back to Maps" button returning to map list
- [x] T019 [US1] Implement editor entry point and page routing in `admin/frontend/src/main.ts` — simple hash-based routing: #/ = map list, #/edit/:id = editor for map. Initialize canvas on editor route. Wire toolbar events to mode state machine. Wire save button to serialize all nodes/edges and call API.

**Checkpoint**: Admin can create maps with paths. No buildings yet. Verify by creating a map with 10+ nodes and edges, uploading an image, setting spawn, saving, and checking DB.

---

## Phase 4: User Story 2 — Admin Defines Buildings on a Map (Priority: P1)

**Goal**: Admin can mark nodes as building nodes, place rectangle/circle hotspots, name buildings, and reposition name labels.

**Independent Test**: Open existing map in editor, add buildings via both methods (node marking + hotspot), name them, reposition labels, save. Verify in DB.

### Implementation for User Story 2

- [x] T020 [US2] Implement building CRUD routes in `admin/backend/src/routes/buildings.ts` — GET /api/maps/:id/buildings, POST /api/maps/:id/buildings (node_id, name, label_offset_x, label_offset_y, optional hotspot with type/x/y/w/h/r — validate node exists in zone, validate hotspot geometry completeness per type), PUT /api/maps/:id/buildings/:buildingId (update any field), DELETE /api/maps/:id/buildings/:buildingId. Log operations.
- [x] T021 [US2] Implement map validation route in `admin/backend/src/routes/maps.ts` (add to existing file) — POST /api/maps/:id/validate: check at least one node exists, exactly one spawn node, graph connectivity via BFS from spawn node, all buildings reference valid nodes. Return `{ valid, errors[] }`.
- [x] T022 [US2] Add 'building' mode to editor mode state machine in `admin/frontend/src/editor/modes.ts` — click existing node to mark as building (opens property panel), drag on canvas to create rect hotspot (mousedown → mousemove → mouseup defines rect), shift+drag to create circle hotspot (center + radius). After creating hotspot, auto-assign to nearest node.
- [x] T023 [US2] Implement building rendering in canvas in `admin/frontend/src/editor/canvas.ts` (extend existing) — render building nodes as gold stars/diamonds (distinct from regular nodes), render rect hotspots as semi-transparent blue rectangles, render circle hotspots as semi-transparent blue circles, render building name labels at configured offset positions, render label drag handles
- [x] T024 [US2] Implement properties panel UI in `admin/frontend/src/ui/properties.ts` — side panel shown when a building is selected: name text input, label offset X/Y number inputs, hotspot type display (readonly), "Delete Building" button. Changes save to in-memory state. Label position also adjustable via drag on canvas (update offset in real-time).
- [x] T025 [US2] Add save validation to editor save flow in `admin/frontend/src/main.ts` (extend existing) — before saving, call POST /api/maps/:id/validate. If errors, display them (disconnected graph warning, missing spawn, etc.). If valid, save all buildings via API. Add building mode button to toolbar in `admin/frontend/src/ui/toolbar.ts`.

**Checkpoint**: Full map editor functional. Admin can create maps with paths and buildings. Verify by creating a complete map with mixed building types, validate and save.

---

## Phase 5: User Story 4 — Player Navigates a City Map (Priority: P1)

**Goal**: Players see the city map with background image and building names. Click-to-move along paths with animated character movement. Server-authoritative pathfinding.

**Independent Test**: Log in as player on a city-type zone (seeded or editor-created), verify city map renders, click on nodes/paths, verify character animates along path.

### Implementation for User Story 4

- [x] T026 [US4] Implement city map data loader in `backend/src/game/world/city-map-loader.ts` — on bootstrap, query all city-type zones from map_zones, for each load nodes/edges/buildings into in-memory cache (Map<zoneId, CityMapData>). Export getCityMapData(zoneId). Build adjacency list from edges for BFS. Log map loading with node/edge/building counts.
- [x] T027 [US4] Modify zone loader to skip TMX parsing for city maps in `backend/src/game/world/zone-loader.ts` — in loadAllZones(), check map_type: if 'city', skip TMX file parsing (no passability matrix needed). Call city-map-loader for city zones instead.
- [x] T028 [US4] Extend world state handler to include city map data in `backend/src/websocket/handlers/world-state-handler.ts` — when sending world.state for a city-type zone, include map_type:'city' and city_map object (image_url, dimensions, nodes, edges, buildings, spawn_node_id). Omit monsters array content for city maps. Include current_node_id in character data.
- [x] T029 [US4] Implement BFS pathfinding utility in `backend/src/game/world/city-pathfinding.ts` — export findPath(adjacencyList, fromNodeId, toNodeId): number[] | null. Standard BFS on unweighted graph. Returns ordered array of node IDs from source to destination, or null if unreachable. Pure function, no side effects.
- [x] T030 [US4] Implement city movement handler in `backend/src/game/world/city-movement-handler.ts` — handle 'city.move' messages: validate player is on city map, not in combat, target_node_id exists in zone, BFS path exists. On success: iterate path nodes with 300ms delay between each, update characters.current_node_id per step, broadcast city.player_moved to zone. On failure: send city.move_rejected with reason. Apply rate limiting. Support cancellation (new city.move cancels in-progress movement). Add structured logging for all validations and movements.
- [x] T031 [US4] Register city.move handler in backend dispatcher in `backend/src/index.ts` — import city-movement-handler, call registerHandler('city.move', ...), call loadCityMaps() during bootstrap (after loadAllZones)
- [x] T032 [US4] Add city.move message validation schema in `backend/src/websocket/validator.ts` — add validation for 'city.move' payload: target_node_id must be a positive integer
- [x] T033 [US4] Implement city map rendering in game client in `frontend/src/scenes/GameScene.ts` — detect map_type from world.state: if 'city', call new buildCityMap() instead of buildMap(). buildCityMap(): load background image from city_map.image_url (Phaser loader), display as sprite filling canvas, render building name labels as Phaser.GameObjects.Text at configured positions, place player sprite at spawn node position. Set camera bounds to image dimensions. Store nodes/edges in memory for client-side path preview.
- [x] T034 [US4] Implement click-to-move interaction in game client in `frontend/src/scenes/GameScene.ts` (extend) — on pointerdown: find nearest node to click position (within click radius, e.g. 30px), or find nearest point on an edge. If valid target found, run client-side BFS for path preview (draw line along path), send city.move message with target_node_id. On city.player_moved received: tween player sprite to new node position (x, y) over 250ms. On city.move_rejected: snap player back to current node. Handle movement cancellation (new click while moving sends new city.move, server handles cancel).
- [x] T035 [US4] Add city map message handlers in game client WSClient in `frontend/src/network/WSClient.ts` (extend or in GameScene) — handle 'city.player_moved' (update player/remote player position), 'city.move_rejected' (emit event for GameScene to handle), 'city.building_arrived' (emit event for building panel).

**Checkpoint**: Full player navigation loop working. Player sees city map, clicks to move, character animates along paths. Server validates all movement.

---

## Phase 6: User Story 6 — Player Spawns at Elarion City (Priority: P1)

**Goal**: New and returning characters spawn at the Elarion city map on the designated spawn node.

**Independent Test**: Create a new character, verify they appear on Elarion city map at spawn node. Log out and back in, verify same position.

### Implementation for User Story 6

- [x] T036 [US6] Add Elarion city zone seed data in `backend/src/db/seeds/initial-data.ts` (extend existing) — insert a new map_zones row: name='Elarion City', map_type='city', image_width_px=1920, image_height_px=1080 (placeholder dimensions, actual image uploaded via editor). Record the zone_id.
- [x] T037 [US6] Update character creation to use Elarion city as default zone in `backend/src/game/world/character-create-handler.ts` — when creating a new character, set zone_id to the Elarion city zone (query by name or use config constant). Set current_node_id to NULL initially (will be set to spawn node on first world.state).
- [x] T038 [US6] Update world state handler for spawn node assignment in `backend/src/websocket/handlers/world-state-handler.ts` (extend) — when a player connects to a city-type zone with current_node_id=NULL, set it to the zone's spawn node (query path_nodes where is_spawn=true for the zone). Persist to DB. Log spawn assignment.
- [x] T039 [US6] Update character position persistence for city maps in `backend/src/db/queries/characters.ts` (extend existing) — add updateCharacterNode(characterId, nodeId) function. Modify existing character load query to include current_node_id. On disconnect, persist current_node_id to DB so player resumes at same position.

**Checkpoint**: New characters spawn at Elarion city. Existing characters resume at last node. Verify by creating character, moving, logging out, logging back in.

---

## Phase 7: User Story 3 — Admin Edits an Existing Map (Priority: P2)

**Goal**: Admin can select an existing map from the list, load it in the editor with all nodes/edges/buildings/image, make changes, and re-save.

**Independent Test**: Create a map via editor (US1/US2), close editor, reopen same map, verify all data loaded, modify a node position and building name, save, verify changes persisted.

### Implementation for User Story 3

- [x] T040 [US3] Implement map loading in editor in `admin/frontend/src/main.ts` (extend) — on #/edit/:id route: call GET /api/maps/:id, load background image onto canvas, reconstruct all nodes/edges/buildings from response data into in-memory editor state, render everything on canvas. Handle case where image_filename is null (show blank canvas with dimensions).
- [x] T041 [US3] Implement node deletion with cascade UX in `admin/frontend/src/editor/modes.ts` (extend delete mode) — when deleting a node: warn if node has connected edges (show count), warn if node is spawn (prevent deletion), warn if node has a building (confirm building deletion). On confirm, call DELETE endpoint and remove from in-memory state + re-render canvas.
- [x] T042 [US3] Implement background image replacement in editor in `admin/frontend/src/ui/toolbar.ts` (extend) — "Replace Image" button (shown when editing existing map): triggers file upload, calls POST /api/maps/:id/image, reloads canvas background on success. Existing nodes/buildings remain in place.
- [x] T043 [US3] Implement incremental save (diff-based) in `admin/frontend/src/main.ts` (extend save flow) — track changes since last load: new nodes, deleted nodes, modified nodes, new edges, deleted edges, new/modified/deleted buildings. On save, send only changed items via API calls (create/update/delete as needed). Show save progress indicator. Run validation before save.

**Checkpoint**: Full edit cycle works. Maps can be loaded, modified, and re-saved without data loss.

---

## Phase 8: User Story 5 — Player Interacts with Buildings (Priority: P2)

**Goal**: Player clicks on a building (node or hotspot) and character pathfinds to it. On arrival, a building panel appears showing the building name.

**Independent Test**: On a city map with buildings, click a building hotspot, verify character moves to it, verify building panel appears with building name.

### Implementation for User Story 5

- [x] T044 [US5] Implement building click detection in game client in `frontend/src/scenes/GameScene.ts` (extend) — on pointerdown: before checking for path node clicks, check if click is within any building hotspot (rect: point-in-rect, circle: point-in-circle) or on a building node. If building clicked, resolve to building's node_id and send city.move with that target_node_id. Store pending_building_id so arrival event can trigger panel.
- [x] T045 [US5] Implement building arrival event handling in city movement handler in `backend/src/game/world/city-movement-handler.ts` (extend) — when player arrives at a node that has an associated building, send 'city.building_arrived' message to that player only (not broadcast). Include building_id, building_name, node_id. Log building arrival.
- [x] T046 [US5] Implement building interaction panel in game client in `frontend/src/ui/BuildingPanel.ts` — new Phaser UI component or DOM overlay: shown on 'city.building_arrived' event, displays building name in styled header, placeholder body text "Building actions coming soon...", close button. Panel overlays game scene. Clicking outside panel or pressing Escape closes it.
- [x] T047 [US5] Render building name labels on city map in `frontend/src/scenes/GameScene.ts` (extend buildCityMap) — for each building in city_map.buildings, render name as Phaser.GameObjects.Text at (node.x + label_offset_x, node.y + label_offset_y). Use readable font (Cinzel or Crimson Text per existing UI conventions). Labels have depth above background but below player sprite. Hotspot areas rendered as subtle highlights (low-opacity colored rectangles/circles) to hint at interactivity.

**Checkpoint**: Full building interaction loop. Click building → move to it → panel opens. Verify with multiple building types (node-only, rect hotspot, circle hotspot).

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [x] T048 [P] Add structured logging across all new admin routes — ensure every route handler in `admin/backend/src/routes/*.ts` logs request method, path, map_id, admin username, and outcome (success/error) as JSON
- [x] T049 [P] Add structured logging to city movement handler — ensure all validation steps, path calculations, movement steps, and rejections in `backend/src/game/world/city-movement-handler.ts` emit structured JSON logs
- [x] T050 Handle edge cases for player on deleted/modified nodes in `backend/src/websocket/handlers/world-state-handler.ts` (extend) — on world.state for city map, if player's current_node_id no longer exists in the zone's node set, reset to spawn node. Log the recovery.
- [x] T051 Add admin editor CSS styling in `admin/frontend/src/styles.css` — clean layout: toolbar on left, canvas center, properties panel on right, map list as landing page. Responsive but desktop-focused. Dark theme matching game aesthetic.
- [x] T052 Run quickstart.md validation — follow all steps in `specs/003-city-map-system/quickstart.md` on a fresh setup: apply migration, set admin account, seed data, start admin backend, start admin frontend, create Elarion city map, start game, log in and verify spawn + navigation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — admin backend + editor MVP
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — extends editor with buildings
- **US4 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2 (uses DB-seeded or editor-created maps)
- **US6 (Phase 6)**: Depends on US4 (Phase 5) — spawn logic uses city map infrastructure
- **US3 (Phase 7)**: Depends on US1+US2 (Phases 3+4) — editing requires creation to work first
- **US5 (Phase 8)**: Depends on US4 (Phase 5) — building interaction extends navigation
- **Polish (Phase 9)**: Depends on all prior phases

### User Story Dependencies

```
Phase 1 (Setup)
  └→ Phase 2 (Foundation)
       ├→ Phase 3 (US1: Create Map) ──→ Phase 4 (US2: Buildings) ──→ Phase 7 (US3: Edit Map)
       └→ Phase 5 (US4: Navigate) ──┬→ Phase 6 (US6: Spawn)
                                     └→ Phase 8 (US5: Building Interact)
                                          └→ Phase 9 (Polish)
```

### Within Each User Story

- Backend routes/handlers before frontend rendering
- Data layer before business logic
- Core interaction before edge cases

### Parallel Opportunities

- **Phase 2**: T006, T007, T008 can all run in parallel (different files, no dependencies)
- **Phase 3**: T010, T011, T012, T013 (backend routes) can run in parallel; T014 depends on routes existing; T016, T017, T018 (frontend) can run in parallel after T014
- **Phase 3 + Phase 5**: US1 (admin editor) and US4 (player navigation) can run in parallel after Phase 2, if a map is seeded in the DB for testing US4
- **Phase 4 + Phase 5**: US2 (buildings in editor) and US4 (player nav) can run in parallel
- **Phase 9**: T048, T049, T051 can all run in parallel

---

## Parallel Example: Phase 2 (Foundation)

```
# Launch these three in parallel (different files):
Task T006: "Implement admin auth middleware in admin/backend/src/middleware/auth.ts"
Task T007: "Implement admin backend config in admin/backend/src/config.ts"
Task T008: "Implement DB query module in backend/src/db/queries/city-maps.ts"
```

## Parallel Example: Phase 3 (US1 Backend)

```
# Launch these four in parallel (separate route files):
Task T010: "Map CRUD routes in admin/backend/src/routes/maps.ts"
Task T011: "Image upload route in admin/backend/src/routes/upload.ts"
Task T012: "Node CRUD routes in admin/backend/src/routes/nodes.ts"
Task T013: "Edge CRUD routes in admin/backend/src/routes/edges.ts"
```

## Parallel Example: Cross-Story

```
# After Phase 2, these can run in parallel (different codebases):
US1 Track: T010-T019 (admin editor) — works in admin/ directory
US4 Track: T026-T035 (player nav) — works in backend/ + frontend/ directories
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3 Only)

1. Complete Phase 1: Setup admin projects
2. Complete Phase 2: Migration, protocol, auth, queries
3. Complete Phase 3: US1 — Admin can create maps with paths
4. **STOP and VALIDATE**: Create a map with 20+ nodes, upload image, save, verify DB
5. This proves the core map data pipeline works end-to-end

### Incremental Delivery

1. Setup + Foundation → Infrastructure ready
2. Add US1 (Create Map) → Admin can create maps (MVP!)
3. Add US2 (Buildings) → Full map editor with buildings
4. Add US4 (Navigate) + US6 (Spawn) → Players can navigate city maps
5. Add US3 (Edit Map) → Admin can iterate on maps
6. Add US5 (Building Interact) → Full building interaction loop
7. Polish → Logging, edge cases, validation

### Parallel Team Strategy

With two developers:

1. Both complete Phase 1 + 2 together
2. Once foundation is done:
   - **Dev A**: US1 → US2 → US3 (admin editor track)
   - **Dev B**: US4 → US6 → US5 (player experience track)
3. Dev B can use a DB-seeded test map while Dev A builds the editor

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Admin backend and game backend share the same PostgreSQL database but run as separate processes
- The game WS server runs on port 4000, admin backend on port 4001 — do not confuse
