# Quickstart: Day/Night Cycle

**Branch**: `013-day-night-cycle` | **Date**: 2026-03-09

---

## What This Feature Adds

A global server-authoritative day/night cycle (45 min day / 15 min night) that:
- Broadcasts phase changes to all connected players via WebSocket
- Triggers 10% random enemy encounters per node step during night
- Applies a 10% stat bonus to all enemies during night
- Displays a progress bar (sun/yellow for day, moon/blue for night) at the top of the map
- Darkens the map area with a subtle overlay during night
- Allows admins to force `/day` or `/night` via the existing chat command system

---

## Files Changed / Created

### New files

| Path | Purpose |
|------|---------|
| `backend/src/game/world/day-cycle-service.ts` | Singleton managing cycle state, timer, and global broadcast |
| `backend/src/game/world/night-encounter-service.ts` | Random encounter roll + combat resolution for night travel |
| `backend/src/db/migrations/015_day_night_cycle.sql` | New `map_random_encounter_tables` table |
| `backend/src/db/queries/encounter-tables.ts` | DB query functions for encounter table CRUD |
| `frontend/src/ui/DayNightBar.ts` | HTML progress bar + night overlay component |
| `admin/backend/src/routes/encounter-table.ts` | REST endpoints for encounter table admin management |
| `specs/013-day-night-cycle/` | This spec directory |

### Modified files

| Path | What changes |
|------|-------------|
| `shared/protocol/index.ts` | New types: `DayNightStateDto`, `NightEncounterResultPayload`; extended `WorldStatePayload` |
| `backend/src/game/admin/admin-command-handler.ts` | Add `/day` and `/night` cases |
| `backend/src/game/world/zone-broadcasts.ts` | Add `broadcastToAll()` helper |
| `backend/src/game/world/city-movement-handler.ts` | Per-step encounter roll during night |
| `backend/src/game/world/movement-handler.ts` | Per-move encounter roll during night |
| `backend/src/game/combat/explore-combat-service.ts` | Apply 1.1× night bonus to monster stats |
| `backend/src/websocket/handlers/world-state-handler.ts` | Include `day_night_state` in `world.state` |
| `backend/src/websocket/server.ts` | Export `broadcastToAllSessions()` utility |
| `frontend/src/scenes/GameScene.ts` | Handle `world.day_night_changed`, `night.encounter_result`; mount `DayNightBar` |
| `admin/backend/src/app.ts` (or router file) | Register new encounter-table routes |
| `admin/frontend/` | New UI section for per-map encounter table management |

---

## Running Locally

1. **Apply migration**:
   ```bash
   # From repo root
   npm run db:migrate
   # or directly:
   psql $DATABASE_URL -f backend/src/db/migrations/015_day_night_cycle.sql
   ```

2. **Start backend** (no new env vars required):
   ```bash
   cd backend && npm run dev
   ```
   The cycle starts automatically at server boot (day phase, t=0).

3. **Start frontend**:
   ```bash
   cd frontend && npm run dev
   ```

4. **Test day/night switch** (admin account required):
   - Open the game, log in as an admin.
   - Type `/night` in the chat box.
   - The progress bar should switch to night mode (blue, moon icon) and the map should darken.
   - Type `/day` to return to day mode.

5. **Test night encounter** (requires a map with an encounter table):
   - Open the admin panel → Maps → select a city map → Encounter Table section.
   - Add one or more monsters with weights.
   - Switch the game to night (`/night`).
   - Move around the map. Approximately 1 in 10 node steps should trigger a combat modal.

---

## Key Implementation Notes

### DayCycleService
- Exported singleton from `day-cycle-service.ts`.
- Initialized once in the server entry point (or lazily on first import).
- Calls `broadcastToAll()` on each transition.
- `forcePhase(phase)` resets `phaseStartedAt` to `Date.now()` and reschedules the timer.

### Night stat bonus
- In `explore-combat-service.ts` and `night-encounter-service.ts`, after fetching the monster from DB:
  ```typescript
  const isNight = dayCycleService.getPhase() === 'night';
  const multiplier = isNight ? 1.1 : 1.0;
  const monsterHp = Math.ceil(monster.hp * multiplier);
  const monsterAttack = Math.ceil(monster.attack * multiplier);
  const monsterDefense = Math.ceil(monster.defense * multiplier);
  ```
- `Math.ceil` ensures stats are whole numbers (consistent with existing integer stat model).

### Progress bar positioning
- The `DayNightBar` element is positioned inside `#game` with `position: absolute; top: 0; left: 0; width: 100%; z-index: 10`.
- The night overlay is a sibling `<div>` with `position: absolute; inset: 0; background: rgba(0,0,30,0.35); pointer-events: none; z-index: 5`.
- Both are toggled by adding/removing a CSS class when `world.day_night_changed` is received.

### Encounter table weighted selection
- Reuses the existing `pickMonster()` algorithm from `explore-combat-service.ts` (extract to a shared utility or duplicate the small function in `night-encounter-service.ts`).
