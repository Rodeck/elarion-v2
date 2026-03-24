# Tasks: Quest System

**Input**: Design documents from `/specs/021-quest-system/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested — test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database schema and shared protocol types — foundational for all stories

- [x] T001 Write migration `backend/src/db/migrations/022_quest_system.sql` — create tables quest_definitions, quest_objectives, quest_prerequisites, quest_rewards, quest_npc_givers, character_quests, character_quest_objectives; ALTER npcs ADD is_quest_giver BOOLEAN; add all indexes and constraints per data-model.md
- [x] T002 Add quest-related types, enums, and DTOs to `shared/protocol/index.ts` — QuestType, QuestStatus, ObjectiveType, PrereqType, RewardType, QuestDefinitionDto, QuestObjectiveDto, QuestRewardDto, QuestPrerequisiteDto, CharacterQuestDto, all client→server and server→client message payload interfaces, QuestRejectionReason type, and WsMessage type aliases per contracts/websocket-messages.md

---

## Phase 2: Foundational (Backend Core)

**Purpose**: DB query layer, quest service, handler, and tracker skeleton — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `backend/src/db/queries/quests.ts` — implement all query functions: getQuestById, getQuestsForNpc, getActiveQuestsForCharacter, getCharacterQuestById, getCharacterQuestProgress, createCharacterQuest, updateObjectiveProgress, completeCharacterQuest, abandonCharacterQuest, hasCompletedQuest, getActiveQuestCount, getCharacterQuestsWithObjectiveType, getCurrentResetKey; also admin queries: getAllQuests (with type/npc/active filters), createQuestDefinition, updateQuestDefinition, deleteQuestDefinition, upsertQuestObjectives, upsertQuestPrerequisites, upsertQuestRewards, upsertQuestNpcGivers
- [x] T004 Create `backend/src/game/quest/quest-service.ts` — implement DTO builder functions: buildQuestDefinitionDto (resolve target names/icons from monster/item/npc/zone tables), buildCharacterQuestDto (include objective progress), checkPrerequisites (returns {met, unmet[]}), generateResetKey (date/week/month string), grantQuestRewards (orchestrate item/xp/crown granting via existing inventory-grant-service, xp-service, crown-service)
- [x] T005 Create `backend/src/game/quest/quest-handler.ts` — implement registerQuestHandlers function and 5 WS message handlers: handleQuestListAvailable (query available/active/completable quests for NPC, check prerequisites, build DTOs), handleQuestAccept (validate prereqs + quest log limit + period key, create character_quest + objective rows), handleQuestComplete (validate all objectives complete + inventory space, grant rewards, mark completed), handleQuestAbandon (mark abandoned), handleQuestLog (return all active quests with progress); include structured logging and quest.rejected responses for all validation failures
- [x] T006 Create `backend/src/game/quest/quest-tracker.ts` — implement QuestTracker singleton with methods: onMonsterKilled(charId, monsterId), onItemCrafted(charId, itemDefId, qty), onGatheringCompleted(charId, buildingId), onInventoryChanged(charId), onLevelUp(charId, newLevel), onCrownsSpent(charId, amount), onLocationVisited(charId, zoneId, buildingId?), onNpcTalkedTo(charId, npcId); each method queries active quests with matching objective type, updates progress in DB, returns QuestProgressPayload[] for caller to send; collect_item type rechecks actual inventory count
- [x] T007 Register quest handlers in `backend/src/index.ts` — import registerQuestHandlers from quest-handler.ts, call it alongside existing registerCraftingHandlers()
- [x] T008 Add payload validation schemas for quest message types in `backend/src/websocket/validator.ts` — quest.list_available, quest.accept, quest.complete, quest.abandon, quest.log

**Checkpoint**: Backend quest core ready — quest definitions can be created via DB, players can accept/complete quests via WS messages

---

## Phase 3: User Story 1 - Admin Creates a Quest via Admin UI (Priority: P1) 🎯 MVP

**Goal**: Game designers can create, edit, and delete quests with objectives, prerequisites, rewards, and NPC assignments through the admin panel.

**Independent Test**: Log into admin panel, create a quest with 2 objectives + 1 prerequisite + 2 rewards + 1 NPC, save, reload, verify all data persists. Edit the quest, verify changes. Delete it, verify removal.

### Implementation for User Story 1

- [x] T009 [US1] Create `admin/backend/src/routes/quests.ts` — implement Express router with endpoints: GET /api/quests (list all with filters ?type=&npc_id=&active=), GET /api/quests/:id (single quest with all relations), POST /api/quests (create with objectives[], prerequisites[], rewards[], npc_ids[] in JSON body), PUT /api/quests/:id (full update — replace objectives/prereqs/rewards/npcs), DELETE /api/quests/:id (delete with cascade); use DB queries from T003; validate required fields (name, description, quest_type, at least one objective); auto-set npcs.is_quest_giver when assigning NPCs
- [x] T010 [US1] Mount quests router in `admin/backend/src/index.ts` — import questsRouter, add app.use('/api/quests', questsRouter) alongside existing routes
- [x] T011 [US1] Add quest API client functions to `admin/frontend/src/editor/api.ts` — getQuests(filters?), getQuestById(id), createQuest(data), updateQuest(id, data), deleteQuest(id); also add getQuestCatalog() (for US7); follow existing request() pattern with auth headers
- [x] T012 [US1] Create `admin/frontend/src/ui/quest-manager.ts` — implement QuestManager class following RecipeManager pattern (init/load/render/attachListeners); two-column layout: left=form, right=filterable list; form sections: (1) Basic Info (name, description textarea, quest_type dropdown, chain_id text, chain_step number, is_active toggle), (2) Prerequisites Builder (dynamic rows with type dropdown → type-specific fields: min_level→number, has_item→item dropdown+qty, completed_quest→quest dropdown, class_required→class dropdown; add/remove buttons), (3) Objectives Builder (dynamic rows with type dropdown → type-specific fields: kill_monster→monster dropdown+qty, collect_item→item dropdown+qty, craft_item→item dropdown+qty, spend_crowns→amount, gather_resource→building dropdown+qty+duration, reach_level→level, visit_location→zone dropdown, talk_to_npc→NPC dropdown; add/remove buttons), (4) Rewards Builder (dynamic rows: item→item dropdown+qty, xp→amount, crowns→amount; add/remove buttons), (5) NPC Assignment (multi-checkbox list of NPCs); list has filter dropdowns (type, NPC, active), name search, table with Name/Type/Chain/NPCs/Objectives/Active/Edit/Delete columns; load item/monster/NPC/zone/class/quest data for dropdowns via existing API functions
- [x] T013 [US1] Add "Quests" tab in `admin/frontend/src/main.ts` — add questManager variable, create tab element, lazy-init QuestManager on first tab click following exact pattern of existing tabs (Items, Monsters, NPCs, Abilities, Recipes)

**Checkpoint**: Admin can create/edit/delete quests with full configurability. All quest data persists in DB.

---

## Phase 4: User Story 2 - Player Accepts a Quest from an NPC (Priority: P1)

**Goal**: Players can talk to quest-giver NPCs, see available quests, and accept them.

**Independent Test**: Create a quest in admin assigned to an NPC, log into game, visit the NPC, select quest dialogue option, see available quests, accept one, verify it appears in quest log.

### Implementation for User Story 2

- [x] T014 [US2] Add is_quest_giver to NpcDto in `shared/protocol/index.ts` — add `is_quest_giver: boolean` field to the NpcDto interface (alongside existing is_crafter)
- [x] T015 [US2] Update world state to include is_quest_giver in NPC data — modify the query/DTO building in `backend/src/game/world/` files that construct NPC data sent to clients (building data with NPCs), ensuring is_quest_giver is included
- [x] T016 [US2] Add quest dialogue option in `frontend/src/ui/BuildingPanel.ts` — after the is_crafter check (~line 555), add: if npc.is_quest_giver, create dialogue option "Do you have any tasks for me?" that calls this.onQuestOpen?.(npc.id); add onQuestOpen callback property and setter following the onCraftingOpen pattern
- [x] T017 [US2] Create `frontend/src/ui/QuestPanel.ts` — HTML modal component following CraftingModal pattern; shows when NPC quest dialogue selected; renders three sections: (1) Available Quests — quest cards with name, description, type badge, objectives list with icons, rewards with icons, prerequisites (hidden if none), "Accept" button; (2) Active Quests from this NPC — shows progress; (3) Completable Quests — "Complete Quest" button with reward preview; handles quest.available_list payload to populate; sends quest.accept messages; handles quest.accepted, quest.rejected responses; styled with existing CSS tokens (gold/dark theme)
- [x] T018 [US2] Wire QuestPanel in `frontend/src/scenes/GameScene.ts` — instantiate QuestPanel, connect BuildingPanel.onQuestOpen to send quest.list_available WS message, register handlers for quest.available_list and quest.accepted and quest.rejected server messages to update QuestPanel

**Checkpoint**: Players can talk to quest NPCs, browse available quests, and accept them.

---

## Phase 5: User Story 3 - Player Completes Quest Objectives and Turns In (Priority: P1)

**Goal**: Quest objectives track progress in real time and players can turn in completed quests for rewards.

**Independent Test**: Accept a "Kill 3 Goblins" quest, kill 3 goblins, verify progress updates after each kill, return to NPC, turn in, verify rewards granted.

### Implementation for User Story 3

- [x] T019 [US3] Hook QuestTracker.onMonsterKilled in `backend/src/game/combat/combat-session.ts` — after combat win + XP award, import QuestTracker, call onMonsterKilled(characterId, monsterId), send any returned progress payloads to the player's session
- [x] T020 [P] [US3] Hook QuestTracker.onItemCrafted in `backend/src/game/crafting/crafting-handler.ts` — in handleCraftingCollect after granting items, call onItemCrafted(characterId, itemDefId, quantity), send progress payloads
- [x] T021 [P] [US3] Hook QuestTracker.onGatheringCompleted in `backend/src/game/gathering/gathering-handler.ts` — after successful gathering session end, call onGatheringCompleted(characterId, buildingId), send progress payloads
- [x] T022 [P] [US3] Hook QuestTracker.onInventoryChanged in `backend/src/game/inventory/inventory-grant-service.ts` — after grantItemToCharacter, call onInventoryChanged(characterId), send progress payloads (handles collect_item objectives)
- [x] T023 [P] [US3] Hook QuestTracker.onLevelUp in `backend/src/game/progression/xp-service.ts` — after level-up detection, call onLevelUp(characterId, newLevel), send progress payloads
- [x] T024 [P] [US3] Hook QuestTracker.onCrownsSpent in `backend/src/game/currency/crown-service.ts` — after deductCrowns, call onCrownsSpent(characterId, amount), send progress payloads
- [x] T025 [P] [US3] Hook QuestTracker.onLocationVisited in `backend/src/game/world/city-movement-handler.ts` — on zone/building arrival, call onLocationVisited(characterId, zoneId, buildingId), send progress payloads
- [x] T026 [US3] Add quest.complete turn-in to QuestPanel in `frontend/src/ui/QuestPanel.ts` — when completable_quests are shown, "Complete Quest" button sends quest.complete; handle quest.completed response (show reward notification, update inventory state)
- [x] T027 [US3] Handle quest.progress messages in `frontend/src/scenes/GameScene.ts` — register handler for quest.progress server messages, forward to QuestPanel and QuestLog (if exists) and QuestTracker (if exists) for live updates

**Checkpoint**: Full quest loop works — accept, progress updates in real time, turn in with rewards.

---

## Phase 6: User Story 4 - Player Views and Manages Quest Log (Priority: P2)

**Goal**: Players can view all active quests grouped by type with progress and abandon quests.

**Independent Test**: Accept multiple quests of different types, open quest log, verify grouping and progress bars, abandon a quest, verify removal.

### Implementation for User Story 4

- [x] T028 [US4] Create `frontend/src/ui/QuestLog.ts` — HTML panel component; displays all active quests grouped by type (Daily, Weekly, Monthly, Main, Side, Repeatable sections); each quest shows name, objectives with progress bars (e.g., "Kill 3/5 Goblins"), "Abandon" button; sends quest.log on open, quest.abandon on button click; handles quest.log response to populate, quest.abandoned to remove entry; badge showing count of completable quests; styled with existing CSS tokens
- [x] T029 [US4] Wire QuestLog in `frontend/src/scenes/GameScene.ts` — instantiate QuestLog, add access button (in top bar or as a tab in LeftPanel), register handlers for quest.log and quest.abandoned server messages, forward quest.progress updates to QuestLog for live progress bar updates

**Checkpoint**: Players have a full quest journal with progress tracking and quest management.

---

## Phase 7: User Story 5 - Daily/Weekly/Monthly Quests Reset Automatically (Priority: P2)

**Goal**: Repeating quests become available again at the start of each new period.

**Independent Test**: Create a daily quest, complete it, verify it shows "Completed" same day. Change system date (or test with date logic in getCurrentResetKey), verify quest becomes available again.

### Implementation for User Story 5

- [x] T030 [US5] Verify and test reset_period_key logic in `backend/src/db/queries/quests.ts` — ensure getCurrentResetKey produces correct keys: daily='YYYY-MM-DD', weekly='YYYY-WNN' (ISO week), monthly='YYYY-MM'; ensure getQuestsForNpc query correctly filters: for daily/weekly/monthly quests, check that no character_quests row exists for current period key with status 'active' or 'completed'; for main/side, check no row exists with NULL key; for repeatable, always available
- [x] T031 [US5] Ensure handleQuestListAvailable in `backend/src/game/quest/quest-handler.ts` correctly categorizes quests — available (no current period row), active (current period, status='active'), completable (current period, all objectives done); daily quests completed yesterday should appear as available today

**Checkpoint**: Repeating quests reset correctly across day/week/month boundaries.

---

## Phase 8: User Story 6 - Chain Quests Unlock Sequentially (Priority: P2)

**Goal**: Chain quests enforce ordering via completed_quest prerequisites and display grouping in admin UI.

**Independent Test**: Create quest A and quest B with completed_quest prerequisite on A. Verify B is unavailable until A is completed.

### Implementation for User Story 6

- [x] T032 [US6] Verify completed_quest prerequisite in checkPrerequisites in `backend/src/game/quest/quest-service.ts` — ensure it calls hasCompletedQuest(characterId, prerequisiteQuestId) and correctly blocks acceptance when prerequisite quest is not completed
- [x] T033 [US6] Add chain quest display in `admin/frontend/src/ui/quest-manager.ts` — in the quest list table, show chain_id as a colored badge; add filter-by-chain option; when editing a quest with chain_id, show other quests in the same chain for context; sort chain quests by chain_step within the list

**Checkpoint**: Chain quests enforce sequential unlocking and are visually grouped in admin.

---

## Phase 9: User Story 7 - AI Agent Creates Quests via API (Priority: P3)

**Goal**: A structured catalog endpoint documents all quest building blocks for AI agents to create quests programmatically.

**Independent Test**: Fetch GET /api/quests/catalog, verify it returns structured JSON with all objective/prerequisite/reward types, parameters, examples, and API references.

### Implementation for User Story 7

- [x] T034 [US7] Add GET /api/quests/catalog endpoint in `admin/backend/src/routes/quests.ts` — returns structured JSON documenting: quest_types (with reset behavior), objective_types (each with description, parameters, example), prerequisite_types (each with description, parameters), reward_types (each with description, parameters), chain_quests (explanation + example), api_endpoints (CRUD reference); include available monster/item/NPC/zone IDs for reference; endpoint is static JSON (no DB query needed for the schema documentation itself)

**Checkpoint**: AI agents can read the catalog and create valid quests via the admin API.

---

## Phase 10: User Story 8 - Quest Tracker HUD Shows Active Progress (Priority: P3)

**Goal**: Small overlay on game canvas shows 1-3 pinned quest objectives with live progress.

**Independent Test**: Accept a quest, verify HUD shows objectives. Kill a monster matching an objective, verify HUD updates immediately.

### Implementation for User Story 8

- [x] T035 [US8] Create `frontend/src/ui/QuestTracker.ts` — small HTML overlay positioned on the game canvas; shows up to 3 current objective lines with progress (e.g., "⚔ Kill Goblins 2/5"); auto-populated from most recent active quest; updates on quest.progress messages; hides when no active quests; semi-transparent dark background with gold text matching game theme; positioned top-right or bottom-right of #game container
- [x] T036 [US8] Wire QuestTracker in `frontend/src/scenes/GameScene.ts` — instantiate QuestTracker, mount to #game container, forward quest.progress and quest.accepted and quest.completed messages to it for live updates; populate from quest.log data on initial load

**Checkpoint**: Players see live quest progress without opening the full quest log.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T037 Add structured logging to quest-tracker.ts hooks in `backend/src/game/quest/quest-tracker.ts` — log each objective progress update with characterId, questId, objectiveType, progress, targetQuantity
- [x] T038 Add quest completion notification in `frontend/src/ui/QuestPanel.ts` or GameScene — when quest.progress arrives with quest_complete=true, show a notification toast "Quest ready to turn in: [quest name]"
- [x] T039 Run full end-to-end validation per `specs/021-quest-system/quickstart.md` — create quest in admin → assign to NPC → talk to NPC in game → accept → complete objectives → turn in → verify rewards

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — admin UI needs backend queries + handler
- **US2 (Phase 4)**: Depends on Phase 2 — needs quest handler for WS messages
- **US3 (Phase 5)**: Depends on Phase 2 — needs quest tracker for hooks
- **US4 (Phase 6)**: Depends on Phase 4 (US2) — needs quest acceptance working to have quests in log
- **US5 (Phase 7)**: Depends on Phase 2 — tests reset logic in existing handler/queries
- **US6 (Phase 8)**: Depends on Phase 3 (US1) — needs admin UI for chain quest display
- **US7 (Phase 9)**: Depends on Phase 3 (US1) — needs admin routes already mounted
- **US8 (Phase 10)**: Depends on Phase 5 (US3) — needs progress messages to display
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (Admin Quest CRUD)**: After Foundational → independent
- **US2 (Player Accepts Quest)**: After Foundational → independent of US1 (quests can be created via DB/API)
- **US3 (Objective Tracking)**: After Foundational → independent of US1/US2 (can test with DB-created quests)
- **US4 (Quest Log)**: After US2 → needs quest acceptance UI
- **US5 (Reset Logic)**: After Foundational → independent
- **US6 (Chain Quests)**: After US1 → needs admin UI
- **US7 (AI Catalog)**: After US1 → needs admin routes
- **US8 (HUD Tracker)**: After US3 → needs progress messages

### Within Each User Story

- Models/queries before services
- Services before handlers
- Backend before frontend
- Core implementation before integration

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T003, T004, T005, T006 (Foundational) are sequential (queries → service → handler → tracker)
- T007 and T008 can run in parallel after T005
- US1 (T009-T013) and US2 (T014-T018) can start in parallel after Foundational
- US3 hooks (T019-T025) are all parallel with each other (different files)
- US5 (T030-T031) and US6 (T032-T033) can run in parallel
- US7 (T034) and US8 (T035-T036) can run in parallel

---

## Parallel Example: User Story 3 (Objective Tracking Hooks)

```bash
# All hooks modify different files — launch in parallel:
Task: "Hook QuestTracker.onMonsterKilled in backend/src/game/combat/combat-session.ts"
Task: "Hook QuestTracker.onItemCrafted in backend/src/game/crafting/crafting-handler.ts"
Task: "Hook QuestTracker.onGatheringCompleted in backend/src/game/gathering/gathering-handler.ts"
Task: "Hook QuestTracker.onInventoryChanged in backend/src/game/inventory/inventory-grant-service.ts"
Task: "Hook QuestTracker.onLevelUp in backend/src/game/progression/xp-service.ts"
Task: "Hook QuestTracker.onCrownsSpent in backend/src/game/currency/crown-service.ts"
Task: "Hook QuestTracker.onLocationVisited in backend/src/game/world/city-movement-handler.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup (migration + protocol)
2. Complete Phase 2: Foundational (queries, service, handler, tracker)
3. Complete Phase 3: US1 — Admin can create quests
4. Complete Phase 4: US2 — Players can accept quests from NPCs
5. Complete Phase 5: US3 — Objectives track and quests can be turned in
6. **STOP and VALIDATE**: Full quest loop works end-to-end

### Incremental Delivery

1. Setup + Foundational → Core backend ready
2. Add US1 → Admin can manage quests (MVP admin)
3. Add US2 + US3 → Players can do quests (MVP gameplay)
4. Add US4 → Quest log for player convenience
5. Add US5 + US6 → Repeating and chain quests
6. Add US7 → AI agent quest creation
7. Add US8 → HUD tracker quality-of-life
8. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The quest tracker hooks (US3) are the highest-risk integration — test each one individually
- collect_item objectives recheck actual inventory (not increment-based) — verify this specifically
