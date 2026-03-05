# Research: Monster Combat System (008)

**Date**: 2026-03-04
**Branch**: `008-monster-combat`

---

## Decision 1: Combat Trigger Mechanism

**Decision**: Extend the existing `city.building_action` WebSocket message to support `action_type: 'explore'`. The same handler (`handleBuildingAction`) is extended with an explore case rather than a new message type.

**Rationale**: The building action protocol already carries `building_id`, `action_id`, and `action_type`. Explore is semantically another building action. Adding a case to the existing handler keeps the dispatch table lean and re-uses all the existing gate checks (character present, city map, not in combat, at the building's node).

**Alternatives considered**: A dedicated `building.explore` client message — rejected because it duplicates the gate logic already in `handleBuildingAction` and creates another registered message type for no gain.

---

## Decision 2: Combat Resolution Strategy

**Decision**: Full server-side resolution in a single synchronous computation (`explore-combat-service.ts`). All rounds are computed before the response is sent. The entire result (outcome, rounds array, XP, drops) is delivered in one `building.explore_result` message.

**Rationale**: Streaming individual rounds from the server adds latency variability and requires server-side state for in-progress fights. Since combat is deterministic and fast to compute, resolving it entirely first and streaming the display on the client (artificial delay) gives the same UX without server complexity. Aligns with Constitution Principle II (server authoritative) and Principle III (simplicity).

**Alternatives considered**: Real-time round-by-round server messages (similar to old `combat.round`) — rejected because it requires holding fight state server-side and timing coordination across the WebSocket connection lifecycle.

---

## Decision 3: Old Monster System Removal Strategy

**Decision**: Migration 011 drops `combat_simulations`, `combat_participants`, and the old `monsters` table, then creates new `monsters` and `monster_loot` tables. Source files `monster-registry.ts` and `monster-spawner.ts` are deleted. Old combat protocol types (`CombatStartPayload`, `CombatStartedPayload`, `CombatRoundPayload`, `CombatEndedPayload`, `MonsterSpawnedPayload`, `MonsterDespawnedPayload`, `ItemGained`) are removed from `shared/protocol/index.ts`. `WorldStatePayload.monsters` field is removed.

**Rationale**: The spec explicitly allows breaking change. Old tables reference the deprecated `items` table (already dropped in migration 010 anyway — loot_table JSONB had item IDs that no longer exist). The old system (roaming map monsters, click-to-attack) is architecturally different from the new system (building exploration, server-resolved combat).

**Alternatives considered**: Keeping the old table and adding a new one — rejected as unnecessary schema bloat that contradicts FR-025.

---

## Decision 4: Explore Action Config Storage

**Decision**: Store explore configuration as JSONB in the existing `building_actions.config` column:
```json
{
  "encounter_chance": 15,
  "monsters": [
    { "monster_id": 1, "weight": 33 },
    { "monster_id": 2, "weight": 66 },
    { "monster_id": 3, "weight": 1 }
  ]
}
```
No new table needed; the `building_actions.action_type` CHECK constraint is extended to include `'explore'`.

**Rationale**: All existing action configs (travel) already use the JSONB `config` column. The explore config is bounded and not queried relationally (weights are always read as a unit). Adding a separate `building_explore_configs` table would be premature normalization for what is essentially a small, always-read-together blob.

**Alternatives considered**: Separate `building_explore_monsters` table — rejected (YAGNI; the JSON array is simpler and sufficient).

---

## Decision 5: Monster Icons Storage

**Decision**: Same pattern as item icons (`007-item-inventory`). Icons stored under `backend/assets/monsters/icons/` with UUID filenames. Served statically at `/monster-icons/<filename>` from the admin backend. URL injected into `icon_url` field of monster DTOs.

**Rationale**: Reuses the proven pattern. No new infrastructure needed.

**Alternatives considered**: Storing icons with the game backend — rejected because icons are admin-managed assets; serving them from the admin backend keeps asset management co-located with admin auth.

---

## Decision 6: Player HP Source for Combat

**Decision**: Use `character.max_hp` from the `characters` table. This field already exists (confirmed in `004_characters.sql`). A player always starts combat at full HP — the fight is self-contained (per spec Assumption A-008, defeat has no lasting HP penalty).

**Rationale**: `max_hp` is always available on the character row fetched at action time. Starting at max HP keeps the combat stateless (no need to carry `current_hp` through the explore flow).

**Alternatives considered**: Using `current_hp` (persistent HP across fights) — deferred; this can be a future feature where HP persistence is introduced as a separate mechanic.

---

## Decision 7: Combat Formula

**Decision**:
- Player damage to monster: `max(1, character.attack_power - monster.defense)`
- Monster damage to player: `max(1, monster.attack - character.defence)`
- Player attacks first each round
- Fight ends when either side reaches ≤ 0 HP

**Rationale**: Mirrors the existing character stat naming conventions (`attack_power`, `defence` on characters) and the monster stat fields (`attack`, `defense` on the new monsters table). The minimum-1 rule prevents 0-damage rounds that would create infinite loops with heavily-armoured characters.

**Alternatives considered**: Critical hits / miss chance — deferred to a future feature; adds randomness complexity not needed for the MVP.

---

## Decision 8: Admin Frontend — Monsters Tab

**Decision**: Add a fourth tab "Monsters" to the admin panel (alongside Maps, Items, Admin Tools). Implemented as a new `MonsterManager` class in `admin/frontend/src/ui/monster-manager.ts`, following the exact same pattern as `ItemManager`.

**Rationale**: The admin tab system in `main.ts` is easy to extend. `MonsterManager` following `ItemManager`'s shape keeps the codebase consistent and easy to review.

**Alternatives considered**: Integrating monsters into the existing map editor sidebar — rejected because monsters are global entities not tied to a specific map.

---

## Decision 9: Building Explore Config — Admin UI Entry Point

**Decision**: The explore action is configured through the building actions panel (already accessible from the PropertiesPanel in the map editor, via `/api/maps/:id/buildings/:buildingId/actions`). A new "Explore" option in the action type dropdown renders the encounter-chance field plus a monster-table editor (list of monster + weight rows, with add/remove). Monsters are fetched from `/api/monsters` for the dropdown.

**Rationale**: Building actions are already managed in the map editor's right-panel. Reusing this UI location keeps the UX consistent and avoids creating a separate page for exploration configuration.

---

## Resolved NEEDS CLARIFICATION

None — the spec had no NEEDS CLARIFICATION markers.

---

## Key File Impact Summary

| File | Action | Reason |
|------|--------|--------|
| `backend/src/db/migrations/011_monster_combat.sql` | CREATE | Schema changes |
| `backend/src/db/queries/monsters.ts` | REWRITE | New monster schema |
| `backend/src/db/queries/monster-loot.ts` | CREATE | Loot queries |
| `backend/src/game/combat/explore-combat-service.ts` | CREATE | Combat resolution |
| `backend/src/game/world/building-action-handler.ts` | MODIFY | Add explore case |
| `backend/src/game/world/monster-registry.ts` | DELETE | Old system |
| `backend/src/game/world/monster-spawner.ts` | DELETE | Old system |
| `backend/src/index.ts` | MODIFY | Remove spawner init, remove old combat handler |
| `shared/protocol/index.ts` | MODIFY | Remove old types, add explore types |
| `admin/backend/src/routes/monsters.ts` | CREATE | Monster CRUD API |
| `admin/backend/src/index.ts` | MODIFY | Mount monster routes + icons static |
| `admin/frontend/src/ui/monster-manager.ts` | CREATE | Admin monster UI |
| `admin/frontend/src/editor/api.ts` | MODIFY | Monster API calls + explore action config |
| `admin/frontend/src/main.ts` | MODIFY | Add Monsters tab |
| `admin/frontend/src/ui/properties.ts` | MODIFY | Explore action type in building actions panel |
| `frontend/src/scenes/GameScene.ts` | MODIFY | Handle explore_result, remove old monster code |
| `frontend/src/ui/BuildingPanel.ts` | MODIFY | Explore button + result handling |
| `frontend/src/ui/CombatModal.ts` | CREATE | Streaming combat modal |
| `frontend/src/entities/MonsterSprite.ts` | DELETE | Old system |
