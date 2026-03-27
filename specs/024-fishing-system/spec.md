# Feature Specification: Fishing System

**Feature Branch**: `024-fishing-system`
**Created**: 2026-03-26
**Status**: Draft
**Input**: Fishing system with mini-game, rod progression, ring/amulet equipment slots, daily quests, and anti-bot design

## Clarifications

### Session 2026-03-26

- Q: Does upgrading a rod transform it in-place or replace it with a new item? → A: Transform in-place — the equipped rod's tier, durability, and loot pool update on the same item entity.
- Q: How many daily quests are offered each day — all eligible or a random subset? → A: Random 2 of the eligible quest pool are selected each day.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Fishing Loop (Priority: P1)

A player equips a fishing rod, visits a water building, and uses the "Fish" building action. A timing-based mini-game plays out: the player waits for a bite, then manages a tension meter by clicking/tapping in response to randomized fish pull patterns. On success, the player receives fish (and rarely, jewelry). On failure, the fish escapes but durability is still consumed.

**Why this priority**: This is the core gameplay loop — without it, nothing else in the fishing system functions. It delivers the primary player experience and the anti-bot value proposition.

**Independent Test**: Can be fully tested by equipping a rod, visiting a fishing spot, and completing the mini-game. Delivers the core fishing experience and loot drops.

**Acceptance Scenarios**:

1. **Given** a player with a fishing rod equipped at a water building, **When** they activate the "Fish" action, **Then** a mini-game starts with a random 2–8 second wait for a bite, followed by a tension meter challenge.
2. **Given** the mini-game is active, **When** the player keeps the tension meter in the green zone and clicks the final reel-in window, **Then** they receive a fish item (and possibly a ring or amulet) based on their rod tier's loot pool.
3. **Given** the mini-game is active, **When** the player fails to maintain tension or misses the reel-in window, **Then** the fish escapes, no loot is granted, and 1 rod durability is consumed.
4. **Given** a player with a rod at 1 durability, **When** they attempt to fish, **Then** the system blocks the action and informs them the rod must be repaired.

---

### User Story 2 - Rod Progression & Upgrades (Priority: P2)

A player accumulates Rod Upgrade Points from daily quests and combines them with world resources (linen, iron bars, steel ingots, silk) at the Fisherman NPC to upgrade their rod from T1 through T5. Each tier increases durability, unlocks new fishing spots, expands the loot pool to include rarer fish and higher-tier jewelry, and increases rare-drop chances.

**Why this priority**: Progression gives the fishing loop long-term engagement. Without upgrades, the system is a flat experience with no growth arc. This is the primary retention driver.

**Independent Test**: Can be tested by accumulating upgrade points, gathering resources, and upgrading a rod at the Fisherman NPC. Delivers visible progression and access to new content.

**Acceptance Scenarios**:

1. **Given** a player with sufficient Rod Upgrade Points and required resources, **When** they interact with the Fisherman NPC's upgrade action, **Then** their existing rod is transformed in-place to the next tier with updated durability and expanded loot pool (same item entity, no new item created).
2. **Given** a player with a T1 rod, **When** they fish at any spot, **Then** they can only catch common fish (Mudfish, River Perch) with no jewelry drops.
3. **Given** a player with a T3+ rod, **When** they fish, **Then** they have a chance to catch Golden Carp, Ashfin Eel, and T1–T2 rings/amulets.
4. **Given** a player without enough points or resources, **When** they attempt to upgrade, **Then** the system shows what is still needed.

---

### User Story 3 - Daily Fishing Quests (Priority: P2)

The Fisherman NPC offers daily quests requiring the player to catch specific fish. Completing these quests rewards Rod Upgrade Points and Crowns. Quests refresh daily and scale in difficulty and reward based on the fish required.

**Why this priority**: Daily quests provide the structured goal-setting that drives repeated engagement and feed upgrade points into the rod progression system.

**Independent Test**: Can be tested by accepting a daily quest, catching the required fish, and turning it in. Delivers quest rewards and progression currency.

**Acceptance Scenarios**:

1. **Given** a player at the Fisherman NPC, **When** they view available daily quests, **Then** they see 2 fishing quests randomly selected from the eligible pool, with requirements and rewards listed.
2. **Given** a player with an active fishing quest, **When** they catch the required fish, **Then** quest progress updates automatically.
3. **Given** a player who has completed a daily quest, **When** they turn it in, **Then** they receive the listed Rod Upgrade Points and Crowns.
4. **Given** a player who completed today's quests, **When** the daily reset occurs, **Then** new quests become available.

---

### User Story 4 - Ring & Amulet Equipment (Priority: P3)

Players can equip rings and amulets obtained from fishing into two new equipment slots. These items provide combat-relevant stats (crit chance, dodge chance, mana regen, defence, etc.) that enhance the player's build without requiring combat to obtain.

**Why this priority**: New equipment slots add depth to character builds and create cross-system value (fishing rewards matter in combat). Lower priority because the fishing loop works without them — they add desirability to the loot.

**Independent Test**: Can be tested by obtaining a ring or amulet from fishing and equipping it. Delivers visible stat changes on the character.

**Acceptance Scenarios**:

1. **Given** a player with a ring in their inventory, **When** they equip it to the ring slot, **Then** the ring's stats are applied to their character.
2. **Given** a player with an amulet equipped, **When** they view their equipment, **Then** the amulet appears in the amulet slot with its stats visible.
3. **Given** a player with a ring equipped, **When** they equip a different ring, **Then** the previous ring returns to inventory and the new ring's stats replace the old ones.

---

### User Story 5 - Rod Repair (Priority: P3)

When a rod reaches 1 durability, it becomes locked and cannot be used for fishing. The player must visit the Fisherman NPC and pay Crowns plus a small resource cost to restore it to full durability. Repair costs scale with rod tier.

**Why this priority**: Repair is a necessary crown sink and resource drain that supports the game economy. It's lower priority because it's a simple transaction flow.

**Independent Test**: Can be tested by depleting a rod to 1 durability and repairing it at the Fisherman NPC. Delivers the rod back to usable state.

**Acceptance Scenarios**:

1. **Given** a player with a rod at 1 durability, **When** they interact with the Fisherman NPC's repair option, **Then** they see the repair cost in Crowns and resources.
2. **Given** a player with sufficient Crowns and resources, **When** they confirm repair, **Then** the rod is restored to full durability.
3. **Given** a player without enough Crowns, **When** they attempt to repair, **Then** the system informs them of the shortfall.

---

### User Story 6 - Anti-Bot Mini-Game Design (Priority: P1)

The fishing mini-game uses randomized timing, variable fish pull patterns, and precision click windows to make automation impractical. Additional measures include snap checks for inhuman consistency and randomized catch windows that shift per attempt.

**Why this priority**: Anti-bot measures are core to the design philosophy — the system is explicitly designed to be hostile to automation. This is bundled with P1 because it's inseparable from the mini-game implementation.

**Independent Test**: Can be tested by attempting to fish with consistent timing patterns. Delivers anti-automation protection.

**Acceptance Scenarios**:

1. **Given** a player fishing, **When** the bite occurs, **Then** the delay before the bite is randomized between 2–8 seconds per cast.
2. **Given** a player reeling in, **When** they respond with inhuman consistency (identical timing across multiple casts), **Then** a snap check triggers and the line breaks.
3. **Given** two consecutive fishing attempts, **When** the player fishes the same spot, **Then** the catch window timing and fish pull pattern differ from the previous attempt.

---

### Edge Cases

