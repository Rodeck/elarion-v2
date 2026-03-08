# Tasks: AI Image Generation (010)

**Input**: Design documents from `/specs/010-ai-image-gen/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/admin-rest-api.md ✅, quickstart.md ✅

**Tests**: Not included (no automated test suite exists for the admin panel; manual testing via UI per quickstart.md).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story ([US1]–[US4])
- Exact file paths in every description

---

## Phase 1: Setup (Database Foundation)

**Purpose**: Create the DB schema that all user stories depend on. MUST complete before any route or UI work.

- [x] T001 Write DB migration `backend/src/db/migrations/013_ai_image_gen.sql` — CREATE TABLE `image_prompt_templates` (id, name VARCHAR(128) UNIQUE, body TEXT, created_at, updated_at) and CREATE TABLE `admin_config` (key VARCHAR(128) PK, value TEXT, updated_at)
- [ ] T002 Apply migration by starting game backend (`cd backend && npm run dev`) and verify both tables exist in psql

**Checkpoint**: `\dt image_prompt_templates` and `\dt admin_config` both return results in psql.

---

## Phase 2: Foundational (Shared Backend Infrastructure)

**Purpose**: DB query layer and OpenRouter service used by multiple user stories. MUST complete before any route or UI work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Create `backend/src/db/queries/image-prompts.ts` — export `ImagePromptTemplate` interface and functions: `getAllPrompts()`, `getPromptById(id)`, `createPrompt({name, body})`, `updatePrompt(id, data)`, `deletePrompt(id): Promise<boolean>`
- [x] T004 [P] Create `backend/src/db/queries/admin-config.ts` — export `CONFIG_DEFAULTS` map (key `image_gen_model` defaults to `'google/gemini-2.5-flash-image'`), `VALID_IMAGE_GEN_MODELS` array (all 6 model IDs from research.md), and functions: `getConfigValue(key)`, `getAllConfig()`, `upsertConfigValue(key, value)`
- [x] T005 Create `admin/backend/src/services/image-gen.ts` — export `generateImage(resolvedPrompt: string, model: string): Promise<string>` that calls `POST https://openrouter.ai/api/v1/images/generations` with `Authorization: Bearer ${process.env.OPENROUTER_API_KEY}`, requests `response_format: { type: 'b64_json' }`, extracts and returns the base64 string; throws descriptive error if API key missing or response is malformed

**Checkpoint**: TypeScript compiles without errors (`tsc --noEmit` in `backend/` and `admin/backend/`).

---

## Phase 3: User Story 1 — Manage Image Prompt Templates (Priority: P1) 🎯 MVP

**Goal**: Admins can create, read, update, and delete prompt templates with placeholder syntax (`<ITEM_NAME>` etc.). Templates persist in the database.

**Independent Test**: Navigate to the admin panel "Image Prompts" tab. Create a prompt named "Test Prompt" with body "A <ITEM_NAME>". Save, refresh page — prompt still appears. Edit the body, save, confirm change. Delete the prompt — it disappears.

### Implementation

- [x] T006 [P] [US1] Create `admin/backend/src/routes/image-prompts.ts` — Router with 5 endpoints per contracts/admin-rest-api.md: `GET /` (list), `GET /:id`, `POST /` (validate name ≤128 chars, body non-empty; 409 on duplicate name), `PUT /:id` (partial update), `DELETE /:id`; import from `backend/src/db/queries/image-prompts.ts`; use structured JSON logging for all operations
- [x] T007 [US1] Mount `imagePromptsRouter` in `admin/backend/src/index.ts` at `/api/image-prompts` (after the requireAdmin middleware line)
- [x] T008 [P] [US1] Add image-prompts API client functions to `admin/frontend/src/editor/api.ts` — `getImagePrompts()`, `getImagePromptById(id)`, `createImagePrompt(data)`, `updateImagePrompt(id, data)`, `deleteImagePrompt(id)`; export `ImagePromptTemplate` interface
- [x] T009 [US1] Create `admin/frontend/src/ui/image-prompt-manager.ts` — export class `ImagePromptManager` with `init(container)` and `load()` methods; render a two-column layout (form left, list right) following the same HTML/CSS patterns as `item-manager.ts`; form fields: name (text, maxlength 128, required) and body (textarea, required); list shows name + truncated body + Edit + Delete buttons; wire up create, edit (populate form), delete (confirm dialog) using API functions from T008
- [x] T010 [US1] Add "Image Prompts" tab to `admin/frontend/src/main.ts` — follow the existing tab pattern (add button to `tabBar`, add panel div, add `setActiveTab` case, add click listener that lazily instantiates `ImagePromptManager`)

