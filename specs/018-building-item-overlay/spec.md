# Feature Specification: Building Item Overlay

**Feature Branch**: `018-building-item-overlay`
**Created**: 2026-03-18
**Status**: Draft
**Input**: User description: "In map editing page, i want to be able to see what items can be bought/crafted/found/looted from monsters in given building. I want to have overlay that can be enabled or disabled (toggle in bar on top of the map). when enabled, it shows next to each building items obtainable in given building. Each 'obtain' way has different indicator, eg. each item display icon, and green are foundable, blue are craftable etc. items to be bought are not yet implemented."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle Item Overlay On/Off (Priority: P1)

As a map editor, I want to toggle an overlay on the map canvas that shows which items are obtainable at each building, so I can visually verify that buildings have appropriate item distributions without leaving the editor.

**Why this priority**: The toggle is the core interaction — without it, no overlay can be displayed. This is the foundation all other stories depend on.

**Independent Test**: Can be fully tested by opening any map in the editor, clicking the overlay toggle in the toolbar, and verifying that item icons appear next to buildings that have associated actions/NPCs. Clicking again hides them.

**Acceptance Scenarios**:

1. **Given** the editor is open on a map with buildings, **When** I click the "Item Overlay" toggle in the toolbar, **Then** item icons appear next to each building that has obtainable items.
2. **Given** the overlay is currently visible, **When** I click the toggle again, **Then** all item overlay icons are hidden and the map returns to its normal view.
3. **Given** the overlay is enabled, **When** I pan or zoom the map, **Then** the item icons move and scale correctly with the canvas.

---

### User Story 2 - Color-Coded Obtain Methods (Priority: P1)

As a map editor, I want each item icon in the overlay to be color-coded by how it is obtained (loot from monsters = one color, craftable = another color), so I can quickly distinguish acquisition methods at a glance.

**Why this priority**: Color distinction is the primary value proposition — without it the overlay is just a pile of identical icons with no useful information about obtain method.

**Independent Test**: Can be tested by enabling the overlay on a map that has buildings with both explore actions (monster loot) and crafter NPCs, and verifying that loot items and crafted items display with distinct color indicators.

**Acceptance Scenarios**:

1. **Given** the overlay is enabled and a building has an explore action with monsters that drop items, **When** I look at that building's overlay, **Then** the looted items display with a **red/orange** border or tint indicating "monster loot."
2. **Given** the overlay is enabled and a building has a crafter NPC with recipes, **When** I look at that building's overlay, **Then** the craftable output items display with a **blue** border or tint indicating "craftable."
3. **Given** the overlay is enabled and a building has both explore actions and crafter NPCs, **When** I look at that building's overlay, **Then** both loot items (red/orange) and crafted items (blue) appear, clearly distinguishable.

---

### User Story 3 - Item Identification on Hover (Priority: P2)

As a map editor, I want to hover over an item icon in the overlay to see the item's name and obtain details, so I can identify items without memorizing every icon.

**Why this priority**: Tooltips add significant usability but the overlay is still functional without them — color-coded icons alone provide useful information.

**Independent Test**: Can be tested by enabling the overlay, hovering over any item icon, and verifying a tooltip appears with the item name and source information.

**Acceptance Scenarios**:

1. **Given** the overlay is enabled, **When** I hover over a loot item icon, **Then** a tooltip appears showing the item name and the monster(s) that drop it.
2. **Given** the overlay is enabled, **When** I hover over a craftable item icon, **Then** a tooltip appears showing the item name and the NPC that crafts it.
3. **Given** I move the mouse away from an item icon, **When** the cursor leaves the icon area, **Then** the tooltip disappears.

---

### Edge Cases

