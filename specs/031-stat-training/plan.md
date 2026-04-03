# Implementation Plan: NPC Stat Training via Consumable Items

**Branch**: `031-stat-training` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/031-stat-training/spec.md`
**Game Design**: `game_design/stat-training/design.md`

## Summary

Add a consumable-item-based stat training system alongside the existing level-up point allocation. Players give training items to specialized trainer NPCs for a chance to permanently increase a stat by 1. The system requires a new DB table (`stat_training_items`), a new NPC column (`trainer_stat`), new WebSocket handlers (`stat-training.open`, `stat-training.attempt`), a frontend training modal, and admin CRUD routes.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — migration `034_stat_training.sql` (new table + ALTER)
**Testing**: Manual in-game testing + admin API verification
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Multiplayer web game (monorepo: frontend/backend/shared/admin)
**Performance Goals**: Training attempt round-trip < 500ms
**Constraints**: Server-authoritative — all validation server-side
**Scale/Scope**: 5 stats, 15 training items, 5 trainer NPCs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | Training uses WebSocket messages (`stat-training.open`, `stat-training.attempt`), not REST. Admin CRUD is non-game-state. |
| 2. Server-side validation present | PASS | Server validates: NPC is trainer, player owns item, stat not at cap, not in combat. RNG roll is server-side. |
| 3. Structured logging required | PASS | Handler will emit structured logs for training attempts (characterId, npcId, itemId, stat, success, newValue). |
| 4. Contract documented | PASS | Will document in `contracts/stat-training-messages.md`. |
| 5. Graceful rejection handling | PASS | Frontend shows error messages for rejections (cap reached, in combat, no item). No freeze/panic. |
| 6. Complexity justified | PASS | No violations — straightforward handler + table + modal. |
| 7. Tooling updated | PASS | Will update `scripts/game-data.js` (stat-training query), `scripts/game-entities.js` (stat-training-item creation), `CLAUDE.md` (NPC role checklist for trainer_stat), and game design skills. |

## Project Structure

### Documentation (this feature)

```text
specs/031-stat-training/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── stat-training-messages.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── migrations/
│   └── 034_stat_training.sql          # New table + ALTER npcs
├── src/
│   ├── db/queries/
│   │   └── stat-training.ts           # DB queries for stat_training_items
│   ├── game/training/
│   │   ├── training-handler.ts        # Existing — no changes needed
│   │   └── stat-training-handler.ts   # NEW — open + attempt handlers
│   └── websocket/
│       └── dispatcher.ts              # Register new handlers (import)

shared/
└── protocol/
    └── index.ts                       # New message types + NpcDto.trainer_stat

frontend/
└── src/
    ├── ui/
    │   ├── BuildingPanel.ts           # Add "Train [Stat]" dialog option
    │   └── StatTrainingModal.ts       # NEW — training item selection + result
    └── scenes/
        └── GameScene.ts               # Wire modal + WS handlers

admin/
└── backend/
    └── src/
        └── routes/
            └── stat-training.ts       # NEW — CRUD for stat_training_items

scripts/
├── game-data.js                       # Add stat-training query command
└── game-entities.js                   # Add create-stat-training-item command
```

**Structure Decision**: Follows existing monorepo layout. New handler in `backend/src/game/training/` alongside existing `training-handler.ts`. New admin route follows pattern of other CRUD routes.
