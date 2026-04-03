# Tasks: NPC Stat Training via Consumable Items

**Input**: Design documents from `/specs/031-stat-training/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Database migration and shared protocol types that all stories depend on

- [X] T001 Create database migration in `backend/migrations/034_stat_training.sql` — create `stat_training_items` table (id, item_def_id FK, stat_name CHECK, tier CHECK 1-3, base_chance CHECK 1-100, decay_per_level NUMERIC(4,2), npc_id FK, UNIQUE item_def_id) and ALTER `npcs` table to add `trainer_stat TEXT DEFAULT NULL` with CHECK constraint for the 5 stat names
- [X] T002 Add shared protocol types in `shared/protocol/index.ts` — add `StatTrainingOpenPayload`, `StatTrainingAttemptPayload`, `StatTrainingStatePayload`, `StatTrainingItemDto`, `StatTrainingResultPayload` interfaces per contracts/stat-training-messages.md. Add `trainer_stat: string | null` to `NpcDto`. Add message types to ClientMessage union.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend DB queries and NPC data pipeline — MUST complete before user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create DB query module in `backend/src/db/queries/stat-training.ts` — functions: `getTrainingItemsByNpcId(npcId)` returns rows from `stat_training_items` joined with `item_definitions` for name/icon; `getTrainingItemByItemDefId(itemDefId)` returns single row; `createTrainingItem(data)`, `deleteTrainingItem(id)`, `listAllTrainingItems()` for admin CRUD
- [X] T004 Update NPC queries in `backend/src/db/queries/npcs.ts` — add `trainer_stat` to the `Npc` interface, `BuildingNpc` interface, `ZoneNpcRow` interface, and all SELECT column lists in `getNpcsForBuilding()`, `getNpcsForZone()`, and `getNpcById()`
- [X] T005 Update NPC DTO mapping in `backend/src/game/world/city-map-loader.ts` — add `trainer_stat: n.trainer_stat ?? null` to the NPC DTO mapping in the `.map()` callback

**Checkpoint**: Foundation ready — NPC data pipeline includes trainer_stat, DB queries available

---

## Phase 3: User Story 1 — Core Training Mechanic (Priority: P1) MVP

**Goal**: Player can open training modal at a trainer NPC, select an item, and attempt training with success/failure outcome

**Independent Test**: Visit a trainer NPC with a training item in inventory. Click "Train Strength". Select item. Item consumed, result shown, stat updates on success.

### Implementation for User Story 1

- [X] T006 [US1] Create stat training handler in `backend/src/game/training/stat-training-handler.ts` — implement `handleStatTrainingOpen`: validate NPC has `trainer_stat`, check not in combat, query `stat_training_items` by npc_id, check player inventory for matching items, compute success chance per item as `Math.max(5, row.base_chance - character.level * row.decay_per_level)`, send `stat-training.state` message. Implement `handleStatTrainingAttempt`: validate NPC, validate player owns item, validate stat < cap (`10 * (level - 1)`), consume 1x item from inventory, roll `Math.random() * 100 < successChance`, if success increment `attr_<stat>` by 1 and recalculate derived stats using same formulas as `training-handler.ts`, send `stat-training.result` then `stat-training.state`. Export `registerStatTrainingHandlers()`.
- [X] T007 [US1] Register stat training handlers in `backend/src/game/training/stat-training-handler.ts` export and import+call `registerStatTrainingHandlers()` from the game server setup (find where `registerTrainingHandlers()` is called and add adjacent import/call)
- [X] T008 [US1] Create frontend `StatTrainingModal` in `frontend/src/ui/StatTrainingModal.ts` — HTML modal (similar pattern to existing TrainingModal) showing: stat name header, current value / cap display, list of training items with icon + name + tier badge + success % + owned quantity + "Use" button. On "Use" click: send `stat-training.attempt` message. Handle `stat-training.result`: show success (green flash + stat increment animation) or failure (red flash + "no effect" text). Handle `stat-training.state`: refresh item list and stat value. Handle `stat-training.error`: show error message. Style using existing CSS token system (`--color-gold-primary`, `--font-display`, etc.).
- [X] T009 [US1] Add "Train [Stat]" dialog option in `frontend/src/ui/BuildingPanel.ts` — in `renderNpcPanel()`, add check for `npc.trainer_stat`. If set, add dialog option "Train [capitalize(trainer_stat)]" that calls `this.onStatTrainingOpen?.(npc.id, npc.trainer_stat)`. Add callback type, setter `setOnStatTrainingOpen()`, and private field.
- [X] T010 [US1] Wire StatTrainingModal in `frontend/src/scenes/GameScene.ts` — instantiate `StatTrainingModal`, call `buildingPanel.setOnStatTrainingOpen()` to open modal and send `stat-training.open` message. Register WS handlers for `stat-training.state`, `stat-training.result`, `stat-training.error` to forward to modal methods.

**Checkpoint**: Core training mechanic is fully functional — player can train stats via items at NPCs

---

## Phase 4: User Story 2 — Success Probability Display (Priority: P1)

**Goal**: Player sees accurate, level-scaled success percentages for each training item

**Independent Test**: Level 5 character sees ~80% for T1. Level 20 sees ~35% for T1 but ~65% for T2. Level 30+ sees minimum 5% for T1.

**Note**: The probability calculation is implemented in T006 (server-side) and displayed in T008 (frontend). This phase validates and refines.

- [X] T011 [US2] Verify success chance display in `StatTrainingModal` — ensure `success_chance` from `stat-training.state` payload is displayed as `XX%` next to each item. Add color coding: green (>70%), yellow (30-70%), red (<30%). Add tooltip or label showing tier (T1/T2/T3).

**Checkpoint**: Probability display is accurate and visually clear

---

## Phase 5: User Story 3 — Stat Cap Enforcement (Priority: P1)

**Goal**: System prevents training when stat is at cap, without consuming items

**Independent Test**: Character with stat at cap gets rejection message, item not consumed.

**Note**: Cap enforcement is implemented in T006 (server-side). This phase covers frontend feedback.

- [X] T012 [US3] Add cap-reached feedback in `StatTrainingModal` — if `current_value >= per_stat_cap`, disable all "Use" buttons and show message "Your [stat] has reached its maximum for your level." If `per_stat_cap === 0` (level 1), show "Training is available from level 2." Handle `stat-training.error` for cap messages gracefully (no item consumed feedback).

**Checkpoint**: Cap enforcement works end-to-end with clear user feedback

---

## Phase 6: User Story 4 — NPC-Specific Item Filtering (Priority: P2)

**Goal**: Each trainer NPC only shows items mapped to their stat

**Independent Test**: Visit strength trainer with strength + intelligence items — only strength items appear.

**Note**: Server-side filtering is implemented in T006 (query by npc_id). This phase validates frontend display.

- [X] T013 [US4] Add empty-state handling in `StatTrainingModal` — when `items` array is empty, show message "You don't have any items suitable for [stat] training. Craft training items and return." with a list of accepted item names (or generic guidance).

**Checkpoint**: NPC filtering works correctly, empty states handled

---

## Phase 7: User Story 5 — Admin Management (Priority: P2)

**Goal**: Admins can CRUD stat training item mappings via REST API

**Independent Test**: POST a new mapping, GET to verify, DELETE to remove, verify in-game effect.

- [X] T014 [P] [US5] Create admin route in `admin/backend/src/routes/stat-training.ts` — implement: `GET /api/stat-training` (list all with joined item name + NPC name), `POST /api/stat-training` (create with validation: valid item_def_id, valid stat_name, tier 1-3, base_chance 1-100, decay > 0, valid npc_id), `DELETE /api/stat-training/:id` (delete by id). Register route in admin Express app.
- [X] T015 [P] [US5] Add `trainer_stat` toggle to NPC admin in `admin/backend/src/routes/npcs.ts` — add `PUT /api/npcs/:id/trainer-stat` endpoint accepting `{ stat: string | null }` to set/clear trainer_stat on an NPC. Add `trainer_stat` to `npcToResponse()` output.

**Checkpoint**: Admin can fully manage training item configurations

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates, logging, and CLAUDE.md documentation

- [X] T016 [P] Add structured logging to stat training handler in `backend/src/game/training/stat-training-handler.ts` — log `stat_training_open` (characterId, npcId, stat, itemCount), `stat_training_attempt` (characterId, npcId, itemDefId, stat, successChance, success, newValue), `stat_training_rejected` (characterId, reason)
- [X] T017 [P] Add `stat-training` command to `scripts/game-data.js` — query and display all stat_training_items with joined item name, stat, tier, base_chance, decay, NPC name. Format as table.
- [X] T018 [P] Add `create-stat-training-item` command to `scripts/game-entities.js` — accept item_def_id, stat_name, tier, base_chance, decay_per_level, npc_id. POST to admin API. Add validation for stat_name and tier ranges.
- [X] T019 [P] Update CLAUDE.md — add "Adding a New NPC Trainer Stat" checklist documenting the update locations for `trainer_stat` (migration, shared protocol NpcDto, NPC queries, city-map-loader, BuildingPanel dialog option, GameScene wiring, admin NPC routes, admin frontend NPC manager). Reference existing "Adding a New NPC Role" checklist pattern.
- [X] T020 Run migration `034_stat_training.sql` against development database and verify table creation with `\d stat_training_items` and `SELECT trainer_stat FROM npcs LIMIT 1`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migration must exist, protocol types defined)
- **Phase 3 (US1 — Core)**: Depends on Phase 2 (queries + NPC pipeline ready)
- **Phase 4 (US2 — Probability)**: Depends on Phase 3 (modal must exist to refine display)
- **Phase 5 (US3 — Cap)**: Depends on Phase 3 (modal must exist for cap UI)
- **Phase 6 (US4 — Filtering)**: Depends on Phase 3 (modal must exist for empty states)
- **Phase 7 (US5 — Admin)**: Depends on Phase 2 only (can run in parallel with Phase 3-6)
- **Phase 8 (Polish)**: Depends on Phase 3 (handler must exist for logging/tooling)

### User Story Dependencies

- **US1 (Core)**: Blocks US2, US3, US4 — the modal and handler must exist first
- **US2 (Probability)**: Independent refinement of US1 display
- **US3 (Cap)**: Independent refinement of US1 error handling
- **US4 (Filtering)**: Independent refinement of US1 empty states
- **US5 (Admin)**: Independent of all other user stories — only needs Foundational

### Parallel Opportunities

- T001 and T002 are sequential (T002 needs migration context)
- T003, T004, T005 can run in parallel after Phase 1
- T014 and T015 can run in parallel (different files)
- T016, T017, T018, T019 can all run in parallel (different files)
- US5 (Phase 7) can run in parallel with US1 (Phase 3)

---

## Parallel Example: Phase 2 Foundational

```
# These three tasks touch different files and can run simultaneously:
T003: backend/src/db/queries/stat-training.ts (NEW file)
T004: backend/src/db/queries/npcs.ts (existing file)
T005: backend/src/game/world/city-map-loader.ts (existing file)
```

## Parallel Example: Phase 8 Polish

```
# All four tasks touch different files:
T016: backend/src/game/training/stat-training-handler.ts
T017: scripts/game-data.js
T018: scripts/game-entities.js
T019: CLAUDE.md
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + protocol types)
2. Complete Phase 2: Foundational (queries + NPC pipeline)
3. Complete Phase 3: User Story 1 (handler + modal + wiring)
4. **STOP and VALIDATE**: Test training end-to-end at one NPC
5. Run `/gd.execute` to create entities and test full loop

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 (Core) → Training works → MVP!
3. Add US2 (Probability display) + US3 (Cap feedback) + US4 (Empty states) → Polished UX
4. Add US5 (Admin) → Content management ready
5. Polish (logging, tooling, docs) → Production ready

---

## Notes

- Total tasks: 20
- Tasks per user story: US1=5, US2=1, US3=1, US4=1, US5=2, Setup=2, Foundation=3, Polish=5
- Parallel opportunities: 4 groups (Foundation T003-T005, Admin T014-T015, Polish T016-T019, Admin parallel with Core)
- MVP scope: Phases 1-3 (T001-T010) — 10 tasks for a working end-to-end training system
- After code implementation, run `/gd.execute` to create the 15 training items, 3 NPCs, 15 recipes, and stat_training_items mappings
