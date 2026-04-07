# Tasks: Energy & Movement Speed System

**Input**: Design documents from `/specs/038-energy-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/energy-protocol.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and shared type definitions that all stories depend on

- [x] T001 Create migration `backend/src/db/migrations/042_energy_system.sql` — ALTER characters ADD COLUMN max_energy SMALLINT NOT NULL DEFAULT 1000, current_energy SMALLINT NOT NULL DEFAULT 1000, movement_speed SMALLINT NOT NULL DEFAULT 100 with CHECK constraints (current_energy >= 0, current_energy <= max_energy, movement_speed > 0)
- [x] T002 Update `shared/protocol/index.ts` — add `max_energy`, `current_energy`, `movement_speed` to `CharacterData` interface; add `EnergyChangedPayload`, `InventoryUseItemPayload`, `InventoryUseResultPayload`, `InventoryUseRejectedPayload` interfaces; add `energy_per_second` to `GatherBuildingActionDto.config`
- [x] T003 Update `backend/src/db/queries/characters.ts` — add `max_energy`, `current_energy`, `movement_speed` to `Character` interface; add `current_energy | max_energy | movement_speed` to `updateCharacter` allowlist Pick type

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add 4 new keys to `CONFIG_DEFAULTS` in `backend/src/db/queries/admin-config.ts` — `energy_regen_per_tick: '50'`, `energy_tick_interval_seconds: '300'`, `hp_regen_percent: '10'`, `hp_tick_interval_seconds: '600'`
- [x] T005 Update `backend/src/game/world/city-map-loader.ts` — include `energy_per_second` (from config JSON, default 0) in the GatherBuildingActionDto mapping for gather actions

**Checkpoint**: Foundation ready — migration applied, shared types defined, character queries updated, admin config keys present

---

## Phase 3: User Story 1 — Energy Depletes When Performing Actions (Priority: P1) 🎯 MVP

**Goal**: All gameplay actions deduct energy. At 0 energy, actions are blocked with feedback. Death halves energy.

**Independent Test**: Perform actions (travel, arena, fish, explore, boss) and observe energy decreasing. At 0 energy, verify actions are refused. Die in combat and verify energy halved.

### Implementation for User Story 1

- [x] T006 [P] [US1] Add energy gate to explore action in `backend/src/game/world/building-action-handler.ts` — before `resolveExplore()`, check `character.current_energy >= 10`, if insufficient send `building_action.rejected` with reason `insufficient_energy`, otherwise deduct 10 energy via `updateCharacter`, send `character.energy_changed`
- [x] T007 [P] [US1] Add energy gate to arena entry in `backend/src/game/arena/arena-handler.ts` — before `insertParticipant()`, check `character.current_energy >= 20`, if insufficient send `arena:enter_rejected` with reason `insufficient_energy`, otherwise deduct 20 energy, send `character.energy_changed`
- [x] T008 [P] [US1] Add energy gate to boss challenge in `backend/src/game/boss/boss-combat-handler.ts` — before combat starts (~line 123), check `character.current_energy >= 20`, if insufficient send `boss:challenge_rejected` with reason `insufficient_energy`, otherwise deduct 20 energy, send `character.energy_changed`
- [x] T009 [P] [US1] Add energy gate to fishing cast in `backend/src/game/fishing/fishing-handler.ts` — before `startSession()`, check `character.current_energy >= 10`, if insufficient send `fishing:rejected` with reason `insufficient_energy`, otherwise deduct 10 energy, send `character.energy_changed`
- [x] T010 [P] [US1] Add energy gate to gathering start in `backend/src/game/gathering/gathering-handler.ts` — before `GatheringSessionManager.start()`, check `character.current_energy > 0`, if 0 send `gathering:rejected` with reason `insufficient_energy`
- [x] T011 [US1] Add per-step energy deduction to city movement in `backend/src/game/world/city-movement-handler.ts` — in the step loop setTimeout callback, deduct 2 energy per step via DB update, send `character.energy_changed` to session; if energy reaches 0 mid-path do NOT cancel movement (speed penalty handled in US4)
- [x] T012 [P] [US1] Add energy halving on death in monster combat in `backend/src/game/combat/combat-session.ts` — in `endCombat()` when outcome is loss and playerHp is 0, add `current_energy = FLOOR(current_energy / 2)` to the UPDATE query, send `character.energy_changed`
- [x] T013 [P] [US1] Add energy halving on death in boss combat in `backend/src/game/boss/boss-combat-handler.ts` — in `endCombat()` when outcome is loss, add `current_energy = FLOOR(current_energy / 2)` to the UPDATE query, send `character.energy_changed`
- [x] T014 [P] [US1] Add energy halving on gathering death in `backend/src/game/gathering/gathering-service.ts` — in `endSession()` when reason is `'death'`, add `current_energy = FLOOR(current_energy / 2)` to DB update, send `character.energy_changed`
- [x] T015 [US1] Handle `character.energy_changed` message in `frontend/src/scenes/GameScene.ts` — register `this.client.on<EnergyChangedPayload>('character.energy_changed', ...)` that calls `this.statsBar.setEnergy(current_energy, max_energy)` (setEnergy method created in US5, but handler can be wired now)

**Checkpoint**: All actions deduct energy, 0-energy blocks actions, death halves energy. Energy display handled in US5.

---

## Phase 4: User Story 2 — Energy Regenerates Over Time (Priority: P1)

**Goal**: Server-wide energy regen tick restores energy to all characters on a configurable interval.

**Independent Test**: Drain energy below max, wait for tick, verify energy increases but does not exceed cap.

### Implementation for User Story 2

- [x] T016 [US2] Create `backend/src/game/regen/energy-regen-service.ts` — mirror hp-regen-service pattern: `tickEnergyRegen()` runs bulk UPDATE `SET current_energy = LEAST(max_energy, current_energy + $regenAmount)::smallint WHERE current_energy < max_energy`, read `energy_regen_per_tick` from admin config (default 50), send `character.energy_changed` to online sessions, structured logging
- [x] T017 [US2] Create dynamic interval management in `energy-regen-service.ts` — `startEnergyRegenService()` reads `energy_tick_interval_seconds` from admin config (default 300), uses setInterval; on each tick re-read interval and reschedule if changed
- [x] T018 [US2] Register energy regen service in `backend/src/index.ts` — import and call `startEnergyRegenService()` alongside existing `startHpRegenService()` call (~line 87)

**Checkpoint**: Energy regenerates on schedule. Combined with US1, the core energy loop is complete.

---

## Phase 5: User Story 3 — Food Restores Energy (Priority: P2)

**Goal**: Players consume food items to restore energy and heal items to restore HP via a new inventory use handler.

**Independent Test**: Use a food item with energy below max — verify energy increases and stack decreases. Use a heal item — verify HP increases.

### Implementation for User Story 3

- [x] T019 [US3] Create `backend/src/game/inventory/inventory-use-handler.ts` — handle `inventory.use_item` message: validate item exists in character's inventory, check category is `food` or `heal`; for food: check energy < max_energy (reject with `energy_full` if at cap), restore `min(food_power, max_energy - current_energy)` energy, decrement quantity (delete row if 0), send `inventory.use_result` + `character.energy_changed`; for heal: check hp < max_hp (reject with `hp_full` if at cap), restore `min(heal_power, max_hp - current_hp)` HP, decrement quantity, send `inventory.use_result` + `character.hp_changed`; reject if in_combat
- [x] T020 [US3] Register `inventory.use_item` handler in `backend/src/index.ts` — import `handleInventoryUseItem` and call `registerHandler('inventory.use_item', handleInventoryUseItem)`
- [x] T021 [US3] Handle `inventory.use_result` and `inventory.use_rejected` in `frontend/src/scenes/GameScene.ts` — on `inventory.use_result`: update inventory display (quantity change), show feedback; on `inventory.use_rejected`: show error message from payload
- [x] T022 [US3] Add "Use" button to consumable items in `frontend/src/ui/InventoryPanel.ts` — for items with category `food` or `heal`, show a "Use" button in the item detail view that sends `inventory.use_item` message with the `inventory_item_id`

**Checkpoint**: Food and heal items are consumable. Energy economy has both drain (US1) and active restore (US3) + passive regen (US2).

---

## Phase 6: User Story 4 — Movement Speed Affects City Travel Time (Priority: P2)

**Goal**: City node-to-node travel speed scales with movement_speed stat. At 0 energy, speed is halved.

**Independent Test**: Travel between city nodes normally, then drain energy to 0 and travel again — observe visibly slower movement.

### Implementation for User Story 4

- [x] T023 [US4] Modify step delay calculation in `backend/src/game/world/city-movement-handler.ts` — replace hardcoded `STEP_DELAY_MS = 300` with dynamic calculation: fetch character's `movement_speed` and `current_energy`, compute `effectiveSpeed = current_energy > 0 ? movementSpeed : Math.floor(movementSpeed * 0.5)`, compute `stepDelay = Math.round(300 * (100 / effectiveSpeed))`; apply per-step (energy may change mid-path due to deduction in T011, so re-check energy each step)

**Checkpoint**: Movement speed is dynamic. Energy depletion visibly slows city travel.

---

## Phase 7: User Story 5 — Energy & Movement Speed in Character Panel (Priority: P2)

**Goal**: Collapsed panel shows energy bar. Expanded panel shows energy bar + movement speed.

**Independent Test**: Log in, verify energy bar visible in collapsed panel. Expand panel, verify energy bar and movement speed stat displayed with correct values.

### Implementation for User Story 5

- [x] T024 [US5] Add energy bar to collapsed StatsBar in `frontend/src/ui/StatsBar.ts` — add a new bar element below the HP bar using the same `renderBar` pattern, blue/cyan color scheme, showing `current_energy / max_energy`; add `setEnergy(current: number, max: number)` method that updates the bar fill and text; call `setEnergy` from `setCharacterData()`
- [x] T025 [US5] Add energy bar and movement speed to expanded StatsBar in `frontend/src/ui/StatsBar.ts` — in `renderExpandedContent()`: add energy bar (same `renderBar` pattern as HP) below the HP bar; add "Move Speed" to the Derived Stats grid using `renderDerived`; show effective speed (halved if energy = 0) with visual indicator of penalty
- [x] T026 [US5] Wire `character.energy_changed` to StatsBar update in `frontend/src/scenes/GameScene.ts` — ensure the handler registered in T015 calls `this.statsBar.setEnergy()` and triggers re-render of expanded panel if open

**Checkpoint**: Players can see their energy and movement speed at all times.

---

## Phase 8: User Story 6 — Admin Config for Energy/HP Regen (Priority: P3)

**Goal**: Admin panel config tab has fields for energy regen rate, energy tick interval, HP regen percent, HP tick interval.

**Independent Test**: Open admin config tab, change energy regen rate, save, verify next tick uses new value.

### Implementation for User Story 6

- [x] T027 [US6] Add energy/HP regen config fields to `admin/frontend/src/ui/admin-config-manager.ts` — add 4 input fields in `render()`: "Energy per tick" (number), "Energy tick interval (seconds)" (number), "HP regen percent" (number), "HP tick interval (seconds)" (number); load values in `load()` from existing `getAllConfig()` response; save values in `handleSave()` via `updateAdminConfig()`
- [x] T028 [US6] Make HP regen service configurable in `backend/src/game/regen/hp-regen-service.ts` — modify `tickRegen()` to read `hp_regen_percent` from admin config (default 10) instead of hardcoded 0.10; modify `startHpRegenService()` to read `hp_tick_interval_seconds` from admin config (default 600) and use dynamic interval (re-read on each tick, reschedule if changed)

**Checkpoint**: Admin can tune both energy and HP regen without server restart.

---

## Phase 9: User Story 7 — Gathering Energy Cost Per Second (Priority: P3)

**Goal**: Gathering drains energy per second at a configurable rate. Session ends when energy depleted.

**Independent Test**: Set energy_per_second on a gather action via admin, start gathering with limited energy, verify session ends when energy runs out with partial rewards.

### Implementation for User Story 7

- [x] T029 [US7] Add per-tick energy deduction to gathering in `backend/src/game/gathering/gathering-service.ts` — in the `tick()` method, read `energy_per_second` from the session's gather config (default 0), deduct `energy_per_second * 2` (since tick interval is 2s) from character's `current_energy` via DB update, send `character.energy_changed`; if energy reaches 0, call `endSession(characterId, 'energy_depleted')` which grants pending resources (same as `'completed'` path)
- [x] T030 [US7] Pass `energy_per_second` from gather config into gathering session in `backend/src/game/gathering/gathering-handler.ts` — when creating the session, include `energy_per_second` from the building action's config object so `gathering-service.ts` has access to it
- [x] T031 [P] [US7] Add `energy_per_second` field to gather action config in admin backend `admin/backend/src/routes/buildings.ts` — in the gather config validation (~line 322), accept `energy_per_second` (default 0, non-negative integer), include in the `gatherConfig` object; update PUT handler similarly
- [x] T032 [P] [US7] Add `energy_per_second` input field for gather actions in admin frontend `admin/frontend/src/ui/properties.ts` — in the gather action fields section, add a number input for "Energy per second" (default 0); include in the save handler's config object

**Checkpoint**: Gathering energy drain is fully configurable and functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Protocol contract verification, CLAUDE.md updates, edge case review

- [x] T033 Verify `specs/038-energy-system/contracts/energy-protocol.md` matches all implemented message types — cross-reference every new/modified WS message in the codebase against the contract document, update if any discrepancies
- [x] T034 Update `CLAUDE.md` — add energy system notes to relevant checklists if needed (e.g., if energy introduces a pattern that future features must follow)
- [x] T035 Run full verification using `specs/038-energy-system/quickstart.md` validation steps — test all 9 verification scenarios end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core energy depletion
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **US4 (Phase 6)**: Depends on US1 T011 (city movement energy deduction must exist for speed penalty to matter)
- **US5 (Phase 7)**: Depends on Phase 2 (needs CharacterData fields) — can run in parallel with US1-US4
- **US6 (Phase 8)**: Depends on US2 (energy regen service must exist to make configurable)
- **US7 (Phase 9)**: Depends on US1 T010 (gathering energy gate must exist)
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no story dependencies
- **US2 (P1)**: Can start after Phase 2 — no story dependencies
- **US3 (P2)**: Can start after Phase 2 — no story dependencies
- **US4 (P2)**: Depends on US1 (energy deduction in city movement)
- **US5 (P2)**: Can start after Phase 2 — no story dependencies
- **US6 (P3)**: Depends on US2 (regen service exists)
- **US7 (P3)**: Depends on US1 (gathering energy gate exists)

### Within Each User Story

- Tasks marked [P] can run in parallel
- Non-[P] tasks must run sequentially in listed order
- Backend tasks before frontend tasks (server-authoritative)

### Parallel Opportunities

- After Phase 2: US1, US2, US3, US5 can all start in parallel
- Within US1: T006–T010, T012–T014 are all [P] (different files)
- Within US7: T031 and T032 are [P] (admin backend vs admin frontend)

---

## Parallel Example: User Story 1

```
# Launch all energy gates in parallel (different handler files):
T006: Explore energy gate in building-action-handler.ts
T007: Arena energy gate in arena-handler.ts
T008: Boss energy gate in boss-combat-handler.ts
T009: Fishing energy gate in fishing-handler.ts
T010: Gathering energy gate in gathering-handler.ts

# Launch all death penalty tasks in parallel (different combat files):
T012: Monster combat death in combat-session.ts
T013: Boss combat death in boss-combat-handler.ts
T014: Gathering death in gathering-service.ts

# Then sequentially:
T011: City movement energy deduction (depends on pattern established by gates)
T015: Frontend energy_changed handler (depends on backend sending messages)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: Foundational (config keys + loader)
3. Complete Phase 3: US1 — Energy depletion on all actions
4. Complete Phase 4: US2 — Energy regen tick
5. **STOP and VALIDATE**: Energy drains and regenerates. Core loop works.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 → Core energy loop (MVP!)
3. US5 → Energy bar visible in UI (players can see energy)
4. US3 → Food consumption (active energy recovery)
5. US4 → Movement speed scaling (gameplay feel)
6. US6 → Admin configurability (balance tuning)
7. US7 → Gathering per-second cost (depth mechanic)
8. Polish → Contract verification + end-to-end validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after Phase 2
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Energy values are always integers (SMALLINT) — use Math.floor for divisions
