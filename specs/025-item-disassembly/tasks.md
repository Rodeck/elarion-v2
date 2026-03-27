# Tasks: Item Disassembly System

**Input**: Design documents from `/specs/025-item-disassembly/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US1 and US2 are combined into one phase (kiln is inseparable from core disassembly flow).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and shared protocol types needed by all stories

- [x] T001 Create migration file `backend/src/db/migrations/027_item_disassembly.sql` with: `disassembly_recipes` table, `disassembly_recipe_outputs` table, `item_definitions.disassembly_cost` column, `tool_type` CHECK extension for `'kiln'`, `npcs.is_disassembler` column — per data-model.md
- [x] T002 Add disassembly protocol types to `shared/protocol/index.ts`: `DisassemblyOpenPayload`, `DisassemblyPreviewPayload`, `DisassemblyExecutePayload`, `DisassemblyStatePayload`, `DisassemblyPreviewResultPayload`, `DisassemblyOutputPreview`, `DisassemblyResultPayload`, `DisassemblyReceivedItem`, `DisassemblyRejectedPayload`, `DisassemblyRejectionReason` — per contracts/disassembly-messages.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB query layer and base service that all player-facing and admin stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `backend/src/db/queries/disassembly.ts` with queries: `getRecipesByItemDefId(itemDefId)` returning recipes + outputs joined, `getRecipesForItemDefIds(itemDefIds[])` for batch preview, `getDisassemblyCost(itemDefId)` returning `disassembly_cost`, `getItemDisassemblability(itemDefId)` returning boolean (has recipes)
- [x] T004 Create `backend/src/db/queries/disassembly.ts` admin queries: `createRecipe(itemDefId, chancePercent, sortOrder)`, `deleteRecipesByItemDefId(itemDefId)`, `createRecipeOutput(recipeId, outputItemDefId, quantity)`, `getRecipesWithOutputsForAdmin(itemDefId)` returning full recipe tree for editing

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 3 — Admin: Configure Disassembly Recipes per Item (Priority: P1)

**Goal**: Admins can create/edit item definitions in a modal dialog with disassembly recipe configuration. Chance entries must sum to 100%.

**Independent Test**: Open admin panel → click add/edit item → verify modal opens → add recipe entries → verify 100% validation → save → reload and verify persistence.

### Implementation for User Story 3

- [x] T005 [P] [US3] Add `disassembly_cost` field and disassembly recipe CRUD to item API types in `admin/frontend/src/editor/api.ts`: add `disassembly_cost`, `disassembly_recipes` array to `ItemDefinitionResponse`, add `getDisassemblyRecipes(itemDefId)`, `saveDisassemblyRecipes(itemDefId, recipes[])` API functions, add recipe TypeScript interfaces
- [x] T006 [P] [US3] Add `disassembly_cost` to item create/update validation in `admin/backend/src/routes/items.ts`: accept `disassembly_cost` field in POST/PUT, validate as non-negative integer, persist to DB
- [x] T007 [US3] Add disassembly recipe CRUD endpoints to `admin/backend/src/routes/items.ts`: `GET /api/items/:id/disassembly-recipes` returning full recipe tree, `PUT /api/items/:id/disassembly-recipes` accepting array of chance entries with outputs — validate chance_percent sum = 100%, use transaction to delete-then-reinsert pattern (like crafting ingredients)
- [x] T008 [P] [US3] Add item-modal CSS styles to `admin/frontend/src/styles.css`: `.item-modal-overlay` (fixed, inset 0, z-index 1000), `.item-modal` (max-width 900px, max-height 90vh, flexbox column), `.item-modal-body` (two-column: left for item fields, right for recipe editor), recipe entry rows, output item rows — follow `.item-picker-*` pattern
- [x] T009 [US3] Create `admin/frontend/src/ui/item-modal.ts` — modal dialog replacing inline item form: move all existing form fields from `item-manager.ts` left-panel into modal body left column (name, description, category, conditional stat fields, icon upload/preview, AI icon button), add `disassembly_cost` number input field below existing fields, add close/save/cancel buttons in modal footer, overlay click-to-close, ESC to close
- [x] T010 [US3] Add disassembly recipe editor section to right column of `admin/frontend/src/ui/item-modal.ts`: "Disassembly Recipes" heading, "Add Chance Entry" button, each entry row has: chance_percent input (1-100), remove button, "Add Output" button; each output row has: item picker button (opens existing ItemPickerDialog), quantity input, remove button; live total percentage display with red/green indicator; validation on save (sum must equal 100% if any entries exist, 0 entries = not disassemblable); load existing recipes when editing
- [x] T011 [US3] Update `admin/frontend/src/ui/item-manager.ts`: remove inline left-panel form, replace "Add Item" button with opening `ItemModal` in create mode, replace "Edit" row button with opening `ItemModal` in edit mode passing item data, keep right-panel item list/table/filter unchanged, wire modal save callback to refresh item list

**Checkpoint**: Admin can create/edit items via modal with recipe configuration. Recipes persist correctly.

---

## Phase 4: User Story 4 — Admin: NPC Disassembler Flag (Priority: P2)

**Goal**: Admins can mark NPCs as disassemblers via checkbox. Flag is included in NPC data sent to game client.

**Independent Test**: Open admin NPC editor → toggle "Is Disassembler" → save → verify flag persists on reload.

### Implementation for User Story 4

- [x] T012 [P] [US4] Add `is_disassembler` to NPC CRUD in `admin/backend/src/routes/npcs.ts`: accept `is_disassembler` boolean in POST/PUT, include in SELECT queries, return in response — follow `is_crafter`/`is_quest_giver` pattern
- [x] T013 [P] [US4] Add "Is Disassembler" checkbox to NPC form in admin frontend NPC management UI (likely `admin/frontend/src/ui/npc-manager.ts` or equivalent) — follow pattern of existing `is_crafter` checkbox
- [x] T014 [US4] Include `is_disassembler` in NPC data sent to game frontend: update `backend/src/db/queries/npcs.ts` SELECT to include `is_disassembler`, update NPC DTO in `shared/protocol/index.ts` to include `is_disassembler: boolean` field

**Checkpoint**: NPC disassembler flag configurable in admin and visible in game client NPC data.

---

## Phase 5: User Stories 1+2 — Core Disassembly Flow + Kiln Requirement (Priority: P1)

**Goal**: Players can open disassembly window at disassembler NPCs, drag items and kiln into grid, preview outputs, and execute disassembly with atomic item consumption and output generation. Kiln durability is consumed and enforced.

**Independent Test**: In-game: visit building with disassembler NPC → click "Disassemble" → drag kiln to kiln slot → drag disassemble-eligible items into grid → verify preview summary → click Disassemble → verify items consumed, outputs received, kiln durability reduced.

### Implementation for User Stories 1+2

- [x] T015 [US1] Create `backend/src/game/disassembly/disassembly-service.ts` with: `computePreview(slotIds[], kilnSlotId)` — loads recipes for each item, computes aggregated output ranges (min/max per output item), total cost, total item count, max output slots; `executeDisassembly(characterId, slotIds[], kilnSlotId)` — validates all preconditions (kiln durability, crowns, inventory space), runs chance rolls per item, atomic DB transaction (delete inputs, deduct crowns, reduce kiln durability, destroy kiln if 0, insert/stack outputs), returns result payload; `rollChanceTable(recipes[])` — weighted random selection based on chance_percent
- [x] T016 [US1] Create `backend/src/game/disassembly/disassembly-handler.ts` with handlers: `handleDisassemblyOpen(session, payload)` — validate character, NPC exists with `is_disassembler`, player at building, send `disassembly.state`; `handleDisassemblyPreview(session, payload)` — validate items, compute preview, send `disassembly.preview_result`; `handleDisassemblyExecute(session, payload)` — validate all preconditions, call service, send `disassembly.result` or `disassembly.rejected`; add structured logging for all actions (success + reject with reason)
- [x] T017 [US1] Register disassembly handlers in `backend/src/websocket/dispatcher.ts`: `registerHandler('disassembly.open', handleDisassemblyOpen)`, `registerHandler('disassembly.preview', handleDisassemblyPreview)`, `registerHandler('disassembly.execute', handleDisassemblyExecute)`
- [x] T018 [US1] Create `frontend/src/ui/DisassemblyModal.ts` — HTML overlay modal with: 15-slot item grid (5x3) with drag-and-drop zones accepting inventory items via `dragover`/`drop` (reuse MarketplaceModal pattern with `slot_id` JSON data), dedicated kiln slot (separate drop zone accepting only tool items with `tool_type='kiln'`), kiln durability display (current/max bar), output summary panel showing: list of possible output items with icons + name + min-max quantity range, total crown cost, total item count vs kiln durability, "Disassemble" button (disabled when: no kiln, no items, insufficient durability/crowns/space), "Close" button, drag-out support (items dragged from grid back to inventory)
- [x] T019 [US1] Add disassembler NPC dialog option to `frontend/src/ui/BuildingPanel.ts`: in `renderNpcPanel()`, add `if (npc.is_disassembler)` block creating dialog option `'I want to disassemble some items'` via `buildDialogOption()` — callback calls `this.onDisassemblyOpen?.(npc.id)`, add `setOnDisassemblyOpen(callback)` method, add `getDisassemblyModal()` accessor
- [x] T020 [US1] Wire disassembly messages in `frontend/src/scenes/GameScene.ts`: set `buildingPanel.setOnDisassemblyOpen` callback to open DisassemblyModal and send `disassembly.open`, listen for `disassembly.state` to confirm modal open, listen for `disassembly.preview_result` to update modal output summary, listen for `disassembly.result` to show success (received items) and update inventory, listen for `disassembly.rejected` to show error message in modal; wire DisassemblyModal's preview callback to send `disassembly.preview` on grid change, wire execute callback to send `disassembly.execute`
- [x] T021 [US2] Add kiln validation to `backend/src/game/disassembly/disassembly-service.ts` `executeDisassembly()`: verify kiln_slot_id references a valid inventory item with `tool_type='kiln'`, verify `current_durability >= total_item_quantity`, in atomic transaction: decrement `current_durability` by total quantity, if `current_durability` reaches 0 delete kiln inventory row, return updated kiln slot (or null if destroyed) in result payload
- [x] T022 [US2] Add kiln UI interactions to `frontend/src/ui/DisassemblyModal.ts`: kiln slot accepts only items where `definition.tool_type === 'kiln'`, display durability bar (current/max) when kiln placed, update Disassemble button disabled state based on kiln presence and durability vs total items, handle kiln drag-back-to-inventory, handle kiln destruction result (clear kiln slot, show message), reject non-kiln items dropped on kiln slot

**Checkpoint**: Full disassembly flow works end-to-end with kiln requirement enforced.

---

## Phase 6: User Story 5 — Validation and Error Handling (Priority: P2)

**Goal**: All precondition failures show clear error messages. Non-eligible items rejected from grid. Grid full check.

**Independent Test**: Trigger each error condition: insufficient inventory space, insufficient crowns, non-disassemblable item drag, full grid — verify appropriate message shown each time.

### Implementation for User Story 5

- [x] T023 [US5] Add client-side pre-validation in `frontend/src/ui/DisassemblyModal.ts`: on item drop, check `definition.is_disassemblable` flag (from protocol DTO) — reject with toast message if false; check grid count < 15 — reject if full; on execute button click, check crowns locally before sending (optimistic); show inline error messages in modal (not just console)
- [x] T024 [US5] Add `is_disassemblable` computed field to inventory item DTOs: in `backend/src/game/world/city-map-loader.ts` or inventory query, include boolean field indicating whether item has disassembly recipes configured; add `is_disassemblable?: boolean` to `InventorySlotDto` in `shared/protocol/index.ts`; populate in inventory refresh queries
- [x] T025 [US5] Enhance error display in `frontend/src/ui/DisassemblyModal.ts`: add error message area in modal, display `disassembly.rejected` reason as user-friendly text (map `DisassemblyRejectionReason` codes to messages: `INSUFFICIENT_CROWNS` → "Not enough crowns", `INSUFFICIENT_KILN_DURABILITY` → "Kiln doesn't have enough durability", `INSUFFICIENT_INVENTORY_SPACE` → "Not enough inventory space for outputs", etc.), auto-dismiss after 3 seconds, preserve grid state on rejection (don't clear items)

**Checkpoint**: All validation errors display clear messages. Non-eligible items rejected at drag time.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across all stories

- [x] T026 Verify structured logging in `backend/src/game/disassembly/disassembly-handler.ts`: all open/preview/execute actions logged with character_id, npc_id, item count, outcome (success/reject + reason), kiln durability changes, crowns deducted — per constitution requirement
- [x] T027 Update `scripts/game-entities.js`: add `'kiln'` to `VALID_TOOL_TYPES` array (if exists), update item validation
- [x] T028 Update `.claude/commands/game-entities.md`: document kiln tool type and disassembly_cost field in item creation docs
- [x] T029 Run quickstart.md validation: execute full dev workflow (run migration, create kiln via admin, configure recipes, flag NPC, test in-game disassembly flow end-to-end)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration must exist for query types)
- **US3 Admin Recipes (Phase 3)**: Depends on Phase 2 (needs query layer)
- **US4 NPC Flag (Phase 4)**: Depends on Phase 1 only (migration adds column). Can run in parallel with Phase 3.
- **US1+US2 Core Flow (Phase 5)**: Depends on Phases 2, 3, 4 (needs queries, recipes to exist, NPC flag in protocol)
- **US5 Validation (Phase 6)**: Depends on Phase 5 (enhances existing flow)
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

```
Phase 1 (Setup)
  │
  ├─> Phase 2 (Foundational)
  │     │
  │     ├─> Phase 3 (US3: Admin Recipes)  ──┐
  │     │                                     ├──> Phase 5 (US1+US2: Core Flow) ──> Phase 6 (US5: Validation)
  │     └─> Phase 4 (US4: NPC Flag)  ────────┘
  │
  └─> Phase 7 (Polish) — after all above
