# Tasks: Fishing System

**Input**: Design documents from `/specs/024-fishing-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/fishing-protocol.md, quickstart.md

**Tests**: Not explicitly requested — manual integration testing via game client per quickstart.md.

**Organization**: Tasks grouped by user story. US6 (Anti-Bot) is merged into US1 (Basic Fishing Loop) as they are inseparable per spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create directory structure for new fishing module

- [x] T001 Create directory structure: `backend/src/game/fishing/`, `backend/src/db/queries/fishing.ts`, `admin/backend/src/routes/fishing.ts`, `admin/frontend/src/ui/fishing-manager.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migration and shared protocol types that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create database migration `backend/src/db/migrations/026_fishing_system.sql` — new tables (`fishing_loot`, `fishing_rod_tiers`), ALTER `characters` to add `rod_upgrade_points INTEGER DEFAULT 0`, extend CHECK constraints on `item_definitions.category` (+ring, +amulet), `item_definitions.tool_type` (+fishing_rod), `inventory_items.equipped_slot` (+ring, +amulet), `building_actions.action_type` (+fishing). Include INSERT seed data for all item definitions (5 rods, 12 fish, 4 rings, 4 amulets per data-model.md) and fishing_rod_tiers reference data. Include INSERT seed data for fishing_loot table entries with drop_weight values per data-model.md (fish weights 3-40, ring/amulet weights 1-3).
- [x] T003 Extend shared protocol types in `shared/protocol/index.ts` — add `'ring'` and `'amulet'` to `ItemCategory` and `EquipSlot` types; add `ring: InventorySlotDto | null` and `amulet: InventorySlotDto | null` fields to `EquipmentSlotsDto`; add `'rod_upgrade_points'` to `RewardType`; add `FishingBuildingActionDto` interface and include it in `BuildingActionDto` union; add `CityBuildingActionPayload.action_type` to include `'fishing'`; add all fishing message payload interfaces per contracts/fishing-protocol.md (`FishingCastPayload`, `FishingCompletePayload`, `FishingCancelPayload`, `FishingSessionStartPayload`, `PullPatternDto`, `PullSegmentDto`, `CatchWindowDto`, `FishingResultPayload`, `FishingLootDto`, `FishingRejectedPayload`, `FishingRejectionReason`, `FishingUpgradeRodPayload`, `FishingUpgradeResultPayload`, `FishingRepairRodPayload`, `FishingRepairResultPayload`)

**Checkpoint**: Database schema and shared types ready — user story implementation can begin

---

## Phase 3: User Story 1 + 6 — Basic Fishing Loop + Anti-Bot (Priority: P1) MVP

**Goal**: Player can equip a rod, visit a fishing spot, play the tension-meter mini-game, and receive fish loot. Anti-bot measures (randomized timing, snap checks, varied patterns) are built into the mini-game from the start.

**Independent Test**: Equip T1 rod → visit fishing spot → complete mini-game → receive fish. Fail mini-game → no loot, durability consumed. Rod at 1 durability → fishing blocked.

### Implementation

