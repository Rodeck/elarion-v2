# Implementation Plan: Quest System

**Branch**: `021-quest-system` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-quest-system/spec.md`

## Summary

A full quest system spanning backend (quest definitions, objective tracking, reward granting), admin UI (graphical quest editor), and game frontend (NPC quest dialogue, quest log, HUD tracker). The system hooks into 8 existing game subsystems (combat, crafting, gathering, inventory, XP, currency, movement, NPC interaction) to track quest objective progress in real time. Daily/weekly/monthly reset is handled via a period-key column rather than cron jobs. An AI-facing catalog endpoint documents all quest building blocks for programmatic quest creation.

## Technical Context

**Language/Version**: TypeScript 5.x (all packages: frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (game backend), Phaser 3.60 + Vite 5 (game frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — 7 new tables + 1 ALTER via migration `022_quest_system.sql`
**Testing**: Manual integration testing via game client + admin UI
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web-based multiplayer RPG (game server + game client + admin panel)
**Performance Goals**: Quest progress updates reflected to player within 1 second of triggering action
**Constraints**: Quest tracker hooks must not add perceptible latency to existing systems (combat, crafting, gathering)
**Scale/Scope**: 4 packages modified (backend, frontend, shared, admin), ~15 new files, ~8 existing files modified

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | All quest interactions (accept, progress, complete, abandon) use WebSocket messages. Admin CRUD uses REST (non-game-state). |
| 2. Server-side validation present | PASS | All quest handlers validate prerequisites, objective completion, inventory space, and quest log limits server-side before any state change. |
| 3. Structured logging required | PASS | Quest handler and tracker will emit structured logs for accept, progress, complete, abandon, reject events. |
| 4. Contract documented | PASS | All new WebSocket message types documented in `contracts/websocket-messages.md`. |
| 5. Graceful rejection handling | PASS | Frontend handles `quest.rejected` messages with user-facing feedback. Quest log full, prerequisites unmet, inventory full all produce clear rejections. |
| 6. Complexity justified | PASS | No violations of Principle III. Quest tracker singleton is the simplest design for hooking into 8 systems. Period-key reset avoids cron complexity. |

## Project Structure

### Documentation (this feature)

```text
specs/021-quest-system/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions
├── data-model.md        # Phase 1: database schema
├── quickstart.md        # Phase 1: development setup
├── contracts/
│   └── websocket-messages.md  # Phase 1: WS message contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/src/
├── db/
│   ├── migrations/
│   │   └── 022_quest_system.sql          # New migration
│   └── queries/
│       └── quests.ts                     # New query module
├── game/
│   └── quest/
│       ├── quest-handler.ts              # New: WS message handlers
│       ├── quest-service.ts              # New: DTO builders, business logic
│       └── quest-tracker.ts              # New: event-based progress tracking
└── index.ts                              # Modified: register quest handlers

shared/protocol/
└── index.ts                              # Modified: quest types + DTOs

admin/
├── backend/src/
│   ├── routes/
│   │   └── quests.ts                     # New: REST CRUD + catalog endpoint
│   └── index.ts                          # Modified: mount quests router
└── frontend/src/
    ├── ui/
    │   └── quest-manager.ts              # New: admin quest editor
    ├── editor/
    │   └── api.ts                        # Modified: add quest API functions
    └── main.ts                           # Modified: add Quests tab

frontend/src/
├── ui/
│   ├── QuestPanel.ts                     # New: NPC quest interaction modal
│   ├── QuestLog.ts                       # New: quest journal panel
│   ├── QuestTracker.ts                   # New: HUD overlay
│   └── BuildingPanel.ts                  # Modified: add quest dialogue option
└── scenes/
    └── GameScene.ts                      # Modified: wire quest message handlers
```

**Structure Decision**: Follows existing monorepo structure. New quest subsystem in `backend/src/game/quest/` mirrors established patterns (crafting, gathering, combat). Admin quest editor follows the Manager pattern used by all existing admin entity editors.

## Complexity Tracking

> No violations. All designs follow established patterns in the codebase.

## Constitution Re-Check (Post-Design)

| Gate | Status | Post-Design Notes |
|------|--------|-------------------|
| 1. No REST for game state | PASS | Confirmed: 5 client→server WS messages, 7 server→client WS messages. Admin REST is non-game-state CRUD only. |
| 2. Server-side validation | PASS | Confirmed: quest-handler.ts validates prerequisites, completion state, inventory capacity, quest log limit. All client input treated as untrusted. |
| 3. Structured logging | PASS | Confirmed: quest-handler.ts and quest-tracker.ts will use existing `log()` utility for all quest events. |
| 4. Contract documented | PASS | Confirmed: `contracts/websocket-messages.md` documents all 12 message types with full TypeScript interfaces. |
| 5. Graceful rejection | PASS | Confirmed: `quest.rejected` message type with 8 typed rejection reasons. Frontend will display user-friendly messages. |
| 6. Complexity justified | PASS | No violations. Quest tracker singleton, period-key reset, and event-based hooks are all minimal-complexity designs. |
