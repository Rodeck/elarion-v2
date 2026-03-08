# Research: AI Image Generation (010)

**Branch**: `010-ai-image-gen` | **Date**: 2026-03-08

---

## Decision 1: OpenRouter Image Generation API Format

**Decision**: Use OpenRouter's `/api/v1/chat/completions` (text+image) or `/api/v1/images/generations` endpoint with `response_format: { type: "b64_json" }`.

**Rationale**: OpenRouter follows the OpenAI API contract. For image-generation models (`google/gemini-*-image`, `openai/gpt-5-image*`), the endpoint is `POST https://openrouter.ai/api/v1/images/generations`. Requesting `b64_json` returns a base64-encoded PNG payload rather than a hosted URL, which means we control the lifecycle of the image and don't depend on an external URL expiring. The admin backend decodes the base64, validates PNG magic bytes, writes the file to disk (same path as uploaded icons), and returns the resulting `icon_url` to the frontend.

**Alternatives considered**:
- **Return URL from OpenRouter**: URLs may expire or be hosted externally; not suitable for game assets.
- **Stream binary directly**: More complex; base64 is simpler in JSON transport.
- **Frontend-to-OpenRouter direct call**: Would expose the API key in the browser. Rejected for security.

---

## Decision 2: Image Storage for AI-Generated Images

**Decision**: Store AI-generated images on the same filesystem paths as manually uploaded images (`backend/assets/items/icons/` and `backend/assets/monsters/icons/`). Use a UUID filename with `.png` extension, identical to the upload flow.

**Rationale**: Reusing the existing file serving infrastructure (`/item-icons/` and `/monster-icons/` static routes) requires no new storage mechanism. The item/monster `icon_filename` column in the DB stores the filename regardless of origin. From the game backend's perspective, there is no difference between an uploaded and a generated image.

**Alternatives considered**:
- **Separate directory for AI images**: Adds complexity with no benefit; makes cleanup harder.
- **Store base64 in DB**: Inflates the database; image files should stay on disk.

---

## Decision 3: Generate → Preview → Accept Flow

**Decision**: Two-step flow:
1. `POST /api/ai/generate-image` — Admin backend resolves placeholders, calls OpenRouter, receives base64 image, returns it as JSON `{ "base64": "..." }` to the admin frontend.
2. On Accept, the frontend sends a `POST /api/items` or `PUT /api/items/:id` request with a new `icon_base64` field (base64 PNG) in addition to or instead of a multipart file upload. The backend decodes, validates, and saves identically to a file upload.

**Rationale**: Separating generation from save allows the admin to preview without committing. Adding `icon_base64` as an alternative input to item/monster create/update keeps the storage logic in one place (no separate "save AI image" endpoint needed).

**Alternatives considered**:
- **Save image on generation, return temp filename**: Clutters storage with orphaned images if admin cancels.
- **Send base64 to a separate `/accept` endpoint**: Requires an extra round trip and more endpoints.

---

## Decision 4: Admin Config Storage with Code Defaults

**Decision**: Store admin config in a `admin_config` table as key-value pairs. All keys have code-defined defaults in a TypeScript constants map. Reading config: fetch from DB; fall back to code default if row absent. Writing config: upsert the row.

**Rationale**: This means a fresh database has zero rows in `admin_config` but all settings work immediately using hardcoded defaults. No migration seed data required. The default model is `google/gemini-2.5-flash-image` (fastest and most cost-effective of the listed models).

**Alternatives considered**:
- **Seed defaults in migration SQL**: Requires updating migration if defaults change; breaks "no seed data" requirement.
- **Environment variables for config**: Not manageable by admins at runtime through the UI.

---

## Decision 5: Placeholder Syntax

**Decision**: Use angle-bracket uppercase format: `<ITEM_NAME>`, `<MONSTER_NAME>`. Case-sensitive exact match replacement at resolve time.

**Rationale**: Consistent with the feature description. Simple string `replace()` logic — no template engine needed. Admins can easily see unresolved placeholders in the preview.

**Alternatives considered**:
- **`{{item_name}}` Handlebars-style**: More complex to parse; overkill for simple substitution.
- **`$ITEM_NAME`**: Could collide with shell variable syntax in logs.

---

## Decision 6: OpenRouter API Key Management

**Decision**: The `OPENROUTER_API_KEY` environment variable is read from `admin/backend/.env`. It is not configurable through the Admin Config UI (out of scope).

**Rationale**: API keys are secrets; they belong in environment config, not in a UI-editable database field. The existing `admin/backend/.env` file already holds other secrets (admin JWT secret, DB credentials).

---

## Decision 7: No New WebSocket Messages

**Decision**: This feature introduces no new WebSocket message types between the game client and game server.

**Rationale**: AI image generation is an admin-only operation. The admin panel uses REST (HTTP) exclusively. The generated images are stored as files; the game backend serves them the same as manually uploaded images. No game state is mutated by this feature.

**Impact on Constitution Gate 4**: No `contracts/` WebSocket file is required. An admin REST API contract is documented instead.

---

## Supported OpenRouter Image Models (as of 2026-03-08)

| Model ID | Notes |
|----------|-------|
| `google/gemini-2.5-flash-image` | **Default** — fastest/cheapest |
| `google/gemini-2.5-flash-image-preview` | Preview variant |
| `google/gemini-3-pro-image-preview` | Higher quality |
| `google/gemini-3.1-flash-image-preview` | Latest flash preview |
| `openai/gpt-5-image-mini` | OpenAI image mini |
| `openai/gpt-5-image` | OpenAI image full |
