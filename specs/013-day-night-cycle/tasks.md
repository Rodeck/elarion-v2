# Tasks: Day/Night Cycle

**Input**: Design documents from `/specs/013-day-night-cycle/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lay the foundational types, migration, and helpers that every user story depends on. All four tasks touch different files and can be done in parallel.

- [x] T001 [P] Add `DayNightStateDto` and `NightEncounterResultPayload` types to `shared/protocol/index.ts`; extend `WorldStatePayload` with `day_night_state: DayNightStateDto`; add `WorldDayNightChangedPayload` and the two new message type aliases (`WorldDayNightChangedMessage`, `NightEncounterResultMessage`) to `AnyServerMessage`
- [x] T002 [P] Create `backend/src/db/migrations/015_day_night_cycle.sql` — new `map_random_encounter_tables` table (`id SERIAL PK`, `zone_id INT FK map_zones`, `monster_id INT FK monsters`, `weight INT > 0`, `UNIQUE(zone_id, monster_id)`, index on `zone_id`); apply migration via `psql $DATABASE_URL -f` or `npm run db:migrate`
- [x] T003 [P] Create `backend/src/db/queries/encounter-tables.ts` — export `getEncounterTable(zoneId): Promise<{monster_id: number, weight: number}[]>`, `upsertEncounterEntry(zoneId, monsterId, weight)`, `deleteEncounterEntry(entryId)`, `getEncounterEntriesForAdmin(zoneId)` (includes monster name for UI)
- [x] T004 [P] Add `broadcastToAll(type: string, payload: unknown): void` helper to `backend/src/websocket/server.ts` — iterates `sessions` map, sends to every session with an open socket and a `characterId` (authenticated)

**Checkpoint**: Shared types compiled, migration applied, DB query module ready, broadcast helper available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `DayCycleService` is the single dependency shared by ALL user stories (US1–US5). No user story work can begin until this singleton exists.

**⚠️ CRITICAL**: No user story implementation can start until T005 is complete

- [x] T005 Create `backend/src/game/world/day-cycle-service.ts` — module-level singleton exporting: `getPhase(): 'day' | 'night'`, `getDto(): DayNightStateDto` (snapshot of current state), `forcePhase(phase: 'day' | 'night'): void` (admin override — resets `phaseStartedAt` to `Date.now()`, reschedules timer); internal `scheduleTransition()` using `setTimeout` for the phase duration minus elapsed time; `onTransition()` advances phase, resets `phaseStartedAt`, calls `broadcastToAll('world.day_night_changed', getDto())`, reschedules; constants: `DAY_DURATION_MS = 45 * 60 * 1000`, `NIGHT_DURATION_MS = 15 * 60 * 1000`; initialize singleton at module load (starts in `day` phase with `phaseStartedAt = Date.now()`)

**Checkpoint**: `DayCycleService` compiles and auto-cycles. Import it in a test file and log `getPhase()` after 1 s — should return `'day'`.

---

## Phase 3: User Story 1 — Day/Night Cycle Progression (Priority: P1) 🎯 MVP

**Goal**: The world cycles between day (45 min) and night (15 min). All connected players see a progress bar at the top of the map showing the current phase (yellow/sun for day, blue/moon for night) and the time remaining. The map darkens during night.

**Independent Test**: Start the server fresh. Log in. Observe the yellow progress bar with sun icon counting down from 45:00. Use `/night` (or wait) to trigger transition — bar immediately switches to blue/silver with moon icon, map darkens, countdown resets to 15:00. When night ends, bar resets to zero and day restarts.

- [x] T006 [US1] Modify `backend/src/websocket/handlers/world-state-handler.ts` — import `dayCycleService` from `day-cycle-service.ts`; add `day_night_state: dayCycleService.getDto()` to the `worldStatePayload` object constructed in `sendWorldState()` (placed after the `city_map` block)
- [x] T007 [US1] Create `frontend/src/ui/DayNightBar.ts` — pure HTML component; constructor receives the `#game` HTMLElement; creates `<div id="day-night-bar">` (position: absolute, top: 0, left: 0, width: 100%, height: 24px, z-index: 10) containing `<div class="dnb-fill">` (width % updated each tick), `<span class="dnb-icon">` (☀ or ☾), `<span class="dnb-time">` (MM:SS remaining); creates sibling `<div id="night-overlay">` (position: absolute, inset: 0, background: rgba(0,0,30,0.35), pointer-events: none, z-index: 5, display: none); day style: yellow fill (`#d4a84b`); night style: blue/silver fill (`#4a6fa5`); exports `update(dto: DayNightStateDto): void` — sets phase classes, shows/hides overlay, starts/resets 1-second `setInterval` updating fill width and countdown text; exports `destroy(): void` — clears interval, removes DOM elements
- [x] T008 [US1] Modify `frontend/src/scenes/GameScene.ts` — import `DayNightBar` and `DayNightStateDto`; add `private dayNightBar: DayNightBar | null = null` field; in the `world.state` handler after the map is rendered, instantiate `DayNightBar` (or call `update()` if already exists) passing `payload.day_night_state`; register handler for `world.day_night_changed` that calls `this.dayNightBar?.update(payload)` on the `WorldDayNightChangedPayload`; call `dayNightBar.destroy()` in scene shutdown

