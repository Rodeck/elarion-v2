# Feature Specification: Item Disassembly System

**Feature Branch**: `025-item-disassembly`
**Created**: 2026-03-27
**Status**: Draft
**Input**: User description: "Add item disassembly feature — dedicated NPCs with an admin-controlled flag offer a dialog option to open a disassembly window. 15-slot window with drag-and-drop from inventory. Shows expected output items (range/type) and gold cost. Requires a kiln tool with durability. Admin can configure disassembly outputs per item with percentage chances that must sum to 100%. Modify item add/edit UI to use a modal instead of embedded form."

## Clarifications

### Session 2026-03-27

- Q: How do stackable items behave in the disassembly grid? → A: Entire stack goes into one slot. Kiln durability is reduced by the stack quantity (e.g., a stack of 5 in one slot costs 5 kiln durability).
- Q: When a player has multiple kilns, which one is used? → A: Player manually selects which kiln to use via a dedicated kiln slot in the disassembly window.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Disassemble Items at NPC (Priority: P1)

A player visits a disassembler NPC in a building, clicks a dialog option to open the disassembly window, drags items from their inventory into the 15-slot disassembly grid, reviews the expected output summary (item types, quantity ranges, and gold cost), and confirms. The items are destroyed and replacement materials are added to the player's inventory based on configured chance tables. The kiln tool's durability is reduced by the number of items disassembled.

**Why this priority**: Core gameplay loop — without this, the feature has no value.

**Independent Test**: Can be fully tested by placing disassemble-eligible items into the window and clicking confirm. Delivers the primary disassembly experience end-to-end.

**Acceptance Scenarios**:

1. **Given** a player is at a building with a disassembler NPC, **When** they interact with the NPC, **Then** a "Disassemble" dialog option appears alongside any existing NPC options.
2. **Given** the disassembly window is open, **When** the player drags an item (or item stack) with disassembly recipes configured from their inventory into an empty slot, **Then** the entire stack occupies one grid slot and is removed from the inventory panel.
3. **Given** one or more items are in the disassembly grid, **When** the player views the output summary, **Then** the window displays the possible output items with their quantity ranges (min–max across all chance entries) and the total gold cost.
4. **Given** items are in the grid and the player has enough gold, a kiln with sufficient durability, and enough free inventory slots for the maximum possible output, **When** the player clicks "Disassemble", **Then** the input items are destroyed, output items are added to inventory according to the configured chance rolls, gold is deducted, and kiln durability is reduced by the number of items disassembled.
5. **Given** items are in the grid, **When** the player drags an item back out of the grid to their inventory, **Then** the item returns to the player's inventory and the output summary updates.

---

### User Story 2 - Kiln Tool Requirement (Priority: P1)

The player must possess a kiln tool in their inventory to disassemble. The kiln has durability that decreases by the total quantity of individual items disassembled (stacks count their full quantity). The disassembly window displays the kiln's current and maximum durability. If the kiln lacks sufficient durability for the total item count across all grid slots, disassembly is blocked.

**Why this priority**: The kiln is a gating mechanic integral to the core disassembly flow — cannot ship P1 without it.

**Independent Test**: Can be tested by attempting disassembly with no kiln (blocked), with insufficient durability (blocked), and with sufficient durability (succeeds and durability decreases).

**Acceptance Scenarios**:

1. **Given** a player opens the disassembly window without a kiln in their inventory, **When** the window renders, **Then** the kiln slot is empty, a message indicates a kiln is required, and the Disassemble button is disabled.
2. **Given** a player has one or more kilns in inventory, **When** they drag a kiln into the dedicated kiln slot, **Then** the kiln is selected and its current/max durability is displayed.
3. **Given** a player has a kiln with durability 3 selected and places items totaling 5 quantity in the grid, **When** they attempt to disassemble, **Then** an error message states insufficient kiln durability and disassembly is blocked.
4. **Given** a player disassembles items totaling 4 quantity with a kiln at durability 10/20, **When** disassembly completes, **Then** kiln durability becomes 6/20.
5. **Given** a kiln reaches 0 durability after disassembly, **Then** the kiln is destroyed (removed from inventory) and the kiln slot becomes empty.
6. **Given** a kiln is in the kiln slot, **When** the player drags it back to inventory, **Then** the kiln returns to inventory and the Disassemble button is disabled.

