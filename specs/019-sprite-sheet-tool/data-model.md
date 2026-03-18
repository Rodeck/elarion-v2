# Data Model: Sprite Sheet Tool

**Feature Branch**: `019-sprite-sheet-tool`
**Date**: 2026-03-18

## Schema Changes

**None.** This feature does not introduce new tables or columns.

The sprite sheet tool operates on the existing `item_definitions.icon_filename` column. The batch endpoint writes individual PNG files to `backend/assets/items/icons/` and updates `icon_filename` — identical to how the existing single-item icon upload works.

## Existing Entities Used

### item_definitions (read + update `icon_filename`)

| Column | Type | Usage |
|--------|------|-------|
| id | SERIAL PK | Identify items for batch icon assignment |
| name | VARCHAR(64) | Display in cell item picker |
| category | VARCHAR | Filter in cell item picker |
| icon_filename | VARCHAR NULL | Updated with new UUID.png after cut |

### Transient State (client-side only, not persisted)

#### SpriteSheetSession
Exists only in browser memory during the modal lifecycle.

| Field | Type | Description |
|-------|------|-------------|
| imageData | HTMLImageElement | The loaded sprite sheet image |
| cellWidth | number | Grid cell width in pixels (default: 256) |
| cellHeight | number | Grid cell height in pixels (default: 256) |
| assignments | Map\<string, number\> | `"row:col"` → item_id mapping |
| reverseMap | Map\<number, string\> | item_id → `"row:col"` for duplicate prevention |

## File System Impact

Extracted icons are saved to `backend/assets/items/icons/` as `{uuid}.png` — same location and naming as existing item icons. Old icon files for re-assigned items are deleted during the batch update (same cleanup logic as existing PUT endpoint).