```

### Parallel Opportunities

**Within Phase 3** (US3):
- T005 (api types) and T006 (backend cost field) and T008 (CSS) can run in parallel

**Phase 3 + Phase 4** can run in parallel:
- T012, T013 (NPC flag) are independent of T005-T011 (item modal)

**Within Phase 5** (US1+US2):
- T015 (service) and T018 (modal UI) can be developed in parallel, integrated via T020

---

## Parallel Example: Phase 3 (US3)

```bash
# Launch parallel tasks (different files):
Task: T005 "Add recipe API types to admin/frontend/src/editor/api.ts"
Task: T006 "Add disassembly_cost to admin/backend/src/routes/items.ts"
Task: T008 "Add item-modal CSS to admin/frontend/src/styles.css"

# Then sequential (depends on above):
Task: T007 "Add recipe CRUD endpoints to admin/backend/src/routes/items.ts"
Task: T009 "Create admin/frontend/src/ui/item-modal.ts"
Task: T010 "Add recipe editor to item-modal.ts"
Task: T011 "Update item-manager.ts to use modal"
```

## Parallel Example: Phase 5 (US1+US2)

```bash
# Launch parallel tasks (backend + frontend in parallel):
Task: T015 "Create disassembly-service.ts"
Task: T018 "Create DisassemblyModal.ts"

