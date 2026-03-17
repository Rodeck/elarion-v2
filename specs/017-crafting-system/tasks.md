# Tasks: Crafting System

**Input**: Design documents from `/specs/017-crafting-system/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing. US6 (persistence) is inherent in the database design and validated as part of US1/US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema, shared protocol types, and project scaffolding

- [x] T001 Create migration file `backend/src/db/migrations/019_crafting_system.sql` — add `npcs.is_crafter` column, `crafting_recipes` table, `recipe_ingredients` table, `crafting_sessions` table, `crafting_session_costs` table with all constraints and indexes per data-model.md
- [x] T002 Add crafting DTO types and message type definitions to `shared/protocol/index.ts` — add CraftingRecipeDto, CraftingIngredientDto, CraftingSessionDto, CraftingRejectionReason type, and all crafting message payload interfaces per contracts/crafting-protocol.md
- [x] T003 Extend NpcDto in `shared/protocol/index.ts` with `is_crafter: boolean` field

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database query module and core service that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create crafting query module `backend/src/db/queries/crafting.ts` — implement all recipe queries: getAllRecipes(), getRecipesByNpcId(), getRecipeById(), getRecipeIngredients(), createRecipe(), updateRecipe(), deleteRecipe(), and ingredient CRUD functions following the pattern in `backend/src/db/queries/npcs.ts`
- [x] T005 Add crafting session queries to `backend/src/db/queries/crafting.ts` — implement: createSession(), getSessionById(), getActiveSessionsForCharacter(), getActiveSessionForRecipeAtNpc(), getSessionCosts(), updateSessionStatus(), deleteSession(), and getCompletedUncolletedSessions()
- [x] T006 Add `deductCrowns(characterId, amount)` function to `backend/src/db/queries/characters.ts` — uses `UPDATE characters SET crowns = crowns - $2 WHERE id = $1 AND crowns >= $2 RETURNING crowns`, returns new balance or null if insufficient (per research.md R-006)
- [x] T007 Create crafting service `backend/src/game/crafting/crafting-service.ts` — implement helper functions: calculateProgress(session) returning {percent, remainingSeconds, isComplete}, validateMaterials(characterId, recipe, quantity), and buildRecipeDto(recipe, ingredients, itemDefs) for DTO assembly
- [x] T008 Create crafting handler `backend/src/game/crafting/crafting-handler.ts` — register all 4 WebSocket handlers (crafting.open, crafting.start, crafting.cancel, crafting.collect) with the dispatcher in `backend/src/websocket/dispatcher.ts`, with stub implementations that return crafting.rejected with reason 'NOT_IMPLEMENTED'
- [x] T009 Update NPC query in `backend/src/db/queries/npcs.ts` — add is_crafter field to Npc interface and include it in all SELECT queries; update getNpcsForBuilding to return is_crafter

**Checkpoint**: Foundation ready — crafting tables exist, query module complete, service skeleton in place, handlers registered

---

## Phase 3: User Story 1 — Browse and Start Crafting (Priority: P1) 🎯 MVP

**Goal**: Player interacts with a crafting NPC, sees recipe list, selects quantity, starts crafting with material/crown deduction

**Independent Test**: Visit a crafting NPC, open crafting modal, select recipe with quantity, verify materials and crowns are deducted and session is created in database

### Implementation for User Story 1

- [x] T010 [US1] Implement `handleCraftingOpen` in `backend/src/game/crafting/crafting-handler.ts` — validate player is at building with this NPC, NPC is_crafter=true, fetch recipes with ingredients and item definitions, fetch active sessions for character at this NPC, compute progress for each active session, send crafting.state message with recipes and active_sessions arrays
- [x] T011 [US1] Implement `handleCraftingStart` in `backend/src/game/crafting/crafting-handler.ts` — validate: NPC proximity, NPC is crafter with this recipe, quantity is positive integer, no active session for this recipe at this NPC, player has sufficient unequipped materials (check inventory_items excluding equipped), player has sufficient crowns. In a single transaction: deduct all materials from inventory_items, deduct crowns via deductCrowns(), create crafting_session row, create crafting_session_costs rows (snapshot of materials spent). Send crafting.started with session DTO, new crown balance, and updated inventory slots
- [x] T012 [US1] Update NPC DTO building in city map queries `backend/src/db/queries/city-maps.ts` (or wherever NpcDto is assembled for the building response) to include is_crafter field from npcs table
- [x] T013 [US1] Add "I want to craft some items" dialog option in `frontend/src/ui/BuildingPanel.ts` — in renderNpcPanel(), after existing dialog options, add a conditional crafting button when npc.is_crafter === true. On click, send crafting.open message with npc_id and open CraftingModal
- [x] T014 [US1] Create `frontend/src/ui/CraftingModal.ts` — HTML overlay modal following CombatModal pattern (fixed position, z-index 200+, dark backdrop). Display recipe list with: recipe name, output item icon+name+quantity, ingredient list with icons+names+quantities, crown cost, craft time per unit. Include close button (X) that dismisses modal without interrupting active crafts
- [x] T015 [US1] Add quantity selection UI to CraftingModal in `frontend/src/ui/CraftingModal.ts` — for each recipe row, add preset buttons (1x, 5x, 20x) and a custom numeric input field. Show total materials needed, total crowns, and total craft time based on selected quantity. "Start Crafting" button sends crafting.start message. Disable start button and show "Crafting..." status for recipes with active sessions
- [x] T016 [US1] Add crafting message handlers to frontend WebSocket client — handle crafting.state (populate modal), crafting.started (update modal to show active session, update inventory display and crown balance), crafting.rejected (show rejection reason as user-facing message in modal)
- [x] T017 [US1] Add structured logging to crafting-handler.ts and crafting-service.ts — log crafting.open (characterId, npcId), crafting.start (characterId, recipeId, quantity, totalCost), and all rejections with reason codes

**Checkpoint**: Player can browse recipes at a crafting NPC and start crafting. Materials/crowns deducted. Session persisted to database (US6 inherently satisfied).

---

## Phase 4: User Story 2 — Track Progress and Collect Finished Items (Priority: P1)

**Goal**: Player sees real-time progress bar for active crafts and can collect completed items into inventory

**Independent Test**: Start a craft, reopen modal to see progress bar with correct %, wait for completion, click Collect, verify items in inventory

### Implementation for User Story 2

- [x] T018 [US2] Add progress display to CraftingModal in `frontend/src/ui/CraftingModal.ts` — for recipes with active sessions, show: progress bar (percentage filled), percentage text, remaining time countdown (mm:ss format). Use client-side timer that updates every second based on started_at and total_duration_seconds from CraftingSessionDto. When progress reaches 100%, replace progress bar with "Collect" button
- [x] T019 [US2] Implement `handleCraftingCollect` in `backend/src/game/crafting/crafting-handler.ts` — validate: session belongs to player, session is completed or elapsed time >= total_duration (auto-transition in_progress → completed). Check inventory capacity for output items (output_quantity × session.quantity). Grant items via grantItemToCharacter() from inventory-grant-service.ts. Update session status to 'collected'. Send crafting.collected with session_id, items_received, updated_slots
- [x] T020 [US2] Add collect message handler to frontend WebSocket client — handle crafting.collected: remove session from modal active list, show success feedback, update inventory display. Handle crafting.rejected with reason INVENTORY_FULL: show message that player needs to free inventory space
- [x] T021 [US2] Handle auto-completion detection in `handleCraftingOpen` in `backend/src/game/crafting/crafting-handler.ts` — when loading active sessions, check if any in_progress session has elapsed time >= total_duration_seconds. If so, update its status to 'completed' in database before sending crafting.state. This ensures sessions completed during offline/server-downtime are correctly shown as collectable

**Checkpoint**: Full crafting lifecycle works — start, track progress, collect. Persistence across reconnection verified (sessions show correct progress after reopening modal).

---

## Phase 5: User Story 3 — Cancel In-Progress Crafting (Priority: P2)

**Goal**: Player can cancel active crafting and receive 50% refund of materials and crowns (rounded down)

**Independent Test**: Start a craft, cancel it, verify 50% of each material (rounded down) and 50% of crowns (rounded down) returned to inventory/balance

### Implementation for User Story 3

- [x] T022 [US3] Implement `handleCraftingCancel` in `backend/src/game/crafting/crafting-handler.ts` — validate: session belongs to player, session status is 'in_progress'. Calculate refunds: for each crafting_session_costs row, refund = floor(quantity_spent * 0.5); crown refund = floor(cost_crowns * 0.5). Check inventory capacity for refunded materials. In a single transaction: grant refunded materials via inventory inserts, award refunded crowns via addCrowns(), update session status to 'cancelled'. Send crafting.cancelled with refund details, new crown balance, updated inventory slots
- [x] T023 [US3] Add cancel button to CraftingModal in `frontend/src/ui/CraftingModal.ts` — for recipes with in_progress active sessions, show "Cancel" button alongside the progress bar. On click, show confirmation dialog ("Cancel crafting? You will receive 50% of materials back."). On confirm, send crafting.cancel message with session_id
- [x] T024 [US3] Add cancel message handler to frontend WebSocket client — handle crafting.cancelled: remove session from active list, show refund summary feedback (items and crowns returned), update inventory display and crown balance. Handle crafting.rejected with reason INVENTORY_FULL: show message that player needs free space for refunded materials
- [x] T025 [US3] Add structured logging for cancel operations in `backend/src/game/crafting/crafting-handler.ts` — log characterId, sessionId, recipeId, refunded items with quantities, refunded crowns

**Checkpoint**: Cancel flow works with correct 50% refund calculation. Edge cases handled (inventory full, rounding).

---

## Phase 6: User Story 4 — Admin Recipe Management (Priority: P2)

**Goal**: Admin can create, edit, and delete crafting recipes through admin backend; mark NPCs as crafters

**Independent Test**: Admin creates a recipe in admin UI, assigns to an NPC marked as crafter, player sees recipe in game crafting modal

### Implementation for User Story 4

- [x] T026 [P] [US4] Create admin recipe routes `admin/backend/src/routes/recipes.ts` — implement REST endpoints following items.ts pattern: GET /api/recipes (list all, optional npc_id filter), GET /api/recipes/:id (with ingredients), POST /api/recipes (create recipe + ingredients in transaction), PUT /api/recipes/:id (update recipe fields + replace ingredients), DELETE /api/recipes/:id (cascade deletes ingredients; do NOT cancel active sessions per spec)
- [x] T027 [P] [US4] Add NPC is_crafter toggle endpoint to `admin/backend/src/routes/npcs.ts` — add PUT /api/npcs/:id/crafter endpoint that sets is_crafter = true/false on the npcs table
- [x] T028 [US4] Register recipe routes in admin backend app `admin/backend/src/index.ts` (or wherever routes are mounted) — import and mount recipesRouter at /api/recipes
- [x] T029 [US4] Create admin recipe manager UI `admin/frontend/src/ui/recipe-manager.ts` — follow item-manager.ts pattern with 2-column layout. Left: form with fields (name, description, NPC selector dropdown, output item selector, output quantity, crown cost, craft time in seconds, sort order). Ingredient sub-form: add/remove ingredient rows, each with item selector dropdown and quantity input. Right: recipe table with columns (name, NPC, output item, cost, time, actions). Edit/Delete buttons per row
- [x] T030 [US4] Add is_crafter toggle to NPC management in `admin/frontend/src/ui/npc-manager.ts` (or equivalent admin NPC UI) — add checkbox/toggle for "Crafting NPC" that calls PUT /api/npcs/:id/crafter
- [x] T031 [US4] Add recipe API client functions to `admin/frontend/src/editor/api.ts` — implement getRecipes(), getRecipeById(), createRecipe(), updateRecipe(), deleteRecipe(), and toggleNpcCrafter() functions following existing API client pattern
- [x] T032 [US4] Register recipe manager page/tab in admin frontend navigation — add "Recipes" entry to admin sidebar/nav that loads recipe-manager.ts

**Checkpoint**: Admin can fully manage recipes. Creating a recipe for a crafter NPC makes it appear in the player crafting modal.

---

## Phase 7: User Story 5 — Admin /crafting_finish Command (Priority: P3)

**Goal**: Admin can force-complete all in-progress crafting for a named player via chat command

**Independent Test**: Admin runs `/crafting_finish PlayerName` while player has active crafts, all sessions become completed and collectable

### Implementation for User Story 5

- [x] T033 [US5] Add `/crafting_finish` command handler to `backend/src/game/admin/admin-command-handler.ts` — parse `/crafting_finish <player_name>`, resolve character by name via findByName(), fetch all in_progress sessions for character, update all to status='completed'. Send admin.command_result to admin with count of finished sessions. If target player is online, send crafting.sessions_updated message with finished_count
- [x] T034 [US5] Add crafting.sessions_updated message handler to frontend WebSocket client — display notification to player that their crafting has been completed by an admin. If crafting modal is open, refresh the state (re-send crafting.open for current NPC)
- [x] T035 [US5] Add structured logging for /crafting_finish in admin command handler — log adminId, targetCharacterId, targetCharacterName, sessionsFinished count

**Checkpoint**: Admin command works for both online and offline players.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, validation hardening, and cleanup

- [x] T036 Verify server restart persistence — manually test: start a craft, restart backend server, reconnect, confirm progress bar shows correct elapsed time based on wall-clock (validates US6)
- [x] T037 Handle edge case in crafting-handler.ts: recipe deleted while session in progress — collect should still work using snapshot data from crafting_sessions/crafting_session_costs. If output item_definition was deleted, send crafting.rejected with ITEM_DEF_NOT_FOUND
- [x] T038 Handle edge case in CraftingModal: player navigates away from building during crafting — modal should close, but crafting continues server-side. Reopening modal at same NPC later shows progress
- [x] T039 Validate quantity input in CraftingModal — reject non-positive, non-integer, and excessively large values client-side before sending to server. Server also validates independently
- [x] T040 Run quickstart.md validation — follow all setup and test steps in quickstart.md end-to-end to verify complete flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration applied, types defined)
- **US1 Browse & Start (Phase 3)**: Depends on Phase 2 (queries, service, handlers registered)
- **US2 Track & Collect (Phase 4)**: Depends on Phase 3 (start flow must work to have sessions to track/collect)
- **US3 Cancel (Phase 5)**: Depends on Phase 3 (start flow must work to have sessions to cancel)
- **US4 Admin Recipes (Phase 6)**: Depends on Phase 2 only (admin CRUD is independent of player flows)
- **US5 Admin Command (Phase 7)**: Depends on Phase 2 (needs session queries)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Requires Foundational — no other story dependencies
- **US2 (P1)**: Requires US1 (needs active sessions to track/collect)
- **US3 (P2)**: Requires US1 (needs active sessions to cancel)
- **US4 (P2)**: Requires Foundational only — **can run in parallel with US1**
- **US5 (P3)**: Requires Foundational only — **can run in parallel with US1**
- **US6 (P1)**: No separate tasks — inherent in database design (wall-clock timestamps)

### Within Each User Story

- Backend handler before frontend UI (server-authoritative)
- Service logic before handler implementation
- WebSocket message handlers before UI interactions that depend on responses

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (both modify protocol/index.ts but different sections — or combine into single task)
- **Phase 2**: T004 and T006 can run in parallel (different files). T005 depends on T004 (same file).
- **Phase 6 (US4)**: T026 and T027 can run in parallel (different route files). T029 can run in parallel with T026/T027 (frontend vs backend).
- **Cross-story**: US4 (admin recipes) can run in parallel with US1 (player crafting) after Phase 2

---

## Parallel Example: Post-Foundation

```bash
# After Phase 2, these can run in parallel:

# Stream A: Player crafting flow
Task: T010 [US1] handleCraftingOpen handler
Task: T011 [US1] handleCraftingStart handler
Task: T013 [US1] BuildingPanel dialog option
Task: T014 [US1] CraftingModal creation
...

# Stream B: Admin recipe management (independent)
Task: T026 [US4] Admin recipe routes
Task: T027 [US4] NPC crafter toggle
Task: T029 [US4] Recipe manager UI
...

# Stream C: Admin command (independent)
Task: T033 [US5] /crafting_finish command handler
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + protocol types)
2. Complete Phase 2: Foundational (queries, service, handler registration)
3. Complete Phase 3: US1 — Browse and Start Crafting
4. **STOP and VALIDATE**: Player can open crafting modal, see recipes, start crafting, verify deductions
5. This alone delivers core crafting value

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Browse & Start) → Test → **MVP!**
3. Add US2 (Track & Collect) → Test → Full crafting lifecycle
4. Add US3 (Cancel) → Test → Player safety net
5. Add US4 (Admin Recipes) → Test → Content creation tooling
6. Add US5 (Admin Command) → Test → Operations tooling
7. Polish → Edge cases and hardening

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3 (US1)** = minimum viable crafting. Player can start crafts. Combined with Phase 4 (US2), this delivers the complete core loop.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US6 (persistence) has no dedicated tasks — it's inherent in the PostgreSQL-backed data model with wall-clock timestamps
- No test tasks generated (not explicitly requested)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
