# Feature Specification: NPC Stat Training via Consumable Items

**Feature Branch**: `031-stat-training`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: Code changes required by `game_design/stat-training/design.md`  
**Scope**: Code infrastructure only — entity creation (items, NPCs, recipes) is handled separately by `/gd.execute`

## Background

The current stat allocation system (feature 030) grants 7 points per level, but each stat can reach 10 points per level — players can never max out through level-up alone. This feature adds a second path: NPCs who accept consumable items in exchange for a chance to permanently increase a stat by 1 point.

Each stat has a dedicated trainer NPC and 3 tiers of training items. Success probability uses the formula: `max(5, base_chance - character_level * decay_per_level)`. Higher-tier items decay slower, maintaining usefulness at higher levels.

See `game_design/stat-training/design.md` for full game design context including item definitions, recipes, NPC assignments, and economy analysis.

---

## User Scenarios & Testing

### User Story 1 - Attempt Stat Training at NPC (Priority: P1)

A player visits a trainer NPC (one who has a `trainer_stat` assigned), sees a "Train [Stat Name]" dialog option, opens the stat training interface, selects a consumable training item from their inventory, and attempts training. The item is consumed, and the player sees whether the attempt succeeded (stat +1) or failed.

**Why this priority**: This is the core mechanic — without it, nothing else works.

**Independent Test**: Visit a trainer NPC with a training item in inventory. Click "Train Strength". Select "Barley Beer". Item is consumed, success/failure shown, stat updates if successful.

**Acceptance Scenarios**:

1. **Given** a player at a trainer NPC with training items in inventory, **When** the player clicks "Train [Stat]", **Then** a modal opens showing the stat name, current value, cap, and a list of owned training items with their success percentages.
2. **Given** the training modal is open showing items, **When** the player clicks a training item, **Then** 1x of that item is consumed from inventory, and the player sees a success or failure message.
3. **Given** a successful training attempt, **When** the result is displayed, **Then** the stat value increases by 1, derived stats (HP/Attack/Defence/Mana/Crit/Dodge) recalculate, and the modal updates to reflect the new value.
4. **Given** a failed training attempt, **When** the result is displayed, **Then** the item is still consumed but the stat value remains unchanged.

---

### User Story 2 - Success Probability Scales with Level and Tier (Priority: P1)

The success chance for each training item decreases as the player levels up, following the formula `max(5%, base_chance - level * decay_per_level)`. Higher-tier items decay slower, so they remain viable at higher levels.

**Why this priority**: The probability system is the core balance mechanic — it makes tier progression meaningful and prevents trivial stat maxing.

**Independent Test**: A level 5 character sees ~80% chance for T1 items, ~88% for T2. A level 20 character sees ~35% for T1 but ~65% for T2. Chance never drops below 5%.

**Acceptance Scenarios**:

1. **Given** a level 5 player with a T1 item (base 95%, decay 3.0), **When** viewing the training modal, **Then** the displayed success chance is 80%.
2. **Given** a level 30 player with a T1 item, **When** viewing the training modal, **Then** the displayed success chance is 5% (clamped minimum).
3. **Given** a level 20 player with a T3 item (base 95%, decay 0.5), **When** viewing the training modal, **Then** the displayed success chance is 85%.

---

### User Story 3 - Stat Cap Enforcement (Priority: P1)

Training items share the same stat cap as level-up point allocation: `10 * (level - 1)` per stat. If a stat is already at its cap, the player cannot attempt training for that stat.

**Why this priority**: Without cap enforcement, training breaks the stat balance system.

**Independent Test**: A level 10 character with strength at 90 (cap = 90) attempts strength training — the system rejects the attempt without consuming the item.

**Acceptance Scenarios**:

1. **Given** a player whose stat equals the per-stat cap, **When** attempting training for that stat, **Then** the attempt is rejected with a message "Your [stat] has reached its maximum for your level", and no item is consumed.
2. **Given** a player whose stat is below cap, **When** attempting training, **Then** the attempt proceeds normally.

---

### User Story 4 - NPC-Specific Training Items (Priority: P2)

Each trainer NPC only accepts items mapped to their specific stat. A player at the strength trainer only sees strength training items; intelligence items do not appear.

**Why this priority**: Important for UX clarity and game integrity, but the system would function without strict NPC filtering.

**Independent Test**: Visit Bruna (strength trainer) with both Barley Beer and Raw Quartz in inventory. Only Barley Beer appears in the training modal.

**Acceptance Scenarios**:

1. **Given** a player at a trainer NPC, **When** the training modal opens, **Then** only items mapped to that NPC's `trainer_stat` are shown.
2. **Given** a player with no applicable training items, **When** the training modal opens, **Then** the modal shows an empty list with a message indicating no suitable items are available.

