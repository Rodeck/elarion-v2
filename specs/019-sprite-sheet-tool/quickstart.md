# Quickstart: Sprite Sheet Tool

**Feature Branch**: `019-sprite-sheet-tool`
**Date**: 2026-03-18

## Overview

Add a "Sprite Sheet Tool" button to the admin items page. Opens a modal where the admin uploads a PNG sprite sheet, sees a grid overlay, assigns items to cells, and cuts them into individual icons.

## Architecture

```
Admin Frontend (browser)              Admin Backend (Express)
┌──────────────────────────┐          ┌─────────────────────────┐
│ ItemManager page         │          │ items.ts router         │
│  └─ "Sprite Sheet Tool"  │          │  └─ POST /batch-icons   │
│     └─ SpriteSheetDialog │──JSON──→ │     validate + save PNGs│
│        ├─ Canvas (sheet) │          │     update icon_filename│
│        ├─ Canvas (grid)  │          └─────────────────────────┘
│        ├─ Item picker    │                     │
│        └─ Cut button     │          backend/assets/items/icons/
└──────────────────────────┘            └─ {uuid}.png files
```

**Key principle**: The sprite sheet never leaves the browser. Only extracted cell PNGs (as base64) are sent to the server via the batch endpoint.

## Files to Create

| File | Purpose |
|------|---------|
| `admin/frontend/src/ui/sprite-sheet-dialog.ts` | Modal UI: canvas, grid, item picker, cut logic |
| (modifications to existing files below) | |

## Files to Modify

| File | Change |
|------|--------|
| `admin/frontend/src/ui/item-manager.ts` | Add "Sprite Sheet Tool" button, import and open dialog |
| `admin/backend/src/routes/items.ts` | Add `POST /api/items/batch-icons` endpoint |
| `admin/frontend/src/editor/api.ts` | Add `batchUpdateIcons()` API client function |

## No Changes Needed

- **Database**: No migrations, no new tables or columns
- **Shared protocol**: No WebSocket messages (admin-only REST)
- **Game frontend**: No changes
- **Game backend**: No changes

## Implementation Order

1. **Backend**: Add `POST /api/items/batch-icons` endpoint to `items.ts`
2. **API client**: Add `batchUpdateIcons()` to `api.ts`
3. **Frontend**: Create `SpriteSheetDialog` class
4. **Integration**: Wire "Sprite Sheet Tool" button in `ItemManager`

## Constitution Compliance

- **No REST for game state**: N/A — this is admin tooling, not game state
- **Server-side validation**: Batch endpoint validates PNG format and item existence
- **Structured logging**: Batch endpoint logs operation summary
- **Contract documented**: `contracts/batch-icons-api.md`
- **Graceful rejection**: Frontend handles partial failures from 207 response
- **Complexity justified**: No violations — straightforward CRUD extension
