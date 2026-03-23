# Feature Specification: Tool Durability & Gathering System

**Feature Branch**: `020-tool-gathering`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Introduce tool durability and gathering system — tools have durability and type (Pickaxe, Axe), buildings can define gather actions with configurable events, players perform passive gathering that consumes tool durability over time."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates Tools with Durability (Priority: P1)

An admin creates tool items (e.g. "Wooden Pickaxe") through the admin panel, specifying the tool type (Pickaxe or Axe), power rating, and maximum durability. These properties are stored on the item definition and visible when inspecting the item.

**Why this priority**: Without tool definitions that carry durability and type, no other gathering mechanic can function. This is the foundational data model change.

**Independent Test**: Can be fully tested by creating a tool item in admin, verifying it appears in-game with correct durability/type/power stats.

**Acceptance Scenarios**:

1. **Given** admin is on the item creation form, **When** admin selects category "tool" and sets tool_type to "pickaxe", power to 10, max_durability to 1000, **Then** the item definition is saved with those values and returned in item lists.
2. **Given** a tool item definition exists, **When** a player receives that tool in their inventory, **Then** the inventory slot shows current durability equal to max durability of the definition.
3. **Given** a tool item definition exists, **When** admin edits its power or max_durability, **Then** existing inventory instances retain their current durability but reflect updated power.

---

### User Story 2 - Admin Configures Gather Actions on Buildings (Priority: P1)

An admin defines a "gather" building action (e.g. "Mine Iron Ore") on a building. The action specifies: required tool type, durability cost per second, minimum and maximum gathering duration (in seconds), and a list of weighted events that can occur each second during gathering.

**Why this priority**: Gather actions are the core content definition that drives the entire gathering loop. Without them, players have nothing to gather.

**Independent Test**: Can be tested by creating a gather action via admin, then verifying the action appears on the building in-game with correct parameters.

**Acceptance Scenarios**:

1. **Given** admin is editing a building, **When** admin adds a gather action with tool_type "pickaxe", durability_per_second 5, min_seconds 30, max_seconds 120, and event list, **Then** the action is saved and appears on the building's action list.
2. **Given** a gather action exists, **When** admin defines events: [{type: "resource", item_def_id: 7, quantity: 1, weight: 10, message: "You found iron ore!"}, {type: "nothing", weight: 70}, {type: "monster", monster_id: 3, weight: 10}, {type: "gold", min_amount: 5, max_amount: 15, weight: 5, message: "You found a gold vein!"}, {type: "accident", hp_damage: 8, weight: 5, message: "A rock falls on your head!"}], **Then** all event configurations are persisted and retrievable.

---

### User Story 3 - Player Starts and Completes Gathering (Priority: P1)

A player at a building with a gather action selects the action, chooses a gathering duration within the allowed range, and — provided they have a tool of the required type with sufficient durability — begins gathering. Gathering is passive: each second the server processes one event tick, consuming tool durability. When the timer completes, the player receives a summary of all events that occurred.

**Why this priority**: This is the core gameplay loop. Without it, tools and gather actions have no purpose.

**Independent Test**: Can be tested end-to-end by having a tool, starting a gather action, waiting for completion, and verifying durability was consumed and events occurred.

**Acceptance Scenarios**:

1. **Given** a player has a Pickaxe with 500 durability and a gather action requires pickaxe with durability_per_second 5 for min 30s / max 120s, **When** the player selects 60 seconds duration, **Then** gathering starts (requires 300 durability, player has 500).
2. **Given** gathering is in progress, **When** each second ticks, **Then** one event from the weighted event list is rolled and the tool loses durability_per_second durability.
3. **Given** gathering completes normally, **Then** the player receives a summary log of all events (resources gained, gold found, monsters fought, accidents suffered) and the tool's remaining durability is updated.
4. **Given** a player selects 100 seconds but the tool only has 400 durability (at 5/sec = 80s max), **When** the player attempts to start, **Then** the action is rejected with a message indicating insufficient tool durability.

---

### User Story 4 - Gathering Events: Combat, Resources, Gold, Accidents (Priority: P2)

During gathering, each second has a chance to trigger one of the configured events. Combat pauses gathering while the fight resolves. Resource and gold events are immediately applied. Accidents reduce the player's HP. If HP reaches 0, gathering ends immediately.

**Why this priority**: Events make gathering engaging rather than a simple timer. They depend on the core gathering loop (P1) being functional.

**Independent Test**: Can be tested by configuring gather events and verifying each event type triggers correctly during a gathering session.

**Acceptance Scenarios**:

1. **Given** a "resource" event triggers during gathering, **Then** the specified item and quantity are added to the player's inventory and a message is shown.
2. **Given** a "gold" event triggers, **Then** a random amount between min_amount and max_amount crowns is awarded and the configured message is shown.
3. **Given** a "monster" event triggers, **Then** gathering pauses, a combat encounter starts against the specified monster. After combat resolves (win or loss), gathering resumes if the player is alive, or ends if the player's HP reached 0.
4. **Given** an "accident" event triggers, **Then** the player loses the configured HP amount and the configured message is shown. If HP reaches 0, gathering ends immediately.
5. **Given** a "nothing" event triggers, **Then** no effect occurs and the next second proceeds normally.

---

### User Story 5 - HP as a Persistent Resource (Priority: P2)

HP loss from gathering accidents and monster combat persists after gathering ends. Players with 0 HP cannot start new gathering sessions, explorations, or combat encounters. Players must heal (via healing items or other game mechanics) before resuming activities.

**Why this priority**: HP persistence creates meaningful risk/reward decisions during gathering. It depends on the combat and gathering systems working.

**Independent Test**: Can be tested by taking HP damage during gathering, verifying HP stays reduced after gathering ends, and verifying 0 HP blocks new actions.

**Acceptance Scenarios**:

1. **Given** a player takes 10 HP damage from an accident during gathering, **When** gathering ends, **Then** the player's current_hp remains reduced by 10.
2. **Given** a player's HP reaches 0 during gathering (from accident or combat loss), **Then** gathering ends immediately, tool durability for the full chosen duration is consumed, and the player is shown a summary.
3. **Given** a player has 0 HP, **When** they attempt to start a gather action, **Then** the action is rejected with a message "You must heal before gathering."
4. **Given** a player has 0 HP, **When** they attempt to start an exploration or expedition, **Then** the action is rejected with a similar healing-required message.

---

### User Story 6 - Tool Destruction and Durability Management (Priority: P2)

When a tool's durability reaches 0, the item is destroyed (removed from inventory). If a player cancels gathering early, the tool still loses the full duration's worth of durability. Players can inspect their tools to see remaining durability.

**Why this priority**: Durability as a consumable resource creates an item economy and drives demand for tool crafting/acquisition.

**Independent Test**: Can be tested by using a tool until its durability drops to 0 and verifying it is removed from inventory.

**Acceptance Scenarios**:

1. **Given** a tool has 50 durability remaining and gathering would consume 100 durability, **When** gathering cannot start, **Then** the player is told the tool doesn't have enough durability.
2. **Given** a tool has 200 durability and a 60-second gathering at 5/sec consumes 300 durability (full chosen duration), **When** the player cancels at second 30, **Then** the tool loses 300 durability total (the full chosen duration's cost), causing it to be destroyed since 200 < 300.
3. **Given** a tool is destroyed (durability reaches 0), **Then** the item is removed from the player's inventory and a notification is shown.
4. **Given** a player views their inventory, **When** they inspect a tool item, **Then** they see current durability out of max durability (e.g. "750 / 1000").

---

### User Story 7 - Player Action Lock During Gathering (Priority: P3)

While gathering is in progress, the player cannot perform other actions (travel, explore, start another gathering, craft, etc.) except for ending the current gathering session early.

**Why this priority**: Action locking maintains game integrity and prevents exploits. It mirrors the existing combat lock pattern.

**Independent Test**: Can be tested by starting gathering and attempting other actions, verifying they are blocked.

**Acceptance Scenarios**:

1. **Given** a player is gathering, **When** they attempt to travel, explore, or start another action, **Then** the action is rejected with "You are currently gathering."
2. **Given** a player is gathering, **When** they choose to end gathering early, **Then** gathering stops, the full duration's durability is consumed from the tool, events already triggered are kept, and remaining time is forfeited.
3. **Given** a player disconnects during gathering, **Then** gathering continues server-side and completes normally. Rewards and durability changes are applied. The player sees the summary upon reconnection.

---

### Edge Cases

- What happens when the player's inventory is full during a resource event? The resource is lost with a message "Your inventory is full — resource lost."
- What happens if the configured monster for a combat event no longer exists? The event is treated as "nothing" — no combat occurs for that tick.
- What if multiple tool items of the required type exist in inventory? The system uses the first matching tool (by inventory slot order). Player cannot choose which tool.
- What happens if the admin deletes a gather action while a player is gathering? The in-progress session completes normally using the snapshot of events taken at start time.
- What if the player levels up during gathering (from monster XP)? The level-up is processed normally with stat recalculation; gathering continues.
- What happens to equipped items during gathering combat? Equipment stats apply to combat as they normally would.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a `tool_type` field on tool-category item definitions with values "pickaxe" and "axe" (extensible for future types).
- **FR-002**: System MUST support `max_durability` and `power` fields on tool-category item definitions, set by admin at creation time.
- **FR-003**: Each tool instance in a player's inventory MUST track its own `current_durability`, initialized to the definition's `max_durability` when acquired.
- **FR-004**: System MUST support a new "gather" building action type, configurable per building by admin.
- **FR-005**: Gather action configuration MUST include: required tool_type, durability_per_second, min_seconds, max_seconds, and a weighted event list.
- **FR-006**: Each gather event MUST be one of: "resource" (grants item), "gold" (grants crowns), "monster" (triggers combat), "accident" (damages HP), or "nothing".
- **FR-007**: Each event type MUST support a configurable weight for probability distribution, and event types "resource", "gold", and "accident" MUST support a custom display message.
- **FR-008**: System MUST validate before gathering starts that: the player has a tool of the required type with sufficient durability for the full chosen duration, the player has > 0 HP, and the player is not in combat or another action.
- **FR-009**: During gathering, the server MUST process one event tick per second, consuming durability_per_second from the tool each tick.
- **FR-010**: When a "monster" event triggers during gathering, the system MUST pause the gathering timer, run a full combat encounter, and resume or end gathering based on the player's surviving HP.
- **FR-011**: When the player's HP reaches 0 during gathering (from accident or combat), gathering MUST end immediately.
- **FR-012**: When gathering ends (normally, early cancellation, or HP death), the tool MUST lose the full chosen duration's worth of durability regardless of actual time elapsed.
- **FR-013**: When a tool's current_durability reaches 0 or below, the item MUST be destroyed (removed from inventory) and the player MUST be notified.
- **FR-014**: During gathering, the player MUST be blocked from all other actions except ending the gathering early.
- **FR-015**: The player MUST receive a summary of all gathering events upon completion.
- **FR-016**: Players with 0 HP MUST be blocked from starting gathering, exploration, or expedition actions.
- **FR-017**: HP changes from gathering events (accidents, combat) MUST persist after gathering ends.
- **FR-018**: Admin MUST be able to create, edit, and delete gather actions and their event configurations through the admin panel.
- **FR-019**: The "accident" event type MUST support a configurable HP damage amount and custom message.
- **FR-020**: The "gold" event type MUST support configurable min_amount and max_amount for the crowns reward.
- **FR-021**: The "resource" event type MUST specify an item_def_id and quantity to grant.

### Key Entities

- **Tool Definition**: Extension of item_definition for tool-category items — adds tool_type (pickaxe, axe), power, and max_durability.
- **Tool Instance**: An inventory slot holding a tool item — tracks current_durability independently per instance.
- **Gather Action**: A building action of type "gather" — defines required_tool_type, durability_per_second, min_seconds, max_seconds, and event list.
- **Gather Event**: A weighted event entry on a gather action — defines type (resource/gold/monster/accident/nothing), type-specific parameters (item, amount, monster, damage), weight, and optional message.
- **Gathering Session**: An active server-side session tracking a player's in-progress gathering — includes chosen duration, tick counter, event log, tool reference, and action snapshot.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can create a tool item with durability and power, and a player can see those stats within the inventory — achievable in a single admin+player test flow.
- **SC-002**: A complete gathering session (start → events → completion → summary) executes without errors for durations between 30 and 120 seconds.
- **SC-003**: All five event types (resource, gold, monster, accident, nothing) trigger correctly with probabilities matching their configured weights (within statistical tolerance over 100+ ticks).
- **SC-004**: Tool durability decreases by the expected amount after gathering and tools are destroyed when durability reaches 0.
- **SC-005**: Players with 0 HP are blocked from starting any gathering, exploration, or combat action.
- **SC-006**: Players cannot perform other actions while gathering, except ending early.
- **SC-007**: Combat encounters during gathering resolve fully (win/loss) and gathering resumes or ends appropriately based on player HP.
- **SC-008**: A player cancelling gathering early still loses the full chosen duration's durability cost from the tool.

## Assumptions

- Tool types start with "pickaxe" and "axe" but the system should store this as a flexible string/enum to allow future types without schema migration.
- Power rating on tools is stored for future use (e.g. affecting gather speed or yield) but has no gameplay effect in this initial implementation beyond display.
- The gathering tick rate is 1 second, matching the description. This is server-side; the client displays a progress timer.
- Healing mechanics already exist via heal items (food_power/heal_power on item definitions and item use system). No new healing system is needed.
- The first matching tool in inventory slot order is used automatically — no tool selection UI is needed for MVP.
- Durability is an integer value, not fractional.
- The event snapshot (copy of event config) is taken when gathering starts, so mid-gathering admin edits do not affect in-progress sessions.
