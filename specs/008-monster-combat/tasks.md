# Tasks: Monster Combat System

**Input**: Design documents from `/specs/008-monster-combat/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/websocket.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

---

## Phase 1: Setup

**Purpose**: Create directory structure required by the new feature before any code is written.

- [X] T001 Create directory `backend/assets/monsters/icons/` with a `.gitkeep` file (mirrors `backend/assets/items/icons/` pattern)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, protocol, and server-side infrastructure that ALL user stories depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: Complete this phase before any US1/US2/US3 work.

- [X] T002 Write `backend/src/db/migrations/011_monster_combat.sql`: DROP TABLE `combat_participants`, `combat_simulations`, `monsters` (old); CREATE TABLE `monsters` (id SERIAL PK, name VARCHAR(64) NOT NULL, icon_filename VARCHAR(256), attack SMALLINT NOT NULL DEFAULT 1 CHECK ≥0, defense SMALLINT NOT NULL DEFAULT 0 CHECK ≥0, hp SMALLINT NOT NULL DEFAULT 10 CHECK ≥1, xp_reward SMALLINT NOT NULL DEFAULT 0 CHECK ≥0, created_at TIMESTAMPTZ DEFAULT now()); CREATE TABLE `monster_loot` (id SERIAL PK, monster_id INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE, item_def_id INTEGER NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE, drop_chance SMALLINT NOT NULL CHECK 1–100, quantity SMALLINT NOT NULL DEFAULT 1 CHECK ≥1); ALTER TABLE `building_actions` DROP CONSTRAINT building_actions_action_type_check, ADD CONSTRAINT building_actions_action_type_check CHECK (action_type IN ('travel','explore'))
- [X] T003 [P] Rewrite `backend/src/db/queries/monsters.ts` for new schema: export async functions `getAllMonsters()` (SELECT * ORDER BY name), `getMonsterById(id: number)` (SELECT * WHERE id=$1), `createMonster(data: {name, icon_filename?, attack, defense, hp, xp_reward})` (INSERT RETURNING *), `updateMonster(id: number, data: Partial<CreateMonster>)` (UPDATE SET ... WHERE id=$1 RETURNING *), `deleteMonster(id: number)` (DELETE WHERE id=$1); use typed row interface matching new schema
- [X] T004 [P] Create `backend/src/db/queries/monster-loot.ts`: export async functions `getLootByMonsterId(monsterId: number)` (SELECT ml.*, id.name AS item_name, id.icon_filename AS item_icon_filename FROM monster_loot ml JOIN item_definitions id ON ml.item_def_id=id.id WHERE ml.monster_id=$1), `addLootEntry(data: {monster_id, item_def_id, drop_chance, quantity})` (INSERT RETURNING *), `updateLootEntry(id: number, data: {drop_chance?, quantity?})` (UPDATE RETURNING *), `deleteLootEntry(id: number)` (DELETE WHERE id=$1)
- [X] T005 Delete old monster system files: remove `backend/src/game/world/monster-registry.ts`, remove `backend/src/game/world/monster-spawner.ts`, remove `frontend/src/entities/MonsterSprite.ts`; search entire codebase for import statements referencing these files and remove the imports (TypeScript build must remain clean after deletion)
- [X] T006 Update `shared/protocol/index.ts`: (1) REMOVE interfaces: `MonsterInstance`, `ItemGained`, `CombatStartPayload`, `CombatStartedPayload`, `CombatRoundPayload`, `CombatEndedPayload`, `MonsterSpawnedPayload`, `MonsterDespawnedPayload`; REMOVE type alias `CombatStartMessage`; REMOVE field `monsters: MonsterInstance[]` from `WorldStatePayload`; (2) MODIFY: change `CityBuildingActionPayload.action_type` from `'travel'` to `'travel' | 'explore'`; change `BuildingActionDto` from a plain interface to a discriminated union: `type BuildingActionDto = TravelBuildingActionDto | ExploreBuildingActionDto`; extend `CityBuildingActionRejectedPayload.reason` union to add `'EXPLORE_FAILED'`; (3) ADD new interfaces: `ExploreActionDto { encounter_chance: number }`, `TravelBuildingActionDto { id: number; action_type: 'travel'; label: string; config: TravelActionDto }`, `ExploreBuildingActionDto { id: number; action_type: 'explore'; label: string; config: ExploreActionDto }`, `CombatRoundRecord { round: number; player_attack: number; monster_attack: number; player_hp_after: number; monster_hp_after: number }`, `ItemDroppedDto { item_def_id: number; name: string; quantity: number; icon_url: string | null }`, `BuildingExploreResultPayload { action_id: number; outcome: 'no_encounter' | 'combat'; monster?: { id: number; name: string; icon_url: string | null; max_hp: number; attack: number; defense: number }; rounds?: CombatRoundRecord[]; combat_result?: 'win' | 'loss'; xp_gained?: number; items_dropped?: ItemDroppedDto[] }`
- [X] T007 Update `backend/src/index.ts`: remove the monster-spawner initialisation call (e.g. `spawnMonsters()` or similar import/invocation of `monster-spawner.ts`); remove `registerHandler('combat.start', handleCombatStart)` and the corresponding import of the combat-start handler; remove any handler registrations for old messages (`combat.round`, `combat.ended`, etc.) if they exist as registered handlers; confirm the file still compiles cleanly
- [X] T008 [P] Create `admin/backend/src/routes/monsters.ts`: Express router with `requireAdmin` middleware; implement all 9 endpoints: GET `/` (list with icon_url = `${config.adminBaseUrl}/monster-icons/${row.icon_filename}` or null), GET `/:id` (monster + loot from getLootByMonsterId joined with item icon_urls), POST `/` (multer single file `icon` max 2 MB, store UUID-named file in `backend/assets/monsters/icons/`, call createMonster), PUT `/:id` (optional new icon, delete old icon file if replaced, call updateMonster), DELETE `/:id` (deleteMonster, delete icon file from disk), GET `/:id/loot`, POST `/:id/loot` (body: item_def_id, drop_chance 1–100, quantity ≥1; validate item_def_id exists via getItemDefinitionById), PUT `/:id/loot/:lootId`, DELETE `/:id/loot/:lootId`; return 404 for missing resources, 400 for validation errors
- [X] T009 [P] Update `admin/backend/src/routes/buildings.ts`: in the POST and PUT action endpoints, extend allowed `action_type` values to include `'explore'`; add validation branch for explore config: require `encounter_chance` as integer 0–100; if `encounter_chance > 0`, require non-empty `monsters` array; each entry must have `monster_id` (positive integer, must exist in `monsters` table — query DB to verify) and `weight` (positive integer); reject with 400 and descriptive message on failure; also update the label generation for explore actions (return `label: 'Explore'` in the action DTO when `action_type === 'explore'`)
- [X] T010 Update `admin/backend/src/index.ts`: mount the new monsters router at `/api/monsters` with `requireAdmin`; serve `backend/assets/monsters/icons/` as static files at `/monster-icons`; ensure the static middleware is set up before route handlers (same pattern as `/item-icons`)

**Checkpoint**: Foundation complete — run `npm run build` to verify zero TypeScript errors; run migration 011 against local DB to verify schema changes apply cleanly

---

## Phase 3: User Story 1 — Encounter and Fight a Monster (Priority: P1) 🎯 MVP

**Goal**: Player clicks Explore in a building, sees a combat modal stream the fight round-by-round, then receives rewards on win or a defeat message on loss.

**Independent Test**: Seed one monster and one building with explore action (100% encounter chance) directly via admin REST API; log in as a player, navigate to the building, click Explore — verify the combat modal appears, streams rounds, shows win/loss result, and that inventory + XP update correctly on victory.

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `backend/src/game/combat/explore-combat-service.ts`: export `async function resolveExplore(session: AuthenticatedSession, character: CharacterRow, actionConfig: { encounter_chance: number; monsters: Array<{ monster_id: number; weight: number }> }): Promise<BuildingExploreResultPayload>`; implementation: (1) roll encounter — `Math.random() * 100 < encounter_chance`; if false return `{ action_id: ..., outcome: 'no_encounter' }`; (2) select monster by weighted random (sum weights, pick random 0–sum, walk list); (3) fetch monster row via `getMonsterById`, fetch loot via `getLootByMonsterId`; (4) run combat loop: player starts at `character.max_hp`, monster at `monster.hp`; each round: `playerDmg = Math.max(1, character.attack_power - monster.defense)`, subtract from monsterHp; if monsterHp ≤ 0 push final round and break; `monsterDmg = Math.max(1, monster.attack - character.defence)`, subtract from playerHp; push round record `{ round, player_attack, monster_attack, player_hp_after, monster_hp_after }`; repeat until either side ≤ 0; (5) on win: roll each loot entry independently (`Math.random() * 100 < entry.drop_chance`); call `grantItemToCharacter(session, characterId, entry.item_def_id, entry.quantity)` for each passing entry (collect ItemDroppedDto list); UPDATE characters SET experience = experience + monster.xp_reward WHERE id = characterId; check for level-up using existing level-up logic and emit `character.levelled_up` if triggered; (6) return `BuildingExploreResultPayload` with all fields populated; emit structured log events: `explore_encounter_roll`, `explore_monster_selected`, `explore_combat_outcome`
- [X] T012 [US1] Extend `backend/src/game/world/building-action-handler.ts`: after the existing gate checks (character present, city map, not in combat, at building, valid action) add a new dispatch branch for `action.action_type === 'explore'`; extract `action.config` as `ExploreActionConfig`; call `await resolveExplore(session, character, action.config)`; send `building.explore_result` with the returned payload via `sendToSession`; add structured log: `log('info', 'building-action', 'explore_triggered', { characterId, building_id, action_id, outcome: result.outcome })`; the existing travel branch remains unchanged (depends on T011)
- [X] T013 [P] [US1] Create `frontend/src/ui/CombatModal.ts`: pure HTML overlay component; constructor accepts the `#game` HTMLElement parent; `show(payload: BuildingExploreResultPayload, onClose: () => void): void` method — builds full-screen modal with: monster icon `<img>` (src = `payload.monster.icon_url ?? ''`, hidden if null, show placeholder icon), monster name + max HP; a `#combat-log` scrollable div; a close button (initially hidden); `hide(): void` / `destroy(): void`; streaming logic: after modal is shown, iterate `payload.rounds` using a `setTimeout` chain with 800 ms between each round — for each round append a log line showing damage dealt by each side and remaining HP; after all rounds are revealed, append a result line ("Victory!" in gold or "Defeated." in red); if win, list XP gained and each item dropped; unhide the close button; close button calls `onClose()` then destroys the modal; the panel must not block the rest of the page UI events while streaming (use setTimeout, not blocking loops)
- [X] T014 [US1] Update `frontend/src/ui/BuildingPanel.ts`: import `BuildingExploreResultPayload` from protocol; import `CombatModal`; when rendering action buttons, detect `action.action_type === 'explore'` (discriminated union — handle the ExploreBuildingActionDto branch) and render an "Explore" button; on Explore button click: disable the button, send `city.building_action` with `{ building_id, action_id, action_type: 'explore' }` via the existing send callback; add public method `showExploreResult(payload: BuildingExploreResultPayload): void` — if `payload.outcome === 'no_encounter'` show a brief inline text below the building description ("You explored but found nothing.") and re-enable the Explore button; if `payload.outcome === 'combat'` create and open a `CombatModal`, on close re-enable the Explore button; update `showRejection` to handle the new `'EXPLORE_FAILED'` reason (depends on T013)
- [X] T015 [US1] Update `frontend/src/scenes/GameScene.ts`: (1) REMOVE: handlers for `combat.started`, `combat.round`, `combat.ended`, `monster.spawned`, `monster.despawned`; remove any code that reads `worldState.monsters` or creates monster sprites; remove the click-to-attack interaction that sent `combat.start`; (2) ADD: register a handler for `'building.explore_result'` that calls `this.buildingPanel.showExploreResult(payload as BuildingExploreResultPayload)`; ensure the import of `BuildingExploreResultPayload` from `@elarion/protocol`; run `npm run build` to confirm zero TypeScript errors (depends on T014)