- [x] T004 [P] [US1] Implement fishing DB queries in `backend/src/db/queries/fishing.ts` — functions: `getFishingLootByTier(rodTier: number)` returns all fishing_loot entries where `min_rod_tier <= rodTier` with joined item_definitions; `getRodTierByItemDefId(itemDefId: number)` returns fishing_rod_tiers row; `getNextRodTier(currentTier: number)` returns next tier row or null; `getRodUpgradePoints(characterId: string)` returns current points; `updateRodUpgradePoints(characterId: string, delta: number)` adds/subtracts points
- [x] T005 [P] [US1] Implement fishing loot service in `backend/src/game/fishing/fishing-loot-service.ts` — function `resolveFishingLoot(rodTier: number)` queries fishing_loot filtered by tier, performs weighted random selection using `drop_weight`, returns the selected item_def_id and item details. Log selected fish with structured logging.
- [x] T006 [US1] Implement fishing session service in `backend/src/game/fishing/fishing-service.ts` — in-memory `Map<string, FishingSession>` keyed by characterId. Functions: `startSession(characterId, rodTier, rodSlotId)` picks fish via loot service, generates randomized bite delay (2000-8000ms), generates pull pattern with segments based on fish type (aggressive/erratic/steady), computes catch window, stores session, returns FishingSessionStartPayload. `completeSession(characterId, payload)` validates session exists and not expired, validates timing data against pull pattern and catch window, runs anti-bot snap check (track last 10 cast timing profiles per character, flag if stddev of reaction times < threshold), determines success/failure, on success grants loot via inventory-grant-service, consumes 1 rod durability via updateToolDurability, cleans up session, returns FishingResultPayload. `cancelSession(characterId)` consumes durability and cleans up. `cleanupOnDisconnect(characterId)` handles mid-session disconnects. Log all casts, snap check triggers, loot grants, and failures with structured logging.
- [x] T007 [US1] Implement fishing WebSocket handler in `backend/src/game/fishing/fishing-handler.ts` — register handlers for `fishing.cast`, `fishing.complete`, `fishing.cancel`. For `fishing.cast`: validate character exists, not in combat (`in_combat` check), not gathering (`in_gathering` check), not already fishing (session exists check), at building with fishing action, has fishing rod equipped (check equipped items for tool_type 'fishing_rod'), rod durability > 1; on validation failure send `fishing.rejected` with appropriate reason; on success call fishing service startSession and send `fishing.session_start`. For `fishing.complete`: validate session exists and matches session_id, call service completeSession, send `fishing.result`. For `fishing.cancel`: validate session, call service cancelSession. Register all handlers in the dispatcher at server startup.
- [x] T008 [US1] Add `'fishing'` case to building action dispatch in `backend/src/game/world/building-action-handler.ts` — in the action_type switch, add case `'fishing'` that sends a `fishing.spot_available` acknowledgment or delegates to the fishing handler (client initiates cast separately after seeing the fishing action in the building's action list)
- [x] T009 [US1] Implement frontend fishing mini-game UI in `frontend/src/ui/fishing-minigame.ts` — class `FishingMinigame` renders as an overlay/modal in the game scene. On receiving `fishing.session_start`: show "Waiting for bite..." with countdown, after bite_delay_ms show tension meter bar with green zone (width from `pull_pattern.green_zone_width`). Animate a cursor moving along the meter according to pull_pattern segments (speed, direction, pauses). Player clicks/taps to counteract pull — record each input timestamp (ms offset from session start). When catch_window arrives, highlight reel-in button — record reel_timestamp on click. On completion (success or timeout), send `fishing.complete` with all collected timestamps. On receiving `fishing.result`: show success animation with fish name/icon and loot, or failure animation. On `fishing.rejected`: show rejection message. Handle `fishing.cancel` for cleanup.
- [x] T010 [US1] Register fishing message handlers in frontend `frontend/src/network/WSClient.ts` or the scene's message handler — listen for `fishing.session_start`, `fishing.result`, `fishing.rejected` and route to FishingMinigame instance. Send `fishing.cast` when player activates a fishing building action. Send `fishing.complete` and `fishing.cancel` from FishingMinigame.
- [ ] T011 [US1] Create Fisherman NPC and fishing building actions via admin API or migration INSERT — create NPC named "Fisherman" with `is_quest_giver: true` via admin API at `POST /api/npcs`. Assign NPC to at least 1 water building via `POST /api/npcs/:id/buildings`. Add `action_type: 'fishing'` building actions to 3+ water-adjacent buildings via admin API or direct INSERT into building_actions table with config `{}`.

**Checkpoint**: Core fishing loop fully functional — player can fish, play mini-game, receive loot, durability decrements, anti-bot snap checks active

---

## Phase 4: User Story 2 — Rod Progression & Upgrades (Priority: P2)

**Goal**: Player can accumulate Rod Upgrade Points and upgrade their rod from T1 through T5 at the Fisherman NPC, unlocking broader loot pools and higher durability.

**Independent Test**: Give player upgrade points via DB → upgrade rod at Fisherman → rod transforms in-place with new tier stats.

**Dependencies**: Requires Phase 3 (US1) complete for fishing rods and Fisherman NPC to exist.

### Implementation

- [x] T012 [US2] Implement rod upgrade service in `backend/src/game/fishing/fishing-upgrade-service.ts` — function `upgradeRod(characterId, npcId)`: validate character is at NPC building, get currently equipped fishing rod's item_def_id, look up current tier via `getRodTierByItemDefId`, get next tier via `getNextRodTier`, check character has enough rod_upgrade_points (from `getRodUpgradePoints`) and required resources (query inventory for resource items — use upgrade costs from fishing_rod_tiers or hardcoded per-tier resource requirements matching concept doc: T2=10 Linen, T3=15 Iron Bars, T4=10 Steel Ingots + 5 Silk, T5=quest chain), deduct points via `updateRodUpgradePoints`, consume resources from inventory, UPDATE the inventory_items row to change `item_def_id` to next tier's rod definition and set `current_durability` to new tier's max_durability. Return `FishingUpgradeResultPayload`. Log all upgrades with structured logging.
- [x] T013 [US2] Add upgrade/repair handler registration in `backend/src/game/fishing/fishing-handler.ts` — register handlers for `fishing.upgrade_rod` and `fishing.repair_rod` (repair implementation in US5, but register both message types now). For `fishing.upgrade_rod`: validate character at NPC, call upgrade service, send `fishing.upgrade_result`. Send `equipment.changed` with updated equipment slots after upgrade so frontend reflects new rod stats.
- [x] T014 [US2] Implement frontend rod upgrade UI — when player interacts with Fisherman NPC, show upgrade option with current tier, next tier stats, point cost, resource requirements, and current balances. On confirm, send `fishing.upgrade_rod`. On receiving `fishing.upgrade_result`: show success/failure message, update equipment display. Integrate into existing NPC interaction panel or create a dedicated fishing upgrade panel in `frontend/src/ui/`.

**Checkpoint**: Rod progression fully functional — players can upgrade rods through tiers

---

## Phase 5: User Story 3 — Daily Fishing Quests (Priority: P2)

**Goal**: Fisherman NPC offers 2 random daily quests requiring specific fish catches. Completing quests awards Rod Upgrade Points and Crowns.

**Independent Test**: Accept daily quest from Fisherman → catch required fish → quest progress updates → turn in → receive rod upgrade points + crowns.

**Dependencies**: Requires Phase 3 (US1) for fish items to exist and Fisherman NPC. Requires Phase 4 (US2) for rod_upgrade_points tracking.

### Implementation

- [x] T015 [US3] Add `'rod_upgrade_points'` reward handling in `backend/src/game/quest/quest-service.ts` — in `grantQuestRewards()` function, add case for `'rod_upgrade_points'` reward type that calls `updateRodUpgradePoints(characterId, quantity)` from `backend/src/db/queries/fishing.ts`. Return the points amount in the reward DTO. Update `resolveRewardTarget()` if needed (rod_upgrade_points has no target_id, similar to crowns/xp).
- [ ] T016 [US3] Create daily fishing quest definitions via admin API or migration INSERT — create 4+ quest_definitions with `quest_type: 'daily'`, `is_active: true`. Each quest has 1 objective of type `'collect_item'` targeting a specific fish item_def_id with target_quantity (e.g., "Catch 5 Mudfish", "Catch 3 Silverscale Trout", "Catch 1 Golden Carp", "Catch 2 Ashfin Eels"). Each quest has 2 rewards: `'rod_upgrade_points'` (10/20/35/30 per concept doc) and `'crowns'` (5/10/20/15). Link quests to Fisherman NPC via `quest_npc_givers`. Ensure quest prerequisites filter by rod tier where appropriate (higher-tier fish quests require having caught/having access to those fish — use `'has_item'` prereq for the rod tier or leave prereqs empty and rely on FR-009 quest filtering).
- [x] T017 [US3] Implement daily quest filtering logic — ensure that when the Fisherman NPC's quest list is requested, only 2 quests are randomly selected from the eligible pool (quests whose fish targets are catchable with the player's current rod tier). This may require a custom filter in the quest handler or a new query in `backend/src/db/queries/fishing.ts` that checks the player's equipped rod tier against the fish's min_rod_tier in fishing_loot. Override or extend `handleQuestListAvailable` in `backend/src/game/quest/quest-handler.ts` to apply this filter for fishing daily quests before returning the available list.

