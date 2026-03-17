# Research: Combat System — Mana Threshold Auto-Battle

**Branch**: `016-combat-system` | **Date**: 2026-03-13

## Decision 1: Combat Session Architecture

**Decision**: Server-side `CombatSession` class, one instance per active character, stored in a `Map<characterId, CombatSession>` managed by a singleton `CombatSessionManager`.

**Rationale**: The simplest in-memory model that satisfies the real-time turn-by-turn requirement. No additional infrastructure (Redis, pub/sub) needed. One session per character guarantees no races between concurrent explore actions.

**Alternatives considered**:
- Per-WebSocket state — rejected because the session must survive brief reconnects and is logically owned by the character, not the socket.
- Database-backed session — deferred per spec clarification (Phase A in-memory only).

---

## Decision 2: Turn Timer Implementation

**Decision**: `setTimeout` on the server for the active ability window (default 15 000 ms, configurable). The timer reference is stored on `CombatSession` and cancelled immediately if the player triggers the active ability before it fires.

**Rationale**: Node.js single-threaded event loop makes `setTimeout` safe for this use case — no race conditions possible within a single turn. Cancellation is O(1).

**Alternatives considered**:
- Polling/tick loop — unnecessary complexity for a per-session timer.
- Client-driven "end turn" with server timeout — would require more complex state (server can't trust client timing).

---

## Decision 3: Integration with Existing Explore Flow

**Decision**: The `resolveExplore` function in `explore-combat-service.ts` is refactored. When an encounter is rolled and a monster is found, instead of running the full combat loop synchronously, it calls `CombatSessionManager.start(session, character, monster)`. The `building:explore_result` message gains a new `outcome: 'combat_started'` variant that carries only monster metadata (for the client to open the combat screen); the actual combat proceeds entirely over new `combat:*` message types.

**Rationale**: Keeps the explore entry point intact; adding `combat_started` to the existing outcome discriminated union is backward-compatible for the existing `no_encounter` and `combat` (legacy) variants.

**Alternatives considered**:
- Separate `building:combat_start` message independent of explore result — would require a new dispatch path for an action that is logically part of an explore outcome.

---

## Decision 4: Mana Stat Storage

**Decision**: New mana-related stats (`max_mana`, `mana_on_hit`, `mana_on_damage_taken`, `mana_regen`, `dodge_chance`, `crit_chance`, `crit_damage`) are added as columns to `item_definitions` with `DEFAULT 0`. All default to 0 so existing items are unaffected. A code constant `DEFAULT_MAX_MANA = 100` is used as the baseline max mana before equipment; equipment values stack additively.

**Rationale**: Consistent with how `attack_power` and `defence` are already stored. No normalisation overhead. All stat computation happens at combat session start from the set of equipped items.

**Alternatives considered**:
- Separate `item_stats` EAV table — overkill for a small fixed set of numeric stats.
- Per-character `base_max_mana` column on `characters` — unnecessary since there is no class-based mana variance in Phase A; a single code constant is simpler.

---

## Decision 5: Ability Drop Mechanism

**Decision**: New `monster_ability_loot` table linking monsters to droppable abilities with a `drop_chance`. Resolved in the same win-reward flow after item drops. Abilities are granted by inserting into `character_owned_abilities`.

**Rationale**: Mirrors the existing `monster_loot` pattern exactly — same structure, same resolution logic, easy to extend. Quest rewards use a separate award function called from quest resolution logic.

**Alternatives considered**:
- Reusing `monster_loot` with a nullable `item_def_id` and nullable `ability_id` — creates a confusing nullable dual-purpose row; two purpose-specific tables are clearer.

---

## Decision 6: Frontend Combat UI Approach

**Decision**: A new `CombatScreen` HTML component (not a Phaser scene) renders as a full-page overlay on top of the existing game canvas. It follows the same pattern as the existing HTML panels (`LeftPanel`, `BuildingPanel`, `CombatModal`). Placeholder combatant figures are styled `div` blocks (enemy: upper area, player: lower area). The existing `CombatModal` is retained for the legacy `combat` outcome but is superseded by `CombatScreen` for all new encounters.

**Rationale**: Consistent with the project's architectural choice to use HTML for game UI panels. No Phaser API needed for Pokemon-style layout. Faster to build and easier to restyle later.

**Alternatives considered**:
- New Phaser `CombatScene` — would require scene transition management, Phaser-specific layout code, and sprite loading just for placeholders. Deferred to when real sprites exist.

---

## Decision 7: Loadout Locking Mechanism

**Decision**: Check `character.in_combat` (already present on the `characters` table and `Character` TS interface) server-side on every `loadout:update` message. Reject with `reason: 'in_combat'` if true.

**Rationale**: The `in_combat` flag already exists and is set/cleared by the explore flow. No new DB column needed.

**Alternatives considered**:
- Check `CombatSessionManager.has(characterId)` instead — more authoritative but `in_combat` is already the canonical DB state; the two should be kept in sync.

---

## Decision 8: Admin Ability Configuration

**Decision**: New REST routes under `/api/abilities` in the admin backend (Express). Icon uploads reuse the existing `multer` upload pattern from monsters/items. The admin frontend adds an "Abilities" page following the same pattern as the Monsters page.

**Rationale**: Admin data management (CRUD for static definitions) is explicitly allowed to use REST per the constitution ("REST endpoints MAY be used only for non-game-state operations").

**Alternatives considered**:
- Abilities configurable via WebSocket — constitution explicitly restricts WebSocket to game state; admin CRUD is not game state.

---

## Decision 9: Default Ability Seeding

**Decision**: The 9 default abilities are seeded inside migration `018_combat_system.sql` using `INSERT … ON CONFLICT DO NOTHING` keyed on `name`. This ensures they exist in every environment (local, staging, production) immediately after migration without a separate seed command.

**Rationale**: Migration-time seeding is the simplest approach; idempotent `ON CONFLICT DO NOTHING` prevents duplicates on re-run.

**Alternatives considered**:
- Admin panel manual entry — requires human action per environment.
- Separate seed script — requires an extra step in setup docs and can be skipped.

---

## Decision 10: Protocol Version

**Decision**: All new combat and loadout messages use the existing envelope `{ type, v: 1, payload }`. No protocol version bump is required because new message types are additive and old clients simply don't register handlers for unknown types.

**Rationale**: The constitution requires backward-compatible changes to carry a version increment only when existing message semantics change. Adding new message types is strictly additive.
