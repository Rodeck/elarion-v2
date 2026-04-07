# Feature Specification: Player Interaction Panel

**Feature Branch**: `037-player-interaction`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Add ability to interact with other players. Replace Combat log panel with a panel that shows players in the same location. When users click on player name it opens modal with some player details (player icon, name, level), we will add more actions later. Players list should be updated when player leaves the building, when player leaves the building when modal is opened, it shows some message that given player left the location, but when modal is still open and other player comes back then this message should disappear."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Players at Same Location (Priority: P1)

A player sees a panel (in the bottom-right area, replacing the existing combat log) that is always visible on city maps. It lists all other players currently at the same map node — whether that node is a building or an intermediate path node between buildings. The list shows player names and updates in real time as others arrive or depart.

**Why this priority**: This is the core functionality. Without the player list, no other interaction is possible. It replaces the combat log panel and establishes the foundation for all future player-to-player features.

**Independent Test**: Can be tested by having two characters navigate to the same map node (building or path node) and verifying each sees the other in the panel.

**Acceptance Scenarios**:

1. **Given** a player is at a map node with 2 other players present, **When** the panel is visible, **Then** the Nearby Players panel displays both other players' names.
2. **Given** a player is at a map node alone, **When** the panel is visible, **Then** the Nearby Players panel displays an empty-state message (e.g., "No other players here").
3. **Given** a player is at a map node, **When** another player arrives at the same node, **Then** the arriving player appears in the list without any page refresh.
4. **Given** a player is at a map node with others, **When** one of those players leaves (moves to another node or logs out), **Then** that player is removed from the list in real time.
5. **Given** a player is walking between buildings (on an intermediate path node), **When** another player is at the same path node, **Then** both players see each other in the Nearby Players panel.

---

### User Story 2 - View Player Details Modal (Priority: P2)

A player clicks on a name in the Nearby Players panel and a modal opens showing that player's icon, name, and level. The modal is designed to be extensible for future actions (trade, duel, inspect gear, etc.) but initially only displays these basic details.

**Why this priority**: Clicking a player name is the primary interaction point. The modal provides context about who the player is and will serve as the hub for future interaction actions.

**Independent Test**: Can be tested by clicking a player name in the list and verifying the modal displays correct icon, name, and level.

**Acceptance Scenarios**:

1. **Given** a player sees others in the Nearby Players panel, **When** they click a player's name, **Then** a modal opens showing a generic placeholder icon, that player's name, and level.
2. **Given** the player detail modal is open, **When** the player clicks outside the modal or presses Escape or clicks a close button, **Then** the modal closes.
3. **Given** the player detail modal is open for Player B, **When** Player B is still at the same map node, **Then** the modal shows normal player details with no warning.

---

### User Story 3 - Player Leaves While Modal Is Open (Priority: P2)

When viewing a player's detail modal, if that player leaves the current map node, a notice appears in the modal indicating the player has left the location. If the player returns to the same node before the modal is closed, the notice disappears and the normal details are shown again.

**Why this priority**: This handles a key real-time edge case that directly affects user experience. Players need feedback about whether interaction targets are still present.

**Independent Test**: Can be tested by opening a modal for a player, having that player move away, verifying the notice appears, then having them return and verifying the notice disappears.

**Acceptance Scenarios**:

1. **Given** the detail modal is open for Player B, **When** Player B leaves the current map node, **Then** the modal displays a message such as "[Player Name] has left this location" while remaining open.
2. **Given** the detail modal shows a "player left" message for Player B, **When** Player B returns to the same map node, **Then** the "player left" message disappears and normal player details are restored.
3. **Given** the detail modal shows a "player left" message, **When** the user closes the modal, **Then** the modal closes normally and Player B is no longer in the Nearby Players list.

---

### Edge Cases

- What happens when the player themselves moves to a different node while the modal is open? The player list updates to the new node's players; if the modal target is no longer at the same node, the "player left" notice appears.
- What happens when many players (10+) are at the same node? The player list should be scrollable.
- What happens on zone change or logout? All panels reset as they do currently; no special handling needed.
- What happens if two players have the same name? Players are identified by unique ID internally; names may coincidentally match but each list entry corresponds to a distinct character.
- What happens to the combat log information? Combat log functionality is removed from the bottom bar. Combat feedback continues through the existing CombatScreen modal. Essential combat messages can appear in the chat.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Nearby Players" panel in the bottom-right area of the screen, replacing the existing combat log panel. The panel MUST always be visible on city maps.
- **FR-002**: The Nearby Players panel MUST list all other players currently at the same map node as the viewing player — including building nodes and intermediate path nodes.
- **FR-003**: The player list MUST update in real time when players arrive at or depart from the current map node.
- **FR-004**: The panel MUST show an empty-state message when no other players are at the current map node.
- **FR-005**: Each player entry in the list MUST be clickable, opening a player detail modal.
- **FR-006**: The player detail modal MUST display a generic placeholder icon (silhouette or shield), the target player's name, and level.
- **FR-007**: The modal MUST be closable via a close button, clicking outside, or pressing Escape.
- **FR-008**: When the viewed player leaves the current map node while the modal is open, the modal MUST display a "player left" notice.
- **FR-009**: When the viewed player returns to the same map node while the "player left" notice is showing, the notice MUST disappear and normal details MUST be restored.
- **FR-010**: The Nearby Players panel MUST be scrollable when the list of players exceeds the visible area.
- **FR-011**: When the viewing player moves to a different map node, the Nearby Players list MUST refresh to show players at the new node.
- **FR-012**: The modal design MUST be extensible to accommodate future interaction actions (trade, duel, etc.) without requiring structural changes.

### Key Entities

- **Nearby Player**: A summary of another player at the same location — includes unique identifier, display name, character class, and level.
- **Player Detail View**: An expanded view of a nearby player showing their icon, name, and level, with placeholder space for future interaction actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can see other players at the same map node within 1 second of arriving.
- **SC-002**: The player list updates within 1 second of another player arriving at or leaving the node.
- **SC-003**: Player detail modal opens within 500ms of clicking a player name.
- **SC-004**: The "player left" notice appears within 1 second of the viewed player departing the node.
- **SC-005**: The "player left" notice disappears within 1 second of the viewed player returning to the node.
- **SC-006**: The panel correctly handles at least 20 simultaneous players at a single node without visual degradation.

## Clarifications

### Session 2026-04-07

- Q: Should the Nearby Players panel only show at buildings, or always be visible (including intermediate path nodes)? → A: Panel is always visible on city maps and shows players at the same map node, whether it's a building node or an intermediate path node.
- Q: What image should be used for the player icon in the detail modal? → A: Use a generic placeholder icon (silhouette or shield) for all players until dedicated portraits are added later.

## Assumptions

- Player co-location is determined by matching players' current map node IDs — this applies to both building nodes and intermediate path nodes. No new server-side tracking is needed.
- The player icon in the modal is a generic placeholder (silhouette or shield) shared by all players. Dedicated per-class or per-character portraits may be added in a future feature.
- The combat log panel is fully replaced; no combat log entries will appear in the bottom bar going forward. Combat feedback is handled by the existing CombatScreen modal.
- Future interaction actions (trade, duel, inspect, etc.) are out of scope for this feature but the modal should be structured to easily add action buttons later.
- The panel shares the same container slot and visual style as the current combat log (dark theme, gold accents, matching the existing UI token system).