---

### User Story 3 - Admin: Configure Disassembly Recipes per Item (Priority: P1)

An admin can define disassembly output recipes when creating or editing an item definition. Each recipe entry specifies a percentage chance and a list of output items with quantities. All chance entries for an item must sum to exactly 100%. The item add/edit interface uses a modal dialog (replacing the current embedded form) to accommodate the additional recipe configuration fields.

**Why this priority**: Without admin-configured recipes, no items can be disassembled — this is a prerequisite for the player-facing feature.

**Independent Test**: Can be tested by opening the item modal in the admin panel, adding disassembly recipe entries, verifying the 100% validation, saving, and confirming persistence.

**Acceptance Scenarios**:

1. **Given** an admin opens the item creation or editing interface, **When** the interface renders, **Then** it displays as a modal dialog (not an embedded inline form).
2. **Given** the item modal is open, **When** the admin navigates to the disassembly section, **Then** they can add multiple chance entries, each with a percentage and one or more output items (selected from existing item definitions) with quantities.
3. **Given** an admin has added chance entries totaling 95%, **When** they attempt to save, **Then** validation fails with a message that chances must sum to 100%.
4. **Given** an admin saves an item with valid disassembly recipes (summing to 100%), **When** a player later disassembles that item, **Then** the output is determined by rolling against the configured chance table.
5. **Given** an item has no disassembly recipes configured, **When** a player tries to drag it into the disassembly grid, **Then** the item is rejected with a message indicating it cannot be disassembled.

---

### User Story 4 - Admin: NPC Disassembler Flag (Priority: P2)

An admin can mark an NPC as a disassembler via a flag/checkbox in the admin NPC management interface. Only NPCs with this flag present the "Disassemble" dialog option to players.

**Why this priority**: Important for content management but can be temporarily hardcoded for P1 testing.

**Independent Test**: Can be tested by toggling the flag on/off for an NPC and verifying the dialog option appears/disappears for players.

**Acceptance Scenarios**:

1. **Given** an admin is editing an NPC in the admin panel, **When** they view the NPC form, **Then** an "Is Disassembler" checkbox is available.
2. **Given** an NPC has the disassembler flag enabled and is assigned to a building, **When** a player interacts with that NPC, **Then** the "Disassemble" option appears in the NPC dialog.
3. **Given** an NPC does not have the disassembler flag, **When** a player interacts with that NPC, **Then** no disassembly option is shown.

---

### User Story 5 - Validation and Error Handling (Priority: P2)

The system prevents disassembly when preconditions are not met and provides clear feedback to the player.

**Why this priority**: Essential for a polished experience but the core flow can function with basic validation first.

**Independent Test**: Can be tested by triggering each error condition and verifying the appropriate message is shown.

**Acceptance Scenarios**:

1. **Given** a player's free inventory slots are fewer than the maximum possible output item count from the disassembly, **When** they click Disassemble, **Then** an error message states they need more inventory space.
2. **Given** a player does not have enough gold for the disassembly cost, **When** they click Disassemble, **Then** an error message states insufficient gold.
3. **Given** a player drags a non-disassemblable item (no recipes) onto the disassembly grid, **When** the drag completes, **Then** the item snaps back to inventory and a brief message explains the item cannot be disassembled.
4. **Given** the disassembly grid is full (15 items), **When** the player tries to drag another item in, **Then** the drag is rejected.

---

### Edge Cases

