# Tasks: NPC System

**Input**: Design documents from `/specs/014-npc-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new asset directory for NPC icons — the only project-level setup needed in an existing monorepo.

- [x] T001 Create `backend/assets/npcs/icons/` directory and add a `.gitkeep` placeholder file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and shared protocol types that ALL user stories depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Create database migration `backend/src/db/migrations/016_npcs.sql` — tables `npcs` (id, name, description, icon_filename, created_at) and `building_npcs` (id, building_id FK→buildings CASCADE, npc_id FK→npcs CASCADE, sort_order, UNIQUE(building_id, npc_id))
- [x] T003 [P] Add `NpcDto` interface (id, name, icon_url) and `npcs: NpcDto[]` field to `CityMapBuilding` in `shared/protocol/index.ts`

**Checkpoint**: Migration and protocol types ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Admin Creates an NPC (Priority: P1) 🎯 MVP

**Goal**: An admin can create, edit, and delete NPCs with name, description, and icon (uploaded or AI-generated) from a new "NPCs" tab in the admin panel.

**Independent Test**: Open the admin panel at `http://localhost:4001`, click the "NPCs" tab, create an NPC with an uploaded icon, verify it appears in the list, edit it, delete it — all without touching any other part of the system.

- [x] T004 [P] [US1] Create `admin/backend/src/routes/npcs.ts` with five endpoints: `GET /` (list all), `POST /` (create — requires name, description, icon_filename; 400 on missing name), `PUT /:id` (update; 404 if not found), `DELETE /:id` (delete — DB CASCADE handles building assignments), `POST /upload` (multer memory-storage, PNG-only validation via magic bytes, UUID filename, write to `backend/assets/npcs/icons/`, return icon_filename + icon_url)
- [x] T005 [P] [US1] Add NPCs tab button to `admin/frontend/src/index.html` (alongside existing Items, Monsters, etc. tab buttons)
- [x] T006 [US1] Register `/npc-icons` Express static route pointing to `backend/assets/npcs/icons/` and mount `npcRoutes` under `/api/npcs` (with `requireAdmin`) in `admin/backend/src/index.ts` (depends on T004)
- [x] T007 [US1] Create `admin/frontend/src/ui/npc-manager.ts` — two-column layout (form left, list right) following the MonsterManager/ItemManager pattern: form fields name + description + icon upload button + AI generate button (reuse `image-gen-dialog.ts`) + icon preview, CRUD operations (create/edit/delete) via `fetch` to `/api/npcs` and `/api/npcs/upload` (depends on T004)
- [x] T008 [US1] Wire the NPCs tab in `admin/frontend/src/main.ts`: lazy-initialize `NpcManager` on first tab click, call `render()` on subsequent clicks (depends on T005, T007)

**Checkpoint**: User Story 1 fully functional — admin can create, view, edit, and delete NPCs with icons.

---

## Phase 4: User Story 2 — Admin Assigns NPCs to a Building (Priority: P2)

**Goal**: In the map editor's building properties panel, an admin can assign any existing NPC to the selected building and remove assignments. Duplicate assignments are prevented.

**Independent Test**: With at least one NPC created (US1), open the map editor, click a building, observe the NPCs section in the properties panel, assign an NPC, verify it appears in the assignment list, remove it, verify it disappears — without touching the game client.

- [x] T009 [US2] Add three NPC assignment endpoints to `admin/backend/src/routes/buildings.ts`: `GET /:buildingId/npcs` (list assigned NPCs with sort_order), `POST /:buildingId/npcs` (assign npc_id; 409 ALREADY_ASSIGNED on duplicate), `DELETE /:buildingId/npcs/:npcId` (remove assignment; 204 No Content)
- [x] T010 [US2] Add a collapsible "NPCs" section to the building properties panel in `admin/frontend/src/ui/properties.ts`: populate a dropdown from `GET /api/npcs`, "Assign" button calling `POST .../npcs`, display assigned NPC list (icon + name) with individual "Remove" buttons calling `DELETE .../npcs/:npcId` (depends on T009)

**Checkpoint**: User Stories 1 and 2 both work independently — NPCs can be created and assigned to buildings.

---

## Phase 5: User Story 3 — Player Sees NPCs in a Building (Priority: P3)

