# Feature Specification: Item and Inventory System

**Feature Branch**: `007-item-inventory`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "Let's introduce item and inventory system. The system should be flexible to be able to work across frontend, backend and admin seamlessly. Admin can add new item in admin UI. Item can be of type resource, food, heal, weapon, boots, shield, greaves, bracer, tool. Weapons can be one handed, two handed, dagger, wand (one handed magic weapon), staff (2handed magic weapon), bow. Admin can create new item, and depending on item type can specify attack or defence, heal power, food power. Admin can upload icon of the item. Then, in game, introduce player inventory. Player can receive various items, each item is instance of specific item type. Player can delete item from inventory. Player inventory is separate panel that is placed left of the map and displays player items in grid view (icons). When item is clicked, panel at the bottom of inventory is shown with item details. Above inventory grid player can filter items based on item type. Each player has limited inventory space, let's start with 20 (can be expanded later), and resources, heals and food are stackable (admin can define stack size)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates Item Definition (Priority: P1)

A game administrator opens the admin UI and creates a new item type. They select the item category (e.g., weapon), choose the weapon subtype (e.g., one-handed), enter the item name and description, set relevant stats (attack value), define stack size if applicable, upload an icon image, and save. The new item definition is immediately available system-wide.

**Why this priority**: This is the foundation for the entire feature — no in-game inventory content can exist without item definitions. Everything else builds on this.

**Independent Test**: Can be fully tested by logging into the admin UI, creating at least one item of each category, and confirming each appears in the item list with correct attributes and icon.

**Acceptance Scenarios**:

1. **Given** I am logged into the admin UI, **When** I create a new item of type "Weapon" with subtype "One-Handed", name "Iron Sword", attack value 15, and upload an icon PNG, **Then** the item is saved and appears in the item list with all correct fields and the uploaded icon.
2. **Given** I create a consumable item of type "Heal", **When** I set heal power to 50 and stack size to 10, **Then** the item is saved with stackable flag enabled and the correct stack size.
3. **Given** I create an item with no icon uploaded, **When** I save, **Then** a placeholder icon is used and the item is still saved successfully.
4. **Given** I am creating an equipment item (boots, shield, greaves, bracer), **When** I set a defence value, **Then** the defence stat is saved and attack is not required.

---

### User Story 2 - Player Views and Manages Inventory (Priority: P1)

A player in the game sees a dedicated inventory panel to the left of the map. The panel shows a grid of item icons representing all items in their possession. The player can click an item to see its details, filter items by type using controls above the grid, and delete unwanted items.

**Why this priority**: Core gameplay feature — without it, received items are invisible and unmanageable.

**Independent Test**: Can be tested independently by granting a player test items through the backend and verifying the inventory panel displays, filters, details, and deletion all work correctly.

**Acceptance Scenarios**:

1. **Given** a player has 5 items in their inventory, **When** they open the game, **Then** the inventory panel on the left shows a grid with 5 item icons.
2. **Given** the inventory panel is visible, **When** the player clicks an item icon, **Then** a detail panel appears at the bottom of the inventory showing item name, type, stats (attack/defence/heal power/food power as applicable), and a delete button.
3. **Given** the player has a mix of weapons and resources, **When** they select "Weapon" from the filter above the grid, **Then** only weapon icons are shown in the grid.
4. **Given** a player views item details, **When** they click "Delete", **Then** the item is removed from their inventory and the grid updates immediately.
5. **Given** a player selects "All" in the filter, **When** they view the grid, **Then** all their items are shown.

---

### User Story 3 - Inventory Capacity and Stacking (Priority: P2)

The player's inventory has a maximum of 20 slots. Stackable items (resources, heals, food) share a slot and display a quantity badge on the icon. When a stackable item is received and already exists in inventory, the quantity increases rather than occupying a new slot (up to the admin-defined stack size). When the inventory is full and the player tries to receive a non-stackable item (or a stackable item that has reached its stack cap), they receive a notification that their inventory is full.

**Why this priority**: Necessary for gameplay balance and to prevent trivial item accumulation, but can be delivered after basic inventory display is working.

**Independent Test**: Can be tested by filling a player's inventory to 20 slots and attempting to add more items; and by adding stackable items beyond 1 unit to verify stacking behavior.

**Acceptance Scenarios**:

1. **Given** a player has 20 items in their inventory (all slots occupied), **When** they try to receive a new non-stackable item, **Then** the item is not added and the player sees a "Inventory full" notification.
2. **Given** a player has 5 healing potions (stackable, stack size 10) in one slot, **When** they receive 3 more healing potions, **Then** the slot now shows quantity 8 and no new slot is used.
3. **Given** a stackable item slot is at its maximum stack size, **When** the player receives one more of the same item, **Then** a new slot is used if available, or "Inventory full" is shown if not.
4. **Given** a player has a resource with quantity > 1, **When** they view the item icon in the grid, **Then** a quantity badge is visible on the icon.

---

### User Story 4 - Admin Edits and Manages Item Definitions (Priority: P3)

An administrator can browse the list of all existing item definitions, search or filter by type, edit an existing item's attributes (including replacing the icon), and delete item definitions that are no longer needed.

**Why this priority**: Important for ongoing content management but not required to launch the feature.

**Independent Test**: Can be tested by creating items, editing them, and verifying changes are reflected; and by deleting items and confirming they no longer appear.

**Acceptance Scenarios**:

1. **Given** an item definition exists, **When** the admin edits the item's attack value and saves, **Then** the updated value is persisted and reflected in the item list.
2. **Given** an admin uploads a new icon for an existing item, **When** they save, **Then** the new icon replaces the old one across the entire system.
3. **Given** an admin filters item definitions by type "Food", **When** the list renders, **Then** only food items are shown.

