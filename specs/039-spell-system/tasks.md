# Tasks: Spell System

**Input**: Design documents from `/specs/039-spell-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story. 6 user stories (3×P1, 2×P2, 1×P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Migration, asset directories, shared types foundation

- [x] T001 Create database migration in `backend/src/db/migrations/043_spell_system.sql` — 5 new tables (`spells`, `spell_levels`, `spell_costs`, `character_spells`, `active_spell_buffs`), ALTER `item_definitions` (add `spell_id` column, extend category CHECK to include `spell_book_spell`), per data-model.md
- [x] T002 Create spell icon asset directory `backend/assets/spells/icons/`
- [x] T003 Add all spell-related TypeScript interfaces and message types to `shared/protocol/index.ts` — `OwnedSpellDto`, `SpellLevelStatsDto`, `SpellItemCostDto`, `SpellCostDto`, `ActiveSpellBuffDto`, `SpellStatePayload`, `SpellCastPayload`, `SpellCastOnPlayerPayload`, `SpellBookUsePayload`, `SpellCastResultPayload`, `SpellCastRejectedPayload`, `SpellBuffReceivedPayload`, `SpellBuffExpiredPayload`, `SpellBookResultPayload`, `SpellBookErrorPayload`, and corresponding WsMessage type aliases, per contracts/ws-spell-messages.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB query modules and core buff service that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create spell definition queries in `backend/src/db/queries/spells.ts` — `getAllSpells()`, `getSpellById(id)`, `getSpellLevels(spellId)`, `getSpellCosts(spellId, level)`, `createSpell(...)`, `updateSpell(...)`, `deleteSpell(id)`, `upsertSpellLevels(spellId, levels[])`, `upsertSpellCosts(spellId, level, costs[])`. Follow patterns from `backend/src/db/queries/abilities.ts` and `backend/src/db/queries/ability-levels.ts`
- [x] T005 [P] Create character spell progress queries in `backend/src/db/queries/spell-progress.ts` — `getCharacterSpells(characterId)`, `grantSpellToCharacter(characterId, spellId)`, `updateSpellProgress(characterId, spellId, level, points, lastBookUsedAt)`, `grantAllSpells(characterId)`. Follow patterns from `backend/src/db/queries/ability-progress.ts`
- [x] T006 [P] Create active spell buff queries in `backend/src/db/queries/spell-buffs.ts` — `getActiveBuffs(characterId)` (WHERE expires_at > NOW()), `upsertBuff(characterId, spellId, casterId, level, effectType, effectValue, expiresAt)`, `deleteBuff(characterId, spellId)`, `deleteExpiredBuffs()`, `getBuffBySpell(characterId, spellId)`
- [x] T007 Create spell buff service in `backend/src/game/spell/spell-buff-service.ts` — `getActiveSpellBuffModifiers(characterId)` returns aggregate percentage modifiers (attack_pct, defence_pct, crit_chance_pct, crit_damage_pct, movement_speed) from active buffs. Used by combat stats computation
- [x] T008 Modify `backend/src/game/combat/combat-stats-service.ts` — add third pass in `computeCombatStats()` after equipment aggregation: query active spell buffs via `getActiveSpellBuffModifiers()`, apply percentage modifiers multiplicatively (e.g., `finalAttack = equipAttack * (1 + sumAttackPct / 100)`), apply movement speed modifier to character's movement_speed
- [x] T009 Create spell state handler in `backend/src/game/spell/spell-state-handler.ts` — handle `spell.request_state` WS message: query character spells + active buffs, resolve level stats via LATERAL join pattern (same as ability levels), build `SpellStatePayload` with `OwnedSpellDto[]` and `ActiveSpellBuffDto[]`, send via `sendToSession`. Export `registerSpellStateHandlers()` and `sendSpellState(session)` helper
- [x] T010 Wire spell handler registration in `backend/src/index.ts` — import and call `registerSpellStateHandlers()` (and later spell cast/book handlers) in the `bootstrap()` function alongside existing `registerXxxHandlers()` calls. Send `spell:state` on player login/reconnect alongside existing `loadout:state`

**Checkpoint**: Foundation ready — spell data layer, buff service, and stat integration are operational

---

## Phase 3: User Story 1 — Admin Defines and Manages Spells (Priority: P1) 🎯 MVP

**Goal**: Admin can create, edit, and delete spell definitions with per-level stats and costs via the admin panel

**Independent Test**: Open admin panel → Spell Manager → create spell with name, icon, effect type, 5 levels with different costs → edit → delete. Verify data persists in DB.

### Implementation for User Story 1

- [x] T011 [P] [US1] Create admin spell REST routes in `admin/backend/src/routes/spells.ts` — `GET /api/spells` (list all with levels + costs), `POST /api/spells` (create with icon upload via multer), `PUT /api/spells/:id` (update definition), `DELETE /api/spells/:id`, `PUT /api/spells/:id/levels` (upsert level stats + gold costs), `PUT /api/spells/:id/costs` (upsert item costs per level). Validate effect_type against allowed values. Follow patterns from `admin/backend/src/routes/abilities.ts`
- [x] T012 [P] [US1] Create admin spell icon serving — add static route for `backend/assets/spells/icons/` in admin backend (same pattern as ability icons)
- [x] T013 [US1] Register spell routes in admin backend Express app — import and mount at `/api/spells` in admin backend's main router file
- [x] T014 [US1] Create admin Spell Manager UI in `admin/frontend/src/ui/spell-manager.ts` — `SpellManager` class rendering: spell card grid (icon, name, effect type), create/edit modal with fields (name, description, effect_type dropdown, icon upload with AI gen support), per-level stat editor (effect_value, duration_seconds, gold_cost per level 1–5), per-level item cost editor (item picker dropdown + quantity, add/remove rows for multi-item), delete confirmation. Follow patterns from `admin/frontend/src/ui/ability-manager.ts`
- [x] T015 [US1] Wire Spell Manager into admin frontend navigation — add "Spells" entry to admin sidebar/nav alongside existing "Abilities" entry, instantiate SpellManager on route activation

**Checkpoint**: Admin can fully manage spell definitions. US1 independently testable.

---

## Phase 4: User Story 2 — Player Trains Spells via Spell Books (Priority: P1)

**Goal**: Players use spell book items to gain spell progress, leveling spells from 1 to 5

**Independent Test**: Grant player a spell book item via `/item` command → use it from inventory → verify spell is learned (or progress gained), book consumed, 6h cooldown applied.

### Implementation for User Story 2

- [x] T016 [US2] Create spell book handler in `backend/src/game/spell/spell-book-handler.ts` — handle `spell-book-spell.use` WS message. Validation chain: character not in combat → inventory slot exists → `def_category === 'spell_book_spell'` → `def_spell_id` present → if character doesn't own spell, grant it → not at max level (5) → 6-hour cooldown check via `last_book_used_at`. Point rolls: 60%→10pts, 30%→20pts, 9%→30pts, 1%→50pts; 100pts = level up. On success: consume item (quantity--/delete), upsert `character_spells`, send `spell-book-spell.result`, refresh `inventory:state` + `spell:state`. Export `registerSpellBookHandlers()`
- [x] T017 [US2] Wire spell book handler registration in `backend/src/index.ts` — call `registerSpellBookHandlers()` in bootstrap
- [x] T018 [US2] Extend item use handler at `backend/src/game/inventory/inventory-use-handler.ts` — add `spell_book_spell` category check that delegates to spell book handler (or returns rejection directing player to use the spell book via the skill system). Ensure `spell_book_spell` items don't fall through to the "not_consumable" rejection
- [x] T019 [US2] Add `spell_id` to item definition queries — update `backend/src/db/queries/items.ts` to SELECT `spell_id` in item definition queries (same pattern as `ability_id` for skill books). Update the `ItemDefinitionRow` type to include `spell_id: number | null`

**Checkpoint**: Spell training via books works end-to-end. US2 independently testable.

---

## Phase 5: User Story 3 — Player Casts Spell on Self (Priority: P1)

**Goal**: Player opens Spells tab, views learned spells, casts a spell consuming resources, buff is applied

**Independent Test**: Grant player all spells + required items → open Spells tab → click spell → click Cast → verify resources deducted, buff active, stats modified.

### Implementation for User Story 3

- [x] T020 [US3] Create spell cast handler in `backend/src/game/spell/spell-cast-handler.ts` — handle `spell.cast` WS message. Validation: character not in combat → owns spell → resolve current level stats from `spell_levels` → check resources (gold + all item costs for that level atomically) → check buff replacement rule (if same spell active, new level must be >= existing level) → deduct resources in transaction (update crowns, decrement/delete inventory items) → upsert `active_spell_buffs` row → apply instant effects (heal: restore HP, energy: restore energy) → send `spell.cast_result` + `spell:state` + `inventory:state` + `character.stats_updated`. Export `registerSpellCastHandlers()`
- [x] T021 [US3] Wire spell cast handler registration in `backend/src/index.ts` — call `registerSpellCastHandlers()` in bootstrap
- [x] T022 [US3] Add human-readable duration formatter to `shared/protocol/index.ts` or a shared utility — `formatDuration(seconds: number): string` returning e.g. "1h 19min", "45min", "30s". Used by frontend
- [x] T023 [P] [US3] Create SpellPanel component in `frontend/src/ui/SpellPanel.ts` — renders list of learned spells: each row shows spell icon (from icon_url), name, `Lv.X` badge, effect type chip, training progress bar (100pt scale, same style as LoadoutPanel ability rows), 6h book cooldown countdown. Clicking a spell row opens SpellDetailModal. Empty state when no spells learned ("Learn spells by using Spell Books"). Follow patterns from `frontend/src/ui/LoadoutPanel.ts`
- [x] T024 [P] [US3] Create SpellDetailModal in `frontend/src/ui/SpellDetailModal.ts` — modal overlay with: spell icon, name, level, description, current level stats (effect value, duration in human-readable format), next level stats (if not max), resource cost display (item icons + names + quantities, gold amount), "Cast" button. Cast button disabled with reason text when: in combat, insufficient resources. On Cast click: send `spell.cast` WS message, close modal on success. Handle `spell.cast_rejected` to show error. Follow patterns from `frontend/src/ui/SkillDetailModal.ts`
- [x] T025 [US3] Add 'spells' tab to `frontend/src/ui/LeftPanel.ts` — add `'spells'` to tab union type, add tab button (label: "Spells" with ✨ or scroll icon), create content container, add `updateTabVisibility` case, add `ensureSpellPanel()` lazy initializer, add pass-through methods: `updateSpells(payload: SpellStatePayload)`, `setSpellsLocked(locked: boolean)` for combat state. Follow existing tab pattern (inventory/equipment/loadout/squires)
- [x] T026 [US3] Wire SpellPanel into GameScene at `frontend/src/scenes/GameScene.ts` — handle `spell:state` WS message → call `leftPanel.updateSpells(payload)`. Handle `spell.cast_result` → show chat feedback message. Handle `spell.cast_rejected` → show error in chat. Handle `spell-book-spell.result` → show training feedback. Handle `spell-book-spell.error` → show error. Lock spells tab on combat start, unlock on combat end

**Checkpoint**: Full self-casting flow works. US3 independently testable.

---

## Phase 6: User Story 4 — Active Buffs Display / XP Ring (Priority: P2)

**Goal**: XP shown as circular ring around level badge. Active buffs displayed as icons with countdown progress bars. Tooltips on hover.

**Independent Test**: Cast a buff → verify buff icon appears in stats bar area with progress bar → hover shows tooltip with name, effect, remaining time. Verify XP ring shows correct progress.

### Implementation for User Story 4

- [x] T027 [US4] Modify XP display in `frontend/src/ui/StatsBar.ts` — replace horizontal XP bar with SVG circular progress ring around the level badge. Use `stroke-dasharray`/`stroke-dashoffset` for the arc. Show level number centered inside. On hover, show tooltip with "X / Y XP" exact values. Remove old XP bar elements. Use CSS custom properties from tokens.css for colors (gold-primary for filled arc, bg-panel for track)
- [x] T028 [US4] Create BuffBar component in `frontend/src/ui/BuffBar.ts` — renders in the space vacated by the XP bar inside StatsBar. Displays active buffs as a horizontal row of small icons, each with a mini progress bar underneath showing remaining time ratio (filled portion = time remaining / total duration). Icons sourced from `ActiveSpellBuffDto.icon_url`. Auto-updates every second via `setInterval` to decrement visual progress. Handles buff additions and removals via `updateBuffs(buffs: ActiveSpellBuffDto[])`. On hover over a buff icon, shows styled game tooltip with: spell name, effect description (e.g., "+10% Attack"), remaining time in human-readable format, caster name
- [x] T029 [US4] Integrate BuffBar into StatsBar at `frontend/src/ui/StatsBar.ts` — instantiate BuffBar in the area where XP bar was. Add `updateBuffs(buffs: ActiveSpellBuffDto[])` method to StatsBar that delegates to BuffBar. Wire `spell:state` and `spell.buff_expired` messages to update the buff display
- [x] T030 [US4] Wire buff display updates in `frontend/src/scenes/GameScene.ts` — on `spell:state` message, extract `active_buffs` and call `statsBar.updateBuffs(payload.active_buffs)`. On `spell.buff_expired`, remove the expired buff from display. On `spell.buff_received`, add the new buff to display

**Checkpoint**: XP ring and buff display work. US4 independently testable.

---

## Phase 7: User Story 5 — Cast Spell on Another Player (Priority: P2)

**Goal**: Player opens another player's detail modal and casts a spell on them

**Independent Test**: Two players in same location → Player A opens Player B's modal → sees spell list → casts → Player A's resources deducted, Player B receives buff and sees it.

### Implementation for User Story 5

- [x] T031 [US5] Add cast-on-player handler to `backend/src/game/spell/spell-cast-handler.ts` — handle `spell.cast_on_player` WS message. Additional validations beyond self-cast: target character exists, target is in same location as caster. On success: deduct caster's resources, upsert buff on target, send `spell.cast_result` to caster + `spell:state` to caster, send `spell.buff_received` to target + `spell:state` to target + `character.stats_updated` to target. Register handler in same export
- [x] T032 [US5] Modify PlayerDetailModal at `frontend/src/ui/PlayerDetailModal.ts` — extend `open()` to accept spell data. In the `actionsContainer`, render a "Cast Spell" section: list of player's learned spells (icon + name + level + cast button each). On cast button click, send `spell.cast_on_player` WS message with spell_id and target player's character_id. Show loading state while waiting for result. Handle success (close modal or show confirmation) and rejection (show error inline). Add `setSpells(spells: OwnedSpellDto[])` method and `setOnSpellCast(callback)` for wiring
- [x] T033 [US5] Wire PlayerDetailModal spell casting in `frontend/src/scenes/GameScene.ts` — when opening player detail modal, pass current spell state. Handle `spell.cast_result` for cast-on-player confirmations (show chat feedback: "You cast Haste on PlayerB")

**Checkpoint**: Cross-player casting works. US5 independently testable.

---

## Phase 8: User Story 6 — Admin Commands (Priority: P3)

**Goal**: `/spells.all` grants all spells; `/skill_all` renamed to `/abilities.all`

**Independent Test**: Admin types `/spells.all player` → player receives all spells. Admin types `/abilities.all player` → works as old `/skill_all`. Old `/skill_all` still works (alias or removed).

### Implementation for User Story 6

- [x] T034 [US6] Add `/spells.all` command to `backend/src/game/admin/admin-command-handler.ts` — pattern: parse player name, resolve character, call `grantAllSpells(characterId)` from spell-progress queries, if target is online push `spell:state`, send confirmation to admin chat
- [x] T035 [US6] Rename `/skill_all` to `/abilities.all` in `backend/src/game/admin/admin-command-handler.ts` — update the command string from `'skill_all'` to `'abilities.all'` in the handler dispatch. Keep `/skill_all` as a backward-compatible alias (both trigger the same handler) to avoid breaking existing admin workflows

**Checkpoint**: Admin commands work. US6 independently testable.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates, logging, CLAUDE.md checklist per constitution Principle VI

- [x] T036 [P] Add structured logging to all spell handlers — spell cast (character_id, spell_id, target_id, level, success/failure), spell book use (character_id, spell_id, points_gained, leveled_up), buff expiry events. Use existing logger patterns from other handlers
- [x] T037 [P] Update `scripts/game-data.js` — add `spells` command (list all spell definitions with levels and costs), `spell-buffs` command (list active buffs for a character or all). Update `.claude/commands/game-data.md` with new commands
- [x] T038 [P] Update `scripts/game-entities.js` — add `create-spell` command (create spell definition via admin API), `create-spell-book-spell` command (create spell book item linked to spell_id), `set-spell-levels` command (set level stats + costs). Add `'spell_book_spell'` to `VALID_CATEGORIES` array. Update `.claude/commands/game-entities.md` with new commands
- [x] T039 [P] Update `CLAUDE.md` — add "Adding a New Spell" checklist section documenting all update locations (migration, shared protocol, spell queries, cast handler, admin routes, admin UI, game-entities script, LeftPanel tab). Add "Adding a New Spell Effect Type" checklist if adding new effect_type values
- [x] T040 [P] Update game design skills — update `.claude/commands/gd.design.md` to include spell definitions in design document templates (spell name, effect type, levels, costs). Update `.claude/commands/gd.execute.md` to support creating spells via admin API. Update `.claude/commands/gd.review.md` to validate spell balance
- [x] T041 Run quickstart.md verification — follow all steps in `specs/039-spell-system/quickstart.md` to validate end-to-end flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (migration applied, types defined)
- **Phase 3 (US1 Admin)**: Depends on Phase 2 (spell queries)
- **Phase 4 (US2 Training)**: Depends on Phase 2 (spell progress queries)
- **Phase 5 (US3 Self-Cast)**: Depends on Phase 2 (buff queries, buff service, state handler)
- **Phase 6 (US4 Buff Display)**: Depends on Phase 5 (needs active buffs to display)
- **Phase 7 (US5 Cast on Player)**: Depends on Phase 5 (extends cast handler)
- **Phase 8 (US6 Commands)**: Depends on Phase 2 (spell progress queries)
- **Phase 9 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (Admin)**: Independent after Phase 2
- **US2 (Training)**: Independent after Phase 2
- **US3 (Self-Cast)**: Independent after Phase 2
- **US4 (Buff Display)**: Depends on US3 (needs cast flow to generate buffs to display)
- **US5 (Cast on Player)**: Depends on US3 (extends the cast handler)
- **US6 (Commands)**: Independent after Phase 2

### Within Each User Story

- Backend before frontend (handlers before UI)
- Query modules before handlers
- Handlers before GameScene wiring

### Parallel Opportunities

- Phase 2: T004, T005, T006 are fully parallel (separate files)
- Phase 3: T011, T012 are parallel (separate files)
- Phase 4+5+8: US2, US3, US6 backend work can run in parallel after Phase 2
- Phase 5: T023, T024 are parallel (separate frontend files)
- Phase 9: T036–T040 are all parallel (separate files)

---

## Parallel Example: Phase 2 (Foundational)

```
# Launch all query modules in parallel:
Task T004: "Create spell definition queries in backend/src/db/queries/spells.ts"
Task T005: "Create character spell progress queries in backend/src/db/queries/spell-progress.ts"
Task T006: "Create active spell buff queries in backend/src/db/queries/spell-buffs.ts"

