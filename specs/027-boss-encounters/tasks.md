# Tasks: Boss Encounter System

**Input**: Design documents from `/specs/027-boss-encounters/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/boss-messages.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted. Manual testing via game client + admin panel.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database migration and shared protocol types — foundational schema and types all stories depend on.

- [X] T001 Create database migration `backend/src/db/migrations/029_boss_system.sql` with tables: `bosses` (id, name, description, icon_filename, sprite_filename, max_hp, attack, defense, xp_reward, min_crowns, max_crowns, building_id UNIQUE, respawn_min_seconds, respawn_max_seconds, is_active, created_at), `boss_abilities` (id, boss_id FK, ability_id FK, priority, UNIQUE(boss_id, ability_id)), `boss_loot` (id, boss_id FK, item_def_id FK, drop_chance, quantity), `boss_instances` (id, boss_id FK, current_hp, status CHECK('alive','in_combat','defeated'), fighting_character_id FK nullable, total_attempts, spawned_at, defeated_at nullable, respawn_at nullable). Add indexes on boss_id FKs and building_id.
- [X] T002 Add boss shared protocol types in `shared/protocol/index.ts`: BossHpBracket type ('full'|'high'|'medium'|'low'|'critical'), BossDto interface (id, name, description, icon_url, sprite_url, building_id, status, fighting_character_name, total_attempts, respawn_at), BossCombatStartPayload (combat_id, boss object with id/name/icon_url/attack/defense/hp_bracket/abilities array, player as PlayerCombatStateDto, loadout, turn_timer_ms), BossCombatTurnResultPayload (combat_id, turn, phase, events as CombatEventDto[], player_hp, player_mana, enemy_hp_bracket as BossHpBracket, ability_states), BossCombatEndPayload (combat_id, outcome, current_hp, boss_name, boss_icon_url, enemy_hp_bracket, xp_gained, crowns_gained, items_dropped), BossStatePayload (boss_id, building_id, status, fighting_character_name, total_attempts, respawn_at), BossChallengeRejectedPayload (reason, message, respawn_at optional). Add all boss message types to server/client message unions.
- [X] T003 Create boss DB query module `backend/src/db/queries/bosses.ts` with typed interfaces and functions: `getBossById(id)`, `getAllBosses()`, `getBossForBuilding(buildingId)`, `createBoss(data)`, `updateBoss(id, data)`, `deleteBoss(id)`, `getBossAbilities(bossId)`, `addBossAbility(bossId, abilityId, priority)`, `removeBossAbility(bossId, abilityId)`, `getBossLoot(bossId)`, `addBossLoot(bossId, itemDefId, dropChance, quantity)`, `removeBossLoot(lootId)`, `getBossInstance(bossId)`, `getAllBossInstances()`, `createBossInstance(bossId, maxHp)`, `updateBossInstanceHp(instanceId, hp)`, `lockBossInstance(instanceId, characterId)` (atomic: UPDATE WHERE status='alive' RETURNING), `unlockBossInstance(instanceId)`, `defeatBossInstance(instanceId, respawnAt)`, `getDefeatedInstancesReadyToRespawn()`, `deleteBossInstance(bossId)`.

**Checkpoint**: Migration applied, types compiled, query module importable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Boss instance manager and building blocking — the two backend services all user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Implement boss instance manager `backend/src/game/boss/boss-instance-manager.ts`: Singleton class that on init loads all active boss definitions and their instances from DB. Manages in-memory `Map<number, { bossId, instanceId, currentHp, maxHp, status, fightingCharacterId, buildingId }>`. Methods: `initialize()` (load from DB on server start), `isBossBlocking(buildingId): boolean` (returns true if alive or in_combat instance exists for that building), `getBossesForZone(zoneId): BossDto[]` (returns boss DTOs for zone state), `challengeBoss(bossId, characterId): { success, reason? }` (atomic lock via DB transaction, consumes token, returns combat data), `updateBossHp(bossId, hp)` (update in-memory + persist to DB), `defeatBoss(bossId)` (calculate random respawn_at, update instance, broadcast), `releaseBoss(bossId)` (unlock after player loss/disconnect, keep HP), `checkRespawns()` (called every 30s, respawn defeated instances past respawn_at), `broadcastBossState(bossId, zoneId)` (send boss:state to all zone sessions). Import and use boss DB queries.
- [X] T005 Add building action blocking in `backend/src/game/world/building-action-handler.ts`: After the existing action validation (line ~82, after building and action are fetched), add a guard check: import bossInstanceManager, call `isBossBlocking(building.id)`. If blocked, send rejection message `city.building_action_rejected` with reason "A powerful guardian blocks this building. Defeat the boss to gain access." and return early. This must run before all action_type branching so it blocks explore, gather, expedition, marketplace, fishing, and crafting_station uniformly.
- [X] T006 Wire boss instance manager into server startup in `backend/src/game/server.ts` (or main entry): Import BossInstanceManager, call `await bossInstanceManager.initialize()` after DB connection is ready. Set up `setInterval(() => bossInstanceManager.checkRespawns(), 30000)` for respawn timer polling. Register cleanup on server shutdown.
- [X] T007 Include boss data in zone state: In the handler that sends world/zone state to players on zone entry (likely `backend/src/game/world/city-map-loader.ts` or the world state sender), call `bossInstanceManager.getBossesForZone(zoneId)` and include the resulting `BossDto[]` array in the zone state payload. Update the zone state payload type in `shared/protocol/index.ts` to include optional `bosses: BossDto[]` field.

**Checkpoint**: Server starts with boss instance manager, building actions blocked when a boss exists, zone state includes boss data.

---

## Phase 3: User Story 1 — Boss Blocks Building Access (Priority: P1) MVP

**Goal**: Buildings with active bosses reject all player actions with a clear message.

**Independent Test**: Create a boss via direct DB insert assigned to Forgotten Mines (building 12). Try to explore — should be blocked. Delete the boss instance — explore should work.

- [ ] T008 [US1] Verify building blocking end-to-end (manual test — requires running server): Run the migration, insert a test boss row into `bosses` (building_id=12, is_active=true) and a `boss_instances` row (status='alive', current_hp=1000). Start the server. Navigate to Forgotten Mines in the game client and attempt to explore. Confirm the action is rejected with the guardian message. Delete the instance row, retry — confirm explore works. Fix any issues found.

**Checkpoint**: US1 complete — buildings are blocked by bosses. MVP functional.

---

## Phase 4: User Story 2 — Player Challenges a Boss (Priority: P1)

**Goal**: Players with a Boss Challenge Token can initiate combat. Token consumed, boss locked, combat starts.

**Independent Test**: Give player a Boss Challenge Token. Challenge the boss. Verify token consumed, boss status changes, combat screen appears.

- [X] T009 [US2] Implement boss challenge WebSocket handler in `backend/src/game/boss/boss-combat-handler.ts`: Register handler for `boss:challenge` message. Validate: character not in combat/gathering, boss exists and has alive instance, player has Boss Challenge Token (query inventory for item by name "Boss Challenge Token"). Call `bossInstanceManager.challengeBoss(bossId, characterId)` for atomic lock. On success: consume 1 token from inventory (use existing `removeItemFromCharacter` or equivalent), load boss abilities from `getBossAbilities(bossId)`, compute player combat stats (reuse `computeCombatStats`), load player loadout (reuse `getCharacterLoadout`), create boss combat session. On failure: send `boss:challenge_rejected` with appropriate reason. Broadcast `boss:state` to zone.
- [X] T010 [US2] Implement boss combat session logic in `backend/src/game/boss/boss-combat-handler.ts` (or separate file `boss-combat-session.ts`): Reuse `CombatEngine` from `combat-engine.ts` for turn resolution. Turn loop: same as regular combat (player auto-attack, auto abilities, active window, enemy turn) but: enemy turn fires boss abilities by priority (iterate boss abilities sorted by priority desc, fire first one off cooldown — bosses have unlimited mana so skip mana check), send `boss:combat_turn_result` with `enemy_hp_bracket` instead of exact HP (compute bracket from currentHp/maxHp: >0.8='full', >0.6='high', >0.4='medium', >0.2='low', else 'critical'). After each turn: call `bossInstanceManager.updateBossHp(bossId, currentHp)` to persist. On player win: award XP via `awardXp`, roll crowns via existing pattern, roll loot from `getBossLoot(bossId)`, grant items, send `boss:combat_end` with outcome='win', call `bossInstanceManager.defeatBoss(bossId)`. On player loss: send `boss:combat_end` with outcome='loss' and enemy_hp_bracket hint, call `bossInstanceManager.releaseBoss(bossId)`. On disconnect: treat as loss.
- [X] T011 [US2] Wire boss challenge handler into the WebSocket message router in `backend/src/game/server.ts` (or message dispatcher): Add case for `boss:challenge` message type routing to the boss challenge handler. Add case for `boss:combat_trigger_active` routing to the active boss combat session for that character.

**Checkpoint**: US2 complete — players can challenge bosses, token consumed, combat starts and resolves.

---

## Phase 5: User Story 3 — Boss Combat with Hidden HP and Abilities (Priority: P1)

**Goal**: Boss combat UI shows bracket HP indicator instead of numbers, and boss ability events appear in combat log.

**Independent Test**: Start a boss fight, verify HP bar shows color-coded bracket segments without numbers. Verify boss fires abilities shown in the combat log.

- [X] T012 [US3] Modify `frontend/src/ui/CombatScreen.ts` to support boss combat variant: Add a `variant: 'normal' | 'boss'` field set based on whether the combat was started by `boss:combat_start` vs `combat:start`. When variant is 'boss': replace the enemy HP bar (currently shows "123/456 HP") with a 5-segment bracket indicator (5 colored rectangles: green=full, green=high, yellow=medium, orange=low, red=critical — fill segments based on `enemy_hp_bracket` value). Hide exact HP text. Show boss name with larger/special styling. Boss ability events in the combat log should display the ability name.
- [X] T013 [US3] Add boss combat message handlers in `frontend/src/scenes/GameScene.ts` (or wherever WS messages are dispatched): Register handlers for `boss:combat_start`, `boss:combat_turn_result`, `boss:combat_active_window`, `boss:combat_end`. For `boss:combat_start`: open CombatScreen with variant='boss', pass boss data. For turn results and active window: forward to CombatScreen (same as regular combat but with bracket HP). For `boss:combat_end`: show victory/defeat screen with boss-specific presentation (on loss, show "The guardian stands firm. It appears [bracket] wounded.").
- [X] T014 [US3] Add `boss:challenge_rejected` message handler in frontend: Display rejection reason as a notification/toast message (reuse existing chat or notification system). Show specific messages for each reason (no_token, in_combat, defeated with respawn time, inactive).

**Checkpoint**: US3 complete — boss combat feels distinct with hidden HP and abilities.

---

## Phase 6: User Story 4 — Boss Persistent HP Across Fights (Priority: P2)

**Goal**: Boss HP carries over between fights. Next challenger faces a weakened boss. HP resets only on respawn.

**Independent Test**: Fight a boss, deal damage, lose. Have another character challenge — verify boss starts with reduced HP bracket.

- [ ] T015 [US4] Verify persistent HP works end-to-end: This functionality should already be implemented in T004 (bossInstanceManager.updateBossHp persists to DB) and T010 (combat handler calls updateBossHp after each turn, releaseBoss keeps HP on loss). Test by: fighting a boss as Player A, losing, then challenging as Player B — boss should start at reduced HP bracket. Also test server restart: stop server, restart, verify boss instance resumes at persisted HP. Fix any issues found.

**Checkpoint**: US4 complete — persistent HP verified.

---

## Phase 7: User Story 5 — Boss Visible on Map (Priority: P2)

**Goal**: Boss sprites appear on the zone map at building positions. Clicking opens an info panel.

**Independent Test**: Enter a zone with a boss, verify sprite appears near the building. Click it, verify info panel opens.

- [X] T016 [P] [US5] Create `frontend/src/entities/BossSprite.ts`: A Phaser Container that renders the boss sprite image (loaded from sprite_url) at given map coordinates. Include a pulsing glow effect (tween alpha on a circle graphic behind the sprite) to make bosses visually distinct from buildings. Add name label below sprite. Set interactive for click handling. Provide methods: `updateStatus(status)` (change visual state — e.g., dim when in_combat, hide when defeated), `destroy()`.
- [X] T017 [P] [US5] Create `frontend/src/ui/BossInfoPanel.ts`: HTML panel (similar pattern to BuildingPanel) showing: boss name (large, styled), description text, status line ("Guarding [Building]" / "In Combat with [Name]" / "Defeated — respawns in X:XX"), total attempts counter, Challenge button (enabled only when status='alive' and player has Boss Challenge Token — check inventory from local state). Challenge button sends `boss:challenge` message. Panel includes token count display. Provide methods: `show(bossDto, playerTokenCount)`, `hide()`, `updateStatus(bossDto)`.
- [X] T018 [US5] Integrate boss rendering into `frontend/src/scenes/GameScene.ts`: After zone state is loaded (and bosses array is available), create BossSprite instances for each boss with status 'alive' or 'in_combat'. Position at the building's node coordinates (look up building by building_id, get its node position). Store in a `Map<number, BossSprite>` for updates. On boss sprite click: open BossInfoPanel with boss data. On `boss:state` message: update or create/remove BossSprite as needed (alive → show, defeated → hide with respawn timer, in_combat → dim/update). On BossInfoPanel "Challenge" click: send `boss:challenge` WS message.

**Checkpoint**: US5 complete — bosses visible on map, clickable info panel.

---

## Phase 8: User Story 6 — Boss Respawn Cycle (Priority: P2)

**Goal**: Defeated bosses respawn after configurable timer, return to full HP, resume blocking building.

**Independent Test**: Defeat a boss. Wait for respawn timer (set short for testing, e.g., 60s). Verify boss respawns, building blocked again, sprite appears.

- [ ] T019 [US6] Verify respawn cycle works end-to-end: This functionality should already be implemented in T004 (bossInstanceManager.checkRespawns runs every 30s, creates new instance at full HP) and T006 (setInterval wired on startup). Test by: creating a boss with respawn_min_seconds=60 and respawn_max_seconds=120 via admin API or direct DB. Defeat the boss. Verify defeated status and respawn_at timestamp. Wait for respawn. Verify new instance at full HP, building blocked again, boss:state broadcast received by clients. Fix any issues found.

**Checkpoint**: US6 complete — respawn cycle verified.

---

## Phase 9: User Story 7 — Admin Creates and Manages Bosses (Priority: P2)

**Goal**: Full admin CRUD for bosses: definitions, abilities, loot, icons/sprites, instance monitoring, force respawn.

**Independent Test**: Open admin panel, create a boss, assign abilities and loot, assign to building, upload icon. Verify boss appears in game.

- [X] T020 [P] [US7] Create admin backend routes `admin/backend/src/routes/bosses.ts`: Express router with endpoints: `GET /api/bosses` (list all definitions with building names), `POST /api/bosses` (create with validation: name required, max_hp/attack/defense > 0, building_id valid and not already assigned, respawn_max >= respawn_min), `PUT /api/bosses/:id` (update fields), `DELETE /api/bosses/:id` (delete definition + cascade instances). `GET /api/bosses/:id/abilities` (list assigned abilities with names), `POST /api/bosses/:id/abilities` (assign ability_id with priority), `DELETE /api/bosses/:id/abilities/:abilityId` (remove assignment). `GET /api/bosses/:id/loot` (list loot with item names), `POST /api/bosses/:id/loot` (add item_def_id, drop_chance, quantity), `DELETE /api/bosses/:id/loot/:lootId` (remove entry). `GET /api/bosses/instances` (list all live instances with boss name, building name, current HP, status, fighter name, attempts, respawn_at). `POST /api/bosses/:id/respawn` (force respawn: delete current instance, create new at full HP). `POST /api/bosses/:id/upload-icon` (multer single file, PNG validation, save to `backend/assets/bosses/icons/`). `POST /api/bosses/:id/upload-sprite` (multer single file, PNG validation, save to `backend/assets/bosses/sprites/`). Register router in admin app.
- [X] T021 [P] [US7] Create admin frontend `admin/frontend/src/ui/boss-manager.ts`: Vanilla TS module (follow pattern from npc-manager.ts or quest-manager.ts). Main view: list of boss definitions in a table (name, HP, ATK, DEF, building, active status) with Create/Edit/Delete buttons. Create/Edit form: text inputs for name, description, number inputs for max_hp, attack, defense, xp_reward, min_crowns, max_crowns, respawn_min_seconds, respawn_max_seconds, dropdown for building_id (fetch buildings list), checkbox for is_active, file inputs for icon and sprite upload. Abilities sub-panel: dropdown of all abilities (fetch from GET /api/abilities), add button with priority input, list of assigned abilities with remove buttons. Loot sub-panel: item search/dropdown (fetch from GET /api/items), inputs for drop_chance and quantity, add button, list of loot entries with remove buttons. Instances dashboard: table showing all live instances (boss name, building, current HP / max HP, status, fighting player, total attempts, respawn countdown). Force Respawn button per defeated instance. Wire into admin app navigation/sidebar.
- [X] T022 [US7] Create asset directories and serve static files: Create `backend/assets/bosses/icons/` and `backend/assets/bosses/sprites/` directories. Ensure the game backend's static file serving (Express static middleware or equivalent) serves these paths so `icon_url` and `sprite_url` resolve correctly for the game client (e.g., `/assets/bosses/icons/<filename>.png`).

**Checkpoint**: US7 complete — admins can fully manage bosses.

---

## Phase 10: User Story 8 — Boss State Broadcast (Priority: P3)

**Goal**: All players in a zone see real-time boss state changes without refreshing.

**Independent Test**: Two players in same zone. Player A challenges boss — Player B sees status change instantly.

- [ ] T023 [US8] Verify real-time broadcasts work end-to-end: This functionality should already be implemented in T004 (bossInstanceManager.broadcastBossState sends boss:state to zone sessions) and T018 (frontend handles boss:state to update sprites). Test with two browser windows: Player A challenges boss → Player B sees "In Combat" status. Player A wins → Player B sees boss disappear + respawn timer. Boss respawns → Player B sees boss reappear. Fix any issues found — ensure the broadcast function correctly iterates all WebSocket sessions in the zone.

**Checkpoint**: US8 complete — real-time state sync verified.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates (constitution gate 7), cleanup, and validation.

- [X] T024 [P] Add boss query commands to `scripts/game-data.js`: Add `bosses` command that lists all boss definitions with stats, building assignment, ability count, loot count. Add `boss-instances` command that lists all live instances with current HP, status, fighter, attempts, respawn time. Update the script's help text.
- [X] T025 [P] Add boss CRUD commands to `scripts/game-entities.js`: Add `create-boss` (name, max_hp, attack, defense, xp_reward, min_crowns, max_crowns, building_id, respawn_min_seconds, respawn_max_seconds), `create-boss-loot` (boss_id, item_def_id, drop_chance, quantity), `assign-boss-ability` (boss_id, ability_id, priority), `upload-boss-icon` (boss_id, file_path), `upload-boss-sprite` (boss_id, file_path). Update VALID entity types and help text.
- [ ] T026 [P] Update `scripts/game-data.js` documentation in `.claude/commands/game-data.md`: Add `bosses` and `boss-instances` commands to the available queries list.
- [ ] T027 [P] Update `scripts/game-entities.js` documentation in `.claude/commands/game-entities.md`: Add `create-boss`, `create-boss-loot`, `assign-boss-ability`, `upload-boss-icon`, `upload-boss-sprite` commands with parameter documentation.
- [X] T028 [P] Add "Adding a Boss" checklist to `CLAUDE.md`: Document all locations that need updating when creating a new boss (similar to "Adding a New Building Action Type" checklist). Include: bosses table row, boss_abilities assignments, boss_loot entries, boss icon upload, boss sprite upload, building assignment, instance auto-spawn verification.
- [X] T029 [P] Add structured logging to boss system: In `boss-instance-manager.ts` and `boss-combat-handler.ts`, add structured log calls (using existing logger pattern) for: boss spawn, boss challenge (success/rejected with reason), combat turn (boss ability fired), boss defeat (with loot summary), boss respawn, admin force-respawn. Include character_id, boss_id, building_id in all log entries.
- [ ] T030 Run quickstart.md validation: Follow the quickstart.md test sequence end-to-end. Create a boss via admin, navigate to building, verify blocked, challenge with token, fight, verify hidden HP and abilities, win/lose, verify persistent HP, verify respawn, verify broadcasts.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migration applied, types compiled, queries available)
- **Phase 3 (US1)**: Depends on Phase 2 — first testable increment
- **Phase 4 (US2)**: Depends on Phase 2 — can run parallel with US1 but best done after (uses boss manager)
- **Phase 5 (US3)**: Depends on Phase 4 — needs boss combat to exist for UI work
- **Phase 6 (US4)**: Depends on Phase 4 — verification of persistent HP
- **Phase 7 (US5)**: Depends on Phase 2 — can run parallel with US2-US4 (frontend only)
- **Phase 8 (US6)**: Depends on Phase 2 — verification of respawn cycle
- **Phase 9 (US7)**: Depends on Phase 1 — can run parallel with all other stories (admin is independent)
- **Phase 10 (US8)**: Depends on Phase 4 + Phase 7 — needs combat + frontend sprites
- **Phase 11 (Polish)**: Depends on all stories complete

### User Story Dependencies

- **US1 (Boss Blocks Building)**: Phase 2 only — independently testable
- **US2 (Player Challenges Boss)**: Phase 2 only — independently testable
- **US3 (Boss Combat UI)**: US2 must exist — needs combat backend
- **US4 (Persistent HP)**: US2 must exist — verification task
- **US5 (Map Display)**: Phase 2 only — independently testable
- **US6 (Respawn Cycle)**: Phase 2 only — verification task
- **US7 (Admin Panel)**: Phase 1 only — fully independent
- **US8 (State Broadcast)**: US2 + US5 — needs combat + sprites

### Parallel Opportunities

Phase 1: T001, T002, T003 can run sequentially (T002 depends on T001 for table types, T003 depends on T002 for query types)
Phase 2: T004 first, then T005/T006/T007 in parallel
Phase 9 (Admin): T020 and T021 in parallel
Phase 11: T024, T025, T026, T027, T028, T029 all in parallel

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (migration, types, queries)
2. Complete Phase 2: Foundational (instance manager, building blocking)
3. Complete Phase 3: US1 (verify blocking works)
4. Complete Phase 4: US2 (challenge + combat)
5. **STOP and VALIDATE**: Boss can be fought via WS message, building blocks/unblocks
6. Continue to US3 for combat UI polish

### Incremental Delivery

1. Setup + Foundational → Boss infrastructure ready
2. US1 → Building blocking works (testable via DB insert)
3. US2 → Combat works (testable via game client WS)
4. US3 → Combat UI polished (hidden HP, abilities visible)
5. US5 + US7 → Bosses visible on map + admin can create them
6. US4 + US6 + US8 → Verification and polish
7. Phase 11 → Tooling and documentation

---

## Notes

- Tasks T008, T015, T019, T023 are verification/integration tasks — they test that the underlying implementation works correctly rather than writing new code
- Boss combat reuses `CombatEngine` from `backend/src/game/combat/combat-engine.ts` — do NOT fork or duplicate the engine
- Admin panel follows existing patterns from `admin/backend/src/routes/monsters.ts` and `admin/frontend/src/ui/npc-manager.ts`
- Building blocking in T005 is a single guard check — keep it minimal, don't refactor the existing handler
- Total tasks: 30
