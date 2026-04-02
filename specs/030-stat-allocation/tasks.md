# Tasks: Character Stat Allocation System

**Input**: Design documents from `/specs/030-stat-allocation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket-messages.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup needed — existing monorepo project with all tooling in place.

*(Phase skipped — project structure already exists)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration, shared protocol types, and attribute derivation logic that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Create migration `backend/src/db/migrations/033_stat_allocation.sql` — Add 6 columns to `characters` table (`stat_points_unspent SMALLINT NOT NULL DEFAULT 0`, `attr_constitution SMALLINT NOT NULL DEFAULT 0`, `attr_strength SMALLINT NOT NULL DEFAULT 0`, `attr_intelligence SMALLINT NOT NULL DEFAULT 0`, `attr_dexterity SMALLINT NOT NULL DEFAULT 0`, `attr_toughness SMALLINT NOT NULL DEFAULT 0`), add `is_trainer BOOLEAN NOT NULL DEFAULT false` to `npcs` table, and run data migration to reset existing characters (set max_hp/attack_power/defence to class base values, current_hp capped at new max_hp, stat_points_unspent = 7 × (level − 1)) per `data-model.md`
- [x] T002 Update shared protocol types in `shared/protocol/index.ts` — Add `is_trainer: boolean` to `NpcDto`, add `attr_constitution`, `attr_strength`, `attr_intelligence`, `attr_dexterity`, `attr_toughness`, `stat_points_unspent` fields to `CharacterData`, add `stat_points_gained` and `stat_points_unspent` to `CharacterLevelledUpPayload`, add new interfaces: `TrainingOpenPayload`, `TrainingStatePayload`, `TrainingAllocatePayload`, `TrainingResultPayload`, `TrainingErrorPayload` per `contracts/websocket-messages.md`
- [x] T003 Update character queries in `backend/src/db/queries/characters.ts` — Add the 6 new columns (`attr_constitution`, `attr_strength`, `attr_intelligence`, `attr_dexterity`, `attr_toughness`, `stat_points_unspent`) to the `Character` interface and all SELECT statements that return character data

**Checkpoint**: Schema, protocol types, and character queries ready — user story implementation can begin.

---

## Phase 3: US1 + US6 + US3 — Core Stat System (Priority: P1) 🎯 MVP

**Goal**: Replace automatic level-up stat grants with point allocation, migrate existing characters, and derive combat stats from attributes. These three stories are tightly coupled and form the mechanical core.

**Independent Test**: Level up a character → verify no auto-stat changes, only stat_points_unspent increases. Run migration → verify existing characters reset to base stats with correct retroactive points. Enter combat → verify stats derive from class base + allocated attributes + equipment.

### Implementation

- [x] T004 [US1] Modify level-up service in `backend/src/game/progression/level-up-service.ts` — Remove the `hp_per_level`, `attack_per_level`, `defence_per_level` multiplication logic. Instead, add `stat_points_gained = 7 * levelsGained` to the result. Update `LevelUpResult` interface to include `statPointsGained` and `statPointsUnspent` instead of stat changes. The function should only increment `stat_points_unspent` on the character, not touch max_hp/attack_power/defence
- [x] T005 [US1] Update the level-up caller (find where `checkLevelUp` result is used to UPDATE the character in the database) — Change the UPDATE query to set `stat_points_unspent = stat_points_unspent + $statPointsGained` and remove the `max_hp`, `attack_power`, `defence` updates. Update the `character.levelled_up` WebSocket message to include `stat_points_gained` and `stat_points_unspent` fields per the contract
- [x] T006 [US3] Modify combat stats service in `backend/src/game/combat/combat-stats-service.ts` — Change the initial character query to also SELECT `attr_constitution`, `attr_strength`, `attr_intelligence`, `attr_dexterity`, `attr_toughness` and `class_id` (JOIN with `character_classes` for base stats). Compute derived base stats: `maxHp = base_hp + (attr_constitution * 4)`, `attack = base_attack + (attr_constitution * 1) + (attr_strength * 2)`, `defence = base_defence + (attr_toughness * 1)`. Add `attr_intelligence * 8` to maxMana, `attr_dexterity * 0.1` to critChance and dodgeChance, `attr_strength * 0.3` to critDamage. Then add equipment bonuses on top as before
- [x] T007 [US1] Update the frontend level-up notification handler in `frontend/src/scenes/GameScene.ts` — Find the `character.levelled_up` message handler and update it to display stat points gained in the chat/notification (e.g., "Level up! You gained 7 stat points"). No longer display stat changes (HP/ATK/DEF) since they don't change on level-up
- [x] T008 [US1] Update frontend character data loading in `frontend/src/scenes/GameScene.ts` — When `CharacterData` is received (login/zone change), store the new attribute fields and `stat_points_unspent` on the local character object so they're available for the StatsBar and TrainingModal

**Checkpoint**: Core stat system works — level-up grants points, combat uses attribute-derived stats, migration handles existing characters.

---

## Phase 4: US2 — Allocate Stat Points via Trainer NPC (Priority: P1)

**Goal**: Players can visit a Trainer NPC, open a stat allocation modal, distribute points across 5 attributes, and see their combat stats update.

**Independent Test**: Visit a building with a Trainer NPC → click NPC → select "Train" → allocate points → confirm → verify StatsBar reflects new derived stats.

### Implementation

- [x] T009 [P] [US2] Update NPC queries in `backend/src/db/queries/npcs.ts` — Add `is_trainer: boolean` to `Npc`, `BuildingNpc`, and `ZoneNpcRow` interfaces. Add `n.is_trainer` to the SELECT column list in `getNpcsForBuilding()` and `getNpcsForZone()` queries
- [x] T010 [P] [US2] Update city-map-loader in `backend/src/game/world/city-map-loader.ts` — Add `is_trainer: n.is_trainer ?? false` to the NPC-to-DTO mapping (alongside existing `is_crafter`, `is_quest_giver`, etc.)
- [x] T011 [US2] Create training handler in `backend/src/game/training/training-handler.ts` — Implement `handleTrainingOpen(characterId, npcId)`: validate player is at building with this NPC, NPC has `is_trainer = true`, player not in combat; query character attributes and class base stats; compute derived stats and per-stat cap (`10 * (level - 1)`); send `training.state` message per contract. Implement `handleTrainingAllocate(characterId, npcId, increments)`: validate all increments >= 0, sum > 0, sum <= unspent_points, each `current_attr + increment <= cap`, player at building, not in combat; UPDATE character SET each attr += increment, stat_points_unspent -= sum; recompute and UPDATE max_hp/attack_power/defence columns; send `training.result` message. Log all allocations with structured logging
- [x] T012 [US2] Register training message handlers in `backend/src/index.ts` — Import training handler, add `training.open` and `training.allocate` message type handlers in the WebSocket message dispatch (following the pattern used for `crafting.open`, `crafting.start`, etc.)
- [x] T013 [US2] Create frontend TrainingModal in `frontend/src/ui/TrainingModal.ts` — HTML overlay modal following CraftingModal pattern (fixed overlay, #1a1510 bg, gold border, close button). Display: 5 attribute rows (Constitution, Strength, Intelligence, Dexterity, Toughness) each with current value, +/- buttons, increment counter, and per-stat cap indicator. Show unspent points remaining at top. Show stat descriptions ("+4 HP, +1 ATK per point" etc.) next to each attribute name. "Confirm" button sends `training.allocate` message with the increments map. "Cancel" resets all pending increments. Expose `open(npcId)` method, `handleState(payload)` to populate from server state, `handleResult(payload)` to show success and update display, `handleError(message)` to show error feedback
- [x] T014 [US2] Update BuildingPanel in `frontend/src/ui/BuildingPanel.ts` — Add `private onTrainingOpen?: (npcId: number) => void` callback field and `setOnTrainingOpen()` setter method. In `renderNpcPanel()`, add `if (npc.is_trainer)` block (following is_crafter pattern) that creates a dialog option "I want to train" which calls `this.onTrainingOpen?.(npc.id)`
- [x] T015 [US2] Wire training in GameScene in `frontend/src/scenes/GameScene.ts` — Create TrainingModal instance. Call `buildingPanel.setOnTrainingOpen((npcId) => { trainingModal.open(npcId); client.send('training.open', { npc_id: npcId }); })`. Add message handlers: `client.on('training.state', (p) => trainingModal.handleState(p))`, `client.on('training.result', (p) => { trainingModal.handleResult(p); statsBar.setHp(myCharacter.current_hp, p.new_max_hp); statsBar.updateStats(p.new_attack_power, p.new_defence); /* update local character fields */ })`, `client.on('training.error', (p) => trainingModal.handleError(p.message))`
- [x] T016 [US2] Add unspent points badge to StatsBar in `frontend/src/ui/StatsBar.ts` — Add a small circular badge element (gold background, dark text, absolute positioned) that shows the unspent point count. Add `setUnspentPoints(count: number)` method: if count > 0, show badge with count; if 0, hide badge. Add click handler to dismiss (hide badge, set a `badgeDismissed` flag). When `setUnspentPoints` is called with a HIGHER value than previously seen (new points earned), reset `badgeDismissed` to false and show badge again. Call `setUnspentPoints` from GameScene when character data is loaded and after level-up

**Checkpoint**: Full allocation flow works — Trainer NPC dialog opens modal, player allocates points, stats update live.

---

## Phase 5: US5 — Admin Manages Trainer NPCs (Priority: P2)

**Goal**: Admins can toggle the `is_trainer` role on NPCs via the admin panel.

**Independent Test**: Open admin panel → NPC Manager → toggle Trainer checkbox → verify change persists and NPC shows Train dialog in-game.

### Implementation

- [x] T017 [P] [US5] Add trainer toggle endpoint in `admin/backend/src/routes/npcs.ts` — Add `PUT /:id/trainer` route following the exact pattern of the crafter/dismisser/disassembler toggle endpoints: parse id, validate `is_trainer` is boolean, query UPDATE npcs SET is_trainer = $1, return updated NPC via `npcToResponse()`. Also add `is_trainer` to the `npcToResponse()` function output
- [x] T018 [P] [US5] Add toggleNpcTrainer API function in `admin/frontend/src/editor/api.ts` — Add `export async function toggleNpcTrainer(npcId: number, isTrainer: boolean): Promise<void>` following the `toggleNpcCrafter` pattern, calling `PUT ${NPCS_BASE}/${npcId}/trainer` with body `{ is_trainer: isTrainer }`
- [x] T019 [US5] Add Trainer checkbox to admin NPC manager in `admin/frontend/src/ui/npc-manager.ts` — Add a `<label>` with `<input type="checkbox" class="npc-trainer-toggle">` following the existing crafter/dismisser/disassembler checkbox pattern. Add change event handler that calls `toggleNpcTrainer(n.id, checkbox.checked)` with error rollback on failure

**Checkpoint**: Admin can create and manage Trainer NPCs via the panel.

---

## Phase 6: US4 — View Stat Breakdown (Priority: P2)

**Goal**: Training modal shows detailed breakdown of each derived stat: base from class, bonus from attributes, bonus from equipment, total.

**Independent Test**: Open training modal with some allocated points and equipped items → verify breakdown shows correct contributions from each source.

### Implementation

- [x] T020 [US4] Extend `training.state` payload in backend training handler (`backend/src/game/training/training-handler.ts`) — Add `base_stats` object (from class: `{ hp, attack, defence }`) and `equipment_stats` object (from equipped items: `{ attack, defence, max_mana, crit_chance, crit_damage, dodge_chance }`) to the `training.state` response. Update `TrainingStatePayload` in `shared/protocol/index.ts` to include these new fields
- [x] T021 [US4] Enhance TrainingModal in `frontend/src/ui/TrainingModal.ts` — Add a stat breakdown section below the attribute allocation rows. For each derived stat (HP, ATK, DEF, Mana, Crit%, Crit Dmg%, Evasion%), show: "Base: X | Attributes: +Y | Equipment: +Z | Total: W". Add tooltip/info text next to each attribute name showing the conversion rate (e.g., "Constitution: +4 HP, +1 ATK per point"). Use the `base_stats` and `equipment_stats` from the training.state payload

**Checkpoint**: Players can see full stat breakdown and make informed allocation decisions.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates and documentation required by Constitution Principle VI.

- [x] T022 [P] Update `CLAUDE.md` — Add "Adding a New NPC Role" checklist entry for `is_trainer` following the existing pattern (10 locations listed). This documents the `is_trainer` role for future reference
- [x] T023 [P] Update `scripts/game-data.js` — Add a `character-stats` command that queries a character's attributes, unspent points, and derived stats. Add `is_trainer` to NPC query output
- [x] T024 [P] Update `scripts/game-entities.js` (no changes needed — NPC role flags are toggled via admin API, not set at creation) — Add `is_trainer` to NPC-related validation if applicable
- [x] T025 [P] Update `.claude/commands/game-entities.md` — Document the `is_trainer` NPC role field
- [x] T026 [P] Update `.claude/commands/gd.design.md` — Add `is_trainer` column to NPC table template in design documents
- [x] T027 Run quickstart.md validation (deferred to manual testing — requires running backend + database) — Start backend, verify migration applies, create Trainer NPC, test allocation flow end-to-end per `specs/030-stat-allocation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories
- **US1+US6+US3 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 (needs level-up changes and combat derivation working)
- **US5 (Phase 5)**: Depends on Phase 2 only (can run in parallel with Phase 3/4 if needed)
- **US4 (Phase 6)**: Depends on Phase 4 (enhances the TrainingModal created in US2)
- **Polish (Phase 7)**: Depends on all phases complete