# Then sequentially:
Task T007: "Create spell buff service" (depends on T006)
Task T008: "Modify computeCombatStats" (depends on T007)
Task T009: "Create spell state handler" (depends on T004, T005, T006)
Task T010: "Wire registration" (depends on T009)
```

## Parallel Example: Phase 5 (US3 Self-Cast)

```
# Backend first:
Task T020: "Create spell cast handler" (depends on Phase 2)
Task T021: "Wire handler registration" (depends on T020)

# Frontend in parallel (separate files):
Task T023: "Create SpellPanel" (can start after T003 types are defined)
Task T024: "Create SpellDetailModal" (can start after T003 types are defined)

# Then sequentially:
Task T025: "Add spells tab to LeftPanel" (depends on T023)
Task T026: "Wire into GameScene" (depends on T020, T024, T025)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: Foundational (queries + buff service + stat integration)
3. Complete Phase 3: US1 Admin (spell definitions manageable)
4. Complete Phase 4: US2 Training (spell books work)
5. Complete Phase 5: US3 Self-Cast (full cast flow)
6. **STOP and VALIDATE**: Admin can define spells, player can train and cast. Core loop complete.

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. US1 (Admin) → Spells can be defined
3. US2 (Training) → Players can learn spells
4. US3 (Self-Cast) → Players can cast on self — **MVP complete**
5. US4 (Buff Display) → Visual polish for active buffs
6. US5 (Cast on Player) → Social/party mechanic
7. US6 (Commands) → Admin QoL
8. Polish → Tooling, logging, documentation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Total: 41 tasks across 9 phases
- No test tasks generated (not requested)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