- What happens when a building has no actions and no NPCs? The overlay shows nothing next to that building (no empty placeholder).
- What happens when a building has an explore action but the monster has no loot entries? No items appear for that building from the explore source.
- What happens when the same item is both lootable and craftable at the same building? The item appears twice with different color indicators, once for each obtain method.
- What happens when a building has many obtainable items (e.g., 15+)? Items wrap into multiple rows or show a compact grid layout to avoid overlapping other buildings.
- What happens when two buildings are close together and their overlays would overlap? Overlays render independently per building; some visual overlap is acceptable in the editor context.
- What happens when a crafter NPC has no recipes? No crafted items appear for that NPC.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a toggle button in the map editor toolbar to enable/disable the item overlay.
- **FR-002**: When the overlay is enabled, the system MUST display item icons adjacent to each building on the canvas.
- **FR-003**: The system MUST resolve obtainable items by traversing: building → building_actions (explore type) → action config monsters → monster_loot → item_definitions.
- **FR-004**: The system MUST resolve craftable items by traversing: building → building_npcs → npcs (is_crafter=true) → crafting_recipes → output item from item_definitions.
- **FR-005**: Each item icon MUST be visually distinguished by obtain method using color coding:
  - **Red/Orange** border or tint: items looted from monsters (via explore actions)
  - **Blue** border or tint: items craftable by NPCs
  - **Green** border or tint: reserved for future "found" obtain method (not yet implemented)
  - **Purple** border or tint: reserved for future "bought" obtain method (not yet implemented)
- **FR-006**: Item icons MUST use the same icon images from item_definitions (icon_filename) as used elsewhere in the admin.
- **FR-007**: The overlay MUST transform correctly with canvas pan and zoom operations.
- **FR-008**: When the overlay is disabled, all overlay visuals MUST be completely removed from the canvas.
- **FR-009**: The system SHOULD display a tooltip on hover over an item icon showing the item name and source details.
- **FR-010**: The overlay state (enabled/disabled) does NOT need to persist across page navigation — it defaults to disabled on page load.
- **FR-011**: The system MUST fetch overlay data from the backend via a dedicated endpoint that returns all obtainable items per building for the given map/zone.

### Key Entities

- **Building**: A named location on the map tied to a path node. Has actions and NPCs.
- **Building Action (explore)**: An action attached to a building with config containing monster IDs and weights. Source of lootable items.
- **Monster Loot**: Links a monster to item definitions with drop chance and quantity. Determines what items can be obtained from combat.
- **NPC (crafter)**: An NPC attached to a building with is_crafter=true. Has crafting recipes.
- **Crafting Recipe**: Links a crafter NPC to an output item definition. Determines what items can be crafted.
- **Item Definition**: The canonical item record with name, icon, and stats.
- **Overlay Item**: A derived/computed concept — an item obtainable at a building, with an obtain method (loot, craft, found, bought) and reference to the item definition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Map editors can enable the overlay and see all obtainable items for every building on the map within 2 seconds of toggling.
- **SC-002**: Map editors can distinguish between loot and crafted items at a glance without hovering, via color coding.
- **SC-003**: The overlay accurately reflects the current database state — every item linked to a building through explore actions or crafter NPCs appears in the overlay.
- **SC-004**: Toggling the overlay on/off does not cause canvas flickering, lag, or disrupt other editor operations (node placement, edge creation, building editing).
- **SC-005**: Item icons in the overlay are legible at the default zoom level (recognizable as distinct items, not blurred or overlapping within a single building's cluster).

## Assumptions

- The "found" obtain method (green) is not yet implemented in the game — the overlay will reserve the green color indicator but no items will use it currently.
- The "bought" obtain method (purple) is not yet implemented — same as above, reserved color but no current items.
- The overlay is an admin/editor-only tool. It does not appear in the game client.
- Item icon images are already available via the admin backend's static file serving (e.g., `/item-icons/{filename}`).
- The overlay data can be computed server-side by joining existing tables — no new persistent data storage is needed.
- The overlay is specific to the map currently being edited (scoped to the map's zone).

## Scope Boundaries

### In Scope
- Toggle button in editor toolbar
- Canvas overlay rendering of item icons with color-coded obtain methods
- Backend endpoint to compute obtainable items per building
- Tooltip on hover for item identification
- Loot items (from monster_loot via explore actions)
- Craftable items (from crafting_recipes via crafter NPCs)

### Out of Scope
- "Buy" obtain method (not yet implemented in game)
- "Find" obtain method (not yet implemented in game)
- Filtering overlay by obtain method (e.g., show only loot items)
- Editing items or loot tables from the overlay
- Overlay persistence across page loads
- Overlay in the game client (this is admin-only)
