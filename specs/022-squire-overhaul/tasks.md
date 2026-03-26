# Tasks: Squire System Overhaul

**Input**: Design documents from `/specs/022-squire-overhaul/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/websocket-messages.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Database migration, shared types, and asset directory

- [x] T001 Write migration `023_squire_overhaul.sql` in `backend/src/db/migrations/023_squire_overhaul.sql` — create `squire_definitions` table, rename `squires` → `character_squires` with `squire_def_id` + `level` columns, insert default "Legacy Squire" definition, migrate existing rows, create `monster_squire_loot` table, alter `characters` (add `squire_slots_unlocked`), alter `npcs` (add `is_squire_dismisser`), alter `quest_rewards` CHECK constraint to include `'squire'`, update `squire_expeditions` FK
- [x] T002 Add shared protocol types and constants in `shared/protocol/index.ts` — add `SQUIRE_RANKS` array (20 ranks), `MAX_SQUIRE_SLOTS`, `DEFAULT_UNLOCKED_SLOTS`, `MAX_SQUIRE_LEVEL`, `MAX_POWER_LEVEL` constants, `getSquireRank()` helper, `SquireDefinitionDto`, `CharacterSquireDto`, `SquireRosterDto`, `SquireDroppedDto` interfaces, extend `RewardType` to include `'squire'`, extend `GatheringTickEvent` with squire fields, extend `CombatEndPayload` with `squires_dropped`, add `SquireAcquiredPayload`, `SquireAcquisitionFailedPayload`, `SquireDismissListPayload`, `SquireDismissConfirmPayload`, `SquireDismissListResultPayload`, `SquireDismissedPayload`, `SquireDismissRejectedPayload`, update `ExpeditionDispatchPayload` with `squire_id`, update `ExpeditionStateDto` with `available_squires` and `active_squire`
- [x] T003 Create squire icons asset directory at `backend/assets/squires/icons/` (empty directory with .gitkeep)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core DB queries and grant service that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create squire definitions DB queries in `backend/src/db/queries/squire-definitions.ts` — implement `createSquireDefinition()`, `getSquireDefinitionById()`, `getAllSquireDefinitions()`, `updateSquireDefinition()`, `deactivateSquireDefinition()`, `getActiveSquireDefinitions()`, `hasPlayersOwningDefinition()` with proper TypeScript interfaces
- [x] T005 [P] Rewrite squire DB queries in `backend/src/db/queries/squires.ts` — update `Squire` interface to match `character_squires` schema (add `squire_def_id`, `level`), update all queries to use `character_squires` table with JOINs to `squire_definitions`, add `getSquireCount(characterId)`, `canAcquireSquire(characterId)` (checks `squire_slots_unlocked` vs count), `deleteSquire(squireId)`, `getIdleSquiresForCharacter(characterId)` (not on active expedition), `getCharacterSquireById(squireId)`, update `getSquiresForCharacter()` to include definition fields
- [x] T006 [P] Create monster squire loot DB queries in `backend/src/db/queries/monster-squire-loot.ts` — implement `getSquireLootByMonsterId()`, `addSquireLootEntry()`, `updateSquireLootEntry()`, `deleteSquireLootEntry()` with `MonsterSquireLootEntry` interface including squire definition name + icon_filename via JOIN
- [x] T007 Create squire grant service in `backend/src/game/squire/squire-grant-service.ts` — implement `grantSquireToCharacter(session, characterId, squireDefId, level)` that checks slot availability via `canAcquireSquire()`, inserts into `character_squires`, builds `CharacterSquireDto`, sends `squire.acquired` or `squire.acquisition_failed` message, includes structured logging
- [x] T008 Add message validation schemas for all new squire message types in `backend/src/websocket/validator.ts`
- [x] T009 Register new squire message handlers (`squire.roster`, `squire.dismiss_list`, `squire.dismiss_confirm`) in `backend/src/index.ts`

**Checkpoint**: Foundation ready — squire definitions CRUD, player squire queries, and grant service operational

---

## Phase 3: User Story 1 — Obtain and Manage Squires (Priority: P1) 🎯 MVP

**Goal**: Players can acquire squires from combat loot, quest rewards, and gathering, view them in a roster UI, and existing squires are migrated

**Independent Test**: Kill a monster configured with squire loot → squire appears in roster panel

### Implementation for User Story 1

- [x] T010 [US1] Update combat session to roll squire drops in `backend/src/game/combat/combat-session.ts` — after item loot loop, fetch `getSquireLootByMonsterId()`, roll each entry against `drop_chance`, call `grantSquireToCharacter()` on success, add `squires_dropped` to `CombatEndPayload`, track quest objectives via `QuestTracker` if applicable
- [x] T011 [US1] Update quest reward granting to handle `reward_type === 'squire'` in `backend/src/game/quest/quest-service.ts` — in `grantQuestRewards()`, add `case 'squire'` that calls `grantSquireToCharacter(session, characterId, reward.target_id, reward.quantity)` where target_id = squire_def_id and quantity = level; update `resolveRewardTarget()` to resolve squire definition name + icon; update `hasInventorySpaceForRewards()` in `backend/src/game/quest/quest-handler.ts` to also check squire slot availability for squire rewards
- [x] T012 [US1] Update gathering service to handle `type: 'squire'` events in `backend/src/game/gathering/gathering-service.ts` — extend `GatherEventConfig` type union with `'squire'`, add `squire_def_id` and `squire_level` optional fields, on `'squire'` event call `grantSquireToCharacter()`, emit `GatheringTickEvent` with squire_name/icon/rank fields, update `GatheringSummary` if needed
- [x] T013 [US1] Implement squire roster handler in `backend/src/game/squire/squire-grant-service.ts` — add `handleSquireRoster(session)` that fetches all character squires via `getSquiresForCharacter()`, checks active expeditions to set status (`idle` vs `on_expedition`), builds `SquireRosterDto` with `slots_unlocked` from character row, sends `squire.roster_update`
- [x] T014 [US1] Update world-state handler to send squire roster on connect in `backend/src/websocket/handlers/world-state-handler.ts` — replace legacy squire backfill logic with roster send, remove random squire name assignment for existing characters
- [x] T015 [US1] Update character creation to remove legacy squire assignment in `backend/src/game/world/character-create-handler.ts` — remove `createSquire(characterId, randomName)` call, new characters start with empty roster and 2 unlocked slots
- [x] T016 [US1] Create squire roster panel UI in `frontend/src/ui/SquireRosterPanel.ts` — new HTML component showing 5 slots (filled with squire card: name, icon, rank, power level, status badge; empty-unlocked as dashed border; locked as grey/padlock), attach to GameScene, update on `squire.roster_update` messages
- [x] T017 [US1] Update GameScene to handle squire messages in `frontend/src/scenes/GameScene.ts` — register handlers for `squire.roster_update`, `squire.acquired`, `squire.acquisition_failed`; show system chat messages for acquisition/failure; update roster panel on roster changes; display squire drops in combat end overlay alongside items
- [x] T018 [US1] Update frontend combat end UI to display squire drops in `frontend/src/scenes/GameScene.ts` or relevant combat UI — show `SquireDroppedDto` entries with name, rank, icon alongside existing item drops
- [x] T019 [US1] Update frontend gathering UI to display squire acquisition events — handle `GatheringTickEvent` with `type: 'squire'`, show squire name and rank in gathering log

**Checkpoint**: Players can obtain squires from 3 sources (combat, quests, gathering), view roster, and legacy data is migrated

---

## Phase 4: User Story 2 — Send Squire on Expedition (Priority: P1)

**Goal**: Player chooses which idle squire to send on expedition; power level scales rewards up to 2x

**Independent Test**: Send two squires with different power levels on same expedition, verify reward estimates differ proportionally

### Implementation for User Story 2

- [x] T020 [US2] Update expedition service power bonus in `backend/src/game/expedition/expedition-service.ts` — modify `computeRewardSnapshot()` to accept optional `powerLevel: number` parameter, apply multiplier `1 + (powerLevel / 100)` after duration multiplier; update `buildExpeditionStateDto()` to accept array of idle squires and build `available_squires` list with `CharacterSquireDto`, include power-adjusted duration options per squire
- [x] T021 [US2] Update expedition handler for squire selection in `backend/src/game/expedition/expedition-handler.ts` — read `squire_id` from `ExpeditionDispatchPayload`, validate squire belongs to character via `getCharacterSquireById()`, validate squire is idle (no active expedition), fetch squire's power_level from definition, pass to `computeRewardSnapshot()`, add `SQUIRE_NOT_IDLE` and `SQUIRE_NOT_FOUND` rejection reasons
- [x] T022 [US2] Update city-movement handler to include squire list in `backend/src/game/world/city-movement-handler.ts` — in `getExpeditionStateForBuilding()`, fetch all idle squires for character instead of just `squires[0]`, pass to `buildExpeditionStateDto()`
- [x] T023 [US2] Update BuildingPanel expedition UI in `frontend/src/ui/BuildingPanel.ts` — replace single squire name display with squire picker dropdown/list showing idle squires (name, rank, power level, icon); when squire selected, show power-adjusted reward estimates for each duration; include `squire_id` in dispatch payload; handle new rejection reasons (`SQUIRE_NOT_IDLE`, `SQUIRE_NOT_FOUND`)
- [x] T024 [US2] Update GameScene expedition message handlers in `frontend/src/scenes/GameScene.ts` — update `expedition.dispatched` handler to use squire data from new DTO format; update expedition state caching to work with multi-squire model

**Checkpoint**: Expedition UI shows squire picker, power bonus scales rewards, dispatch validates squire ownership

---

## Phase 5: User Story 3 — Admin Creates and Manages Squire Definitions (Priority: P1)

**Goal**: Admin can CRUD squire definitions with icon upload in admin panel

**Independent Test**: Create squire definition in admin panel → appears in list → edit power level → verify change persists

### Implementation for User Story 3

- [x] T025 [P] [US3] Create admin backend routes for squire definitions in `admin/backend/src/routes/squire-definitions.ts` — implement `GET /api/squire-definitions` (list all), `GET /api/squire-definitions/:id` (single), `POST /api/squire-definitions` (create with name + power_level), `PUT /api/squire-definitions/:id` (update), `PUT /api/squire-definitions/:id/deactivate` (soft-delete with ownership check), `POST /api/squire-definitions/:id/icon` (multer upload to `backend/assets/squires/icons/`), register routes in admin Express app
- [x] T026 [P] [US3] Serve squire icons as static files — add `express.static` for `backend/assets/squires/icons/` mounted at `/squire-icons/` in admin backend (follow existing pattern for item-icons, npc-icons, monster-icons)
- [x] T027 [US3] Create squire definitions manager UI in admin frontend — add squire definitions section to admin panel (list view with name, icon, power_level, active status; create/edit form with name input, power_level slider 0–100, icon upload; deactivate button with ownership warning; follow existing NpcManager/ItemManager pattern in `admin/frontend/src/ui/`)

**Checkpoint**: Admin can create, edit, deactivate squire definitions with icons

---

## Phase 6: User Story 4 — Squire Rank Display (Priority: P2)

**Goal**: All squire levels display as named ranks (Peasant → Sovereign) instead of numbers

**Independent Test**: Obtain squires at different levels, verify rank names display correctly everywhere

### Implementation for User Story 4

- [x] T028 [US4] Ensure rank resolution is used everywhere in backend — verify `CharacterSquireDto` includes `rank` field resolved via `getSquireRank(level)` in all DTO builders: `squire-grant-service.ts`, `squire roster handler`, `expedition-service.ts`, combat end payload builder; no numeric levels should appear in any server→client message

- [x] T029 [US4] Ensure rank display is used everywhere in frontend — verify `SquireRosterPanel.ts`, `BuildingPanel.ts` expedition picker, combat end squire drops, gathering squire events all display `rank` string from DTO instead of numeric `level`; add rank display to any remaining UI locations

**Checkpoint**: Numeric levels never visible to players; all UI shows named ranks

---

## Phase 7: User Story 5 — Dismiss Squire via NPC (Priority: P2)

**Goal**: Player can dismiss idle squires at a designated NPC, freeing roster slots

**Independent Test**: Fill squire slots → visit dismisser NPC → dismiss one → verify slot freed → acquire new squire

### Implementation for User Story 5

- [x] T030 [US5] Create squire dismiss handler in `backend/src/game/squire/squire-dismiss-handler.ts` — implement `handleSquireDismissList(session, payload)`: validate character is at building with NPC matching `npc_id`, validate NPC `is_squire_dismisser`, fetch idle squires, send `squire.dismiss_list_result`; implement `handleSquireDismissConfirm(session, payload)`: validate squire_id belongs to character, validate squire is idle (not on expedition), delete from `character_squires`, send `squire.dismissed` with updated roster, add structured logging for dismissal events
- [x] T031 [US5] Update NPC display to show dismissal option in frontend — when player is at a building with an NPC where `is_squire_dismisser === true`, add "I want to dismiss a squire" button/option to the NPC interaction area in `frontend/src/ui/BuildingPanel.ts`; on click, send `squire.dismiss_list` message
- [x] T032 [US5] Create dismissal UI flow in frontend — handle `squire.dismiss_list_result`: show modal/panel with list of idle squires (name, rank, icon); on squire selection, show confirmation dialog "Are you sure you want to dismiss [name]? This is permanent."; on confirm send `squire.dismiss_confirm`; handle `squire.dismissed` (close dialog, show success message, update roster panel); handle `squire.dismiss_rejected` (show error message with reason)

**Checkpoint**: Squire dismissal works end-to-end through NPC dialog

---

## Phase 8: User Story 6 — Squire Slot System (Priority: P3)

**Goal**: 5 total slots visible, 2 unlocked initially, locked slots shown visually

**Independent Test**: New character sees 2 unlocked + 3 locked slots in roster

### Implementation for User Story 6

- [x] T033 [US6] Ensure slot system enforced end-to-end — verify `canAcquireSquire()` in `squires.ts` compares `count(character_squires) < squire_slots_unlocked`; verify `SquireRosterDto` includes correct `slots_unlocked` and `slots_total` from character row + constant; verify new character creation sets `squire_slots_unlocked = 2`
- [x] T034 [US6] Update SquireRosterPanel to visualize locked slots in `frontend/src/ui/SquireRosterPanel.ts` — render all 5 slots: filled slots with squire cards, empty unlocked slots with dashed border and "Empty" label, locked slots with grey background and padlock icon/text; slot state derived from `slots_unlocked` and squire count in `SquireRosterDto`

**Checkpoint**: Slot system visible and enforced; locked slots clearly communicated

---

## Phase 9: User Story 7 — Agent Commands for Squire Content Creation (Priority: P2)

**Goal**: Agent can create squire definitions, upload icons, configure drops/rewards via game-entities commands

**Independent Test**: Run `create-squire` command → definition appears in admin panel; run `create-monster-squire-loot` → monster drops squire in game

### Implementation for User Story 7

- [x] T035 [US7] Add `create-squire` command to `scripts/game-entities.js` — add `validateSquireDefinition(data)` (name required string, power_level 0–100 integer), add command handler that POSTs to `/api/squire-definitions`, add to VALID commands list
- [x] T036 [P] [US7] Add `upload-squire-icon` command to `scripts/game-entities.js` — add validator (squire_def_id required integer, file_path required string pointing to existing PNG), add command handler using `apiPostMultipart()` to `/api/squire-definitions/:id/icon`, follow existing `upload-npc-icon` pattern
- [x] T037 [P] [US7] Add `create-monster-squire-loot` command to `scripts/game-entities.js` — add `validateMonsterSquireLoot(data)` (monster_id required, squire_def_id required, drop_chance 1–100, squire_level 1–20), add command handler that POSTs to `/api/monsters/:id/squire-loot`
- [x] T038 [US7] Extend `create-quest` command validation in `scripts/game-entities.js` — update quest reward validation to accept `reward_type: 'squire'` with `target_id` as squire_def_id and `quantity` as level (1–20)
- [x] T039 [US7] Extend `create-building-action` gather event validation in `scripts/game-entities.js` — add `'squire'` to `VALID_GATHER_EVENT_TYPES`, validate `squire_def_id` (required integer) and `squire_level` (1–20) when type is `'squire'`
- [x] T040 [US7] Add monster squire loot endpoint to admin backend in `admin/backend/src/routes/monsters.ts` — add `POST /api/monsters/:id/squire-loot` and `DELETE /api/monsters/:id/squire-loot/:lootId` endpoints with validation
- [x] T041 [P] [US7] Update NPC admin route for dismisser flag in `admin/backend/src/routes/npcs.ts` — add `PUT /api/npcs/:id/squire-dismisser` endpoint (accepts `{ is_squire_dismisser: boolean }`)
- [x] T042 [P] [US7] Update quest admin route for squire rewards in `admin/backend/src/routes/quests.ts` — update reward validation to accept `reward_type: 'squire'` with `target_id` referencing `squire_definitions.id` and `quantity` as level 1–20
- [x] T043 [P] [US7] Update building action admin route for squire gather events in `admin/backend/src/routes/buildings.ts` — update gather event validation to accept `type: 'squire'` with `squire_def_id` and `squire_level` fields
- [x] T044 [US7] Update game-entities skill documentation in `.claude/commands/game-entities.md` — document `create-squire`, `upload-squire-icon`, `create-monster-squire-loot` commands with examples; document squire reward type for `create-quest`; document squire gather event type for `create-building-action`
- [x] T045 [US7] Add `set-npc-dismisser` command to `scripts/game-entities.js` — add validator (npc_id required, is_squire_dismisser boolean), add command handler that PUTs to `/api/npcs/:id/squire-dismisser`, follow `set-npc-crafter` pattern

**Checkpoint**: Agent can create full squire content pipeline via commands

---

## Phase 10: Admin Frontend Extensions

**Purpose**: Admin panel UI for configuring squire loot, quest rewards, and gathering events

- [x] T046 Add monster squire loot section to admin monster editor — add squire loot list and add/remove UI to monster detail view in `admin/frontend/src/ui/` (follow existing monster loot pattern for items; show squire definition picker, drop_chance input, squire_level input)
- [x] T047 [P] Add squire reward option to quest reward editor in `admin/frontend/src/ui/quest-manager.ts` — add `'squire'` to reward type dropdown; when selected, show squire definition picker and level input (1–20) instead of item picker
- [x] T048 [P] Add squire event type to gather event editor in `admin/frontend/src/ui/properties.ts` — add `'squire'` to event type dropdown; when selected, show squire definition picker and squire_level input; hide item/gold/monster fields
- [x] T049 [P] Add NPC dismisser toggle to admin NPC editor — add "Is Squire Dismisser" checkbox to NPC edit form (follow existing `is_crafter` toggle pattern)

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T050 Run `npm test && npm run lint` across all packages and fix any TypeScript errors or lint violations introduced by this feature
- [x] T051 Verify legacy squire migration end-to-end — confirm existing characters retain their squire as a level 1 "Legacy Squire" definition instance after migration; verify expedition history is preserved
- [x] T052 Verify structured logging covers all squire operations — confirm log entries for: squire acquired, acquisition failed (roster full), squire dismissed, expedition dispatched with squire selection, all rejection paths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration + shared types)
- **User Stories (Phase 3–9)**: All depend on Phase 2 completion
  - US1 (obtain squires) can start after Phase 2
  - US2 (expedition) can start after Phase 2, benefits from US1 for testing
  - US3 (admin definitions) can start after Phase 2, independent of US1/US2
  - US4 (rank display) depends on US1 (UI exists to verify ranks)
  - US5 (dismissal) depends on US1 (need squires to dismiss)
  - US6 (slot system) depends on US1 (roster UI exists)
  - US7 (agent commands) depends on US3 (admin routes exist)
- **Admin Frontend (Phase 10)**: Depends on US3 + US7 (admin routes exist)
- **Polish (Phase 11)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no user story dependencies
- **US2 (P1)**: Can start after Phase 2 — benefits from US1 for end-to-end testing but backend is independent
- **US3 (P1)**: Can start after Phase 2 — fully independent (admin panel only)
- **US4 (P2)**: Depends on US1 (needs roster UI to verify rank display)
- **US5 (P2)**: Depends on US1 (needs squires in roster to dismiss)
- **US6 (P3)**: Depends on US1 (needs roster UI to show locked slots)
- **US7 (P2)**: Depends on US3 admin routes (needs REST endpoints to call)

### Within Each User Story

- DB queries before services
- Services before handlers
- Backend before frontend
- Core implementation before integration

### Parallel Opportunities

- T004, T005, T006 can all run in parallel (different query files)
- US1, US2, US3 can start in parallel after Phase 2 (different subsystems)
- T025, T026 can run in parallel (different admin files)
- T035, T036, T037 can run in parallel (different commands, same file but additive)
- T041, T042, T043 can run in parallel (different admin route files)
- T047, T048, T049 can run in parallel (different admin frontend files)

---

## Parallel Example: Phase 2 (Foundational)

```
# Launch all DB query files in parallel:
T004: squire-definitions.ts (new file)
T005: squires.ts (rewrite existing)
T006: monster-squire-loot.ts (new file)

