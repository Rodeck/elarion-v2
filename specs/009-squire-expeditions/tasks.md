# Tasks: Squire Expeditions

**Input**: Design documents from `/specs/009-squire-expeditions/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/websocket-expedition.md, research.md, quickstart.md

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: User story this task belongs to (US1–US5)
- File paths are absolute from repo root

---

## Phase 1: Setup

**Purpose**: No new project scaffolding needed — monorepo already exists. This phase
creates the single new source directory.

- [x] T001 Create directory `backend/src/game/expedition/` (new feature module)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema, DB queries, and shared protocol types that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Write `backend/src/db/migrations/012_squire_expeditions.sql` — extend `building_actions.action_type` CHECK to add `'expedition'`; create `squires` table; create `squire_expeditions` table (see data-model.md for full DDL)
- [x] T003 [P] Write `backend/src/db/queries/squires.ts` — implement all expedition queries: `createSquire`, `getSquiresForCharacter`, `getActiveExpeditionForSquire`, `createExpedition`, `getExpeditionById`, `getUnnotifiedCompletedExpeditions`, `markExpeditionNotified`, `markExpeditionCollected` with TypeScript interfaces `Squire`, `SquireExpedition`, `ExpeditionRewardSnapshot`, `ExpeditionActionConfig`
- [x] T004 [P] Extend `shared/protocol/index.ts` — add client→server payloads (`ExpeditionDispatchPayload`, `ExpeditionCollectPayload`), server→client payloads (`ExpeditionDispatchedPayload`, `ExpeditionDispatchRejectedPayload`, `ExpeditionCompletedPayload`, `ExpeditionCollectResultPayload`, `ExpeditionCollectRejectedPayload`), `ExpeditionStateDto` sub-type, optional `expedition_state?: ExpeditionStateDto` on `CityBuildingArrivedPayload`, `ExpeditionActionConfig` interface, and update `AnyServerMessage` / `AnyClientMessage` union types

**Checkpoint**: Migration applied, all DB queries typed, protocol types compiled — user story work can now begin.

---

## Phase 3: User Story 1 — Admin Configures Expedition (Priority: P1)

**Goal**: An admin can add an expedition action to any building via the admin panel,
specifying base gold, base exp, and optional item rewards.

**Independent Test**: Use the admin panel to POST a new expedition action on a building;
GET the building's actions and confirm type = `'expedition'` with correct config values.

### Implementation for User Story 1

- [x] T005 [US1] Extend `admin/backend/src/routes/buildings.ts` — in the `POST /:id/buildings/:buildingId/actions` handler add `'expedition'` to the valid action_type check and a new validation branch: validate `base_gold` (integer ≥ 0), `base_exp` (integer ≥ 0), `items` array (each entry: `item_def_id` exists in `item_definitions`, `base_quantity` integer ≥ 1); call `createBuildingAction` with type `'expedition'` and validated config; log `expedition_action_created` event
- [x] T006 [US1] Add expedition form fields to `admin/frontend/src/ui/properties.ts` — add `'expedition'` to the `actionTypes` array; create `expeditionFields` div (hidden by default, shown when type = expedition) containing: `base_gold` number input (min 0), `base_exp` number input (min 0), a dynamic items table with add-row button (each row: item_def_id select populated from item list + base_quantity number input, remove-row button); update the type-select change handler to show/hide travel / explore / expedition field groups; wire form submit to pass expedition config to `createBuildingAction`

**Checkpoint**: Admin can create expedition actions — confirmed via admin API and UI.

---

## Phase 4: User Story 2 — Player Dispatches Squire (Priority: P1) 🎯 MVP

**Goal**: A player at a building with an expedition action can dispatch their idle squire
for 1h, 3h, or 6h; the building menu shows duration options with reward previews; after
dispatch the squire shows as exploring with a countdown.

**Independent Test**: Arrive at an expedition-enabled building with an idle squire → see
duration buttons with reward estimates → click 1h → confirm `squire_expeditions` row
created in DB, squire shown as exploring in building panel with `completes_at` displayed.

### Implementation for User Story 2

- [x] T007 [US2] Write `backend/src/game/expedition/expedition-service.ts` — export `DURATION_MULTIPLIERS: Record<1|3|6, number>` = `{1: 1.0, 3: 2.4, 6: 4.0}`; implement `computeRewardSnapshot(config, durationHours)` (multiply base values, floor, omit zero-quantity items, embed item names); implement `buildExpeditionStateDto(squires, activeExpedition, config, buildingName)` returning the correct `ExpeditionStateDto` shape per squire status (idle: duration_options with estimates; exploring: expedition_id + completes_at; ready: handled in US4)
- [x] T008 [US2] Write `handleExpeditionDispatch` in `backend/src/game/expedition/expedition-handler.ts` — validate: character present, city map, not in combat, character is at building node, action_id belongs to building with type `'expedition'`, duration_hours in [1,3,6], at least one squire has no uncollected expedition row; compute reward snapshot; insert `squire_expeditions` row with `completes_at = now() + duration_hours * interval`; send `expedition.dispatched`; log structured `expedition.dispatched` event with squire_id, character_id, building_id, duration_hours
- [x] T009 [P] [US2] Add `expedition.dispatch` payload schema to `backend/src/websocket/validator.ts` — validate `building_id` (positive integer), `action_id` (positive integer), `duration_hours` (one of 1, 3, 6)
- [x] T010 [US2] Register `handleExpeditionDispatch` in `backend/src/index.ts` — `registerHandler('expedition.dispatch', handleExpeditionDispatch)`
- [x] T011 [US2] Update `backend/src/game/world/character-create-handler.ts` — after `insertCharacter()` succeeds, call `createSquire(character.id, pickSquireName())` where `pickSquireName()` returns a name from the pool `['Aldric', 'Brand', 'Cade', 'Daveth', 'Edgar', 'Finn', 'Gareth', 'Hadwyn']`; log `squire.created` event
- [x] T012 [US2] Update `backend/src/game/world/building-action-handler.ts` — after the building is resolved, check if any action has `action_type === 'expedition'`; if so, call `getSquiresForCharacter`, `getActiveExpeditionForSquire`, and `buildExpeditionStateDto` to construct `expedition_state`; include it in the `city.building_arrived` payload sent to the client; log expedition_state presence
- [x] T013 [US2] Add expedition dispatch UI to `frontend/src/ui/BuildingPanel.ts` — update `show(building, expeditionState?)` signature to accept optional state; when `expedition_state` present render an "Expedition" section: for `squire_status === 'idle'` show three duration buttons (1h / 3h / 6h) each with est_gold, est_exp, item counts from `duration_options`; for `squire_status === 'exploring'` show "[Name] is exploring — returns at [time]" computed from `completes_at`; add `showDispatchRejection(reason)` mapping codes (`NO_SQUIRE_AVAILABLE`, `INVALID_DURATION`, `NOT_AT_BUILDING`, `NO_EXPEDITION_CONFIG`, `IN_COMBAT`, `NOT_CITY_MAP`) to user-facing strings; add `onExpeditionDispatch` callback field
- [x] T014 [P] [US2] Add `expedition.dispatched` and `expedition.dispatch_rejected` handlers to `frontend/src/network/WSClient.ts` — on `expedition.dispatched` invoke `onExpeditionDispatched` callback; on `expedition.dispatch_rejected` invoke `onExpeditionDispatchRejected` callback; expose callback setters
- [x] T015 [US2] Wire expedition dispatch in `frontend/src/scenes/GameScene.ts` — pass `expedition_state` from `city.building_arrived` to `BuildingPanel.show()`; set `onExpeditionDispatch` callback to send `expedition.dispatch` message via WSClient; set `onExpeditionDispatched` to call `BuildingPanel.showDispatchSuccess()` updating panel to exploring state; set `onExpeditionDispatchRejected` to call `BuildingPanel.showDispatchRejection(reason)`

**Checkpoint**: Player can dispatch squire from building menu — full dispatch loop works end-to-end.

---

## Phase 5: User Story 3 — Completion Notification (Priority: P2)

**Goal**: When a squire's expedition timer expires, the player sees a system message in
the chat log on their next connect/reconnect.

**Independent Test**: Dispatch a squire; force-expire the expedition in DB (`UPDATE squire_expeditions SET completes_at = now() - interval '1s' WHERE id = <id>`); disconnect and reconnect; confirm `expedition.completed` message arrives and a system-style entry appears in the chat log.

### Implementation for User Story 3

- [x] T016 [US3] Update `backend/src/websocket/handlers/world-state-handler.ts` — after `sendInventoryState`, call `getUnnotifiedCompletedExpeditions(character.id)`; for each result send `expedition.completed` payload `{ expedition_id, squire_name, building_name }`; then call `markExpeditionNotified(id)`; log `expedition.notify_on_connect` structured event with expedition_id, squire_name, building_name
- [x] T017 [P] [US3] Add `expedition.completed` handler to `frontend/src/network/WSClient.ts` — on `expedition.completed` invoke `onExpeditionCompleted` callback with `{ expedition_id, squire_name, building_name }`; expose callback setter
- [x] T018 [US3] Display completion as system message in `frontend/src/scenes/GameScene.ts` — set `onExpeditionCompleted` callback; inject a styled entry into the `ChatBox` (e.g. `ChatBox.addSystemMessage(...)`) with text "Squire [Name] has finished exploring at [Building]. Visit to collect rewards."; style distinctly from player chat (e.g. italic gold color)

**Checkpoint**: Player sees system notification in chat on reconnect after expedition completes.

---

## Phase 6: User Story 4 — Collect Expedition Rewards (Priority: P2)

**Goal**: After a squire's expedition completes, the player visits the building and
collects gold, exp, and items in one action; the squire returns to idle.

**Independent Test**: With a completed uncollected expedition, visit the building → confirm
building panel shows "Collect Rewards" with reward breakdown → confirm action credits gold/exp
to character and items to inventory → confirm squire is idle again in DB.

### Implementation for User Story 4

- [x] T019 [US4] Add `handleExpeditionCollect` to `backend/src/game/expedition/expedition-handler.ts` — validate: character present, expedition exists, character owns it, `completes_at <= now()`, `collected_at IS NULL`; credit `gold` via `UPDATE characters SET gold = gold + $1` (note: add gold column to characters if not present, or use existing currency field); credit `exp` via `xp-service.ts` `grantXp()`; grant each item via `grantItemToCharacter()`, tracking if any items were skipped (inventory full); set `collected_at = now()`; send `expedition.collect_result` with squire_name, rewards breakdown, `items_skipped` flag; log `expedition.collected` structured event
- [x] T020 [P] [US4] Add `expedition.collect` payload schema to `backend/src/websocket/validator.ts` — validate `expedition_id` (positive integer)
- [x] T021 [US4] Register `handleExpeditionCollect` in `backend/src/index.ts` — `registerHandler('expedition.collect', handleExpeditionCollect)`
- [x] T022 [US4] Add collect UI to `frontend/src/ui/BuildingPanel.ts` — for `squire_status === 'ready'` render a "Collect Rewards" section showing squire name, gold amount, exp amount, item names+quantities from `collectable_rewards`; add a "Collect" button that calls `onExpeditionCollect(expedition_id)` callback; add `showCollectResult(result)` method that shows a success summary and re-renders the section to idle state; add `showCollectRejection(reason)` mapping `NOT_COMPLETE`, `ALREADY_COLLECTED`, `NOT_FOUND`, `NOT_OWNER` to user-facing strings
- [x] T023 [P] [US4] Add `expedition.collect_result` and `expedition.collect_rejected` handlers to `frontend/src/network/WSClient.ts` — on `expedition.collect_result` invoke `onExpeditionCollectResult` callback; on `expedition.collect_rejected` invoke `onExpeditionCollectRejected` callback; expose callback setters
- [x] T024 [US4] Wire expedition collect in `frontend/src/scenes/GameScene.ts` — set `onExpeditionCollect` callback to send `expedition.collect` message via WSClient; set `onExpeditionCollectResult` to call `BuildingPanel.showCollectResult(result)` and update panel to idle state; set `onExpeditionCollectRejected` to call `BuildingPanel.showCollectRejection(reason)`

**Checkpoint**: Full passive loop works: configure → dispatch → wait → notify → collect → idle.

---

## Phase 7: User Story 5 — Admin Edits Expedition Config (Priority: P3)

**Goal**: An admin can update the reward configuration for an existing expedition action
on a building.

**Independent Test**: PUT an expedition action with updated `base_gold` and `items`; GET
the building's actions and verify the updated values are reflected.

### Implementation for User Story 5

- [x] T025 [US5] Extend `PUT /:id/buildings/:buildingId/actions/:actionId` in `admin/backend/src/routes/buildings.ts` — when the action being updated has `action_type === 'expedition'`, validate the incoming expedition config (same rules as POST: base_gold ≥ 0, base_exp ≥ 0, items with valid item_def_ids and base_quantity ≥ 1); call `updateBuildingAction` with the new config; log `expedition_action_updated` event
- [x] T026 [US5] Pre-populate expedition form on edit in `admin/frontend/src/ui/properties.ts` — when rendering the edit form for an existing action with `action_type === 'expedition'`, read `config.base_gold`, `config.base_exp`, `config.items` from the action record and fill the form fields; render existing item rows in the items table with correct item_def_id selections and base_quantity values

**Checkpoint**: Admin can update expedition rewards — changes reflected on next player dispatch.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T027 [P] Verify all structured log events — search `backend/src/game/expedition/` and related changed files for `log(` calls and confirm every expedition event emits: `expedition.dispatched`, `expedition.collected`, `expedition.notify_on_connect`, `squire.created` with consistent field sets (character_id, squire_id, expedition_id, building_id)
- [x] T028 Run end-to-end validation from `specs/009-squire-expeditions/quickstart.md` — complete the 7-step test flow (admin configure → dispatch → force-expire → reconnect → notify → collect) and confirm all acceptance scenarios from spec.md pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — admin path only; independent of US2–US5
- **US2 (Phase 4)**: Depends on Foundational — core player dispatch loop
- **US3 (Phase 5)**: Depends on US2 (expedition rows must exist to notify)
- **US4 (Phase 6)**: Depends on US2 (collect presupposes a completed expedition)
- **US5 (Phase 7)**: Depends on US1 (editing an expedition action that already exists)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational — admin backend + frontend only
- **US2 (P1)**: Independent after Foundational — game backend + frontend dispatch loop
- **US3 (P2)**: Depends on US2 (expedition rows must be created first)
- **US4 (P2)**: Depends on US2 (expedition rows must be created first); can run in parallel with US3
- **US5 (P3)**: Depends on US1 (editing requires the PUT endpoint + form from US1)

### Within Each User Story

- DB queries (T003) and protocol types (T004) before any handler code
- Backend service before handler (T007 before T008)
- Handler before registration (T008 before T010)
- Backend complete before frontend handlers (T014 after T009–T010)

### Parallel Opportunities

- T003 and T004 (Foundational) can run in parallel — different files
- T005 and T006 (US1 admin backend vs frontend) can run in parallel — different packages
- T009 and T014 (validator + WS handler) can run in parallel — different files
- T017 and T018 (US3 WS handler + scene wiring) can run after T016 in parallel
- T020 and T023 (US4 validator + WS handlers) can run in parallel — different files
- US1 and US2 can be worked in parallel once Foundational is complete

---

## Parallel Example: User Story 2

```bash
# After T007 (expedition-service.ts) is done, these can run in parallel:
Task T008: Write handleExpeditionDispatch in expedition-handler.ts
Task T009: Add expedition.dispatch schema to validator.ts
Task T011: Update character-create-handler.ts for squire creation

# After T008–T011 are done:
Task T013: Add expedition UI to BuildingPanel.ts
Task T014: Add WS handlers in WSClient.ts
# Then:
Task T015: Wire in GameScene.ts (depends on T013 + T014)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T004)
3. Complete Phase 3: US1 — Admin configure (T005–T006)
4. Complete Phase 4: US2 — Player dispatch (T007–T015)
5. **STOP and VALIDATE**: Admin configures expedition → player dispatches squire → squire shows as exploring
6. Demo this loop before implementing notifications and collect

### Incremental Delivery

1. Setup + Foundational → schema and types in place
2. US1 → Admin can configure expeditions
3. US2 → Player can dispatch squires (MVP complete)
4. US3 → Players receive notifications on reconnect
5. US4 → Players can collect rewards (full passive loop complete)
6. US5 → Admin can edit expedition configs (operational polish)

### Parallel Team Strategy

With two developers after Foundational:
- **Dev A**: US1 (T005–T006) then US5 (T025–T026) — admin track
- **Dev B**: US2 (T007–T015) then US3 (T016–T018) then US4 (T019–T024) — player track

---

## Notes

- `[P]` tasks touch different files with no incomplete-task dependencies
- `[Story]` label enables traceability from task back to spec user story
- No test tasks generated — not requested in spec; validate manually per quickstart.md
- Characters created before this migration need a manual squire seed (see quickstart.md)
- The `gold` field on characters: check whether it exists in the existing schema; if not, add it as part of T002's migration or T019's handler (using a separate migration 013 if needed)
- Commit after each checkpoint to enable rollback at story boundaries