**Checkpoint**: Boot game, confirm yellow progress bar visible, bar fills over time, moon/dark overlay appear on phase change.

---

## Phase 4: User Story 2 — Admin Phase Control (Priority: P2)

**Goal**: An admin types `/night` or `/day` in chat. The phase immediately switches for all players and the timer resets.

**Independent Test**: Log in as admin, type `/night` — all connected clients immediately show the night progress bar and dark overlay. Type `/day` — immediately reverts. Non-admin receives no effect (command rejected). Admin gets `admin.command_result` success message in response.

- [x] T009 [US2] Modify `backend/src/game/admin/admin-command-handler.ts` — import `dayCycleService`; add `case '/day':` and `case '/night':` to the `switch (command)` block; each case calls `dayCycleService.forcePhase('day'|'night')` (which internally broadcasts `world.day_night_changed` to all sessions via `broadcastToAll`), then calls `reply(true, 'Phase switched to day/night.')` and logs the admin action using `log('info', 'admin', 'admin_command', { event: 'admin_command', admin_account_id, command: 'day'|'night', success: true })`; update the `default` case's help text to include `/day` and `/night`

**Checkpoint**: Admin types `/night`, all clients switch immediately. Admin sees success reply. Non-admin attempt returns "Unknown command".

---

## Phase 5: User Story 3 — Night Encounter Rolls on Movement (Priority: P3)

**Goal**: During night every node step has a 10% chance of triggering a random enemy combat encounter. The encounter interrupts/cancels remaining movement. The combat result is shown to the player.

**Independent Test**: Configure an encounter table for a map (can be done directly in DB for now). Switch to night. Move across 20+ nodes — at least 1–3 encounters should trigger (expect ~10% rate). Each encounter displays the combat modal with result. Remaining route is cancelled when an encounter fires.

- [x] T010 [US3] Create `backend/src/game/world/night-encounter-service.ts` — export `resolveNightEncounter(session: AuthenticatedSession, character: Character, zoneId: number): Promise<void>`; implementation: call `getEncounterTable(zoneId)` — if empty, return silently (no encounter); call `pickMonster(table)` (copy the existing weighted-random algorithm from `explore-combat-service.ts` or extract to a shared utility); call `getMonsterById(monsterId)`; apply 1.1× night stat bonus: `monsterHp = Math.ceil(monster.hp * 1.1)`, `monsterAttack = Math.ceil(monster.attack * 1.1)`, `monsterDefense = Math.ceil(monster.defense * 1.1)`; run combat loop (same round-by-round algorithm as `explore-combat-service.ts`); on win: call `awardXp()` and roll loot via `getLootByMonsterId()` + `grantItemToCharacter()`; send `night.encounter_result` to session with full payload including `outcome: 'combat'`, monster stats, rounds, result, xp, items; log encounter with `log('info', 'night-encounter', 'encounter_resolved', { characterId, zoneId, monsterId, result, rounds })`
- [x] T011 [US3] Modify `backend/src/game/world/city-movement-handler.ts` — import `dayCycleService` and `resolveNightEncounter`; inside each step's `setTimeout` callback, after the position update and `broadcastToZone` call (and before the building arrival check), add: `if (!movement.cancelled && dayCycleService.getPhase() === 'night' && Math.random() < 0.10) { cancelActiveMovement(characterId); await resolveNightEncounter(session, character, zoneId); return; }` — note: `character` must be fetched (already fetched at the top of `handleCityMove`) but needs to be captured in the closure; ensure the character object is accessible inside the timer callback scope
- [x] T012 [P] [US3] Modify `backend/src/game/world/movement-handler.ts` — import `dayCycleService`, `resolveNightEncounter`, and `findByAccountId`; after the successful `broadcastToZone` call at the end of `handlePlayerMove`, add: `if (dayCycleService.getPhase() === 'night' && Math.random() < 0.10) { const character = await findByAccountId(session.accountId); if (character) { await resolveNightEncounter(session, character, zoneId); } }` where `zoneId` comes from the `found.zoneId` variable already in scope
- [x] T013 [US3] Modify `frontend/src/scenes/GameScene.ts` — import `NightEncounterResultPayload`; register a handler for `night.encounter_result`; on receipt with `outcome === 'combat'`, construct a `BuildingExploreResultPayload`-compatible object (map fields: `action_id: -1`, `outcome: 'combat'`, rest passthrough) and pass it to the existing combat display logic (same path as `building_action.explore_result`); alternatively, extract the combat display into a shared method `showCombatResult(monster, rounds, result, xp, items)` and call it from both handlers