---

### User Story 5 - Admin Management of Training Items (Priority: P2)

Game administrators can configure which items are training items, which stat they train, their tier, base chance, and decay rate — all via the admin API.

**Why this priority**: Required for content creators to set up and tune the training system, but not needed for the player-facing mechanic.

**Independent Test**: POST a new stat training item mapping via admin API, verify it appears in the trainer's modal in-game.

**Acceptance Scenarios**:

1. **Given** an admin, **When** creating a stat training item mapping with valid item_def_id, stat, tier, base_chance, decay, and npc_id, **Then** the mapping is persisted and the item becomes usable at the specified NPC.
2. **Given** an admin, **When** listing all stat training items, **Then** all mappings are returned with their configuration.
3. **Given** an admin, **When** deleting a stat training item mapping, **Then** the item no longer appears as a training option.

---

### Edge Cases

- What happens when a player tries to train while in combat? Training is rejected (same check as existing stat allocation).
- What happens when a player has 0 quantity of the selected item? The item should not appear in the list; if somehow sent, the server rejects without consuming.
- What happens if two training attempts are sent rapidly? Each attempt is processed sequentially — the second checks inventory after the first consumes.
- What happens at level 1? Cap is `10 * (1-1) = 0` — no training possible. The modal should show "Training is available from level 2."

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST store training item configurations (item-to-stat mappings with tier, base_chance, decay_per_level, and NPC association) in a persistent database table.
- **FR-002**: System MUST add a `trainer_stat` field to NPCs indicating which stat they can train (null if they are not a stat trainer).
- **FR-003**: System MUST support a `stat-training.open` message that returns the trainer's stat, the player's current stat value, the per-stat cap, and a list of applicable training items the player owns with computed success chances.
- **FR-004**: System MUST compute success chance as `max(5, base_chance - character_level * decay_per_level)` and display it as a percentage to the player.
- **FR-005**: System MUST support a `stat-training.attempt` message that consumes 1x of the specified item, rolls against the computed success chance, and either increments the stat by 1 (success) or does nothing (failure).
- **FR-006**: On successful training, the system MUST recalculate all derived combat stats (max_hp, attack_power, defence, max_mana, crit_chance, crit_damage, dodge_chance) using the same formulas as the existing stat allocation system.
- **FR-007**: System MUST enforce the existing per-stat cap (`10 * (level - 1)`) — training and manual allocation share the same cap.
- **FR-008**: System MUST reject training attempts when the player is in combat.
- **FR-009**: System MUST NOT consume the training item if the attempt is rejected (cap reached, in combat, invalid item, insufficient quantity).
- **FR-010**: The frontend MUST show a "Train [Stat Name]" dialog option when interacting with an NPC that has `trainer_stat` set.
- **FR-011**: The frontend MUST display a training modal showing stat name, current value, cap, and a list of owned training items with tier indicators and success percentages.
- **FR-012**: The frontend MUST show a clear success or failure result after each training attempt.
- **FR-013**: The admin API MUST provide CRUD endpoints for managing stat training item mappings.
- **FR-014**: System MUST include the `trainer_stat` field in NPC data sent to the frontend (NpcDto).

### Key Entities

- **Stat Training Item Mapping**: Links an item definition to a stat name, tier (1-3), base success chance (1-100), decay rate per level, and the NPC who accepts it. One item can only be mapped once.
- **Trainer NPC**: An NPC with a `trainer_stat` value indicating which of the 5 stats (constitution, strength, intelligence, dexterity, toughness) they train. Null means not a stat trainer.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Players can complete a training attempt (open modal, select item, see result) within 3 seconds of clicking "Train [Stat]".
- **SC-002**: Success rate distribution across 100+ attempts matches the formula within 5% tolerance (e.g., an 80% item succeeds ~75-85% of the time).
- **SC-003**: All 5 stats are independently trainable, each at a different NPC location.
- **SC-004**: The training system functions without interfering with the existing stat allocation system — both paths contribute to the same stat values and respect the same caps.
- **SC-005**: Admins can configure new training items without code changes.

---

## Assumptions

- Training items are created as `category: resource` items via the game-entities system — this spec covers only the code infrastructure.
- The existing `is_trainer` boolean on NPCs is preserved for the manual stat allocation system. The new `trainer_stat` column is additive — an NPC can have both `is_trainer = true` (for point allocation) and `trainer_stat = 'strength'` (for item training), or just one.
- No cooldown between training attempts in Phase 1. Cooldowns are deferred to Phase 2.
- The minimum success chance floor is 5% — training always has at least a small chance of success.
- The training modal is a separate UI component from the existing stat allocation modal.