**Checkpoint**: US1 complete — follow quickstart.md steps 3–6 (seed monster + building via REST, test explore flow in game client) to validate independently

---

## Phase 4: User Story 2 — Admin Creates and Configures a Monster (Priority: P2)

**Goal**: Admin can create, edit, and delete monsters with stats and icon through the admin panel UI, and manage per-monster loot tables.

**Independent Test**: Open admin panel → Monsters tab → create a monster with all fields including icon and one loot entry → verify it appears in the list with correct data → edit the monster's XP reward → verify update persists → delete the monster → verify it disappears.

### Implementation for User Story 2

- [X] T016 [P] [US2] Update `admin/frontend/src/editor/api.ts`: add TypeScript interfaces `MonsterSummary`, `MonsterDetail`, `LootEntry` matching the admin API response shapes (see contracts/websocket.md); add async functions: `getMonsters(): Promise<MonsterSummary[]>` (GET /api/monsters), `getMonster(id: number): Promise<MonsterDetail>` (GET /api/monsters/:id), `createMonster(data: FormData): Promise<MonsterDetail>` (POST /api/monsters, multipart), `updateMonster(id: number, data: FormData): Promise<MonsterDetail>` (PUT /api/monsters/:id, multipart), `deleteMonster(id: number): Promise<void>` (DELETE /api/monsters/:id), `addLootEntry(monsterId: number, data: { item_def_id: number; drop_chance: number; quantity: number }): Promise<LootEntry>` (POST /api/monsters/:id/loot), `updateLootEntry(monsterId: number, lootId: number, data: { drop_chance?: number; quantity?: number }): Promise<LootEntry>` (PUT /api/monsters/:id/loot/:lootId), `deleteLootEntry(monsterId: number, lootId: number): Promise<void>` (DELETE /api/monsters/:id/loot/:lootId)
- [X] T017 [P] [US2] Create `admin/frontend/src/ui/monster-manager.ts`: class `MonsterManager` following the `ItemManager` pattern; `init(container: HTMLElement): void` and `load(): Promise<void>` public methods; private state: `monsters: MonsterSummary[]`, `editingId: number | null`; `render()` builds: heading "Monsters", a "New Monster" button, a monster list `<div id="monster-list">`, and a form area `<div id="monster-form">`; `renderList()` renders each monster as a row showing name, attack/defense/HP/XP, icon thumbnail, Edit + Delete buttons; Edit button calls `renderForm(monster)` (pre-fills form fields and loads loot section); Delete button calls `deleteMonster(id)` then reloads list; `renderForm(monster?)` renders: text input name (required), number inputs for attack, defense, hp, xp_reward (all required, min values per schema), file input for icon (required on create, optional on edit), Save and Cancel buttons; on submit build `FormData` and call `createMonster` or `updateMonster`; `renderLootSection(monsterId: number)` renders below the form: heading "Loot Table", list of existing loot entries (each showing item name, drop_chance%, quantity, Delete button), and an "Add Loot" inline form with: item dropdown (populated from `getItems()` call), drop_chance number input 1–100, quantity number input ≥1, Add button; delete loot button calls `deleteLootEntry` then re-renders loot section
- [X] T018 [US2] Update `admin/frontend/src/main.ts`: add a "Monsters" `<button>` to the `admin-tab-bar` after the "Items" button; add `monsterManagerPanel` div (hidden when not active); add `monsterManager` variable; extend `setActiveTab()` to handle `'monsters'` case (show/hide correct panels, toggle btn--active); add click listener for `#tab-monsters` that calls `setActiveTab('monsters')` and lazy-inits `MonsterManager` (same pattern as items tab); adjust `showMapList()` signature to accept `'monsters'` as valid `activeTab` value; confirm existing tabs still work (depends on T017)