**Checkpoint**: Daily quest loop functional — players earn upgrade points through daily engagement

---

## Phase 6: User Story 4 — Ring & Amulet Equipment (Priority: P3)

**Goal**: Players can equip rings and amulets into two new equipment slots, with stats applied to combat.

**Independent Test**: Obtain ring/amulet item → equip to ring/amulet slot → stats visible in equipment → stats applied in combat.

**Dependencies**: Requires Phase 2 (foundational migration adds ring/amulet categories and slots). Independent of fishing — can be tested with admin-granted items.

### Implementation

- [x] T018 [P] [US4] Update equipment handler in `backend/src/game/equipment/equipment-handler.ts` — add `'ring'` and `'amulet'` to `VALID_SLOTS` array. Add entries to `SLOT_CATEGORY_MAP`: `ring: ['ring']`, `amulet: ['amulet']`.
- [x] T019 [P] [US4] Update equipment state handler in `backend/src/websocket/handlers/equipment-state-handler.ts` — ensure the `buildEquipmentSlots()` function (or equivalent) includes `ring` and `amulet` fields when building the `EquipmentSlotsDto` response. Query inventory_items for `equipped_slot = 'ring'` and `equipped_slot = 'amulet'`.
- [x] T020 [US4] Update frontend equipment panel to render ring and amulet slots — add two new slot positions in the equipment UI. Display equipped ring/amulet with icon and stats. Allow equip/unequip via existing equipment interaction pattern. Show stat tooltips matching existing equipment slot styling.
- [x] T021 [US4] Add ring/amulet fishing loot entries to `fishing_loot` table if not already in migration seed data — ensure 4 rings and 4 amulets are in the fishing_loot table with appropriate min_rod_tier (T2-T5) and low drop_weight values (1-3) per data-model.md. Verify via admin or direct query.

