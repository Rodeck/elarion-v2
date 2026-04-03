# Tasks: Skill Development System

**Input**: Design documents from `/specs/032-skill-development/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/  
**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story. US1 (Use Skill Book) and US4 (Combat Uses Leveled Stats) are merged into one phase because they share the same backend infrastructure (DB queries, combat engine changes).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4, US5, US6)
- Includes exact file paths

---

## Phase 1: Setup

**Purpose**: Database migration and shared type definitions — foundation for all subsequent work.

- [x] T001 Create migration `backend/src/db/migrations/035_skill_development.sql` — ALTER `item_definitions` to add `ability_id INTEGER REFERENCES abilities(id) ON DELETE SET NULL`, extend `category` CHECK constraint to include `'skill_book'`, CREATE TABLE `ability_levels` with composite PK `(ability_id, level)` and columns `effect_value`, `mana_cost`, `duration_turns`, `cooldown_turns`, CREATE TABLE `character_ability_progress` with composite PK `(character_id, ability_id)` and columns `current_level`, `current_points`, `last_book_used_at`, INSERT level 1 rows into `ability_levels` for all existing abilities using their current base stats from `abilities` table
- [x] T002 Extend shared protocol types in `shared/protocol/index.ts` — add `'skill_book'` to `ItemCategory` union, add `ability_id: number | null` to `ItemDefinitionDto`, add `AbilityLevelStatsDto` interface (`level`, `effect_value`, `mana_cost`, `duration_turns`, `cooldown_turns`), extend `OwnedAbilityDto` with skill progress fields (`level`, `points`, `points_to_next`, `cooldown_until`, `current_level_stats`, `next_level_stats`), add `SkillBookUsePayload` (`slot_id`), `SkillBookResultPayload` (`ability_id`, `ability_name`, `points_gained`, `new_points`, `new_level`, `leveled_up`, `cooldown_until`), `SkillBookErrorPayload` (`message`) — follow contracts in `specs/032-skill-development/contracts/skill-book-messages.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB query modules and item category support that ALL user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Create `backend/src/db/queries/ability-levels.ts` — export functions: `getAbilityLevels(abilityId)` returns all level rows sorted by level ASC, `getAbilityLevelStats(abilityId, level)` returns stats for specific level with fallback to highest defined level below requested level (use `WHERE ability_id = $1 AND level <= $2 ORDER BY level DESC LIMIT 1`), `upsertAbilityLevels(abilityId, levels[])` bulk upserts level rows (DELETE + INSERT in transaction)
- [x] T004 [P] Create `backend/src/db/queries/ability-progress.ts` — export functions: `getAbilityProgress(characterId, abilityId)` returns single progress row or null, `getAllAbilityProgress(characterId)` returns all progress rows for a character, `upsertAbilityProgress(characterId, abilityId, level, points, lastBookUsedAt)` INSERT ON CONFLICT UPDATE, interfaces for `AbilityProgressRow`
- [x] T005 [P] Update `backend/src/db/queries/inventory.ts` — add `ability_id: number | null` to `ItemDefinition` interface, add `ability_id` to all SELECT column lists in `getInventoryWithDefinitions()` and `getItemDefinitionById()`
- [x] T006 Add `'skill_book'` to `VALID_CATEGORIES` array and `STACKABLE_CATEGORIES` set in `admin/backend/src/routes/items.ts` (line 44 and 46), add validation branch for `skill_book` category in `validateItemFields()` — require `stack_size` (stackable), accept optional `ability_id` field, reject weapon/defence/tool stats
- [x] T007 [P] Add `'skill_book'` to `VALID_CATEGORIES` array and `STACKABLE_CATEGORIES` set in `scripts/game-entities.js` (lines 12 and 18), add `ability_id` to item creation payload when category is `skill_book`

**Checkpoint**: Foundation ready — DB queries, shared types, and category support in place.

---

## Phase 3: US1 + US4 — Core Skill Book Mechanics (Priority: P1) MVP

**Goal**: Players can use skill books from inventory to gain skill points. Combat engine uses level-scaled ability stats. This is the core gameplay loop.

**Independent Test**: Grant a player an ability + skill book via admin. Use the book from inventory. Verify points gained and level-up at 100 pts. Enter combat and verify ability uses level-scaled stats.

### Implementation

