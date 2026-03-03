# Tasks: Item and Inventory System

**Input**: Design documents from `/specs/007-item-inventory/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: No test tasks — not requested in spec. Use the quickstart.md testing checklist for manual validation.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 and can proceed in parallel by separate developers after Phase 2 completes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies between parallel tasks)
- **[Story]**: Which user story this task belongs to (US1–US4 per spec.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize storage directories and environment configuration needed before all other work.

- [x] T001 Create `backend/assets/items/icons/.gitkeep` to initialize icon storage directory (mirrors existing `backend/assets/maps/images/` pattern)
- [x] T002 Add `ADMIN_BASE_URL` env var (default `http://localhost:4001`) to `backend/src/config.ts` — used by game backend to construct icon URLs in WebSocket payloads

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, shared protocol types, and query layer that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Write `backend/src/db/migrations/010_item_inventory.sql` — drop `character_items` then `items` tables; create `item_definitions` (9-category CHECK, weapon_subtype enum, attack/defence/heal_power/food_power/stack_size/icon_filename columns) and `inventory_items` (SERIAL PK, character_id UUID FK, item_def_id INT FK, quantity SMALLINT, created_at) with indexes per data-model.md; inspect `backend/src/db/seeds/initial-data.ts` and remove any INSERT/reference to dropped tables
- [x] T004 [P] Add all new shared types to `shared/protocol/index.ts` per `contracts/websocket-messages.md`: enums `ItemCategory` and `WeaponSubtype`; interfaces `ItemDefinitionDto`, `InventorySlotDto`, `InventoryStatePayload`, `InventoryItemReceivedPayload`, `InventoryFullPayload`, `InventoryDeleteItemPayload`, `InventoryItemDeletedPayload`, `InventoryDeleteRejectedPayload`
- [x] T005 [P] Write `backend/src/db/queries/inventory.ts` — TypeScript interfaces `ItemDefinition` and `InventoryItem`; admin CRUD functions: `getItemDefinitions(category?)`, `getItemDefinitionById(id)`, `createItemDefinition(data)`, `updateItemDefinition(id, data)`, `deleteItemDefinition(id)`; inventory functions: `getInventoryWithDefinitions(characterId)` (JOIN), `getInventorySlotCount(characterId)`, `findStackableSlot(characterId, itemDefId)`, `insertInventoryItem(characterId, itemDefId, quantity)`, `updateInventoryQuantity(slotId, quantity)`, `deleteInventoryItem(slotId, characterId)` returning boolean

**Checkpoint**: Migration applied (start backend to auto-run), shared types compile, query functions export cleanly — user stories can now begin.

---

## Phase 3: User Story 1 — Admin Creates Item Definition (Priority: P1) 🎯 MVP

**Goal**: Administrators can create item definitions of all 9 categories with correct category-specific stats and optional PNG icon via the admin UI. Items appear in the item list immediately after creation.

**Independent Test**: Log into admin UI, navigate to Items tab, create one item of each category (resource, food, heal, weapon with subtype, boots, shield, greaves, bracer, tool), verify each appears in the list with correct name, category, stats, and icon. Create a "Heal" item with stack_size=10 and verify the field is saved.

### Implementation for User Story 1

