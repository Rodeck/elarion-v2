# Implementation Plan: Day/Night Cycle

**Branch**: `013-day-night-cycle` | **Date**: 2026-03-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-day-night-cycle/spec.md`

## Summary

Introduce a global, server-authoritative day/night cycle (45 min day / 15 min night) that broadcasts phase changes to all connected players via WebSocket. During night: every node step carries a 10% chance of triggering a random enemy encounter (enemy pool configured per map in a new DB table); all enemies across the game gain a 10% stat bonus. The cycle is visualised via a progress bar at the top of the map area (yellow/sun for day, blue/moon for night) plus a subtle dark overlay on the map. Admins can force `/day` or `/night` via the existing chat command system. Research findings in `research.md`; data model in `data-model.md`; contracts in `contracts/day-night-cycle.md`.

---

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — one new table (`map_random_encounter_tables`); no schema changes to existing tables
**Testing**: `npm test && npm run lint` (existing project command)
**Target Platform**: Browser (frontend), Linux/Node.js server (backend)
**Project Type**: Multiplayer web game (WebSocket-based client/server)
**Performance Goals**: Phase broadcast delivered to all clients within 1 s; encounter roll adds < 5 ms to movement handler latency
**Constraints**: Cycle state is in-memory only (resets on restart); no new npm packages required
**Scale/Scope**: Single server process; all connected players share one cycle; encounter table CRUD via admin UI

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status | Notes |
|------|-------------|--------|-------|
| 1. No REST for game state | Phase changes, encounter rolls, and night broadcasts all use the WS persistent connection. The only REST usage is encounter table CRUD on the admin backend, which is not game state. | ✅ PASS | |
| 2. Server-side validation | Cycle state managed exclusively on server. Encounter roll computed server-side. Admin command validated by existing `is_admin` check. Night stat bonus applied in server combat service. | ✅ PASS | |
| 3. Structured logging | `DayCycleService` logs phase transitions. `night-encounter-service.ts` logs encounter rolls and results. Admin commands already logged. | ✅ PASS | Existing `log()` function used throughout |
| 4. Contract documented | Two new S→C message types (`world.day_night_changed`, `night.encounter_result`) and one modified (`world.state`) documented in `contracts/day-night-cycle.md`. | ✅ PASS | |
| 5. Graceful rejection handling | Frontend handles `world.day_night_changed` with no rejection path (broadcast, not a request). `night.encounter_result` is handled by the existing `CombatModal`. If the client does not handle these types, the dispatcher silently ignores them (no freeze). | ✅ PASS | |
| 6. Complexity justified | No violations of Principle III detected. | ✅ PASS | No Complexity Tracking entries needed |

---

## Project Structure

### Documentation (this feature)

```text
specs/013-day-night-cycle/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── day-night-cycle.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
shared/
└── protocol/
    └── index.ts                              # MODIFIED: DayNightStateDto, NightEncounterResultPayload, WorldStatePayload.day_night_state

backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 015_day_night_cycle.sql       # NEW: map_random_encounter_tables
│   │   └── queries/
│   │       └── encounter-tables.ts           # NEW: getEncounterTable(), upsertEntry(), deleteEntry()
│   ├── game/
│   │   ├── admin/
│   │   │   └── admin-command-handler.ts      # MODIFIED: /day and /night cases
│   │   ├── combat/
│   │   │   └── explore-combat-service.ts     # MODIFIED: night 1.1× stat bonus
│   │   └── world/
│   │       ├── day-cycle-service.ts          # NEW: singleton cycle state + broadcast
│   │       ├── night-encounter-service.ts    # NEW: random encounter roll + combat
│   │       ├── city-movement-handler.ts      # MODIFIED: per-step encounter roll
│   │       ├── movement-handler.ts           # MODIFIED: per-move encounter roll
│   │       └── zone-broadcasts.ts            # MODIFIED: broadcastToAll() helper
│   └── websocket/
│       ├── server.ts                         # MODIFIED: export getSessions() (already exists; expose broadcastToAllSessions)
│       └── handlers/
│           └── world-state-handler.ts        # MODIFIED: include day_night_state in world.state

frontend/
└── src/
    ├── scenes/
    │   └── GameScene.ts                      # MODIFIED: handle day_night_changed, night.encounter_result, mount DayNightBar
    └── ui/
        └── DayNightBar.ts                    # NEW: progress bar + night overlay HTML component

admin/
├── backend/
│   └── src/
│       └── routes/
│           └── encounter-table.ts            # NEW: GET/POST/DELETE /api/maps/:zoneId/encounter-table
└── frontend/
    └── [encounter-table section]             # MODIFIED: new section in map editor for encounter table management
