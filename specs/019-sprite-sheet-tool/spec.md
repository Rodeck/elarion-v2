# Feature Specification: Sprite Sheet Tool

**Feature Branch**: `019-sprite-sheet-tool`
**Created**: 2026-03-18
**Status**: Draft
**Input**: User description: "Introduce sprite sheet images for item sprites. Admin can choose 'Sprite sheet tool' in items page. It opens a modal window where admin can choose a file from PC, then modal shows the image with a grid overlay used to cut the sprite sheet (default 256x256 px cells). Admin can assign items from the item list to each cell — list displays item name, has category filter and text search. After assigning items to cells, admin presses 'Cut' button and the system cuts the sprite sheet into separate item images, saves them, and assigns them to the given items. Admin can change cell size."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload and Preview Sprite Sheet (Priority: P1)

An admin navigates to the items page and clicks the "Sprite Sheet Tool" button. A modal window opens. The admin selects a sprite sheet image file (PNG) from their computer. The modal displays the uploaded image with a grid overlay dividing it into cells. The default cell size is 256x256 pixels. The admin can see exactly how the grid splits the image.

**Why this priority**: This is the foundational interaction — without uploading and previewing the sprite sheet with a grid, no further functionality is possible.

**Independent Test**: Can be fully tested by uploading a sprite sheet PNG and verifying the grid overlay renders correctly with proper cell boundaries.

**Acceptance Scenarios**:

1. **Given** the admin is on the items page, **When** they click "Sprite Sheet Tool", **Then** a modal window opens with a file picker area.
2. **Given** the modal is open, **When** the admin selects a PNG file, **Then** the image displays with a 256x256 pixel grid overlay.
3. **Given** the sprite sheet is displayed with a grid, **When** the image dimensions are not evenly divisible by the cell size, **Then** partial cells at the right/bottom edges are visually indicated as incomplete.

---

### User Story 2 - Assign Items to Grid Cells (Priority: P1)

After loading a sprite sheet with a grid overlay, the admin clicks on any grid cell to assign an item to it. A dropdown/list appears showing all items from the item definitions. The list displays item names, supports category filtering (resource, food, weapon, armor, etc.), and supports text search (e.g., typing "leath" filters to items containing "Leather" in the name). The admin selects an item, and the cell shows the item name as an indicator that the assignment is made.

**Why this priority**: Core functionality — assigning items to cells is the main purpose of the tool. Without this, cutting is meaningless.

**Independent Test**: Can be tested by loading a sprite sheet, clicking a cell, searching/filtering items, and verifying the assignment displays correctly on the cell.

**Acceptance Scenarios**:

1. **Given** a sprite sheet is loaded with a grid, **When** the admin clicks a grid cell, **Then** an item selection interface appears with all existing items listed.
2. **Given** the item selection interface is open, **When** the admin types "leath" in the search field, **Then** only items with "Leather" (case-insensitive) in the name are shown.
3. **Given** the item selection interface is open, **When** the admin selects a category filter (e.g., "armor"), **Then** only items of that category are shown, combinable with text search.
4. **Given** an item is selected for a cell, **Then** the cell displays the item name as a label to confirm the assignment.
5. **Given** a cell already has an assigned item, **When** the admin clicks the cell again, **Then** they can change the assignment or clear it.

---

### User Story 3 - Cut and Save Item Icons (Priority: P1)

After assigning items to one or more grid cells, the admin clicks the "Cut" button. The system extracts each assigned cell region from the sprite sheet as a separate image, saves it as the item's icon, and updates the item's icon reference. Only cells with assigned items are processed — empty cells are skipped.

**Why this priority**: This is the culminating action that delivers the actual value — batch icon assignment from a single sprite sheet.

**Independent Test**: Can be tested by uploading a sprite sheet, assigning 2-3 items to cells, pressing Cut, and verifying each item now has the correct icon extracted from the sprite sheet.

**Acceptance Scenarios**:

1. **Given** the admin has assigned items to 3 cells, **When** they click "Cut", **Then** the system extracts 3 separate images from the sprite sheet at the correct cell positions.
2. **Given** the cut operation completes, **Then** each extracted image is saved and the corresponding item's icon is updated to reference the new image.
3. **Given** some cells are empty (no item assigned), **When** the admin clicks "Cut", **Then** only cells with assigned items are processed.
4. **Given** an assigned item already has an existing icon, **When** the cut operation processes that cell, **Then** the old icon is replaced with the newly extracted image.
5. **Given** the cut operation succeeds, **Then** the admin sees a confirmation indicating how many item icons were successfully updated.

---

### User Story 4 - Adjust Cell Size (Priority: P2)

The admin can change the grid cell dimensions before assigning items. The admin enters custom width and height values (in pixels), and the grid overlay updates to reflect the new cell size. Any existing cell assignments are cleared when the cell size changes.

