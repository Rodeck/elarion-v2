# Implementation Plan: Arena System

**Branch**: `029-arena-system` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/029-arena-system/spec.md`  
**Design Reference**: `game_design/arena-system/design.md`

## Summary

The arena system adds PvP combat to Elarion via a new `'arena'` building action type. Players enter an arena building, become invisible on the map, and can challenge other participants or NPC fighters. Combat reuses the existing turn-based engine with a symmetric PvP adaptation (both players attack simultaneously). HP persists between bouts, losers are kicked, and configurable timers/rewards are managed by admins. The implementation spans all four packages (backend, frontend, shared, admin) with a new DB migration, ~15 WebSocket message types, in-memory arena state management, and an admin CRUD panel.

## Technical Context

**Language/Version**: TypeScript 5.x (all packages)  
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)  
**Storage**: PostgreSQL 16 — 3 new tables (`arenas`, `arena_monsters`, `arena_participants`), 1 ALTER (`characters.arena_id`); in-memory `Map<string, PvpCombatSession>` for active fights  
**Testing**: Manual integration testing (existing project pattern — no automated test framework)  
**Target Platform**: Browser (frontend), Linux/Windows server (backend)  
**Project Type**: Multiplayer web game (monorepo: backend + frontend + shared + admin)  
**Performance Goals**: Arena lobby updates visible to participants within 2 seconds; combat turn resolution within existing engine timing (3s active window + 2s enemy delay)  
**Constraints**: Must not modify core combat engine formulas; must follow CLAUDE.md "Adding a New Building Action Type" 7-location checklist  
**Scale/Scope**: Single arena initially; architecture supports multiple arenas; ~50 concurrent arena participants max

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All arena interactions (enter, leave, challenge, combat) use WebSocket messages. Admin CRUD uses REST (non-game-state, admin tool). |
| 2. Server-side validation present | PASS | All arena actions validated server-side: cooldown checks, combat state checks, level bracket enforcement, token consumption, min stay time. Client is a projection only. |
| 3. Structured logging required | PASS | Arena handler will log: arena enter/leave, challenge issued/rejected, combat start/end, kick events, admin actions. Follows existing `logger.info()` pattern. |
| 4. Contract documented | PASS | All ~15 new WebSocket message types documented in `contracts/arena-messages.md`. |
| 5. Graceful rejection handling | PASS | Every arena action has a rejection message type (`arena:enter_rejected`, `arena:leave_rejected`, `arena:challenge_rejected`). Frontend handles rejections with user-facing messages. |
| 6. Complexity justified | PASS | No violations of Principle III. PvP combat adapter is the minimum viable approach — reuses existing engine functions, no new abstractions. |
| 7. Tooling updated | PASS | New `'arena'` building action type requires updates to: CLAUDE.md checklist (new "Adding Arena" section not needed — covered by existing "Adding a New Building Action Type"), `scripts/game-data.js` (add `arenas` command), `scripts/game-entities.js` (add `'arena'` to `VALID_ACTION_TYPES`), `game-entities.md` skill docs. |

## Project Structure

### Documentation (this feature)

```text
specs/029-arena-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── arena-messages.md  # WebSocket protocol contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 031_arena_system.sql          # New tables + ALTER
│   │   └── queries/
│   │       └── arenas.ts                     # Arena DB queries
│   ├── game/
│   │   └── arena/
│   │       ├── arena-handler.ts              # Enter/leave/lobby logic
│   │       ├── arena-combat-handler.ts       # PvP + NPC combat sessions
│   │       └── arena-state-manager.ts        # In-memory participant + fight tracking
│   └── websocket/
│       └── validator.ts                      # Add arena message schemas

frontend/
├── src/
│   ├── ui/
│   │   └── ArenaPanel.ts                     # Arena lobby UI
│   └── scenes/
│       └── GameScene.ts                      # Wire arena message handlers

shared/
└── protocol/
    └── index.ts                              # New DTOs + message types

admin/
├── backend/
│   └── src/
│       └── routes/
│           └── arenas.ts                     # Admin CRUD routes
└── frontend/
    └── src/
        └── ui/
            └── arena-manager.ts              # Admin arena management UI
```

**Structure Decision**: Follows existing project patterns. Arena backend logic goes in a new `backend/src/game/arena/` directory (same pattern as `boss/`, `combat/`, `quest/`). Admin routes follow `admin/backend/src/routes/<entity>.ts` convention.

## Complexity Tracking

No violations. All design choices follow existing patterns:
- PvP combat adapter reuses existing engine functions (no new combat engine)
- Arena state manager follows the same `Map<id, Session>` pattern as boss combat
- Building action type follows the established 7-location checklist
- Admin CRUD follows the existing `admin/backend/src/routes/*.ts` pattern
