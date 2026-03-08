# Implementation Plan: AI Image Generation

**Branch**: `010-ai-image-gen` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-ai-image-gen/spec.md`

---

## Summary

Add AI-powered image generation to the admin panel using OpenRouter. Admins can manage reusable prompt templates (with `<PLACEHOLDER>` syntax), trigger image generation from item/monster creation forms, preview and accept results, and configure the AI model via a new Admin Config page. All image data flows through the admin backend (API key never exposed to the browser). Generated images are stored using the identical path/serving mechanism as manually uploaded icons.

---

## Technical Context

**Language/Version**: TypeScript 5.x — admin backend (Node.js 20 LTS + Express 4), admin frontend (Vite 5, vanilla TS)
**Primary Dependencies**: Express 4, `pg` (PostgreSQL client), `node-fetch` or native `fetch` (Node 18+) for OpenRouter HTTP calls; no new npm packages required
**Storage**: PostgreSQL 16 (2 new tables); filesystem (same `backend/assets/` directories as existing icons)
**Testing**: Manual testing via admin UI; no automated test suite currently exists for admin panel
**Target Platform**: Admin web application (localhost dev, same deployment as existing admin)
**Project Type**: Web application — admin panel (Express REST backend + Vite frontend)
**Performance Goals**: Image generation latency is OpenRouter-dependent; admin UI should show loading state; no throughput SLA required
**Constraints**: API key in environment variable only; generated images ≤ 2 MB PNG; no new npm runtime packages unless strictly necessary

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | ✅ PASS | Feature is admin-only. No game state is mutated. Admin panel uses REST by design (constitution explicitly permits REST for non-game-state operations). |
| 2. Server-side validation present | ✅ PASS | Admin backend validates all inputs: prompt name/body, `icon_base64` PNG magic bytes, config model ID enum, OpenRouter response. |
| 3. Structured logging required | ✅ PASS | All new admin backend routes follow the existing `console.log(JSON.stringify({ level, event, ... }))` pattern. |
| 4. Contract documented | ✅ PASS | No new WebSocket messages introduced. Admin REST API documented in `contracts/admin-rest-api.md`. |
| 5. Graceful rejection handling | ✅ PASS | Admin frontend shows user-facing error messages for all failure cases (generation failure, API key missing, validation errors). |
| 6. Complexity justified | ✅ PASS | No violations of Principle III. All design elements solve clearly defined current problems. |

**Post-design re-evaluation**: All gates continue to pass. The `icon_base64` extension to existing routes is additive and does not break existing upload behavior.

---

## Project Structure

### Documentation (this feature)

```text
specs/010-ai-image-gen/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── admin-rest-api.md  # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
└── src/
    └── db/
        ├── migrations/
        │   └── 013_ai_image_gen.sql          # NEW — 2 new tables
        └── queries/
            ├── image-prompts.ts              # NEW — CRUD for image_prompt_templates
            └── admin-config.ts               # NEW — get/upsert for admin_config

admin/
├── backend/
│   └── src/
│       ├── index.ts                          # MODIFIED — mount 3 new routers
│       ├── routes/
│       │   ├── items.ts                      # MODIFIED — accept icon_base64 field
│       │   ├── monsters.ts                   # MODIFIED — accept icon_base64 field
│       │   ├── image-prompts.ts              # NEW — CRUD endpoints
│       │   ├── ai-generate.ts                # NEW — POST /api/ai/generate-image
│       │   └── admin-config.ts               # NEW — GET + PUT /api/admin-config
│       └── services/
│           └── image-gen.ts                  # NEW — OpenRouter HTTP client
└── frontend/
    └── src/
        ├── main.ts                           # MODIFIED — add 2 new tabs
        ├── editor/
        │   └── api.ts                        # MODIFIED — add API client functions
        └── ui/
            ├── item-manager.ts               # MODIFIED — add Generate with AI button
            ├── monster-manager.ts            # MODIFIED — add Generate with AI button
            ├── image-prompt-manager.ts       # NEW — Prompt CRUD UI
            ├── admin-config-manager.ts       # NEW — Config settings UI
            └── image-gen-dialog.ts           # NEW — Generate with AI modal
```

**Structure Decision**: Extends the existing `admin/backend/src/routes/` and `admin/frontend/src/ui/` patterns. DB query files follow the established `backend/src/db/queries/` location so both admin and game backend processes can import them (consistent with how `inventory.ts` and `monsters.ts` query files are shared today).

---

## Complexity Tracking

No constitution violations requiring justification.
