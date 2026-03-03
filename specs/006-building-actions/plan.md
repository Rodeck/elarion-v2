# Implementation Plan: Building Actions & Map Travel

**Branch**: `006-building-actions` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-building-actions/spec.md`

---

## Summary

Extend the existing city map system so that buildings can be configured with a title, description, and an ordered list of actions. For this feature, one action type is introduced: **Travel to Location**, which teleports the player to a configured node on another city-type map. On the admin side, building properties gain description and action configuration fields, with map/node selectors populated from live map data. On the game side, entering a building shows a panel to the right of the map with the building's content and action buttons. Clicking a travel action triggers an optimistic fade-to-black transition, sends a `city.building_action` WebSocket message to the server, and on approval loads the destination zone via the standard `world.state` message.

---

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, admin)
**Primary Dependencies**: Phaser 3.60.0 (game frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (both frontends)
**Storage**: PostgreSQL 16 — new `building_actions` table; `buildings` table extended with `description TEXT`
**Testing**: `npm test && npm run lint` (project-wide)
**Target Platform**: Browser (Chromium/Firefox) for frontends; Node.js Linux/Windows server for backend
**Project Type**: Web application — Phaser 3 game client + Node.js WebSocket game server + Express admin backend
**Performance Goals**: Building panel opens within 1s of node arrival; fade transition ≤ 600ms; travel round-trip (client action → world.state received) within 2s
**Constraints**: WebSocket protocol `v: 1` backward compatibility must be preserved; no REST for game state mutations (constitution gate)
**Scale/Scope**: Targets single-server multiplayer game with existing session handling

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status | Notes |
|------|-------------|--------|-------|
| 1. No REST for game state | Travel action MUST use WebSocket | ✅ PASS | New `city.building_action` message via existing WS connection; no HTTP endpoint for travel |
| 2. Server-side validation | Player action validated server-side | ✅ PASS | Handler validates: city map type, player at building node, action exists, destination valid, not in combat |
| 3. Structured logging | All player action paths emit structured logs | ✅ PASS | `building-action-handler.ts` emits JSON log on execute + rejection |
| 4. Contract documented | New message types documented in `contracts/` | ✅ PASS | `specs/006-building-actions/contracts/websocket-messages.md` defines both new messages and `world.state` extension |
| 5. Graceful rejection handling | Frontend rolls back on server rejection | ✅ PASS | On `city.building_action_rejected`: `camera.fadeIn` called immediately, buttons re-enabled, error shown in panel |
| 6. Complexity justified | No unjustified complexity | ✅ PASS | JSONB for action config is justified in `research.md` Decision 1; no unnecessary abstractions |

*Post-design re-check: All gates continue to pass. Design introduces no new violations.*

---

## Project Structure

### Documentation (this feature)

```text
specs/006-building-actions/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Research decisions (Phase 0)
├── data-model.md        # DB schema + TypeScript types (Phase 1)
├── quickstart.md        # Developer setup guide (Phase 1)
├── contracts/
│   └── websocket-messages.md  # New WS message types + Admin API changes (Phase 1)
└── tasks.md             # Task breakdown (Phase 2 — /speckit.tasks)
```

### Source Code Changes

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 009_building_actions.sql         # NEW
│   │   └── queries/
│   │       └── city-maps.ts                      # EXTENDED
│   └── game/world/
│       ├── city-map-loader.ts                    # EXTENDED (load actions)
│       ├── city-movement-handler.ts              # EXTENDED (building_arrived payload)
│       └── building-action-handler.ts            # NEW

admin/
├── backend/
│   └── src/routes/
│       └── buildings.ts                          # EXTENDED (description + action sub-routes)
└── frontend/
    └── src/ui/
        └── properties.ts                         # EXTENDED (description field + actions section)

frontend/
└── src/
    ├── ui/
    │   └── BuildingPanel.ts                      # IMPLEMENTED (was stub)
    └── scenes/
        └── GameScene.ts                          # EXTENDED (new message handlers + transition)

shared/
└── protocol/
    └── index.ts                                  # EXTENDED (new types)
```

**Structure Decision**: Standard web application split (backend / admin / frontend / shared). All changes are confined to existing directories; no new top-level directories needed.

---

## Complexity Tracking

> No constitution violations detected. Table not required.

---

## Implementation Phases

### Phase A — Database & Shared Types

**Goal**: Extend schema and shared protocol so all layers can compile with new types.

**Tasks**:
1. Write `backend/src/db/migrations/009_building_actions.sql` (described in `data-model.md`)
2. Extend `backend/src/db/queries/city-maps.ts`:
   - Add `description: string | null` to `Building` interface
   - Add `BuildingAction`, `TravelActionConfig` interfaces
   - Add query: `getBuildingActions(buildingId)` → `BuildingAction[]`
   - Add CRUD queries: `createBuildingAction`, `updateBuildingAction`, `deleteBuildingAction`
   - Extend `getBuildings(zoneId)` or loader to join actions
3. Extend `shared/protocol/index.ts`:
   - Add `description` and `actions: BuildingActionDto[]` to `CityMapBuilding`
   - Add `BuildingActionDto`, `TravelActionDto` interfaces
   - Add `CityBuildingActionPayload` (client → server)
   - Add `CityBuildingActionRejectedPayload` (server → client)

**Deliverable**: Clean compile on all three packages after migration.

---

### Phase B — Game Backend: Action Handler

