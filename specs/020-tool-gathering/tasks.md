# Tasks: Tool Durability & Gathering System

**Input**: Design documents from `/specs/020-tool-gathering/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/websocket-messages.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and shared protocol types that all stories depend on

- [x] T001 Create migration file `backend/src/db/migrations/021_tool_gathering.sql` with all schema changes: add tool_type/max_durability/power columns to item_definitions, add current_durability column to inventory_items, extend building_actions action_type CHECK to include 'gather', add in_gathering column to characters (see data-model.md for exact SQL)
- [x] T002 Run migration against the development database to apply schema changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core TypeScript interfaces, DB query functions, and shared protocol types that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Extend `ItemDefinition` interface and related query functions in `backend/src/db/queries/inventory.ts` — add tool_type, max_durability, power fields to ItemDefinition interface; update `createItemDefinition()` and `updateItemDefinition()` to accept/persist these fields; add `current_durability` to InventoryItem interface; add `updateToolDurability(slotId: number, newDurability: number)` query function; add `findToolByType(characterId: string, toolType: string)` query that returns the first inventory slot matching the tool type ordered by created_at ASC
- [x] T004 [P] Extend `Character` interface and update functions in `backend/src/db/queries/characters.ts` — add `in_gathering: boolean` to Character interface; add `in_gathering` to the allowed fields in `updateCharacter()` Partial<Pick<...>> type
- [x] T005 [P] Add all gathering-related types and message payloads to `shared/protocol/index.ts` — add GatherActionConfig, GatherEventConfig, GatherActionDto interfaces; add GatheringStartPayload, GatheringCancelPayload (client→server); add GatheringStartedPayload, GatheringTickPayload, GatheringTickEvent, GatheringCombatPausePayload, GatheringCombatResumePayload, GatheringEndedPayload, GatheringSummary, GatheringRejectedPayload (server→client); extend ItemDefinitionDto with optional tool_type/max_durability/power; extend InventorySlotDto with optional current_durability; add GatherActionDto to BuildingActionDto union; add 'gather' to action_type unions; add gathering message types to AnyServerMessage and AnyClientMessage unions (see contracts/websocket-messages.md for all interfaces)
- [x] T006 Modify `backend/src/game/inventory/inventory-grant-service.ts` — in `grantItemToCharacter()`, after creating a new inventory slot for a tool-category item, set `current_durability` to the item definition's `max_durability`; query the item definition to check if category is 'tool' and if so include current_durability in the INSERT

**Checkpoint**: Foundation ready — all interfaces, queries, and protocol types in place

---

## Phase 3: User Story 1 — Admin Creates Tools with Durability (Priority: P1) MVP

**Goal**: Admin can create/edit tool items with tool_type, power, and max_durability; players see durability on tool items in inventory

**Independent Test**: Create a tool item in admin panel, grant it to a player, verify inventory shows durability

### Implementation for User Story 1

- [x] T007 [P] [US1] Modify admin backend item routes in `admin/backend/src/routes/items.ts` — accept `tool_type`, `max_durability`, `power` fields in POST /api/items and PUT /api/items/:id; validate that these fields are present when category is 'tool' and absent otherwise; pass fields through to createItemDefinition/updateItemDefinition query functions
- [x] T008 [P] [US1] Modify admin frontend item form in `admin/frontend/src/pages/items.ts` — when category "tool" is selected, show additional form fields: tool_type dropdown (pickaxe, axe), max_durability number input, power number input; hide these fields for other categories; include values in create/update API calls
- [x] T009 [US1] Modify inventory slot rendering in `frontend/src/ui/InventoryPanel.ts` — when displaying a tool item (definition has tool_type), show current_durability / max_durability text (e.g. "750 / 1000"); use the current_durability from InventorySlotDto and max_durability from the nested definition
- [x] T010 [US1] Update inventory state/received message handling in `frontend/src/websocket/message-handler.ts` — ensure gathering-extended InventorySlotDto fields (current_durability) are properly passed through to the inventory UI when inventory.state or inventory.item_received messages arrive

**Checkpoint**: Admin can create tools with durability, players see durability in inventory

---

## Phase 4: User Story 2 — Admin Configures Gather Actions on Buildings (Priority: P1)

**Goal**: Admin can create "gather" building actions with tool type requirement, duration range, durability cost, and weighted event list

**Independent Test**: Create a gather action via admin panel, verify it appears on the building in-game

### Implementation for User Story 2

- [x] T011 [P] [US2] Modify admin backend building routes in `admin/backend/src/routes/buildings.ts` — add 'gather' to the allowed action_type validation; when action_type is 'gather', validate config contains: required_tool_type (string, must be 'pickaxe' or 'axe'), durability_per_second (positive integer), min_seconds (positive integer), max_seconds (positive integer, >= min_seconds), events array (each with type, weight, and type-specific fields per GatherEventConfig); store validated config in building_actions.config JSONB
- [x] T012 [P] [US2] Add gather action config UI in `admin/frontend/src/pages/building-actions.ts` — when action_type 'gather' is selected, show config form: required_tool_type dropdown, durability_per_second input, min_seconds input, max_seconds input; add dynamic event list editor where each event has: type dropdown (resource/gold/monster/accident/nothing), weight input, and type-specific fields (item_def_id+quantity for resource, min_amount+max_amount for gold, monster_id for monster, hp_damage for accident, message for resource/gold/accident); serialize as GatherActionConfig JSON for API call
- [x] T013 [US2] Modify building action DTO mapping for 'gather' type in `backend/src/game/world/building-action-handler.ts` or the query that loads building actions — ensure gather actions are included in the building's action list sent to the client as GatherActionDto (with config minus the events array, which is server-only)
- [x] T014 [US2] Update `frontend/src/ui/BuildingPanel.ts` to render gather actions — when a building action has action_type 'gather', show a gather-specific section with: action label, required tool type info, duration range display, and a duration input (slider or number field clamped to min_seconds..max_seconds) with a "Start Gathering" button

**Checkpoint**: Admin can create gather actions, players see them on buildings with duration picker

---

## Phase 5: User Story 3 — Player Starts and Completes Gathering (Priority: P1)

**Goal**: Player can start a gathering session that ticks each second, consumes durability, and sends a completion summary

**Dependencies**: Requires US1 (tools exist) and US2 (gather actions exist)

**Independent Test**: Start a gathering session with only "nothing" events configured, verify it completes after chosen duration and tool durability is consumed

### Implementation for User Story 3

- [x] T015 [US3] Create `backend/src/game/gathering/gathering-service.ts` — implement GatheringSessionManager class with: `sessions: Map<string, GatheringSession>` keyed by characterId; `startSession(session, character, action, toolSlot, duration)` that validates all prerequisites (HP > 0, not in combat/gathering, tool type matches, sufficient durability), creates GatheringSession object with config snapshot, sets in_gathering=true on character, starts 1-second setInterval timer, sends gathering.started message; `tick(characterId)` that increments currentTick, rolls weighted random event (for now just 'nothing'), sends gathering.tick message, checks if all ticks completed and calls endSession; `endSession(characterId, reason)` that clears interval, applies full durability cost to tool via updateToolDurability, destroys tool if durability <= 0, sets in_gathering=false, sends gathering.ended with summary, removes session from map; `cancelSession(characterId)` that calls endSession with reason 'cancelled'; `getSession(characterId)` for lookup; implement weighted random selection helper function
- [x] T016 [US3] Create `backend/src/game/gathering/gathering-handler.ts` — register WebSocket message handlers for 'gathering.start' and 'gathering.cancel'; on 'gathering.start': parse GatheringStartPayload, load character, load building action, load tool inventory slot with definition, delegate to GatheringSessionManager.startSession, send gathering.rejected on validation failure; on 'gathering.cancel': look up active session, delegate to cancelSession, ignore if no session exists
- [x] T017 [US3] Register gathering handlers in the WebSocket message router — import and wire gathering-handler.ts into the main message dispatch (same file/pattern used for combat, expedition, building action handlers); ensure 'gathering.start' and 'gathering.cancel' message types are routed to the gathering handler
- [x] T018 [US3] Add in_gathering check to `backend/src/game/world/building-action-handler.ts` — after the existing in_combat gate check, add a check for character.in_gathering; if true, reject with reason 'IN_GATHERING' and return; this blocks travel/explore/expedition while gathering
- [x] T019 [US3] Handle gathering.started, gathering.tick, and gathering.ended messages in `frontend/src/websocket/message-handler.ts` — on gathering.started: store gathering state (duration, start time) in a UI-accessible location; on gathering.tick: update progress display and show tick event in chat/combat log; on gathering.ended: clear gathering state, show summary; on gathering.rejected: show rejection message to player
- [x] T020 [US3] Add gathering progress UI to `frontend/src/ui/BuildingPanel.ts` — when gathering is active, replace the gather action section with: progress bar/counter showing ticks completed / total, current event message area, "End Gathering" button that sends gathering.cancel; when gathering.ended is received, restore normal building panel; disable the Start Gathering button while gathering is active

**Checkpoint**: Full gathering loop works — start, tick each second, complete, summary shown, durability consumed

---

## Phase 6: User Story 4 — Gathering Events: Combat, Resources, Gold, Accidents (Priority: P2)

**Goal**: All five event types process correctly during gathering ticks

**Dependencies**: Requires US3 (gathering loop functional)

**Independent Test**: Configure a gather action with all event types, run gathering, verify each type triggers and produces correct effects

### Implementation for User Story 4

- [x] T021 [US4] Implement resource event processing in `backend/src/game/gathering/gathering-service.ts` — in the tick() method, when a 'resource' event is rolled: call grantItemToCharacter with the event's item_def_id and quantity; if inventory is full, add "inventory full" message to event log; add resource event to eventLog with item name and quantity; send gathering.tick with event details
- [x] T022 [US4] Implement gold event processing in `backend/src/game/gathering/gathering-service.ts` — when a 'gold' event is rolled: generate random amount between min_amount and max_amount (inclusive); call addCrowns(characterId, amount); add gold event to eventLog; send gathering.tick with crowns amount and message
- [x] T023 [US4] Implement accident event processing in `backend/src/game/gathering/gathering-service.ts` — when an 'accident' event is rolled: compute new HP = max(0, current_hp - hp_damage); call updateCharacter(characterId, { current_hp: newHp }); add accident event to eventLog; send gathering.tick with hp_damage and message; if new HP is 0, call endSession with reason 'death'
- [x] T024 [US4] Implement monster event processing in `backend/src/game/gathering/gathering-service.ts` — when a 'monster' event is rolled: set session.paused = true and clear the interval timer; send gathering.combat_pause message; look up monster by monster_id (if not found, treat as 'nothing' event and resume); start a CombatSession using the existing combat system (set in_combat=true); register an onComplete callback that: reads character's current_hp, if HP > 0 sends gathering.combat_resume and restarts the interval timer (session.paused = false), if HP == 0 calls endSession with reason 'death'; add monster event to eventLog with combat_result
- [x] T025 [US4] Update gathering.tick event display in `frontend/src/websocket/message-handler.ts` and `frontend/src/ui/BuildingPanel.ts` — show appropriate messages for each event type in the gathering progress area: resource gained (item name + quantity), gold found (crowns + message), accident (damage + message), combat (pause indicator), nothing (no message or subtle indicator)

**Checkpoint**: All event types work during gathering — resources go to inventory, gold to crowns, accidents reduce HP, monsters trigger combat

---

## Phase 7: User Story 5 — HP as a Persistent Resource (Priority: P2)

**Goal**: HP changes persist after gathering; 0 HP blocks gathering, exploration, and expedition

**Dependencies**: Requires US4 (events that damage HP)

**Independent Test**: Take HP damage from accident during gathering, verify HP stays reduced after session ends, verify 0 HP blocks new actions

### Implementation for User Story 5

- [x] T026 [US5] Add HP > 0 guard to gathering start validation in `backend/src/game/gathering/gathering-service.ts` — in startSession(), check character.current_hp > 0 before allowing gathering to begin; if HP is 0, send gathering.rejected with reason 'HP_ZERO' and message "You must heal before gathering."
- [x] T027 [US5] Add HP > 0 guard to explore action in `backend/src/game/combat/explore-combat-service.ts` — before resolving an explore encounter, check character.current_hp > 0; if 0, reject the action with an appropriate message via city.building_action_rejected with reason 'HP_ZERO'
- [x] T028 [US5] Add HP > 0 guard to expedition dispatch in `backend/src/game/expedition/expedition-handler.ts` — before dispatching a squire expedition, check character.current_hp > 0; if 0, reject with appropriate message
- [x] T029 [US5] Display HP-related rejection messages on frontend — in `frontend/src/websocket/message-handler.ts`, handle gathering.rejected with reason 'HP_ZERO' and city.building_action_rejected with reason 'HP_ZERO' by showing a user-friendly "You must heal before doing this" message

**Checkpoint**: HP persists after gathering, 0 HP blocks all combat/gathering/expedition actions

---

## Phase 8: User Story 6 — Tool Destruction and Durability Management (Priority: P2)

**Goal**: Tools are destroyed when durability reaches 0; insufficient durability prevents gathering start; durability is visible in inventory

**Dependencies**: Requires US3 (gathering consumes durability)

**Independent Test**: Use a tool until durability reaches 0, verify it is removed from inventory

### Implementation for User Story 6

- [x] T030 [US6] Implement tool destruction in `backend/src/game/gathering/gathering-service.ts` — in endSession(), after applying totalDurabilityCost: if resulting current_durability <= 0, call deleteInventoryItem(toolSlotId, characterId) to destroy the tool; send inventory.item_deleted message to the client; set tool_destroyed=true in GatheringEndedPayload; add structured log for tool destruction
- [x] T031 [US6] Add insufficient durability validation to gathering start in `backend/src/game/gathering/gathering-service.ts` — in startSession(), compute totalDurabilityCost = duration * durability_per_second; compare against tool's current_durability; if insufficient, send gathering.rejected with reason 'INSUFFICIENT_DURABILITY' and a message showing required vs available durability
- [x] T032 [US6] Update durability display in `frontend/src/ui/BuildingPanel.ts` — when showing the gather action, display the player's matching tool and its current durability; after duration selection, show the estimated durability cost and whether the tool has enough; after gathering ends, if tool_destroyed is true in the summary, show a "Your tool was destroyed!" notification

**Checkpoint**: Tool destruction works, insufficient durability blocks start, UI shows durability info

---

## Phase 9: User Story 7 — Player Action Lock During Gathering (Priority: P3)

**Goal**: Player is blocked from all actions except cancel during gathering; early cancel applies full durability cost; disconnect handling

**Dependencies**: Requires US3 (gathering sessions exist)

**Independent Test**: Start gathering, attempt travel/explore, verify rejected; cancel early, verify full durability consumed

### Implementation for User Story 7

- [x] T033 [US7] Ensure in_gathering flag blocks all building actions in `backend/src/game/world/building-action-handler.ts` — verify that the in_gathering gate (added in T018) blocks travel, explore, expedition, and other gather actions; test that 'gathering.cancel' message is still processed while in_gathering is true (it bypasses the building action handler since it has its own handler)
- [x] T034 [US7] Handle player disconnect during gathering in `backend/src/game/gathering/gathering-service.ts` — register a disconnect callback on the session's WebSocket; when the player disconnects, gathering continues server-side (timer keeps running); on reconnect, if a gathering session still exists for the character, send the current gathering state (gathering.started with remaining time) so the frontend can resume showing progress; on gathering end with disconnected player, queue the gathering.ended message for delivery on reconnect
- [x] T035 [US7] Disable non-cancel actions in frontend during gathering in `frontend/src/ui/BuildingPanel.ts` — when gathering is active, hide or disable all action buttons except "End Gathering"; prevent the player from interacting with other building actions, travel buttons, or expedition dispatches while the gathering progress UI is shown

**Checkpoint**: Player fully locked during gathering, disconnect is handled gracefully

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Structured logging, edge cases, and final validation

- [x] T036 [P] Add structured logging throughout gathering service in `backend/src/game/gathering/gathering-service.ts` — log gathering start (characterId, actionId, duration, toolSlotId), each tick event type, combat pause/resume, session end (reason, summary stats), validation rejections, tool destruction; use the existing log() helper with domain 'gathering'
- [x] T037 [P] Handle edge cases in `backend/src/game/gathering/gathering-service.ts` — inventory full during resource event (resource lost with message), nonexistent monster_id (treat as 'nothing'), level-up during gathering combat (handled by existing combat system, no special code needed); verify equipped gear applies to gathering combat (should work via existing combat stat calculation)
- [x] T038 Run full manual test per quickstart.md: create tool in admin, grant to player, create gather action with all event types, start gathering, observe events, verify durability consumed, test cancel early, test 0 HP blocking, test tool destruction

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migration applied)
- **Phase 3 (US1)**: Depends on Phase 2 — parallel with Phase 4 (US2)
- **Phase 4 (US2)**: Depends on Phase 2 — parallel with Phase 3 (US1)
- **Phase 5 (US3)**: Depends on Phase 3 (US1) AND Phase 4 (US2) — needs tools and gather actions
- **Phase 6 (US4)**: Depends on Phase 5 (US3) — needs gathering loop
- **Phase 7 (US5)**: Depends on Phase 6 (US4) — needs accident/combat events
- **Phase 8 (US6)**: Depends on Phase 5 (US3) — can parallel with Phase 6/7
- **Phase 9 (US7)**: Depends on Phase 5 (US3) — can parallel with Phase 6/7/8
- **Phase 10 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no story dependencies
- **US2 (P1)**: After Phase 2 — no story dependencies, parallel with US1
- **US3 (P1)**: After US1 + US2 — needs tools and gather actions to exist
- **US4 (P2)**: After US3 — adds event processing to the gathering loop
- **US5 (P2)**: After US4 — HP guards depend on events that damage HP
- **US6 (P2)**: After US3 — can parallel with US4/US5/US7
- **US7 (P3)**: After US3 — can parallel with US4/US5/US6

### Within Each User Story

- Models/queries before services
- Backend before frontend (shared protocol first)
- Core implementation before edge cases

### Parallel Opportunities

- T003, T004, T005 (Phase 2) — different files, no dependencies
- T007, T008 (US1) — admin backend vs admin frontend
- T011, T012 (US2) — admin backend vs admin frontend
- US1 and US2 entirely parallel after Phase 2
- US6, US7 parallel after US3 completes
- T036, T037 (Polish) — different concerns, same file but independent sections

---

## Parallel Example: Foundational Phase

```
# Launch all foundational tasks in parallel (different files):
T003: Extend ItemDefinition in backend/src/db/queries/inventory.ts
T004: Extend Character in backend/src/db/queries/characters.ts
T005: Add gathering types to shared/protocol/index.ts
```

## Parallel Example: US1 + US2

```
# After Phase 2, launch US1 and US2 in parallel:

# US1 (admin tools):
T007: Modify admin backend items.ts
T008: Modify admin frontend items.ts (parallel with T007)

# US2 (gather actions) — same time as US1:
T011: Modify admin backend buildings.ts
T012: Modify admin frontend building-actions.ts (parallel with T011)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 Only)

1. Complete Phase 1: Setup (migration)
2. Complete Phase 2: Foundational (queries, types)
3. Complete Phase 3: US1 (admin tool creation) + Phase 4: US2 (gather action config) in parallel
4. Complete Phase 5: US3 (core gathering loop with "nothing" events only)
5. **STOP and VALIDATE**: Test basic gathering flow end-to-end
6. Deploy/demo basic gathering

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 → Admin can create tools and gather actions (Demo!)
3. US3 → Players can gather (basic loop) (Demo!)
4. US4 → Events make gathering interesting (Demo!)
5. US5 + US6 + US7 → HP guards, tool destruction, action locking (Final polish)
6. Polish → Logging, edge cases, full validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test tasks included (not requested in spec)
- US3 is the largest story — consider breaking T015 (gathering-service.ts) into sub-steps during implementation
- Combat integration (T024) is the most complex single task — reuses existing CombatSession but needs careful callback wiring
- The gathering-service.ts file is touched by many stories — tasks are additive (each story adds to the same file)
