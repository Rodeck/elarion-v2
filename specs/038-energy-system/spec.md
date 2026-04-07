# Feature Specification: Energy & Movement Speed System

**Feature Branch**: `038-energy-system`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Add movement speed and energy to the game. Energy is a resource with a cap replenished every X seconds (server-wide tick) or by consuming food items. Movement speed is a character stat starting at 100. Operations consume energy. When depleted, player moves 50% slower and cannot perform energy-consuming actions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Energy Depletes When Performing Actions (Priority: P1)

A player has a visible energy pool (starting and capped at 1000). Every action they perform — moving between city nodes, exploring, fishing, gathering, entering the arena, or fighting a boss — deducts a defined amount of energy. Tile-map (WASD) movement within zones is free and does not consume energy. If the player's energy reaches 0, they can no longer perform any energy-consuming action and see a clear message explaining why.

**Why this priority**: Energy is the core resource this feature introduces. Without depletion mechanics, nothing else matters.

**Independent Test**: Can be tested by performing actions and observing energy decrease in the character panel. At 0 energy, actions are refused with a feedback message.

**Acceptance Scenarios**:

1. **Given** a player with 1000 energy, **When** they travel through 5 adjacent city nodes, **Then** their energy decreases by 10 (2 per node step).
2. **Given** a player with 1000 energy, **When** they start an arena fight, **Then** their energy decreases by 20.
3. **Given** a player with 1000 energy, **When** they start fishing, **Then** their energy decreases by 10.
4. **Given** a player with 1000 energy, **When** they start exploring, **Then** their energy decreases by 10.
5. **Given** a player with 1000 energy, **When** they initiate a boss fight, **Then** their energy decreases by 20.
6. **Given** a player with 5 energy, **When** they attempt to start an arena fight (cost 20), **Then** the action is refused with a message "Not enough energy".
7. **Given** a player gathering resources, **When** energy reaches 0 during gathering, **Then** the gathering session ends early and any pending resources collected so far are granted.
8. **Given** a player moving via WASD within a zone, **When** they move any number of tiles, **Then** no energy is consumed.
9. **Given** a player who dies in combat with 800 energy, **When** they respawn, **Then** their energy is halved to 400.

---

### User Story 2 - Energy Regenerates Over Time via Server Tick (Priority: P1)

All online and offline players passively regenerate energy at a configurable rate on a server-wide tick (same pattern as HP regen). The amount restored per tick and the tick interval are configurable by admins.

**Why this priority**: Without passive regen, the energy system becomes a hard wall that stops gameplay entirely.

**Independent Test**: Wait for one tick cycle and verify energy increases. Verify energy never exceeds the cap (1000).

**Acceptance Scenarios**:

1. **Given** a player with 800 energy and a configured regen of 50 per tick, **When** the server tick fires, **Then** their energy increases to 850.
2. **Given** a player with 980 energy and a regen of 50 per tick, **When** the tick fires, **Then** energy is capped at 1000 (not 1030).
3. **Given** a player in combat, **When** the tick fires, **Then** their energy still regenerates (energy regen is not blocked by combat).

---

### User Story 3 - Food Restores Energy (Priority: P2)

Players can consume food items from their inventory to restore energy. Each food item has a `food_power` value that determines how much energy it restores. Energy cannot exceed the cap. Consuming a food item removes one unit from the stack.

**Why this priority**: Gives players an active way to recover energy beyond passive regen, creating demand for food items in the economy.

**Independent Test**: Use a food item and verify energy increases and item quantity decreases.

**Acceptance Scenarios**:

1. **Given** a player with 500 energy and a food item with food_power 200, **When** they use the food item, **Then** their energy increases to 700 and the food item stack decreases by 1.
2. **Given** a player with 950 energy and a food item with food_power 200, **When** they use the food item, **Then** energy is capped at 1000.
3. **Given** a player with 1000 energy, **When** they attempt to use a food item, **Then** the action is refused with "Energy is already full".
4. **Given** a player with a heal item (category: heal) with heal_power 50, **When** they use it, **Then** their HP increases (not energy) — heal items restore HP, food items restore energy.

---

### User Story 4 - Movement Speed Affects City Travel Time (Priority: P2)

All characters have a movement speed stat starting at 100. The base city node-to-node travel delay is reduced proportionally to movement speed (100 = base speed, 200 = twice as fast). When energy is depleted (0), movement speed is halved (50% penalty).

**Why this priority**: Movement speed provides the gameplay feel difference that makes the energy system meaningful.

