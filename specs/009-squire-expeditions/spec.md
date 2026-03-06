# Feature Specification: Squire Expeditions

**Feature Branch**: `009-squire-expeditions`
**Created**: 2026-03-06
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Configures Expedition for a Building (Priority: P1)

An admin wants to enable passive expeditions at a specific building. They open the admin panel, navigate to the building's action configuration, add an expedition action, define possible rewards (gold, experience, and/or items with quantities), and save. The system persists the expedition configuration and makes it available to players at that building.

**Why this priority**: The entire feature depends on admins being able to define expeditions. Without this, nothing else works. It is also self-contained and testable in isolation through the admin panel alone.

**Independent Test**: Create a building with an expedition configured — verify it appears with correct rewards and durations in the admin panel, then confirm it is reflected in the building's available actions for players.

**Acceptance Scenarios**:

1. **Given** an admin is on the building configuration page, **When** they add an expedition action and specify rewards (e.g., 50 gold, 100 exp, 2x Health Potion) and enable all three durations, **Then** the expedition is saved and listed as an active action for that building.
2. **Given** an expedition is configured, **When** an admin disables the expedition for the building, **Then** the expedition no longer appears as an available action for players at that building.
3. **Given** an admin specifies rewards for an expedition, **When** they save, **Then** each duration (1h, 3h, 6h) inherits the same base reward pool with appropriate time-scaled multipliers applied.

---

### User Story 2 - Player Sends a Squire on an Expedition (Priority: P1)

A player visits a building that has an expedition available and has at least one idle squire. They open the building menu, see the expedition option, choose a duration, and dispatch their squire. The squire becomes unavailable for other expeditions for the chosen duration.

**Why this priority**: This is the core player interaction. Without sending squires, the passive loop does not exist. It is independently testable end-to-end with a configured building and an available squire.

**Independent Test**: Open the building menu with an idle squire and an expedition-enabled building — select a duration, confirm, verify squire is now marked as exploring and no longer selectable for another expedition.

**Acceptance Scenarios**:

1. **Given** a player has an idle squire and visits a building with an expedition, **When** they open the building menu and select the expedition action, **Then** they see the available durations (1h, 3h, 6h) with a preview of expected reward ranges for each.
2. **Given** a player selects a duration and confirms, **When** the squire is dispatched, **Then** the squire status changes to "exploring" and is unavailable for further expeditions until it returns.
3. **Given** a player has no idle squires (all are currently exploring), **When** they open a building's expedition action, **Then** the system shows that no squires are available and the dispatch option is disabled.
4. **Given** a player has one idle squire and one exploring squire, **When** they attempt to send on an expedition, **Then** only the idle squire is eligible and can be dispatched.

---

### User Story 3 - Player Receives Completion Notification (Priority: P2)

When a squire finishes an expedition, the player automatically receives a system message in the chat area (regardless of what screen they are on) indicating which squire finished and at which building. The player does not need to be actively playing to receive the notification — it appears when they next view the game.

**Why this priority**: Notification closes the passive loop and tells the player when to take action. It is separable from reward collection (a player can ignore the notification and collect later).

**Independent Test**: Dispatch a squire and wait for the timer to expire — verify the system message appears in the chat log with the squire's name and building name.

**Acceptance Scenarios**:

1. **Given** a squire's expedition duration has elapsed, **When** the server processes the completion, **Then** the player receives a system message in the format "Squire [Name] has finished exploring at [Building Name]. Visit the building to collect your rewards."
2. **Given** a player is offline when the expedition completes, **When** they next log in, **Then** the completion system message is present in their chat log.
3. **Given** multiple squires complete expeditions at different times, **When** the player checks the chat, **Then** each completion generates a distinct message with the correct squire name and building name.

---

### User Story 4 - Player Collects Expedition Rewards (Priority: P2)

After receiving the notification, the player travels to the building where their squire explored, opens the building menu, and collects the rewards. The squire is released back to idle status.

**Why this priority**: Reward collection is the payoff of the passive loop. It depends on Story 3 (notification) but can also be accessed directly by visiting the building, so it is independently discoverable.

**Independent Test**: After a squire completes an expedition, visit the building — confirm a "Collect Rewards" option appears, confirm rewards (gold, exp, items) are added to the player's character, and confirm the squire returns to idle.

**Acceptance Scenarios**:

1. **Given** a squire has completed an expedition, **When** the player opens that building's menu, **Then** a "Collect Rewards" option appears showing the squire's name and the reward breakdown.
2. **Given** the player confirms reward collection, **When** the action completes, **Then** gold and experience are credited to the player's character and items are added to their inventory.
3. **Given** rewards are collected, **When** the action completes, **Then** the squire's status returns to idle and is available for future expeditions.
4. **Given** the player visits a building where their squire is still exploring (not yet finished), **When** they open the building menu, **Then** no "Collect Rewards" option appears; instead, the remaining time is shown.

---

### User Story 5 - Admin Views and Edits Expedition Reward Configuration (Priority: P3)

An admin wants to review all buildings that have expeditions enabled and adjust the reward configuration for one. They navigate to the admin panel, see the list of expedition-enabled buildings, edit a reward pool, and save.

**Why this priority**: Day-to-day admin management of expeditions. The core gameplay works without editing, but ongoing balance tuning requires this.

**Independent Test**: Modify an existing expedition's reward amounts in the admin panel — verify the updated values are reflected when a player views the expedition at that building.

**Acceptance Scenarios**:

1. **Given** an expedition is configured for a building, **When** an admin edits the reward amounts and saves, **Then** subsequent expeditions at that building use the updated reward values.
2. **Given** a squire is currently exploring under the old configuration, **When** the reward config is updated, **Then** the in-progress expedition uses the rewards that were set when it was started (snapshot at dispatch time).

---

### Edge Cases

- What happens when a building's expedition is disabled while a squire is mid-expedition? The squire completes normally with the rewards that were active at dispatch time.
- What happens if a player logs out immediately after dispatching a squire? The expedition continues server-side; the squire returns and the notification appears on next login.
- What happens if a player never collects rewards? Rewards persist on the building indefinitely (no expiry) until collected.
- What happens if an item reward type is later removed from the game? The reward collection should degrade gracefully — gold and exp are still awarded; removed items are skipped with no error shown.
- What happens when multiple squires are added in the future? The system should support dispatching any idle squire (name-selectable) and tracking each independently.
- What if two expeditions complete at the same building simultaneously (future multi-squire scenario)? Each squire's rewards are tracked separately and collected independently.

---

## Requirements *(mandatory)*

### Functional Requirements

**Admin — Expedition Configuration**

- **FR-001**: Admins MUST be able to enable or disable an expedition action per building from the admin panel.
- **FR-002**: Admins MUST be able to specify a base reward pool for each expedition, including: gold amount, experience amount, and zero or more items with quantities.
- **FR-003**: The system MUST support exactly three expedition durations: 1 hour, 3 hours, and 6 hours.
- **FR-004**: The system MUST scale rewards by duration using a sub-linear multiplier, so that a 6-hour expedition yields a higher total reward than a 1-hour expedition, but a lower reward per hour than a 1-hour expedition.
- **FR-005**: Reward configuration MUST be stored as a snapshot at the time of squire dispatch, so changes made after dispatch do not affect in-progress expeditions.

**Player — Squire Management**

- **FR-006**: Every new player MUST start with exactly one squire with a pre-assigned name.
- **FR-007**: A squire MUST have one of two states: idle or exploring. Only idle squires can be dispatched.
- **FR-008**: Players MUST be able to view the status of their squire(s) to know whether they are available or currently exploring.

**Player — Sending Squires**

- **FR-009**: Players MUST be able to initiate an expedition from the building menu only when a building has an expedition action enabled and the player has at least one idle squire.
- **FR-010**: The building menu MUST display the three duration options along with a preview of expected reward ranges for each.
- **FR-011**: Upon confirming a dispatch, the squire's status MUST immediately change to exploring and remain unavailable until the expedition completes.

**Completion & Notification**

- **FR-012**: The system MUST detect expedition completion server-side and generate a system message for the player containing the squire's name and the building name.
- **FR-013**: The system message MUST be delivered to the player's chat log and visible upon their next session if they were offline at completion time.

**Reward Collection**

- **FR-014**: After a squire's expedition completes, the building menu MUST present a "Collect Rewards" option to the player showing the squire's name and itemized rewards.
- **FR-015**: Upon collection, the system MUST credit gold and experience to the player's character and add items to their inventory atomically (all rewards delivered or none, to avoid partial delivery).
- **FR-016**: Upon successful collection, the squire's status MUST return to idle.
- **FR-017**: If the player visits a building where a squire is still exploring, the building menu MUST display the squire's name and estimated remaining time, with no collection option.

### Key Entities

- **ExpeditionDefinition**: Represents an admin-configured expedition at a building. Attributes include: associated building, enabled flag, base reward pool (gold, exp, items with quantities).
- **Squire**: Represents a player-owned companion that can be sent on expeditions. Attributes include: name, owner (player), current status (idle or exploring), and if exploring: target building, chosen duration, start time, reward snapshot.
- **ActiveExpedition**: Captures the in-progress state of a squire on an expedition. Includes squire reference, building reference, duration chosen, start timestamp, expected completion timestamp, and the reward snapshot taken at dispatch.
- **ExpeditionReward** (value object): A snapshot of the rewards to be awarded upon collection — gold amount, exp amount, list of item types and quantities scaled to the chosen duration.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can configure a new expedition for a building (enable it and define rewards) in under 2 minutes using the admin panel.
- **SC-002**: A player can dispatch a squire on an expedition in under 30 seconds from opening the building menu to confirmed dispatch.
- **SC-003**: 100% of completed expeditions generate a system notification visible in the player's chat log — no silent completions.
- **SC-004**: Reward collection completes in a single interaction (one confirmation) with all rewards (gold, exp, items) visible to the player before they confirm.
- **SC-005**: Reward amounts for a 6-hour expedition are greater in total than a 1-hour expedition, but the reward-per-hour rate for 6 hours is measurably lower than for 1 hour (validated by admin-defined base values and the scaling formula).
- **SC-006**: A squire dispatched by one player is never visible as available to another player — squire availability is fully isolated per player.
- **SC-007**: Expeditions that complete while the player is offline are correctly reflected (notification in chat log, collect option on building) when the player next logs in, with no data loss.

---

## Assumptions

- Players have a single squire at launch; the system should be designed to support additional squires in the future without a full redesign.
- Squire names are pre-assigned by the system at character creation; players cannot rename squires in this feature.
- The scaling formula is determined by the development team during planning; the spec only requires sub-linear scaling (higher total, lower rate-per-hour at longer durations).
- Item rewards reference the existing item definition system (`item_definitions` table); if an item is removed from the game, that reward line is silently skipped.
- Expedition rewards do not expire — uncollected rewards persist until the player collects them.
- The notification system uses the existing in-game chat/system message infrastructure already present in the codebase.
- Admin panel already supports adding action types to buildings; this feature extends that with a new "expedition" action type.