- [x] T008 [US1] [US4] Modify `getCharacterLoadout()` in `backend/src/db/queries/loadouts.ts` — LEFT JOIN `character_ability_progress cap` on `(cap.character_id = cl.character_id AND cap.ability_id = cl.ability_id)`, LEFT JOIN LATERAL `ability_levels al` on `(al.ability_id = a.id AND al.level <= COALESCE(cap.current_level, 1) ORDER BY al.level DESC LIMIT 1)`, replace ability stat fields with `COALESCE(al.effect_value, a.effect_value)`, `COALESCE(al.mana_cost, a.mana_cost)`, `COALESCE(al.duration_turns, a.duration_turns)`, `COALESCE(al.cooldown_turns, a.cooldown_turns)` — this single change makes both regular and boss combat use level-scaled stats
- [x] T009 [US1] [US4] Modify `getOwnedAbilities()` in `backend/src/db/queries/loadouts.ts` — LEFT JOIN `character_ability_progress cap`, LEFT JOIN LATERAL `ability_levels al` for current level stats, LEFT JOIN LATERAL `ability_levels al_next` for next level stats (`level = COALESCE(cap.current_level, 1) + 1`), extend returned `OwnedAbilityDto` with `level`, `points`, `points_to_next`, `cooldown_until` (compute from `last_book_used_at + interval '6 hours'`), `current_level_stats`, `next_level_stats`
- [x] T010 [US1] Create `backend/src/game/skill/skill-book-handler.ts` — register WS handlers for `skill-book.use`, implement `handleSkillBookUse(session, payload: SkillBookUsePayload)`: validate character exists + not in combat, get inventory slot + validate category is `skill_book`, get `ability_id` from item definition, check character owns ability via `characterOwnsAbility()`, get/create progress row, check cooldown (`last_book_used_at + 6h > now()` → reject with remaining time), check max level (5 → reject), consume 1 item (decrement or delete), roll points (rand: <0.60→10, <0.90→20, <0.99→30, else→50), update progress (if points >= 100: level++, points -= 100), set `last_book_used_at = now()`, upsert progress, send `skill-book.result`, send `inventory.state` and `loadout:state` — follow `stat-training-handler.ts` pattern for structure and logging
- [x] T011 [US1] Register skill book handlers in `backend/src/index.ts` — import and call `registerSkillBookHandlers(dispatcher)` following the existing handler registration pattern (e.g., `registerStatTrainingHandlers`)
- [x] T012 [US1] Add "Use" button to inventory detail panel in `frontend/src/ui/InventoryPanel.ts` — when selected item has `category === 'skill_book'`, render a "Use" button (styled like delete button but with gold/green accent), on click send `skill-book.use` with `{ slot_id }` via WebSocket client
- [x] T013 [US1] Register skill book WS handlers in `frontend/src/scenes/GameScene.ts` — add `client.on<SkillBookResultPayload>('skill-book.result', ...)` handler that shows a toast notification (reuse existing notification pattern) with "[ability_name]: +[points] points" and "LEVEL UP!" if leveled_up is true, add `client.on<SkillBookErrorPayload>('skill-book.error', ...)` handler that shows error toast with message text

**Checkpoint**: Core skill book loop works end-to-end. Players can use books, gain points, level up, and combat uses leveled stats. MVP complete.

---

## Phase 4: US2 — View Skill Progress in Loadout (Priority: P1)

**Goal**: Loadout panel shows ability level badges, progress bars, and cooldown timers for all owned abilities.

**Independent Test**: Open loadout panel with abilities at different levels/cooldowns. Verify level badges, progress bars, and countdown timers display correctly.

**Depends on**: Phase 3 (progress data in `OwnedAbilityDto` from T009)

### Implementation

- [x] T014 [US2] Modify owned ability list rows in `frontend/src/ui/LoadoutPanel.ts` — for each ability in the owned list, add: level badge element ("Lv.N" in gold text, 9px font, positioned after name), progress bar element (100px wide, 4px tall, gold fill `#d4a84b` on dark bg `#1a1814`, width = `points / 100 * 100%`), at level 5 show "MASTERED" badge instead of progress bar (green text `#27ae60`), cooldown timer element (if `cooldown_until > now()`: show "Xh Ym" in red text `#c06060`, update every 60s via `setInterval`, hide when expired)
- [x] T015 [US2] Modify loadout slot cells in `frontend/src/ui/LoadoutPanel.ts` — for occupied slots, add a small level badge overlay (top-left corner, "Lv.N", 8px font, semi-transparent dark bg) using the ability's level from the `OwnedAbilityDto` progress data
- [x] T016 [US2] Handle loadout state refresh in `frontend/src/ui/LoadoutPanel.ts` — ensure `updateLoadout()` method re-renders progress bars and cooldown timers when receiving updated `loadout:state` after skill book usage (the payload now includes extended `OwnedAbilityDto` with level/points/cooldown fields)

**Checkpoint**: Loadout panel displays full skill progress information. Combined with Phase 3, players can use books and see their progress update in real-time.

---

## Phase 5: US3 — Skill Detail Modal (Priority: P2)

**Goal**: Clicking an ability in the loadout opens a detailed modal with current/next level stats, progress, and cooldown.

**Independent Test**: Click an ability in the loadout. Verify modal shows ability icon, level, progress bar, current stats, next level stats, and cooldown timer.