**Checkpoint**: `npm run dev` in `admin/frontend/` → "Image Prompts" tab visible → full CRUD works end-to-end.

---

## Phase 4: User Story 4 — Configure System Settings (Priority: P2)

**Goal**: Admins can view and change the AI image generation model on a Config page. A fresh database (no rows in `admin_config`) shows the default model pre-selected.

**Independent Test**: Open "Config" tab — model dropdown shows `google/gemini-2.5-flash-image` pre-selected even with empty `admin_config` table. Select `openai/gpt-5-image`, save, refresh page — new model is still selected.

### Implementation

- [x] T011 [P] [US4] Create `admin/backend/src/routes/admin-config.ts` — Router with `GET /` (return `getAllConfig()` merged with `CONFIG_DEFAULTS`) and `PUT /` (validate each key against known keys; validate `image_gen_model` against `VALID_IMAGE_GEN_MODELS`; call `upsertConfigValue()` for each provided key; return updated full config); structured logging on save
- [x] T012 [US4] Mount `adminConfigRouter` in `admin/backend/src/index.ts` at `/api/admin-config`
- [x] T013 [P] [US4] Add admin-config API client functions to `admin/frontend/src/editor/api.ts` — `getAdminConfig(): Promise<Record<string, string>>` and `updateAdminConfig(data: Record<string, string>): Promise<Record<string, string>>`; export `VALID_IMAGE_GEN_MODELS` array
- [x] T014 [US4] Create `admin/frontend/src/ui/admin-config-manager.ts` — export class `AdminConfigManager` with `init(container)` and `load()` methods; render a settings form with a labelled `<select>` for `image_gen_model` listing all 6 model IDs (from `VALID_IMAGE_GEN_MODELS`); on load, call `getAdminConfig()` and set the select's current value; on submit, call `updateAdminConfig()` and show success/error message
- [x] T015 [US4] Add "Config" tab to `admin/frontend/src/main.ts` — follow same lazy-init tab pattern; render after "Image Prompts" tab

**Checkpoint**: Config tab loads default model, persists changes, survives page refresh.

---

## Phase 5: User Story 2 — Generate Item Image with AI (Priority: P2)

**Goal**: Admin can click "Generate with AI" on the item form, select a prompt template, see the resolved prompt (with item name injected), trigger OpenRouter generation, preview the returned image, and accept it as the item's icon.

**Independent Test**: Open Items → Add New Item → enter name "Iron Sword" → click "Generate with AI" → select a prompt template → verify the preview shows item name substituted → click Generate → image preview appears → click Accept → item saved with generated icon (visible in list).

### Implementation

