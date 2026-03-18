# Tasks: Building Item Overlay

**Input**: Design documents from `/specs/018-building-item-overlay/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested — manual testing per quickstart.md.

**Organization**: Tasks grouped by user story. US1 and US2 are combined into one phase because they are both P1 and tightly coupled (the overlay inherently renders color-coded items — you cannot show items without showing their colors).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Backend Endpoint)

**Purpose**: Create the backend data endpoint that all frontend work depends on. No setup phase needed — project structure already exists.

**⚠️ CRITICAL**: No frontend overlay work can begin until this phase is complete.

- [x] T001 Create the building-items route with SQL queries for loot items (building_actions explore → monsters → monster_loot → item_definitions) and craft items (building_npcs → npcs is_crafter → crafting_recipes → item_definitions), returning BuildingItemsResponse JSON per contract, with structured logging and error handling in `admin/backend/src/routes/building-items.ts`
- [x] T002 Register the new route in the Express app — import `buildingItemsRouter` and mount with `app.use('/api/maps', buildingItemsRouter)` after the existing buildings router in `admin/backend/src/index.ts`

**Checkpoint**: `GET /api/maps/:mapId/building-items` returns correct JSON with loot and craft items grouped by building. Verify with curl or browser dev tools.

---

## Phase 2: User Story 1+2 — Toggle Item Overlay with Color-Coded Icons (Priority: P1) 🎯 MVP

**Goal**: Add a toolbar toggle that fetches building items from the backend and renders color-coded item icons next to each building on the canvas. Red/orange borders for loot, blue borders for craft.

**Independent Test**: Open a map with buildings in the editor. Click "Items" in toolbar. Verify colored item icons appear next to buildings. Pan/zoom — icons follow. Click "Items" again — icons disappear.

### Implementation

- [x] T003 [P] [US1] Add `fetchBuildingItems(mapId: number)` function to `admin/frontend/src/editor/api.ts` — calls `GET /api/maps/${mapId}/building-items` via existing `request<T>()` helper, returns typed `BuildingItemsResponse` (define interface in same file matching contract: `{ buildings: Array<{ building_id, building_name, items: Array<{ item_id, item_name, icon_filename, obtain_method, source_name }> }> }`)
- [x] T004 [P] [US1] Add "Items" toggle button to the toolbar actions group in `admin/frontend/src/ui/toolbar.ts` — add a `private itemOverlayButton: HTMLButtonElement` field, create button in `buildActionsGroup()` with text "Items" and `toolbar-btn` class, toggle `toolbar-btn--active` on click, add `setOnItemOverlay(cb: () => void)` callback setter and `setItemOverlayActive(active: boolean)` method (follow existing Configuration toggle pattern)
- [x] T005 [US1] [US2] Add overlay rendering system to `admin/frontend/src/editor/canvas.ts` — add these fields: `private overlayData: Map<number, OverlayBuildingItems> | null = null` (keyed by building_id), `private overlayIcons: Map<string, HTMLImageElement>` (icon cache keyed by filename), `private overlayEnabled: boolean = false`. Add public methods: `setOverlayData(data: BuildingItemsResponse): void` (parses response into overlayData map, preloads all unique icon_filename as `Image()` objects into overlayIcons cache, sets `needsRedraw = true`), `clearOverlay(): void` (sets overlayData to null, sets `needsRedraw = true`). Add private `renderItemOverlay(ctx: CanvasRenderingContext2D): void` method that iterates overlayData, finds matching building by building_id to get node position, draws a grid of item icons offset below/beside the building diamond. Each icon is a 24×24 square drawn with `ctx.drawImage()` from the cached Image object, surrounded by a 2px colored border: `#f87171` for obtain_method==="loot", `#60a5fa` for "craft", `#4ade80` for "found", `#a78bfa` for "bought". Icons arranged in a row wrapping at 6 items per row. Call `renderItemOverlay(ctx)` in the `render()` method after `this.renderBuildings(ctx)` only when `overlayEnabled` is true.
- [x] T006 [US1] Wire the toolbar toggle to the canvas overlay in `admin/frontend/src/main.ts` — in `showEditor()`, after toolbar initialization: call `toolbar.setOnItemOverlay()` with an async handler that toggles overlay state. When enabling: fetch data via `fetchBuildingItems(mapId)`, pass to `canvas.setOverlayData(data)`, update `canvas.overlayEnabled = true`. When disabling: call `canvas.clearOverlay()`, set `canvas.overlayEnabled = false`. Call `toolbar.setItemOverlayActive(state)` to sync button appearance. Store toggle state in a local `let itemOverlayActive = false` variable in `showEditor` scope.

