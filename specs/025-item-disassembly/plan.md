# Implementation Plan: Item Disassembly System

**Branch**: `025-item-disassembly` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-item-disassembly/spec.md`

## Summary

Add item disassembly: players break down items into materials at NPC disassemblers via a 15-slot drag-and-drop window. Requires a kiln tool (durability consumed per item). Output determined by chance tables configured per item definition in the admin panel. Admin item add/edit UI converted from inline form to modal to fit recipe configuration. NPC `is_disassembler` flag controls access.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — migration `027_item_disassembly.sql` (2 new tables, 3 ALTER statements)
**Testing**: Manual integration testing via admin panel + game client
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web application (multiplayer game)
**Performance Goals**: <200ms drag-and-drop response, <1s disassembly execution, atomic DB operations
**Constraints**: Server-authoritative (all validation server-side), WebSocket-only for game state mutations
**Scale/Scope**: Single-player-at-a-time operation (no concurrency concerns beyond standard DB transactions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All disassembly operations use `disassembly.*` WebSocket messages. Admin CRUD uses REST (non-game-state, admin-only). |
| 2. Server-side validation present | PASS | `disassembly-handler.ts` validates: NPC flag, item eligibility, kiln durability, crowns, inventory space. Client is a projection only. |
| 3. Structured logging required | PASS | Handler will log: disassembly attempts (success/reject with reason), items consumed, items granted, kiln durability changes. |
| 4. Contract documented | PASS | `contracts/disassembly-messages.md` documents all new message types with TypeScript interfaces. |
| 5. Graceful rejection handling | PASS | Frontend handles `disassembly.rejected` with user-facing error messages. No panics or freezes — grid state preserved on rejection. |
| 6. Complexity justified | PASS | No complexity violations. Two new tables follow established `crafting_recipes`/`recipe_ingredients` pattern. |

**Post-Phase 1 re-check**: All gates still PASS. No new complexity introduced during design.

## Project Structure

### Documentation (this feature)

```text
specs/025-item-disassembly/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── disassembly-messages.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 027_item_disassembly.sql          # NEW: schema changes
│   │   └── queries/
│   │       └── disassembly.ts                     # NEW: recipe + execution queries
│   ├── game/
│   │   └── disassembly/
│   │       ├── disassembly-handler.ts             # NEW: WebSocket handler
│   │       └── disassembly-service.ts             # NEW: business logic
│   └── websocket/
│       └── dispatcher.ts                          # MODIFY: register disassembly handlers

shared/
└── protocol/
    └── index.ts                                   # MODIFY: add disassembly types

frontend/
└── src/
    ├── ui/
    │   ├── DisassemblyModal.ts                    # NEW: disassembly window UI
    │   └── BuildingPanel.ts                       # MODIFY: add disassembler dialog option
    └── scenes/
        └── GameScene.ts                           # MODIFY: wire disassembly messages

admin/
├── backend/
│   └── src/
│       └── routes/
│           ├── items.ts                           # MODIFY: add recipe CRUD + disassembly_cost
│           └── npcs.ts                            # MODIFY: add is_disassembler field
└── frontend/
    └── src/
        ├── ui/
        │   ├── item-manager.ts                    # MODIFY: replace inline form with modal trigger
        │   └── item-modal.ts                      # NEW: modal dialog for item add/edit + recipes
        ├── editor/
        │   └── api.ts                             # MODIFY: add recipe types + API functions
        └── styles.css                             # MODIFY: add item-modal CSS
```

**Structure Decision**: Follows the existing monorepo layout with `backend/`, `frontend/`, `shared/`, `admin/`. New disassembly module placed under `backend/src/game/disassembly/` following the pattern of `crafting/`, `fishing/`, `marketplace/`. No new packages or directories beyond the feature module.

## Complexity Tracking

> No constitution violations. No entries needed.
