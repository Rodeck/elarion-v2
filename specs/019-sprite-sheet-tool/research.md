# Research: Sprite Sheet Tool

**Feature Branch**: `019-sprite-sheet-tool`
**Date**: 2026-03-18

## R1: Client-Side Sprite Sheet Extraction

**Decision**: Use HTML5 Canvas API for grid rendering and cell extraction.

**Rationale**: The browser Canvas API provides `drawImage()` to render the uploaded PNG, and `toBlob()`/`toDataURL()` to extract rectangular regions as PNG data. This avoids any server-side image processing dependency (no Sharp, Jimp, or ImageMagick needed). The admin frontend already uses Canvas 2D extensively (map editor). Canvas handles arbitrary PNG sizes efficiently.

**Alternatives considered**:
- **Server-side extraction (Sharp/Jimp)**: Adds a Node.js dependency, requires uploading the full sprite sheet to the server, increases complexity. Rejected because client-side extraction is simpler and sufficient for an admin tool.
- **OffscreenCanvas + Web Worker**: Better for large images but adds complexity. Not needed for admin tool with typical sprite sheets (1024x1024 to 4096x4096).

## R2: Backend Approach — Batch vs Individual Updates

**Decision**: Create a new batch endpoint `POST /api/items/batch-icons` that accepts a JSON array of `{ item_id, icon_base64 }` pairs.

**Rationale**: The existing `PUT /api/items/:id` endpoint requires multipart form data and handles one item at a time. Cutting a sprite sheet with 20+ cells would require 20+ sequential HTTP requests, creating poor UX with no atomic success/failure reporting. A batch endpoint processes all items in one request, provides a single summary response, and keeps the interaction snappy.

**Alternatives considered**:
- **Reuse existing PUT per item**: Simpler (no new endpoint) but poor UX for large sheets. Would need client-side progress tracking and partial failure handling across many requests. Rejected for usability reasons.
- **WebSocket for batch**: Overkill for admin tool. Constitution allows REST for non-game-state operations. Rejected.

## R3: Upload Size Limit

**Decision**: The sprite sheet upload is client-side only (never sent to server as a whole). The existing 2 MB multer limit applies only to individual extracted cell icons, which are always small (a single 256x256 PNG is typically 10-100 KB). No limit change needed.

**Rationale**: The sprite sheet file is loaded into a browser `<canvas>` element via `FileReader`. Only the extracted cell PNGs are sent to the batch endpoint as base64. A 4096x4096 sprite sheet loads fine in browser memory but never needs to be uploaded whole.

**Alternatives considered**:
- **Increase multer limit**: Unnecessary since the full sheet never hits the server.
- **Server-side sprite sheet upload + processing**: Would require limit increase and server-side image library. Rejected (see R1).

## R4: Grid Rendering Strategy

**Decision**: Render grid overlay using a second Canvas layer on top of the sprite sheet canvas, with CSS pointer-events for click handling.

**Rationale**: A Canvas overlay allows precise pixel-aligned grid lines and cell labels without DOM element overhead. For a 4096x4096 sheet with 256px cells, that's 256 cells — manageable as canvas drawing but heavy as DOM elements. Click position math (x/y → row/col) is straightforward.

**Alternatives considered**:
- **CSS Grid of `<div>` elements**: Simpler click handling but scales poorly with many cells. 256 overlapping semi-transparent divs would be slow. Rejected.
- **SVG overlay**: Good for vector overlays but no advantage over Canvas here. More complex to set up. Rejected.

## R5: Item Selection UX in Cells

**Decision**: Clicking a cell opens a floating panel/popover anchored near the cell with the item list (search + category filter). Selecting an item assigns it and closes the popover.

**Rationale**: A popover is less disruptive than a nested modal. The admin can see the sprite sheet context while picking items. The item list UI (search + filter) is similar to existing patterns in the codebase (item-manager category filter).

**Alternatives considered**:
- **Dropdown `<select>`**: Can't show categories + search together. Too limited. Rejected.
- **Separate panel always visible**: Takes screen space from the sprite sheet preview. Rejected.

## R6: Preventing Duplicate Item Assignments

**Decision**: Client-side tracking via a `Map<number, {row, col}>` (item_id → cell position). When assigning an item already assigned elsewhere, clear the previous cell automatically.

**Rationale**: Simple client-side enforcement. No server validation needed since the batch endpoint processes the final assignments. The spec says "last assignment wins" — clear the old cell and assign to the new one.

**Alternatives considered**:
- **Block duplicate assignment with error**: Less ergonomic. Admin has to manually clear first. Rejected per spec guidance.