- What happens when a player tries to fish without a rod equipped? → System blocks the action with a message.
- What happens when a player is in combat and tries to fish? → Fishing action is unavailable during combat.
- What happens if the player disconnects mid mini-game? → The cast is lost, 1 durability consumed, no loot.
- What happens when a player tries to upgrade past T5? → No upgrade option is shown; T5 is the final tier.
- What happens when daily quests require fish the player's rod tier can't catch? → Daily quests are filtered to only offer quests achievable with the player's current rod tier.
- What happens when a player's inventory is full and they catch a fish? → The catch is lost with a warning message, durability is still consumed.
- What happens to rod upgrade progress if the player changes rod? → Rod Upgrade Points are tracked per character, not per rod. Upgrading always upgrades the player's current rod to the next tier.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Fish" building action at designated water buildings that initiates the fishing mini-game when a player has a fishing rod equipped.
- **FR-002**: System MUST implement a tension-bar mini-game with randomized bite delay (2–8 seconds), variable fish pull patterns per species, and a precision reel-in timing window.
- **FR-003**: System MUST support 5 fishing rod tiers (T1–T5) with increasing durability (30/50/75/100/150) and progressively broader loot pools.
- **FR-004**: System MUST consume 1 rod durability per cast regardless of success or failure.
- **FR-005**: System MUST lock a rod at 1 durability, preventing fishing until repaired at the Fisherman NPC.
- **FR-006**: System MUST allow rod repair at the Fisherman NPC for a Crown cost plus resources, scaling with rod tier, restoring full durability.
- **FR-007**: System MUST track Rod Upgrade Points per character and allow rod upgrades at the Fisherman NPC when the player has sufficient points and resources. Upgrading transforms the existing rod in-place (same item entity, tier/stats updated).
- **FR-008**: System MUST offer 2 daily fishing quests randomly selected from the eligible quest pool, rewarding Rod Upgrade Points and Crowns.
- **FR-009**: System MUST filter daily quests so they only require fish catchable with the player's current rod tier.
- **FR-010**: System MUST introduce `ring` and `amulet` equipment categories with corresponding equip slots on the character.
- **FR-011**: System MUST include 4 rings (T1–T4) and 4 amulets (T1–T4) as fishing loot drops gated by rod tier.
- **FR-012**: System MUST apply ring and amulet stats to combat calculations when equipped.
- **FR-013**: System MUST implement anti-bot measures: snap checks for inhuman consistency, randomized catch windows per attempt, and varied fish pull patterns.
- **FR-014**: System MUST support ~12 fish types as resource/food items, distributed across rod tiers in the loot pool.
- **FR-015**: System MUST make fish items tradeable on the player marketplace.
- **FR-016**: System MUST make ring and amulet items tradeable on the player marketplace.
- **FR-017**: System MUST provide a Fisherman NPC with quest-giving, rod upgrade, and rod repair interactions.
- **FR-018**: System MUST display different fish species with distinct pull patterns (aggressive, erratic, steady) during the mini-game.

### Key Entities

- **Fishing Rod**: Equipment item with tier (T1–T5), durability (current/max), and tool_type 'fishing_rod'. Determines which loot pool is accessible. Upgrades transform the item in-place (tier, durability cap, and loot pool change on the same entity).
- **Fish**: Resource items with tier associations. Tradeable on marketplace, used for quest turn-ins. ~12 species across 5 tiers.
- **Ring**: Equipment item for the new ring slot. Provides combat stats (defence, dodge_chance, crit_chance, mana_regen, crit_damage). 4 tiers, dropped from fishing.
- **Amulet**: Equipment item for the new amulet slot. Provides combat stats (max_mana, mana_regen, mana_on_hit, defence, crit_chance). 4 tiers, dropped from fishing.
- **Rod Upgrade Points**: Per-character progression currency earned from daily quests. Consumed during rod upgrades. Tracked internally (not an inventory item).
- **Fisherman NPC**: Quest-giving NPC that offers daily fishing quests, rod upgrades, and rod repairs. Located at a water building.
- **Fishing Spot**: Building action of type 'fishing' on water-adjacent buildings. Different spots may exist in different zones with potentially different loot modifiers.
- **Fishing Mini-Game Session**: Transient game state tracking the current cast — bite timing, tension meter position, fish pull pattern, catch window, and anti-bot checks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can complete a full fishing cast (wait → mini-game → loot) within 15–30 seconds per attempt.
- **SC-002**: Players can progress from T1 to T2 rod within 3–5 play sessions of daily quest completion.
- **SC-003**: Ring and amulet drops appear at rates low enough to maintain marketplace value (estimated 1–5% per catch at eligible rod tiers).
- **SC-004**: The mini-game produces meaningfully different experiences per cast — no two consecutive casts feel identical in timing or pattern.
- **SC-005**: Rod durability creates a repair cycle that consumes Crowns at a rate proportional to fishing activity, functioning as an effective economy sink.
- **SC-006**: Automated fishing attempts (bots) fail at a rate exceeding 80% due to anti-bot measures.
- **SC-007**: Players engage with fishing daily quests as a recurring activity, with completion rates above 60% for accepted quests.
- **SC-008**: At least 3 distinct fishing spots are available across the game world, gated by rod tier or zone.