- [x] T016 [P] [US2] Create `admin/backend/src/routes/ai-generate.ts` — Router with `POST /` per contracts/admin-rest-api.md: accept `{ prompt_id, variables }` JSON; load prompt from DB; resolve placeholders by replacing each `<KEY>` with `variables[KEY]`; read current model from `getConfigValue('image_gen_model')`; call `generateImage()` from `image-gen.ts`; return `{ base64, resolved_prompt, model_used }`; return 503 if `OPENROUTER_API_KEY` missing, 502 on generation failure, 404 if prompt not found
- [x] T017 [US2] Mount `aiGenerateRouter` in `admin/backend/src/index.ts` at `/api/ai`
- [x] T018 [P] [US2] Extend `admin/backend/src/routes/items.ts` to accept `icon_base64` field — in both `POST /` and `PUT /:id` handlers: if `req.file` is absent but `req.body.icon_base64` is present, decode the base64 string using `Buffer.from(icon_base64, 'base64')`, validate PNG magic bytes with existing `isValidPng()`, generate UUID filename, write to `ICONS_DIR`; `icon` file takes precedence if both are present
- [x] T019 [US2] Add generate + icon_base64 API client functions to `admin/frontend/src/editor/api.ts` — `generateImage(promptId: number, variables: Record<string, string>): Promise<{ base64: string; resolved_prompt: string; model_used: string }>` and update `createItem(formData)` / `updateItem(id, formData)` to support sending `icon_base64` as a regular form field (or a new helper `applyGeneratedIcon(formData, base64)`)
- [x] T020 [US2] Create `admin/frontend/src/ui/image-gen-dialog.ts` — export class `ImageGenDialog` with `open(entityName: string, onAccept: (base64: string) => void): void`; renders a modal overlay with: prompt dropdown (loaded from `getImagePrompts()`), resolved prompt preview (updates as entity name or prompt changes), "Generate" button (shows loading spinner, calls `generateImage()`, displays result in `<img>` tag as `data:image/png;base64,...`), "Accept" button (calls `onAccept(base64)` and closes modal), "Cancel" button; shows error message on generation failure
- [x] T021 [US2] Modify `admin/frontend/src/ui/item-manager.ts` to integrate AI generation — add a "Generate with AI" button next to "Choose File" in the icon row (disabled when `#item-name` is empty); on click, instantiate `ImageGenDialog` and call `open(itemName, (base64) => { /* store base64, show preview from data URI, set a flag so submit sends icon_base64 instead of file */ })`; in `handleFormSubmit`, if a base64 was accepted and no new file selected, append `icon_base64` to the FormData

**Checkpoint**: Full Generate with AI flow works for items end-to-end with a real OpenRouter API key.

---

## Phase 6: User Story 3 — Generate Monster Image with AI (Priority: P3)

**Goal**: Same Generate with AI capability on the monster creation/edit form, reusing `ImageGenDialog` from US2.

**Independent Test**: Open Monsters → Add New Monster → enter name "Goblin" → click "Generate with AI" → full generation flow works identically to items → monster saved with generated icon.

### Implementation

- [x] T022 [P] [US3] Extend `admin/backend/src/routes/monsters.ts` to accept `icon_base64` field — apply same extension as items.ts (T018): decode base64, validate PNG, write to `ICONS_DIR` (`backend/assets/monsters/icons/`); applies to both `POST /` and `PUT /:id`
- [x] T023 [US3] Modify `admin/frontend/src/ui/monster-manager.ts` to integrate AI generation — add "Generate with AI" button to the monster form icon row (disabled when name is empty); reuse `ImageGenDialog` with monster name as entity name; on accept, store base64 and send as `icon_base64` form field on submit

**Checkpoint**: Generate with AI works identically on both items and monsters.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, environment documentation, and final validation.

- [x] T024 [P] Add `OPENROUTER_API_KEY` missing-key warning to `admin/backend/src/index.ts` — on server startup, if `process.env.OPENROUTER_API_KEY` is falsy, emit a structured log warning (`level: 'warn', event: 'openrouter_key_missing'`) rather than crashing; generation endpoint already returns 503 in this case
- [x] T025 [P] Verify structured JSON logging present on all new admin backend routes — check `admin/backend/src/routes/image-prompts.ts`, `admin-config.ts`, and `ai-generate.ts` each emit `console.log(JSON.stringify({ level, event, timestamp, ... }))` for create/update/delete/generate operations; add any missing log calls
- [ ] T026 Walk through quickstart.md validation steps end-to-end: create a prompt, set a config, generate an item icon, generate a monster icon; confirm no TypeScript compile errors (`tsc --noEmit` in `backend/`, `admin/backend/`, `admin/frontend/`)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup/DB)
    ↓
Phase 2 (Foundational — DB queries + OpenRouter service)
    ↓
