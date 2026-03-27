# Implementation Plan: Character Rankings

**Branch**: `026-character-rankings` | **Date**: 2026-03-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/026-character-rankings/spec.md`

## Summary

Add a character rankings system with five leaderboard categories (Top Level, Top Fighters, Top Crafters, Top Questers, Map Population) plus total player count. Rankings are computed every 5 minutes via SQL aggregation queries and cached in-memory. A new `combat_wins` column on `characters` tracks player-controlled monster fight victories. The frontend adds a "Rankings" button in the top bar that opens a tabbed overlay panel, fetching data via WebSocket on demand.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared)
**Primary Dependencies**: Phaser 3.60 + Vite 5 (frontend), Node.js 20 LTS + `ws` (backend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — ALTER `characters` table (add column); no new tables
**Testing**: Manual testing (project convention)
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web game (multiplayer RPG)
**Performance Goals**: Rankings panel loads in <2 seconds; periodic computation <1 second
**Constraints**: In-memory cache only (no Redis); 5-minute staleness acceptable
**Scale/Scope**: Indie game scale (~100s of characters)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | Rankings delivered via WebSocket (`rankings.get` → `rankings.data`) |
| 2. Server-side validation | PASS | Rankings computed server-side; client is display-only; authenticated session required |
| 3. Structured logging | PASS | rankings-service will log computation timing and errors |
| 4. Contract documented | PASS | `contracts/websocket.md` defines message types and payloads |
| 5. Graceful rejection | PASS | Empty state handled when rankings not yet computed; server.error for unauthenticated |
| 6. Complexity justified | PASS | No violations — single column addition, in-memory cache, no new abstractions |
| 7. Tooling updated | PASS | No new entity types, admin-creatable content, or validation arrays — tooling updates not required |

## Project Structure

### Documentation (this feature)

```text
specs/026-character-rankings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── websocket.md     # WebSocket message contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   └── migrations/
│   │       └── 028_character_rankings.sql    # ALTER characters ADD combat_wins
│   ├── game/
│   │   ├── combat/
│   │   │   └── combat-session.ts             # MODIFY: increment combat_wins on win
│   │   └── rankings/                         # NEW directory
│   │       ├── rankings-service.ts           # Periodic computation + cache
│   │       └── rankings-handler.ts           # WS handler for rankings.get
│   └── websocket/
│       └── dispatcher.ts                     # MODIFY: register rankings handler

shared/
└── protocol/
    └── index.ts                              # MODIFY: add Rankings DTOs

frontend/
└── src/
    ├── ui/
    │   └── RankingsPanel.ts                  # NEW: tabbed overlay panel
    └── scenes/
        └── GameScene.ts                      # MODIFY: button + handler wiring
```

**Structure Decision**: Follows existing project layout. New `rankings/` directory under `backend/src/game/` mirrors patterns like `quest/`, `combat/`, `gathering/`. Frontend adds a single panel file following `QuestLog.ts` pattern.

## Complexity Tracking

> No violations to justify. Design uses minimal additions to existing architecture.
