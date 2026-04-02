# Tasks: Arena System

**Input**: Design documents from `specs/029-arena-system/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/arena-messages.md, quickstart.md

**Tests**: No automated tests (project pattern — manual testing only).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DB migration, shared types, and core query layer — foundation for all arena features.

- [x] T001 Create DB migration `backend/src/db/migrations/031_arena_system.sql` — create `arenas`, `arena_monsters`, `arena_participants` tables; ALTER `characters` to add `arena_id` and `arena_cooldown_until` columns; extend `building_actions.action_type` CHECK to include `'arena'`. Follow schema from `data-model.md`
- [x] T002 Add all arena DTOs, payload interfaces, and message type strings to `shared/protocol/index.ts` — `ArenaDto`, `ArenaParticipantDto`, `ArenaCombatantDto`, `ArenaBuildingActionDto`, all arena payload types from `contracts/arena-messages.md`. Add `'arena'` to `CityBuildingActionPayload.action_type` union and `ArenaBuildingActionDto` to `BuildingActionDto` union
- [x] T003 Create arena DB queries in `backend/src/db/queries/arenas.ts` — CRUD for arenas table (getArenaById, getArenaByBuildingId, getAllArenas, createArena, updateArena, deleteArena); arena_monsters queries (getArenaMonstersWithDetails, addArenaMonster, removeArenaMonster); arena_participants queries (getParticipantsByArena, getParticipantByCharacterId, insertParticipant, updateParticipantHp, updateParticipantCombatState, deleteParticipant, setPreFightHp, clearPreFightHp); character arena columns (setCharacterArenaId, setCharacterArenaCooldown, getCharacterArenaCooldown)

**Checkpoint**: DB schema and shared types ready — all packages can reference arena types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Building action type integration (7-location checklist) and in-memory state manager — MUST complete before user stories.

**WARNING**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create arena state manager in `backend/src/game/arena/arena-state-manager.ts` — in-memory `Map<number, ArenaState>` tracking participants per arena; functions: addParticipant, removeParticipant, getParticipant, getArenaParticipants, setInCombat, clearCombat, broadcastToArena (send WS message to all arena participants). Load arena_participants from DB on server startup for crash recovery. Follow `ArenaState` and `ArenaParticipantState` interfaces from data-model.md
- [x] T005 [P] Add `'arena'` building action type — follow CLAUDE.md 7-location checklist: (1) DB CHECK constraint already in T001; (2) shared protocol types already in T002; (3) `backend/src/game/world/city-map-loader.ts` — add `if (a.action_type === 'arena')` branch mapping to `ArenaBuildingActionDto`; (4) `backend/src/game/world/building-action-handler.ts` — add `if (action.action_type === 'arena')` branch; (5) `admin/backend/src/routes/buildings.ts` — add `'arena'` to validation and config processing; (6) `admin/frontend/src/editor/api.ts` — add `'arena'` to type unions; (7) `admin/frontend/src/ui/properties.ts` — add arena option to dropdown, fields div, save handler, display label
- [x] T006 [P] Add arena message schemas to `backend/src/websocket/validator.ts` — add validation schemas for all 5 client→server messages: `arena:enter` (action_id: number), `arena:leave` (arena_id: number), `arena:challenge_player` (target_character_id: string), `arena:challenge_npc` (monster_id: number), `arena:combat_trigger_active` (combat_id: string)

**Checkpoint**: Foundation ready — building action type wired, state manager available, message validation in place.

---

## Phase 3: User Story 1 — Enter and Leave Arena (Priority: P1) + User Story 5 — Map Visibility (Priority: P2) + User Story 7 — HP Persistence (Priority: P1)

**Goal**: Players can enter an arena, become invisible on the map, see the lobby, wait out the timer, leave, and have their HP tracked persistently. US5 and US7 are co-implemented here because arena entry/exit inherently requires visibility toggling and HP tracking.

**Independent Test**: A single player enters an arena, sees the lobby (participant list + fighter list + countdown timer), waits for min stay, leaves, reappears on map. A second player in the zone verifies the first disappears/reappears. HP is shown in the lobby and synced back to character on exit.

### Implementation

- [x] T007 [US1] Create arena handler in `backend/src/game/arena/arena-handler.ts` — implement `handleArenaEnter(session, payload)`: validate not in combat/gathering/already in arena, check cooldown (`characters.arena_cooldown_until`), look up arena from building action config, check `is_active`, insert `arena_participants` row with `current_hp = characters.current_hp` and `can_leave_at = NOW() + min_stay_seconds`, set `characters.arena_id`, add to state manager, remove player from zone registry (`removePlayer` + broadcast `player.left_zone`), send `arena:entered` with full arena state, broadcast `arena:player_entered` to other participants. Handle rejections with `arena:enter_rejected`
- [x] T008 [US1] Implement `handleArenaLeave(session, payload)` in `backend/src/game/arena/arena-handler.ts` — validate `can_leave_at <= NOW()` and not in combat, delete `arena_participants` row, set `characters.arena_id = NULL`, set `characters.arena_cooldown_until = NOW() + reentry_cooldown_seconds`, sync `characters.current_hp` from arena participant HP, remove from state manager, re-add player to zone registry (`addPlayer` + broadcast `player.entered_zone`), send `arena:left` to player, broadcast `arena:player_left` to remaining participants. Handle rejections with `arena:leave_rejected`
- [x] T009 [US1] Implement arena kick function `kickFromArena(characterId, reason, applyCooldown)` in `backend/src/game/arena/arena-handler.ts` — reusable by combat loss, admin kick, and arena deactivation. Same cleanup as leave but with configurable cooldown and `arena:kicked` message instead of `arena:left`. Sync HP back to character
- [x] T010 [US1] Integrate zone visibility filtering in `backend/src/game/world/zone-registry.ts` and `zone-broadcasts.ts` — when building `PlayerSummary[]` for `world.state`, exclude characters where `arena_id IS NOT NULL` (query characters table or check state manager). This ensures players joining the zone after someone entered the arena don't see them
- [x] T011 [US1] Register arena handlers in `backend/src/index.ts` — export `registerArenaHandlers()` from arena-handler.ts that registers `arena:enter` and `arena:leave` handlers via `registerHandler()`. Call `registerArenaHandlers()` in `bootstrap()`. Also call arena state manager's `loadFromDb()` on startup for crash recovery
- [x] T012 [US1] Create arena lobby panel in `frontend/src/ui/ArenaPanel.ts` — HTML panel (same pattern as BuildingPanel) showing: arena name header, participant list (name, level, class, "In Combat" indicator), fighter list (name, HP, ATK, DEF with Challenge buttons), countdown timer to `can_leave_at`, Leave button (disabled until timer expires, confirmation dialog on click), current Arena Challenge Token count from inventory. Panel replaces building panel when `arena:entered` is received
- [x] T013 [US1] Wire arena messages in `frontend/src/scenes/GameScene.ts` — handle `arena:entered` (open ArenaPanel, hide map UI), `arena:left` (close ArenaPanel, show map UI), `arena:enter_rejected` (show error message), `arena:leave_rejected` (show error message), `arena:player_entered` (add to participant list), `arena:player_left` (remove from participant list), `arena:kicked` (close ArenaPanel, show map UI, show kick message)

**Checkpoint**: Player can enter/leave arena, disappear/reappear on map, see lobby with countdown. HP is tracked in arena_participants and synced back to character on exit.

---

## Phase 4: User Story 2 — PvP Combat (Priority: P1)

**Goal**: Two arena players can fight each other with simultaneous turns, abilities, and proper win/loss resolution with rewards and kicking.

**Independent Test**: Two players enter arena, one challenges the other, combat plays out with auto-abilities and active abilities, loser is kicked with cooldown, winner stays with reduced HP and receives XP/crowns.

### Implementation

- [x] T014 [US2] Create PvP combat handler in `backend/src/game/arena/arena-combat-handler.ts` — implement `handleChallengePlayer(session, payload)`: validate both players in same arena, neither in_combat, level bracket check (`Math.abs(levelA - levelB) <= arena.level_bracket`), set both participants `in_combat = true` and `pre_fight_hp = current_hp` in DB and state manager, compute `DerivedCombatStats` for both via `computeCombatStats()`, build two `EngineState` objects (challengerState: playerHp=A, enemyHp=B; defenderState: playerHp=B, enemyHp=A), create `PvpCombatSession` in `Map<string, PvpCombatSession>`, send `arena:combat_start` to both (each with their perspective), broadcast `arena:participant_updated` for both, start turn loop. Handle rejections with `arena:challenge_rejected`
- [x] T015 [US2] Implement PvP turn loop in `backend/src/game/arena/arena-combat-handler.ts` — `startPvpTurn(session)`: (1) Mana regen for both, (2) `computePlayerAttack` for A→B using challengerState + defenderStats, (3) `computePlayerAttack` for B→A using defenderState + challengerStats (reusing engine function with swapped perspectives), (4) `computeAutoAbilities` for both, (5) Send `arena:combat_turn_result` to each player with events remapped to their perspective (challenger sees own attacks as `source:'player'`, defender's as `source:'enemy'`; vice versa), (6) Open active window: send `arena:combat_active_window` to both, set `activeWindowTimer = setTimeout(resolveActiveAndEnemyTurn, TURN_TIMER_MS)`, track `challengerActedThisTurn`/`defenderActedThisTurn`
- [x] T016 [US2] Implement active ability handling in `backend/src/game/arena/arena-combat-handler.ts` — `handlePvpTriggerActive(session, payload)`: find session by combat_id, determine if sender is challenger or defender, fire `computeActiveAbility` against opponent's defence using the sender's EngineState, mark `[side]ActedThisTurn = true`, if both acted clear timer and proceed to resolveActiveAndEnemyTurn. `resolveActiveAndEnemyTurn`: tick effects for both states, tick cooldowns, check for death (HP <= 0), send `arena:combat_turn_result` with phase:'enemy', schedule next turn or end combat
- [x] T017 [US2] Implement PvP combat end in `backend/src/game/arena/arena-combat-handler.ts` — `endPvpCombat(session, winnerId, loserId)`: clear timer, determine winner/loser, grant `arena.winner_xp`/`arena.loser_xp` via existing XP grant function, grant `arena.winner_crowns`/`arena.loser_crowns` via `addCrowns()`, increment winner's `combat_wins`, send `arena:combat_end` to both (winner gets outcome:'victory', loser gets outcome:'defeat'), update winner's `arena_participants.current_hp` from EngineState, clear pre_fight_hp and in_combat for winner, kick loser via `kickFromArena(loserId, 'defeat', true)`, broadcast `arena:participant_updated` for winner (in_combat=false), remove PvpCombatSession from map. Handle tie-break: if both HP <= 0, challenger wins
- [x] T018 [US2] Handle PvP disconnection in `backend/src/game/arena/arena-combat-handler.ts` — on WebSocket close event, if player has active PvpCombatSession: treat as forfeit, call `endPvpCombat` with disconnected player as loser. If both disconnect: cancel fight, restore both to pre_fight_hp, remove both from arena with cooldowns, no rewards. Register disconnect handler during combat start
- [x] T019 [US2] Register PvP combat handlers in `backend/src/game/arena/arena-handler.ts` — add `arena:challenge_player` and `arena:combat_trigger_active` to `registerArenaHandlers()`. Route `arena:combat_trigger_active` to the combat handler
- [x] T020 [US2] Wire PvP combat messages in `frontend/src/scenes/GameScene.ts` — handle `arena:combat_start` (open CombatScreen with opponent as "monster", set `is_pvp` flag), `arena:combat_active_window` (show active ability button with timer), `arena:combat_turn_result` (update HP bars, show events), `arena:combat_end` (show result screen with XP/crowns, return to ArenaPanel or map). Adapt CombatScreen to show opponent name/level/class instead of monster icon when `is_pvp=true`
- [x] T021 [US2] Update ArenaPanel participant list in `frontend/src/ui/ArenaPanel.ts` — handle `arena:participant_updated` messages to toggle "In Combat" indicator (crossed-swords icon) on participants, disable Challenge button for in-combat players. Add Challenge button click handler that sends `arena:challenge_player` with target character_id. Handle `arena:challenge_rejected` with user-facing error message

**Checkpoint**: Full PvP combat works — challenge, simultaneous turns, abilities, rewards, loser kicked, winner stays.

---

## Phase 5: User Story 3 — NPC Fighter Challenge (Priority: P2)

**Goal**: Players can challenge arena-assigned NPC fighters by consuming an Arena Challenge Token. Uses standard PvE combat flow.

**Independent Test**: Player with tokens enters arena, challenges a fighter, token consumed, PvE combat plays out, winner stays with reduced HP, loser kicked. No tokens = button disabled.

### Implementation

- [x] T022 [US3] Implement NPC challenge in `backend/src/game/arena/arena-combat-handler.ts` — `handleChallengeNpc(session, payload)`: validate player in arena and not in_combat, look up monster in arena_monsters by monster_id + arena_id, find and consume Arena Challenge Token from inventory (follow boss-combat-handler.ts:119-151 pattern: find by name → check qty → consume → push inventory), set participant `in_combat = true` and `pre_fight_hp = current_hp`, start standard PvE combat using existing combat engine with player's arena HP as starting HP (not max_hp), broadcast `arena:participant_updated`. On combat end: if win → update participant `current_hp` from post-combat HP, clear in_combat/pre_fight_hp, send `arena:combat_end` (no loot/crowns, standard monster XP); if loss → kick via `kickFromArena`. Handle rejections with `arena:challenge_rejected` (reasons: no_token, monster_not_found, in_combat)
- [x] T023 [US3] Register `arena:challenge_npc` handler in `registerArenaHandlers()` in `backend/src/game/arena/arena-handler.ts`
- [x] T024 [US3] Update fighter list in `frontend/src/ui/ArenaPanel.ts` — show Challenge buttons next to each NPC fighter, disable if player has no Arena Challenge Tokens (check inventory for item name match), wire click to send `arena:challenge_npc` with monster_id. Show token count in the panel. Update token count display after `inventory.state` messages

**Checkpoint**: NPC challenges work with token consumption, HP persistence, and kick-on-loss.

---

## Phase 6: User Story 4 — Arena Lobby Live State (Priority: P2)

**Goal**: Real-time lobby updates — participants entering/leaving and combat status changes are reflected instantly.

**Independent Test**: Three players in arena, two fight, third sees both marked "In Combat" and cannot challenge them, fight ends, winner becomes challengeable.

### Implementation

- [x] T025 [US4] Verify and polish real-time broadcasts in `backend/src/game/arena/arena-handler.ts` and `arena-combat-handler.ts` — ensure all state changes trigger the correct broadcast: `arena:player_entered` on entry, `arena:player_left` on leave/kick, `arena:participant_updated` on combat start/end. Verify `broadcastToArena()` in state manager sends to all participants except the source player where appropriate. Add participant HP to the broadcast if needed for lobby display
- [x] T026 [US4] Polish ArenaPanel live updates in `frontend/src/ui/ArenaPanel.ts` — ensure participant list re-renders on every `arena:player_entered`, `arena:player_left`, and `arena:participant_updated` message. Verify Challenge buttons are correctly enabled/disabled based on target's in_combat status. Add visual transition (fade in/out) for participant list changes

**Checkpoint**: Lobby updates in real time for all participants.

---

## Phase 7: User Story 6 — Admin Arena Management (Priority: P3)

**Goal**: Admins can create/configure arenas, assign fighters, monitor participants, and force-kick players.

**Independent Test**: Admin creates arena via admin panel, configures rewards/timers, assigns monsters, arena becomes available in-game. Admin can force-kick a player.

### Implementation

- [x] T027 [P] [US6] Create admin arena routes in `admin/backend/src/routes/arenas.ts` — follow `bosses.ts` pattern: `GET /api/arenas` (list all with building name), `GET /api/arenas/:id` (detail with monsters), `POST /api/arenas` (create with name, building_id, reward/timer config, level_bracket), `PUT /api/arenas/:id` (update config), `DELETE /api/arenas/:id` (delete), `GET /api/arenas/:id/monsters` (list assigned), `POST /api/arenas/:id/monsters` (assign monster with sort_order), `DELETE /api/arenas/:id/monsters/:monsterId` (remove), `GET /api/arenas/:id/participants` (view current), `POST /api/arenas/:id/kick/:characterId` (force-kick — calls game backend endpoint or direct DB + state manager cleanup). Mount router in admin backend app
- [x] T028 [P] [US6] Create admin arena manager UI in `admin/frontend/src/ui/arena-manager.ts` — follow `boss-manager.ts` pattern: arena list table with create/edit/delete buttons, create/edit form (name, building dropdown, min_stay_seconds, reentry_cooldown_seconds, winner_xp, loser_xp, winner_crowns, loser_crowns, level_bracket, is_active toggle), monster assignment panel (select from existing monsters, add/remove with sort order), live participants viewer (name, level, entered_at, in_combat status), force-kick button per participant. Add "Arenas" tab to admin navigation

**Checkpoint**: Full admin CRUD for arenas with monster assignment and player management.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Logging, tooling, and documentation updates.

- [x] T029 [P] Add structured logging to all arena handlers in `backend/src/game/arena/arena-handler.ts` and `arena-combat-handler.ts` — log arena enter/leave (characterId, arenaId), challenge issued/rejected (challengerId, targetId, reason), combat start/end (combatId, winnerId, loserId, xpAwarded, crownsAwarded), kick events (characterId, reason), NPC challenge (characterId, monsterId, tokenConsumed). Follow existing `logger.info()` / `logger.warn()` pattern
- [x] T030 [P] Add `arenas` command to `scripts/game-data.js` — query arenas table joined with buildings for name, show all arenas with config (name, building, rewards, timers, level_bracket, is_active, monster count, participant count). Add `arena <id>` for detail view with assigned monsters and current participants
- [x] T031 [P] Update `scripts/game-entities.js` — add `'arena'` to `VALID_ACTION_TYPES` array. No other changes needed (arenas are managed via admin panel, not the entity creation script)
- [x] T032 [P] Update game design skill docs in `.claude/commands/game-entities.md` — document `'arena'` action type config format (`{ "arena_id": <integer> }`) in the building action section
- [x] T033 [P] Update `.claude/commands/gd.design.md` — add arena configuration to the design template if applicable (NPC fighter assignment, arena config fields)
- [x] T034 Handle arena deactivation and server restart edge cases in `backend/src/game/arena/arena-state-manager.ts` — on startup: load all `arena_participants` rows, restore in-memory state, for any participant with `in_combat = true`: reset to `in_combat = false` and restore `current_hp = pre_fight_hp` (crash recovery — cancelled fight). On arena deactivation: kick all participants without cooldown

**Checkpoint**: All cross-cutting concerns addressed. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1+US5+US7 (Phase 3)**: Depends on Phase 2 — core entry/exit/visibility/HP
- **US2 (Phase 4)**: Depends on Phase 3 (needs arena entry/exit + state manager)
- **US3 (Phase 5)**: Depends on Phase 3 (needs arena entry + state manager). Can run in parallel with US2
- **US4 (Phase 6)**: Depends on Phase 3 + Phase 4 (needs lobby + combat state changes to verify)
- **US6 (Phase 7)**: Depends on Phase 1 only (DB + types). Can run in parallel with Phases 3-6
- **Polish (Phase 8)**: Depends on all story phases being complete

### User Story Dependencies

```
Phase 1 (Setup)
    │
