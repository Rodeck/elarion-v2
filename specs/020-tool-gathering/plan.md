# Implementation Plan: Tool Durability & Gathering System

**Branch**: `020-tool-gathering` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-tool-gathering/spec.md`

## Summary

Add tool durability (tool_type, max_durability, power) to item definitions, per-instance durability tracking on inventory items, and a new "gather" building action type. Players use tools at buildings to passively gather resources over a configurable duration (30–120s). Each second ticks an event (resource, gold, monster combat, accident, nothing) drawn from weighted config. HP loss persists, 0 HP blocks all actions, tools break at 0 durability. Gathering sessions are in-memory (like combat), with full durability cost applied on end regardless of reason.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — migration 021 (alter item_definitions, inventory_items, building_actions, characters)
**Testing**: Manual testing via admin panel + in-game flow
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Multiplayer web game (WebSocket real-time)
**Performance Goals**: 1-second tick interval per active gathering session; support concurrent gathering sessions for all connected players
**Constraints**: Gathering sessions are short-lived (30–120s); in-memory is acceptable
**Scale/Scope**: ~4 packages touched (backend, frontend, shared, admin); 1 new migration; 2 new backend service files; ~10 modified files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| **1. No REST for game state** | PASS | All gathering actions use WebSocket messages (gathering.start, gathering.cancel, gathering.tick, gathering.ended). Admin CRUD uses REST which is non-game-state. |
| **2. Server-side validation** | PASS | All validation (tool type, durability, HP, action lock) happens server-side before session starts. Client sends requests, server validates and processes. |
| **3. Structured logging** | PASS | Plan includes structured logging for: gathering start/end, event ticks, validation rejections, tool destruction, combat triggers. |
| **4. Contract documented** | PASS | `contracts/websocket-messages.md` documents all new and modified message types with full payload interfaces. |
| **5. Graceful rejection** | PASS | `gathering.rejected` message with typed reason codes. Frontend handles rejection by re-enabling UI and showing error. |
| **6. Complexity justified** | PASS | No complexity violations — design follows existing patterns (in-memory sessions like combat, JSONB config like explore, boolean flag like in_combat). |

**Post-Phase 1 re-check**: All gates still pass. No new complexity introduced during design.

## Project Structure

### Documentation (this feature)

```text
specs/020-tool-gathering/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── websocket-messages.md
├── checklists/
│   └── requirements.md
└── tasks.md                     # Created by /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 021_tool_gathering.sql          # NEW — schema changes
│   │   └── queries/
│   │       ├── inventory.ts                     # MODIFY — tool fields, durability queries
│   │       └── characters.ts                    # MODIFY — in_gathering field
│   └── game/
│       ├── gathering/
│       │   ├── gathering-service.ts             # NEW — session manager, tick loop
│       │   └── gathering-handler.ts             # NEW — WS message handler
│       ├── world/
│       │   └── building-action-handler.ts       # MODIFY — in_gathering gate, gather routing
│       ├── combat/
│       │   └── explore-combat-service.ts        # MODIFY — HP > 0 guard
│       └── inventory/
│           └── inventory-grant-service.ts       # MODIFY — init current_durability for tools

shared/
└── protocol/
    └── index.ts                                 # MODIFY — new types and payloads

frontend/
└── src/
    ├── ui/
    │   ├── BuildingPanel.ts                     # MODIFY — gather action UI
    │   └── InventoryPanel.ts                    # MODIFY — durability display
    └── websocket/
        └── message-handler.ts                   # MODIFY — gathering.* handlers

admin/
├── backend/
│   └── src/
│       └── routes/
│           ├── items.ts                         # MODIFY — tool fields on create/update
│           └── buildings.ts                     # MODIFY — gather action type + config
└── frontend/
    └── src/
        └── pages/
            ├── items.ts                         # MODIFY — tool form fields
            └── building-actions.ts              # MODIFY — gather event config UI
```

**Structure Decision**: Follows existing monorepo layout. New `backend/src/game/gathering/` directory mirrors existing `backend/src/game/expedition/` and `backend/src/game/combat/` patterns.

## Complexity Tracking

> No violations — all design decisions follow existing patterns.

| Aspect | Pattern Used | Existing Precedent |
|--------|-------------|-------------------|
| In-memory session map | `Map<string, GatheringSession>` | `CombatSession` in combat system |
| JSONB action config | `building_actions.config` | Explore config, expedition config |
| Boolean action lock | `characters.in_gathering` | `characters.in_combat` |
| Per-second tick loop | `setInterval` + session state | Combat session turn timer |
| Nullable category columns | `tool_type`, `max_durability` on item_definitions | `weapon_subtype`, `heal_power` on item_definitions |