# Then sequential integration:
Task: T016 "Create disassembly-handler.ts"
Task: T017 "Register handlers in dispatcher.ts"
Task: T019 "Add dialog option to BuildingPanel.ts"
Task: T020 "Wire messages in GameScene.ts"
Task: T021 "Add kiln validation to service"
Task: T022 "Add kiln UI to modal"
```

---

## Implementation Strategy

### MVP First (US3 + US4 + US1+US2)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: Foundational (query layer)
3. Complete Phase 3: US3 — Admin recipe config via modal
4. Complete Phase 4: US4 — NPC disassembler flag
5. Complete Phase 5: US1+US2 — Core disassembly + kiln
6. **STOP and VALIDATE**: Test full flow end-to-end via quickstart.md
7. Proceed to Phase 6 (validation polish) and Phase 7 (polish)

### Incremental Delivery

1. Setup + Foundational → DB ready
2. US3 (admin recipes) → Admins can configure disassembly data (**first demo**)
3. US4 (NPC flag) → NPCs can be marked as disassemblers
4. US1+US2 (core flow) → Players can disassemble items (**full MVP**)
5. US5 (validation) → Error handling polished
6. Polish → Logging, docs, final QA

---

## Notes

- US1 and US2 are combined into Phase 5 because kiln mechanics are inseparable from the core disassembly execution flow
- Admin stories (US3, US4) are scheduled before player stories (US1+US2) because they create the data needed for testing
- The item modal refactor (US3) is the largest single task — it moves all existing form fields into a new component
- [P] tasks = different files, no dependencies
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