**Depends on**: Phase 4 (loadout progress display, click target)

### Implementation

- [x] T017 [US3] Create `frontend/src/ui/SkillDetailModal.ts` — new class `SkillDetailModal` following existing modal patterns (dark overlay `rgba(0,0,0,0.6)`, centered dialog `#0d0b08` bg, gold border `#5a4a2a`, z-index 300). Content layout: ability icon (48x48, pixelated) + name + effect type chip (colored) in header row, "Level N / 5" text, progress bar (200px wide, 8px tall, gold fill, shows "X / 100" text or "MASTERED" at level 5), current stats table (effect_value, mana_cost, duration_turns, cooldown_turns with labels), next level stats section (grayed table showing improvement, hidden at level 5), cooldown status ("Can use skill book in: Xh Ym" red text, or "Ready" green text), close button (X in top-right or "Close" button bottom). Export `open(ability: OwnedAbilityDto)` and `close()` methods.
- [x] T018 [US3] Wire click handler in `frontend/src/ui/LoadoutPanel.ts` — add click event on each ability row in the owned list that calls `skillDetailModal.open(ability)` with the full `OwnedAbilityDto` (which now includes level stats), instantiate `SkillDetailModal` once in LoadoutPanel constructor, ensure modal closes on overlay click and Escape key

**Checkpoint**: Full player-facing skill system complete. Players can use books, track progress, and inspect detailed ability stats.

---

## Phase 6: US5 — Admin Ability Manager Overhaul (Priority: P2)

**Goal**: Replace the side-panel form with a full-width card grid + modal editor. Add per-level stat editing.

**Independent Test**: Open admin ability manager. Create ability via modal. Edit ability, define level 2-5 stats, save. Re-open and verify stats persisted.

**Depends on**: Phase 2 (T003 for ability-levels query functions)

### Implementation

- [x] T019 [P] [US5] Add admin API endpoints for ability levels in `admin/backend/src/routes/abilities.ts` — `GET /api/abilities/:id/levels` returns `AbilityLevelStatsDto[]` using `getAbilityLevels()`, `PUT /api/abilities/:id/levels` accepts `{ levels: AbilityLevelStatsDto[] }` body, validates each row (level 1-5, non-negative stats), calls `upsertAbilityLevels()`, returns saved rows
- [x] T020 [P] [US5] Add ability level API functions in `admin/frontend/src/editor/api.ts` — export `getAbilityLevels(abilityId): Promise<AbilityLevelStatsDto[]>`, `updateAbilityLevels(abilityId, levels): Promise<AbilityLevelStatsDto[]>`, add `AbilityLevelStatsDto` interface matching the contract
- [x] T021 [US5] Overhaul `admin/frontend/src/ui/ability-manager.ts` — replace the two-column layout (`.monster-form-col` + `.monster-list-col`) with a single full-width card grid. Remove the left-side form panel entirely. Add an "Add Ability" button above the grid. Keep the existing `buildAbilityCard()` card rendering (icon, name, stat chips, edit/delete buttons) but make the grid span full width.
- [x] T022 [US5] Add ability edit/create modal in `admin/frontend/src/ui/ability-manager.ts` — create a modal overlay (dark bg, centered dialog, same admin styling as existing forms) that opens on "Add" or "Edit" click. Modal contains two sections: **Details** section (all existing form fields: name, description, mana_cost, effect_value, duration_turns, cooldown_turns, priority_default, effect_type select, slot_type select, icon upload + AI gen), **Level Stats** section (HTML table with 5 rows for levels 1-5, 4 numeric input columns: effect_value, mana_cost, duration_turns, cooldown_turns — level 1 row pre-filled from base ability stats on create, all rows pre-filled from API on edit). Save button persists both ability details (existing PUT/POST) and level stats (`updateAbilityLevels`). Cancel/close button dismisses modal. On edit: load levels from `getAbilityLevels()` on open. Effect type select is disabled on edit (immutable after creation).

**Checkpoint**: Admin can fully manage abilities and their per-level stats through the new modal UI.

---

## Phase 7: US6 + Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates, content configuration support, CLAUDE.md checklist.

