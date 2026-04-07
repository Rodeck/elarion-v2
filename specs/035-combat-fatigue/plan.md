# Implementation Plan: Combat Fatigue System

**Branch**: `035-combat-fatigue` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/035-combat-fatigue/spec.md`

## Summary

Add a fatigue mechanic to all combat types (monster, boss, PvP arena) that deals escalating true damage to both combatants after a configurable number of rounds. Configuration is per combat type via the admin panel. The frontend displays a segmented countdown timer before fatigue activates, a debuff icon once active, and combat log entries for each fatigue damage application. The system supports future modifier hooks (onset delay, immunity, damage reduction) with no active modifiers at launch.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (frontends)
**Storage**: PostgreSQL 16 — new `fatigue_config` table (migration 039); in-memory `FatigueState` on combat session objects
**Testing**: Manual testing via game client + admin panel
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web-based multiplayer RPG (monorepo: frontend + backend + admin + shared)
**Performance Goals**: No additional latency per combat round — fatigue is a simple arithmetic calculation
**Constraints**: Fatigue damage must bypass armor/defense (true damage); must not disrupt existing combat flow timing
**Scale/Scope**: 3 combat handlers modified, 1 new DB table, ~12 files touched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Fatigue state flows through existing WebSocket combat messages. Admin config uses REST (non-game-state). |
| 2. Server-side validation | PASS | All fatigue damage calculated server-side. Client receives results only. Config validated in admin backend. |
| 3. Structured logging | PASS | Fatigue damage events logged as combat events. Admin config changes logged. |
| 4. Contract documented | PASS | See `contracts/fatigue-protocol.md` — all new message fields documented. |
| 5. Graceful rejection handling | PASS | No new client actions to reject. Fatigue is server-driven, client is display-only. |
| 6. Complexity justified | PASS | No violations — feature uses existing patterns (extend session objects, add DB table, extend payloads). |
| 7. Tooling updated | PASS | Will add `fatigue-config` to `game-data.js` script for querying. No new entity types requiring game-entities script. No new CLAUDE.md checklist needed (fatigue is a one-time integration, not a recurring multi-file pattern). |

## Project Structure

### Documentation (this feature)

```text
specs/035-combat-fatigue/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research decisions
├��─ data-model.md        # Entity definitions and migration SQL
├── quickstart.md        # Developer quickstart guide
├── contracts/
│   └── fatigue-protocol.md  # WebSocket and REST API contracts
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
���   │   │   └── 039_combat_fatigue.sql          # NEW: fatigue_config table
│   │   └── queries/
│   │       └── fatigue-config.ts               # NEW: DB query functions
│   └── game/
│       ├── combat/
│       │   └── combat-session.ts               # MODIFY: add fatigue to monster combat
│       ├── boss/
│       │   └── boss-combat-handler.ts          # MODIFY: add fatigue to boss combat
│       └─�� arena/
│           └── arena-combat-handler.ts         # MODIFY: add fatigue to PvP combat

shared/
└── protocol/
    └── index.ts                                # MODIFY: add fatigue types and extend payloads

admin/
├── backend/
│   └── src/
│       ├── index.ts                            # MODIFY: register fatigue-config router
│       └─��� routes/
│           └─�� fatigue-config.ts               # NEW: REST endpoints for fatigue config
└── frontend/
    └── src/
        ├── main.ts                             # MODIFY: add fatigue config tab
        ├── editor/
        │   └── api.ts                          # MODIFY: add fatigue config API functions
        └── ui/
            └── fatigue-config-manager.ts       # NEW: admin UI panel

frontend/
└── src/
    ├── ui/
    │   └── CombatScreen.ts                     # MODIFY: fatigue timer bar + debuff + log formatting
    └── scenes/
        └── GameScene.ts                        # MODIFY: pass fatigue data to CombatScreen

scripts/
└─��� game-data.js                                # MODIFY: add fatigue-config query command
```

**Structure Decision**: Follows existing monorepo pattern. New files follow established conventions (query files in `db/queries/`, admin routes in `admin/backend/src/routes/`, admin UI managers in `admin/frontend/src/ui/`). No new directories needed.

## Complexity Tracking

No violations to justify. All design choices follow existing patterns:
- DB table follows `admin_config` pattern (simple key-value-like config table)
- Combat handler modifications follow existing `tickActiveEffects()` pattern
- Admin panel follows existing manager pattern (AdminConfigManager)
- Protocol extensions are additive optional fields