# Then sequentially:
T007: squire-grant-service.ts (depends on T004, T005)
T008: validator.ts (depends on T002 shared types)
T009: index.ts handler registration (depends on handlers existing)
```

## Parallel Example: User Stories after Phase 2

```
# Three P1 stories can proceed in parallel:
US1 (T010–T019): Backend combat/quest/gathering + frontend roster
US2 (T020–T024): Backend expedition + frontend picker
US3 (T025–T027): Admin backend routes + admin frontend UI
```

---

## Implementation Strategy

### MVP First (US1 + US3 minimum)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: Foundational (queries + grant service)
3. Complete Phase 5: US3 (admin definitions — needed to create test data)
4. Complete Phase 3: US1 (obtain and manage squires)
5. **STOP and VALIDATE**: Create squire definition in admin → kill monster → squire in roster

### Incremental Delivery

1. Setup + Foundational → Core infrastructure ready
2. US3 (admin) → Can create squire definitions
3. US1 (obtain squires) → Players can acquire squires — **MVP!**
4. US2 (expeditions) → Squire picker + power bonus
5. US7 (agent commands) → Automated content creation
6. US4 (ranks) + US5 (dismissal) + US6 (slots) → Polish
7. Admin frontend extensions → Complete admin tooling

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (obtain squires) → US4 (ranks) → US5 (dismissal)
   - Developer B: US3 (admin definitions) → US7 (agent commands) → Admin frontend
   - Developer C: US2 (expeditions) → US6 (slot system)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Migration (T001) is the most critical task — get it right first
- Shared types (T002) enable all downstream work
- Grant service (T007) is the central dependency — used by combat, quests, gathering
- All backend squire mutations are WebSocket-based (constitution compliant)
- Admin CRUD is REST-based (appropriate per constitution — non-game-state)