Phase 2 (Foundational)
    │
    ├──► Phase 3 (US1+US5+US7: Entry/Exit/Visibility/HP) ──► Phase 4 (US2: PvP Combat)
    │                                                    ├──► Phase 5 (US3: NPC Challenge) [parallel with US2]
    │                                                    └──► Phase 6 (US4: Live Lobby) [after US2]
    │
    └──► Phase 7 (US6: Admin) [parallel with all game phases]
              │
              ▼
         Phase 8 (Polish)
```

### Within Each User Story

- DB/shared types (Phase 1) before backend logic
- Backend handlers before frontend wiring
- Core logic before edge case handling

### Parallel Opportunities

- **Phase 2**: T004, T005, T006 all modify different files — run in parallel
- **Phase 5 and Phase 4**: US3 (NPC challenge) can run in parallel with US2 (PvP) after Phase 3
- **Phase 7**: Admin CRUD can run entirely in parallel with game phases (only needs Phase 1)
- **Phase 8**: All polish tasks (T029-T034) modify different files — run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# All three tasks modify different files — run in parallel:
T004: arena-state-manager.ts (new file)
T005: city-map-loader.ts + building-action-handler.ts + buildings.ts + api.ts + properties.ts
T006: validator.ts
```

## Parallel Example: Phase 4 + Phase 5