**Independent Test**: Travel between nodes and observe the time per step. Drain energy to 0 and observe the speed penalty.

**Acceptance Scenarios**:

1. **Given** a character with 100 movement speed and energy > 0, **When** they travel between city nodes, **Then** each step takes the base delay (300ms currently).
2. **Given** a character with 200 movement speed and energy > 0, **When** they travel between city nodes, **Then** each step takes half the base delay (150ms).
3. **Given** a character with 100 movement speed and 0 energy, **When** they travel between city nodes, **Then** each step takes double the base delay (600ms) due to the 50% speed penalty.
4. **Given** a character with 0 energy, **When** they attempt to explore/fish/arena, **Then** the action is refused — but city movement is still allowed (just slower).

---

### User Story 5 - Energy & Movement Speed Displayed in Character Panel (Priority: P2)

The collapsed character panel shows an energy bar (similar to HP bar). The expanded character panel shows the energy bar, current movement speed value, and the derived effective movement speed (accounting for energy depletion penalty).

**Why this priority**: Players need to see their energy to manage it.

**Independent Test**: Open the character panel in both modes and verify energy and movement speed are displayed with correct values.

**Acceptance Scenarios**:

1. **Given** a player with 750/1000 energy, **When** viewing the collapsed panel, **Then** an energy bar shows 750/1000.
2. **Given** a player with 100 movement speed and energy > 0, **When** viewing the expanded panel, **Then** movement speed shows "100" and energy bar shows current/max.
3. **Given** a player with 0 energy and 100 base movement speed, **When** viewing the expanded panel, **Then** effective movement speed shows "50" (or "100 → 50" indicating penalty).

---

### User Story 6 - Admin Configures Energy Regen and HP Regen per Tick (Priority: P3)

In the admin panel's config tab, administrators can set: (a) energy restored per tick, (b) energy tick interval in seconds, (c) HP restored per tick (percentage of max HP), (d) HP tick interval in seconds. Changes take effect on the next tick cycle without server restart.

**Why this priority**: Admin configurability ensures balance can be tuned without code changes.

**Independent Test**: Change config values in admin panel, wait for tick, verify new values are applied.

**Acceptance Scenarios**:

1. **Given** an admin on the config tab, **When** they set "Energy per tick" to 100, **Then** the value is persisted and the next energy tick restores 100 energy to all characters.
2. **Given** an admin on the config tab, **When** they set "HP regen percent" to 15, **Then** the next HP tick heals 15% of max HP instead of the previous value.
3. **Given** an admin on the config tab, **When** they set "Energy tick interval" to 300 (seconds), **Then** the energy regen fires every 5 minutes.

---

### User Story 7 - Gathering Energy Cost Per Second (Priority: P3)

Gathering consumes energy per second at a rate defined per gathering action in the admin panel. If a player runs out of energy mid-gathering, the session ends early and they receive any resources collected up to that point.

**Why this priority**: Per-second energy cost for gathering is a specific mechanic that adds depth to the gathering economy.

**Independent Test**: Start gathering with limited energy and verify the session ends when energy runs out, with partial rewards granted.

**Acceptance Scenarios**:

1. **Given** a gathering action with energy_per_second = 3 and a player with 30 energy, **When** they gather for 10 seconds, **Then** 30 energy is consumed and gathering completes normally.
2. **Given** a gathering action with energy_per_second = 5 and a player with 12 energy, **When** they start gathering, **Then** gathering stops after ~2 seconds (when energy hits 0) and partial rewards are granted.
3. **Given** the admin panel building action editor, **When** editing a gather action, **Then** an "Energy per second" field is available to configure the cost.

---

### Edge Cases