**Checkpoint**: Ring and amulet slots functional — stats apply to combat via existing computeCombatStats aggregation

---

## Phase 7: User Story 5 — Rod Repair (Priority: P3)

**Goal**: Player can repair a locked rod (1 durability) at the Fisherman NPC by paying Crowns and resources.

**Independent Test**: Deplete rod to 1 durability → fishing blocked → repair at Fisherman → rod restored to full durability, crowns deducted.

**Dependencies**: Requires Phase 3 (US1) for fishing rods and durability system.

### Implementation

- [x] T022 [US5] Implement rod repair logic in `backend/src/game/fishing/fishing-upgrade-service.ts` — function `repairRod(characterId, npcId)`: validate character at NPC building, get equipped fishing rod, check `current_durability === 1` (rod must be locked), look up tier to determine repair cost (scale crowns by tier: e.g., T1=10, T2=25, T3=50, T4=100, T5=200 crowns + small resource cost), validate character has enough crowns via existing crown service, deduct crowns, deduct resources if any, UPDATE inventory_items to set `current_durability = max_durability` (from fishing_rod_tiers). Return `FishingRepairResultPayload`. Log repairs with structured logging.
- [x] T023 [US5] Wire repair handler in `backend/src/game/fishing/fishing-handler.ts` — implement the `fishing.repair_rod` handler (message type registered in T013). Validate character at Fisherman NPC, call repair service, send `fishing.repair_result`. Send `equipment.changed` with updated equipment slots after repair.
- [x] T024 [US5] Implement frontend repair UI — when player interacts with Fisherman NPC and has a locked rod, show repair option with cost breakdown (crowns + resources). On confirm, send `fishing.repair_rod`. On receiving `fishing.repair_result`: show success/failure, update rod durability display.

**Checkpoint**: Rod repair cycle complete — crown sink functioning as economy drain

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Admin tooling, frontend polish, and integration quality

