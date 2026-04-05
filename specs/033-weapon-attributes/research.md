# Research: Weapon Attributes

**Feature**: 033-weapon-attributes | **Date**: 2026-04-03

## Decisions

### 1. Database Column Types

**Decision**: `armor_penetration SMALLINT NOT NULL DEFAULT 0` (0–100), `additional_attacks SMALLINT NOT NULL DEFAULT 0` (0–10). Reuse existing `crit_chance SMALLINT` column.

**Rationale**: Matches existing combat stat columns (`dodge_chance`, `crit_chance`, `crit_damage`) which all use SMALLINT with CHECK constraints. SMALLINT is sufficient for the value ranges.

**Alternatives considered**: INTEGER (wasteful), NUMERIC/DECIMAL (unnecessary precision for whole percentages).

### 2. Armor Penetration Formula

**Decision**: Flat percentage reduction of target defence before damage subtraction.
- Formula: `effectiveDefence = floor(enemyDefence * (1 - armorPenetration / 100))`
- Then: `damage = max(1, rawDamage - effectiveDefence)`

**Rationale**: The existing damage formula is `damage = max(1, rawDamage - enemyDefence)` (flat subtraction). Armor penetration modifies the defence value before this subtraction, which is the simplest and most intuitive integration. 15% armor pen against 100 defence → 85 effective defence.

**Alternatives considered**:
- Multiplicative damage increase (harder to balance, less intuitive)
- Flat defence reduction (not percentage-based, doesn't scale with enemy defence)
- Lethality-style scaling (too complex for current system)

### 3. Additional Attacks Implementation

**Decision**: Insert a bonus-hits loop at combat start, before the first normal turn. Each bonus hit uses the player's auto-attack formula with normal damage (no crit). Applied once per combat encounter.

**Rationale**: "Before combat begins" in the spec maps to executing N auto-attacks before `startTurn()` is first called. Using the existing `playerAutoAttack()` engine function (with crit forced off) keeps it simple and consistent.

**Alternatives considered**:
- Extra attacks per turn (too powerful, changes combat pacing)
- Separate damage formula (unnecessary complexity)
- Ability-based implementation (overengineered for a passive stat)

### 4. Combat Integration Points

**Decision**: All three combat handlers (regular, boss, PvP) share `combat-engine.ts` for damage calculation. Armor penetration is added to the engine's damage functions. Additional attacks are added to each handler's combat-start sequence.

**Rationale**: The engine functions (`playerAutoAttack`, `resolveAbilityDamage`) are shared across all combat types. Adding armor pen to the engine automatically applies it everywhere. Additional attacks need handler-level integration because each handler has its own combat start flow.

**Files confirmed**:
- `combat-engine.ts:170` — player auto-attack damage calc
- `combat-engine.ts:399` — ability damage calc
- `combat-session.ts:207` — regular combat turn start
- `boss-combat-handler.ts` — boss combat start
- `arena-combat-handler.ts` — PvP combat start

### 5. Stats Transport to Frontend

**Decision**: Extend the `world.state` WebSocket message payload to include `armor_penetration`, `additional_attacks`, and `crit_chance` (gear bonus) in the character data. Currently crit/dodge are computed client-side from attributes only — gear bonuses are not displayed.

**Rationale**: The StatsBar currently shows `Crit % = dex × 0.1` without gear bonus. To show accurate totals including gear, the server must send the gear-contributed values. This also ensures the new stats are available for display.

**Alternatives considered**:
- Client-side aggregation from equipped items (violates server-authoritative principle)
- Separate stats message (unnecessary — `world.state` already carries character data)

### 6. Admin UI Pattern

**Decision**: Add three new input fields to the item modal, visible for equippable categories. Add stat pills to the item list. Follow the same conditional visibility pattern as existing fields (attack for weapons, defence for armor).

**Rationale**: The three new attributes apply to any equippable item (not just weapons), so they should be visible for all equippable categories: weapon, shield, helmet, chestplate, greaves, bracer, boots, ring, amulet.

**Files confirmed**:
- `item-modal.ts:304-320` — `updateConditionalFields()` controls visibility
- `item-manager.ts:258-273` — `formatStats()` renders pills
- `admin/backend/src/routes/items.ts:80-191` — `validateItemFields()` handles validation
