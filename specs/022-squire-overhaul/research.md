# Research: Squire System Overhaul

**Branch**: `022-squire-overhaul` | **Date**: 2026-03-24

## Decision 1: Squire Definition Storage

**Decision**: New `squire_definitions` table (admin-managed), separate from the existing `squires` table which becomes `character_squires` (player-owned instances).

**Rationale**: The current `squires` table is a flat structure (id, character_id, name). The overhaul requires separating the "template" (admin-defined: name, icon, power_level) from the "instance" (player-owned: references definition, has a level). This mirrors the `item_definitions` / `inventory_items` pattern already in the codebase.

**Alternatives considered**:
- Extending the existing `squires` table with nullable definition columns — rejected because it conflates admin templates with player instances, violating the existing item pattern.
- JSONB-based definitions — rejected because squire definitions need to be referenced by ID from monster_loot, quest_rewards, and gathering configs.

## Decision 2: Squire Loot Integration Approach

**Decision**: Create a new `monster_squire_loot` table (parallel to `monster_loot`), extend `quest_rewards.reward_type` CHECK to include `'squire'`, and add `'squire'` to the gathering event type union.

**Rationale**:
- Monster loot: A separate table is cleaner than overloading `monster_loot.item_def_id` with squire definition IDs, since squires and items are fundamentally different entities. Follows the same pattern as `monster_ability_loot` being separate from `monster_loot`.
- Quest rewards: Adding `'squire'` to `reward_type` CHECK and using `target_id` to reference `squire_definitions.id` is the minimal change. The `quantity` field maps to the squire's level.
- Gathering events: Adding `'squire'` to the event type union in `GatherEventConfig` and `GatheringTickEvent`, with `squire_def_id` and `squire_level` fields.

**Alternatives considered**:
- Single unified loot table — rejected because it requires polymorphic foreign keys and complex JOIN logic.
- Squire loot as items — rejected because squires have fundamentally different behavior (slots, levels, expedition mechanics).

## Decision 3: Expedition Power Bonus Formula

**Decision**: Linear scaling: `bonus_multiplier = 1 + (squire_power_level / 100)` where power_level ranges from 0–100, giving 1x–2x multiplier on base rewards.

**Rationale**: The spec says "max rank by 100%" meaning a maximum doubling of base rewards. Using a 0–100 scale for power_level makes the math intuitive: power_level IS the bonus percentage. Applied as a multiplier on the already-duration-scaled reward snapshot.

**Alternatives considered**:
- Non-linear scaling (exponential) — rejected, spec explicitly says "up to 100%" which implies linear.
- Per-rank bonus tables — rejected, overengineered; a single numeric power_level on the definition is simpler.

## Decision 4: NPC Dismissal Mechanism

**Decision**: Add `is_squire_dismisser BOOLEAN` column to `npcs` table. New WebSocket messages: `squire.dismiss_list` (request idle squires), `squire.dismiss_confirm` (dismiss selected squire). Follows the crafting NPC pattern (`is_crafter`, `crafting.open`).

**Rationale**: The crafting system already established the pattern of NPC boolean flags + dedicated message types. The dismissal flow is: player talks to NPC → sees "I want to dismiss a squire" option → gets list of idle squires → selects one → confirmation → squire deleted.

**Alternatives considered**:
- Generic NPC dialog system — rejected, no such system exists yet; would be overengineered for a single use case.
- Admin command `/dismiss_squire` — rejected, spec requires an in-game NPC interaction.

## Decision 5: Squire Slot Storage

**Decision**: Add `squire_slots_unlocked INTEGER NOT NULL DEFAULT 2` column to `characters` table. Total slots (5) is a constant in shared code. Available slots = `squire_slots_unlocked - count(character_squires)`.

**Rationale**: Only the unlocked count needs to be stored per character (it can change). The total is a game constant. This is the simplest approach — no separate table needed.

**Alternatives considered**:
- Separate `character_squire_slots` table — rejected, unnecessary complexity for a single integer.
- JSONB config on characters — rejected, a simple column is clearer and queryable.

## Decision 6: Rank Table Storage

**Decision**: Hardcoded constant array in `shared/protocol/index.ts` (and/or a shared constants file). Not stored in the database.

**Rationale**: The spec says ranks are "fixed progression defined in data, not editable by admin." A constant array of 20 strings is the simplest solution. Both frontend and backend can import it. No migration needed.

**Alternatives considered**:
- Database table `squire_ranks` — rejected, adds unnecessary DB queries for static data that never changes.
- Config file — rejected, a TypeScript constant is importable by both frontend and backend via the shared package.

## Decision 7: Legacy Squire Migration

**Decision**: Migration creates a default `squire_definitions` entry ("Legacy Squire", power_level 0, level 1). Then transforms existing `squires` rows into `character_squires` rows referencing this default definition. Old `squires` table is renamed/dropped.

**Rationale**: Every existing character has exactly one squire with a random name. These need to be preserved. A default definition with power_level 0 ensures legacy squires don't affect expedition balance until the admin configures proper definitions.

## Decision 8: Agent Command Pattern

**Decision**: Add 3 new commands to `game-entities.js`: `create-squire`, `upload-squire-icon`, `create-monster-squire-loot`. Extend existing `create-quest` to accept `reward_type: 'squire'`. Extend `create-building-action` gather events to accept `type: 'squire'`.

**Rationale**: Follows the established pattern — each entity type gets a create command, icon uploads use the existing multer pattern, and existing commands are extended for new sub-types. Admin backend gets corresponding REST endpoints.

**Alternatives considered**:
- Separate script for squire commands — rejected, the game-entities script is the single entry point for all entity creation.