- [x] T006 [US1] Write `admin/backend/src/routes/items.ts` — `itemsRouter` with: `GET /api/items` (query all via `getItemDefinitions(category?)`, return array with `icon_url` = `/item-icons/{filename}` or null); `GET /api/items/:id` (single, 404 if not found); `POST /api/items` (multer memory storage, PNG-only magic-bytes validation, 2 MB limit, category-specific stat validation per `contracts/admin-rest-api.md`, write icon to `backend/assets/items/icons/{uuid}.png` on success, call `createItemDefinition()`, return 201 with created object); structured JSON logging on all paths; cleanup icon file if DB insert fails
- [x] T007 [US1] Mount `itemsRouter` at `/api/items` AND add `app.use('/item-icons', express.static(iconsDir))` (pointing to `backend/assets/items/icons/`) in `admin/backend/src/index.ts`
- [x] T008 [P] [US1] Add item API client functions to `admin/frontend/src/editor/api.ts`: `getItems(category?: string): Promise<ItemDefinitionResponse[]>`, `getItem(id: number): Promise<ItemDefinitionResponse>`, `createItem(formData: FormData): Promise<ItemDefinitionResponse>` — follow existing `request<T>()` helper pattern with Bearer token header
- [x] T009 [P] [US1] Add "Items" tab to `admin/frontend/index.html` — add a tab bar (`<div id="tab-bar">`) with "Map Editor" and "Items" buttons above the existing editor content; wrap existing editor content in `<div id="map-editor">`; add `<div id="item-manager" style="display:none"></div>`; add tab-switch JS that toggles `display` of `#map-editor` vs `#item-manager`
- [x] T010 [US1] Write `admin/frontend/src/ui/item-manager.ts` — `ItemManager` class: `init(container: HTMLElement)` method; item list rendered as HTML table (columns: Icon preview, Name, Category, Actions); create form below list or in a panel (fields: name, description, category `<select>` that shows/hides stat inputs based on selection — weapon_subtype for weapon; attack for weapon; defence for boots/shield/greaves/bracer; heal_power for heal; food_power for food; stack_size for resource/heal/food; icon file input); form submit calls `createItem(FormData)`, appends new row to table on 201 response, shows error on failure
- [x] T011 [US1] Wire `ItemManager` into `admin/frontend/src/main.ts` — import `ItemManager`, instantiate, call `itemManager.init(document.getElementById('item-manager')!)` on Items tab click, call `getItems()` to populate list on first show

**Checkpoint**: Admin can fully create and list items of all categories via the UI. Verify by creating at least one item per category and checking all fields are stored correctly.

---

## Phase 4: User Story 2 — Player Views and Manages Inventory (Priority: P1)

**Goal**: Players see a permanent inventory panel left of the map showing their items in a grid. Clicking an icon shows a detail panel. Players can delete items. Filtering by category hides/shows relevant icons.

**Independent Test**: Manually INSERT rows into `inventory_items` for a character (via psql, referencing item_definitions created in US1). Connect to the game — verify inventory panel appears left of map with correct icons. Click an icon — verify detail panel shows. Use filter — verify only matching items shown. Delete an item — verify it disappears immediately.

### Implementation for User Story 2

