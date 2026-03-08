# Developer Quickstart: AI Image Generation (010)

**Branch**: `010-ai-image-gen` | **Date**: 2026-03-08

A concise guide for any developer picking up this feature. Read `research.md`, `data-model.md`, and `contracts/admin-rest-api.md` first for full context.

---

## What This Feature Adds

1. **Image Prompt Manager**: New "Image Prompts" tab in the admin panel — CRUD for reusable prompt templates with `<PLACEHOLDER>` syntax.
2. **Admin Config page**: New "Config" tab — system-wide settings including AI model selection.
3. **Generate with AI button**: Added to item and monster create/edit forms. Opens a dialog to select a prompt, preview resolved text, trigger generation, and accept the result as the entity's icon.
4. **Admin backend**: 3 new route files, 1 service file, 2 new DB query files, and extensions to existing item/monster routes for `icon_base64` input.
5. **DB**: 2 new tables (`image_prompt_templates`, `admin_config`).

---

## Affected Packages

| Package | Changes |
|---------|---------|
| `backend/` | Migration 013, 2 new query files |
| `admin/backend/` | 3 new route files, 1 new service file, modify items + monsters routes, mount in `index.ts` |
| `admin/frontend/` | 3 new UI files, modify item-manager and monster-manager, add tabs to `main.ts` |

No changes to `frontend/` (game client) or `shared/protocol/`.

---

## Prerequisites

1. Add `OPENROUTER_API_KEY=<your-key>` to `admin/backend/.env`.
2. The DB migration runs automatically on game backend startup.

---

## Development Setup (unchanged)

```bash
# Terminal 1: Game backend (runs DB migrations)
cd backend && npm run dev

# Terminal 2: Admin backend
cd admin/backend && npm run dev

# Terminal 3: Admin frontend
cd admin/frontend && npm run dev
```

---

## Implementation Order

### 1. Database first
- Write `backend/src/db/migrations/013_ai_image_gen.sql` (creates `image_prompt_templates`, `admin_config`)
- Start game backend to auto-apply migration
- Verify: `\dt image_prompt_templates` and `\dt admin_config` in psql

### 2. DB query functions
- Write `backend/src/db/queries/image-prompts.ts` (CRUD for prompt templates)
- Write `backend/src/db/queries/admin-config.ts` (get/upsert with code defaults)

### 3. Admin backend — new routes
- Write `admin/backend/src/services/image-gen.ts` (OpenRouter HTTP call)
- Write `admin/backend/src/routes/image-prompts.ts` (CRUD endpoints)
- Write `admin/backend/src/routes/ai-generate.ts` (`POST /api/ai/generate-image`)
- Write `admin/backend/src/routes/admin-config.ts` (GET + PUT)
- Extend `admin/backend/src/routes/items.ts` to accept `icon_base64`
- Extend `admin/backend/src/routes/monsters.ts` to accept `icon_base64`
- Mount all new routers in `admin/backend/src/index.ts`

### 4. Admin frontend — new UI
- Write `admin/frontend/src/ui/image-prompt-manager.ts` (CRUD list + form)
- Write `admin/frontend/src/ui/admin-config-manager.ts` (model selector form)
- Write `admin/frontend/src/ui/image-gen-dialog.ts` (Generate with AI modal)
- Modify `admin/frontend/src/ui/item-manager.ts` (add Generate with AI button)
- Modify `admin/frontend/src/ui/monster-manager.ts` (add Generate with AI button)
- Update `admin/frontend/src/main.ts` (add "Image Prompts" and "Config" tabs)
- Add API client functions to `admin/frontend/src/editor/api.ts`

---

## Key Design Notes

- **`icon_base64` field**: Items and monsters create/update endpoints accept a `icon_base64` form field (base64 PNG string) as an alternative to multipart file upload. If both `icon` file and `icon_base64` are present, the file takes precedence.
- **Config defaults**: `admin_config` table is empty on fresh install. `getConfigValue()` falls back to `CONFIG_DEFAULTS` in code. No seeding needed.
- **OpenRouter call**: Done entirely in the admin backend (`image-gen.ts`). The API key never reaches the browser.
- **Preview flow**: Generation returns `{ base64, resolved_prompt, model_used }`. The frontend renders the image from base64 in an `<img>` tag. On "Accept", it sends the base64 string to the item/monster save endpoint.
- **Placeholder format**: `<UPPERCASE_KEY>` — e.g., `<ITEM_NAME>`. Simple `String.replace('<ITEM_NAME>', value)` at resolve time. No regex engine needed.