**Checkpoint**: US2 complete — open admin panel Monsters tab, create/edit/delete monsters with loot entries, confirm data persists via page refresh

---

## Phase 5: User Story 3 — Admin Configures Building Exploration (Priority: P3)

**Goal**: Admin can add an Explore action to any building in the map editor, setting the encounter chance and which monsters can appear with their relative weights.

**Independent Test**: Open map editor → select a building → in the Properties panel, add an Explore action with encounter_chance=50 and two monsters with different weights → save → open the building's actions list → verify the explore action config is persisted correctly.

### Implementation for User Story 3

- [X] T019 [US3] Update `admin/frontend/src/ui/properties.ts`: import `getMonsters` from `../editor/api`; in the building action creation/editing form (wherever action_type is chosen), add `'Explore'` as a selectable option alongside `'Travel'`; when Explore is selected, hide the travel-specific fields and show: (a) a number input `encounter_chance` labelled "Encounter Chance (%)" with range 0–100; (b) a monster table section labelled "Monster Table" with a list of rows — each row has a monster `<select>` (populated from `await getMonsters()` on render, showing monster names), a number input `weight` (min 1), and a Delete Row button; an "Add Monster Row" button appends a new empty row; (c) validation on submit: encounter_chance must be 0–100; if encounter_chance > 0, at least one monster row must exist with weight > 0; on submit, build the config JSONB `{ encounter_chance, monsters: [{monster_id, weight}, ...] }` and POST/PUT to the buildings actions endpoint with `action_type: 'explore'`; on success, re-render the actions list for the building (depends on T016 for getMonsters)

