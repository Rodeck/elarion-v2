# Tasks: Currency System (Crowns)

**Input**: Design documents from `/specs/015-currency-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ws-currency.md ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new currency service module skeleton so foundational tasks can import it.

- [x] T001 Create directory `backend/src/game/currency/` and stub file `backend/src/game/currency/crown-service.ts` with exported empty function signatures for `awardCrowns` and `rollCrownDrop`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, TypeScript types, and the core Crown service — must complete before ANY user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `backend/src/db/migrations/017_currency.sql` — `ALTER TABLE characters ADD COLUMN crowns INTEGER NOT NULL DEFAULT 0` with CHECK constraint; `ALTER TABLE monsters ADD COLUMN min_crowns INTEGER NOT NULL DEFAULT 0, ADD COLUMN max_crowns INTEGER NOT NULL DEFAULT 0` with CHECK constraints (see data-model.md)
- [x] T003 [P] Update `backend/src/db/queries/characters.ts` — add `crowns: number` field to the `Character` interface; add `addCrowns(characterId: string, amount: number): Promise<number>` function using atomic SQL `UPDATE characters SET crowns = crowns + $2 WHERE id = $1 RETURNING crowns`
- [x] T004 [P] Update `backend/src/db/queries/monsters.ts` — add `min_crowns: number` and `max_crowns: number` fields to the `Monster` interface; include both fields in `createMonster()` INSERT and `updateMonster()` dynamic SET builder
- [x] T005 [P] Update `shared/protocol/index.ts` — add `crowns: number` to `CharacterData`; add `crowns_gained?: number` to `BuildingExploreResultPayload` and `NightEncounterResultPayload`; add `CharacterCrownsChangedPayload { crowns: number }`, `CharacterCrownsChangedMessage`, and include it in the `AnyServerMessage` union
- [x] T006 Implement `backend/src/game/currency/crown-service.ts` — `awardCrowns(characterId, amount)` calls `addCrowns()` from characters.ts and returns new balance; `rollCrownDrop(monster)` returns `Math.floor(Math.random() * (monster.max_crowns - monster.min_crowns + 1)) + monster.min_crowns` (returns 0 when both are 0) — depends on T002, T003, T004

**Checkpoint**: Migration, types, and crown service ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Crown Balance on Character Panel (Priority: P1) 🎯 MVP

**Goal**: Characters start with a visible Crown balance on the StatsBar that updates in real time.

**Independent Test**: Log in with any character → StatsBar shows `CR 0`; run `/crown <name> 100` via admin chat → StatsBar updates to `CR 100` without page reload.

- [x] T007 [US1] Update `frontend/src/ui/StatsBar.ts` — add `crowns?: number` parameter to the constructor (after `defence`); create a `crownsEl: HTMLSpanElement` field; add a "CR" stat chip to the combat stats row (alongside ATK/DEF) using the same inline style pattern; implement `setCrowns(amount: number): void` method that updates `crownsEl.textContent`; call `setCrowns(crowns ?? 0)` at the end of the constructor
- [x] T008 [US1] Update `frontend/src/scenes/GameScene.ts` — pass `my_character.crowns` as the final argument when constructing `StatsBar`; add a handler for the `character.crowns_changed` message type that calls `this.statsBar.setCrowns(payload.crowns)` — depends on T005, T007

**Checkpoint**: User Story 1 complete — Crown balance visible and live-updates on admin grant.

---

## Phase 4: User Story 2 — Monsters Drop Crowns on Death (Priority: P2)

**Goal**: Each monster kill awards the player a random Crown amount within the monster's configured min–max range; the StatsBar updates immediately.

**Independent Test**: Configure a monster with `min_crowns = 10, max_crowns = 50` via admin panel → kill that monster in-game → StatsBar Crown balance increases by 10–50.

- [x] T009 [P] [US2] Update `backend/src/game/combat/explore-combat-service.ts` — on combat win, call `rollCrownDrop(monster)` from crown-service; if amount > 0 call `awardCrowns(character.id, amount)`; add `crowns_gained: amount` (omit if 0) to the returned win payload; add structured log field `crownsAwarded: amount` to the existing `combat_win_rewards` log event — depends on T006
- [x] T010 [P] [US2] Update `backend/src/game/world/night-encounter-service.ts` — same changes as T009: `rollCrownDrop`, `awardCrowns`, include `crowns_gained` in the `night.encounter_result` payload sent via `sendToSession`, log `crownsAwarded` — depends on T006
- [x] T011 [P] [US2] Update `admin/backend/src/routes/monsters.ts` — add `min_crowns` and `max_crowns` to `monsterToResponse()`; parse and validate both fields (non-negative integers, default 0) in the POST and PUT handlers; pass them to `createMonster()` and `updateMonster()` — depends on T004
- [x] T012 [P] [US2] Update `admin/frontend/src/ui/monster-manager.ts` — add `Min Crowns` and `Max Crowns` `<input type="number" min="0" value="0">` fields to the form HTML grid (alongside XP Reward); populate them in `startEdit(m)`; read and validate them in `handleSave()`; include them in the `FormData` sent to the API; display `CR ${m.min_crowns}–${m.max_crowns}` as a stat chip in `buildMonsterCard()` — depends on T004
- [x] T013 [US2] Update `frontend/src/scenes/GameScene.ts` — in the `building.explore_result` handler: if `payload.crowns_gained` is present and > 0, increment the current Crown display by calling `this.statsBar.setCrowns(this.currentCrowns + payload.crowns_gained)` and update the tracked `currentCrowns`; add the same logic to the `night.encounter_result` handler — depends on T008, T009, T010

**Checkpoint**: User Story 2 complete — killing a configured monster awards Crowns and the panel updates.

---

## Phase 5: User Story 3 — Admin Crown Grant Command (Priority: P3)

**Goal**: An admin can type `/crown <PlayerName> <Amount>` in-game chat to instantly grant Crowns to an online player.

**Independent Test**: Log in as admin → type `/crown Roddeck 1000` → Roddeck's StatsBar updates immediately; `/crown OfflinePlayer 100` → admin receives an error; `/crown Roddeck -1` → admin receives a validation error.

- [x] T014 [US3] Update `backend/src/game/admin/admin-command-handler.ts` — add `case '/crown':` to the switch in `handleAdminCommand()`; implement `handleGiveCrowns(session, args, reply)` that: validates `args[0]` (player name, required), validates `args[1]` (positive integer amount), calls `findByName(playerName)`, rejects if not found, calls `getSessionByCharacterId()` and rejects with "Player is not currently online" if absent, calls `awardCrowns(character.id, amount)`, sends `character.crowns_changed { crowns: newBalance }` via `sendToSession(targetSession, ...)`, emits a structured log event, and replies with success message; update the `default` case error message to include `/crown` in the available commands list — depends on T006

**Checkpoint**: All three user stories complete and independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories.

- [x] T015 Run `npm test && npm run lint` from the repo root; fix any TypeScript errors caused by the `crowns` field being added to `CharacterData` (any place that constructs `CharacterData` objects or reads `my_character` must include the new field)
- [ ] T016 Validate end-to-end per `specs/015-currency-system/quickstart.md` — confirm all 7 steps pass manually; verify structured logs appear correctly for crown award and admin grant events

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001) — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T005, T006)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T006) + US1 GameScene changes (T008) for frontend display
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T006)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only — no story dependencies
- **US2 (P2)**: Backend (T009, T010, T011, T012) depends on Phase 2 only; frontend (T013) additionally depends on US1 (T008)
- **US3 (P3)**: Depends on Phase 2 only — no dependency on US1 or US2

### Within Each User Story

- US1: T007 (StatsBar) → T008 (GameScene wiring) — sequential, same logical unit
- US2: T009 + T010 + T011 + T012 are all parallel after Phase 2; T013 waits for T008 + T009 + T010
- US3: T014 single task, after Phase 2

### Parallel Opportunities

Within Phase 2 (once T001 done): T003, T004, T005 can all run in parallel.
Within Phase 4: T009, T010, T011, T012 can all run in parallel.

---

## Parallel Example: Phase 2 Foundational

```text
After T001 (setup) — launch all three in parallel:

[P] T003 — characters.ts: add crowns field + addCrowns()
[P] T004 — monsters.ts: add min/max_crowns + extend create/update
[P] T005 — protocol/index.ts: CharacterData.crowns, new message types

Then T006 (crown-service.ts implementation) — depends on T003 + T004.
```

## Parallel Example: Phase 4 (User Story 2)

```text
After Phase 2 complete — launch all four in parallel:

[P] T009 — explore-combat-service.ts: crown drop on explore win
[P] T010 — night-encounter-service.ts: crown drop on night win
[P] T011 — admin/backend/routes/monsters.ts: min/max_crowns in API
[P] T012 — admin/frontend/monster-manager.ts: form inputs + card display

Then T013 (GameScene crowns_gained handler) — depends on T008 + T009 + T010.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T006)
3. Complete Phase 3: User Story 1 (T007–T008)
4. **STOP and VALIDATE**: Crown balance visible on login; admin grant updates it live
5. US1 is a complete, shippable increment

### Incremental Delivery

1. Setup + Foundational → schema + types ready
2. Add US1 (T007–T008) → Crown display live → **MVP**
3. Add US2 (T009–T013) → Killing monsters earns Crowns
4. Add US3 (T014) → Admin can grant Crowns via command
5. Polish (T015–T016) → clean build, validated end-to-end

---

## Notes

- T003, T004, T005 operate on different files — fully parallel after T001
- T009, T010, T011, T012 operate on different files — fully parallel after Phase 2
- GameScene.ts is modified in two phases (T008 in US1, T013 in US2) — must be sequential
- The `crowns` field on `CharacterData` is a breaking type change: TypeScript compilation will surface any places the type is constructed without the new field (T015 catches these)
- All Crown awards use atomic SQL increments — safe for concurrent handlers without application-level locking
- Admin command requires target player to be **online** — by design; see spec.md Assumptions
