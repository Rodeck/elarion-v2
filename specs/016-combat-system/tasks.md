# Tasks: Combat System — Mana Threshold Auto-Battle

**Input**: Design documents from `/specs/016-combat-system/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: Not requested — tasks focus on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no inter-task dependencies)
- **[Story]**: User story label — [US1] through [US4]

---

## Phase 1: Setup (Shared Protocol Types)

**Purpose**: Add all new WebSocket message type interfaces to the shared protocol module. Everything else depends on these types being present.

- [X] T001 Add all new message type interfaces to `shared/protocol/index.ts`: `CombatEventDto`, `CombatAbilityStateDto`, `MonsterCombatDto`, `PlayerCombatStateDto`, `AbilityDroppedDto`, `OwnedAbilityDto`, `CombatStartPayload`, `CombatTurnResultPayload`, `CombatActiveWindowPayload`, `CombatEndPayload`, `CombatTriggerActivePayload`, `LoadoutStatePayload`, `LoadoutUpdatedPayload`, `LoadoutUpdateRejectedPayload`, `LoadoutUpdatePayload`, `LoadoutRequestPayload`; extend `BuildingExploreResultPayload` with `outcome: 'combat_started'` variant

**Checkpoint**: `npm run -w shared build` passes — all new types compile with no errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, query modules, and the stateless combat engine must all exist before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create `backend/src/db/migrations/018_combat_system.sql`: `ALTER TABLE item_definitions` to add 7 mana stat columns (max_mana, mana_on_hit, mana_on_damage_taken, mana_regen, dodge_chance, crit_chance, crit_damage); `CREATE TABLE abilities`, `character_owned_abilities`, `character_loadouts`, `monster_ability_loot`; `INSERT INTO abilities` to seed the 9 default abilities (Power Strike, Mend, Iron Skin, Venom Edge, Battle Cry, Shatter, Execute, Reflect, Drain Life) with `ON CONFLICT (name) DO NOTHING`; run `npm run -w backend migrate` to apply

- [X] T003 [P] Create `backend/src/db/queries/abilities.ts`: export `getAllAbilities()`, `getAbilityById(id)`, `createAbility(data)`, `updateAbility(id, data)`, `deleteAbility(id)`, `AbilityRow` interface matching the `abilities` table schema; icon URL builder `buildAbilityIconUrl(filename)` following existing monster/item pattern

- [X] T004 [P] Create `backend/src/db/queries/loadouts.ts`: export `getCharacterLoadout(characterId)` returning all 4 slots with joined ability data, `getOwnedAbilities(characterId)` returning all abilities owned by character, `upsertLoadoutSlot(characterId, slotName, abilityId, priority)`, `grantAbilityToCharacter(characterId, abilityId)`, `setCharacterInCombat(characterId, inCombat: boolean)`; export `LoadoutSlotRow` and `OwnedAbilityRow` interfaces

- [X] T005 [P] Create `backend/src/game/combat/combat-engine.ts`: define `DerivedCombatStats`, `ActiveEffect`, `LoadoutSlotSnapshot`, `CombatLoadout`, `TurnResult`, `CombatEventDto` interfaces; implement pure functions `resolvePlayerAutoAttack(stats, enemyDefence)`, `resolveAutoAbilities(mana, slots, cooldowns, activeEffects)`, `resolveEnemyTurn(enemyAttack, playerStats)`, `tickActiveEffects(effects)` — no I/O, no timers, no WS; each function returns an events array and updated numeric state; include dodge roll (`Math.random() * 100 < dodgeChance`) and crit roll (`Math.random() * 100 < critChance`; multiply by `critDamage / 100`)

- [X] T006 Create `backend/src/game/combat/combat-stats-service.ts`: `computeCombatStats(characterId)` — loads the character's equipped items via existing `getEquippedItems` query, sums all mana stat columns from `item_definitions` (new columns from T002), returns a `DerivedCombatStats` object; constants `DEFAULT_MAX_MANA = 100`, `DEFAULT_CRIT_DAMAGE = 150`

- [X] T007 Create `backend/src/game/combat/combat-session-manager.ts`: singleton `Map<characterId, CombatSession>` with `start(session, character, monster)`, `get(characterId)`, `end(characterId)` methods; `start()` calls `computeCombatStats`, loads loadout via `getCharacterLoadout`, calls `setCharacterInCombat(id, true)`, constructs `CombatSession` and begins the first turn; `end()` calls `setCharacterInCombat(id, false)` and removes from map; export `CombatSessionManager` as a singleton instance

**Checkpoint**: `npm run -w backend typecheck` passes — no type errors in new files; migration applied successfully

---

## Phase 3: User Story 1 — Auto-Battle Combat Engine (Priority: P1) 🎯 MVP

**Goal**: A complete server-side turn loop that resolves combat in real-time, broadcasts each turn over WebSocket, enforces the active ability window with a timer, and concludes with win/loss outcome and rewards.

**Independent Test**: With one ability in an auto slot, trigger an explore encounter. Observe `combat:start`, repeated `combat:turn_result` + `combat:active_window` messages in browser DevTools WS inspector, followed by `combat:end`. Combat resolves without any client interaction.

- [X] T008 [US1] Create `backend/src/game/combat/combat-session.ts`: `CombatSession` class with fields matching `data-model.md` in-memory schema; `startTurn()` method implementing the full turn sequence — call engine's `resolvePlayerAutoAttack`, `resolveAutoAbilities`; send `combat:turn_result` (player phase) via `sendToSession`; send `combat:active_window`; set `setTimeout(TURN_TIMER_MS, () => this.closeActiveWindow())`; `triggerActive(combatId)` — validates `phase === 'active_window'` and mana ≥ cost, fires active ability, cancels timer, calls `closeActiveWindow()`; `closeActiveWindow()` — calls engine's `resolveEnemyTurn`, ticks DoTs, sends `combat:turn_result` (enemy phase), checks HP → if ended calls `endCombat()`, else calls `startTurn()` again; `endCombat()` — resolves win rewards (XP, crowns, item drops, ability drops via `monster_ability_loot` query), sends `combat:end`, calls `CombatSessionManager.end()`; emit structured log events `combat_session_started`, `combat_turn_resolved`, `combat_ability_fired`, `combat_session_ended` using existing `log()` helper

- [X] T009 [US1] Modify `backend/src/game/combat/explore-combat-service.ts`: remove the `while (playerHp > 0 && monsterHp > 0)` battle loop and all round-building logic; on successful encounter roll, call `CombatSessionManager.start(session, character, monster)` instead; return `{ action_id, outcome: 'combat_started' }` immediately; retain all logic before the combat loop (encounter roll, monster pick, night multiplier) and all logic that was in the win branch is now handled inside `CombatSession.endCombat()`

- [X] T010 [US1] Add `combat:trigger_active` message handler in `backend/src/websocket/dispatcher.ts`: validate session has authenticated character; retrieve active `CombatSession` from manager; call `session.triggerActive(payload.combat_id)`; silently ignore if no session or wrong phase (timer may have just expired)

- [X] T011 [US1] In `backend/src/websocket/dispatcher.ts`, add `loadout:state` push after successful `character:select`: load loadout + owned abilities via `getCharacterLoadout` + `getOwnedAbilities`, send `loadout:state` payload to client; add `loadout:request` handler that does the same on demand

**Checkpoint**: Open browser DevTools → WS messages tab → trigger an explore action → observe `combat:start`, `combat:turn_result` (×N), `combat:active_window` (×N), `combat:end` messages streaming in real-time. Mana values increase each turn. Ability appears in `ability_states` with correct `status`.

---

## Phase 4: User Story 2 — Pokemon-Style Combat UI (Priority: P2)

**Goal**: A full-page combat overlay opens on `combat:start` and visualises every turn event — HP/mana bars animate, floating numbers appear, the combat log scrolls, the active ability button counts down.

**Independent Test**: Trigger combat. The overlay opens with enemy in the upper half, player in the lower half. Both HP bars and the mana bar update each turn. The active button shows a countdown and lights up when mana ≥ cost. All events appear in the combat log. Pressing the active button fires the ability (WS message sent). Overlay closes after `combat:end` and shows outcome.

- [X] T012 [US2] Create `frontend/src/ui/CombatScreen.ts`: full-viewport HTML overlay (`position:fixed; inset:0; z-index:300`); constructor takes `onTriggerActive: () => void` callback; `open(payload: CombatStartPayload)` — builds layout with enemy nameplate + HP bar (upper area), player placeholder block, player HP bar, mana bar with tick marks at each auto-ability threshold, 3 auto-ability status indicators, active ability button + turn timer countdown, scrolling combat log (lower area); `applyTurnResult(payload: CombatTurnResultPayload)` — animate HP/mana bars to new values, append each `CombatEventDto` as a formatted log row (floating number indicators via CSS keyframe animation), update `ability_states` indicator statuses; `openActiveWindow(payload: CombatActiveWindowPayload)` — start client-side countdown on the active button (`setInterval` decrementing from `timer_ms`); `close()` — remove overlay from DOM; `showOutcome(payload: CombatEndPayload)` — display win/loss panel with XP, crowns, item and ability drops, Close button calls `close()`; follow existing panel styling conventions (Cinzel font, gold/dark colour palette from `tokens.css`)

- [X] T013 [US2] Update `frontend/src/scenes/GameScene.ts`: import and instantiate `CombatScreen`; register WS handlers via `WSClient` for `combat:start` → call `combatScreen.open(payload)`, `combat:turn_result` → `combatScreen.applyTurnResult(payload)`, `combat:active_window` → `combatScreen.openActiveWindow(payload)`, `combat:end` → `combatScreen.showOutcome(payload)`; pass `onTriggerActive` callback to `CombatScreen` that calls `wsClient.send('combat:trigger_active', { combat_id })` (store `combat_id` from `combat:start`); also update the `building:explore_result` handler to no-op on `outcome: 'combat_started'` (combat screen handles the flow)

**Checkpoint**: Full combat flow is visually playable end-to-end. HP bars shrink, mana bar fills, log entries appear, active button counts down and can be clicked.

---

## Phase 5: User Story 3 — Player Loadout Management (Priority: P2)

**Goal**: A "Loadouts" tab in the character panel lets players assign owned abilities to their 4 slots and set priority order. The loadout is read-only during combat.

**Independent Test**: Open character panel → Loadouts tab visible. Assign an ability to auto slot 1, set priority 2, save. Re-open tab — assignment persists. Start combat → tab is read-only with a locked message. End combat → tab is editable again.

- [X] T014 [US3] Add `loadout:update` handler in `backend/src/websocket/dispatcher.ts`: validate character is NOT in combat (`character.in_combat === false`), else send `loadout:update_rejected` with `reason: 'in_combat'`; validate `ability_id` is owned by character (query `character_owned_abilities`), else send `loadout:update_rejected` with `reason: 'ability_not_owned'`; validate slot type compatibility (`slot_name.startsWith('auto')` requires `slot_type IN ('auto','both')`), else `reason: 'slot_type_mismatch'`; on pass: call `upsertLoadoutSlot`, then send `loadout:updated` followed by full `loadout:state` refresh

- [X] T015 [US3] Create `frontend/src/ui/LoadoutPanel.ts`: constructor takes `container: HTMLElement` and `onUpdateSlot: (slotName, abilityId, priority) => void` callback; `render(payload: LoadoutStatePayload)` — renders 4 slot cards in a 2×2 grid (auto_1, auto_2, auto_3, active); each slot card shows ability name + mana cost if filled, or "Empty" placeholder; below the grid: scrollable owned-ability list showing name, mana cost, slot type chip, description; click an ability → select it, then click a compatible slot → call `onUpdateSlot`; auto slots show a priority number input that calls `onUpdateSlot` on change; `setLocked(locked: boolean)` — disables all inputs and shows a "Loadout locked during combat" banner; `handleUpdateRejected(payload: LoadoutUpdateRejectedPayload)` — shows inline rejection message on the relevant slot

- [X] T016 [US3] Update `frontend/src/ui/LeftPanel.ts`: add `'loadout'` to the tabs array with label `'⚔ Loadout'`; create `loadoutContentEl` pane (same pattern as `inventoryContentEl`); instantiate `LoadoutPanel` in the new pane with an `onUpdateSlot` callback that passes the call up to `LeftPanel`'s constructor argument; export `updateLoadout(payload)`, `setLoadoutLocked(locked)`, `handleLoadoutUpdateRejected(payload)` delegating to `LoadoutPanel`; update `showTab()` to handle `'loadout'`

- [X] T017 [US3] Update `frontend/src/scenes/GameScene.ts`: register WS handlers for `loadout:state` → call `leftPanel.updateLoadout(payload)`, `loadout:updated` → call `leftPanel.updateLoadout` (triggers a full `loadout:request` refresh), `loadout:update_rejected` → call `leftPanel.handleLoadoutUpdateRejected(payload)`; pass `onUpdateSlot` callback from LeftPanel through to `wsClient.send('loadout:update', ...)`, send `loadout:request` on game init (after character select); on `combat:start` → `leftPanel.setLoadoutLocked(true)`, on `combat:end` → `leftPanel.setLoadoutLocked(false)`

**Checkpoint**: Loadout tab renders owned abilities and slots. Assigning an ability sends a WS message, `loadout:updated` arrives, slot refreshes. During combat the tab is locked. After combat it is editable again.

---

## Phase 6: User Story 4 — Admin Ability Configuration (Priority: P3)

**Goal**: Admins can view and edit all ability properties (except effect_type) via the admin panel. Default abilities are pre-seeded; icon upload follows existing admin patterns.

**Independent Test**: Admin panel → Abilities page → edit mana cost of Power Strike → save → trigger combat in game client → active button shows updated mana cost.

- [X] T018 [P] [US4] Create `admin/backend/src/routes/abilities.ts`: Express router with `GET /` (list all abilities with icon URLs), `GET /:id` (single ability), `POST /` (create — accepts all fields except `effect_type` is required on create but then read-only in updates), `PUT /:id` (update editable fields; ignore `effect_type` if sent), `POST /:id/icon` (multer upload, saves file to `backend/assets/ability-icons/`, updates `icon_filename`), `DELETE /:id`; follow exact pattern of `admin/backend/src/routes/monsters.ts`; log all mutations with `log('info', 'admin', ...)`

- [X] T019 [P] [US4] Create `admin/frontend/src/ui/ability-manager.ts`: abilities list table (id, name, effect_type chip, mana_cost, effect_value, cooldown, slot_type, icon preview); row click opens inline edit form with inputs for all editable fields (`name`, `description`, `mana_cost`, `effect_value`, `duration_turns`, `cooldown_turns`, `priority_default`, `slot_type` dropdown); `effect_type` displayed as read-only label; icon upload input (file → `POST /:id/icon`); Save / Cancel buttons; follow existing admin page patterns (same fetch wrappers, same table/form styling)

- [X] T020 [US4] Register the abilities router in `admin/backend/src/index.ts` (`app.use('/api/abilities', abilitiesRouter)`); create `backend/assets/ability-icons/` directory; add "Abilities" link to admin frontend navigation (same nav pattern as existing pages); wire `AbilitiesPage` into admin frontend routing

**Checkpoint**: Admin panel shows Abilities nav link → page lists 9 default abilities → edit mana cost → save → game client reflects change in next combat.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Ability drop wiring, equipment UI showing new stats, final validation.

- [X] T021 Wire monster ability drops in `backend/src/game/combat/combat-session.ts` `endCombat()` method: on player win, query `monster_ability_loot` for the monster's ability drop table, roll `Math.random() * 100 < drop_chance` for each entry, call `grantAbilityToCharacter(characterId, abilityId)` for each successful roll, include `ability_drops: AbilityDroppedDto[]` in the `combat:end` payload; send `loadout:state` refresh after all grants so the loadout panel shows newly acquired abilities immediately

- [X] T022 Update item detail display in `frontend/src/ui/EquipmentPanel.ts` and `frontend/src/ui/InventoryPanel.ts`: add new mana stat fields to the item tooltip/detail section — show max_mana, mana_on_hit, mana_on_damage_taken, mana_regen, dodge_chance, crit_chance, crit_damage when non-zero; update `InventorySlotDto` usage in frontend to include new fields (add to shared protocol type if not already present)

- [X] T023 Run `npm test && npm run lint` from repo root; fix all TypeScript errors introduced by the new protocol types in existing files (particularly in `GameScene.ts`, `CombatModal.ts`, and any file that imports from `@elarion/protocol`)

- [ ] T024 Manually execute the quickstart.md smoke test checklist: loadout panel, combat flow, lockout during combat, admin ability config; fix any issues discovered

**Checkpoint**: All checklist items in quickstart.md pass. No lint or type errors. Ability drops work end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 + Phase 3 (needs `combat:start` working to test the UI)
- **Phase 5 (US3)**: Depends on Phase 2 (for DB queries); can run in parallel with Phase 4
- **Phase 6 (US4)**: Depends on Phase 2 (T002, T003 migration + ability queries); can run in parallel with Phases 3–5
- **Phase 7 (Polish)**: Depends on Phases 3–6 being substantially complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — only on Foundation
- **US2 (P2)**: Depends on US1 (combat:start must arrive before UI can be tested meaningfully)
- **US3 (P2)**: Independent of US2; depends only on Foundation (T004 loadout queries)
- **US4 (P3)**: Independent of US1–US3; depends only on Foundation (T002 migration + T003 queries)

### Within Each Phase

- Phase 2: T002–T005 are all [P] (different files); T006 depends on T002 schema; T007 depends on T003, T004, T006
- Phase 3: T008 depends on T005, T007; T009 depends on T007; T010 depends on T008; T011 depends on T004
- Phase 4: T012 is independent; T013 depends on T012
- Phase 5: T014 depends on T004; T015 independent; T016 depends on T015; T017 depends on T015, T016
- Phase 6: T018 [P] and T019 [P] are independent of each other; T020 depends on T018, T019

---

## Parallel Execution Examples

### Phase 2 — All foundational files in parallel

```
Parallel batch A (no inter-dependencies):
  Task: T002 — Create migration 018_combat_system.sql
  Task: T003 — Create db/queries/abilities.ts
  Task: T004 — Create db/queries/loadouts.ts
  Task: T005 — Create combat-engine.ts (pure functions)