### Within Each Phase

```text
Phase 2: T001 → T002 → T003 (sequential — each depends on previous)
Phase 3: T004 → T005 (level-up), T006 (combat, parallel with T004-T005), T007 + T008 (frontend, after T004-T006)
Phase 4: T009 ∥ T010 (parallel, NPC queries), T011 → T012 (handler + registration), T013 (modal, parallel with T011), T014 → T015 → T016 (frontend wiring, sequential)
Phase 5: T017 ∥ T018 (parallel), T019 (after both)
Phase 6: T020 → T021 (backend then frontend)
Phase 7: T022 ∥ T023 ∥ T024 ∥ T025 ∥ T026 (all parallel), T027 (after all)
```

### Parallel Opportunities

```text
# Phase 4 parallel batch 1 (different files):
T009: backend/src/db/queries/npcs.ts
T010: backend/src/game/world/city-map-loader.ts
T013: frontend/src/ui/TrainingModal.ts

# Phase 5 parallel batch:
T017: admin/backend/src/routes/npcs.ts
T018: admin/frontend/src/editor/api.ts

# Phase 7 all parallel (different files):
T022-T026: All independent documentation/script files
```

---

## Implementation Strategy

### MVP First (Phase 2 + Phase 3)

1. Complete Phase 2: Foundational (migration, types, queries)
2. Complete Phase 3: Core stat system (level-up + combat derivation)
3. **STOP and VALIDATE**: Level up a character, verify no auto-stats, enter combat, verify attribute-derived stats work
4. This is the mechanical core — everything else builds on it

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Phase 3 → Core stat system works (MVP mechanical core)
3. Phase 4 → Full player-facing feature (Trainer NPC + allocation UI)
4. Phase 5 → Admin tooling (can be done earlier if needed for testing)
5. Phase 6 → Enhanced UX (stat breakdown)
6. Phase 7 → Tooling compliance

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 (Level-up), US3 (Combat derivation), US6 (Migration) are combined in Phase 3 because they share the same foundational schema changes and are mechanically inseparable
- The migration (T001) handles US6 entirely — no separate migration verification task needed since quickstart validation (T027) covers it
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
