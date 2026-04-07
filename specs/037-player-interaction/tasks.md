# Tasks: Player Interaction Panel

**Input**: Design documents from `/specs/037-player-interaction/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Remote Player Data Tracking)

**Purpose**: Build the data infrastructure that all user stories depend on — track remote player node IDs so we can determine co-location.

- [x] T001 Add `RemotePlayerInfo` map and helper methods to `frontend/src/scenes/GameScene.ts` — create a `Map<string, {id: string, name: string, level: number, classId: number, nodeId: number | null}>` field (`remotePlayerData`). Populate it from `world.state` handler's `players[]` array (alongside existing `spawnRemotePlayer` calls). Each entry uses `PlayerSummary` fields: `id`, `name`, `level`, `class_id`, `current_node_id`.

- [x] T002 Update `city.player_moved` handler for remote players in `frontend/src/scenes/GameScene.ts` — in the `else` branch (lines ~706-717) that handles remote player movement, update `remotePlayerData.get(payload.character_id).nodeId = payload.node_id` alongside the existing tween animation.

- [x] T003 Update `player.entered_zone` and `player.left_zone` handlers in `frontend/src/scenes/GameScene.ts` — on `player.entered_zone`, add entry to `remotePlayerData` from the `PlayerSummary`. On `player.left_zone`, delete entry from `remotePlayerData` (alongside existing `removeRemotePlayer` call). Also update the buffered `pendingEnteredZone` flush logic to populate `remotePlayerData`.

- [x] T004 Add a `getNearbyPlayers()` method to `frontend/src/scenes/GameScene.ts` that returns an array of `{id, name, level}` for all entries in `remotePlayerData` where `nodeId === this.myCharacter.current_node_id`. Returns empty array if `current_node_id` is null (tile maps).

**Checkpoint**: Data infrastructure ready — `getNearbyPlayers()` returns correct co-located players at any time.

---

## Phase 2: User Story 1 — See Players at Same Location (Priority: P1) 🎯 MVP

**Goal**: Display a Nearby Players panel in the bottom-right (replacing Combat Log) that lists players at the same map node with real-time updates.

**Independent Test**: Open two browser sessions, navigate both characters to the same city map node, verify each sees the other. Move one away — verify they disappear from the list. Move them to an intermediate path node — verify co-location still works.

### Implementation for User Story 1

- [x] T005 [US1] Create `frontend/src/ui/NearbyPlayersPanel.ts` — HTML component matching CombatLog's layout slot. Constructor takes a container element (the `#bottom-bar` div). Structure: root div (same width as CombatLog: `clamp(200px, 40%, 510px)`, `height: 100%`, `flex-shrink: 0`), header ("Nearby Players" with same gradient style as CombatLog header), scrollable player list div. Use CSS variables from the existing token system (`--color-gold-primary`, `--font-display`, `--font-body`, `--color-bg-panel`). Include an empty-state message div ("No other players here") shown when list is empty.

- [x] T006 [US1] Add `update(players: Array<{id: string, name: string, level: number}>)` method to `NearbyPlayersPanel` — clears and rebuilds the player list. Each entry is a clickable div showing the player name and level (e.g., "PlayerName  Lv. 5"). Style entries with hover effect (subtle gold highlight). Accept an `onPlayerClick: (playerId: string) => void` callback set via constructor or setter, called when an entry is clicked. Show/hide empty-state message based on list length.

