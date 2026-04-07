# Research: Spell System

**Feature**: 039-spell-system  
**Date**: 2026-04-07

## R1: Buff Persistence Strategy

**Decision**: Store active buffs in a PostgreSQL table (`active_spell_buffs`) with absolute expiry timestamps.

**Rationale**: The existing combat effect system is entirely in-memory (`ActiveEffect[]` in `EngineState`) and does not persist across sessions. Spell buffs must survive server restarts and player reconnections. A DB table with `expires_at TIMESTAMPTZ` allows:
- Simple expiry check: `WHERE expires_at > NOW()`
- No tick loop needed — query on demand (stat computation, reconnect, UI refresh)
- Cleanup via periodic DELETE or on-access lazy deletion

**Alternatives considered**:
- In-memory with periodic snapshot to DB — adds complexity, risk of data loss between snapshots
- Redis TTL keys — adds infrastructure dependency; PostgreSQL is sufficient for expected scale
- Store in `characters` table as JSONB column — poor queryability, hard to index

## R2: Spell Stat Integration Point

**Decision**: Add a third pass in `computeCombatStats()` that queries active spell buffs and applies percentage modifiers additively after equipment aggregation.

**Rationale**: `computeCombatStats()` already has two passes (attribute-derived, then equipment). Adding a third pass for spell buffs follows the same additive pattern. Percentage buffs (e.g., +10% attack) are applied as multiplicative on the post-equipment total: `finalAttack = baseAttack * (1 + sumOfAttackBuffPercents / 100)`.

**Alternatives considered**:
- Apply during combat engine only — would miss movement speed and other non-combat stats
- Store as flat bonus on character row — creates stale data if buff expires mid-session

## R3: Spell Training — Reuse vs New Handler

**Decision**: Create a new `spell-book-handler.ts` that mirrors the existing `skill-book-handler.ts` but targets spell-specific tables (`character_spell_progress` instead of `character_ability_progress`).

**Rationale**: The training mechanic is identical (point rolls, 6h cooldown, 5 levels, 100pts per level), but the data model is separate (spells vs abilities). A distinct handler avoids coupling spell and ability systems and keeps the item use flow clean: `skill_book` → ability handler, `spell_book_spell` → spell handler.

**Alternatives considered**:
- Extend existing skill-book-handler with a type flag — increases complexity, couples two independent systems
- Generic "book handler" abstraction — YAGNI; only two consumers, different enough to warrant separate files

## R4: Spell Cost Model — Multi-Item Support

**Decision**: Use a `spell_costs` join table with `(spell_id, level, item_def_id, quantity)` rows plus an optional `gold_cost` column on `spell_levels`.

**Rationale**: The spec requires multiple item types per level (e.g., "2x Iron Bar + 1x Ruby + 50 gold"). A join table naturally models this. Gold is on the level row since it's always 0 or 1 gold amount per level.

**Alternatives considered**:
- JSONB cost field on spell_levels — harder to validate, no referential integrity on item IDs
- Single item_def_id + quantity on spell_levels — doesn't support multi-item costs

## R5: XP Bar → Circular Ring

**Decision**: Replace the XP horizontal bar in `StatsBar` with an SVG circular progress ring around the existing level badge. Use `stroke-dasharray` / `stroke-dashoffset` for the progress arc.

**Rationale**: SVG circles are lightweight, style-able with CSS custom properties, and work well at the small size of the level badge. The existing level badge is already a circular element — wrapping it with a progress ring is a natural fit.

**Alternatives considered**:
- Canvas-based ring — heavier, harder to style consistently with CSS token system
- CSS conic-gradient — browser support is good but less precise control over stroke width/gaps

## R6: Admin Spell Management — Pattern

**Decision**: Mirror the existing Ability Manager pattern: Express REST routes in `admin/backend/src/routes/spells.ts`, admin UI in `admin/frontend/src/ui/spell-manager.ts` with icon upload via `multer`.

**Rationale**: The ability manager is the closest existing analog. Same CRUD pattern, same icon upload flow, same modal-based editing with per-level stat rows. Adding a cost configuration section (item picker + quantity + gold) is the main extension.

**Alternatives considered**: None — this is the established pattern and there's no reason to deviate.

## R7: New Item Category Name

**Decision**: `spell_book_spell` as the new item category.

**Rationale**: Distinguishes from existing `skill_book` category. The naming pattern `spell_book_spell` follows the same structure — "book type" + "what it trains". The `item_definitions` table will need a new column `spell_id` (nullable, references `spells.id`) alongside the existing `ability_id` column.

**Alternatives considered**:
- `spell_book` — too similar to `skill_book`, easy to confuse
- `spellbook` — inconsistent with existing underscore convention