- [x] T012 [P] [US2] Write `backend/src/websocket/handlers/inventory-state-handler.ts` — export `sendInventoryState(session: AuthenticatedSession): Promise<void>`; query `getInventoryWithDefinitions(characterId)`, map each row to `InventorySlotDto` (construct `icon_url` as `config.adminBaseUrl + '/item-icons/' + icon_filename` or null); emit `sendToSession(session, 'inventory.state', { slots, capacity: 20 })`; structured log on send
- [x] T013 [P] [US2] Write `backend/src/game/inventory/inventory-delete-handler.ts` — export `handleInventoryDeleteItem(session, payload)`; validate `payload.slot_id` is a positive integer (emit `inventory.delete_rejected { slot_id, reason: 'NOT_FOUND' }` on bad input); call `deleteInventoryItem(slotId, characterId)` (returns boolean); on true emit `inventory.item_deleted { slot_id }` and log `inventory_item_deleted`; on false emit `inventory.delete_rejected { slot_id, reason: 'NOT_FOUND' }`; log `inventory_delete_rejected` on rejection
- [x] T014 [US2] Update `backend/src/websocket/handlers/world-state-handler.ts` — after the line `sendToSession(session, 'world.state', worldStatePayload)` add `await sendInventoryState(session)` (import from `inventory-state-handler.ts`)
- [x] T015 [US2] Register handler in `backend/src/index.ts` — import `handleInventoryDeleteItem` from `game/inventory/inventory-delete-handler.ts`; add `registerHandler('inventory.delete_item', handleInventoryDeleteItem)`
- [x] T016 [US2] Update `frontend/index.html` — inside `<div id="game">` add `<div id="inventory-panel"></div>` as the first child (before the Phaser canvas target); change `#game` CSS to `display: flex; flex-direction: row;`; add `#inventory-panel` CSS: `width: 220px; flex-shrink: 0; height: 100%; background: #0f0d0a; border-right: 1px solid #5a4a2a; overflow-y: auto; display: flex; flex-direction: column; z-index: 10;`
- [x] T017 [US2] Write `frontend/src/ui/InventoryPanel.ts` — `InventoryPanel` class constructor takes `container: HTMLElement` and `onDeleteItem: (slotId: number) => void` callback; `renderInventory(slots: InventorySlotDto[])` — build filter bar (buttons: "All" + each category; click filters visible grid cells), icon grid (4 columns, up to 20 cells; each cell is a div with `<img src={icon_url}>` or placeholder div if null, `data-slot-id` attribute); `showDetailPanel(slot: InventorySlotDto)` — panel at bottom of `#inventory-panel` showing name, category, weapon_subtype (if set), applicable stats only (attack/defence/heal_power/food_power), delete button that calls `onDeleteItem(slot.slot_id)`; `hideDetailPanel()`; `removeSlot(slotId: number)` — remove matching grid cell, hide detail panel if it showed that slot; icon click → `showDetailPanel(slot)`; filter button click → toggle visibility of grid cells by category
- [x] T018 [US2] Update `frontend/src/scenes/GameScene.ts` — add `private inventoryPanel!: InventoryPanel`; in `create()` instantiate: `this.inventoryPanel = new InventoryPanel(document.getElementById('inventory-panel')!, (slotId) => this.client.send('inventory.delete_item', { slot_id: slotId }))`; register handlers: `this.client.on<InventoryStatePayload>('inventory.state', (p) => this.inventoryPanel.renderInventory(p.slots))`; `this.client.on<InventoryItemDeletedPayload>('inventory.item_deleted', (p) => this.inventoryPanel.removeSlot(p.slot_id))`; `this.client.on<InventoryDeleteRejectedPayload>('inventory.delete_rejected', (p) => { /* re-enable delete button, show error text in detail panel */ })`

**Checkpoint**: Inventory panel visible in game, items display from DB, click/filter/delete all work via WebSocket round-trip.

---

## Phase 5: User Story 3 — Inventory Capacity and Stacking (Priority: P2)

**Goal**: Backend enforces the 20-slot cap and merges stackable items into a single slot up to the admin-defined stack_size. Clients receive real-time updates when items are granted or inventory is full. Stackable slots show a quantity badge on the icon.

**Independent Test**: Use psql to grant items directly via `grantItemToCharacter()` (or call it from a temporary test script). Verify: filling to 20 slots then attempting to add more triggers `inventory.full`; adding a stackable item below cap increments the existing slot's quantity; adding at cap creates a new slot; quantity badge appears on stacked icons.

### Implementation for User Story 3

- [x] T019 [US3] Write `backend/src/game/inventory/inventory-grant-service.ts` — export `grantItemToCharacter(session: AuthenticatedSession, characterId: string, itemDefId: number, quantityToGrant: number): Promise<void>`; load item def via `getItemDefinitionById()`; if `stack_size IS NOT NULL` (stackable): call `findStackableSlot()` — if exists and `quantity + quantityToGrant <= stack_size` call `updateInventoryQuantity()` and emit `inventory.item_received { slot: updatedSlotDto, stacked: true }`; if at cap or non-stackable: check `getInventorySlotCount() < 20`; if full emit `inventory.full { item_name }`; else call `insertInventoryItem()` and emit `inventory.item_received { slot: newSlotDto, stacked: false }`; log `inventory_item_received` or `inventory_full` on each path
- [x] T020 [P] [US3] Update `frontend/src/ui/InventoryPanel.ts` — in icon grid cell rendering add quantity badge: when `slot.quantity > 1` append `<span class="qty-badge">${slot.quantity}</span>` absolutely positioned bottom-right of cell (CSS: `position:absolute; bottom:2px; right:3px; font-size:10px; color:#f0c060; font-family:Rajdhani,sans-serif; font-weight:700`); add `addOrUpdateSlot(slot: InventorySlotDto)` method — find existing grid cell by `data-slot-id`; if found update icon src and quantity badge; if not found append new grid cell; re-apply current filter visibility
- [x] T021 [P] [US3] Update `frontend/src/scenes/GameScene.ts` — register `inventory.item_received` handler: `this.client.on<InventoryItemReceivedPayload>('inventory.item_received', (p) => this.inventoryPanel.addOrUpdateSlot(p.slot))`; register `inventory.full` handler: `this.client.on<InventoryFullPayload>('inventory.full', (p) => { /* append notification to chat log or show 3-second floating toast above inventory panel */ })`

