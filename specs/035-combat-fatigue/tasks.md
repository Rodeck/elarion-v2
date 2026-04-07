# Tasks: Combat Fatigue System

**Input**: Design documents from `/specs/035-combat-fatigue/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database migration and query layer for fatigue configuration

- [x] T001 Create fatigue_config table with migration in `backend/src/db/migrations/039_combat_fatigue.sql` — create table with combat_type PRIMARY KEY (CHECK: 'monster','boss','pvp'), start_round INTEGER DEFAULT 0, base_damage INTEGER DEFAULT 5, damage_increment INTEGER DEFAULT 3, updated_at TIMESTAMPTZ. Insert default rows for all 3 combat types with start_round=0 (disabled). See `data-model.md` for full SQL.
- [x] T002 Create DB query functions in `backend/src/db/queries/fatigue-config.ts` — implement `getFatigueConfig(combatType: string)`, `getAllFatigueConfigs()`, and `upsertFatigueConfig(combatType, startRound, baseDamage, damageIncrement)`. Follow pattern from `backend/src/db/queries/admin-config.ts`.

---

## Phase 2: Foundational (Shared Protocol)

**Purpose**: Type definitions that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add fatigue protocol types and extend combat payloads in `shared/protocol/index.ts` — (1) Add `FatigueConfigDto` interface with `start_round`, `base_damage`, `damage_increment` fields. (2) Add `FatigueStateDto` interface with `current_round`, `fatigue_active`, `current_damage`, `immunity_rounds_left`, `effective_start_round` fields. (3) Add `'fatigue_damage'` to `CombatEventKind` union type. (4) Add optional `fatigue_config?: FatigueConfigDto` to `CombatStartPayload`, `BossCombatStartPayload`, and `ArenaCombatStartPayload`. (5) Add optional `fatigue_state?: FatigueStateDto` to `CombatTurnResultPayload`, `BossCombatTurnResultPayload`, and `ArenaCombatTurnResultPayload`. See `contracts/fatigue-protocol.md` for full type definitions.

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Fatigue Activates During Prolonged Combat (Priority: P1) MVP

**Goal**: After a configured number of rounds, both combatants take escalating true damage each round. Works across all 3 combat types (monster, boss, PvP).

**Independent Test**: Set fatigue config rows in DB directly (e.g., monster start_round=5, base_damage=3, increment=2). Start a monster combat, let 5+ rounds pass. Verify both combatants take 3, 5, 7... damage per round. Repeat for boss and PvP.

### Implementation for User Story 1

- [x] T004 [US1] Implement fatigue in monster combat in `backend/src/game/combat/combat-session.ts` — (1) Import `getFatigueConfig` from queries. (2) Add fatigue state fields to `CombatSession` class: `fatigueStartRound`, `baseDamage`, `damageIncrement`, `fatigueActive`, `fatigueTurnCount`, `onsetDelayModifier` (default 0), `immunityRoundsLeft` (default 0), `damageReduction` (default 0). (3) In `start()`, load fatigue config for combat_type `'monster'` and initialize fields; include `fatigue_config` in `combat:start` payload (if start_round > 0). (4) In `closeActiveWindow()`, after `tickActiveEffects()` and before `computeEnemyTurn()`: check if current round >= fatigueStartRound; if so, calculate damage = `baseDamage + (fatigueTurnCount) * damageIncrement`, apply to both player HP and enemy HP (bypassing defense), increment fatigueTurnCount, push `fatigue_damage` events for both targets. (5) Include `fatigue_state` in `combat:turn_result` payload. (6) Add structured log `fatigue_damage_applied` with combat_id, round, damage, player_hp, enemy_hp. (7) Handle simultaneous KO: if both HP <= 0 from fatigue, player (initiator) wins.
- [x] T005 [P] [US1] Implement fatigue in boss combat in `backend/src/game/boss/boss-combat-handler.ts` — Same pattern as T004 but for `BossCombatSession`. (1) Add fatigue state fields to session interface. (2) Load config for combat_type `'boss'` at combat start. (3) In `runEnemyTurn()`, after `tickActiveEffects()` and before boss abilities: apply fatigue damage to both player and boss. (4) Include `fatigue_config` in `boss:combat_start` and `fatigue_state` in `boss:combat_turn_result` payloads. (5) Add structured logging. (6) On simultaneous KO: player wins.
- [x] T006 [P] [US1] Implement fatigue in PvP arena combat in `backend/src/game/arena/arena-combat-handler.ts` — Same pattern but for `PvpCombatSession`. (1) Add fatigue state fields to both challenger and defender session state. (2) Load config for combat_type `'pvp'` at combat start. (3) After both players' `tickActiveEffects()` calls complete (~line 622): apply fatigue damage to both players. (4) Include `fatigue_config` in `arena:combat_start` and `fatigue_state` in `arena:combat_turn_result` payloads. (5) Add structured logging. (6) On simultaneous KO: defender wins (per spec edge case). (7) Also handle `ArenaNpcCombatSession` with same fatigue logic (uses 'pvp' config).

**Checkpoint**: Fatigue damage is now applied server-side in all combat types. Can be tested by setting DB rows directly and observing HP changes in combat.

---

## Phase 4: User Story 2 — Admin Configures Fatigue Per Combat Type (Priority: P1)

**Goal**: Admins can view and edit fatigue settings (start_round, base_damage, damage_increment) for each combat type via the admin panel.

**Independent Test**: Open admin panel, navigate to fatigue config tab, change monster combat fatigue start to round 8, save. Query the DB to verify the value persisted. Start a new monster combat and verify fatigue starts at round 8.

### Implementation for User Story 2

- [x] T007 [P] [US2] Create admin REST endpoints in `admin/backend/src/routes/fatigue-config.ts` — (1) Create Express Router. (2) `GET /` — call `getAllFatigueConfigs()`, return array of config objects. (3) `PUT /:combat_type` — validate combat_type is one of 'monster','boss','pvp'; validate start_round >= 0, base_damage >= 0, damage_increment >= 0 (all integers); call `upsertFatigueConfig()`; return updated config. (4) Add structured logging for `fatigue_config_updated` with admin username and changed values. (5) Add error handling with 400 for validation errors, 500 for DB errors.
- [x] T008 [US2] Register fatigue-config router in `admin/backend/src/index.ts` — Import `fatigueConfigRouter` from `./routes/fatigue-config` and add `app.use('/api/fatigue-config', fatigueConfigRouter)` alongside other route registrations.
- [x] T009 [P] [US2] Add fatigue config API functions in `admin/frontend/src/editor/api.ts` — Add `getFatigueConfigs(): Promise<FatigueConfigResponse[]>` and `updateFatigueConfig(combatType: string, data: { start_round: number; base_damage: number; damage_increment: number }): Promise<FatigueConfigResponse>`. Define `FatigueConfigResponse` interface. Follow existing pattern from `getAdminConfig()` / `updateAdminConfig()`.
- [x] T010 [P] [US2] Create FatigueConfigManager in `admin/frontend/src/ui/fatigue-config-manager.ts` — (1) Create class with `init(container)` and `load()` methods following `AdminConfigManager` pattern. (2) Render a form with 3 sections (Monster, Boss, PvP), each with 3 number inputs (start_round, base_damage, damage_increment). (3) Show current values on load. (4) Save button per combat type calls `updateFatigueConfig()`. (5) Status message on save success/error. (6) Label start_round=0 as "Disabled" in the UI. (7) Use existing admin CSS classes (btn, btn--primary, etc.).
- [x] T011 [US2] Add fatigue config tab in `admin/frontend/src/main.ts` — (1) Import `FatigueConfigManager`. (2) Add `let fatigueConfigManager` variable. (3) Add tab button `#tab-fatigue-config` with label "Fatigue". (4) Create panel container `fatigue-config` div. (5) Add click handler with lazy initialization pattern (init + load on first click). (6) Add visibility toggle in `setActiveTab()`. (7) Add active class toggle on tab button.

