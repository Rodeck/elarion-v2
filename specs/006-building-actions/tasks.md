# Tasks: Building Actions & Map Travel

**Input**: Design documents from `/specs/006-building-actions/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks grouped by user story for independent implementation and delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Database Migration)

**Purpose**: Apply schema changes that all subsequent work depends on.

- [X] T001 Write migration file `backend/src/db/migrations/009_building_actions.sql` — add `description TEXT` column to `buildings` table; create `building_actions` table with `id, building_id (FK→buildings, CASCADE DELETE), action_type TEXT CHECK ('travel'), sort_order INTEGER DEFAULT 0, config JSONB DEFAULT '{}', created_at TIMESTAMPTZ`; add index `idx_building_actions_building_id` on `building_id` (exact SQL in data-model.md)
- [ ] T002 Run migration against local PostgreSQL: `psql -d elarion -f backend/src/db/migrations/009_building_actions.sql` and confirm both schema changes apply cleanly

**Checkpoint**: Database schema ready — all subsequent layers can reference new columns and table.

---

## Phase 2: Foundational (Shared Types — Blocking All Stories)

**Purpose**: Extend the TypeScript shared protocol and backend query interfaces so all four codebases compile with the new entities. Must be complete before any implementation task.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every task in Phase 3+ imports these types.

- [X] T003 [P] Extend `backend/src/db/queries/city-maps.ts` — add `description: string | null` to the existing `Building` interface; add new interfaces `BuildingAction { id, building_id, action_type: 'travel', sort_order, config, created_at }` and `TravelActionConfig { target_zone_id: number, target_node_id: number }` (exact shapes in data-model.md)
- [X] T004 [P] Extend `shared/protocol/index.ts` — (a) add `description: string` and `actions: BuildingActionDto[]` to the existing `CityMapBuilding` interface; (b) add new interfaces `BuildingActionDto { id, action_type: 'travel', label: string, config: TravelActionDto }`, `TravelActionDto { target_zone_id, target_zone_name, target_node_id }`, `CityBuildingActionPayload { building_id, action_id, action_type: 'travel' }`, `CityBuildingActionRejectedPayload { reason: 'NOT_AT_BUILDING'|'INVALID_ACTION'|'INVALID_DESTINATION'|'IN_COMBAT'|'NOT_CITY_MAP' }` (exact shapes in data-model.md and contracts/websocket-messages.md)

**Checkpoint**: Both packages compile. All story phases can now begin independently.

---

## Phase 3: User Story 1 — Player Travels Between Maps via Building (Priority: P1) 🎯 MVP

**Goal**: A player enters a building node on a city map, sees a panel with the building's name, description, and a travel button, clicks it, sees a fade-to-black transition, and arrives on the destination map at the configured node.

**Independent Test**: Enter a pre-configured building (set up directly in DB), click travel button in game UI → verify fade animation plays → verify new zone's `world.state` is received and the map reloads with the player at the destination node.

### Backend Implementation

- [X] T005 Add `getBuildingActions(buildingId: number): Promise<BuildingAction[]>` query to `backend/src/db/queries/city-maps.ts` — `SELECT * FROM building_actions WHERE building_id = $1 ORDER BY sort_order ASC`
- [X] T006 Extend `backend/src/game/world/city-map-loader.ts` — in the city map loading/reload path, after loading buildings for a zone, call `getBuildingActions(building.id)` for each building; resolve `target_zone_name` from `map_zones` for each travel action config; populate `BuildingActionDto[]` on each `CityMapBuilding` entry (including `label: "Travel to {target_zone_name}"`); include `description` field from DB row (empty string if null)
- [X] T007 Create `backend/src/game/world/building-action-handler.ts` — export `handleBuildingAction(session, payload: CityBuildingActionPayload)`:
  - Validate player is on a `city`-type zone → reject `NOT_CITY_MAP`
  - Validate player is not in combat → reject `IN_COMBAT`
  - Validate `building_id` exists in zone cache AND `building.node_id === player.current_node_id` → reject `NOT_AT_BUILDING`
  - Validate `action_id` exists in `building.actions` and `action_type === 'travel'` → reject `INVALID_ACTION`
  - Validate `target_zone_id` and `target_node_id` exist in DB → reject `INVALID_DESTINATION`
  - On success: `UPDATE characters SET zone_id=$1, current_node_id=$2 WHERE id=$3`; remove player from old zone's active set; add to new zone's active set; broadcast `city.player_left { character_id }` to old zone; send `world.state` for new zone to player (reuse existing world-state construction); broadcast player presence to new zone; emit structured log `{ event: 'player_travel', character_id, from_zone_id, to_zone_id, building_id, action_id }`
  - On rejection: send `city.building_action_rejected { reason }` to player; emit structured log `{ event: 'player_travel_rejected', character_id, reason, building_id }`
- [X] T008 Register the new handler in `backend/src/index.ts` — `registerHandler('city.building_action', handleBuildingAction)` (follow the existing pattern for `city.move` registration)

### Frontend Implementation

- [X] T009 [P] Implement `frontend/src/ui/BuildingPanel.ts` (replaces stub): create an HTML div overlay with class `building-panel`; implement `show(building: CityMapBuilding, onTravelClick: (actionId: number) => void)` — renders building title (h2), description (p), and one button per action (`btn.textContent = action.label`); on button click: disable all buttons, call `onTravelClick(action.id)`; implement `hide()` — sets display to none; implement `onRejected(reason: string)` — re-enables buttons, appends a brief error paragraph; ensure the panel is positioned to the right of the `#game` canvas using existing layout conventions (same HTML parent structure as `#top-bar` / `#bottom-bar`)
- [X] T010 Extend `frontend/src/scenes/GameScene.ts` — update `city.building_arrived` handler: look up the building by `payload.building_id` in `this.cityMapData!.buildings`; call `this.buildingPanel.show(building, (actionId) => { this.sendBuildingAction(building.id, actionId); })`; add private method `sendBuildingAction(buildingId, actionId)` that calls `this.cameras.main.fadeOut(600, 0, 0, 0)`, sets `this.awaitingTravelWorldState = true`, and sends `{ type: 'city.building_action', v: 1, payload: { building_id: buildingId, action_id: actionId, action_type: 'travel' } }` via the WebSocket connection
- [X] T011 Extend `frontend/src/scenes/GameScene.ts` — update the `world.state` handler: after successfully rebuilding the city map (or tile map), check if `this.awaitingTravelWorldState === true`; if so, clear the flag, close the building panel (`this.buildingPanel.hide()`), and call `this.cameras.main.fadeIn(600, 0, 0, 0)` so the new map fades in smoothly
- [X] T012 Add `city.building_action_rejected` message handler to `frontend/src/scenes/GameScene.ts` — register handler for message type `'city.building_action_rejected'`; call `this.cameras.main.fadeIn(300, 0, 0, 0)` immediately; call `this.buildingPanel.onRejected(payload.reason)`; clear `this.awaitingTravelWorldState` flag