- [x] T025 [P] Implement admin CRUD routes for fishing loot in `admin/backend/src/routes/fishing.ts` — GET `/api/fishing-loot` (list all entries with item names), POST `/api/fishing-loot` (create entry with min_rod_tier, item_def_id, drop_weight), PUT `/api/fishing-loot/:id` (update weight/tier), DELETE `/api/fishing-loot/:id`. GET `/api/fishing-rod-tiers` (list tier definitions).
- [x] T026 [P] Implement admin fishing loot manager UI in `admin/frontend/src/ui/fishing-manager.ts` — table view of fishing_loot entries showing item name, min_rod_tier, drop_weight. Add/edit/delete controls. Fishing rod tiers read-only display.
- [x] T027 [P] Add frontend fishing spot indicators — show fishing icon or visual indicator on buildings that have fishing actions in the game map. Display rod durability in the equipment panel or as a tooltip on the equipped rod.
- [ ] T028 Run quickstart.md testing checklist — verify all 12 test scenarios pass end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1+US6 (Phase 3)**: Depends on Phase 2 — MVP delivery
- **US2 (Phase 4)**: Depends on Phase 3 (needs rods, Fisherman NPC, fishing to exist)
- **US3 (Phase 5)**: Depends on Phase 3 + Phase 4 (needs fishing + rod_upgrade_points tracking)
- **US4 (Phase 6)**: Depends on Phase 2 ONLY — can run in parallel with Phase 3
- **US5 (Phase 7)**: Depends on Phase 3 (needs rods and durability system)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

```
Phase 2 (Foundation)
  ├── US1+US6 (Phase 3) ─── MVP
  │     ├── US2 (Phase 4)
  │     │     └── US3 (Phase 5)
  │     └── US5 (Phase 7)
  └── US4 (Phase 6) ──── can run in parallel with US1
```

### Parallel Opportunities

Within each phase, tasks marked [P] can run concurrently:
- **Phase 3**: T004 and T005 (DB queries and loot service) are parallel
- **Phase 6**: T018 and T019 (equipment handler and state handler) are parallel
- **Phase 8**: T025, T026, and T027 are all parallel

Cross-phase parallelism:
- **US4 (Phase 6)** can run in parallel with **US1 (Phase 3)** since US4 only depends on the foundational migration, not on fishing logic

---

## Parallel Example: Phase 3 (US1)

```bash
# Launch parallel DB + loot service tasks:
Task T004: "Fishing DB queries in backend/src/db/queries/fishing.ts"
Task T005: "Fishing loot service in backend/src/game/fishing/fishing-loot-service.ts"

# Then sequential (depends on T004+T005):
Task T006: "Fishing session service" (uses loot service + DB queries)
Task T007: "Fishing WS handler" (uses session service)
Task T008: "Building action dispatch" (wires handler into existing system)

# Frontend can start after T007 defines the message contract:
Task T009: "Frontend mini-game UI"
Task T010: "Frontend message handler registration"

# Content seeding can run after handler is ready:
Task T011: "NPC + building action creation"
```

---

## Implementation Strategy

### MVP First (US1 + US6 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation (migration + protocol types)
3. Complete Phase 3: US1 + US6 (core fishing loop + anti-bot)
4. **STOP and VALIDATE**: Fish at a spot, play mini-game, receive loot, verify anti-bot
5. Deploy/demo — fishing is playable

### Incremental Delivery

1. Foundation → US1+US6 → **Fishing is playable** (MVP)
2. + US4 → **Rings/amulets equippable** (adds loot value)
3. + US2 → **Rod upgrades work** (adds progression)
4. + US3 → **Daily quests available** (adds daily engagement loop)
5. + US5 → **Rod repair works** (adds economy sink)
6. + Polish → **Admin tools, visual polish** (production ready)

---

## Notes

- US6 (Anti-Bot) is merged into US1 since anti-bot measures are inseparable from the mini-game implementation
- US4 (Ring & Amulet) is independent of fishing and can be developed in parallel with US1 after the foundational phase
- Rod upgrade resource costs (Linen, Iron Bars, etc.) reference existing items — verify item_def_ids exist before creating upgrade requirements
- The `collect_item` quest objective type already triggers via QuestTracker.onInventoryChanged, so fishing quest progress will update automatically when fish enter inventory
- Combat stat aggregation in `computeCombatStats` is generic — ring/amulet stats work automatically once equipped_slot values are valid
