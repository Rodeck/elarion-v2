# Research: Day/Night Cycle

**Branch**: `013-day-night-cycle` | **Date**: 2026-03-09

## Decisions

---

### Decision 1: Cycle timer implementation

**Decision**: Node.js `setInterval`-based singleton service (`DayCycleService`) with an in-memory state object; no persistence.

**Rationale**: The spec explicitly states the cycle resets to day on server restart. A singleton module with a single `setInterval` is the simplest correct implementation. The existing codebase uses no scheduled-job framework — no need to introduce one here.

**Alternatives considered**:
- External job queue (e.g., cron, pg-boss) — rejected; adds a dependency for a feature that explicitly resets on restart.
- Database-persisted cycle state — rejected; spec assumption says restart resets to day.

---

### Decision 2: Broadcast mechanism for global phase changes

**Decision**: Use the existing `getSessions()` export from `backend/src/websocket/server.ts` to iterate all authenticated sessions and push the phase-change message via `sendToSession()`. A thin `broadcastToAll()` helper will be added to `zone-broadcasts.ts`.

**Rationale**: `getSessions()` already exists and returns the full session map. No new infrastructure is needed. The `broadcastToZone()` pattern in `zone-broadcasts.ts` is the established precedent for session-level broadcast helpers.

**Alternatives considered**:
- Zone-by-zone broadcast with `broadcastToZone()` per zone — works but requires iterating all zone IDs, which is indirect.
- New global event emitter — rejected (Principle III: YAGNI).

---

### Decision 3: Per-map encounter table storage

**Decision**: New PostgreSQL table `map_random_encounter_tables` with columns `id`, `zone_id`, `monster_id`, `weight`. Managed via the admin backend REST API (new endpoints on the existing Express server).

**Rationale**: The existing `ExploreActionConfig.monsters` array already uses an identical `{ monster_id, weight }` weighted structure, and `pickMonster()` in `explore-combat-service.ts` already implements the weighted-random algorithm. The new table reuses the same pattern with a clean relational design. A separate table (vs. a JSONB column on `map_zones`) allows standard CRUD and foreign key enforcement.

**Alternatives considered**:
- JSONB column on `map_zones` — simpler schema, but loses FK integrity and is harder to query in the admin UI.
- Reusing `building_actions` — rejected; encounter tables are map-level, not building-level.

---

### Decision 4: Night stat bonus application point

**Decision**: Apply the 1.1× multiplier to the monster's `hp`, `attack`, and `defense` at the moment the combat struct is built inside the combat service (before any round simulation), not at query time.

**Rationale**: Monster base stats live in the DB. Multiplying at the service layer keeps the DB clean and avoids any race condition where a phase transition mid-query could produce inconsistent stat reads. The in-progress combat assumption (stats fixed at initiation) is cleanly enforced by this approach.

**Alternatives considered**:
- Multiply in the DB query — rejected; pollutes the data layer with game-phase logic.
- Multiply after combat — nonsensical; stats must be set before rounds are simulated.

---

### Decision 5: Night encounter during city movement (mid-route interruption)

**Decision**: Inside the per-step `setTimeout` callback in `city-movement-handler.ts`, after applying the step, check if night is active and roll the encounter. On a successful roll, call `cancelActiveMovement(characterId)` immediately (before resolving combat) to cancel all remaining timers, then resolve the encounter and send the result.

**Rationale**: `cancelActiveMovement()` already exists in `city-movement-handler.ts` and clears all pending timers. This is the established cancellation path. The encounter result is sent via a new `night.encounter_result` WS message type (reuses the combat payload shape from `BuildingExploreResultPayload`).

**Alternatives considered**:
- Set a flag and skip remaining steps — more complex and leaks timer memory.
- Let the route finish then resolve combat — incorrect; spec says route is cancelled.

---

### Decision 6: Night encounter during tile movement

**Decision**: In `movement-handler.ts`, after a successful move is applied and broadcast, if night is active roll a 10% encounter. On success, look up the map's encounter table and resolve combat, sending `night.encounter_result` to the player.

**Rationale**: Tile movement is one-step-at-a-time (the client sends a new `player.move` per step), so there is no multi-step timer to cancel. The encounter simply follows the move broadcast.

**Alternatives considered**:
- Reject the move entirely and trigger combat from the previous position — confusing UX; move should be applied first.

---

### Decision 7: DayNightBar UI placement

**Decision**: Pure HTML `<div>` element injected into the existing `#game` container, positioned absolutely at the top edge of the Phaser canvas. The dark night overlay is a semi-transparent `<div>` covering the same area with `pointer-events: none`.

**Rationale**: The existing UI components (StatsBar, ChatBox, CombatLog) all follow the pattern of pure HTML elements mounted outside the Phaser canvas. This keeps the Phaser scene clean and avoids sprite/camera layering complexity.

**Alternatives considered**:
- Phaser Graphics overlay — would require recalculating canvas coordinates on resize; HTML absolute positioning is simpler.
- CSS filter on `#game` — affects the entire game div including the progress bar itself; not appropriate.

---

### Decision 8: WorldStatePayload extension

**Decision**: Add an optional `day_night_state` field to `WorldStatePayload` in `shared/protocol/index.ts`, populated by `sendWorldState()` from the live `DayCycleService` state.

**Rationale**: Players who connect mid-cycle must immediately receive the current phase and elapsed time so the progress bar renders correctly. Piggybacking on the existing `world.state` message (already sent on connect) is the simplest delivery mechanism.

**Alternatives considered**:
- Separate `world.day_night_state` message sent after `world.state` — works, but adds a round-trip; inline is simpler.
