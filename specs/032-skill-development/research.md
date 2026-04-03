# Research: Skill Development System

**Date**: 2026-04-03  
**Feature**: 032-skill-development

## Decision 1: Where to inject level-scaled ability stats

**Decision**: Modify `getCharacterLoadout()` and `getOwnedAbilities()` in `backend/src/db/queries/loadouts.ts` to JOIN against `ability_levels` and `character_ability_progress`, returning level-scaled stats instead of base stats.

**Rationale**: This is the single point where ability stats enter the system for both regular combat (`combat-session.ts:buildLoadout()`) and boss combat (`boss-combat-handler.ts:buildLoadout()`). Modifying the query layer means both combat paths get level-scaled stats without any changes to `buildLoadout()` or the combat engine itself. The `OwnedAbilityDto` fields (`mana_cost`, `effect_value`, `duration_turns`, `cooldown_turns`) are already used everywhere — we just change what values they contain.

**Alternatives considered**:
- Modify `buildLoadout()` in both combat-session.ts and boss-combat-handler.ts — rejected because it duplicates logic in two places and requires passing progress data through more layers.
- Modify combat engine functions — rejected because it touches many functions and adds repeated calculations.

**Implementation detail**: The SQL query uses a LEFT JOIN on `character_ability_progress` (for current level) and a subquery/lateral join on `ability_levels` with fallback: `COALESCE(al.effect_value, a.effect_value)`. For partial level definitions, use `ability_levels WHERE level <= current_level ORDER BY level DESC LIMIT 1`.

## Decision 2: Skill book handler pattern

**Decision**: Follow the `stat-training-handler.ts` pattern — standalone handler file in `backend/src/game/skill/skill-book-handler.ts` with WS message registration in `backend/src/index.ts`.

**Rationale**: The stat training handler is the closest existing pattern to skill book usage: validates character state, consumes an inventory item, applies a random result, sends result + updated inventory state. Following this pattern ensures consistency and reduces learning curve.

**Alternatives considered**:
- Adding to an existing handler (e.g., inventory handler) — rejected because skill book logic is distinct enough to warrant its own file.
- Generic "use item" handler — rejected per YAGNI; skill books have specific logic (ability lookup, progress tracking, cooldown) that doesn't generalize cleanly.

## Decision 3: Admin ability level stats storage

**Decision**: New `ability_levels` table with composite PK `(ability_id, level)`. Level rows are independent of base ability stats. Admin API gets two new endpoints: `GET /api/abilities/:id/levels` and `PUT /api/abilities/:id/levels` (bulk upsert).

**Rationale**: Separate table keeps the abilities table unchanged (backward compatible). Composite PK naturally enforces one row per ability per level. Bulk upsert (all 5 levels at once) matches the admin UI pattern of editing a table and saving.

**Alternatives considered**:
- JSONB column on abilities table — rejected because it's harder to query in JOINs and doesn't enforce level constraints.
- 5 separate columns per stat per level on abilities table — rejected because it would add 20 columns (4 stats × 5 levels) which is unwieldy.

## Decision 4: Frontend progress state delivery

**Decision**: Extend the existing `loadout:state` payload to include ability progress data alongside owned abilities. Send updated progress state after skill book usage alongside `inventory.state`.

**Rationale**: The loadout panel already receives `loadout:state` on login with owned abilities. Adding progress data (level, points, cooldown) to each `OwnedAbilityDto` avoids a separate message round-trip. After skill book usage, the handler sends updated `loadout:state` (like stat-training sends updated `inventory.state`).

**Alternatives considered**:
- Separate `ability-progress.state` message — rejected because it would require the frontend to correlate two data sources. Embedding progress in the existing owned ability data is simpler.

## Decision 5: Cooldown enforcement

**Decision**: Store `last_book_used_at TIMESTAMPTZ` per character per ability in `character_ability_progress`. Server checks `now() - last_book_used_at < 6 hours` before allowing usage. Cooldown is per-ability, not global.

**Rationale**: Timestamp-based cooldown is simpler than a separate cooldown table or expiry field. The 6-hour constant is hardcoded server-side. Per-ability tracking means each row in `character_ability_progress` independently tracks its own cooldown.

**Alternatives considered**:
- Global cooldown across all abilities — rejected by design requirement (per-ability independence).
- Storing cooldown expiry (`cooldown_expires_at`) instead of last-used time — equivalent in practice; last-used is slightly more flexible if cooldown duration changes in future.

## Decision 6: New item category handling

**Decision**: Add `skill_book` to all category validation arrays. Add nullable `ability_id INTEGER REFERENCES abilities(id)` column to `item_definitions`. Skill books are stackable (add to `STACKABLE_CATEGORIES`).

**Rationale**: The `ability_id` column on `item_definitions` provides a clean FK link from skill book items to abilities. Nullable means non-skill-book items are unaffected. Stackable because players accumulate multiple books from boss farming.

**Update locations** (per CLAUDE.md "Adding a New Item Category" checklist):
1. DB migration — extend `item_definitions.category` CHECK
2. Shared protocol — add `'skill_book'` to `ItemCategory` type
3. `scripts/game-entities.js` — add to `VALID_CATEGORIES`
4. `.claude/commands/game-entities.md` — update `create-item` docs
5. `admin/backend/src/routes/items.ts` — add to `VALID_CATEGORIES` and `STACKABLE_CATEGORIES`

## Decision 7: Admin UI overhaul approach

**Decision**: Replace the two-column layout (form left, list right) with a full-width card grid. Add/Edit opens a centered modal overlay. The modal has two sections: "Details" (existing fields) and "Level Stats" (new 5-row table).

**Rationale**: The current side-panel form is cramped and doesn't accommodate level stats. A modal provides more space, follows the pattern used by other game modals (ListItemDialog, StatTrainingModal), and makes the card grid more readable at full width.

**Alternatives considered**:
- Inline expandable cards — rejected because editing 5 levels of stats inline would make cards very tall.
- Separate "Level Stats" page/tab — rejected because it fragments the workflow; admins should see base ability and level stats together.