- What happens when a player reconnects mid-gathering and their energy was depleted by the server tick calculation? → Gathering should have already been stopped by the energy check on tick; on reconnect, player sees gathering ended.
- What happens when energy regen and energy consumption happen simultaneously (e.g., tick fires during gathering)? → Regen is applied first, then the next gather tick deducts energy. Net effect may be positive or negative depending on rates.
- What if movement speed is modified by equipment or buffs in the future? → The system should use a `base_movement_speed` (from character) and compute `effective_movement_speed` considering modifiers and energy penalty. For now, only the energy penalty modifier exists.
- What happens if a player has exactly enough energy for one node step but a multi-node path? → Movement should proceed node by node; if energy runs out mid-path, remaining movement continues at the penalized speed (not stopped).
- What happens to energy on death? → Energy is halved (floor division). This provides a moderate death penalty without completely draining the resource.
- Do boss fights cost energy? → Yes, 20 energy (same as arena). Squire expeditions are free since the squire does the work.
- Does tile-map (WASD) movement cost energy? → No. Only city node-to-node travel costs energy. Tile movement is free.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add `energy`, `max_energy`, and `movement_speed` as persistent character attributes with defaults of 1000, 1000, and 100 respectively for all new and existing characters.
- **FR-002**: System MUST deduct energy when performing actions: city node travel (2 per node step), arena fight (20), boss fight (20), fishing (10), explore (10), gathering (configurable per-second rate). Tile-map (WASD) movement is free. Squire expeditions are free.
- **FR-003**: System MUST refuse energy-consuming actions (except city node movement) when player energy is 0, with a clear feedback message.
- **FR-013**: System MUST halve the player's current energy on death (floor division). Energy is not reset to 0 or left unchanged.
- **FR-004**: System MUST apply a 50% movement speed penalty when player energy is 0 (effective speed = base_speed * 0.5).
- **FR-005**: System MUST run a server-wide energy regeneration tick that restores a configurable amount of energy to all characters, capped at max_energy.
- **FR-006**: System MUST allow food items (category: food) to restore energy equal to their `food_power` value when consumed, capped at max_energy.
- **FR-007**: System MUST allow heal items (category: heal) to restore HP equal to their `heal_power` value when consumed, capped at max_hp.
- **FR-008**: System MUST display current energy in the collapsed character panel as a bar, and show energy bar + movement speed in the expanded panel.
- **FR-009**: System MUST provide admin config fields for: energy regen amount per tick, energy tick interval (seconds), HP regen percentage per tick, HP tick interval (seconds).
- **FR-010**: System MUST end gathering sessions early when energy is depleted, granting any resources collected up to that point.
- **FR-011**: System MUST add an "Energy per second" configuration field to gather-type building actions in the admin panel.
- **FR-012**: City node movement MUST still be allowed when energy is 0 (at reduced speed) — it is never fully blocked.

### Key Entities

- **Character (extended)**: Gains `energy` (current value, 0–max_energy), `max_energy` (cap, default 1000), `movement_speed` (base speed, default 100).
- **Admin Config (extended)**: New keys for `energy_regen_per_tick`, `energy_tick_interval_seconds`, `hp_regen_percent`, `hp_tick_interval_seconds`.
- **Building Action — Gather (extended)**: Gains `energy_per_second` (energy cost rate during gathering).
- **Item Definition (existing)**: `food_power` (already exists) used as energy restore amount for food items. `heal_power` (already exists) used as HP restore amount for heal items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can see their energy bar in the collapsed character panel at all times during gameplay.
- **SC-002**: All energy-consuming actions correctly deduct the defined energy cost before execution.
- **SC-003**: Players with 0 energy receive clear feedback when attempting blocked actions and can still navigate (at reduced speed).
- **SC-004**: Energy regenerates server-wide on the configured tick schedule without requiring player interaction.
- **SC-005**: Food items successfully restore energy when consumed, with correct cap enforcement.
- **SC-006**: Admin can modify all energy/HP tick configuration values through the admin panel without server restart.
- **SC-007**: Gathering sessions end gracefully when energy is depleted, with partial rewards preserved.
- **SC-008**: Movement speed penalty is visually perceptible — players notice the speed difference when energy-depleted vs. normal.

## Clarifications

### Session 2026-04-07

- Q: Does tile-map (WASD) movement consume energy? → A: No, tile-map movement is free. Only city node-to-node travel costs energy.
- Q: Do boss fights and squire expeditions cost energy? → A: Boss fights cost 20 energy (same as arena). Squire expeditions are free.
- Q: What happens to energy on character death? → A: Energy is halved (floor division) — a moderate death penalty.

## Assumptions

- `food_power` on item definitions will be repurposed for energy restoration (food items restore energy, not HP). Heal items use `heal_power` for HP restoration. This matches the existing unused fields.
- Energy regen applies to all characters (online and offline), same as HP regen.
- The default energy tick interval will be 5 minutes (300 seconds) with 50 energy restored per tick. These are starting values configurable by admins.
- The default HP tick interval remains 10 minutes with 10% of max HP restored. Making these admin-configurable is a new capability.
- Movement speed stat is not modifiable by equipment in this feature's scope — it starts at 100 and is only affected by the energy depletion penalty. Future features may add equipment modifiers.
- Consuming items (food/heal) requires a new backend handler since none exists currently.
- Energy depletion during city movement does NOT stop the character mid-path — it only applies the speed penalty to remaining steps.
