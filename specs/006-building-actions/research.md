# Research: Building Actions & Map Travel

**Feature Branch**: `006-building-actions`
**Date**: 2026-03-03
**Status**: Complete — all unknowns resolved

---

## Decision 1: Action Configuration Storage

**Decision**: Store action configuration as `JSONB` in a `building_actions` table with a `action_type` discriminator column.

**Rationale**: The feature introduces only one action type (`travel`) but the spec assumes more types will follow. A single `building_actions` table with a type column and a `config JSONB` column lets new types be added by creating new code paths, without schema migrations. The discriminator column allows efficient DB-level type filtering. This is the idiomatic PostgreSQL pattern for heterogeneous configuration data.

**Alternatives considered**:
- **Separate table per action type** (e.g., `travel_actions`): Cleaner schema per type but requires a join table to list all actions on a building, complicates ordering, and adds schema churn for each new type. Rejected.
- **Single inline columns in `buildings` table** (e.g., `travel_target_zone_id`): Simple but locks the buildings table to specific action types, bloating it with nullable columns per type. Rejected.

---

## Decision 2: Map Transition Animation

**Decision**: Use Phaser 3 Camera `fadeOut` / `fadeIn` for map transition. No CSS blur applied.

**Rationale**: Phaser 3 provides `camera.fadeOut(duration, r, g, b)` and `camera.fadeIn(duration, r, g, b)` as built-in camera post-FX with no additional dependencies. They overlay a coloured alpha overlay on the game canvas and fire completion events. This covers the "fade" requirement in the spec. A blur effect would require either a Phaser pipeline (shader) or CSS `filter: blur()` on the canvas DOM element — both add complexity without proportional UX gain. The fade-to-black-and-back is the standard RPG map transition feel.

**Implementation pattern**:
```
1. Player clicks travel button → button disabled, client sends city.building_action
2. camera.fadeOut(600, 0, 0, 0) starts (fade to black)
3. On fadeOut complete OR on world.state arrival (whichever is later):
   - Swap map content (reinitialize city map with new zone data)
   - camera.fadeIn(600, 0, 0, 0)
4. Buttons re-enabled after fade-in completes
```

**Rejection handling**: If `city.building_action_rejected` arrives before fadeOut completes, call `camera.fadeIn` immediately (cancel black overlay) and show error in panel.

**Alternatives considered**:
- **Phaser Pipeline (GLSL blur)**: Full blur effect possible but requires custom shader, adding ~50 lines of GLSL and pipeline wiring for a single use case. YAGNI. Rejected.
- **CSS filter on canvas**: Works but operates outside Phaser's render loop; can cause visual glitches on DPR-scaled canvases. Rejected.

---

## Decision 3: WebSocket Protocol for Travel Action

**Decision**: New `city.building_action` (Client → Server) message triggers travel. On success, server sends a normal `world.state` message for the new zone. On failure, server sends `city.building_action_rejected`.

**Rationale**: Reusing the existing `world.state` message for zone arrival means the frontend's map-loading code path is identical for initial entry and travel. No new "travel success" message type is needed. The client uses optimistic animation and handles the rejection case by reversing animation state. This is the minimum set of new message types needed.

**Alternatives considered**:
- **New `city.travel_complete` message**: Would carry the new zone data but duplicates `world.state` structure. Rejected.
- **Server-initiated animation timing** (server sends "start animation" message then sends world state after delay): Couples animation duration to server-side timers, making the protocol depend on client render timing. Rejected.

---

## Decision 4: Building Description & Actions in Protocol

**Decision**: Extend `CityMapBuilding` in `world.state` to include `description` and `actions[]`. The `city.building_arrived` message references only `building_id`; the client looks up full data from locally cached map data.

**Rationale**: The client already caches all building data from `world.state`. Repeating full building data in `city.building_arrived` would be redundant. Extending `CityMapBuilding` once ensures actions are available whenever the building panel needs them.

**Travel action label**: The label displayed on the button (e.g., "Travel to Harbor") is computed client-side from the `target_zone_name` field in the action config payload.

---

## Decision 5: Admin API for Building Actions

**Decision**: Add building actions as a nested REST resource under buildings: `GET/POST /api/maps/:mapId/buildings/:buildingId/actions` and `PUT/DELETE /api/maps/:mapId/buildings/:buildingId/actions/:actionId`. Travel destination options (maps and their nodes) reuse the existing `GET /api/maps` and `GET /api/maps/:id/nodes` endpoints.

**Rationale**: Reuses existing endpoints for map and node data, requiring no new endpoints for the dropdown data. Building actions are clearly scoped under their parent building. This follows the pattern already established by nodes and edges endpoints.

---

## Decision 6: City Map Cache Reload After Admin Edit

**Decision**: Extend the existing `reloadCityMap(zoneId)` mechanism in `city-map-loader.ts` to also load building actions when reloading. No new reload mechanism needed.

**Rationale**: The reload function already exists and is called after admin edits via the admin backend's `POST /api/maps/:id/validate` flow (or on-demand). Adding action loading to the same reload path ensures cache consistency.

---

## Codebase Context Summary

| Area | Status |
|------|--------|
| `buildings` DB table | ✅ Exists — needs `description` column |
| Building detection on node arrival | ✅ `city.building_arrived` already sent |
| `BuildingPanel.ts` frontend stub | ✅ Exists — needs full implementation |
| Admin building CRUD | ✅ Exists — needs description + actions extension |
| `world.state` building data | ✅ Already includes buildings — needs description + actions |
| Zone change on server | ⚠️ Needs implementation (player teleport to new zone) |
| `city.building_action` handler | ❌ Does not exist — needs creation |
