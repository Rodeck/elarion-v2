# Feature Specification: City Map System

**Feature Branch**: `003-city-map-system`
**Created**: 2026-03-02
**Status**: Draft
**Input**: User description: "Replace tile-based maps with city/region maps using path-based navigation. Scoped to city maps. Admin map editor on port :4000. Walkable paths as connected nodes. Buildings as clickable areas. Player spawns at Elarion city."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates a New City Map (Priority: P1)

An admin opens the map editor at port :4000, creates a new city map by specifying image dimensions (width/height in pixels) and uploading a city background image (PNG). The admin then draws walkable paths by placing nodes on the image and connecting them to form a path graph. The admin saves the map.

**Why this priority**: Without a map editor, no city maps can exist. This is the foundational tool that enables all other features.

**Independent Test**: Can be fully tested by opening the editor, creating a map with an uploaded image, placing and connecting nodes, saving, and verifying the data persists.

**Acceptance Scenarios**:

1. **Given** an admin is on the map editor, **When** they click "New Map" and enter width (e.g. 1920) and height (e.g. 1080), **Then** a blank canvas of that size is created.
2. **Given** a blank canvas, **When** the admin uploads a PNG city image, **Then** the image is displayed as the map background filling the canvas.
3. **Given** a map with a background image, **When** the admin clicks on the canvas, **Then** a path node is placed at the clicked position.
4. **Given** two or more nodes exist, **When** the admin connects two nodes (e.g. by clicking one then the other), **Then** a walkable path edge is created between them and visually displayed.
5. **Given** a map with nodes and paths, **When** the admin clicks "Save", **Then** the map data (image reference, nodes, edges) is persisted and the admin sees a success confirmation.

---

### User Story 2 - Admin Defines Buildings on a Map (Priority: P1)

An admin defines buildings on an existing city map. Buildings can be created in two ways: (a) marking an existing path node as a "building node", or (b) placing a rectangle or circle hotspot on the map. Each building has a name displayed on the map, and the admin can reposition the name label independently of the building.

**Why this priority**: Buildings are the primary interactive elements on city maps -- without them, maps are just paths with no purpose.

**Independent Test**: Can be tested by opening an existing map, adding buildings via both methods, naming them, repositioning labels, and verifying all data saves correctly.

**Acceptance Scenarios**:

1. **Given** a map with path nodes, **When** the admin selects a node and marks it as a "building node", **Then** the node visually changes to indicate it is a building and a name input field appears.
2. **Given** a map, **When** the admin places a rectangle hotspot by drawing on the canvas, **Then** a rectangular building area is created and a name input field appears.
3. **Given** a map, **When** the admin places a circle hotspot by clicking and dragging on the canvas, **Then** a circular building area is created and a name input field appears.
4. **Given** a building with a name label, **When** the admin drags the label to a new position, **Then** the label position updates independently of the building location.
5. **Given** a map with buildings defined, **When** the admin saves the map, **Then** all building data (type, position, shape, name, label position) is persisted.

---

### User Story 3 - Admin Edits an Existing Map (Priority: P2)

An admin opens the map editor and selects an existing city map to edit. They can modify paths, add/remove nodes, add/remove/modify buildings, change the background image, and re-save.

**Why this priority**: Maps need iterating. Without editing, admins would need to recreate maps from scratch for any change.

**Independent Test**: Can be tested by loading a previously saved map, making changes to paths and buildings, saving, and verifying the updated data persists.

**Acceptance Scenarios**:

1. **Given** the map editor list page, **When** the admin selects an existing map, **Then** the map loads with all previously saved nodes, edges, buildings, and background image.
2. **Given** a loaded map, **When** the admin deletes a node, **Then** the node and all connected edges are removed.
3. **Given** a loaded map, **When** the admin modifies a building name or repositions a label, **Then** the changes are reflected in the editor and persist on save.
4. **Given** a loaded map, **When** the admin uploads a new background image, **Then** the old image is replaced and existing nodes/buildings remain in place.

