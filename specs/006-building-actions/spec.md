# Feature Specification: Building Actions & Map Travel

**Feature Branch**: `006-building-actions`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "There is feature to add buildings to the map, now let's implement it. Each building should have except of title, description and available actions. For startes, let's add possibility to add Travel to XXX action. When this action is added to the building, there is dropdown that allows to select to which map player can travel from given building, and then to which node. Node and building should be select box, with all options from maps/map data. For game ui side, when player enters the building, there should appear panel to the right of the map, with building actions, and e.g if travel to XXX action is vailable, then player can click travel and is moved to given map. Add some kind of fade/blur animation that represents moveing to separate map."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player Travels Between Maps via Building (Priority: P1)

A player navigating the game world enters a building that has a "Travel to [Destination]" action configured. A panel appears to the right of the map showing the building's name, description, and a "Travel to [Destination]" button. The player clicks the button, a fade/blur transition animation plays, and the player arrives at the specified destination node on the destination map.

**Why this priority**: This is the core gameplay value of the feature — enabling inter-map travel through buildings is the primary end-user experience and the reason the feature exists.

**Independent Test**: Can be fully tested by entering a pre-configured building with a travel action and clicking the travel button, delivering the full navigation experience.

**Acceptance Scenarios**:

1. **Given** a player character is standing near a building with a "Travel to Harbor" action, **When** the player enters the building, **Then** a building panel appears to the right of the map displaying the building title, description, and a "Travel to Harbor" button.
2. **Given** the building panel is open with a travel action, **When** the player clicks the travel button, **Then** a fade/blur animation starts, the current map fades out, and the player arrives at the destination node on the destination map.
3. **Given** the player is viewing the building panel, **When** the player moves away from the building, **Then** the building panel closes automatically.
4. **Given** the player is mid-transition (animation playing), **When** the animation completes, **Then** the destination map is fully loaded with the player positioned at the configured destination node.

---

### User Story 2 - Admin Configures Building with Travel Action (Priority: P2)