**Goal**: When a player opens a building menu for a building with assigned NPCs, a "You can find here:" section displays each NPC's icon and name. Buildings with no NPCs show no such section. NPC entries are clickable (stub only).

**Independent Test**: With an NPC assigned to a building (US1 + US2 complete), log in as a player, enter the zone, open the building — confirm the "You can find here:" section is visible with the correct NPC icon and name. Open a building with no NPCs — confirm the section is absent.

- [x] T011 [US3] Update the backend `world.state` building query to LEFT JOIN `building_npcs` and `npcs`, aggregate NPC rows per building using `JSON_AGG … FILTER (WHERE n.id IS NOT NULL)` defaulting to `[]`, and map `icon_filename` → `icon_url` (prepend `/npc-icons/`) when constructing `CityMapBuilding` objects — locate the query in `backend/src/game/world/` (likely `world-state-builder.ts` or the `city.move` handler) and extend it
- [x] T012 [US3] Locate the game frontend building panel/menu component in `frontend/src/` (the HTML overlay or Phaser scene element rendered when a player interacts with a building) and add a conditional "You can find here:" section: render only when `building.npcs.length > 0`, list each NPC as a row with `<img>` icon + name text inside a clickable container with a stub click handler (log NPC id to console for future dialog integration) (depends on T003, T011)

**Checkpoint**: All three user stories are independently functional end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories.

- [ ] T013 Run the end-to-end verification checklist from `specs/014-npc-system/quickstart.md` — tick off all items, fix any failures found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **User Story phases (3, 4, 5)**: All depend on Phase 2 completion
  - US1 and US2 are structurally independent but US2 is more useful after US1 (NPCs must exist to assign)
  - US3 depends on US1 and US2 being complete for a meaningful end-to-end test; the code changes themselves only depend on Phase 2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 only — no dependency on US2 or US3
- **US2 (P2)**: Requires Phase 2 only — practically requires US1 for data, but code is independent
- **US3 (P3)**: Requires Phase 2 (protocol types T003) and US1+US2 for a complete end-to-end test; T011 backend change is independent, T012 frontend change requires T003

### Within Each User Story

- T004 and T005 can start in parallel (different packages: admin backend vs admin frontend HTML)
- T006 and T007 can start in parallel after T004 (different files: index.ts vs npc-manager.ts)
- T008 waits for T005 and T007
- T009 and T010 are sequential (UI calls the API)
- T011 and T012 are sequential (frontend consumes the new WS data)

### Parallel Opportunities

- T002 and T003 (Phase 2) can run in parallel
- T004 and T005 (Phase 3 start) can run in parallel
- T006 and T007 (after T004) can run in parallel
- T009 (backend) can be developed in parallel with any Phase 3 tasks (different file)

---

## Parallel Example: User Story 1

```text
# Start in parallel:
T004 — Create admin/backend/src/routes/npcs.ts
T005 — Add tab button to admin/frontend/src/index.html

# After T004 completes, start in parallel:
T006 — Wire routes in admin/backend/src/index.ts
T007 — Create admin/frontend/src/ui/npc-manager.ts

# After T005 + T007 complete:
T008 — Wire tab in admin/frontend/src/main.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003) — **critical blocker**
3. Complete Phase 3: User Story 1 (T004–T008)
4. **STOP and VALIDATE**: Admins can create/edit/delete NPCs with icons in the admin panel
5. Proceed to US2 when MVP is confirmed working

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready
2. Phase 3 (US1) → admin can manage NPCs → validate independently
3. Phase 4 (US2) → admin can assign NPCs to buildings → validate independently
4. Phase 5 (US3) → players see NPCs in building menus → validate end-to-end
5. Phase 6 → quickstart checklist confirms everything works together

---

## Notes

- No tests requested — omitted from all phases
- [P] tasks operate on different files with no blocking dependencies
- T011 file path is approximate — locate the actual worldState building query before editing
- T012 frontend component path is not specified in the plan — locate the building menu/panel component before editing
- Commit after each task or logical group for easy rollback
- The `image-gen-dialog.ts` reuse in T007 is the same dialog used by ItemManager and MonsterManager — no changes to that file needed