**Checkpoint**: US1 complete. Player can travel between city maps via building panel with fade animation. Verifiable end-to-end using quickstart.md steps 4–5.

---

## Phase 4: User Story 2 — Admin Configures Building with Travel Action (Priority: P2)

**Goal**: Admin opens a building in the map editor, enters a description, adds a "Travel to Location" action by selecting a destination map and node from dropdowns, saves, and the configuration persists on reload.

**Independent Test**: In admin editor, select a building, fill in description and create a travel action pointing to an existing map's node → save → reload editor → confirm description and action are present with correct destination.

### Admin Backend Implementation

- [X] T013 Extend `admin/backend/src/routes/buildings.ts` — update the `PUT /:id/buildings/:buildingId` handler to accept and persist `description` from request body (alongside existing fields); update the building query to `UPDATE buildings SET name=$1, description=$2, ... WHERE id=$X`; include `description` in the response object
- [X] T014 Add building action sub-routes to `admin/backend/src/routes/buildings.ts` — register four new Express routes scoped under `/:id/buildings/:buildingId/actions`:
  - `GET /`: query `SELECT * FROM building_actions WHERE building_id=$1 ORDER BY sort_order` → return `{ actions }`
  - `POST /`: validate `action_type === 'travel'`; validate `config.target_zone_id` exists in `map_zones`; validate `config.target_node_id` exists in `path_nodes` belonging to `target_zone_id`; insert row → return `{ action }`
  - `PUT /:actionId`: update `config` and/or `sort_order` for given action → return `{ action }`
  - `DELETE /:actionId`: delete action row → return `{ success: true }`

### Admin Frontend Implementation

