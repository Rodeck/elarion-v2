# Implementation Plan: Squire System Overhaul

**Branch**: `022-squire-overhaul` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/022-squire-overhaul/spec.md`

## Summary

Overhaul the squire system from a single hardcoded squire per character to a collectible system with admin-defined squire templates, 5-slot inventory (2 initially unlocked), 20-tier named rank progression, expedition power bonuses (up to 2x), NPC-based dismissal, and agent command support. Requires new database tables (`squire_definitions`, `character_squires`, `monster_squire_loot`), extensions to quest rewards and gathering events, updated expedition mechanics, and new frontend UI for squire roster management.

## Technical Context

**Language/Version**: TypeScript 5.x (all packages: frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — migration `023_squire_overhaul.sql` (new tables + ALTER); filesystem for squire icon PNGs under `backend/assets/squires/icons/`
**Testing**: `npm test && npm run lint`
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web application (multiplayer game — real-time WebSocket)
**Performance Goals**: Standard game server performance; squire operations are low-frequency (seconds, not milliseconds)
**Constraints**: Server-authoritative; all squire mutations validated server-side
**Scale/Scope**: ~30 files modified/created across 4 packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All squire acquisition, dismissal, expedition dispatch use WebSocket messages. REST only used for admin panel definition CRUD (non-game-state). |
| 2. Server-side validation | PASS | Slot limits enforced server-side. Dismissal validates idle status server-side. Expedition dispatch validates squire ownership server-side. |
| 3. Structured logging | PASS | Plan includes logging for: squire acquisition, dismissal, expedition dispatch with squire selection, roster full rejections. |
| 4. Contract documented | PASS | `contracts/websocket-messages.md` documents all new/modified message types. |
| 5. Graceful rejection handling | PASS | `squire.acquisition_failed`, `squire.dismiss_rejected`, extended `expedition.dispatch_rejected` with new reasons. |
| 6. Complexity justified | PASS | No violations of Principle III — all elements solve current requirements. |

### Post-Design Re-Check

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Confirmed: squire acquisition (combat/gathering/quest), dismissal, expedition all via WebSocket. Admin CRUD via REST is appropriate. |
| 2. Server-side validation | PASS | `squire-grant-service.ts` checks slot availability. `squire-dismiss-handler.ts` validates idle+ownership. `expedition-handler.ts` validates squire_id. |
| 3. Structured logging | PASS | All handlers emit structured JSON logs with characterId, squireId, action context. |
| 4. Contract documented | PASS | 12 new/modified message types documented in contracts. |
| 5. Graceful rejection handling | PASS | All rejection paths return typed payloads with reason codes. Frontend displays user-friendly messages. |
| 6. Complexity justified | PASS | No violations. |

## Project Structure

### Documentation (this feature)

```text
specs/022-squire-overhaul/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: design decisions and rationale
├── data-model.md        # Phase 1: database schema and entity model
├── quickstart.md        # Phase 1: implementation order and file impact
├── contracts/
│   └── websocket-messages.md  # Phase 1: WebSocket + REST API contracts
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
│   │   │   └── 023_squire_overhaul.sql          # NEW: schema changes
│   │   └── queries/
│   │       ├── squires.ts                        # MODIFIED: use character_squires + JOINs
│   │       ├── squire-definitions.ts             # NEW: admin CRUD
│   │       └── monster-squire-loot.ts            # NEW: squire loot queries
│   ├── game/
│   │   ├── squire/
│   │   │   ├── squire-grant-service.ts           # NEW: central grant logic + slot checks
│   │   │   └── squire-dismiss-handler.ts         # NEW: NPC dismissal WebSocket handler
│   │   ├── expedition/
│   │   │   ├── expedition-service.ts             # MODIFIED: power bonus, squire picker
│   │   │   └── expedition-handler.ts             # MODIFIED: squire_id in dispatch
│   │   ├── combat/
│   │   │   └── combat-session.ts                 # MODIFIED: roll squire drops
│   │   ├── gathering/
│   │   │   └── gathering-service.ts              # MODIFIED: 'squire' event type
│   │   ├── quest/
│   │   │   ├── quest-service.ts                  # MODIFIED: 'squire' reward type
│   │   │   └── quest-handler.ts                  # MODIFIED: squire slot space check
│   │   └── world/
│   │       ├── world-state-handler.ts            # MODIFIED: send roster on connect
│   │       ├── character-create-handler.ts        # MODIFIED: remove legacy squire
│   │       └── city-movement-handler.ts          # MODIFIED: expedition squire list
│   ├── websocket/
│   │   ├── server.ts                             # NO CHANGE
│   │   ├── validator.ts                          # MODIFIED: new message schemas
│   │   └── handlers/
│   │       └── world-state-handler.ts            # MODIFIED
│   └── index.ts                                  # MODIFIED: register new handlers
│
├── assets/
│   └── squires/
│       └── icons/                                # NEW: squire icon PNGs

shared/
└── protocol/
    └── index.ts                                  # MODIFIED: new types + constants

frontend/
└── src/
    ├── ui/
    │   ├── SquireRosterPanel.ts                  # NEW: squire roster UI
    │   └── BuildingPanel.ts                      # MODIFIED: expedition squire picker
    └── scenes/
        └── GameScene.ts                          # MODIFIED: squire message handlers

admin/
├── backend/
│   └── src/
│       └── routes/
│           ├── squire-definitions.ts             # NEW: CRUD + icon upload
│           ├── monsters.ts                       # MODIFIED: squire loot endpoints
│           ├── npcs.ts                           # MODIFIED: dismisser flag
│           ├── quests.ts                         # MODIFIED: squire reward type
│           └── buildings.ts                      # MODIFIED: squire gather event type
└── frontend/
    └── src/
        └── ui/
            ├── properties.ts                     # MODIFIED: squire in gather events
            └── quest-manager.ts                  # MODIFIED: squire reward option

scripts/
└── game-entities.js                              # MODIFIED: 3 new commands + extensions
```

**Structure Decision**: Follows existing multi-package web application structure (backend, frontend, shared, admin). New squire service files go under `backend/src/game/squire/` following the established domain grouping pattern (`combat/`, `expedition/`, `gathering/`, `quest/`). New admin routes follow the existing per-entity route file pattern.

## Complexity Tracking

> No violations to justify. All design elements directly address current requirements.
