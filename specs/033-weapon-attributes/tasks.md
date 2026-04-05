# Tasks: Weapon Attributes

**Input**: Design documents from `specs/033-weapon-attributes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and shared type definitions that all stories depend on

- [x] T001 Create migration `backend/src/db/migrations/037_weapon_attributes.sql` — ALTER `item_definitions` adding `armor_penetration SMALLINT NOT NULL DEFAULT 0 CHECK (armor_penetration >= 0 AND armor_penetration <= 100)` and `additional_attacks SMALLINT NOT NULL DEFAULT 0 CHECK (additional_attacks >= 0 AND additional_attacks <= 10)`
- [x] T002 Extend `DerivedCombatStats` interface in `backend/src/game/combat/combat-engine.ts` — add `armorPenetration: number` and `additionalAttacks: number` fields
- [x] T003 Extend `ItemDefinitionDto` in `shared/protocol/index.ts` — add `armor_penetration: number` and `additional_attacks: number` fields
- [x] T004 Extend `CharacterData` interface in `shared/protocol/index.ts` — add `armor_penetration: number`, `additional_attacks: number`, and `gear_crit_chance: number` fields

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend data layer and stat aggregation that MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Extend `ItemDefinition` interface and all SELECT queries in `backend/src/db/queries/inventory.ts` — add `armor_penetration` and `additional_attacks` columns to the interface and all SELECT column lists that read item definitions
- [x] T006 Extend `computeCombatStats()` in `backend/src/game/combat/combat-stats-service.ts` — aggregate `armor_penetration` and `additional_attacks` from equipped items (additive sum), cap `armorPenetration` at 100, return in `DerivedCombatStats` result object

**Checkpoint**: Foundation ready — stat aggregation works, user story implementation can begin

---

## Phase 3: User Story 1 — Admin Configures Weapon Attributes (Priority: P1) 🎯 MVP

**Goal**: Admins can set crit chance, armor penetration, and additional attacks on equippable items via the admin panel

**Independent Test**: Create an item in admin panel, set all three attributes, save, reload — values persist. Non-equippable items should not show the fields.

### Implementation for User Story 1

- [x] T007 [US1] Extend validation and persistence in `admin/backend/src/routes/items.ts` — add `armor_penetration` and `additional_attacks` to `validateItemFields()` (allow for equippable categories, reject for non-equippable), add to INSERT/UPDATE column lists in POST and PUT handlers, add `crit_chance` to the same flows if not already handled
- [x] T008 [US1] Extend `ItemDefinitionResponse` interface in `admin/frontend/src/editor/api.ts` — add `armor_penetration: number`, `additional_attacks: number`, and `crit_chance: number` fields
- [x] T009 [US1] Add three input fields to item modal in `admin/frontend/src/ui/item-modal.ts` — add Crit Chance (%), Armor Penetration (%), and Additional Attacks number inputs; show/hide them in `updateConditionalFields()` for equippable categories only (weapon, shield, helmet, chestplate, greaves, bracer, boots, ring, amulet); include in save handler payload
- [x] T010 [US1] Add stat pills for new attributes in `admin/frontend/src/ui/item-manager.ts` — add `crit_chance`, `armor_penetration`, and `additional_attacks` pills in `formatStats()` with distinct colors, only show when non-zero
- [x] T011 [US1] Extend admin item response mapping in `admin/backend/src/routes/items.ts` — ensure GET endpoints include `armor_penetration`, `additional_attacks`, and `crit_chance` in the response object

**Checkpoint**: Admin can create/edit items with all three weapon attributes. Values persist and display in item list.

---

## Phase 4: User Story 2 — Player Sees Weapon Attributes in Character Stats (Priority: P1)

**Goal**: Character stats panel shows aggregated crit chance, armor penetration, and additional attacks from equipped gear

**Independent Test**: Equip a weapon with armor_penetration=10, verify StatsBar expanded panel shows "Armor Pen: 10%". Equip second item with armor_penetration=5, verify total shows 15%.

### Implementation for User Story 2

- [x] T012 [US2] Extend `world.state` payload in `backend/src/websocket/handlers/world-state-handler.ts` — compute combat stats via `computeCombatStats()` and include `armor_penetration`, `additional_attacks`, and `gear_crit_chance` in the `my_character` object sent to the client
- [x] T013 [US2] Display new stats in expanded panel in `frontend/src/ui/StatsBar.ts` — add Armor Penetration (%), Additional Attacks, and gear-contributed Crit Chance to the derived stats section (alongside existing Crit %, Dodge %, Crit Dmg); show only when non-zero or always show with 0 default; use `renderDerived()` helper with appropriate colors

**Checkpoint**: Players see all three weapon attributes in their character stats panel reflecting equipped gear.

---

## Phase 5: User Story 3 — Combat Uses Weapon Attributes (Priority: P2)

**Goal**: Armor penetration reduces effective enemy defence in damage calculations. Additional attacks grant bonus hits at combat start.

**Independent Test**: Equip weapon with 100% armor pen — enemy defence should be 0 in damage calc. Equip item with 2 additional attacks — verify 2 bonus hits before first combat round.

### Implementation for User Story 3

- [x] T014 [P] [US3] Apply armor penetration in `playerAutoAttack()` in `backend/src/game/combat/combat-engine.ts` — before damage subtraction, compute `effectiveDefence = Math.floor(enemyDefence * (1 - armorPenetration / 100))` and use it instead of raw enemyDefence; apply same formula in `resolveAbilityDamage()` and `resolveDrainDamage()`
- [x] T015 [US3] Add additional attacks phase to regular combat in `backend/src/game/combat/combat-session.ts` — before the first `startTurn()` call, loop `additionalAttacks` times executing `playerAutoAttack()` with crit forced to false, sending combat log entries for each bonus hit, checking if enemy dies after each hit
- [x] T016 [US3] Add additional attacks phase to boss combat in `backend/src/game/boss/boss-combat-handler.ts` — same pattern as T015, execute bonus hits before first normal turn of boss combat
- [x] T017 [US3] Add additional attacks phase to PvP combat in `backend/src/game/arena/arena-combat-handler.ts` — execute bonus hits for both challenger and defender before first normal turn, using each player's `additionalAttacks` stat

**Checkpoint**: Combat correctly applies armor penetration to all damage and executes bonus hits at combat start.

---

## Phase 6: User Story 4 — Attribute Values in Item Tooltips (Priority: P3)

**Goal**: Item detail views in the game frontend show non-zero weapon attributes with clear labels

**Independent Test**: View a weapon with crit_chance=5, armor_penetration=10 in inventory — tooltip shows "+5% Crit Chance" and "10% Armor Pen". Item with all zeros shows no attribute lines.

### Implementation for User Story 4

- [x] T018 [US4] Display weapon attributes in item detail/tooltip in the game frontend inventory UI — when rendering item details, show non-zero values for crit_chance ("+X% Crit Chance"), armor_penetration ("X% Armor Pen"), and additional_attacks ("+X First Strikes") with appropriate styling; hide lines where value is 0

**Checkpoint**: All weapon attributes visible in item tooltips for equipped and inventory items.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates and documentation per constitution Principle VI

- [x] T019 [P] Update `scripts/game-entities.js` — add `armor_penetration` and `additional_attacks` to item creation validation and INSERT logic; update `VALID_CATEGORIES` or stat field handling as needed
- [x] T020 [P] Update `scripts/game-data.js` — include `armor_penetration` and `additional_attacks` in item query output formatting
- [x] T021 [P] Update `.claude/commands/game-entities.md` — document the two new item fields in the `create-item` command documentation
- [x] T022 [P] Update `.claude/commands/game-data.md` — document the new fields in item query output
- [x] T023 Update `CLAUDE.md` — no new checklist section needed (weapon attributes follow existing item field pattern); verify the "Adding a New Item Category" and existing checklists don't need updates for the new columns

**Checkpoint**: All tooling and documentation updated. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001–T004) — BLOCKS all user stories
- **US1 Admin (Phase 3)**: Depends on Phase 2. No dependency on other stories.
- **US2 Stats Display (Phase 4)**: Depends on Phase 2. No dependency on US1 (admin creates items, but stats display works with DB-seeded data).
- **US3 Combat (Phase 5)**: Depends on Phase 2. No dependency on US1 or US2.
- **US4 Tooltips (Phase 6)**: Depends on Phase 1 (T003 for `ItemDefinitionDto`). No dependency on other stories.
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — independent
- **US2 (P1)**: After Phase 2 — independent
- **US3 (P2)**: After Phase 2 — independent
- **US4 (P3)**: After Phase 1 — independent (only needs DTO fields)

### Within Each User Story

- Admin: backend validation → frontend types → modal fields → list pills
- Stats: backend world-state → frontend StatsBar
- Combat: engine damage calc [P] → session bonus hits → boss bonus hits → arena bonus hits
- Tooltips: single task

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different files)
- T005, T006 can run in parallel (different files)
- US1, US2, US3, US4 can all run in parallel after Phase 2
- T014 can run in parallel with T015–T017 (engine vs session handlers)
- T019, T020, T021, T022 can all run in parallel (different files)

---

## Parallel Example: Phase 1 Setup

```text
# All protocol/type changes in parallel:
Task T002: "Extend DerivedCombatStats in combat-engine.ts"
Task T003: "Extend ItemDefinitionDto in shared/protocol/index.ts"
Task T004: "Extend CharacterData in shared/protocol/index.ts"
# (T003 and T004 are same file — run sequentially, but parallel with T002)
```

## Parallel Example: User Stories After Phase 2

```text
# All four user stories can start simultaneously:
Agent A: US1 (Admin) — T007 → T008 → T009 → T010 → T011
Agent B: US2 (Stats) — T012 → T013
Agent C: US3 (Combat) — T014 ∥ T015 → T016 → T017
Agent D: US4 (Tooltips) — T018
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: Foundational (queries + stat aggregation)
3. Complete Phase 3: US1 — Admin can set attributes
4. **STOP and VALIDATE**: Create items with attributes via admin panel
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Admin) → Admin can configure weapons (MVP)
3. Add US2 (Stats) → Players see stats in game
4. Add US3 (Combat) → Attributes affect gameplay
5. Add US4 (Tooltips) → Full item information
6. Polish → Tooling and docs updated

---

## Notes

- T003 and T004 modify the same file (`shared/protocol/index.ts`) — execute sequentially or combine
- Crit chance already exists in DB and protocol; this feature wires it through admin UI and ensures display parity
- No new files created — all tasks modify existing files
- Commit after each phase completion for clean rollback points