```
# After Phase 3, these can run in parallel:
Phase 4 (US2): PvP combat handler — arena-combat-handler.ts (PvP functions)
Phase 5 (US3): NPC combat handler — arena-combat-handler.ts (NPC functions)
# NOTE: Both write to arena-combat-handler.ts — if parallelizing, split into separate functions
# that are integrated sequentially at the end
```

---

## Implementation Strategy

### MVP First (Phase 1 → Phase 2 → Phase 3)

1. Complete Phase 1: Setup (migration + types + queries)
2. Complete Phase 2: Foundational (building action + state manager + validation)
3. Complete Phase 3: US1+US5+US7 (Enter/Leave/Visibility/HP)
4. **STOP and VALIDATE**: Player can enter arena, see lobby, leave, disappear/reappear on map
5. This is a minimal but testable arena — no combat yet but the infrastructure works

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1+US5+US7 → Arena entry/exit works → Validate
3. Add US2 → PvP combat works → Validate
4. Add US3 → NPC challenges work → Validate
5. Add US4 → Live lobby polished → Validate
6. Add US6 → Admin panel complete → Validate
7. Polish → Feature complete → `/gd.execute` to create entities

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- No automated tests — manual testing per `game_design/arena-system/design.md` Tests 1-6
- After all code is deployed, run `/gd.execute` to create Arena Challenge Token, 6 fighters, and Varn Bloodkeeper NPC
- Commit after each task or logical group