**Checkpoint**: Night + encounter table configured → move 20 nodes → at least 1 combat modal appears, route cancels, result sent to client.

---

## Phase 6: User Story 4 — Per-Map Encounter Table Configuration (Priority: P4)

**Goal**: Admins can view, add, and remove encounter table entries for each map through the existing admin backend UI.

**Independent Test**: Open admin panel → select a city map → navigate to "Encounter Table" section → add Rat (weight 33), Dog (weight 66), Stone Golem (weight 1) → save → trigger night encounters in game → verify monster distribution approximates configured weights over many samples.

- [x] T014 [US4] Create `admin/backend/src/routes/encounter-table.ts` — Express router with: `GET /` → calls `getEncounterEntriesForAdmin(zoneId)`, returns array of `{ id, monster_id, monster_name, weight }`; `POST /` → validates body `{ monster_id: number, weight: number }` (weight > 0), calls `upsertEncounterEntry(zoneId, monsterId, weight)`, returns created/updated entry; `DELETE /:entryId` → calls `deleteEncounterEntry(entryId)`, returns 204; all routes log via `log()`; `zoneId` comes from `req.params.zoneId` (parsed as integer, 404 if map not found)
- [x] T015 [US4] Register encounter-table routes in the admin backend router/app file — mount as `router.use('/api/maps/:zoneId/encounter-table', encounterTableRouter)` (or equivalent pattern matching existing route registration style in `admin/backend/src/`)
- [x] T016 [US4] Add encounter table management section to the admin frontend map editor — within the map detail view, add an "Encounter Table" section showing a list of current entries (monster name + weight); a form with monster selector (dropdown populated from existing monsters API or free-entry monster_id field) and weight input; "Add" button calls `POST /api/maps/:zoneId/encounter-table`; each row has a "Remove" button calling `DELETE /api/maps/:zoneId/encounter-table/:entryId`; section refreshes list after add/remove

**Checkpoint**: Admin adds 3 monster entries for a map. Entries persist across page reload. In-game night encounters on that map use the configured table.

---

## Phase 7: User Story 5 — Night Enemy Stat Bonus on Exploration (Priority: P5)

**Goal**: Enemies encountered via building Explore actions are also 10% stronger during night. (Random travel encounter bonus was already included in T010.)

**Independent Test**: Note a specific exploration enemy's stats during day. Switch to night (`/night`). Trigger the same explore action. Verify HP, attack, and defence in the combat result payload are each exactly `Math.ceil(base * 1.1)`.

- [x] T017 [US5] Modify `backend/src/game/combat/explore-combat-service.ts` — import `dayCycleService`; after fetching `monster` via `getMonsterById()`, add: `const nightMultiplier = dayCycleService.getPhase() === 'night' ? 1.1 : 1.0; const monsterHp = Math.ceil(monster.hp * nightMultiplier); const monsterAttack = Math.ceil(monster.attack * nightMultiplier); const monsterDefense = Math.ceil(monster.defense * nightMultiplier);`; replace all subsequent references to `monster.hp`, `monster.attack`, `monster.defense` in the combat loop and result payload with the local variables; include `is_night: nightMultiplier > 1` in the `encounter_started` log entry

**Checkpoint**: During night, an explore action combat result shows `max_hp`, `attack`, `defense` each 10% higher (ceil) than the same encounter during day.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Observability (Constitution Gate 3), validation, and lint pass

- [x] T018 [P] Add structured logging to `backend/src/game/world/day-cycle-service.ts` — log `phase_transition` event on each automatic transition: `{ event: 'phase_transition', from_phase, to_phase, elapsed_ms }`; log `admin_phase_override` event from `forcePhase()`: `{ event: 'admin_phase_override', phase, triggered_by: 'admin' }`
- [x] T019 [P] Add structured logging to `backend/src/game/world/night-encounter-service.ts` — log `night_encounter_roll` for every roll: `{ event: 'night_encounter_roll', characterId, zoneId, roll, triggered: boolean }`; verify `encounter_resolved` log already emitted in T010
- [x] T020 [P] Validate quickstart.md test scenarios end-to-end: apply migration → start server → log in → confirm progress bar visible → `/night` → confirm overlay + blue bar + countdown → trigger encounter via movement on encounter-configured map → confirm combat modal → `/day` → confirm overlay removed, yellow bar restores
- [x] T021 Run `npm test && npm run lint` from repo root; resolve any TypeScript errors introduced by protocol additions (WorldStatePayload extension, new message types in AnyServerMessage union)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)       — no dependencies, all T001–T004 run in parallel
       ↓
