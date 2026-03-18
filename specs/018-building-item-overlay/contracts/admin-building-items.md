# Contract: Admin Building Items Endpoint

**Feature**: 018-building-item-overlay
**Type**: Admin REST API (not game state — REST permitted per constitution)
**Date**: 2026-03-18

## Endpoint

```
GET /api/maps/:mapId/building-items
```

**Authentication**: Required — `Authorization: Bearer <admin_token>` (same as all admin endpoints)

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| mapId | integer | Yes | The map (zone) ID to fetch building items for |

## Response: 200 OK

```json
{
  "buildings": [
    {
      "building_id": 1,
      "building_name": "Dark Forest",
      "items": [
        {
          "item_id": 5,
          "item_name": "Iron Ore",
          "icon_filename": "iron_ore.png",
          "obtain_method": "loot",
          "source_name": "Forest Wolf"
        },
        {
          "item_id": 12,
          "item_name": "Steel Sword",
          "icon_filename": "steel_sword.png",
          "obtain_method": "craft",
          "source_name": "Blacksmith Gorn"
        }
      ]
    },
    {
      "building_id": 3,
      "building_name": "Town Square",
      "items": []
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| buildings | array | All buildings in the map, including those with no items |
| buildings[].building_id | integer | Building ID (matches canvas building data) |
| buildings[].building_name | string | Building display name |
| buildings[].items | array | Obtainable items at this building |
| buildings[].items[].item_id | integer | Item definition ID |
| buildings[].items[].item_name | string | Item display name |
| buildings[].items[].icon_filename | string | Icon image filename (resolve via admin base URL + `/item-icons/`) |
| buildings[].items[].obtain_method | string | One of: `"loot"`, `"craft"` |
| buildings[].items[].source_name | string | Monster name (for loot) or NPC name (for craft) |

### obtain_method Values

| Value | Description | Color Code |
|-------|-------------|------------|
| `"loot"` | Dropped by monsters via explore building actions | Red/Orange (#f87171) |
| `"craft"` | Crafted by NPC with recipes at this building | Blue (#60a5fa) |

Future values (not currently returned):
- `"found"` — items discoverable by searching (green, #4ade80)
- `"bought"` — items purchasable from shops (purple, #a78bfa)

## Error Responses

### 400 Bad Request
```json
{ "error": "Invalid map id" }
```

### 401 Unauthorized
Handled by `requireAdmin` middleware — token missing or invalid.

### 404 Not Found
```json
{ "error": "Map not found" }
```

### 500 Internal Server Error
```json
{ "error": "Internal server error" }
```

## Notes

- Buildings with no obtainable items are included in the response with an empty `items` array. This allows the frontend to distinguish "no items" from "building not found."
- Items are deduplicated within the same obtain method at the same building. If two monsters at a building both drop the same item, it appears once.
- Items that appear via both loot and craft at the same building appear twice with different `obtain_method` values.
- This endpoint is read-only and does not modify any data.
