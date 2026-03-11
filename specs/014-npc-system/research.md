# Research: NPC System

**Date**: 2026-03-09
**Feature**: 014-npc-system
**Branch**: `014-npc-system`

## Findings

### Decision 1: Admin Panel Integration Pattern

**Decision**: Add a new "NPCs" tab to the existing tab-based admin frontend using the same lazy-loaded manager pattern as Items and Monsters.

**Rationale**: The admin frontend already has `item-manager.ts` and `monster-manager.ts` as the canonical pattern for admin CRUD panels. Both use a two-column layout (form left, list right), lazy initialization on tab click, icon upload + AI generation, and REST API calls via fetch. NPC management is structurally identical (name, description, icon), so deviating would add unnecessary inconsistency.

**Alternatives considered**: A separate admin sub-page or modal flow — rejected because the tab pattern already exists, is tested, and provides a familiar admin UX with zero additional routing infrastructure.

---

### Decision 2: NPC Icon Storage Location

**Decision**: Store NPC icons in `backend/assets/npcs/icons/` served as `/npc-icons/{filename}` from the admin backend's Express static middleware — exactly mirroring the items (`/item-icons/`) and monsters (`/monster-icons/`) pattern.

**Rationale**: All icon assets follow the same pattern: UUID filename, PNG only, stored under `backend/assets/{type}/icons/`, served via a static route in `admin/backend/src/index.ts`. Consistency avoids custom serving logic and keeps all game asset directories co-located.

**Alternatives considered**: Storing in a separate CDN or shared `public/` directory — rejected because the project has no CDN infrastructure and the static serving approach already handles all other assets without issues.

---

### Decision 3: AI Icon Generation Reuse

**Decision**: Reuse the existing `POST /api/ai/generate-image` endpoint with a new image prompt template for NPCs. No new AI infrastructure is required.

**Rationale**: The AI image generation system (`admin/backend/src/routes/ai-generate.ts`, `services/image-gen.ts`) is template-driven. A new prompt template for NPCs (e.g., "Fantasy RPG portrait of {npc_name}, {npc_description}") can be created via the Image Prompts admin panel and reused by the NPC manager's "Generate Icon" dialog — the same `image-gen-dialog.ts` already used by ItemManager and MonsterManager.

**Alternatives considered**: Hardcoded prompt in the NPC route — rejected because the existing template system provides admin control over prompt quality without code changes.

---

### Decision 4: Building–NPC Assignment Storage

**Decision**: Use a dedicated join table `building_npcs (building_id, npc_id)` with a unique constraint on `(building_id, npc_id)` and CASCADE deletes for both foreign keys.

**Rationale**: This is a classic many-to-many relationship. The unique constraint enforces the "no duplicate assignment" requirement. CASCADE deletes ensure that deleting an NPC automatically removes all its building assignments (per FR-009) without application-level cleanup. `sort_order` is added to allow deterministic display ordering in the building menu.

**Alternatives considered**: Storing NPC IDs as a JSONB array on the `buildings` table — rejected because it prevents efficient querying, makes cascade deletes impossible, and complicates the unique-assignment enforcement.

---

### Decision 5: NPC Data Delivery to Game Client

**Decision**: Extend the existing `CityMapBuilding` protocol type with an `npcs: NpcDto[]` field. NPC data for all buildings in a zone is included in the existing `world.state` message payload — no new WebSocket message type is required.

**Rationale**: The `world.state` message already carries the full `buildings` array for the current zone. Adding `npcs` to `CityMapBuilding` means the client already has all NPC data for every building when it enters a zone, enabling instant display when the player clicks a building — no on-demand request needed. This keeps the protocol simple and consistent with the existing data delivery model.

**Alternatives considered**: A new `city.building_open` WS message triggered when the player opens a building — rejected because it adds round-trip latency on every building interaction and requires a new handler, dispatcher registration, and frontend message handler. The existing `world.state`-loaded building data is already sufficient.

---

### Decision 6: Frontend Building Menu NPC Section

**Decision**: Add the "You can find here:" NPC section inside the existing `BuildingPanel` (or equivalent) component in the game frontend. The section renders only when `building.npcs.length > 0`. Each NPC entry is an interactive element with a click handler stubbed for future dialog integration.

**Rationale**: The building menu UI already receives building data from the game state. Adding a conditional NPC section with minimal DOM construction keeps the change localized to the building UI component.

**Alternatives considered**: A separate overlay or modal for NPCs — rejected as over-engineering; the feature only requires a list section within the existing building panel.

---

### Decision 7: Admin Building Assignment UI Location

**Decision**: Extend the existing building properties panel in the map editor (`admin/frontend/src/ui/properties.ts`) with a new "NPCs" collapsible section — identical in pattern to the Building Actions section.

**Rationale**: `properties.ts` already renders building configuration including actions. Adding NPC assignment here keeps all building configuration co-located in one place for the admin. The collapsible pattern (used for loot tables in MonsterManager) scales well to lists of variable length.

**Alternatives considered**: A separate building NPC management screen — rejected because context-switching from the map editor to a separate screen degrades admin workflow. Inline panel editing is the established admin UX for building-level configuration.

---

### Protocol Backward Compatibility

The `CityMapBuilding.npcs` field is additive. Frontend builds predating this change will simply receive the field and can ignore it if unversioned, or the shared protocol package is versioned together (as is the project convention — frontend and backend deploy together per Constitution §V). No version increment on the `v` field is required since this is a payload schema extension, not an envelope change.

---

## Unresolved Questions

None. All design decisions are resolved.