**Checkpoint**: `grantItemToCharacter` exists and can be called by future item-granting systems. Stacking and capacity work correctly. Quantity badges appear. `inventory.full` notification visible in game.

---

## Phase 6: User Story 4 — Admin Edits and Manages Item Definitions (Priority: P3)

**Goal**: Administrators can edit any field of an existing item definition (including replacing the icon), filter the item list by category, and delete item definitions.

**Independent Test**: Create an item via US1, then edit its attack value — verify the new value is saved. Replace the icon — verify the new icon appears in the list. Filter by category — verify only matching items show. Delete an item — verify it is removed from the list.

### Implementation for User Story 4

- [x] T022 [P] [US4] Add `PUT /api/items/:id` and `DELETE /api/items/:id` to `admin/backend/src/routes/items.ts` — PUT: parse multipart form, validate provided fields with same category rules as POST, if new icon file provided delete old icon file (`fs.unlinkSync`) and write new UUID file, call `updateItemDefinition(id, data)`, return 200 with updated object or 404; DELETE: call `deleteItemDefinition(id)`, return 204 or 404; structured logging on all paths
- [x] T023 [P] [US4] Add `updateItem(id: number, formData: FormData): Promise<ItemDefinitionResponse>` and `deleteItem(id: number): Promise<void>` to `admin/frontend/src/editor/api.ts`
- [x] T024 [US4] Extend `admin/frontend/src/ui/item-manager.ts` — add category filter bar above the item list (buttons: "All" + each category label, re-fetches `getItems(category)` on click and re-renders list); add edit mode to form (clicking a table row populates the create form with existing values, shows current icon thumbnail, changes submit button to "Save Changes", submits via `updateItem(id, FormData)`, reverts form to create mode on cancel); add "Delete" button to each table row (confirm dialog, calls `deleteItem(id)`, removes row from list on 204 response)

**Checkpoint**: All 4 admin CRUD operations work. Filter, edit, and delete work correctly via the admin UI.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Icon placeholders, type-safety cleanup, lint pass, final validation.

- [x] T025 [P] Handle `icon_url: null` in `frontend/src/ui/InventoryPanel.ts` — replace `<img>` with a placeholder `<div>` (grey `#2a2520` background, white category initial letter centred, same dimensions as icon) when `slot.definition.icon_url` is null; also add `onerror` handler on `<img>` to swap to the placeholder if the URL fails to load
- [x] T026 [P] Handle `icon_url: null` in `admin/frontend/src/ui/item-manager.ts` — render a grey placeholder square (same approach as T025) in the icon preview column when `icon_url` is null, in both the list and the edit form
- [x] T027 Run `npm run lint` (or `npm test && npm run lint` per CLAUDE.md) across all affected packages — `backend/`, `shared/`, `admin/backend/`, `admin/frontend/`, `frontend/` — fix all TypeScript errors introduced by new files in this feature
- [ ] T028 Manually validate all 7 test scenarios from `specs/007-item-inventory/quickstart.md` testing checklist; mark each item complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)** and **US2 (Phase 4)**: Both depend on Phase 2; can proceed **in parallel** with each other
- **US3 (Phase 5)**: Depends on Phase 2 + Phase 4 (US2) — needs InventoryPanel for `inventory.item_received` display
- **US4 (Phase 6)**: Depends on Phase 2 + Phase 3 (US1) — extends the items route and admin UI
- **Polish (Final)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no dependency on US2/US3/US4
- **US2 (P1)**: Starts after Phase 2 — no dependency on US1/US3/US4
- **US3 (P2)**: Starts after Phase 2 AND US2 complete — needs InventoryPanel to render `inventory.item_received`
- **US4 (P3)**: Starts after Phase 2 AND US1 complete — extends admin backend route and UI

