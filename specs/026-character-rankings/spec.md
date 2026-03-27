# Feature Specification: Character Rankings

**Feature Branch**: `026-character-rankings`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Implement character rankings system with top level, top won fights, top crafters, map breakdown, top quests completed, and player count. Accessible via button next to quests. Periodic calculation preferred over real-time."

## Clarifications

### Session 2026-03-27

- Q: What counts as a "combat victory" for Top Fighters? → A: Only player-controlled monster fights (explore zone combat). Squire expeditions are excluded.
- Q: Should the player see their own rank if outside the top 20? → A: Yes, the player's own rank is always shown — appended below the top 20 if not already listed.
- Q: Should leaderboard entries display character class? → A: Yes, show class name and/or icon next to the character name.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Character Rankings (Priority: P1)

A player wants to see how they compare to other players. They click the "Rankings" button in the top bar (next to the existing "Quests" button) to open a rankings panel. The panel displays multiple ranking categories in tabs or sections, starting with the "Top Level" leaderboard by default. Each leaderboard shows a ranked list of character names with their relevant stat value. The player can see their own rank highlighted if they appear in the list.

**Why this priority**: Core feature — without viewable rankings, the feature has no value. This is the minimum viable product.

**Independent Test**: Can be fully tested by clicking the Rankings button and verifying that ranked character lists appear with correct ordering, and delivers competitive engagement value.

**Acceptance Scenarios**:

1. **Given** a logged-in player on any game screen, **When** they click the "Rankings" button in the top bar, **Then** a rankings panel opens displaying the "Top Level" leaderboard with characters sorted by level descending.
2. **Given** the rankings panel is open, **When** the player views a leaderboard, **Then** each entry shows rank position, character class icon/name, character name, and the relevant stat value.
3. **Given** the rankings panel is open, **When** the player's character appears in a leaderboard, **Then** their entry is visually highlighted/distinguished from other entries.
4. **Given** the rankings panel is open and the player is not in the top 20, **When** the player views a leaderboard, **Then** their own rank and stat value are shown appended below the top 20 list.
5. **Given** the rankings panel is open, **When** the player clicks the Rankings button again or a close button, **Then** the panel closes.

---

### User Story 2 - Browse Ranking Categories (Priority: P1)

A player wants to explore different ranking categories. The panel offers multiple tabs/sections: Top Level, Top Fighters, Top Crafters, Top Questers, and Map Population. The player can switch between categories to see different leaderboards.

**Why this priority**: Multiple categories are core to the feature's value proposition — a single leaderboard would be too limited to drive engagement.

**Independent Test**: Can be tested by switching between each ranking category tab and verifying correct data displays for each.

**Acceptance Scenarios**:

1. **Given** the rankings panel is open, **When** the player selects the "Top Level" tab, **Then** characters are ranked by level (descending), with experience as tiebreaker.
2. **Given** the rankings panel is open, **When** the player selects the "Top Fighters" tab, **Then** characters are ranked by number of player-controlled monster combat victories (descending). Squire expedition outcomes are excluded.
3. **Given** the rankings panel is open, **When** the player selects the "Top Crafters" tab, **Then** characters are ranked by number of completed crafting sessions (descending).
4. **Given** the rankings panel is open, **When** the player selects the "Top Questers" tab, **Then** characters are ranked by number of completed quests (descending).
5. **Given** the rankings panel is open, **When** the player selects the "Map Population" tab, **Then** a breakdown of maps is shown with the count of players currently on each map.

---

### User Story 3 - View Server Statistics (Priority: P2)

A player wants to see general server health and population. The rankings panel includes a summary section showing the total number of active characters on the server.

**Why this priority**: Adds social context and server vitality signal, but is secondary to competitive leaderboards.

**Independent Test**: Can be tested by opening the rankings panel and verifying the total player count is displayed and matches the actual number of characters.

**Acceptance Scenarios**:

1. **Given** the rankings panel is open, **When** the player views the panel, **Then** the total number of characters on the server is displayed prominently.
2. **Given** multiple characters exist in the game, **When** the player views map population, **Then** the sum of players across all maps equals the total character count.

---

### User Story 4 - Rankings Stay Fresh Without Real-Time Updates (Priority: P2)

Rankings are calculated periodically (not in real-time) to conserve server resources. Players see reasonably recent data, and the panel indicates when rankings were last updated.

**Why this priority**: Important for performance and player expectations, but not blocking core functionality.

**Independent Test**: Can be tested by verifying the "last updated" timestamp displays and that rankings data refreshes on a periodic schedule.

**Acceptance Scenarios**:

1. **Given** the rankings panel is open, **When** the player views any leaderboard, **Then** a "Last updated" timestamp is shown indicating when the data was calculated.
2. **Given** a player levels up, **When** they open the rankings panel before the next calculation cycle, **Then** the old rankings are shown (not real-time), which is expected behavior.
3. **Given** the periodic calculation runs, **When** a player opens the rankings panel afterward, **Then** updated rankings reflecting recent changes are displayed.

---

### Edge Cases

- What happens when there are fewer than the display limit of characters? Display all available characters without empty rows.
- What happens when two characters have the same stat value? Use secondary sort criteria (alphabetical by name) for consistent ordering.
- What happens when a character has zero combat wins? They still appear in the fighters ranking, ranked at the bottom.
- What happens when a new character is created before the next ranking calculation? They won't appear until the next periodic update — this is acceptable.
- What happens when the server has no characters? Show an empty state message like "No rankings available yet."
- What happens when combat wins data doesn't exist yet (new tracking)? Characters start at zero wins; the leaderboard will populate as players engage in combat.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Rankings" button in the top bar, positioned next to the existing "Quests" button.
- **FR-002**: System MUST show a rankings panel overlay when the Rankings button is clicked, similar in style to the existing Quest Log panel.
- **FR-003**: System MUST provide the following ranking categories: Top Level, Top Fighters (combat wins), Top Crafters (completed crafting sessions), Top Questers (completed quests), and Map Population (player count per map).
- **FR-004**: Each leaderboard MUST display rank position, character class (icon and/or name), character name, and the relevant stat value, sorted descending by the ranking metric.
- **FR-005**: System MUST highlight the current player's entry in each leaderboard if they appear in the displayed list.
- **FR-005a**: If the current player is not in the top 20, their rank and stat value MUST be shown appended below the leaderboard.
- **FR-006**: System MUST display the total number of characters on the server.
- **FR-007**: Rankings MUST be calculated periodically (not in real-time) to conserve server resources.
- **FR-008**: System MUST show a "Last updated" timestamp on the rankings panel indicating when data was last calculated.
- **FR-009**: System MUST persist combat victory counts per character to support the "Top Fighters" ranking. Only player-controlled monster fights count; squire expedition outcomes are excluded.
- **FR-010**: Each leaderboard MUST show a fixed number of top entries (top 20).
- **FR-011**: The rankings panel MUST be closable via a close button or by clicking the Rankings button again (toggle behavior).
- **FR-012**: Map Population view MUST show each map/zone name alongside its current player count, sorted by player count descending.

### Key Entities

- **Ranking Snapshot**: A point-in-time calculation of all ranking categories. Contains the timestamp of calculation and the ranked data for each category.
- **Combat Stats**: Per-character tracking of player-controlled monster combat victories (excludes automated expedition outcomes). Linked to a character, accumulates over the character's lifetime.
- **Leaderboard Entry**: A single row in a ranking — character identifier, character name, character class, rank position, and stat value.
- **Map Population Entry**: A zone/map identifier, zone name, and count of characters currently located there.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can open the rankings panel and view any ranking category within 2 seconds of clicking the button.
- **SC-002**: Rankings data is no more than 5 minutes stale under normal operation.
- **SC-003**: The periodic ranking calculation completes without noticeably impacting game server responsiveness.
- **SC-004**: All five ranking categories (Level, Fighters, Crafters, Questers, Map Population) display correct data matching the underlying game state at last calculation time.
- **SC-005**: The player's own ranking entry is visually distinguishable in every leaderboard where they appear, or shown below the top 20 if not in the list.
- **SC-006**: Total player count displayed matches the actual number of characters in the game.

## Assumptions

- The rankings panel UI will follow the existing game's dark medieval aesthetic (consistent with Quest Log, Building Panel, etc.).
- Combat victories are currently not persisted — a new tracking mechanism will be needed (incrementing a counter on combat win).
- "Top 20" is a reasonable default leaderboard size for the current game scale.
- Periodic calculation interval of ~5 minutes provides a good balance between freshness and resource usage.
- "Players on each map" uses the character's current zone — this reflects where characters are right now, not historical visits.
- The rankings button style matches the existing "Quests" button style in the top bar.

## Scope Boundaries

**In scope**:
- Rankings panel UI (open/close, category tabs, leaderboard display)
- Periodic backend calculation of all ranking categories
- New combat victory tracking (persist win count per character)
- Message to deliver ranking data to the client on request
- "Last updated" timestamp display

**Out of scope**:
- Historical ranking trends or graphs
- Per-class or per-level-bracket filtering
- Rankings for PvP (only PvE combat wins)
- Rewards or titles based on ranking position
- Admin panel management of rankings
- Real-time ranking updates or push notifications on rank changes
