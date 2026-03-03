# Admin REST API Contracts: Item and Inventory System (007)

**Branch**: `007-item-inventory` | **Base URL**: `http://localhost:4001/api/items` | **Date**: 2026-03-03

All endpoints require `Authorization: Bearer <admin_token>` header.
All request/response bodies are `application/json` unless noted.
Icon upload endpoints use `multipart/form-data`.

---

## Endpoints

### `GET /api/items`

List all item definitions. Optional filter by category.

**Query parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| category | string | No | Filter by item category enum value |

**Response 200**:
```json
[
  {
    "id": 1,
    "name": "Healing Potion",
    "description": "Restores 50 HP.",
    "category": "heal",
    "weapon_subtype": null,
    "attack": null,
    "defence": null,
    "heal_power": 50,
    "food_power": null,
    "stack_size": 10,
    "icon_url": "/item-icons/abc123.png",
    "created_at": "2026-03-03T10:00:00Z"
  }
]
```

`icon_url` is `null` when no icon has been uploaded. Frontend uses a placeholder icon in that case.

---

### `POST /api/items`

Create a new item definition. Icon is optional; send as `multipart/form-data`.

**Content-Type**: `multipart/form-data`

**Fields**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | Yes | Max 64 chars, must be unique |
| description | string | No | Flavour text |
| category | string | Yes | Must be valid category enum |
| weapon_subtype | string | No | Required when category = 'weapon' |
| attack | integer | No | Required when category = 'weapon'; >= 0 |
| defence | integer | No | Required when category is equipment; >= 0 |
| heal_power | integer | No | Required when category = 'heal'; >= 0 |
| food_power | integer | No | Required when category = 'food'; >= 0 |
| stack_size | integer | No | Required when category is stackable; >= 1 |
| icon | file | No | PNG only; max 2 MB |

**Validation rules** (400 if violated):
- `category` must be one of the 9 enum values.
- If `category = 'weapon'`: `weapon_subtype` must be provided and valid.
- If `category != 'weapon'`: `weapon_subtype` must be absent or null.
- `attack` permitted only for `category = 'weapon'`.
- `defence` permitted only for `category` in `['boots', 'shield', 'greaves', 'bracer']`.
- `heal_power` permitted only for `category = 'heal'`.
- `food_power` permitted only for `category = 'food'`.
- `stack_size` required for `category` in `['resource', 'heal', 'food']`; forbidden for others.
- Icon file: PNG only (magic bytes validated); max 2 MB.

**Response 201**:
```json
{
  "id": 5,
  "name": "Iron Sword",
  "description": "A sturdy one-handed sword.",
  "category": "weapon",
  "weapon_subtype": "one_handed",
  "attack": 15,
  "defence": null,
  "heal_power": null,
  "food_power": null,
  "stack_size": null,
  "icon_url": "/item-icons/def456.png",
  "created_at": "2026-03-03T10:05:00Z"
}
```

**Response 400**: `{ "error": "<validation message>" }`
**Response 409**: `{ "error": "Item name already exists" }` (unique constraint violation)

---

### `GET /api/items/:id`

Get a single item definition.

**Response 200**: Same shape as list item object above.
**Response 404**: `{ "error": "Item not found" }`

---

### `PUT /api/items/:id`

Update an existing item definition. Icon is replaced if a new file is uploaded.

**Content-Type**: `multipart/form-data`

**Fields**: Same as POST, all optional. Only provided fields are updated.

**Icon behaviour**:
- If a new `icon` file is provided: old icon file is deleted from disk; new file is written and filename updated in DB.
- If `icon` field is absent: existing icon is unchanged.

**Response 200**: Full updated item definition object.
**Response 400**: Validation error.
**Response 404**: Item not found.

---

### `DELETE /api/items/:id`

Delete an item definition.

**Response 204**: No content.
**Response 404**: Item not found.

**Note**: This does NOT cascade-delete player inventory rows referencing this item. The game frontend handles missing definitions gracefully (shows "Unknown Item" placeholder). This is a documented assumption from the spec.

---

## Error Response Format

All error responses follow:
```json
{ "error": "<human-readable message>" }
```

Standard HTTP status codes:
- `400` — Validation failure (field missing, invalid value, wrong file type)
- `401` — Missing or invalid admin token
- `404` — Resource not found
- `409` — Unique constraint conflict (duplicate name)
- `500` — Internal server error

---

## Admin Backend File Changes

| File | Change |
|------|--------|
| `admin/backend/src/routes/items.ts` | **New** — CRUD router for item definitions + icon upload |
| `admin/backend/src/index.ts` | Mount `itemsRouter` at `/api/items`; add `/item-icons` static route |
| `backend/src/db/queries/inventory.ts` | **New** — Shared query functions (used by both admin and game backend) |

**Note**: `admin/backend/src/routes/items.ts` imports from `backend/src/db/queries/inventory.ts` (following the same cross-package pattern as `routes/upload.ts` importing from `backend/src/db/queries/city-maps.ts`).

---

## Icon Static Serving (Admin Backend)

```typescript
// admin/backend/src/index.ts addition
const iconsDir = path.resolve(__dirname, '../../../backend/assets/items/icons');
app.use('/item-icons', express.static(iconsDir));
```

Icons are stored in the shared `backend/` asset tree so both admin and game backend processes can read/serve them. The admin backend owns writes; the game backend does not write icons.