```

**Structure Decision**: Web application layout (Option 2). Frontend and backend are independently deployable packages. Shared types live in `shared/protocol/`. Admin has its own backend/frontend pair. This feature touches all four packages but introduces no new package.

---

## Phase 0: Research

Research is complete. See `research.md` for all decisions and rationale. No NEEDS CLARIFICATION items remain.

**Key resolved decisions**:
- Cycle timer: in-memory `setInterval` singleton, resets on restart.
- Global broadcast: iterate `getSessions()` from `server.ts` via new `broadcastToAll()` in `zone-broadcasts.ts`.
- Encounter table: new `map_random_encounter_tables` PostgreSQL table, managed via admin REST API.
- Night stat bonus: multiply monster stats by 1.1 (Math.ceil) in combat service at initiation time.
- City movement interruption: call existing `cancelActiveMovement()` then resolve combat.
- Tile movement: encounter check appended after successful move application.
- UI: pure HTML components matching existing StatsBar/ChatBox pattern.

---

## Phase 1: Design & Contracts

All Phase 1 artifacts are complete:

- **`data-model.md`**: New table `map_random_encounter_tables`; `DayNightStateDto` and `NightEncounterResultPayload` protocol types; modified `WorldStatePayload`.
- **`contracts/day-night-cycle.md`**: Full specification of `world.day_night_changed`, `night.encounter_result`, and the `world.state` modification. Backward compatibility analysis included.
- **`quickstart.md`**: Local setup, file change inventory, key implementation notes.

### Design Highlights

#### DayCycleService

Single module-level singleton initialised at server startup.

```
DayCycleService
  state: { phase, phaseStartedAt, dayDurationMs, nightDurationMs }
  getPhase(): 'day' | 'night'
  getDto(): DayNightStateDto          -- snapshot for world.state and broadcasts
  forcePhase(phase): void             -- admin override; resets timer
  private scheduleTransition(): void  -- internal setTimeout loop
  private onTransition(): void        -- advance phase, broadcastToAll, reschedule
```

`broadcastToAll()` iterates `getSessions()` and sends `world.day_night_changed` to every authenticated session with an active socket.

#### Night encounter flow (city map)

```
city-movement step timer fires
  ├── apply step (existing: update DB, broadcast city.player_moved)
  ├── IF dayCycleService.getPhase() === 'night'
  │     roll = Math.random()
  │     IF roll < 0.10
  │       cancelActiveMovement(characterId)   ← cancels remaining steps
  │       resolveNightEncounter(session, character, zoneId)
  │         → getEncounterTable(zoneId)
  │         → pickMonster(table)              ← existing algorithm
  │         → getMonsterById(monsterId)
  │         → apply 1.1× night bonus
  │         → run combat loop (same as explore-combat-service)
  │         → sendToSession(session, 'night.encounter_result', result)
  │         → log encounter
  └── check building arrival (existing)
```

#### Night encounter flow (tile map)

```
movement-handler handlePlayerMove
  ├── (existing: rate limit, boundary check, apply move, broadcast, persist)
  └── IF dayCycleService.getPhase() === 'night'
        roll = Math.random()
        IF roll < 0.10
          resolveNightEncounter(session, character, zoneId)
          → sendToSession(session, 'night.encounter_result', result)
```

#### Explore combat night bonus

```
explore-combat-service resolveExplore(session, character, actionId, config)
  ├── (existing: encounter roll, pickMonster)
  ├── getMonsterById(monsterId)
  ├── isNight = dayCycleService.getPhase() === 'night'
  ├── multiplier = isNight ? 1.1 : 1.0
  ├── monsterHp     = Math.ceil(monster.hp * multiplier)      ← NEW
  ├── monsterAttack = Math.ceil(monster.attack * multiplier)  ← NEW
  ├── monsterDef    = Math.ceil(monster.defense * multiplier) ← NEW
  └── (existing: combat loop using adjusted stats)
```

#### DayNightBar (frontend)

```
DayNightBar (pure HTML component)
  constructor(gameContainer: HTMLElement)
    ├── creates <div id="day-night-bar"> inside gameContainer (position: absolute, top: 0)
    │     └── <div class="bar-fill"> (width updated via setInterval)
    │     └── <span class="icon"> (sun ☀ or moon ☾)
    │     └── <span class="time-remaining"> (MM:SS countdown)
    └── creates <div id="night-overlay"> (position: absolute, inset: 0, display: none)

  update(dto: DayNightStateDto): void
    ├── sets phase-dependent classes (day/night → yellow/blue, sun/moon icon)
    ├── shows/hides #night-overlay
    └── starts 1-second setInterval to update fill width + time remaining text

  destroy(): void  ← clears interval, removes DOM elements
```

---

## Complexity Tracking

No violations of Principle III (Simplicity & YAGNI). No entries required.
