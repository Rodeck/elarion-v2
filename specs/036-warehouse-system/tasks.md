# Tasks: Warehouse System

**Input**: Design documents from `/specs/036-warehouse-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket-messages.md

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database schema and shared type definitions

- [x] T001 Create migration file `backend/src/db/migrations/041_warehouse_system.sql` with `warehouse_slots` table, `warehouse_items` table (mirroring inventory_items instance columns), indexes, and ALTER `building_actions` CHECK constraint to include `'warehouse'`
- [x] T002 Add warehouse message type interfaces to `shared/protocol/index.ts`: `WarehouseDepositPayload`, `WarehouseWithdrawPayload`, `WarehouseBulkToInventoryPayload`, `WarehouseBulkToWarehousePayload`, `WarehouseMergePayload`, `WarehouseBuySlotPayload`, `WarehouseStatePayload`, `WarehouseSlotDto`, `WarehouseBuySlotResultPayload`, `WarehouseRejectedPayload`, `WarehouseBulkResultPayload`; add `'warehouse'` to `CityBuildingActionPayload.action_type` union and create `WarehouseActionConfig` (empty object type)

**Checkpoint**: Schema and types ready — foundational work can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that all user stories depend on

**Warning**: No user story work can begin until this phase is complete

- [x] T003 Create `backend/src/db/queries/warehouse.ts` with query functions: `getOrCreateWarehouseSlots(characterId, buildingId)` (lazy init, returns slots record with extra_slots), `getWarehouseItems(characterId, buildingId)` (returns items with joined item_definitions), `getWarehouseItemById(warehouseItemId, characterId)` (single item lookup), `countWarehouseItems(characterId, buildingId)` (used slot count), `getWarehouseCapacity(characterId, buildingId)` (returns 15 + extra_slots)
- [x] T004 Create `backend/src/game/warehouse/warehouse-handler.ts` with skeleton: export a `handleWarehouseMessage(session, type, payload)` function that switches on message type and calls handler functions (stubs for now); import and register in the main message router
- [x] T005 Add `'warehouse'` branch in `backend/src/game/world/building-action-handler.ts`: when `action.action_type === 'warehouse'`, call `getOrCreateWarehouseSlots` and `getWarehouseItems`, then send `warehouse.state` payload to client with `building_id`, `slots` (as `WarehouseSlotDto[]`), `total_capacity`, `used_slots`, `extra_slots_purchased`, and `next_slot_cost` (computed from formula `1000 * (2^(n+1) - 1)`)
- [x] T006 Add `'warehouse'` DTO branch in `backend/src/game/world/city-map-loader.ts`: in the `.map()` callback, add `if (a.action_type === 'warehouse')` that builds a `BuildingActionDto` with label `'Warehouse'` and empty config

**Checkpoint**: Foundation ready — warehouse opens and shows state; user story implementation can begin

---

## Phase 3: User Story 1 — Store and Retrieve Items (Priority: P1) MVP

**Goal**: Players can open a warehouse modal, drag items between inventory and warehouse, and items persist across sessions.

**Independent Test**: Open warehouse at a building, drag item from inventory to warehouse, close modal, reopen — item is still there. Drag it back. Open warehouse at a different building — storage is separate.

### Implementation for User Story 1

- [x] T007 [US1] Implement `deposit` handler in `backend/src/game/warehouse/warehouse-handler.ts`: validate character is at warehouse building, validate inventory slot exists and is unequipped, check warehouse capacity, handle stack merging (find existing warehouse item with same item_def_id if stackable), insert/update `warehouse_items` row, delete/update `inventory_items` row, send updated `warehouse.state` and `inventory:state`; log deposit with structured JSON (character_id, building_id, item_def_id, quantity)
- [x] T008 [US1] Implement `withdraw` handler in `backend/src/game/warehouse/warehouse-handler.ts`: validate character is at warehouse building, validate warehouse item exists and belongs to character, check inventory capacity (max 20 slots), handle stack merging into existing inventory slot, insert/update `inventory_items` row, delete/update `warehouse_items` row, send updated `warehouse.state` and `inventory:state`; log withdrawal
- [x] T009 [US1] Add `insertWarehouseItem`, `updateWarehouseItemQuantity`, `deleteWarehouseItem`, `findStackableWarehouseItem(characterId, buildingId, itemDefId)` query functions in `backend/src/db/queries/warehouse.ts`
- [x] T010 [US1] Create `frontend/src/ui/WarehouseModal.ts` following MarketplaceModal pattern: HTML overlay with z-index 250, two-column grid layout (inventory left, warehouse right), slot rendering showing item icon + quantity + name, close button, header showing "Warehouse — [used]/[total] slots"; export class with `open(buildingId)`, `close()`, `handleState(payload)`, `handleRejected(payload)` methods; constructor takes no args, exposes `setSendFn()`, `setInventorySlotsGetter()`, `setOnOpen()`, `setOnClose()` setters
- [x] T011 [US1] Implement drag-and-drop in `frontend/src/ui/WarehouseModal.ts`: warehouse grid slots listen for `dragover`/`drop` events accepting dragged inventory items (JSON payload `{slot_id}`), send `warehouse.deposit` with `building_id`, `inventory_slot_id`, `quantity`; warehouse items are draggable (set `draggable=true`, `dragstart` sets `{warehouse_slot_id}`); inventory grid area listens for drop of warehouse items, sends `warehouse.withdraw`
- [x] T012 [US1] Wire WarehouseModal in `frontend/src/ui/BuildingPanel.ts`: import WarehouseModal, instantiate in constructor, add `getWarehouseModal()` getter; in `renderNpcPanel()` or action rendering, add warehouse action button that calls `warehouseModal.open(buildingId)` when action_type is `'warehouse'`
- [x] T013 [US1] Wire WarehouseModal in `frontend/src/scenes/GameScene.ts`: get modal via `buildingPanel.getWarehouseModal()`, call `setSendFn`, `setInventorySlotsGetter`, `setOnOpen` (raise inventory z-index to 260, show inventory tab, enable drag), `setOnClose` (reset z-index, disable drag); add message handlers for `warehouse.state` → `warehouseModal.handleState()`, `warehouse.rejected` → `warehouseModal.handleRejected()`

**Checkpoint**: User Story 1 fully functional — deposit, withdraw, persistence, per-building isolation all working

---

## Phase 4: User Story 2 — Bulk Transfer Actions (Priority: P2)

**Goal**: Three bulk buttons: Transfer All to Inventory (left arrow), Transfer All to Warehouse (right arrow), Merge to Warehouse.

**Independent Test**: Place items in both inventory and warehouse, click each bulk button, verify correct items move. Test partial transfer when destination is full.

### Implementation for User Story 2

- [x] T014 [US2] Implement `bulk_to_inventory` handler in `backend/src/game/warehouse/warehouse-handler.ts`: iterate all warehouse items for character+building, attempt to move each to inventory (check capacity, handle stacking), track transferred/skipped counts, send `warehouse.state`, `inventory:state`, and `warehouse.bulk_result` with counts and `partial` flag; log bulk operation
- [x] T015 [US2] Implement `bulk_to_warehouse` handler in `backend/src/game/warehouse/warehouse-handler.ts`: iterate all unequipped inventory items, attempt to move each to warehouse (check capacity, handle stacking), track counts, send state updates and bulk result; log bulk operation
- [x] T016 [US2] Implement `merge` handler in `backend/src/game/warehouse/warehouse-handler.ts`: get set of item_def_ids currently in warehouse, iterate inventory items, transfer only those whose item_def_id is in the set (merge into existing stacks or new slots), track counts, send state updates and bulk result; log merge operation
- [x] T017 [US2] Add bulk action buttons to `frontend/src/ui/WarehouseModal.ts`: three buttons between the inventory and warehouse grids — left arrow ("← All to Inventory"), right arrow ("All to Warehouse →"), merge icon ("Merge ↣"); buttons send `warehouse.bulk_to_inventory`, `warehouse.bulk_to_warehouse`, `warehouse.merge` messages respectively; add `handleBulkResult(payload)` method that shows toast/message with transferred/skipped counts
- [x] T018 [US2] Add `warehouse.bulk_result` message handler in `frontend/src/scenes/GameScene.ts` routing to `warehouseModal.handleBulkResult()`

**Checkpoint**: All three bulk operations work; partial transfers display feedback

---

## Phase 5: User Story 3 — Expand Warehouse Capacity (Priority: P3)

**Goal**: Players can purchase additional warehouse slots using crowns with exponential pricing.

**Independent Test**: New character sees 15 slots, purchases first extra slot for 1000 crowns, sees 16 slots, next costs 3000 crowns. Verify per-warehouse independence.

### Implementation for User Story 3

- [x] T019 [US3] Implement `buy_slot` handler in `backend/src/game/warehouse/warehouse-handler.ts`: compute cost as `1000 * (2^(n+1) - 1)` where n = current extra_slots, validate character has enough crowns, deduct crowns, increment `extra_slots` in `warehouse_slots`, send `warehouse.buy_slot_result` with success/new_total_capacity/extra_slots_purchased/next_slot_cost/new_crowns, then send updated `warehouse.state`; log purchase with cost and new capacity
- [x] T020 [US3] Add `incrementWarehouseSlots(characterId, buildingId)` and `deductCrowns(characterId, amount)` (if not already exists) query functions in `backend/src/db/queries/warehouse.ts`
- [x] T021 [US3] Add slot expansion UI to `frontend/src/ui/WarehouseModal.ts`: below the warehouse grid, show "Expand Storage" button with cost display ("Next slot: 1,000 crowns"), crown icon, click sends `warehouse.buy_slot`; add `handleBuySlotResult(payload)` method that updates capacity display and crown balance; disable button if player crowns < cost (grey out with tooltip)
- [x] T022 [US3] Add `warehouse.buy_slot_result` message handler in `frontend/src/scenes/GameScene.ts` routing to `warehouseModal.handleBuySlotResult()`; also update StatsBar crown display from `new_crowns` field

**Checkpoint**: Slot expansion works with correct pricing; per-warehouse independence verified

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Admin panel support, tooling updates, and documentation per Constitution Principle VI

- [x] T023 [P] Add `'warehouse'` to action type validation in `admin/backend/src/routes/buildings.ts` (~line 265); add `else if (action_type === 'warehouse')` branch in config processing that accepts empty config `{}`
- [x] T024 [P] Add `'warehouse'` to `BuildingAction.action_type` union and `createBuildingAction` parameter's `action_type` union in `admin/frontend/src/editor/api.ts`
- [x] T025 [P] Add `['warehouse', 'Warehouse']` to `actionTypes` array in `admin/frontend/src/ui/properties.ts`; add warehouse fields `<div>` (empty — no config needed), show/hide logic in typeSelect change handler, save handler branch, and display label in action list renderer
- [x] T026 [P] Add `'warehouse'` to `VALID_ACTION_TYPES` array in `scripts/game-entities.js`; update `.claude/commands/game-entities.md` to document the warehouse action type
- [x] T027 [P] Add `warehouse` query command to `scripts/game-data.js`: query `warehouse_items` joined with `item_definitions` and `warehouse_slots`, display per-building item counts and slot capacity; update `.claude/commands/game-data.md` to document the command
- [x] T028 Verify all structured logging is in place across deposit, withdraw, bulk, and buy_slot handlers — each log entry must include character_id, building_id, action details, and outcome
- [x] T029 Run `quickstart.md` validation — walk through setup steps, verify warehouse opens, deposit/withdraw works, bulk operations work, slot expansion works, admin panel can assign warehouse action

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — MVP delivery
- **US2 (Phase 4)**: Depends on Phase 3 (extends warehouse handler and modal)
- **US3 (Phase 5)**: Depends on Phase 3 (extends warehouse handler and modal); independent of US2
- **Polish (Phase 6)**: Can start after Phase 2 for admin tasks (T023-T027); T028-T029 depend on all stories

### User Story Dependencies

- **User Story 1 (P1)**: Requires Foundational phase — no other story dependencies
- **User Story 2 (P2)**: Requires US1 complete (extends the handler and modal created in US1)
- **User Story 3 (P3)**: Requires US1 complete (extends the handler and modal); independent of US2

### Within Each User Story

- Backend handler before frontend UI
- Query functions before handler logic that uses them
- Modal creation before wiring in GameScene

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003 and T004 can overlap (different files, but T005-T006 depend on both)
- T023, T024, T025, T026, T027 can all run in parallel (different files, independent admin/tooling updates)
- US2 and US3 could theoretically run in parallel after US1 (different handler functions), but both modify WarehouseModal.ts so sequential is safer

---

## Parallel Example: User Story 1

```
# After Phase 2 is complete, these can overlap:
T007 + T009: Backend deposit handler + query functions (T009 provides functions T007 calls — write T009 first or together)
T010 + T012: WarehouseModal creation + BuildingPanel wiring (different files, but T012 imports from T010)

