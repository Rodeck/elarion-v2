# Admin REST API Contracts: AI Image Generation (010)

**Branch**: `010-ai-image-gen` | **Base URL**: `http://localhost:4001` | **Date**: 2026-03-08

All endpoints require `Authorization: Bearer <admin_token>` header (enforced by `requireAdmin` middleware).
All request/response bodies are `application/json` unless noted.

---

## Image Prompt Templates

### `GET /api/image-prompts`

List all saved prompt templates.

**Response 200**:
```json
[
  {
    "id": 1,
    "name": "Fantasy Item Icon",
    "body": "A fantasy RPG item icon of a <ITEM_NAME>. Pixel art style, 64x64, transparent background.",
    "created_at": "2026-03-08T10:00:00Z",
    "updated_at": "2026-03-08T10:00:00Z"
  }
]
```

---

### `GET /api/image-prompts/:id`

Get a single prompt template.

**Response 200**: Single prompt object (same shape as list item above).
**Response 404**: `{ "error": "Prompt not found" }`

---

### `POST /api/image-prompts`

Create a new prompt template.

**Request body**:
```json
{
  "name": "Fantasy Item Icon",
  "body": "A fantasy RPG item icon of a <ITEM_NAME>. Pixel art style, 64x64, transparent background."
}
```

**Validation rules**:
- `name`: required, non-empty, max 128 chars, unique.
- `body`: required, non-empty.

**Response 201**: Created prompt object.
**Response 400**: `{ "error": "<validation message>" }`
**Response 409**: `{ "error": "Prompt name already exists" }`

---

### `PUT /api/image-prompts/:id`

Update an existing prompt template. Only provided fields are updated.

**Request body** (all fields optional):
```json
{
  "name": "Updated Name",
  "body": "Updated body text with <MONSTER_NAME> placeholder."
}
```

**Response 200**: Updated prompt object.
**Response 400**: Validation error.
**Response 404**: Prompt not found.
**Response 409**: Name conflict.

---

### `DELETE /api/image-prompts/:id`

Delete a prompt template.

**Response 204**: No content.
**Response 404**: Prompt not found.

---

## AI Image Generation

### `POST /api/ai/generate-image`

Generate an image using the specified prompt (with placeholders resolved) and the configured model.
The admin backend calls OpenRouter and returns the image data as base64.

**Request body**:
```json
{
  "prompt_id": 1,
  "variables": {
    "ITEM_NAME": "Iron Sword"
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `prompt_id` | integer | Yes | ID of the prompt template to use |
| `variables` | object | Yes | Key-value map of placeholder names → replacement values. Keys match `<KEY>` tokens in the prompt body. |

**Resolved prompt example**: Given body `"A <ITEM_NAME> in pixel art"` and `variables: { "ITEM_NAME": "Iron Sword" }` → resolved to `"A Iron Sword in pixel art"`.

**Response 200**:
```json
{
  "base64": "<base64-encoded PNG data>",
  "resolved_prompt": "A Iron Sword in pixel art",
  "model_used": "google/gemini-2.5-flash-image"
}
```

**Response 400**: `{ "error": "<validation message>" }` — prompt_id missing, variables missing.
**Response 404**: `{ "error": "Prompt not found" }`
**Response 502**: `{ "error": "Image generation failed: <reason>" }` — OpenRouter returned an error or empty response.
**Response 503**: `{ "error": "OpenRouter API key not configured" }` — `OPENROUTER_API_KEY` env var missing.

---

## Item Icon from Base64

The existing `POST /api/items` and `PUT /api/items/:id` endpoints are extended to accept `icon_base64` as an alternative to multipart file upload.

### `POST /api/items` (extended)

**Content-Type**: `multipart/form-data` (unchanged)

**New optional field**:
| Field | Type | Notes |
|-------|------|-------|
| `icon_base64` | string | Base64-encoded PNG. Mutually exclusive with `icon` file field. If both are present, `icon` file takes precedence. |

**Behaviour**: If `icon_base64` is provided and `icon` file is absent, the server decodes the base64, validates PNG magic bytes, generates a UUID filename, and writes the file — identical to a file upload.

**Response**: Unchanged (returns item with populated `icon_url`).

### `PUT /api/items/:id` (extended)

Same extension as POST. Old icon is deleted if `icon_base64` replaces it.

---

## Monster Icon from Base64

### `POST /api/monsters` (extended)

Same `icon_base64` extension as items.

### `PUT /api/monsters/:id` (extended)

Same extension as items.

---

## Admin Config

### `GET /api/admin-config`

Get all system configuration settings. Returns a merged view of DB rows + code defaults.

**Response 200**:
```json
{
  "image_gen_model": "google/gemini-2.5-flash-image"
}
```

Note: If no DB record exists for a key, the code-defined default is returned. The response always contains all known config keys.

---

### `PUT /api/admin-config`

Update one or more config settings. Performs upsert (insert if absent, update if present).

**Request body**:
```json
{
  "image_gen_model": "openai/gpt-5-image"
}
```

**Validation rules**:
- `image_gen_model`: must be one of the 6 supported model IDs.
- Unknown keys are rejected with 400.

**Response 200**: Updated config object (all keys with current values).
**Response 400**: `{ "error": "<validation message>" }`

---

## Error Response Format

All error responses follow:
```json
{ "error": "<human-readable message>" }
```

Standard HTTP status codes:
- `400` — Validation failure
- `401` — Missing or invalid admin token
- `404` — Resource not found
- `409` — Unique constraint conflict
- `500` — Internal server error
- `502` — Upstream API (OpenRouter) error
- `503` — Configuration error (missing API key)

---

## Admin Backend File Changes

| File | Change |
|------|--------|
| `admin/backend/src/routes/image-prompts.ts` | **New** — CRUD for `image_prompt_templates` |
| `admin/backend/src/routes/ai-generate.ts` | **New** — `/api/ai/generate-image` endpoint |
| `admin/backend/src/routes/admin-config.ts` | **New** — GET/PUT for system config |
| `admin/backend/src/services/image-gen.ts` | **New** — OpenRouter HTTP client |
| `admin/backend/src/routes/items.ts` | **Modified** — accept `icon_base64` field |
| `admin/backend/src/routes/monsters.ts` | **Modified** — accept `icon_base64` field |
| `admin/backend/src/index.ts` | **Modified** — mount 3 new routers |
| `backend/src/db/queries/image-prompts.ts` | **New** — shared DB query functions |
| `backend/src/db/queries/admin-config.ts` | **New** — shared DB query functions |
| `backend/src/db/migrations/013_ai_image_gen.sql` | **New** — create 2 new tables |