- What happens if the player's kiln is destroyed (durability reaches 0) mid-batch? The kiln durability check happens before disassembly starts — the entire batch requires sufficient durability upfront, so mid-batch destruction cannot occur.
- What happens if an item in the grid is removed from the database by an admin during the session? The server validates all item IDs at disassembly time; if any are invalid, the operation fails with an error and no items are consumed.
- What happens if two disassembly chance entries produce the same output item? The quantities stack — the output summary aggregates by item type to show combined min/max ranges.
- What happens if a player disconnects during disassembly? The server operation is atomic — either all items are consumed and outputs granted, or nothing happens.
- Can equipped items be dragged into the disassembly grid? No — only unequipped inventory items with disassembly recipes are eligible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow NPCs to be flagged as disassemblers via an admin-controlled boolean attribute (`is_disassembler`).
- **FR-002**: System MUST present a "Disassemble" dialog option when a player interacts with a disassembler NPC.
- **FR-003**: System MUST display a disassembly window with a 15-slot item grid and a dedicated kiln slot when the player selects the disassemble option.
- **FR-004**: System MUST support drag-and-drop of eligible inventory items into the disassembly grid and back out to inventory.
- **FR-005**: System MUST only accept items that have at least one disassembly recipe configured into the grid.
- **FR-006**: System MUST display an output summary showing all possible output items with quantity ranges (min–max) and total gold cost while items are in the grid.
- **FR-007**: System MUST require the player to have a kiln tool in their inventory to disassemble.
- **FR-007a**: System MUST provide a dedicated kiln slot in the disassembly window where the player drags a kiln from their inventory to activate it.
- **FR-008**: System MUST display the selected kiln's current durability and maximum durability in the disassembly window.
- **FR-009**: System MUST reduce kiln durability by the total quantity of individual items disassembled (e.g., a stack of 5 in one slot costs 5 durability).
- **FR-010**: System MUST destroy the kiln when its durability reaches 0.
- **FR-011**: System MUST block disassembly if kiln durability is less than the total quantity of individual items across all grid slots (sum of stack sizes).
- **FR-012**: System MUST block disassembly if the player's free inventory slots are fewer than the maximum possible output item count.
- **FR-013**: System MUST block disassembly if the player has insufficient gold.
- **FR-014**: System MUST atomically consume input items, deduct gold, reduce kiln durability, and grant output items upon successful disassembly.
- **FR-015**: System MUST determine output items by rolling against each input item's configured chance table independently.
- **FR-016**: System MUST allow admins to define disassembly recipes per item definition, where each recipe entry has a percentage chance and a list of output items with quantities.
- **FR-017**: System MUST validate that all chance entries for an item sum to exactly 100%.
- **FR-018**: System MUST present item creation and editing as a modal dialog in the admin panel (replacing the current embedded form).
- **FR-019**: System MUST reject equipped items from being placed in the disassembly grid.
- **FR-020**: The kiln MUST be a standard inventory item (tool category) with a durability attribute, reusing the existing tool/durability system.

### Key Entities

- **Disassembly Recipe**: Defines what outputs an item can produce when disassembled. Belongs to an item definition. Contains multiple chance entries.
- **Disassembly Chance Entry**: A single outcome possibility within a recipe — has a percentage chance (integer, 1–100) and one or more output item references with quantities. All entries for one item must sum to 100%.
- **Disassembly Output Item**: A reference to an item definition with a quantity, nested within a chance entry.
- **Kiln**: An inventory item (tool category) with a durability attribute (current/max). Consumed when durability reaches 0.
- **NPC Disassembler Flag**: A boolean attribute on the NPC entity indicating whether the NPC offers disassembly services.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can complete a full disassembly workflow (open window, drag items, confirm, receive outputs) in under 30 seconds.
- **SC-002**: 100% of disassembly operations are atomic — no partial consumption of input items or partial granting of outputs.
- **SC-003**: Admin users can configure disassembly recipes for an item in under 2 minutes using the modal interface.
- **SC-004**: All validation errors (insufficient space, gold, durability, non-eligible items) display a clear message within 1 second of the triggering action.
- **SC-005**: Chance entry validation prevents saving any recipe where entries do not sum to exactly 100%.
- **SC-006**: Drag-and-drop interactions (inventory to grid and back) respond within 200ms with no visual glitches.

## Assumptions

- Gold cost for disassembly is a flat fee per item, configured at the item definition level (same as recipe data). If no cost is specified, disassembly is free.
- The kiln uses the existing tool/durability system already present for gathering tools (see 020-tool-gathering).
- The "kiln" item will reuse the existing `tool` category rather than creating a new category.
- Maximum output items for inventory space check is calculated as the sum of maximum quantities across all items in the grid (worst-case scenario per chance roll).
- Disassembly recipes are per item definition, not per individual item instance — all items of the same type yield the same possible outputs.
- The disassembly gold cost is shown per-item and as a total sum in the output summary.