Phase 2 (Foundational) — T005 needs T004 (broadcastToAll must exist first)
       ↓
Phase 3 (US1)         — T006, T007 run in parallel; T008 needs T007
Phase 4 (US2)         — T009 runs in parallel with Phase 3 (only needs T005)
Phase 5 (US3)         — T010 needs T003+T005; T011+T012 parallel after T010; T013 needs T008
Phase 6 (US4)         — T014 runs after Phase 1; T015 after T014; T016 after T015
Phase 7 (US5)         — T017 needs T005
Phase 8 (Polish)      — T018 after T005; T019 after T010; T020+T021 after all phases
```

### User Story Dependencies

- **US1 (P1)**: Needs Phase 1 + Phase 2 — no dependency on other stories
- **US2 (P2)**: Needs Phase 2 only (`forcePhase`) — no dependency on US1
- **US3 (P3)**: Needs Phase 1 (T003 for queries) + Phase 2 (T005 for `getPhase`) + US1 complete (T013 modifies same GameScene.ts)
- **US4 (P4)**: Needs Phase 1 (T003 for queries) — no dependency on other stories
- **US5 (P5)**: Needs Phase 2 (T005 for `getPhase`) — no dependency on other stories

### Within Each User Story

- Models/queries before services
- Services before movement handler modifications
- Backend complete before frontend handlers
- Each phase independently testable before proceeding

### Parallel Opportunities

```
Phase 1 (all parallel):    T001 ║ T002 ║ T003 ║ T004

Phase 3 (partial parallel): T006 ║ T007 → T008

Phase 4 (parallel with 3):  T009 (runs concurrently with Phase 3)

Phase 5 (partial parallel): T010 → T011 ║ T012 → T013

Phase 6 (sequential):       T014 → T015 → T016

Phase 8 (partial parallel): T018 ║ T019 ║ T020 → T021
```

---

## Parallel Example: Phase 1 (Setup)

```
# All four tasks are independent files — launch together:
Task A: "Add DayNightStateDto types to shared/protocol/index.ts"         → T001
Task B: "Create 015_day_night_cycle.sql migration"                        → T002
Task C: "Create encounter-tables.ts DB query module"                      → T003
Task D: "Add broadcastToAll() to zone-broadcasts.ts"                      → T004
```

## Parallel Example: Phase 5 (US3 — after T010 complete)

```
# T011 and T012 modify different files — launch together after T010:
Task A: "Modify city-movement-handler.ts for night encounter roll"         → T011
Task B: "Modify movement-handler.ts for night encounter roll"              → T012
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004 in parallel)
2. Complete Phase 2: Foundational (T005)
3. Complete Phase 3: User Story 1 (T006–T008)
4. **STOP and VALIDATE**: Progress bar visible, cycles correctly, dark overlay works
5. Demo: Day/night visual cycle fully functional

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready (cycle running server-side)
2. Phase 3 (US1) → Visual cycle demo ✅ (MVP)
3. Phase 4 (US2) → Admin control ✅
4. Phase 5 (US3) → Night encounters ✅
5. Phase 6 (US4) → Encounter table admin ✅
6. Phase 7 (US5) → Full stat bonus coverage ✅
7. Phase 8 → Observability + lint ✅

Each phase adds value without breaking previous stories.

### Suggested MVP Scope

Phases 1–3 deliver a fully observable, visually complete day/night cycle that satisfies User Story 1 (P1). All game logic (encounters, stat bonus, admin UI) can follow independently.

---

## Notes

- [P] tasks = different files, no shared dependencies within their phase
- Each user story can be independently tested at its checkpoint
- T010 includes the night stat bonus for travel encounters (1.1×) — US5 (T017) only covers the explore-combat-service
- T013 reuses the existing `CombatModal` — no new UI component needed for encounter display
- Admin command `/day`/`/night` (T009) works even before US1 frontend is complete (the broadcast will fire; clients without `DayNightBar` simply ignore `world.day_night_changed`)
- Migration T002 must be applied to the database before T003's query functions can be exercised at runtime (code can be written before migration is applied)