- [x] T023 [P] [US6] Add `create-skill-book` entity handler in `scripts/game-entities.js` — accepts `name`, `description`, `stack_size`, `ability_id` (required for skill books), calls POST `/api/items` with `category: 'skill_book'` and `ability_id` in payload. Add validation: `ability_id` must be a positive integer for skill_book category. Add to help text.
- [x] T024 [P] [US6] Add `set-ability-levels` entity handler in `scripts/game-entities.js` — accepts `ability_id` and `levels` array (each with `level`, `effect_value`, `mana_cost`, `duration_turns`, `cooldown_turns`), calls PUT `/api/abilities/:id/levels`. Validate level values (1-5), validate stats are non-negative integers. Add to help text.
- [x] T025 [P] Add `ability-levels` and `ability-progress` query commands to `scripts/game-data.js` — `ability-levels [ability_id]` queries and displays all level rows for an ability (or all abilities if no ID), `ability-progress [character_id]` queries and displays progress rows for a character. Format as readable tables.
- [x] T026 [P] Update `.claude/commands/game-entities.md` — document `create-skill-book` entity type (fields: name, description, stack_size, ability_id) and `set-ability-levels` entity type (fields: ability_id, levels array). Add `skill_book` to the item categories list.
- [x] T027 [P] Update `.claude/commands/game-data.md` — document `ability-levels` and `ability-progress` query commands with usage examples.
- [x] T028 [P] Update `CLAUDE.md` — add "Adding a New Skill Book" checklist section documenting: 1) create item via `create-skill-book` with ability_id, 2) define level stats via `set-ability-levels`, 3) add to boss loot tables, 4) add to expedition rewards. Also add `'skill_book'` to the "Adding a New Item Category" section's list of existing categories.
- [x] T029 Update `.claude/commands/gd.design.md` — add "Skill Books" section to the design document template, add `skill_book` to item category options, add ability level scaling table template.
- [x] T030 Run `npm test && npm run lint` from repo root to verify no regressions across all packages.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1+US4)**: Depends on Phase 2 — core MVP
- **Phase 4 (US2)**: Depends on Phase 3 (needs progress data in OwnedAbilityDto)
- **Phase 5 (US3)**: Depends on Phase 4 (needs loadout click targets)
- **Phase 6 (US5)**: Depends on Phase 2 only (can run in parallel with Phase 3-5)
- **Phase 7 (Polish)**: Depends on Phase 6 (needs admin API endpoints for script integration)

### User Story Dependencies

```
Phase 1 (Setup)
    │
Phase 2 (Foundational)
    ├────────────────────────┐
    │                        │
Phase 3 (US1+US4) MVP    Phase 6 (US5 Admin)
    │                        │
Phase 4 (US2)               │
    │                        │
Phase 5 (US3)               │
    │                        │
    └────────────────────────┘
                │
         Phase 7 (Polish)
```

### Parallel Opportunities

- **Phase 2**: T003, T004, T005, T007 can all run in parallel (different files)
- **Phase 3**: T008 and T009 are sequential (same file), but T010 can start after T004
- **Phase 6**: T019 and T020 can run in parallel (admin backend vs frontend), then T021 and T022 are sequential (same file)
- **Phase 6 vs Phase 3-5**: US5 (admin) can run entirely in parallel with US1-US4 (player-facing) since they touch different codebases (admin/ vs frontend/ + backend/game/)
- **Phase 7**: T023-T029 are all parallel (different files)

---

## Parallel Example: Phase 2

```text
# All foundational tasks in parallel (different files):
Task T003: Create ability-levels.ts query module
Task T004: Create ability-progress.ts query module
Task T005: Update inventory.ts ItemDefinition interface
Task T007: Update game-entities.js validation arrays

# Then sequential:
Task T006: Update admin items.ts (depends on shared types from T002)
```

## Parallel Example: Phase 6 + Phase 3

```text
# Admin overhaul (Phase 6) runs in parallel with player features (Phase 3):

# Stream A — Player features:
Task T008: Modify loadouts.ts getCharacterLoadout()
Task T009: Modify loadouts.ts getOwnedAbilities()
Task T010: Create skill-book-handler.ts
Task T011: Register handlers in index.ts
Task T012: Add "Use" button to InventoryPanel.ts
Task T013: Register WS handlers in GameScene.ts

# Stream B — Admin overhaul (independent):
Task T019: Add admin API level endpoints
Task T020: Add admin frontend API functions
Task T021: Overhaul ability-manager.ts layout
Task T022: Add ability modal with level stats
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Complete Phase 1: Migration + shared types
2. Complete Phase 2: DB queries + category support
3. Complete Phase 3: Skill book handler + combat integration + inventory "Use"
4. **STOP and VALIDATE**: Use a skill book, verify points/level-up, enter combat with leveled ability
5. Core gameplay loop is functional

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → MVP: Skill books work, combat uses levels (deploy/demo)
3. Phase 4 → Progress visible in loadout
4. Phase 5 → Detail modal for ability inspection
5. Phase 6 → Admin can manage level stats (parallel with 3-5)
6. Phase 7 → Tooling and content creation support

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] labels map tasks to spec user stories (US1-US6)
- US1 and US4 are merged because they share backend infrastructure (loadouts.ts, combat engine)
- US6 (boss/expedition loot) is content configuration done via admin API during `/gd.execute` — only tooling support is in scope here
- The skill-book-handler follows stat-training-handler pattern closely — reference it during implementation
- Admin overhaul (US5) is independently implementable — no dependency on player-facing features
