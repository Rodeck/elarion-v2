# Feature Specification: Day/Night Cycle

**Feature Branch**: `013-day-night-cycle`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Let's introduce day and night cycle. Day lasts 45 minutes and night 15. Admin can run command to switch /day /night. When there is day, everything is normal, in night, when player moves, on each node there is 10% chance player encounters enemy and needs to fight it. Enemies that can be encountered are configured per map, with percentage e.g 10% to encounter monster which is fixed for all maps, and then 33% for rat, 66% for dog and 1% for stone golem. Additionally, all enemies are 10% stronger during night (hp, attack, defence), this affects enemies in exploration as well as random traveling encounters. To visualise day/night cycle, on the top border of the map should be progress bar, where it's yellow during day and has sun in the end of the bar, and then switches to moon during the night. Progress bar also shows how much time is left to next switch. When night ends progress bar goes back to 0."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Day/Night Cycle Progression (Priority: P1)

The world alternates between day and night automatically. Day lasts 45 minutes and night lasts 15 minutes. All connected players experience the same cycle at the same time — the cycle is server-authoritative and shared globally. A visual progress bar at the top of the map shows the current phase and countdown to the next transition.

**Why this priority**: This is the foundational mechanic that all other parts of this feature build upon. Without a functioning cycle, encounter rolls and stat bonuses cannot be tested.

**Independent Test**: A player can log in and observe the progress bar cycling through day (45 min) and then night (15 min), with the bar resetting to zero at the end of night, before any encounter or stat changes are implemented.

**Acceptance Scenarios**:

1. **Given** the server starts fresh, **When** the cycle begins, **Then** it enters day phase lasting exactly 45 minutes before transitioning to night.
2. **Given** day is active, **When** 45 minutes elapse, **Then** the server transitions to night and notifies all connected clients.
3. **Given** night is active, **When** 15 minutes elapse, **Then** the server transitions back to day and notifies all connected clients.
4. **Given** a player opens the game, **When** in day phase, **Then** the progress bar at the top of the map is yellow, displays a sun icon at the leading edge, and shows time remaining until night.
5. **Given** a player opens the game, **When** in night phase, **Then** the progress bar displays a moon icon and shows time remaining until day.
6. **Given** night ends, **When** the cycle resets to day, **Then** the progress bar resets visually to zero and begins filling again.
7. **Given** night is active, **When** a player views the map, **Then** the map area displays a subtle dark overlay indicating night, which disappears when day returns.

---

### User Story 2 - Admin Phase Control (Priority: P2)

An admin can manually override the current phase by typing `/day` or `/night` in the in-game admin command interface. The override takes effect immediately for all players without waiting for the natural cycle to expire. The cycle timer resets from the moment of the override (i.e., typing `/day` starts a fresh 45-minute day).

**Why this priority**: Admins need the ability to control game conditions for testing and live events. This is a direct user-facing control surface on top of the existing cycle.

**Independent Test**: An admin types `/night` during daytime. All players immediately see the progress bar switch to night mode and the moon icon appears. The 15-minute night timer begins.

**Acceptance Scenarios**:

1. **Given** day is active, **When** admin types `/night`, **Then** the phase immediately switches to night and a fresh 15-minute night timer begins for all players.
2. **Given** night is active, **When** admin types `/day`, **Then** the phase immediately switches to day and a fresh 45-minute day timer begins for all players.
3. **Given** a non-admin player, **When** they type `/day` or `/night`, **Then** the command is rejected and has no effect.
4. **Given** admin sends `/night`, **When** the override takes effect, **Then** all connected players receive the updated phase and remaining time in real time.

---

### User Story 3 - Night Encounter Rolls on Movement (Priority: P3)

During night, every time a player moves to a new node on the map, there is a 10% chance they trigger a random enemy encounter. The enemy is selected based on the encounter table configured for the current map. The encounter initiates combat immediately, interrupting further movement until resolved.

**Why this priority**: This is the primary gameplay impact of night. It introduces risk and tension that changes player behavior during night hours.

**Independent Test**: With night active and an encounter table configured for a map, move a player across multiple nodes. After approximately 10 moves, at least one encounter should have been triggered. Combat begins automatically on encounter.

**Acceptance Scenarios**:

1. **Given** night is active and player is on a map with encounter configuration, **When** the player steps through each node (including during multi-node routes), **Then** the system rolls an independent 10% chance for a random encounter per node.
2. **Given** an encounter is triggered, **When** the enemy is selected, **Then** the enemy type is chosen according to the map's encounter table (weighted random by configured percentages).
3. **Given** day is active, **When** the player moves, **Then** no random encounter rolls occur.
4. **Given** an encounter triggers mid-route, **When** combat begins, **Then** the remaining route is cancelled and the player must manually re-issue movement after combat is resolved (won, fled, or lost).
5. **Given** a map with no encounter configuration, **When** the player moves at night, **Then** no encounters are triggered (graceful fallback).

---

### User Story 4 - Per-Map Encounter Table Configuration (Priority: P4)

Each map can define its own set of possible random encounter enemies and their spawn weights. A global baseline ensures that "monster" is always available at 10% across all maps. Within that 10%, per-map configuration defines the breakdown of specific monster types by relative percentage (e.g., 33% rat, 66% dog, 1% stone golem).

**Why this priority**: Encounter diversity depends on this configuration layer. Without it, every map would have the same encounter pool, reducing world variety.

**Independent Test**: Configure two maps with different encounter tables. Trigger many encounters on each map and verify that the distribution of enemy types matches each map's configured weights.

**Acceptance Scenarios**:

1. **Given** a map has an encounter table defined, **When** an encounter triggers, **Then** the enemy type is selected from that map's table using weighted random selection.
2. **Given** the encounter table specifies 33% rat / 66% dog / 1% stone golem, **When** a large sample of encounters is observed, **Then** the distribution approximates those percentages.
3. **Given** a map has no custom encounter table, **When** an encounter triggers, **Then** the system uses a fallback default enemy or skips the encounter gracefully.
4. **Given** the admin configures encounter tables via the admin backend, **When** a player triggers an encounter on that map, **Then** the updated table is used.

---

### User Story 5 - Night Enemy Stat Bonus (Priority: P5)

During night, all enemies across the game are 10% stronger: their maximum HP, attack power, and defence are each increased by 10%. This applies both to enemies encountered during exploration (pre-placed monster encounters) and to random travel encounters triggered by movement. The bonus is applied at the moment of combat initiation and does not persist beyond the encounter.

**Why this priority**: This makes night mechanically meaningful beyond just encounter frequency — even planned fights become harder, incentivising risk management.

**Independent Test**: Note the stats of a specific exploration enemy during day. Switch to night. Engage the same enemy type and verify its HP, attack, and defence are each 10% higher than the daytime baseline.

**Acceptance Scenarios**:

1. **Given** night is active, **When** any combat encounter begins (exploration or random travel), **Then** the enemy's HP, attack, and defence are each multiplied by 1.1 compared to their base values.
2. **Given** day is active, **When** any combat encounter begins, **Then** the enemy uses its unmodified base stats.
3. **Given** a combat encounter is in progress when the phase transitions, **Then** the already-initiated combat uses the stats it was started with (no mid-fight stat change).
4. **Given** the night bonus is applied, **When** the encounter ends, **Then** subsequent encounters correctly use the appropriate stats for the current phase.

---

### Edge Cases

- What happens when a player logs in mid-cycle? They receive the current phase and remaining time immediately, and the progress bar is positioned correctly.
- What happens if both `/day` and `/night` are sent in rapid succession? The last command wins; each resets the timer.
- What happens when the cycle transitions while a player is in the middle of combat? The combat continues with the stats it was initiated with; the visual progress bar updates but the encounter is unaffected.
- What happens when encounter probability rolls produce no encounter for many consecutive moves? This is expected; 10% means roughly 1-in-10 moves triggers an encounter, not every 10th move.
- What happens if the server restarts mid-cycle? On restart, the cycle resets to the start of day.
- What happens when an encounter triggers mid-route? The remaining route is cancelled; the player must re-issue movement after combat ends.

## Clarifications

### Session 2026-03-09

