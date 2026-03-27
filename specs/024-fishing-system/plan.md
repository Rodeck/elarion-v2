# Implementation Plan: Fishing System

**Branch**: `024-fishing-system` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/024-fishing-system/spec.md`

## Summary

Add a fishing mini-game system with anti-bot design, 5-tier rod progression, daily quests from a Fisherman NPC, and new ring/amulet equipment slots. The fishing action is a new building action type (`fishing`) with its own handler — distinct from the existing tick-based gathering system because it requires active player input (tension meter mini-game). The server controls all game state: it picks the fish on cast, sends pull pattern parameters to the client, receives player timing data, validates for anti-bot, and determines loot. New `ring` and `amulet` categories extend the equipment system with two new equip slots.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — migration `026_fishing_system.sql` (new tables + ALTER constraints)
**Testing**: Manual integration testing via game client + admin API
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Multiplayer game (WebSocket real-time, server-authoritative)
**Performance Goals**: Mini-game round-trip < 200ms; fishing session state in-memory (no DB per-tick)
**Constraints**: Server-authoritative — all loot determination and anti-bot validation server-side; client renders mini-game from server-provided parameters
**Scale/Scope**: ~25 new item definitions, 1 NPC, 7-10 quests, 3+ fishing spots, 2 new equip slots

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All fishing interactions use WebSocket messages (`fishing.cast`, `fishing.complete`, `fishing.result`). Rod upgrade/repair use existing NPC interaction patterns over WS. |
| 2. Server-side validation present | PASS | Server picks fish on cast, validates all player timing inputs, runs anti-bot checks, determines loot. Client is a projection only. |
| 3. Structured logging required | PASS | Fishing handler will log: cast attempts, anti-bot snap checks, loot grants, rod upgrades, rod repairs, quest completions. |
| 4. Contract documented | PASS | New message types documented in `contracts/fishing-protocol.md`. |
| 5. Graceful rejection handling | PASS | Client handles: rod locked (durability), no rod equipped, not at fishing spot, inventory full, insufficient upgrade resources. All with user feedback messages. |
| 6. Complexity justified | PASS | No complexity violations — fishing uses existing patterns (building actions, NPC interactions, quest system, equipment system). |

## Project Structure

### Documentation (this feature)

```text
specs/024-fishing-system/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── fishing-protocol.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 026_fishing_system.sql
│   │   └── queries/
│   │       └── fishing.ts
│   └── game/
│       └── fishing/
│           ├── fishing-handler.ts
│           ├── fishing-service.ts
│           ├── fishing-loot-service.ts
│           └── fishing-upgrade-service.ts

shared/
└── protocol/
    └── index.ts                    # Extended with fishing types

frontend/
└── src/
    ├── ui/
    │   └── fishing-minigame.ts     # Tension meter mini-game UI
    └── network/
        └── (existing WSClient.ts handlers)

admin/
├── backend/
│   └── src/routes/
│       └── fishing.ts              # Admin CRUD for fishing loot tables
└── frontend/
    └── src/ui/
        └── fishing-manager.ts      # Admin UI for fishing content
```

**Structure Decision**: Follows existing monorepo layout. New `backend/src/game/fishing/` module mirrors the pattern used by `gathering/`, `combat/`, `quest/`, and `marketplace/`. Fishing is intentionally NOT integrated into the gathering service because the interaction model is fundamentally different (active mini-game vs passive timed ticks).

## Complexity Tracking

> No complexity violations detected. All design choices use existing patterns.
