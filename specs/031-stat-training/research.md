# Research: NPC Stat Training

**Date**: 2026-04-02 | **Branch**: `031-stat-training`

## Decision 1: Stat Training Handler Architecture

**Decision**: Create a separate `stat-training-handler.ts` alongside existing `training-handler.ts`.

**Rationale**: The existing training handler manages point allocation (bulk multi-stat). The new system is fundamentally different — single-stat, item-consuming, probability-based. Separate files keep responsibilities clear and avoid bloating the existing handler.

**Alternatives considered**:
- Extending `training-handler.ts` with new message types — rejected because the two systems share no logic (one allocates points, the other consumes items). Merging them would violate single responsibility.
- Creating a generic "stat modification" service — rejected as over-engineering (YAGNI). The two systems are different enough to warrant separation.

## Decision 2: Database Schema Design

**Decision**: Single `stat_training_items` table with `npc_id` foreign key, plus `trainer_stat` column on `npcs`.

**Rationale**: The `npc_id` on `stat_training_items` allows direct validation — when a player opens training at a specific NPC, we query items by npc_id. The `trainer_stat` column on NPCs enables the frontend to show the "Train [Stat]" dialog option without an extra query.

**Alternatives considered**:
- Separate `stat_trainers` junction table linking NPCs to stats — rejected. Each NPC trains exactly one stat, so a simple column suffices.
- Storing trainer_stat on the stat_training_items table only (no NPC column) — rejected because the frontend needs to know the NPC's stat to render the dialog option, and querying stat_training_items for every NPC render would be wasteful.

## Decision 3: Success Chance Formula

**Decision**: `max(5, base_chance - character_level * decay_per_level)`, computed server-side.

**Rationale**: Linear decay is simple, predictable, and easy to balance. The 5% floor ensures items are never completely useless. Per-item `base_chance` and `decay_per_level` stored in DB allow tuning without code changes.

**Alternatives considered**:
- Exponential decay — rejected as harder to reason about for game designers.
- Stat-value-based decay (harder as stat gets higher) — rejected for Phase 1, could be added later. Level-based decay is simpler and achieves the design goal.

## Decision 4: Item Consumption Timing

**Decision**: Consume item before rolling RNG. Item is always consumed regardless of success/failure.

**Rationale**: This is the explicit game design requirement. Consuming before roll prevents exploits where disconnection could prevent item loss on failure.

**Alternatives considered**:
- Consume only on success — rejected by game design (training items are meant to be consumable sinks).

## Decision 5: Frontend Component

**Decision**: New `StatTrainingModal` class, separate from existing `TrainingModal`.

**Rationale**: The existing `TrainingModal` is a complex multi-stat allocation UI with sliders. The stat training modal is simpler — shows one stat, lists items with percentages, handles single-click attempts. Different enough to warrant a separate component.

**Alternatives considered**:
- Tab in existing TrainingModal — rejected because the two UIs have fundamentally different interactions (multi-stat allocation vs single-item consumption).

## Decision 6: Shared Cap with Point Allocation

**Decision**: Training gains share the same per-stat cap as manually allocated points: `10 * (level - 1)`.

**Rationale**: Explicit game design requirement. Training is an alternative path to fill the same stat pool, not a way to exceed it.

## Decision 7: Tooling Updates

**Decision**: Update `scripts/game-data.js` with `stat-training` command, `scripts/game-entities.js` with `create-stat-training-item` command, and CLAUDE.md with relevant checklists.

**Rationale**: Constitution Principle VI requires tooling consistency. The stat training system introduces a new entity type that game designers need to query and create.