- [X] T015 [P] Add typed API functions to `admin/frontend/src/editor/api.ts` — export: `getBuildingActions(mapId, buildingId)`, `createBuildingAction(mapId, buildingId, body)`, `updateBuildingAction(mapId, buildingId, actionId, body)`, `deleteBuildingAction(mapId, buildingId, actionId)` — following the existing fetch + auth-header pattern used by `getBuildings`, etc.
- [X] T016 Add `description` `<textarea>` field to the building properties panel in `admin/frontend/src/ui/properties.ts` — render below the existing name field; pre-populate with current `building.description ?? ''`; auto-save on `blur` event by calling `PUT /api/maps/:id/buildings/:buildingId` with `{ description: textarea.value }` (same pattern as name field auto-save)
- [X] T017 Add actions list section to `admin/frontend/src/ui/properties.ts` — after description field, render an "Actions" heading and an `<ul>` of existing actions (fetched from `getBuildingActions()`); each list item shows `action.action_type` + config summary (`"→ [target_zone_name] node [target_node_id]"`) + a Delete `<button>` that calls `deleteBuildingAction()` on click and refreshes the list; show "(no actions)" if list is empty
- [X] T018 Add "Add Action" button and inline form to `admin/frontend/src/ui/properties.ts` — button below the actions list opens a small form; form contains: (a) action type `<select>` with one option `value="travel" Travel to Location`; (b) a `<div class="travel-config">` with two `<select>` elements (map and node); (c) Save and Cancel buttons
- [X] T019 Wire **Destination Map** `<select>` in `admin/frontend/src/ui/properties.ts` — on form open: call `getMaps()` (existing `GET /api/maps`), populate `<select>` with `{ value: map.id, label: map.name }` for each map; on change: trigger node dropdown reload
- [X] T020 Wire **Destination Node** `<select>` in `admin/frontend/src/ui/properties.ts` — on map select change: call `getNodes(selectedMapId)` (existing `GET /api/maps/:id/nodes`), populate node `<select>` with `{ value: node.id, label: "Node #" + node.id + " (" + node.x + "," + node.y + ")" }`; Save button calls `createBuildingAction(mapId, buildingId, { action_type: 'travel', config: { target_zone_id: mapId, target_node_id: nodeId } })`, closes form, and refreshes the action list

**Checkpoint**: US2 complete. Admin can configure buildings with description and travel actions end-to-end. Verifiable using quickstart.md step 3.

---

## Phase 5: User Story 3 — Building Panel Shows Info and All Actions (Priority: P3)

**Goal**: The building panel handles all content states — no actions, single action, multiple actions — gracefully. Panel never overlaps the map.

**Independent Test**: Enter a building with no actions → confirm panel opens showing title + description + empty-state message. Enter a building with 2 travel actions → confirm both buttons appear. Move character off the building node → confirm panel closes.

- [X] T021 Add empty-state rendering to `frontend/src/ui/BuildingPanel.ts` — in `show()`, after rendering action buttons: if `building.actions.length === 0`, append a `<p class="no-actions">Nothing to do here.</p>` element in place of buttons; ensure the element is removed on `hide()` and re-evaluated on each `show()` call
- [X] T022 Add auto-close on player node change to `frontend/src/scenes/GameScene.ts` — in the `city.player_moved` handler, when `payload.character_id === this.myCharacter?.id` and `payload.node_id !== this.currentBuildingNodeId` (track the building node in a new field `currentBuildingNodeId: number | null`), call `this.buildingPanel.hide()` and clear `this.currentBuildingNodeId`; set `currentBuildingNodeId` in the `city.building_arrived` handler when showing the panel
- [X] T023 Verify and fix building panel CSS layout in `frontend/src/ui/BuildingPanel.ts` — ensure the panel div is appended to the `#game-wrapper` or equivalent layout container; apply CSS so it is positioned to the right of the `#game` canvas div without overlapping the canvas; the panel should use `position: absolute`, `right: 0`, `top: 0`, `height: 100%`, `width: 260px` (or match the style of existing side panels); hide by default with `display: none`

**Checkpoint**: US3 complete. All panel states work correctly. All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cache integrity, response completeness, end-to-end validation.

