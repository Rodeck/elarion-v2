# Implementation Plan: Building Item Overlay

**Branch**: `018-building-item-overlay` | **Date**: 2026-03-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-building-item-overlay/spec.md`

## Summary

Add a toggleable overlay to the admin map editor that displays color-coded item icons next to each building, showing which items are obtainable there. Items are resolved server-side by joining building actions (explore → monster loot) and crafter NPCs (recipes → output items). A new admin REST endpoint computes the data; the canvas renders icons as an additional layer after buildings. A toolbar toggle controls visibility.

## Technical Context

**Language/Version**: TypeScript 5.x (admin backend + admin frontend)
**Primary Dependencies**: Express 4 (admin backend), Canvas 2D API (admin frontend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — read-only queries against existing tables (no new tables or migrations)
**Testing**: Manual testing in admin map editor
**Target Platform**: Browser (admin dashboard), Node.js 20 LTS (admin backend)
**Project Type**: Web application (admin tool extension)
**Performance Goals**: Overlay data loads in <2 seconds for maps with up to 50 buildings
**Constraints**: No new database tables; compute overlay data from existing schema joins
**Scale/Scope**: Admin-only feature; single-user editor context (no concurrency concerns)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Rationale |
|------|--------|-----------|
| No REST for game state | PASS | This is admin tooling, not game state mutation. REST is permitted for non-game-state operations per constitution. |
| Server-side validation present | PASS (N/A) | Read-only endpoint returning computed data. No player actions to validate. |
| Structured logging required | PASS | Admin endpoint will use existing structured logging pattern (`JSON.stringify`). |
| Contract documented | PASS | Admin REST endpoint contract documented in `contracts/admin-building-items.md`. No WebSocket messages introduced. |
| Graceful rejection handling | PASS (N/A) | Admin-only read endpoint. Frontend handles errors via existing `request<T>()` error handling. |
| Complexity justified | PASS | No complexity violations — single endpoint, single canvas layer, follows existing patterns. |

## Project Structure

### Documentation (this feature)

```text
specs/018-building-item-overlay/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── admin-building-items.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
admin/
├── backend/
│   └── src/
│       └── routes/
│           └── building-items.ts       # NEW — GET /api/maps/:mapId/building-items
└── frontend/
    └── src/
        ├── editor/
        │   ├── canvas.ts               # MODIFIED — add overlay render layer + icon cache
        │   └── api.ts                  # MODIFIED — add fetchBuildingItems() function
        └── ui/
            └── toolbar.ts              # MODIFIED — add "Items" toggle button
```

**Structure Decision**: Follows existing admin monorepo layout. New route file in `admin/backend/src/routes/`. Frontend changes modify existing files (canvas, api, toolbar) — no new frontend files needed. The overlay rendering is embedded in the canvas's render loop as an additional layer.