**Checkpoint**: US3 complete — configure explore action on a building, then run the game and verify the Explore button appears in the BuildingPanel

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories.

- [X] T020 [P] Verify `npm run build` and `npm run lint` pass with zero errors across all packages (frontend, backend, shared, admin/backend, admin/frontend)
- [ ] T021 Run the full smoke test from quickstart.md steps 1–7: run migration, start all services, create monster in admin, configure explore on a building with 100% encounter rate, log in as player, navigate to building, click Explore, verify combat modal streams correctly, verify win gives XP + item, verify 0% encounter shows "nothing found"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**; T003 and T004 can start after T002; T008 and T009 can start after T003/T004; T010 depends on T008
- **User Story 1 (Phase 3)**: Depends on all of Phase 2 — especially T006 (protocol) and T007 (backend index)
- **User Story 2 (Phase 4)**: Depends on all of Phase 2 — especially T008/T010 (admin REST API)
- **User Story 3 (Phase 5)**: Depends on Phase 4 (T016) and Phase 2 (T009/T010)
- **Polish (Phase 6)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete; T011 and T013 can proceed in parallel; T012 depends on T011; T014 depends on T013; T015 depends on T014
- **US2 (P2)**: Requires Phase 2 complete; T016 and T017 can proceed in parallel; T018 depends on T017
- **US3 (P3)**: Requires Phase 2 and T016 complete (for getMonsters in api.ts)