**Goal**: Handle `city.building_action` messages server-side with full validation, zone transfer, and structured logging.

**Tasks**:
1. Create `backend/src/game/world/building-action-handler.ts`:
   - Export `handleBuildingAction(session, payload)` function
   - Validate (in order): city map check → combat check → player at building → action exists → destination valid
   - On rejection: send `city.building_action_rejected` with appropriate reason
   - On success: update `characters` row (zone_id, current_node_id), send `world.state` for new zone, broadcast zone-leave/join events, emit structured log
2. Extend `city-map-loader.ts` to load `building_actions` alongside buildings; include in `CityMapData` protocol payload
3. Register handler in `backend/src/index.ts`: `registerHandler('city.building_action', handleBuildingAction)`
4. Extend `city-movement-handler.ts` if needed to ensure the city map cache includes actions when `city.building_arrived` is sent

**Deliverable**: WebSocket round-trip works end-to-end (verifiable via `wscat` or browser DevTools).

---

### Phase C — Admin Backend: Building Actions API

**Goal**: Expose REST endpoints for building description and action CRUD so the admin UI can configure buildings.

**Tasks**:
1. Extend `admin/backend/src/routes/buildings.ts`:
   - Accept `description` in `PUT /api/maps/:id/buildings/:buildingId`
   - Add `GET /api/maps/:id/buildings/:buildingId/actions` → list actions
   - Add `POST /api/maps/:id/buildings/:buildingId/actions` → create action (validate destination zone/node)
   - Add `PUT /api/maps/:id/buildings/:buildingId/actions/:actionId` → update action
   - Add `DELETE /api/maps/:id/buildings/:buildingId/actions/:actionId` → delete action

**Deliverable**: All new endpoints return correct data; `description` persists on building save.

---

### Phase D — Admin Frontend: Building Properties UI

**Goal**: Allow admins to set building description and configure travel actions via the map editor properties panel.

**Tasks**:
1. Extend `admin/frontend/src/ui/properties.ts`:
   - Add **Description** `<textarea>` field below the Name field; auto-saves on blur (same pattern as Name)
   - Add **Actions** section below Description:
     - Lists existing actions with type label and config summary; each has a Delete button
     - **+ Add Action** dropdown (currently only "Travel to Location" option)
   - When "Travel to Location" is selected, render an inline form:
     - **Destination Map** `<select>`: populated by `GET /api/maps` on load; reloads on map change
     - **Destination Node** `<select>`: populated by `GET /api/maps/:id/nodes` when map is chosen
     - **Save** button → calls `POST .../actions`; refreshes action list on success
2. Extend `admin/frontend/src/editor/api.ts` with typed functions for the new action endpoints

**Deliverable**: Admin can create, view, and delete travel actions via the editor UI.

---

### Phase E — Game Frontend: Building Panel & Transition

**Goal**: Implement the in-game building panel and fade animation for map travel.

**Tasks**:
1. Implement `frontend/src/ui/BuildingPanel.ts`:
   - `show(building: CityMapBuilding): void` — replaces stub; renders title, description, and action buttons
   - `hide(): void` — removes panel from DOM or sets invisible
   - Panel is an HTML overlay div positioned to the right of the game canvas (same CSS layer as existing UI bars)
   - Each action renders as a button: label = `action.label` (e.g., "Travel to Harbor")
   - On travel button click: disable all buttons, dispatch `city.building_action` via WebSocket
2. Extend `frontend/src/scenes/GameScene.ts`:
   - In `world.state` handler: pass full building data (with description + actions) to `buildingPanel`
   - In `city.building_arrived` handler: look up building from `cityMapData.buildings` by `building_id`; call `buildingPanel.show(building)`
   - Add handler for `city.building_action_rejected`:
     - Call `camera.fadeIn(300)` immediately
     - Re-enable panel buttons
     - Show brief error text in panel
   - In `world.state` handler when already in a travel transition:
     - Reinitialize city map with new zone data
     - Call `camera.fadeIn(600)` after map is ready
   - Track "in travel" boolean flag; set on travel click, clear on fadeIn complete
3. Travel click sequence in `BuildingPanel.ts`:
   - `camera.fadeOut(600, 0, 0, 0)` via a scene reference passed to panel
   - Send `city.building_action` message
   - `onFadeOutComplete` callback: set `awaitingWorldState = true`; when next `world.state` arrives and `awaitingWorldState` is true → reinit map → `camera.fadeIn(600)`

**Deliverable**: Full end-to-end player flow: enter building → panel appears → click travel → fade animation → new map loads.

---

## Testing Checklist

- [ ] Migration runs cleanly on fresh DB
- [ ] Building with no actions: panel opens showing title + description + "nothing to do here" message
- [ ] Building with travel action: travel button appears with correct label
- [ ] Clicking travel: fade starts, `city.building_action` sent (verify in WS inspector)
- [ ] Server rejects (e.g., player not at building): fade reverses, error shown, buttons re-enabled
- [ ] Server accepts: new `world.state` arrives, map reloads, player positioned at destination node
- [ ] Moving away from building node: panel closes
- [ ] Admin: description field saves and reloads
- [ ] Admin: map dropdown lists all maps; node dropdown updates on map change
- [ ] Admin: travel action saves, appears in action list, can be deleted
- [ ] Destination map/node deleted after action saved: `INVALID_DESTINATION` rejection handled gracefully
- [ ] Structured log emitted on travel execute and rejection
