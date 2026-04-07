# Research: Combat Fatigue System

**Branch**: `035-combat-fatigue` | **Date**: 2026-04-06

## Decision 1: Fatigue Configuration Storage

**Decision**: Use a dedicated `fatigue_config` table with `combat_type` as primary key.

**Rationale**: Fatigue config is structured data (3 fields per combat type), not arbitrary key-value pairs. A dedicated table provides type safety, simpler queries, and clearer schema. The existing `admin_config` table (key-value store) would require string parsing and naming conventions for 9+ keys.

**Alternatives considered**:
- `admin_config` key-value store: Simpler migration, but stringly-typed and harder to query per combat type.
- Hardcoded constants: No admin tunability — rejected per spec requirements.

## Decision 2: Fatigue State Storage

**Decision**: In-memory only, stored as fields on the existing combat session objects (`CombatSession`, `BossCombatSession`, `PvpCombatSession`).

**Rationale**: Fatigue state is ephemeral — it exists only during a combat and is derived from the round counter plus config values. No persistence needed. All three combat session types already track round state in memory.

**Alternatives considered**:
- Database table for fatigue state: Unnecessary overhead for ephemeral per-combat data that doesn't survive server restart.
- Separate FatigueState class: Over-engineering — fatigue is 4-5 fields (round counter, active flag, onset delay modifier, immunity rounds, damage reduction). Adding fields directly to session objects is simpler.

## Decision 3: Fatigue Damage Injection Point

**Decision**: Inject fatigue damage after `tickActiveEffects()` and before enemy turn / death checks in each combat handler.

**Rationale**: This matches the spec requirement that fatigue fires "after all other combat actions but before defeat checks." The three handlers have clear injection points:

- **Monster combat** (`combat-session.ts`): After line ~320 in `closeActiveWindow()`, after effect ticks, before `computeEnemyTurn()`
- **Boss combat** (`boss-combat-handler.ts`): After line ~383 in `runEnemyTurn()`, after effect ticks, before boss abilities
- **PvP arena** (`arena-combat-handler.ts`): After line ~622, after both players' effect ticks, before death check

**Alternatives considered**:
- Before effect ticks: Would mean DoTs fire after fatigue, which feels wrong (fatigue should be the very last damage source).
- As an ActiveEffect (DoT): Would conflict with anti-stacking checks and couldn't easily bypass armor. Direct HP reduction is cleaner.

## Decision 4: Fatigue as Direct Damage vs ActiveEffect

**Decision**: Apply fatigue as direct HP reduction (true damage), but ALSO add a visual fatigue debuff to the `activeEffects` array for frontend display.

**Rationale**: Fatigue damage must bypass armor/defense (spec FR-013). The existing damage pipeline applies defense calculations. Direct HP reduction is the simplest way to bypass this. However, the frontend needs an ActiveEffect entry to render the debuff icon in the existing buff/debuff UI system.

**Alternatives considered**:
- Pure ActiveEffect with custom 'fatigue' effectType: Would require modifying the damage pipeline to skip defense for fatigue effects. More invasive.
- Separate fatigue UI system: Would duplicate the buff/debuff rendering logic. The existing system handles icons, tooltips, and turn counters already.

## Decision 5: Combat Type Identification

**Decision**: Use string literals `'monster'`, `'boss'`, `'pvp'` as combat_type values in the fatigue_config table. These map directly to the three handler files.

**Rationale**: The codebase doesn't use a combat type enum — handlers are separate files with separate message prefixes (`combat:*`, `boss:*`, `arena:*`). Adding string identifiers for fatigue config is the simplest approach.

**Alternatives considered**:
- Numeric enum: Would need a mapping table. Over-engineering for 3 static values.
- Separate columns per combat type: Would make the table horizontal (one row with many columns). Harder to extend.

## Decision 6: Fatigue Timer Frontend Implementation

**Decision**: New segmented progress bar element positioned below the enemy/player HP bars. Separate from the buff/debuff system (which handles the debuff icon once fatigue activates).

**Rationale**: The timer bar is a countdown that exists BEFORE fatigue activates (spec User Story 3). The buff/debuff system only shows effects that are currently active. The timer needs its own UI element. Once fatigue activates, the bar changes appearance (red/pulse per clarification) AND a debuff icon appears in the buff/debuff area.

**Alternatives considered**:
- Timer as a buff effect: Confusing UX — showing a "buff" before the negative effect starts.
- Single combined element: Harder to implement the dual display (timer + debuff) required by spec.

## Decision 7: New CombatEventKind

**Decision**: Add `'fatigue_damage'` to the `CombatEventKind` union type.

**Rationale**: Fatigue damage needs distinct combat log entries (spec FR-014). The existing event formatting in `CombatScreen.formatEvent()` switches on event kind. A new kind allows distinct formatting with appropriate icon/color.

## Decision 8: Protocol Message Extension

**Decision**: Extend existing combat start and turn result payloads with optional fatigue fields rather than creating new message types.

**Rationale**: Fatigue is metadata on existing combat flow, not a separate flow. Adding optional fields to `CombatStartPayload`, `CombatTurnResultPayload` (and boss/arena equivalents) is backward-compatible and doesn't require new message handlers.

**Fields added to start payloads**: `fatigue_config: { start_round, base_damage, increment }` (for timer display)
**Fields added to turn result payloads**: `fatigue_state: { round, active, current_damage, immunity_rounds_left }` (for timer/debuff update)

## Decision 9: Migration Strategy

**Decision**: Single migration `039_combat_fatigue.sql` creating the `fatigue_config` table with default rows for all three combat types.

**Rationale**: Pre-populating rows ensures the game works immediately after migration (fatigue disabled by default with start_round=0). Admins can then configure values through the admin panel.