### Within Each User Story

- US1: T011 ∥ T013 → T012 → T014 → T015
- US2: T016 ∥ T017 → T018
- US3: T019 (sequential, depends on T016)

### Parallel Opportunities

- **Phase 2**: T003 ∥ T004 (different query files); T008 ∥ T009 (different route files); T010 after T008
- **Phase 3**: T011 ∥ T013 (backend service vs frontend modal — different codebases)
- **Phase 4**: T016 ∥ T017 (api.ts functions vs MonsterManager class — different files)
- **US1 and US2**: After Phase 2, US1 backend work (T011, T012) and US2 admin frontend work (T016, T017) can proceed in parallel by different developers

---

## Parallel Example: US1

```text
# These two tasks can start simultaneously after Phase 2 completes:

Task A (backend): T011 — Create explore-combat-service.ts
Task B (frontend): T013 — Create CombatModal.ts

# After both complete:
Task C: T012 — Extend building-action-handler.ts (depends on T011)
Task D: T014 — Update BuildingPanel.ts (depends on T013)

# After T014:
Task E: T015 — Update GameScene.ts
```

## Parallel Example: US2

```text
# These two tasks can start simultaneously after Phase 2 completes:

Task A: T016 — Update api.ts with monster functions
Task B: T017 — Create MonsterManager class

# After T017 (T016 must also be complete):
Task C: T018 — Add Monsters tab to main.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T010) — **CRITICAL**
3. Complete Phase 3: US1 (T011–T015)
4. **STOP and VALIDATE**: Seed test data via admin REST API directly, test the game combat flow
5. Demo the core gameplay loop

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready (migration applied, protocol updated, old code removed)
2. Phase 3 → US1 complete → Core gameplay testable (MVP!)
3. Phase 4 → US2 complete → Admin can manage monsters via UI
4. Phase 5 → US3 complete → Admin can configure building exploration via UI
5. Phase 6 → Full system validated

---

## Notes

- **[P] tasks** = different files with no blocking dependencies — safe to execute concurrently
- **[Story] label** maps each task to a specific user story for traceability (US1/US2/US3)
- T005 (delete old files) is in Phase 2 because TypeScript will fail to compile until those files are removed and their imports cleaned up — this unblocks all subsequent TS-dependent tasks
- T006 (protocol update) is the most impactful single task — it changes the shared contract used by frontend, backend, and admin frontend simultaneously; do this early and resolve any TS errors before proceeding
- After T002, run the migration against your local DB before starting T003/T004 to verify the SQL is correct
- Commit after each completed phase (or logical group) to preserve restore points
- The monster-icons directory (T001) must exist on disk before T008 (admin backend) can write icon files
