# Research: Tool Durability & Gathering System

**Feature Branch**: `020-tool-gathering`
**Date**: 2026-03-19

## R1: Tool Properties on Item Definitions

**Decision**: Add three nullable columns to `item_definitions`: `tool_type VARCHAR(16)`, `max_durability INTEGER`, `power SMALLINT`. Only relevant when `category = 'tool'`.

**Rationale**: The existing `item_definitions` table already has category-specific nullable columns (e.g. `weapon_subtype` for weapons, `heal_power` for heals). Adding tool-specific columns follows the same flat-table pattern — no new tables needed.

**Alternatives considered**:
- Separate `tool_definitions` table with FK to `item_definitions` — rejected because the project already uses a single wide table for all item categories and a separate table would be inconsistent.
- JSONB `config` column — rejected because typed columns are easier to query and validate.

## R2: Per-Instance Durability on Inventory Items

**Decision**: Add `current_durability INTEGER` nullable column to `inventory_items`. Initialized to `item_definitions.max_durability` when a tool is granted. NULL for non-tool items.

**Rationale**: Tools are non-stackable (quantity always 1), so each inventory slot is one tool instance. Durability varies per instance, so it must live on `inventory_items`, not the definition.

**Alternatives considered**:
- Separate `tool_instances` table — rejected for same consistency reason as R1.

## R3: Gather Building Action Type

**Decision**: Add `'gather'` to the `building_actions.action_type` CHECK constraint via ALTER TABLE. Gather config stored in existing `config JSONB` column.

**Rationale**: Follows the same pattern used when `'expedition'` was added in migration 012. The JSONB config column already stores action-type-specific configuration (explore has `encounter_chance` + `monsters`, travel has `target_zone_id`).

**Alternatives considered**:
- Separate `gather_actions` table — rejected because all other action types use the JSONB config pattern.

## R4: Gather Event Configuration Schema

**Decision**: Gather action config in JSONB:
```json
{
  "required_tool_type": "pickaxe",
  "durability_per_second": 5,
  "min_seconds": 30,
  "max_seconds": 120,
  "events": [
    { "type": "nothing", "weight": 70 },
    { "type": "resource", "weight": 10, "item_def_id": 7, "quantity": 1, "message": "You found iron ore!" },
    { "type": "monster", "weight": 10, "monster_id": 3 },
    { "type": "gold", "weight": 5, "min_amount": 5, "max_amount": 15, "message": "Gold vein!" },
    { "type": "accident", "weight": 5, "hp_damage": 8, "message": "A rock falls on you!" }
  ]
}
```

**Rationale**: All event data in a single JSONB array keeps config self-contained. Weights are relative (total doesn't need to equal 100) — probability = weight / sum(weights). This matches the existing explore config pattern where `monsters` is an array of `{ monster_id, weight }`.

## R5: Gathering Session — In-Memory, Not Database

**Decision**: Active gathering sessions are tracked in-memory via a `Map<string, GatheringSession>` keyed by character ID, similar to how `CombatSession` works. No database table for active sessions.

**Rationale**: Gathering sessions are short-lived (30–120 seconds) and tick every second. Persisting each tick to the database would be wasteful. The existing combat system uses the same in-memory pattern. If the server restarts, active gathering sessions are lost — acceptable given the short duration.

**Alternatives considered**:
- Database table for gathering sessions (like `squire_expeditions`) — rejected because expeditions are hours-long and survive restarts; gathering is seconds-long and tick-heavy.

## R6: Action Lock — `in_gathering` Flag

**Decision**: Add `in_gathering BOOLEAN NOT NULL DEFAULT false` column to `characters` table. Check this flag in the building-action-handler alongside the existing `in_combat` check.

**Rationale**: The existing action lock pattern uses `in_combat: boolean` on the character. A parallel `in_gathering` flag follows the same pattern. Both flags are checked before any building action.

**Alternatives considered**:
- Generic `busy_state VARCHAR` column — rejected per YAGNI; two boolean flags are simpler than a state machine for the current needs.
- In-memory only check via the gathering session map — rejected because the database flag survives reconnections and provides a safety net against race conditions.

## R7: HP Persistence During Gathering

**Decision**: When an accident occurs, call `updateCharacter(id, { current_hp: newValue })` immediately. When combat occurs during gathering, the existing combat system already handles HP. After combat resolves, read the character's current_hp to decide whether gathering continues.

**Rationale**: The `updateCharacter()` function already supports `current_hp` updates. Accidents bypass the combat system entirely, so they need direct HP mutation. The existing combat session already persists HP changes at combat end.

## R8: Monster Combat During Gathering

**Decision**: Reuse the existing `CombatSession` class. When a monster event triggers: set `in_combat = true`, start a CombatSession, register an `onComplete` callback that resumes or ends gathering based on remaining HP.

**Rationale**: The combat system is battle-tested and handles all combat mechanics (turns, abilities, loot, XP). Reusing it avoids duplication and ensures gathering combat behaves identically to explore combat.

**Alternatives considered**:
- Simplified "auto-combat" with instant resolution — rejected because the user description says "combat monster X", implying the full combat experience.

## R9: Durability Consumption on Early Cancel / Death

**Decision**: When gathering ends for any reason (completion, early cancel, death), the full chosen duration's durability cost is applied. Implementation: at gather start, compute `totalDurabilityCost = duration * durability_per_second`. At end, set `current_durability -= totalDurabilityCost`. If result ≤ 0, destroy the tool.

**Rationale**: Per the spec, "loses all tool durability anyways" on early cancel. Applying the full cost at end (rather than per-tick) simplifies the logic and ensures consistency regardless of how the session ends.

## R10: Frontend Gathering UI

**Decision**: Add a gathering-specific section in `BuildingPanel.ts` (similar to expedition rendering) with: duration slider/input (min to max range), start button, and a progress display during gathering. Gathering events are streamed to the chat/combat log in real-time.

**Rationale**: The building panel already has special rendering for expeditions. Gathering needs its own UI because it requires duration selection (unlike explore which is instant).
