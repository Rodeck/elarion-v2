# Tasks: Sprite Sheet Tool

**Input**: Design documents from `/specs/019-sprite-sheet-tool/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1→US2→US3 form a dependency chain (upload→assign→cut). US4 is independent after US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: No new project scaffolding needed. Create the new dialog file shell and wire the entry point.

- [x] T001 [P] Create `SpriteSheetDialog` class shell (constructor, `open()`, `close()`, private container/overlay setup) in `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T002 [P] Add "Sprite Sheet Tool" button to the right column header area in `admin/frontend/src/ui/item-manager.ts` — import `SpriteSheetDialog`, instantiate it, wire button click to `dialog.open()`

**Checkpoint**: Clicking "Sprite Sheet Tool" on items page opens an empty modal overlay. Closing works.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend batch endpoint and API client — needed before US3 (Cut) can work, but built early so frontend and backend can develop in parallel.

**CRITICAL**: The batch endpoint must be complete before the Cut operation (US3) can be integrated.

- [x] T003 [P] Add `POST /api/items/batch-icons` endpoint in `admin/backend/src/routes/items.ts` — accept JSON body `{ icons: [{ item_id, icon_base64 }] }`, validate array non-empty (max 256), validate each item_id exists, validate PNG magic bytes on decoded base64, delete old icon if present, save new `{uuid}.png` to `backend/assets/items/icons/`, update `icon_filename` in DB, return `{ updated, failed?, results }` with per-item status, emit structured log. Increase JSON body limit to 50 MB for this route. Handle partial failures with 207 status per `contracts/batch-icons-api.md`.
- [x] T004 [P] Add `batchUpdateIcons(icons: Array<{ item_id: number; icon_base64: string }>)` function in `admin/frontend/src/editor/api.ts` — POST to `/api/items/batch-icons` with JSON body, return typed response matching contract.

**Checkpoint**: `batchUpdateIcons()` can be called from browser console with test data and successfully updates item icons.

---

## Phase 3: User Story 1 — Upload and Preview Sprite Sheet (Priority: P1) MVP

**Goal**: Admin uploads a PNG sprite sheet and sees it displayed with a 256x256 grid overlay in the modal.

**Independent Test**: Open modal → select PNG file → verify image displays with grid lines at 256px intervals.

### Implementation for User Story 1

- [x] T005 [US1] Add file upload area to `SpriteSheetDialog` modal — file input (accept=".png,image/png"), drag-and-drop zone, load selected file via `FileReader.readAsDataURL()`, create `HTMLImageElement` from result, store image reference. Show error if file is not valid PNG. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T006 [US1] Add sprite sheet canvas rendering — create a `<canvas>` element sized to image dimensions, draw loaded image with `ctx.drawImage()`. Wrap canvas in a scrollable container div (for large images). Show canvas area only after image loads. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T007 [US1] Add grid overlay rendering — draw grid lines on a second overlay `<canvas>` (same size, positioned absolutely over the sprite sheet canvas). Default cell size 256x256. Draw lines with semi-transparent color. Label partial cells at right/bottom edges with different styling (dashed lines or dimmed). Store `cellWidth` and `cellHeight` as instance state. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`

**Checkpoint**: Upload a sprite sheet PNG → see it displayed in the modal with a 256x256 grid. Partial edge cells are visually distinct.

---

## Phase 4: User Story 2 — Assign Items to Grid Cells (Priority: P1)

**Goal**: Admin clicks grid cells to assign items from a searchable, filterable item list. Assigned cells show item name labels.

**Independent Test**: Click a cell → item picker opens → search/filter → select item → cell shows item name. Click another cell → assign same item → first cell clears.

**Depends on**: US1 (grid must be rendered)

### Implementation for User Story 2

- [x] T008 [US2] Add click handler on the grid overlay canvas — convert mouse (x, y) to (row, col) based on `cellWidth`/`cellHeight`. Store clicked cell coordinates. Open item picker popover near the clicked cell position. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T009 [US2] Build item picker popover UI — floating `<div>` anchored near clicked cell. Contains: category `<select>` dropdown (all, resource, food, heal, weapon, helmet, chestplate, boots, shield, greaves, bracer, tool), text `<input>` for name search, scrollable item list `<div>`. Fetch items via `getItems()` on popover open. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T010 [US2] Implement item filtering logic — filter loaded items by category (if not "all") AND by name substring (case-insensitive). Re-render item list on every filter/search change. Each item row shows item name and is clickable. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T011 [US2] Implement cell assignment tracking — maintain `assignments: Map<string, number>` (`"row:col"` → item_id) and `reverseMap: Map<number, string>` (item_id → `"row:col"`). On item selection: if item already assigned elsewhere, clear that cell first. Store assignment, close popover. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T012 [US2] Render assignment labels on grid — after each assignment change, redraw the grid overlay canvas. For assigned cells, draw a semi-transparent background and the item name text (truncated if needed). For the clicked/active cell, show a highlight border. Support clearing an assignment by clicking an assigned cell and choosing "Clear" in the popover. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`

**Checkpoint**: Can assign items to cells with search/filter, see labels, reassign moves the item, clear works.

---

## Phase 5: User Story 3 — Cut and Save Item Icons (Priority: P1)

**Goal**: Admin presses "Cut" and all assigned cells are extracted as individual PNGs, sent to the server, and saved as item icons.

**Independent Test**: Assign 3 items to cells → press Cut → verify items page shows new icons for those items.

**Depends on**: US2 (assignments must exist), Phase 2 (batch endpoint)

### Implementation for User Story 3