Phase 3 (US1 — Prompt CRUD)  ←── T003, T004, T005 must be done
Phase 4 (US4 — Admin Config) ←── T003, T004, T005 must be done
Phase 5 (US2 — Item Gen)     ←── Phases 2 + 3 must be done (prompts must exist to select)
Phase 6 (US3 — Monster Gen)  ←── Phase 5 must be done (reuses ImageGenDialog)
    ↓
Phase 7 (Polish)
```

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. No dependencies on other user stories.
- **US4 (P2)**: Starts after Phase 2. Independent of US1 (different tab, different table).
- **US2 (P2)**: Starts after Phase 2 + Phase 3 complete (needs prompts in the DB to select during generate flow).
- **US3 (P3)**: Starts after Phase 5 complete (reuses `ImageGenDialog` from US2).

### Within Each Phase

- Models/queries before services (T003/T004 before T005)
- Route files before mounting in index.ts (T006 before T007, T011 before T012, T016 before T017)
- API client functions before UI class (T008 before T009, T013 before T014, T019 before T020)
- UI class before tab integration (T009 before T010, T014 before T015)
- Dialog component before form integration (T020 before T021)

### Parallel Opportunities

Within Phase 2:
```
T003 (image-prompts queries)  ──┐
T004 (admin-config queries)   ──┼── all parallel (different files)
T005 (image-gen service)      ──┘
```

Within Phase 3:
```
T006 (backend route)    ──┐
T008 (API client)       ──┘  parallel, then T009 → T010 sequentially
```

Within Phase 4:
```
T011 (backend route)    ──┐
T013 (API client)       ──┘  parallel, then T014 → T015 sequentially
```

Within Phase 5:
```
T016 (ai-generate route)  ──┐
T018 (items.ts extension) ──┘  parallel, then T019 → T020 → T021 sequentially
```

Within Phase 6:
```
T022 (monsters.ts extension)  ──┐  parallel with T023 (different files)
T023 (monster-manager.ts)     ──┘  but T023 uses ImageGenDialog from T020
```

---

## Parallel Execution Example: Phase 2

```bash
# All three can start simultaneously:
Task: "Create backend/src/db/queries/image-prompts.ts (T003)"
Task: "Create backend/src/db/queries/admin-config.ts (T004)"
Task: "Create admin/backend/src/services/image-gen.ts (T005)"
```

## Parallel Execution Example: Phase 3

```bash
# Start these two simultaneously after Phase 2:
Task: "Create admin/backend/src/routes/image-prompts.ts (T006)"
Task: "Add image-prompts API client to admin/frontend/src/editor/api.ts (T008)"

# Then sequentially:
# T007 (mount router) → after T006
# T009 (ImagePromptManager UI) → after T008
# T010 (add tab) → after T009
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: DB migration
2. Complete Phase 2: DB queries + OpenRouter service
3. Complete Phase 3: Prompt CRUD UI and backend
4. **STOP and VALIDATE**: Prompt templates create/edit/delete work end-to-end
5. This alone delivers the foundational building block for all generation features

### Incremental Delivery

1. Phase 1 + 2 + 3 → Prompt management working (MVP)
2. Add Phase 4 (US4) → Config page working; admins can switch AI model
3. Add Phase 5 (US2) → Generate item images; core AI feature working end-to-end
4. Add Phase 6 (US3) → Monster image generation
5. Phase 7 → Production hardening

### Single Developer Strategy

Work sequentially: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7.
Each phase is a natural stopping point where the admin panel remains fully functional.

---

## Notes

- `[P]` tasks touch different files with no blocking inter-dependencies — safe to work on concurrently
- `[Story]` labels enable traceability back to spec.md acceptance scenarios
- Each phase checkpoint leaves the admin panel in a fully working state (no broken intermediate states)
- TypeScript compile check (`tsc --noEmit`) should pass after each task
- No new npm packages required — uses Node 18 native `fetch`, existing `pg`, `express`, `multer`
- `OPENROUTER_API_KEY` must be set in `admin/backend/.env` before testing Phase 5/6