- [x] T007 [US1] Add `destroy()` method to `NearbyPlayersPanel` that removes the root element from DOM (matching CombatLog's cleanup pattern).

- [x] T008 [US1] Wire `NearbyPlayersPanel` into `frontend/src/scenes/GameScene.ts` — replace `this.combatLog = new CombatLog(bottomBar)` with `this.nearbyPlayersPanel = new NearbyPlayersPanel(bottomBar)`. Update the field declaration. Call `this.nearbyPlayersPanel.destroy()` in cleanup (where `this.combatLog.destroy()` was). Remove `CombatLog` import.

- [x] T009 [US1] Add panel refresh calls in `frontend/src/scenes/GameScene.ts` — create a private `refreshNearbyPlayers()` method that calls `this.nearbyPlayersPanel.update(this.getNearbyPlayers())`. Call it from: (1) own player's `city.player_moved` handler (after updating `current_node_id`), (2) remote player's `city.player_moved` handler (after updating `remotePlayerData`), (3) `player.entered_zone` handler, (4) `player.left_zone` handler, (5) `world.state` handler (after initial population).

- [x] T010 [US1] Redirect `server.error` handler in `frontend/src/scenes/GameScene.ts` — change line ~620 from `this.combatLog.appendError(payload.message)` to display in the ChatBox instead. If `ChatBox` lacks a system message method, add `addSystemMessage(text: string)` to `frontend/src/ui/ChatBox.ts` that appends a styled system line (italic, warning color) to the active tab's message list.

**Checkpoint**: Nearby Players panel shows co-located players with real-time updates. Combat Log is fully replaced. Server errors display in chat.

---

## Phase 3: User Story 2 — View Player Details Modal (Priority: P2)

**Goal**: Clicking a player name in the panel opens a modal showing a placeholder icon, player name, and level.

**Independent Test**: Click a player name in the Nearby Players panel. Verify modal appears with placeholder icon, correct name, and level. Close via X button, backdrop click, and Escape key.

### Implementation for User Story 2

- [x] T011 [P] [US2] Create `frontend/src/ui/PlayerDetailModal.ts` — HTML modal component following the existing SkillDetailModal/StatTrainingModal pattern. Constructor takes parent element (`document.body` or `#game`). Implements `open(player: {id: string, name: string, level: number})` and `close()` methods. Structure: fixed overlay (`position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:250`), centered dialog (`background:#0d0b08; border:1px solid #5a4a2a; border-radius:6px; padding:24px 28px; min-width:320px; max-width:400px`). Dialog contents: close button (X, top-right), placeholder icon div (64x64px, centered, dark background with shield/silhouette SVG or CSS shape), player name (gold, display font), level text ("Level N"), and an empty `actions-container` div for future interaction buttons. Use existing CSS token variables.

- [x] T012 [US2] Add close handling to `PlayerDetailModal` — close on: (1) X button click, (2) overlay backdrop click (`if (e.target === this.overlay)`), (3) Escape key (add `keydown` listener on open, remove on close). Add `isOpen(): boolean` method (returns `this.overlay !== null`).

- [x] T013 [US2] Wire modal into `frontend/src/scenes/GameScene.ts` — instantiate `PlayerDetailModal` in `create()`. Set the `NearbyPlayersPanel`'s `onPlayerClick` callback to look up the player in `remotePlayerData` and call `this.playerDetailModal.open({id, name, level})`. Destroy modal in scene cleanup.

**Checkpoint**: Player detail modal opens on click, shows placeholder icon + name + level, closes via all three methods.

---

## Phase 4: User Story 3 — Player Leaves While Modal Is Open (Priority: P2)

**Goal**: When the viewed player leaves the node, the modal shows a "[Name] has left this location" notice. When they return, the notice disappears.

**Independent Test**: Open modal for a player. Have that player move away — verify "left" notice appears. Have them return — verify notice disappears. Have them leave the zone entirely — verify notice appears and persists.

### Implementation for User Story 3

- [x] T014 [US3] Add presence tracking state to `PlayerDetailModal` in `frontend/src/ui/PlayerDetailModal.ts` — add `targetId: string | null` and `isPresent: boolean` fields. Add a notice overlay div inside the dialog (initially hidden) that shows "[Player Name] has left this location" with a muted/warning style. Add `setPresence(present: boolean)` method: when `false`, show the notice div (overlay on top of player details or replace content area); when `true`, hide the notice div and restore normal display. Set `isPresent = true` on `open()`.

- [x] T015 [US3] Wire presence updates in `frontend/src/scenes/GameScene.ts` — in the `refreshNearbyPlayers()` method (or alongside it), check if `playerDetailModal.isOpen()` and if so: determine if `targetId` is still in the nearby players list. Call `playerDetailModal.setPresence(true)` if present, `playerDetailModal.setPresence(false)` if not. This automatically handles: remote player moved away, remote player moved back, remote player left zone, own player moved to a different node.

- [x] T016 [US3] Handle edge case in `frontend/src/scenes/GameScene.ts` — when `player.left_zone` fires for the modal's target player, call `playerDetailModal.setPresence(false)`. Add `getTargetId(): string | null` method to `PlayerDetailModal` so GameScene can check if the leaving player is the modal target.

**Checkpoint**: Modal correctly shows/hides "player left" notice in response to all movement and zone-change scenarios.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, edge cases, and final validation.

- [x] T017 Delete or comment out the `CombatLog` import in `frontend/src/scenes/GameScene.ts` if not already removed in T008. Verify `frontend/src/ui/CombatLog.ts` has no remaining consumers (can be safely deleted in a future cleanup).

- [x] T018 Ensure `NearbyPlayersPanel` and `PlayerDetailModal` are properly destroyed on scene shutdown in `frontend/src/scenes/GameScene.ts` — verify the cleanup section destroys both components, removes any global event listeners (Escape key handler), and clears the `remotePlayerData` map.

- [x] T019 Handle zone change edge case in `frontend/src/scenes/GameScene.ts` — when `world.state` arrives (zone change), clear `remotePlayerData`, close `PlayerDetailModal` if open, and repopulate from the new zone's `players[]` array before calling `refreshNearbyPlayers()`.

- [ ] T020 Run quickstart.md validation — follow the test steps in `specs/037-player-interaction/quickstart.md` with two browser sessions to verify all user stories work end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Foundational (T001-T004)
- **User Story 2 (Phase 3)**: Depends on User Story 1 (needs the panel to click on)
- **User Story 3 (Phase 4)**: Depends on User Story 2 (needs the modal to track presence in)
- **Polish (Phase 5)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only — delivers MVP
- **User Story 2 (P2)**: Depends on US1 (panel must exist for click interaction)
- **User Story 3 (P2)**: Depends on US2 (modal must exist for presence tracking)

### Within Each User Story

- T005 → T006 → T007 (NearbyPlayersPanel build order)
- T008 depends on T005-T007 (panel must exist to wire)
- T009 depends on T008 + T004 (wiring needs both panel and data method)
- T011 → T012 (modal build order)
- T013 depends on T011-T012 + T008 (both panel and modal must exist)
- T014 → T015-T016 (presence state before wiring)

### Parallel Opportunities

- T005, T006, T007 can be built incrementally but are in the same file — sequential
- T011 can run in parallel with T009, T010 (different files)
- T017, T018, T019 are independent polish tasks but touch the same GameScene file — sequential

---

## Parallel Example: Phase 2 + Phase 3 Overlap

```text
# After T008 (panel wired), these can run in parallel:
Task T009: Wire panel refresh calls in GameScene.ts
Task T011: Create PlayerDetailModal.ts (different file, no dependency on T009)

# After T006 (panel update method), this can start:
Task T010: Redirect server.error (different concern, same file but independent section)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001-T004) — data tracking infrastructure
2. Complete Phase 2: User Story 1 (T005-T010) — panel replaces combat log
3. **STOP and VALIDATE**: Two browser sessions, verify co-location display works
4. Deploy/demo if ready — panel is fully functional without modal

### Incremental Delivery

1. Foundational → data tracking ready
2. Add User Story 1 → panel shows nearby players (MVP!)
3. Add User Story 2 → clicking players opens detail modal
4. Add User Story 3 → modal tracks player presence live
5. Polish → cleanup, edge cases, final validation

---

## Notes

- All changes are frontend-only — no backend, database, or protocol modifications
- Total new code: ~400-600 lines across 2 new files + modifications to GameScene.ts and ChatBox.ts
- The `remotePlayerData` map is the key data structure — all features depend on it
- CombatLog.ts file itself is NOT deleted, just no longer imported (safe cleanup later)
- Modal z-index 250 sits between existing modals (200-300 range)