- Q: Are there any visual night effects on the map beyond the progress bar? → A: Yes — during night, the map area should be darkened with a subtle overlay to clearly indicate night.
- Q: What colour should the night progress bar be? → A: Blue or silver/cool tone (distinct from the yellow day bar).
- Q: How do admins configure per-map encounter tables? → A: Via a new section/form in the existing admin backend UI.
- Q: During multi-node routes, does the encounter roll apply once per node or once per route? → A: Once per node — every node stepped through triggers a separate 10% roll.
- Q: When an encounter triggers mid-route, what happens to the remaining route nodes? → A: Route is cancelled; player must manually re-issue movement after resolving combat.
- Q: Does map darkening apply to all maps or only maps with encounter tables? → A: All maps globally — dark overlay appears on every map during night.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST maintain a global, server-authoritative day/night cycle shared by all connected players.
- **FR-002**: The day phase MUST last exactly 45 minutes and the night phase MUST last exactly 15 minutes, unless overridden by an admin command.
- **FR-003**: Admins MUST be able to type `/day` or `/night` to immediately switch the current phase; the cycle timer resets from that moment.
- **FR-004**: Non-admin players MUST NOT be able to trigger `/day` or `/night` phase changes.
- **FR-005**: During night, every player movement to a new map node MUST trigger a 10% random encounter roll.
- **FR-006**: When a random encounter triggers, the enemy type MUST be selected using the weighted encounter table configured for the current map.
- **FR-007**: Each map MUST support a configurable encounter table specifying enemy types and their relative spawn weights; admins MUST be able to create and edit these tables through a dedicated section in the existing admin backend UI.
- **FR-008**: If a map has no encounter table configured, the system MUST skip random encounter rolls gracefully (no crash, no default encounter).
- **FR-009**: During night, all enemies (exploration and random encounter) MUST have their HP, attack, and defence each increased by 10% at the moment combat is initiated.
- **FR-010**: During day, enemies MUST use their unmodified base stats.
- **FR-011**: The game UI MUST display a progress bar at the top border of the map area showing the current phase and time remaining until the next transition.
- **FR-012**: During day, the progress bar MUST be yellow and display a sun icon at the leading (filled) edge.
- **FR-013**: During night, the progress bar MUST be blue/silver in colour and display a moon icon at the leading edge.
- **FR-014**: When night ends and day begins, the progress bar MUST visually reset to zero and begin filling from the start.
- **FR-015**: The progress bar MUST update in real time, reflecting the current progress and remaining time for all connected players.
- **FR-016**: All connected clients MUST be notified of phase transitions immediately when they occur (admin override or natural timer).
- **FR-017**: During night, the map area on ALL maps MUST display a subtle dark overlay to visually reinforce that it is night; the overlay MUST be removed when day resumes, regardless of whether the map has an encounter table configured.

### Key Entities

- **Day/Night Cycle State**: The current phase (day or night), the timestamp when the current phase started, and the configured durations for each phase. Server-authoritative and broadcast to all clients.
- **Encounter Table**: Per-map configuration defining which enemy types can appear in random night encounters and their relative percentage weights. Associated with a map identifier.
- **Encounter Roll**: A probabilistic event triggered on each player movement during night. Resolves to either no encounter or a specific enemy type selected from the encounter table.
- **Night Combat Modifier**: A transient 10% multiplicative bonus applied to enemy HP, attack, and defence at combat initiation during night phase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Day and night transitions occur within 2 seconds of the scheduled time, as observed by all connected players simultaneously.
- **SC-002**: Admin phase override commands take effect within 1 second of being sent, as observable in the progress bar update for all connected players.
- **SC-003**: Random encounter rolls produce a distribution within ±3% of the configured 10% rate when measured over 200+ movement events.
- **SC-004**: Enemy stat bonuses during night are applied accurately: HP, attack, and defence each measure exactly 10% higher than daytime baseline values for the same enemy type.
- **SC-005**: The progress bar correctly reflects the phase and remaining time within 5 seconds of a player connecting or the phase changing.
- **SC-006**: No player movement during night results in an encounter roll on a map with an unconfigured encounter table (zero errors logged for missing configuration).
- **SC-007**: Weighted enemy selection from encounter tables produces a distribution within ±5% of configured weights when measured over 100+ encounters per map.

## Assumptions

- The cycle is global — all players on all maps share the same day/night phase simultaneously. Per-map independent cycles are out of scope.
- The encounter roll (10% per node) applies to every individual node stepped through during travel, not once per route. A route crossing 5 nodes produces 5 independent rolls.
- "10% encounter monster" in the feature description means 10% of encounter rolls produce any enemy. The per-map encounter table then governs which specific enemy appears within that 10%.
- The night stat bonus applies only when combat is initiated, not retroactively to ongoing fights.
- On server restart, the cycle resets to the start of day (zero elapsed time).
- Encounter tables are managed through a new section in the existing admin backend UI (form-based, not raw SQL or config files).
- "Progress bar at the top border of the map" means within the existing game UI map area, not a new full-width browser element.
- The night dark overlay applies globally to all maps, not only maps with encounter tables configured.