- [x] T013 [US3] Add "Cut" button to modal footer — enabled only when at least one cell has an assignment. Show assignment count on button (e.g., "Cut 5 icons"). File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T014 [US3] Implement cell extraction logic — on Cut click, iterate all assignments. For each assigned cell: create a temporary `<canvas>` sized to `cellWidth x cellHeight` (or smaller for edge partial cells), `drawImage()` the source sprite sheet region onto it, call `canvas.toDataURL('image/png')` to get base64 string (strip the `data:image/png;base64,` prefix). Collect all `{ item_id, icon_base64 }` entries. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T015 [US3] Call batch API and handle response — call `batchUpdateIcons()` with collected entries. Show a loading indicator during the request. On success (200): show summary "Updated N item icons". On partial success (207): show summary "Updated N, failed M" with details of failed items. On error: show error message. After success, close modal and trigger item list refresh in `ItemManager`. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T016 [US3] Wire modal close callback to `ItemManager` — pass a callback from `ItemManager` to `SpriteSheetDialog` constructor (or use an event) so that after a successful cut, `ItemManager.load()` is called to refresh the items list with new icons. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts` and `admin/frontend/src/ui/item-manager.ts`

**Checkpoint**: Full flow works end-to-end: upload sheet → assign items → cut → items show new icons in list.

---

## Phase 6: User Story 4 — Adjust Cell Size (Priority: P2)

**Goal**: Admin can change grid cell dimensions before assigning items.

**Independent Test**: Load sprite sheet → change cell size to 128x128 → grid redraws with more cells.

**Depends on**: US1 (grid rendering)

### Implementation for User Story 4

- [x] T017 [US4] Add cell size inputs to modal — two number inputs (width, height) with default values 256. Place above or beside the canvas area. Validate: positive integers, not exceeding image dimensions, minimum 16px. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T018 [US4] Wire cell size change to grid redraw — on cell size input change (with debounce ~300ms): if there are existing assignments, show a confirm dialog warning they will be cleared. If confirmed (or no assignments), update `cellWidth`/`cellHeight`, clear all assignments and reverseMap, redraw grid overlay. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`

**Checkpoint**: Changing cell size redraws the grid correctly, warns about clearing assignments, and resets the state.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: UX refinements and edge case handling across all stories.

- [x] T019 Style the sprite sheet modal with consistent admin panel CSS — modal overlay, scrollable canvas container, popover positioning, button styles, loading states. Match existing admin panel aesthetics (dark theme, gold accents per `image-gen-dialog.ts` patterns). File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`
- [x] T020 Handle edge cases — very large sprite sheets (add max-height with scroll), file validation error messages, empty sprite sheet (no valid cells), network errors during cut, browser memory for large images. File: `admin/frontend/src/ui/sprite-sheet-dialog.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: No dependencies on Phase 1 — can run in parallel with Setup
- **US1 (Phase 3)**: Depends on Phase 1 (dialog shell exists)
- **US2 (Phase 4)**: Depends on US1 (grid must be rendered to click cells)
- **US3 (Phase 5)**: Depends on US2 (assignments) AND Phase 2 (batch endpoint)
- **US4 (Phase 6)**: Depends on US1 (grid rendering) — can run in parallel with US2/US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) ──┬──→ Phase 3 (US1) ──→ Phase 4 (US2) ──→ Phase 5 (US3) ──→ Phase 7 (Polish)
                   │                  ╰──→ Phase 6 (US4) ─────────────────────╯
Phase 2 (Backend) ─────────────────────────────────────────→ Phase 5 (US3)
```

### Within Each Phase

- Tasks marked [P] can run in parallel
- Sequential tasks depend on the prior task in the same phase

### Parallel Opportunities

- **T001 + T002**: Different files (dialog vs item-manager)
- **T003 + T004**: Different packages (backend vs frontend)
- **Phase 1 + Phase 2**: Entirely independent (frontend shell vs backend endpoint)
- **US4 (Phase 6) can start as soon as US1 completes**, in parallel with US2/US3

---

## Parallel Example: Setup + Backend

```bash
# These can all run simultaneously:
Task T001: "Create SpriteSheetDialog class shell in admin/frontend/src/ui/sprite-sheet-dialog.ts"
Task T002: "Add Sprite Sheet Tool button in admin/frontend/src/ui/item-manager.ts"
Task T003: "Add POST /api/items/batch-icons endpoint in admin/backend/src/routes/items.ts"
Task T004: "Add batchUpdateIcons() in admin/frontend/src/editor/api.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Backend (T003-T004) — can run in parallel with Phase 1
3. Complete Phase 3: US1 — Upload & Preview (T005-T007)
4. Complete Phase 4: US2 — Assign Items (T008-T012)
5. Complete Phase 5: US3 — Cut & Save (T013-T016)
6. **STOP and VALIDATE**: Full end-to-end flow works with default 256x256 cells
7. Deploy/demo — MVP is usable

### Incremental Delivery

1. Setup + Backend → Foundation ready
2. US1 (Upload & Preview) → Admin can see sprite sheets with grid → Demo
3. US2 (Assign Items) → Admin can assign items to cells → Demo
4. US3 (Cut & Save) → Full flow works end-to-end → **MVP Deploy**
5. US4 (Adjust Cell Size) → Flexibility for different sprite sheet formats
6. Polish → Production-ready UX

---

## Notes

- All US3 implementation is in the same file (`sprite-sheet-dialog.ts`) so T013→T014→T015 are sequential
- The batch endpoint (T003) is the only backend change — everything else is admin frontend
- No database migrations needed
- No game frontend/backend changes needed
- Item picker reuses the same `getItems()` API and category constants already in the codebase
