# Tasks: Character Rankings

**Input**: Design documents from `/specs/026-character-rankings/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database migration and shared protocol types

- [x] T001 Create migration file `backend/src/db/migrations/028_character_rankings.sql` — ALTER TABLE characters ADD COLUMN combat_wins INTEGER NOT NULL DEFAULT 0
- [x] T002 [P] Add ranking DTO interfaces to `shared/protocol/index.ts` — RankingsDataPayload, LeaderboardEntryDto, MapPopulationDto, and MyRanksDto as defined in contracts/websocket.md

---

## Phase 2: Foundational (Backend Core)

**Purpose**: Backend ranking computation engine and combat win tracking — MUST complete before any frontend work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Increment combat_wins on player victory in `backend/src/game/combat/combat-session.ts` — Inside endCombat('win') block after the awardXp() call (~line 355), add a query to increment characters.combat_wins by 1 for the winning character. Log the event with structured logging.
- [x] T004 Create `backend/src/game/rankings/rankings-service.ts` — Implement periodic ranking computation with setInterval (5-minute interval). Run 6 SQL queries (top level, top fighters, top crafters, top questers, map population, total players) and store results in an exported in-memory RankingSnapshot object. Include a function to compute a requesting player's own rank in each category. Export getSnapshot() and getPlayerRanks(characterId) functions. Add structured logging for computation timing and errors.
- [x] T005 Create `backend/src/game/rankings/rankings-handler.ts` — Implement handleRankingsGet(session, payload) handler. Validate authenticated session with active character. Read cached snapshot from rankings-service, compute player's own ranks, and respond with 'rankings.data' payload matching the contract. Handle edge case where snapshot is not yet computed (return empty arrays with current timestamp).
- [x] T006 Register rankings handler in `backend/src/websocket/dispatcher.ts` — Import rankings-handler and register 'rankings.get' message type via registerHandler().

**Checkpoint**: Backend is ready — rankings.get returns valid data. Frontend work can begin.

---

## Phase 3: User Story 1 & 2 — View & Browse Rankings (Priority: P1) MVP

**Goal**: Player can open a rankings panel from the top bar and browse all five leaderboard categories with their own rank visible.

**Independent Test**: Click "Rankings" button in top bar → panel opens showing Top Level tab → switch to each category tab → verify ranked entries with class info → verify own rank shown (highlighted in list or appended below top 20) → close panel.

### Implementation

- [x] T007 [US1] Create `frontend/src/ui/RankingsPanel.ts` — Build a tabbed overlay panel modeled after QuestLog.ts. Include: container (absolute positioned, z-index 150, ~400px wide), header with title "Rankings" and close button (x), tab bar with 5 tabs (Level, Fighters, Crafters, Questers, Maps), scrollable content area. Style with dark medieval theme matching existing panels (Cinzel font for headers, Crimson Text for body, gold accents #d4a84b, dark backgrounds rgba(20,17,12,0.95)). Implement show(), hide(), toggle(), isVisible() methods. Add setSendFn() for WS communication. On show(), call sendFn('rankings.get', {}).
- [x] T008 [US1] Implement leaderboard rendering in `frontend/src/ui/RankingsPanel.ts` — Add handleRankingsData(payload: RankingsDataPayload) method. For each leaderboard tab, render ranked entries showing: rank number, class icon/name (from class_id), character name, and stat value. Highlight the player's own entry with a distinct background color (gold tint). If player is not in the top 20, append a separator row ("...") followed by their rank and stats below the list. Tab switching re-renders the content area with the selected category's data.
- [x] T009 [P] [US2] Add Rankings button to top bar in `frontend/src/scenes/GameScene.ts` — In the setupTopBarButtons method (near the questLogBtn creation ~line 1448), create a "Rankings" button with identical styling to the Quests button. Position it to the left of the Quests button (e.g., right:160px). On click, call rankingsPanel.toggle() and if visible, send 'rankings.get' message.
- [x] T010 [US1] Wire rankings panel and message handler in `frontend/src/scenes/GameScene.ts` — Import RankingsPanel. Instantiate it in create() with container mounted in '#game'. Wire setSendFn with the WS client. Register client.on('rankings.data', ...) handler that calls rankingsPanel.handleRankingsData(payload). Store rankingsPanel as a private field.

**Checkpoint**: User Stories 1 and 2 are fully functional — player can open panel, browse all 5 categories, see their own rank, and close the panel.

---

## Phase 4: User Story 3 & 4 — Server Stats & Freshness (Priority: P2)

**Goal**: Player sees total server population and knows how fresh the ranking data is.

**Independent Test**: Open rankings panel → verify total player count is displayed → verify "Last updated" timestamp is shown → verify timestamp updates after next calculation cycle.

### Implementation

- [x] T011 [P] [US3] Add total player count display to `frontend/src/ui/RankingsPanel.ts` — In the panel header area (below title, above tabs), render "X players on server" from the total_players field of the rankings payload. Style as a subtle stat line in smaller font.
- [x] T012 [P] [US4] Add "Last updated" timestamp to `frontend/src/ui/RankingsPanel.ts` — Below the tab content area (or in the panel footer), display "Updated: X minutes ago" computed from the updated_at field. Format as relative time (e.g., "2 min ago", "just now"). Update on each rankings.data receive.

**Checkpoint**: All 4 user stories complete. Full feature is functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, empty states, and final cleanup

- [x] T013 Handle empty/loading states in `frontend/src/ui/RankingsPanel.ts` — Show a loading indicator while waiting for rankings.data response. If arrays are empty, show "No rankings available yet" message. If panel is opened before first server calculation, display gracefully.
- [x] T014 Run migration and verify end-to-end — Apply 028_character_rankings.sql migration, start backend, open game, win a combat, verify combat_wins increments, open rankings panel, verify all categories display correctly with own rank.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (migration) for combat_wins column; T002 (protocol types) for handler types
- **User Stories (Phase 3)**: Depends on Phase 2 completion (backend must serve data)
- **Server Stats & Freshness (Phase 4)**: Depends on Phase 3 (panel must exist to add stats to)
- **Polish (Phase 5)**: Depends on Phase 4 completion

### User Story Dependencies

- **US1+US2 (P1)**: Can start after Phase 2. These are combined because the backend serves all categories in one payload and the frontend panel inherently supports tabs.
- **US3+US4 (P2)**: Can start after Phase 3. Small additions to existing panel — total count and timestamp display.

### Within Each Phase

- T001 and T002 can run in parallel (different files)
- T003, T004, T005 are sequential (T004 depends on T003's column, T005 depends on T004's exports)
- T006 depends on T005
- T007 and T009 can run in parallel (different files)
- T008 depends on T007 (needs panel structure)
- T010 depends on T007 and T009
- T011 and T012 can run in parallel (same file but independent sections)

### Parallel Opportunities

```text
Phase 1: T001 ‖ T002
Phase 2: T003 → T004 → T005 → T006 (sequential chain)
Phase 3: T007 ‖ T009, then T008 → T010
Phase 4: T011 ‖ T012
```

---

## Parallel Example: Phase 1

```bash
# Launch both setup tasks together:
Task: "Create migration 028_character_rankings.sql"
Task: "Add ranking DTO interfaces to shared/protocol/index.ts"
```

## Parallel Example: Phase 3

```bash
# Launch panel creation and button creation together:
Task: "Create RankingsPanel.ts"
Task: "Add Rankings button to GameScene.ts top bar"

# Then after both complete:
Task: "Implement leaderboard rendering in RankingsPanel.ts"
Task: "Wire rankings panel and message handler in GameScene.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup (migration + protocol types)
2. Complete Phase 2: Foundational (combat tracking + ranking service + handler)
3. Complete Phase 3: US1+US2 (panel + button + wiring)
4. **STOP and VALIDATE**: Open rankings, browse all tabs, verify own rank
5. Ship if ready — server stats and timestamps are P2 polish

### Incremental Delivery

1. Setup + Foundational → Backend serving ranking data
2. Add US1+US2 → Full panel with all categories → Validate (MVP!)
3. Add US3+US4 → Player count + freshness indicator → Validate
4. Polish → Empty states, loading indicators → Final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined in Phase 3 because the backend serves all categories atomically and the panel needs tabs from the start
- US3 and US4 are combined in Phase 4 as small additions to the existing panel
- No test tasks generated (not requested in spec)
- Commit after each phase completion