**Why this priority**: Important for flexibility with different sprite sheet formats, but the default 256x256 covers the most common case.

**Independent Test**: Can be tested by loading a sprite sheet, changing cell size, and verifying the grid redraws with the new dimensions.

**Acceptance Scenarios**:

1. **Given** a sprite sheet is loaded with the default 256x256 grid, **When** the admin changes cell size to 128x128, **Then** the grid overlay redraws with 128x128 cells.
2. **Given** the admin changes cell size, **Then** any previously assigned items are cleared from cells, and the admin is warned before this happens.
3. **Given** the admin enters a cell size larger than the image dimensions, **Then** the system shows a validation error.
4. **Given** the admin enters a cell size of 0 or negative, **Then** the system shows a validation error.

---

### Edge Cases

- What happens when the uploaded file is not a valid image? The system validates the file is a PNG and shows an error if not.
- What happens when the sprite sheet is very large (e.g., 4096x4096)? The modal should scroll or scale the preview to fit while maintaining grid accuracy.
- What happens when the same item is assigned to multiple cells? The system should prevent this — each item can only be assigned to one cell at a time. The last assignment wins and the previous cell is cleared.
- What happens if the network fails during the cut operation? The system should process items atomically per-cell — successfully saved icons remain, and the admin is informed which items failed.
- What happens if the admin closes the modal during the cut operation? The operation continues server-side for any requests already sent; the admin can check item icons afterward.
- What happens when a cell is at the edge and only partially filled? Partial cells are visually indicated but can still be assigned items and cut (the extracted image will be smaller than the cell size).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Sprite Sheet Tool" button on the admin items page that opens a modal window.
- **FR-002**: System MUST allow the admin to upload a PNG image file as a sprite sheet within the modal.
- **FR-003**: System MUST display the uploaded sprite sheet image with a grid overlay in the modal, defaulting to 256x256 pixel cells.
- **FR-004**: System MUST allow the admin to click on any grid cell to open an item selection interface.
- **FR-005**: The item selection interface MUST display all items from the item definitions, showing item names.
- **FR-006**: The item selection interface MUST support filtering items by category (resource, food, heal, weapon, armor types, tool).
- **FR-007**: The item selection interface MUST support text search that filters items by name (case-insensitive, substring match).
- **FR-008**: Category filter and text search MUST be combinable (both active at once).
- **FR-009**: System MUST visually indicate which cells have items assigned, showing the item name on the cell.
- **FR-010**: System MUST prevent assigning the same item to multiple cells simultaneously.
- **FR-011**: System MUST allow the admin to change or clear an item assignment on a cell.
- **FR-012**: System MUST provide cell size inputs allowing the admin to change the grid dimensions (width and height in pixels).
- **FR-013**: Changing cell size MUST redraw the grid and clear all current cell assignments (with a warning to the admin).
- **FR-014**: System MUST validate cell size (positive integers, not exceeding image dimensions).
- **FR-015**: System MUST provide a "Cut" button that extracts each assigned cell as a separate image from the sprite sheet.
- **FR-016**: The cut operation MUST save each extracted image as the item's icon, replacing any existing icon.
- **FR-017**: The cut operation MUST skip cells that have no item assigned.
- **FR-018**: System MUST show a summary after cutting, indicating how many icons were successfully updated.
- **FR-019**: System MUST validate that the uploaded file is a valid PNG image before displaying it.

### Key Entities

- **Sprite Sheet**: A single uploaded PNG image containing multiple item icons arranged in a grid. Temporary — only exists during the modal session, not persisted.
- **Grid Cell**: A rectangular region of the sprite sheet defined by position (row, column) and cell dimensions. Each cell can optionally be assigned to one item definition.
- **Item Definition**: An existing game item that can receive an icon from the sprite sheet. Has a name, category, and optional existing icon. Relationship: one item can be assigned to at most one cell per sprite sheet session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can upload a sprite sheet and assign icons to 20+ items in under 5 minutes (compared to uploading individually one by one).
- **SC-002**: All extracted item icons display correctly in the items list and in-game after cutting.
- **SC-003**: Admin can find any item within 10 seconds using category filter and text search combined.
- **SC-004**: Grid overlay accurately aligns with the sprite sheet pixel boundaries — extracted icons contain exactly the expected pixel region.
- **SC-005**: 100% of assigned cells produce correctly saved item icons with no corruption or dimension mismatch.

## Assumptions

- Only PNG format is supported for sprite sheet uploads (consistent with existing icon handling).
- The sprite sheet file is processed client-side for grid display and cell extraction; the server handles saving individual icon files.
- Cell dimensions use square cells by default (256x256) but support non-square (independent width/height).
- The modal is non-persistent — closing it discards any unsaved work (assignments not yet cut).
- Maximum sprite sheet file size follows the existing upload limit (2 MB) or may need to be increased for larger sheets.