---

### User Story 4 - Player Navigates a City Map (Priority: P1)

A player logs in or travels to a city and sees the city map with the background image, building names, and their character. The player clicks on a walkable location (a node or a point along a path edge), and the character moves along the path graph to reach the destination. Movement is animated along the path, not teleported.

**Why this priority**: This is the core player experience -- navigating the city map. Without this, the map is just a static image.

**Independent Test**: Can be tested by logging in as a player, seeing the city map render, clicking various path locations, and verifying the character animates along the path to the destination.

**Acceptance Scenarios**:

1. **Given** a player logs in, **When** their character is in Elarion city, **Then** the city map loads showing the background image, building names at admin-configured positions, and the player's character at the spawn node.
2. **Given** a player on a city map, **When** they click on a reachable path node or a point along a path edge, **Then** the character pathfinds to the target node and animates movement along the connecting edges.
3. **Given** a player on a city map, **When** they click on an area that is not on any path or building, **Then** nothing happens (the click is ignored).
4. **Given** a player is moving along a path, **When** movement is in progress, **Then** the character smoothly animates between nodes at a consistent speed.

---

### User Story 5 - Player Interacts with Buildings (Priority: P2)

A player clicks on a building (either a building node, or a rectangle/circle building hotspot). The character automatically pathfinds and moves to the building's associated path node. Once arrived, a building interaction panel opens (the panel content is to be implemented in a future feature, but the navigation and arrival event must work).

**Why this priority**: Buildings are the interaction points in cities. Moving to them is essential, even if the building actions themselves are deferred.

**Independent Test**: Can be tested by clicking a building on the map, watching the character move to it, and verifying an arrival event fires (e.g. a placeholder panel appears).

**Acceptance Scenarios**:

1. **Given** a player on a city map, **When** they click on a building node, **Then** the character pathfinds and moves to that node.
2. **Given** a player on a city map, **When** they click within a rectangle or circle building hotspot, **Then** the character pathfinds and moves to the building's associated path node.
3. **Given** a player's character arrives at a building node, **Then** a building arrival event fires (displaying at minimum the building name and a placeholder interaction panel).
4. **Given** a building with a displayed name label, **When** the player views the map, **Then** the building name is visible at the admin-configured label position.

---

### User Story 6 - Player Spawns at Elarion City (Priority: P1)

When a player logs in or creates a new character, they spawn at the Elarion city map at the designated spawn node.

**Why this priority**: This defines the default starting point and ensures the new map system is the first thing players experience.

**Independent Test**: Can be tested by logging in with a new character and verifying they appear on the Elarion city map at the spawn node.

**Acceptance Scenarios**:

1. **Given** a new character is created, **When** they enter the game, **Then** they are placed on the Elarion city map at the designated spawn node.
2. **Given** a player logs in with an existing character whose last location was Elarion city, **When** the game loads, **Then** they appear at their last known position on the Elarion city map.

---

### Edge Cases