Sequential after batch A:
  Task: T006 — Create combat-stats-service.ts (needs T002 schema)
  Task: T007 — Create combat-session-manager.ts (needs T003, T004, T006)
```

### Phase 4 + Phase 5 — Run UI phases in parallel

```
After Phase 3 is complete:
  Developer A: T012 → T013 (combat screen)
  Developer B: T014 → T015 → T016 → T017 (loadout panel)
```

### Phase 6 — Admin backend and frontend in parallel

```
  Task: T018 — admin/backend/src/routes/abilities.ts
  Task: T019 — admin/frontend/src/ui/AbilitiesPage.ts
Then: T020 — wire both together
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: shared protocol types
2. Complete Phase 2: migration, queries, engine, manager
3. Complete Phase 3: combat session, explore hook, WS handlers
4. **STOP and VALIDATE**: Use browser DevTools to confirm WS messages stream correctly
5. The combat loop works end-to-end; UI is raw WS inspector output at this point

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready (schema + types)
2. Phase 3 → Combat engine live → validate via DevTools (MVP ✅)
3. Phase 4 → Combat screen visible → playable with Pokemon UI
4. Phase 5 → Loadout panel → players can configure builds
5. Phase 6 → Admin abilities → content team can tune values
6. Phase 7 → Polish → drops wired, stats shown, all validated

---

## Notes

- `[P]` tasks have no inter-task file conflicts and can run simultaneously
- `[US*]` labels map to spec.md user stories for traceability
- Phase 2 MUST be fully complete before any user story begins (shared DB and types)
- US2 and US3 (both P2) can proceed in parallel after US1 is done
- Commit after each task or logical group to preserve a rollback point
- `combat-engine.ts` (T005) must remain side-effect-free — no DB calls, no WS sends
- The existing `CombatModal.ts` is NOT deleted — it still handles the legacy `outcome: 'combat'` variant during the transition
