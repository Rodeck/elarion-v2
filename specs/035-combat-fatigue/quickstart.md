# Quickstart: Combat Fatigue System

**Branch**: `035-combat-fatigue` | **Date**: 2026-04-06

## What This Feature Does

Adds a fatigue mechanic to all combat types (monster, boss, PvP). After a configurable number of rounds, both combatants start taking escalating true damage each round. Admins configure fatigue settings per combat type. The frontend shows a countdown timer and a debuff icon once fatigue activates.

## Key Files to Modify

### Backend (game server)

| File | Change |
|------|--------|
| `backend/src/db/migrations/039_combat_fatigue.sql` | **NEW** — Create `fatigue_config` table |
| `backend/src/db/queries/fatigue-config.ts` | **NEW** — Query functions for fatigue config |
| `backend/src/game/combat/combat-session.ts` | Add fatigue state to session, inject damage in `closeActiveWindow()` |
| `backend/src/game/boss/boss-combat-handler.ts` | Add fatigue state to boss session, inject damage in `runEnemyTurn()` |
| `backend/src/game/arena/arena-combat-handler.ts` | Add fatigue state to PvP sessions, inject damage after effect ticks |

### Shared Protocol

| File | Change |
|------|--------|
| `shared/protocol/index.ts` | Add `FatigueConfigDto`, `FatigueStateDto`, `'fatigue_damage'` event kind, extend combat payloads |

### Admin Backend

| File | Change |
|------|--------|
| `admin/backend/src/routes/fatigue-config.ts` | **NEW** — GET/PUT endpoints for fatigue settings |
| `admin/backend/src/index.ts` | Register fatigue-config router |

### Admin Frontend

| File | Change |
|------|--------|
| `admin/frontend/src/editor/api.ts` | Add fatigue config API functions |
| `admin/frontend/src/ui/fatigue-config-manager.ts` | **NEW** — Admin UI panel for fatigue settings |
| `admin/frontend/src/main.ts` | Add fatigue config tab |

### Game Frontend

| File | Change |
|------|--------|
| `frontend/src/ui/CombatScreen.ts` | Add fatigue timer bar, fatigue debuff rendering, fatigue event formatting |
| `frontend/src/scenes/GameScene.ts` | Pass fatigue data from WebSocket messages to CombatScreen |

## Implementation Order

1. **Migration + DB queries** — Create table, write query functions
2. **Shared protocol** — Add types and extend payloads
3. **Backend combat handlers** — Add fatigue logic to all 3 combat types
4. **Admin backend + frontend** — REST endpoints and config UI
5. **Game frontend** — Timer bar, debuff icon, combat log formatting
6. **Tooling** — Update game-data script, CLAUDE.md if needed

## How to Test

1. Run migration: apply `039_combat_fatigue.sql`
2. Set fatigue config via admin panel (e.g., monster: start_round=5, base_damage=3, increment=2)
3. Start a monster combat and let 5+ rounds pass
4. Verify: both combatants take 3, 5, 7, 9... damage per round
5. Verify: fatigue timer shows countdown, debuff icon appears at round 5
6. Verify: combat log shows "Fatigue deals X damage" entries
7. Set start_round=0, verify fatigue is disabled (no timer, no damage)
8. Repeat for boss and PvP combat types
