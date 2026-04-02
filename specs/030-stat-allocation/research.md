# Research: Character Stat Allocation System

**Feature**: 030-stat-allocation | **Date**: 2026-04-02

## Decision 1: Stat Derivation Formula Balancing

**Decision**: Use per-point values: CON (+4 HP, +1 ATK), STR (+2 ATK, +0.3% crit dmg), INT (+8 mana), DEX (+0.1% crit, +0.1% evasion), TOU (+1 DEF). Percentage-based stats use small fractional values to scale safely to high levels (level 50+).

**Rationale**: Current per-level auto-grants average ~15 HP, ~4 ATK, ~2 DEF. With 7 points/level spread across 5 stats, a focused build should achieve ~75% of old total power from one stat alone. Percentage stats (crit, evasion, crit damage) use low per-point values because at high levels (e.g., level 50 = 343 total points), even a full specialization build must not exceed reasonable caps — a full DEX build at level 50 yields ~34% evasion, strong but not game-breaking.

**Alternatives considered**:
- Fractional per-point values (e.g., +0.5 DEF per point) — rejected because SMALLINT storage requires rounding, making the system less predictable to players.
- Higher per-point values matching old auto-grants exactly — rejected because that would make the new system strictly better (old system granted all stats; new system lets you choose AND get the same totals).
- Class-specific derivation multipliers — rejected per spec assumption: classes differentiate via base stats, not allocation rates.

## Decision 2: Database Schema Approach

**Decision**: Add 6 columns to the `characters` table (5 attributes + unspent points) rather than a separate `character_attributes` table.

**Rationale**: Only 6 fixed attributes that every character has — no need for an EAV pattern. Columns are read on every combat stat computation and every login, so co-locating with the character row avoids JOINs. Follows the existing pattern of direct columns on `characters` (crowns, rod_upgrade_points, etc.).

**Alternatives considered**:
- Separate `character_attributes` table with rows per stat — rejected for unnecessary complexity and extra JOIN on every combat calculation. Violates Principle III (YAGNI).
- JSON column for all attributes — rejected because individual columns enable simple UPDATE SET and CHECK constraints.

## Decision 3: Combat Stats Computation Refactor

**Decision**: Modify `computeCombatStats()` to load character attributes and derive base stats from them, rather than using `max_hp`/`attack_power`/`defence` directly.

**Rationale**: The existing function queries `characters.max_hp, attack_power, defence` as base stats, then adds equipment. The new approach queries the 5 attribute columns plus class base stats, computes derived stats, then adds equipment. This keeps the single-query pattern but changes what's computed.

**Key change**: `max_hp`, `attack_power`, and `defence` columns on `characters` will NO LONGER be updated on level-up or allocation. Instead, they become stale legacy columns. Derived stats are computed at read time from: `class_base + attribute_derivation + equipment`. The migration resets these columns to class base values for compatibility, but all runtime reads use the new derivation.

**Alternative considered**: Keep `max_hp`/`attack_power`/`defence` columns updated whenever attributes change — rejected because it creates two sources of truth and risks desync. Compute-on-read is simpler and authoritative.

**UPDATE**: On reflection, keeping the columns updated IS simpler for this codebase. Many places read `characters.max_hp` directly (HP bars, death checks, respawn). Changing all of them to compute-on-read is a much larger refactor. Instead: when attributes are allocated, recompute and UPDATE the derived stat columns. The level-up service stops updating them; the training handler updates them after allocation.

**Final decision**: Keep `max_hp`/`attack_power`/`defence` columns as the "current derived base stats" (class base + attribute bonuses). Update them when attributes are allocated. This is consistent with how the existing system works — these columns represent the character's non-equipment stats.

## Decision 4: Training Handler WebSocket Protocol

**Decision**: Three message types following existing patterns:
- `training.open` (client→server): Player requests training state for a specific NPC
- `training.state` (server→client): Full attribute state, caps, unspent points, descriptions
- `training.allocate` (client→server): Map of attribute increments {constitution: 3, strength: 2, ...}
- `training.result` (server→client): Success with updated character stats, or error

**Rationale**: Follows the pattern of `crafting.open`→`crafting.state` and `crafting.start`→`crafting.started`. Request/response pairs over WebSocket, server-authoritative.

**Alternatives considered**:
- Single `training.allocate` without `training.open` — rejected because the client needs current state (caps, unspent points) before presenting the UI.
- REST endpoint for allocation — rejected per Constitution Principle I (no REST for game state).

## Decision 5: Migration Strategy for Existing Characters

**Decision**: Single SQL migration that:
1. Adds 6 new columns with DEFAULT 0
2. Adds `is_trainer` to npcs table
3. Resets `max_hp`, `attack_power`, `defence` to class base values
4. Sets `current_hp = LEAST(current_hp, base_hp)` to avoid HP exceeding new max
5. Sets `stat_points_unspent = 7 * (level - 1)`

**Rationale**: Atomic migration ensures no character is left in an inconsistent state. Retroactive points let existing players allocate immediately. HP cap prevents impossible health values.

**Alternatives considered**:
- Two-phase migration (add columns first, backfill later) — rejected as unnecessary complexity for a small table.
- Grant fewer retroactive points as a "reset penalty" — rejected per spec FR-011.

## Decision 6: StatsBar Unspent Points Badge

**Decision**: Add a small circular badge to the StatsBar that displays unspent point count when > 0. Badge is dismissible (click to hide) but reappears when new points are earned (level-up).

**Rationale**: Follows FR-016. Uses a simple CSS badge overlaid on the existing stats row. Dismissal state stored in a simple boolean on the StatsBar component — not persisted to server (resets on page refresh, which is acceptable).

**Alternatives considered**:
- Persist dismissal state to server — rejected as over-engineering for a UI hint.
- Animated pulse/glow instead of badge — deferred to polish phase, badge is MVP.
