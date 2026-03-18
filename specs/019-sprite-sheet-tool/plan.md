# Implementation Plan: Sprite Sheet Tool

**Branch**: `019-sprite-sheet-tool` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-sprite-sheet-tool/spec.md`

## Summary

Add a sprite sheet tool to the admin items page that lets admins upload a PNG sprite sheet, overlay a configurable grid, assign items to cells, and batch-extract individual item icons. The entire sprite sheet stays client-side (Canvas API); only extracted cell PNGs are sent to a new batch endpoint on the admin backend.

## Technical Context

**Language/Version**: TypeScript 5.x (admin frontend + admin backend)
**Primary Dependencies**: Express 4 + multer (admin backend), Canvas 2D API (admin frontend), Vite 5 (admin frontend build)
**Storage**: PostgreSQL 16 (existing `item_definitions.icon_filename` column) + filesystem (`backend/assets/items/icons/`)
**Testing**: Manual admin UI testing
**Target Platform**: Browser (admin panel) + Node.js (admin backend)
**Project Type**: Web application (monorepo: admin frontend + admin backend)
**Performance Goals**: Batch cut of 20+ items in under 5 seconds
**Constraints**: Sprite sheet stays client-side only; no server-side image processing libraries
**Scale/Scope**: Single admin user, max 256 cells per sprite sheet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| No REST for game state | PASS | This is admin tooling — no game state mutation via REST. Item icon metadata is admin-managed content, not game state. |
| Server-side validation present | PASS | Batch endpoint validates PNG magic bytes and item existence for every entry. |
| Structured logging required | PASS | Batch endpoint emits structured JSON log with admin, item count, success/failure counts. |
| Contract documented | PASS | `contracts/batch-icons-api.md` documents the batch icons endpoint. |
| Graceful rejection handling | PASS | Frontend handles 207 Multi-Status response, shows per-item success/failure summary. |
| Complexity justified | PASS | No violations — no new abstractions, patterns, or tables. Straightforward REST endpoint + Canvas UI. |

**Pre-design check**: All gates pass.
**Post-design re-check**: All gates still pass. No new protocol messages, no game state changes.

## Project Structure

### Documentation (this feature)

```text
specs/019-sprite-sheet-tool/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research decisions
├── data-model.md        # Data model (no schema changes)
├── quickstart.md        # Implementation guide
├── contracts/
│   └── batch-icons-api.md  # Batch icons REST API contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
admin/
├── backend/
│   └── src/
│       └── routes/
│           └── items.ts          # MODIFY: add POST /api/items/batch-icons
└── frontend/
    └── src/
        ├── editor/
        │   └── api.ts            # MODIFY: add batchUpdateIcons()
        └── ui/
            ├── item-manager.ts   # MODIFY: add "Sprite Sheet Tool" button
            └── sprite-sheet-dialog.ts  # NEW: modal dialog class
```

**Structure Decision**: Follows existing admin monorepo structure. One new file (`sprite-sheet-dialog.ts`) in the admin frontend UI directory, consistent with existing dialog pattern (`image-gen-dialog.ts`). Backend changes are additions to the existing items router.

## Complexity Tracking

No violations. No new tables, no new abstractions, no new dependencies.
