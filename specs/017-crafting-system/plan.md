# Implementation Plan: Crafting System

**Branch**: `017-crafting-system` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-crafting-system/spec.md`

## Summary

Add an NPC-bound crafting system where players interact with crafting NPCs to browse recipes, start multi-quantity crafts with material/crown costs, track real-time progress, collect finished items, and cancel for partial refunds. Crafting sessions persist across server restarts using wall-clock time. Admin tooling provides recipe CRUD and a `/crafting_finish` command.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — new tables `crafting_recipes`, `recipe_ingredients`, `crafting_sessions`; `npcs` table extended with `is_crafter BOOLEAN`
**Testing**: Manual integration testing (existing project pattern)
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web-based multiplayer RPG (monorepo: frontend, backend, shared, admin)
**Performance Goals**: Crafting interactions complete within 200ms round-trip; progress calculations are O(1) per session
**Constraints**: All crafting state mutations server-authoritative; no client-side prediction for crafting
**Scale/Scope**: Single-server deployment; hundreds of concurrent players with potentially thousands of active crafting sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | ✅ PASS | All crafting actions (start, cancel, collect, progress) use WebSocket messages. Admin recipe CRUD uses REST (non-game-state, admin tooling only). |
| 2. Server-side validation present | ✅ PASS | Server validates: material ownership, crown balance, inventory capacity, session existence, NPC proximity, duplicate session prevention. Client is untrusted. |
| 3. Structured logging required | ✅ PASS | All crafting events (start, cancel, collect, finish-command) will emit structured logs with characterId, recipeId, quantity, costs. |
| 4. Contract documented | ✅ PASS | All new WebSocket message types documented in `contracts/crafting-protocol.md`. |
| 5. Graceful rejection handling | ✅ PASS | Frontend handles all rejection reasons (insufficient materials, inventory full, already crafting) with user-facing messages. Modal remains functional on rejection. |
| 6. Complexity justified | ✅ PASS | No complexity violations. Design follows existing patterns (query modules, handler registration, HTML modal overlay). |

## Project Structure

### Documentation (this feature)

```text
specs/017-crafting-system/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── crafting-protocol.md  # WebSocket message contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 019_crafting_system.sql       # New tables + npcs.is_crafter column
│   │   └── queries/
│   │       └── crafting.ts                    # Recipe + session CRUD queries
│   ├── game/
│   │   └── crafting/
│   │       ├── crafting-service.ts            # Core logic: start, cancel, collect, progress
│   │       └── crafting-handler.ts            # WebSocket message handlers
│   └── websocket/
│       └── dispatcher.ts                      # Register new crafting handlers (existing file)

frontend/
├── src/
│   └── ui/
│       ├── BuildingPanel.ts                   # Add "I want to craft" dialog option (existing file)
│       └── CraftingModal.ts                   # New crafting overlay modal

shared/
└── protocol/
    └── index.ts                               # New crafting DTOs and message types (existing file)

admin/
├── backend/
│   └── src/
│       └── routes/
│           └── recipes.ts                     # Recipe CRUD REST routes
└── frontend/
    └── src/
        └── ui/
            └── recipe-manager.ts              # Admin recipe management UI
```

**Structure Decision**: Follows existing monorepo pattern. Crafting logic in `backend/src/game/crafting/` (matches `game/inventory/`, `game/currency/`, `game/admin/` pattern). Frontend uses HTML modal overlay (matches `CombatModal` pattern). Admin follows `items.ts` routes + `item-manager.ts` UI pattern.

## Complexity Tracking

No complexity violations. All design choices follow existing project patterns.
