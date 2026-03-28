# Implementation Plan: Boss Encounter System

**Branch**: `027-boss-encounters` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/027-boss-encounters/spec.md`
**Game Design**: `game_design/boss-encounters/design.md`

## Summary

Implement a boss encounter system where persistent world bosses guard buildings, blocking all actions until defeated. Bosses use abilities, have hidden HP, persist HP across fights, allow one challenger at a time (token-gated), respawn on timers, and are managed via a new admin panel. This requires new DB tables, a combat variant, building action blocking, map display, and admin CRUD.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (game backend), Phaser 3.60 + Vite 5 (game frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — 4 new tables (`bosses`, `boss_abilities`, `boss_loot`, `boss_instances`); in-memory `Map<bossId, BossInstance>` for active instance state
**Testing**: Manual testing via game client + admin panel
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Multiplayer web game (monorepo: frontend + backend + shared + admin)
**Performance Goals**: Boss state broadcasts to zone players within 1 second; combat turn processing same as regular combat (~50ms)
**Constraints**: Single-player boss lock must be atomic (DB transaction); boss HP persisted for crash recovery
**Scale/Scope**: ~15 new files across 4 packages; touches combat system, building system, map rendering, admin panel

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Boss challenges, combat, and state broadcasts all use WebSocket. Admin CRUD uses REST (non-game-state, content management). |
| 2. Server-side validation | PASS | Token check, boss lock, action blocking — all server-side. Client state is projection only. |
| 3. Structured logging | PASS | Boss spawns, challenges, combat outcomes, respawns logged with structured format. |
| 4. Contract documented | PASS | All new message types documented in contracts/ (boss:state, boss:challenge, boss:combat_*). |
| 5. Graceful rejection handling | PASS | Frontend handles: no token, boss in combat, boss defeated — with user feedback messages. |
| 6. Complexity justified | PASS | No unnecessary abstractions. Boss combat reuses existing CombatEngine. Separate `bosses` table justified (different lifecycle from monsters). |
| 7. Tooling updated | PASS | game-data.js gets `bosses` + `boss-instances` commands. game-entities.js gets boss CRUD. CLAUDE.md gets "Adding a Boss" checklist. gd.design template updated. |

## Project Structure

### Documentation (this feature)

```text
specs/027-boss-encounters/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── boss-messages.md # WebSocket message contracts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 029_boss_system.sql          # New tables
│   │   └── queries/
│   │       └── bosses.ts                     # Boss DB queries
│   └── game/
│       └── boss/
│           ├── boss-instance-manager.ts      # Spawn/despawn/respawn lifecycle
│           ├── boss-combat-handler.ts        # Combat variant (extends combat patterns)
│           └── boss-loot-service.ts          # Loot rolling on boss defeat

shared/
└── protocol/
    └── index.ts                              # Boss DTOs + message types (additions)

frontend/
└── src/
    ├── entities/
    │   └── BossSprite.ts                     # Boss map sprite
    └── ui/
        ├── BossInfoPanel.ts                  # Boss click panel (status, challenge)
        └── CombatScreen.ts                   # Modified for boss variant (hidden HP)

admin/
├── backend/
│   └── src/
│       └── routes/
│           └── bosses.ts                     # Boss admin REST API
└── frontend/
    └── src/
        └── ui/
            └── boss-manager.ts               # Boss admin UI

scripts/
├── game-data.js                              # Add boss query commands
└── game-entities.js                          # Add boss CRUD commands
```

**Structure Decision**: Follows existing monorepo layout. Boss backend logic grouped in `backend/src/game/boss/` (mirrors `combat/`, `quest/`, `fishing/` patterns). Admin follows existing `routes/<entity>.ts` + `ui/<entity>-manager.ts` convention.

## Complexity Tracking

No complexity violations. The boss system reuses existing patterns:
- Combat engine reused (not forked) — boss combat is a variant, not a replacement
- Building blocking is a single guard check in existing handler
- Admin routes follow established monster/NPC route patterns
- Separate `bosses` table (vs reusing `monsters`) is justified: bosses have persistent instances, building assignments, respawn timers, and ability loadouts — fundamentally different lifecycle