- [X] T024 [P] Verify `reloadCityMap(zoneId)` in `backend/src/game/world/city-map-loader.ts` fully reloads building actions — confirm the reload path calls `getBuildingActions()` for each building and re-resolves travel destination names; if not, extend the reload function to match the initial load path so admin edits are immediately reflected in-game
- [X] T025 [P] Ensure `description` is included in the `GET /api/maps/:id` (full map) and `GET /api/maps/:id/buildings` responses in `admin/backend/src/routes/buildings.ts` so the properties panel can pre-populate description on building select (verify the DB query selects the `description` column)
- [ ] T026 Run through the full quickstart.md checklist manually — confirm all steps succeed: migration, admin config, in-game travel, rejection handling, log output; fix any gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migration must be applied) — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 completion — Backend (T005–T008) and Frontend (T009–T012) can proceed in parallel once T003+T004 are done
- **Phase 4 (US2)**: Depends on Phase 2 completion — can start in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 3 completion (BuildingPanel and GameScene must exist)
- **Phase 6 (Polish)**: Depends on all story phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on US2 or US3
- **US2 (P2)**: Can start after Foundational — independent of US1 (different codebases: admin vs game server)
- **US3 (P3)**: Depends on US1 (extends BuildingPanel.ts and GameScene.ts created in US1)

### Within Phase 3 (US1)

- T005 → T006 (loader needs query function)
- T006 → T007 (handler imports loader's cache for building lookup)
- T007 → T008 (register after handler exists)
- T009 [P] (BuildingPanel new file — independent of backend tasks)
- T010 depends on T009 (GameScene calls BuildingPanel.show)
- T011, T012 depend on T010 (extend same handlers)

---

## Parallel Execution Examples

### Phase 2 — Both type files in parallel

```
Task: "T003 — Extend Building interface and add BuildingAction types in backend/src/db/queries/city-maps.ts"
Task: "T004 — Extend CityMapBuilding and add Dto types in shared/protocol/index.ts"
```

### Phase 3 — Backend and Frontend in parallel

```
# Backend stream:
Task: "T005 — Add getBuildingActions query to backend/src/db/queries/city-maps.ts"
→ Task: "T006 — Extend city-map-loader.ts to load actions"
→ Task: "T007 — Create building-action-handler.ts"
→ Task: "T008 — Register handler in backend/src/index.ts"

# Frontend stream (simultaneously):
Task: "T009 — Implement BuildingPanel.ts"
→ Task: "T010 — Extend city.building_arrived handler in GameScene.ts"
→ Task: "T011 — Extend world.state handler for travel in GameScene.ts"
→ Task: "T012 — Add city.building_action_rejected handler in GameScene.ts"
```

### Phase 4 — Admin backend and admin frontend in parallel

```
# Admin backend stream:
Task: "T013 — Extend building PUT with description in admin/backend/src/routes/buildings.ts"
→ Task: "T014 — Add action sub-routes to admin/backend/src/routes/buildings.ts"

# Admin frontend stream (simultaneously):
Task: "T015 — Add API functions to admin/frontend/src/editor/api.ts"
→ Task: "T016 — Add description textarea to admin/frontend/src/ui/properties.ts"
→ Task: "T017 — Add actions list section"
→ Task: "T018 — Add Add Action form"
→ Task: "T019 — Wire map dropdown"
→ Task: "T020 — Wire node dropdown and save"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T002): Apply migration
2. Complete Phase 2 (T003–T004): Shared types compile
3. Complete Phase 3 backend (T005–T008): Server handles travel
4. Complete Phase 3 frontend (T009–T012): Game client has panel + animation
5. **STOP and VALIDATE**: Test end-to-end using quickstart.md step 4
6. Seed a building with a travel action directly in DB to unblock game testing before admin UI is ready

### Incremental Delivery

1. Phase 1+2 → Foundation ready
2. Phase 3 → Travel works in game (MVP!)
3. Phase 4 → Admin can configure buildings without DB seeding
4. Phase 5 → Panel handles all edge cases gracefully
5. Phase 6 → Polished and validated

### Total Task Count

| Phase | Tasks | Parallel |
|-------|-------|---------|
| Phase 1: Setup | 2 | 0 |
| Phase 2: Foundational | 2 | 2 |
| Phase 3: US1 (P1 MVP) | 8 | 2 (T009 ‖ backend) |
| Phase 4: US2 (P2) | 8 | 2 (T015 ‖ T016+) |
| Phase 5: US3 (P3) | 3 | 0 |
| Phase 6: Polish | 3 | 2 |
| **Total** | **26** | **8** |