---

### Edge Cases

- What happens when a player receives a stackable item but their only available slot for it is full (stack cap reached) and inventory is also full?
- What happens if an admin deletes an item definition that players currently have in their inventory?
- What if a player's inventory contains an item whose definition was updated (e.g., attack value changed)?
- What happens when a player filters by a type they have no items of — the grid shows empty (not an error).
- What if an uploaded icon file is corrupted or an unsupported format — admin sees a clear error and the item is not saved.
- How is item deletion handled for stackable items — removes entire stack (not one unit at a time); this assumption is documented and can be changed.

## Requirements *(mandatory)*

### Functional Requirements

**Admin — Item Definition Management**

- **FR-001**: Administrators MUST be able to create new item definitions with a name, description, category (resource, food, heal, weapon, boots, shield, greaves, bracer, tool), and an icon image.
- **FR-002**: When creating a weapon item, administrators MUST be able to specify the weapon subtype: one-handed, two-handed, dagger, wand (one-handed magic), staff (two-handed magic), or bow.
- **FR-003**: Administrators MUST be able to specify an attack value for weapon item definitions.
- **FR-004**: Administrators MUST be able to specify a defence value for equipment item definitions (boots, shield, greaves, bracer).
- **FR-005**: Administrators MUST be able to specify a heal power value for heal item definitions.
- **FR-006**: Administrators MUST be able to specify a food power value for food item definitions.
- **FR-007**: Administrators MUST be able to define a maximum stack size for stackable item categories (resource, heal, food).
- **FR-008**: Administrators MUST be able to upload a PNG or JPEG icon image for each item definition; a placeholder is used when no icon is provided.
- **FR-009**: Administrators MUST be able to view a list of all item definitions, filterable by category.
- **FR-010**: Administrators MUST be able to edit existing item definitions including replacing the icon.
- **FR-011**: Administrators MUST be able to delete item definitions.

**Player Inventory — Display**

- **FR-012**: Each player MUST have a personal inventory with a maximum capacity of 20 slots (expandable via configuration, not gameplay, in the future).
- **FR-013**: The game MUST display the player's inventory as a panel positioned to the left of the map, showing items as a grid of icons.
- **FR-014**: Stackable items (resource, heal, food) MUST display a quantity badge on their icon showing the current stack count.
- **FR-015**: The inventory panel MUST display filter controls above the grid, allowing the player to filter displayed items by category (or view all).
- **FR-016**: When a player clicks an item icon, the system MUST display a detail panel at the bottom of the inventory showing: item name, category, weapon subtype (for weapons), relevant stats (attack, defence, heal power, food power where applicable), and a delete control.

**Player Inventory — Behaviour**

- **FR-017**: Players MUST be able to delete an item (entire stack) from their inventory via the detail panel.
- **FR-018**: When a player receives a stackable item that already exists in their inventory and is below the stack size limit, the system MUST increment the existing slot's quantity rather than creating a new slot.
- **FR-019**: When a player's inventory is at maximum capacity and a new item cannot be accommodated, the system MUST notify the player that their inventory is full; the item MUST NOT be silently lost.
- **FR-020**: Item instances in a player's inventory MUST reference the item definition they are based on, inheriting its name, icon, and stats.

### Key Entities

- **Item Definition**: A template created by admins. Attributes: name, description, category (enum), weapon subtype (enum, weapon only), attack value (weapon only), defence value (equipment only), heal power (heal only), food power (food only), icon image, stackable flag (auto-set by category), stack size limit (stackable categories only).
- **Item Instance**: A specific item in a player's inventory. References its Item Definition. For stackable items, tracks current quantity. For non-stackable items, quantity is always 1.
- **Player Inventory**: A collection belonging to one player. Holds up to 20 Item Instance slots. Enforces stacking and capacity rules.
- **Item Category**: Enumeration — resource, food, heal, weapon, boots, shield, greaves, bracer, tool.
- **Weapon Subtype**: Enumeration (weapon category only) — one-handed, two-handed, dagger, wand, staff, bow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can create a complete item definition (all fields including icon upload) in under 2 minutes.
- **SC-002**: A player's inventory panel loads and renders all items within 1 second of entering the game map scene.
- **SC-003**: Item filtering in the inventory panel responds visually within 200 milliseconds of the player selecting a filter.
- **SC-004**: All 9 item categories and all 6 weapon subtypes defined in requirements are correctly supported and displayable in both admin and in-game inventory.
- **SC-005**: Stackable items correctly merge into a single slot with accurate quantity tracking across all scenarios: receive below cap, receive at cap, delete full stack.
- **SC-006**: Inventory capacity of 20 slots is enforced in all cases — no items are silently lost when the inventory is full.
- **SC-007**: Item deletion removes the item from the player's inventory and the grid reflects the change immediately without requiring a page reload.

## Assumptions

- Deletion from inventory removes the entire stack for stackable items (not one-at-a-time). This can be revised in a future iteration.
- Item definitions deleted by an admin will be displayed gracefully in the frontend (e.g., "Unknown Item" placeholder) — cascading deletion of player inventory instances is out of scope.
- Players receive items through existing game mechanisms (e.g., building actions); this feature does not introduce new item-granting mechanics.
- The inventory panel is always visible when the player is on the city/world map scene; it is not a toggle or separate screen.
- Icon images are stored and served as static files; no image processing, resizing, or thumbnail generation is required.
- Future expansion of inventory slot capacity beyond 20 is a configuration change, not a gameplay action — the data model must support it but no in-game expansion mechanic is in scope.
- Tool and resource items have no combat or consumable stats; they are descriptive only at this stage.
- Admin stat fields not applicable to a given item category are hidden or disabled in the UI (e.g., attack field is hidden for food items).