A map editor user opens a building in the admin map editor and assigns it a title, description, and a "Travel to Location" action. When configuring the travel action, two dropdowns appear — one for selecting the destination map (populated with all available maps) and one for selecting the destination node on that map (populated from the selected map's nodes). The configuration is saved and immediately reflected in the game.

**Why this priority**: Without admin configuration, buildings cannot be given travel actions — this is the prerequisite for the P1 story, but it is evaluated separately as an editor workflow.

**Independent Test**: Can be fully tested by creating/editing a building in the map editor, adding a travel action with a destination, saving, and verifying the data persists on reload.

**Acceptance Scenarios**:

1. **Given** a building is selected in the map editor, **When** the admin opens building properties, **Then** fields for title, description, and an "Add Action" control are visible.
2. **Given** the admin clicks "Add Action" and selects "Travel to Location" type, **When** the action type is selected, **Then** a destination map dropdown appears populated with all maps that exist in the system.
3. **Given** the admin selects a destination map, **When** the map is chosen, **Then** a destination node dropdown appears populated with all nodes from that selected map.
4. **Given** both map and node are selected, **When** the admin saves the building, **Then** the travel action configuration is persisted and reloads correctly on next open.

---

### User Story 3 - Building Panel Shows Info and All Actions (Priority: P3)

When a player enters any building (even one with no actions, or with multiple actions), the panel on the right of the map displays the building's title, description, and all configured action buttons. If no actions are configured, the panel still shows the title and description with a "Nothing to do here" indication.

**Why this priority**: Foundational UI presentation — necessary for extensibility as more action types are added in the future, and ensures a graceful experience for buildings without travel actions.

**Independent Test**: Can be tested by entering buildings with zero, one, or multiple actions and verifying the panel contents in each case.

**Acceptance Scenarios**:

1. **Given** a building with a title, description, and no actions, **When** the player enters it, **Then** the panel shows the title, description, and a message indicating there are no available actions.
2. **Given** a building with multiple configured actions (e.g., travel to two different destinations), **When** the player enters, **Then** all action buttons appear in the panel.
3. **Given** a building panel is open, **When** it is visible, **Then** it does not overlap the map area and appears to the right of the map.

---

### Edge Cases

- What happens when a building's destination map or node is deleted after the travel action was configured? The system should handle missing destinations gracefully (disable the travel button or show an error).
- What happens if the player tries to interact with the building panel during a travel transition? All action buttons should be disabled once the transition begins to prevent double-triggering.
- What happens if a building has no title or description set? The panel should display placeholder or empty states without breaking.
- What if a map has no nodes? The destination node dropdown should be empty or disabled with an informative message.
- What if the player character is in combat or another blocking state when entering a building? Travel actions should only be available when the player is in a free/idle state.

## Requirements *(mandatory)*

### Functional Requirements

**Admin / Map Editor:**

- **FR-001**: The map editor MUST allow administrators to set a title and description for each building.
- **FR-002**: The map editor MUST allow administrators to add one or more actions to a building from a list of available action types.
- **FR-003**: The map editor MUST provide a "Travel to Location" action type as the initial available action.
- **FR-004**: When the "Travel to Location" action type is selected, the editor MUST display a destination map selector populated with all maps currently in the system.
- **FR-005**: When a destination map is selected, the editor MUST display a destination node selector populated with all nodes belonging to that map.
- **FR-006**: Both the destination map and destination node selectors MUST reflect the current state of map data (no stale/cached options).
- **FR-007**: The building's title, description, and all configured actions MUST be persisted and reloaded correctly when the editor is reopened.
- **FR-008**: The editor MUST allow administrators to remove or modify existing actions on a building.

**Game Client:**

- **FR-009**: When a player character enters a building area, a building information panel MUST automatically appear to the right of the map.
- **FR-010**: The building panel MUST display the building's title and description.
- **FR-011**: The building panel MUST display all configured actions as clearly labeled, interactive buttons.
- **FR-012**: When a player clicks a "Travel to Location" button, a visual transition animation (fade and/or blur) MUST play before the map changes.
- **FR-013**: After the transition animation completes, the player MUST be placed at the configured destination node on the destination map.
- **FR-014**: The building panel MUST close automatically when the player moves out of the building area.
- **FR-015**: If a travel action's destination is unavailable (deleted map/node), the travel button MUST be visually disabled with an indication that travel is unavailable.
- **FR-016**: All action buttons in the building panel MUST be disabled once a travel transition begins, preventing repeated activation.
- **FR-017**: If a building has no actions, the panel MUST still open and show the title and description with an indication that no actions are available.

### Key Entities

- **Building**: A named location placed on a map that a player can enter. Has a title, description, and an ordered list of actions. Associated with a specific map node that defines its position.
- **BuildingAction**: An abstract action that can be configured on a building. Has an action type identifier and type-specific configuration data.
- **TravelAction** (a type of BuildingAction): Specifies travel to a destination. Configuration includes a target map reference and a target node reference within that map.
- **BuildingPanel**: The UI element that appears when a player is inside a building. Displays building information and renders each action as an interactive button.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can add a building with a complete "Travel to Location" action configuration in under 2 minutes.
- **SC-002**: The building panel appears for players within 1 second of entering a building area, with no perceptible delay.
- **SC-003**: The map travel transition (animation start to destination map fully displayed) completes within 3 seconds under normal conditions.
- **SC-004**: Destination map and node dropdowns in the editor always show all currently existing maps and nodes, with no stale data shown to the admin.
- **SC-005**: Players successfully travel between maps using building travel actions 100% of the time when the destination is valid and reachable.
- **SC-006**: The building panel never overlaps the map area, remaining clearly separated in the UI layout at all screen sizes.

## Assumptions

- Buildings already exist as placeable objects on maps (from the 003-city-map-system feature); this feature extends them with content and actions.
- The map editor (admin tool) already has access to all map data and can query maps and their nodes.
- A player "entering" a building is defined by the player's character node/position matching or being adjacent to the building's node on the map.
- Multiple action types may be added in the future; this feature implements only "Travel to Location" as the first type.
- The fade/blur transition plays on the game canvas; it does not need to affect the building panel or other UI chrome outside the map area.
- Players can only trigger one travel action at a time; concurrent travel is not a supported scenario.
- The building panel layout (to the right of the map) is consistent with how other panels/sidebars are presented in the game UI.