- What happens when an admin deletes a node that is the spawn point? The system prevents deletion of the spawn node or prompts the admin to reassign the spawn first.
- What happens when a player clicks a building that has no associated path node? The system requires every building to have an associated path node (enforced during map editing).
- What happens when the path graph is disconnected (two separate clusters of nodes)? The editor warns the admin about disconnected path segments when saving.
- What happens when a player is on a node that gets removed from a map update? The player is moved to the spawn node on next map load.
- What happens when the uploaded PNG is very large? The system enforces a maximum file size of 10 MB and validates that the file is a valid PNG.
- What happens if a player clicks a destination while already moving? The current movement is cancelled and a new path is calculated from the character's current nearest node.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support city maps defined as a background image with a walkable path graph of connected nodes.
- **FR-002**: System MUST provide a map editor accessible on port :4000 for admin users.
- **FR-003**: Map editor MUST allow creating a new map by specifying image dimensions (width and height in pixels).
- **FR-004**: Map editor MUST allow uploading a PNG image as the city map background.
- **FR-005**: Map editor MUST allow placing path nodes on the map by clicking the canvas.
- **FR-006**: Map editor MUST allow connecting nodes to create walkable path edges.
- **FR-007**: Map editor MUST allow marking a node as a "building node".
- **FR-008**: Map editor MUST allow placing rectangle and circle building hotspots on the map.
- **FR-009**: Each building MUST have an editable name that is displayed on the map.
- **FR-010**: Building name labels MUST have independently adjustable positions set by the admin.
- **FR-011**: Map editor MUST allow loading and editing previously saved maps.
- **FR-012**: Map editor MUST validate that the path graph is connected before saving (warn on disconnected segments).
- **FR-013**: Map editor MUST prevent deletion of the designated spawn node without reassignment.
- **FR-014**: System MUST persist map data (background image, nodes, edges, buildings, labels) to the database.
- **FR-015**: Game client MUST render city maps with the background image, building names at configured positions, and the player character.
- **FR-016**: Players MUST be able to click on path nodes or path edges to move their character, with movement animated along the path.
- **FR-017**: Players MUST be able to click on buildings (node or hotspot) to automatically pathfind and move to the building's associated node.
- **FR-018**: System MUST fire a building arrival event when a player character reaches a building node.
- **FR-019**: New characters MUST spawn at the Elarion city map on the designated spawn node.
- **FR-020**: System MUST enforce a maximum upload size of 10 MB for map background images and validate PNG format.
- **FR-021**: Pathfinding MUST use shortest-path calculation over the node graph.
- **FR-022**: Each map MUST have exactly one designated spawn node.
- **FR-023**: If a player clicks a new destination while moving, the system MUST cancel the current movement and pathfind from the nearest node.
- **FR-024**: Each building hotspot (rectangle/circle) MUST be associated with a path node for player navigation.

### Key Entities

- **CityMap**: A map definition containing a name, background image reference, image dimensions (width/height), and a designated spawn node.
- **PathNode**: A point on a city map with x/y coordinates. Can be a regular node or a building node. Has a unique ID within the map.
- **PathEdge**: A connection between two path nodes representing a walkable segment.
- **Building**: An interactive location on the map. Has a name, an associated path node, a label position (x/y offset), and optionally a hotspot shape (rectangle with x/y/width/height, or circle with x/y/radius).
- **MapBackgroundImage**: The uploaded PNG file stored and served to clients.

## Assumptions

- The map editor on port :4000 is a standalone web application (separate from the game client on the main port).
- Admin authentication for the map editor uses the existing account system with an admin role check.
- Path edges are unweighted (all edges have equal traversal cost; distance-based weighting can be added later).
- The path network is not visible to players -- only the background image, building names, and character are shown.
- Building actions (what happens when you enter a building) are out of scope -- only navigation to the building and a placeholder arrival event are in scope.
- Only one player sprite is shown per client (other players on the same map are out of scope for this feature).
- The existing tile-based map system will be replaced for city-type maps; world maps are out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can create and save a city map with at least 20 path nodes and 5 buildings in under 10 minutes using the map editor.
- **SC-002**: Players see the city map fully rendered (background image, building names, character) within 3 seconds of entering the map.
- **SC-003**: Player character movement from click to arrival at a destination up to 10 nodes away completes within 5 seconds with smooth animation.
- **SC-004**: 100% of building clicks result in the character successfully navigating to the associated building node.
- **SC-005**: All new characters spawn correctly at the Elarion city spawn point on first login.
- **SC-006**: Map editor prevents saving maps with disconnected path segments or missing spawn nodes, achieving zero invalid map states in the database.
- **SC-007**: Map background images up to 10 MB upload and display without errors.