**Checkpoint**: Full overlay toggle works. Loot items show red/orange borders, crafted items show blue borders. Pan/zoom transforms icons correctly. Toggle off removes all overlay visuals.

---

## Phase 3: User Story 3 — Item Identification on Hover (Priority: P2)

**Goal**: Show a tooltip when hovering over an overlay item icon displaying the item name and source (monster or NPC name).

**Independent Test**: Enable overlay, hover over any item icon. Tooltip appears with item name and source. Move mouse away — tooltip disappears.

### Implementation

- [x] T007 [US3] Add tooltip and hit-testing to `admin/frontend/src/editor/canvas.ts` — create a DOM tooltip element (`div` with class `overlay-tooltip`, positioned `absolute`, initially hidden with `display:none`) and append it to the canvas container. On `mousemove` event: transform mouse coordinates to world space using current offsetX/offsetY/scale, iterate overlayData to find if cursor is within any 24×24 icon bounding box (calculate positions same as in renderItemOverlay). If hit: set tooltip `textContent` to `"${item.item_name} — ${item.obtain_method === 'loot' ? 'Loot from' : 'Crafted by'} ${item.source_name}"`, position tooltip near cursor (offset by 12px right and 12px down from mouse position), set `display: block`. If no hit: hide tooltip. On `mouseleave` from canvas: hide tooltip. Ensure tooltip is cleaned up in `destroy()`.
- [x] T008 [US3] Add tooltip styles to `admin/frontend/src/styles.css` — add `.overlay-tooltip` class with: `position: absolute`, `pointer-events: none`, `z-index: 20`, `background: #111520`, `border: 1px solid #2a2f42`, `border-radius: 0.375rem`, `padding: 0.375rem 0.625rem`, `font-size: 0.75rem`, `color: #c8cad6`, `white-space: nowrap`, `box-shadow: 0 4px 12px rgba(0,0,0,0.5)`. Match existing admin UI dark theme styling.

**Checkpoint**: Tooltips appear on hover with correct item name and source. Tooltips disappear when mouse leaves. Tooltips don't interfere with other editor operations.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [x] T009 Handle edge case in `admin/frontend/src/editor/canvas.ts` — when a building has many items (>6), wrap icons into multiple rows (max 6 per row) with 2px gap between rows. Ensure the grid doesn't extend unreasonably far from the building position.
- [x] T010 Verify overlay refresh — in `admin/frontend/src/main.ts`, when overlay is active and user saves the map (toolbar Save button), re-fetch building items data and update the overlay to reflect any changes made during the editing session.
- [ ] T011 Run quickstart.md manual testing checklist to validate all 9 test scenarios pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1+US2)**: Depends on Phase 1 (backend endpoint must exist before frontend can fetch)
- **Phase 3 (US3)**: Depends on Phase 2 (overlay must render before tooltips can be added)
- **Phase 4 (Polish)**: Depends on Phase 2 (minimum); Phase 3 recommended

### Within Phase 2

- T003 (api.ts) and T004 (toolbar.ts) can run in **parallel** — different files, no dependencies
- T005 (canvas.ts) can start in parallel with T003/T004 but is the largest task
- T006 (main.ts) depends on T003, T004, and T005 — wires everything together, must be last

### Within Phase 3

- T007 (canvas tooltip) must come before T008 (styles) logically, but both can be done together
- T008 is a small CSS addition, can be done alongside T007

### Parallel Opportunities

```
Phase 1:  T001 → T002 (sequential — register depends on route file existing)

Phase 2:  T003 ──┐
          T004 ──┼── T006 (wire together)
          T005 ──┘

Phase 3:  T007 + T008 (parallel — different files)

Phase 4:  T009, T010, T011 (independent)
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Complete Phase 1: Backend endpoint
2. Complete Phase 2: Frontend overlay with color coding
3. **STOP and VALIDATE**: Toggle overlay on/off, verify colored icons, test pan/zoom
4. This delivers full US1 + US2 value

### Incremental Delivery

1. Phase 1 → Backend endpoint works → Verify with curl
2. Phase 2 → Overlay toggle with colored icons → MVP complete
3. Phase 3 → Tooltip on hover → Enhanced usability
4. Phase 4 → Polish edge cases → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- US1 and US2 are combined because the overlay inherently renders items with colors — implementing one without the other is not meaningful
- No test tasks generated — spec specifies manual testing
- No database migrations needed — all data computed from existing table joins
- Commit after each phase completion
- T005 is the largest task (canvas overlay rendering) — could be split further during implementation if needed