**Checkpoint**: Admin panel has a working Fatigue tab. Admins can configure fatigue for each combat type. Changes apply to new combats.

---

## Phase 5: User Story 3+4 — Fatigue Timer Visual + Debuff Display (Priority: P2)

**Goal**: Players see a segmented countdown timer before fatigue activates, a debuff icon once active, and combat log entries for fatigue damage.

**Independent Test**: Enter combat with fatigue enabled (start_round=10). Verify: (1) segmented bar appears with 10 chunks, counts down each round. (2) At round 10, bar turns red/pulses, debuff icon appears in debuff area. (3) Debuff shows current damage, updates each round. (4) Combat log shows "Fatigue deals X damage" entries.

### Implementation for User Stories 3 & 4

- [x] T012 [US3] Add fatigue timer bar to combat screen in `frontend/src/ui/CombatScreen.ts` — (1) Add `fatigueConfig` and `fatigueState` fields to CombatScreen class. (2) In `buildOverlay()`, add a fatigue timer container below the battle row (or between HP bars and combat log). Create a segmented progress bar: a flex row of small colored blocks, one per start_round. (3) Add method `updateFatigueTimer(state: FatigueStateDto)`: fill/empty segments based on current_round vs effective_start_round; when fatigue_active, change bar color to red and add CSS pulse animation. (4) Hide timer entirely when fatigue_config is absent or start_round=0. (5) In `open()` / `showBoss()`, store fatigue_config from start payload and render initial timer.
- [x] T013 [US4] Add fatigue debuff icon and combat log formatting in `frontend/src/ui/CombatScreen.ts` — (1) In `updateActiveEffects()`, when `fatigueState.fatigue_active` is true, inject a synthetic ActiveEffect entry into both player and enemy debuff lists: `{ id: 'fatigue', source: 'environment', target: 'player'|'enemy', effectType: 'debuff', value: current_damage, turnsRemaining: -1, abilityName: 'Fatigue' }`. This renders in the existing debuff UI with damage value. (2) In `formatEvent()`, add case for `'fatigue_damage'` kind: return formatted string like "🔥 Fatigue deals X true damage to [target]" with red color (#e74c3c). (3) Update `applyTurnResult()` to call `updateFatigueTimer()` with fatigue_state from payload.
- [x] T014 [US3] Wire fatigue data from WebSocket handlers to CombatScreen in `frontend/src/scenes/GameScene.ts` — (1) In `combat:start` handler, pass `payload.fatigue_config` to `combatScreen.open()`. (2) In `combat:turn_result` handler, ensure `payload.fatigue_state` flows to `combatScreen.applyTurnResult()`. (3) Same for `boss:combat_start` / `boss:combat_turn_result` and `arena:combat_start` / `arena:combat_turn_result` handlers. The CombatScreen methods already receive the full payload — just ensure the new optional fields are preserved in any payload mapping/transformation.

**Checkpoint**: Full visual feedback for fatigue — timer countdown, debuff icon, combat log entries — all working for monster, boss, and PvP combat.

---

## Phase 6: User Story 5 — Extensibility for Future Fatigue Modifiers (Priority: P3)

**Goal**: The fatigue calculation logic supports modifier hooks (onset delay, immunity, damage reduction) so future items/buffs/skills can affect fatigue without code changes to the core calculation.

**Independent Test**: Manually set modifier values on a combat session (e.g., onsetDelayModifier=3). Verify fatigue starts 3 rounds later than configured. Set immunityRoundsLeft=2, verify first 2 fatigue rounds deal 0 damage. Set damageReduction=50, verify fatigue damage is halved.

### Implementation for User Story 5

- [x] T015 [US5] Ensure modifier fields are integrated into fatigue calculation in `backend/src/game/combat/combat-session.ts`, `backend/src/game/boss/boss-combat-handler.ts`, and `backend/src/game/arena/arena-combat-handler.ts` — (1) Verify `fatigueStartRound` is computed as `config.start_round + onsetDelayModifier` (should already be set in T004-T006). (2) Before applying fatigue damage, check `immunityRoundsLeft > 0`: if so, decrement it, skip damage, push a `fatigue_damage` event with value=0 and log "immune". (3) Apply `damageReduction` percentage: `finalDamage = Math.max(0, Math.floor(rawDamage * (1 - damageReduction / 100)))`. (4) Include `immunity_rounds_left` in `FatigueStateDto` sent to frontend. (5) All modifier fields default to 0 — no active modifiers ship with this feature, but the calculation paths are exercised. (6) Add a comment block near each modifier check documenting the expected source (future items/buffs/abilities) and how to populate the field.

**Checkpoint**: Modifier hooks are in place and exercised (with default zero values). Future features can set modifier values without changing fatigue core logic.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates and final validation

- [x] T016 [P] Add `fatigue-config` query command to `scripts/game-data.js` — Add a new command that queries and displays all fatigue_config rows. Follow existing pattern from other game-data commands (e.g., `boss-instances`). Output: combat_type, start_round, base_damage, damage_increment for each row.
- [x] T017 [P] Update `.claude/commands/game-data.md` documentation to include the new `fatigue-config` command description.
- [x] T018 Validate full flow per `specs/035-combat-fatigue/quickstart.md` — Run through all test scenarios: enable fatigue for each combat type via admin panel, verify damage in combat, verify timer/debuff/log visuals, verify disabled state, verify config changes don't affect in-progress combat.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (queries used by protocol types indirectly, but Phase 2 is protocol-only so technically only needs Phase 1 complete for context)
- **US1 (Phase 3)**: Depends on Phase 1 + Phase 2 (needs DB queries + protocol types)
- **US2 (Phase 4)**: Depends on Phase 1 + Phase 2 (needs DB queries + protocol types). Independent of US1.
- **US3+4 (Phase 5)**: Depends on Phase 2 (protocol types) + Phase 3 (backend must send fatigue data)
- **US5 (Phase 6)**: Depends on Phase 3 (modifier fields added to combat handlers)
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — core mechanic, no dependency on other stories
- **US2 (P1)**: Depends on Foundational only — admin UI, independent of US1 (config rows exist from migration)
- **US3+US4 (P2)**: Depends on US1 — frontend needs fatigue data from backend WebSocket messages
- **US5 (P3)**: Depends on US1 — modifier logic is part of the fatigue calculation in combat handlers

### Within Each User Story

- Models/queries before services/handlers
- Backend before frontend (for data flow)
- Core implementation before integration/wiring

### Parallel Opportunities

- **Phase 1**: T001 and T002 are sequential (T002 depends on table existing conceptually, but can be written in parallel)
- **Phase 3**: T004, T005, T006 can ALL run in parallel (different combat handler files)
- **Phase 4**: T007, T009, T010 can run in parallel (different files). T008 and T011 are small wiring tasks after.
- **Phase 5**: T012-T013 are sequential (same file). T014 is a different file but depends on T012-T013 pattern.
- **Phase 3 + Phase 4**: Can run in PARALLEL since US1 and US2 are independent

---

## Parallel Example: User Story 1

```text
# All three combat handlers can be implemented simultaneously:
T004: Fatigue in monster combat — backend/src/game/combat/combat-session.ts
T005: Fatigue in boss combat — backend/src/game/boss/boss-combat-handler.ts  
T006: Fatigue in PvP combat — backend/src/game/arena/arena-combat-handler.ts
```

## Parallel Example: User Story 2

```text
# Backend route + frontend API + frontend UI can be built simultaneously:
T007: Admin REST endpoints — admin/backend/src/routes/fatigue-config.ts
T009: Frontend API functions — admin/frontend/src/editor/api.ts
T010: Frontend UI manager — admin/frontend/src/ui/fatigue-config-manager.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + queries)
2. Complete Phase 2: Foundational (protocol types)
3. Complete Phase 3: US1 (fatigue logic in all combat handlers)
4. **STOP and VALIDATE**: Set config rows in DB directly, test fatigue in combat
5. This delivers the core anti-stalling mechanic without admin UI or frontend visuals

### Incremental Delivery

1. Setup + Foundational → DB and types ready
2. Add US1 → Fatigue works server-side (MVP!)
3. Add US2 → Admins can configure fatigue without DB access
4. Add US3+US4 → Players see timer, debuff, and log entries
5. Add US5 → Future-proofed for fatigue modifiers
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are both P1 priority but independent — can be developed in parallel
- US3 and US4 are combined into one phase since they modify the same file (CombatScreen.ts)
- US5 is largely about ensuring modifier fields are properly checked (they should be partially implemented in US1 tasks)
- Total: 18 tasks across 7 phases
- Commit after each task or logical group