### Within Each User Story

- Backend handlers before WebSocket registration (T012/T013 before T014/T015)
- Shared types (T004) before protocol-typed frontend code
- Query layer (T005) before backend handlers (T012/T013/T019)
- HTML layout (T016) before InventoryPanel (T017) before GameScene wiring (T018)
- Admin route (T006) before admin index mount (T007)
- Admin API client (T008) before admin UI component (T010)

### Parallel Opportunities

**Within Phase 2**:
- T004 (shared types) and T005 (query layer) run in parallel — different files

**Within US1 (Phase 3)**:
- T008 (admin API client) and T009 (HTML tab) run in parallel — different files
- Both can start as soon as Phase 2 is done; T006 can start as soon as T005 is done

**Within US2 (Phase 4)**:
- T012 (inventory-state-handler) and T013 (inventory-delete-handler) run in parallel — different files
- T016 (HTML layout) runs in parallel with T012/T013 — no dependency

**Within US3 (Phase 5)**:
- T020 (InventoryPanel quantity badge) and T021 (GameScene new handlers) run in parallel — different files

**Within US4 (Phase 6)**:
- T022 (backend PUT/DELETE) and T023 (admin API client) run in parallel — different files

---

## Parallel Example: US2 Backend Work

```
After Phase 2 complete → start simultaneously:

Task A: T012 — Write inventory-state-handler.ts
Task B: T013 — Write inventory-delete-handler.ts
Task C: T016 — Update frontend/index.html layout

(Wait for A) → Task D: T014 — Update world-state-handler.ts
(Wait for B) → Task E: T015 — Register handler in index.ts
(Wait for C) → Task F: T017 — Write InventoryPanel.ts
(Wait for F) → Task G: T018 — Update GameScene.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T005) — **must complete before any story**
3. Complete US1 Phase 3 (T006–T011) — Admin can create items
4. Complete US2 Phase 4 (T012–T018) — Player can see and delete inventory
5. **STOP and VALIDATE**: Both stories work independently
6. Demo: Admin creates items → player sees them in inventory → player deletes → panel updates

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 (P1) → Admin item management working
3. Add US2 (P1) → Player inventory panel working → **Demo MVP**
4. Add US3 (P2) → Stacking + capacity + real-time receive
5. Add US4 (P3) → Full admin CRUD with edit/delete/filter

### Parallel Team Strategy (2 developers after Phase 2)

- **Developer A**: US1 (T006–T011) — Admin backend + admin frontend
- **Developer B**: US2 (T012–T018) — Game backend handlers + frontend panel
- Merge when both complete → then tackle US3 together

---

## Notes

- [P] tasks = touch different files, safe to run concurrently
- [Story] label maps each task to the user story it delivers
- No test tasks — use psql for manual data setup during testing; follow quickstart.md checklist for final validation
- Icon null-safety (T025, T026) should be verified during US1/US2 testing, finalized in Polish phase
- `grantItemToCharacter` (T019) has no caller in this feature — it is ready for future use by building rewards or combat loot systems
- The `items.ts` query file (old) can be deleted after migration 010 confirms the new `inventory.ts` covers all needed queries
- Commit after each task or checkpoint; each US phase boundary is a good commit point

---

## Task Count Summary

| Phase | Tasks | Parallel Tasks | Story |
|-------|-------|---------------|-------|
| Phase 1: Setup | 2 | 0 | — |
| Phase 2: Foundational | 3 | 2 | — |
| Phase 3: US1 (P1) | 6 | 2 | US1 |
| Phase 4: US2 (P1) | 7 | 2 | US2 |
| Phase 5: US3 (P2) | 3 | 2 | US3 |
| Phase 6: US4 (P3) | 3 | 2 | US4 |
| Polish | 4 | 2 | — |
| **Total** | **28** | **12** | |