# Recommended sequential order within US1:
T009 → T007 → T008 → T010 → T011 → T012 → T013
```

## Parallel Example: Polish Phase

```
# All admin/tooling tasks can run simultaneously:
T023: admin backend buildings route
T024: admin frontend api.ts
T025: admin frontend properties.ts
T026: game-entities script + docs
T027: game-data script + docs
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006)
3. Complete Phase 3: User Story 1 (T007-T013)
4. **STOP and VALIDATE**: Open warehouse, deposit item, close, reopen — item persists. Withdraw. Test different building — separate storage.
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Warehouse opens and shows empty state
2. Add US1 → Deposit/withdraw works → **MVP!**
3. Add US2 → Bulk transfers work → Quality-of-life improvement
4. Add US3 → Slot expansion works → Crown sink active
5. Polish → Admin panel, tooling, logging complete
6. Each story adds value without breaking previous stories

---

## Notes

- All warehouse operations are WebSocket-only (Constitution Gate 1)
- Server validates every transfer atomically (Constitution Gate 2)
- Structured JSON logging on every handler (Constitution Gate 3)
- Contract documented in `contracts/websocket-messages.md` (Constitution Gate 4)
- `warehouse.rejected` messages handle all error cases gracefully (Constitution Gate 5)
- Follow CLAUDE.md "Adding a New Building Action Type" checklist (7 locations + tooling)
- Commit after each task or logical group
