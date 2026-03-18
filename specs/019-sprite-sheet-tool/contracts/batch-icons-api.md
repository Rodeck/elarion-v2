# Contract: Batch Item Icons API

**Feature Branch**: `019-sprite-sheet-tool`
**Date**: 2026-03-18
**Type**: Admin REST API (non-game-state — REST is allowed per constitution)

## POST /api/items/batch-icons

Accepts multiple item icon assignments from a sprite sheet cut operation. Each entry contains an item ID and the extracted cell image as base64-encoded PNG.

### Request

**Content-Type**: `application/json`
**Authentication**: Bearer token (admin only)

```json
{
  "icons": [
    {
      "item_id": 12,
      "icon_base64": "<base64-encoded PNG data>"
    },
    {
      "item_id": 7,
      "icon_base64": "<base64-encoded PNG data>"
    }
  ]
}
```

**Validation**:
- `icons` must be a non-empty array, max 256 entries
- Each `item_id` must be a positive integer referencing an existing item_definition
- Each `icon_base64` must decode to a valid PNG (magic bytes check)
- Duplicate `item_id` values in the same request are rejected

### Response — 200 OK

```json
{
  "updated": 2,
  "results": [
    { "item_id": 12, "icon_url": "/item-icons/abc123.png", "status": "ok" },
    { "item_id": 7, "icon_url": "/item-icons/def456.png", "status": "ok" }
  ]
}
```

### Response — 207 Multi-Status (partial success)

```json
{
  "updated": 1,
  "failed": 1,
  "results": [
    { "item_id": 12, "icon_url": "/item-icons/abc123.png", "status": "ok" },
    { "item_id": 999, "error": "Item not found", "status": "error" }
  ]
}
```

### Response — 400 Bad Request

```json
{
  "error": "icons must be a non-empty array"
}
```

### Behavior

1. For each entry in `icons`:
   a. Validate `item_id` exists in `item_definitions`
   b. Decode `icon_base64` and validate PNG magic bytes
   c. Delete existing icon file if item has one
   d. Save new PNG as `{uuid}.png` in `backend/assets/items/icons/`
   e. Update `item_definitions.icon_filename` with new filename
2. Each item is processed independently — one failure doesn't block others
3. Structured log emitted for batch operation with count of updated/failed items

### Size Limits

- Request body: 50 MB (increased from default for base64 bulk data)
- Individual icon: ~2 MB decoded (consistent with existing per-item limit)
- Max icons per request: 256
