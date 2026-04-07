# Feature Specification: Warehouse System

**Feature Branch**: `036-warehouse-system`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Introduce warehouses — per-building item storage with expandable slots, drag-and-drop transfers, and bulk-transfer actions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Store and Retrieve Items (Priority: P1)

A player enters a building that contains a warehouse action. They click the warehouse button, which opens a warehouse modal. The modal shows two grids side by side: their inventory on the left and the warehouse storage on the right. The player drags an item from their inventory into an empty warehouse slot. The item is removed from their inventory and appears in the warehouse. When the player returns later (even after logging out), the item is still there. Dragging items from warehouse back to inventory also works.

**Why this priority**: Core warehouse functionality — without deposit and withdrawal, nothing else matters.

**Independent Test**: Open the warehouse modal, drag an item from inventory to warehouse, close the modal, reopen it, confirm the item persists. Drag it back to inventory and confirm it returns.

**Acceptance Scenarios**:

1. **Given** a player with items in inventory is at a building with a warehouse action, **When** they click the warehouse action, **Then** a modal opens showing inventory (left) and warehouse slots (right).
2. **Given** the warehouse modal is open, **When** the player drags a stackable item from inventory to an empty warehouse slot, **Then** the item moves to the warehouse and the inventory slot is freed.
3. **Given** the warehouse modal is open, **When** the player drags a stackable item from inventory onto the same item type already in the warehouse, **Then** the quantities merge (up to stack limit).
4. **Given** the warehouse modal is open, **When** the player drags an item from warehouse to inventory, **Then** the item moves back to inventory.
5. **Given** the warehouse has items stored, **When** the player logs out and logs back in and opens the same warehouse, **Then** all previously stored items are present.
6. **Given** a player stores items in the Elarion warehouse, **When** they open a warehouse in a different city, **Then** they see a separate, independent storage (items are not shared between warehouses).

---

### User Story 2 - Bulk Transfer Actions (Priority: P2)

The warehouse modal has three action buttons: "Transfer All to Inventory" (left arrow), "Transfer All to Warehouse" (right arrow), and "Merge to Warehouse." Transfer All to Inventory moves every item from the warehouse into the player's inventory. Transfer All to Warehouse moves every inventory item into the warehouse. Merge to Warehouse finds items in the inventory that match item types already present in the warehouse and transfers only those.

**Why this priority**: Significant quality-of-life feature that makes the warehouse practical for regular use — manual drag-and-drop for dozens of items would be tedious.

**Independent Test**: Place known items in both inventory and warehouse, click each bulk button, verify the correct transfers occur.

**Acceptance Scenarios**:

1. **Given** the warehouse contains 3 different items, **When** the player clicks "Transfer All to Inventory," **Then** all 3 items move to inventory (if inventory has space) and warehouse slots become empty.
2. **Given** the inventory contains 5 items, **When** the player clicks "Transfer All to Warehouse," **Then** all 5 items move to warehouse slots (if warehouse has space).
3. **Given** the warehouse contains Animal Leather and Iron Ore, and the inventory contains Animal Leather, Wood, and Iron Ore, **When** the player clicks "Merge to Warehouse," **Then** only Animal Leather and Iron Ore transfer from inventory to warehouse; Wood stays in inventory.
4. **Given** a bulk transfer would exceed available slots, **When** the player clicks a bulk action, **Then** items transfer until all available slots are filled, remaining items stay in their original location, and the player sees a message indicating partial completion.

---

### User Story 3 - Expand Warehouse Capacity (Priority: P3)

Every new player starts with 15 warehouse slots per warehouse location. The warehouse modal shows total slots and used slots. An "Expand Storage" button allows the player to purchase additional slots using crowns. Each additional slot costs exponentially more. The cost is displayed before purchase.

**Why this priority**: Progression mechanic and crown sink — players need a way to grow storage as they collect more items.

**Independent Test**: Create a new character, verify 15 slots, purchase a slot, verify 16 slots and correct crown deduction, check next slot costs more.

**Acceptance Scenarios**:

1. **Given** a new player opens a warehouse for the first time, **When** the modal opens, **Then** they see 15 available slots.
2. **Given** a player has enough crowns, **When** they click to purchase an additional slot, **Then** one slot is added, crowns are deducted, and the next slot cost is displayed (higher than before).
3. **Given** a player does not have enough crowns, **When** they attempt to purchase a slot, **Then** the purchase is rejected with a message indicating insufficient crowns.
4. **Given** a player has purchased 3 extra slots at Warehouse A, **When** they open Warehouse B, **Then** Warehouse B still has only 15 slots (expansions are per-warehouse).

---

### Edge Cases

- What happens when the player drags an item to a full warehouse? The item stays in inventory and a "warehouse full" message is shown.
- What happens when the player drags a warehouse item to a full inventory? The item stays in the warehouse and an "inventory full" message is shown.
- What happens if a player tries to store an equipped item? Equipped items cannot be stored — only unequipped inventory items are eligible.
- What happens if items are transferred while another operation is in progress? The server validates item ownership and slot availability atomically per transaction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a new building action type "warehouse" that opens a warehouse interface when activated.
- **FR-002**: Each warehouse (per building) MUST maintain independent item storage — items stored in one warehouse are not visible in another.
- **FR-003**: System MUST provide 15 warehouse slots to each player at each warehouse location by default.
- **FR-004**: Players MUST be able to move individual items between inventory and warehouse via drag-and-drop.
- **FR-005**: System MUST support stacking — dragging a stackable item onto the same item type in the destination merges quantities up to the stack limit.
- **FR-006**: System MUST provide a "Transfer All to Inventory" button that moves all warehouse items to the player's inventory.
- **FR-007**: System MUST provide a "Transfer All to Warehouse" button that moves all inventory items to the warehouse.
- **FR-008**: System MUST provide a "Merge to Warehouse" button that transfers only inventory items whose item type already exists in the warehouse.
- **FR-009**: Bulk transfers that exceed available slots MUST transfer as many items as possible and notify the player of partial completion.
- **FR-010**: Players MUST be able to purchase additional warehouse slots using crowns, with each successive slot costing exponentially more.
- **FR-011**: Slot expansion pricing MUST follow the formula `cost = 1000 * (2^(n+1) - 1)` where n is the number of extra slots already purchased at that warehouse, yielding 1000, 3000, 7000, 15000, 31000 crowns for the 1st through 5th extra slots.
- **FR-012**: Slot expansions MUST be per-warehouse — purchasing extra slots at one warehouse does not affect another. There is no maximum cap on purchased slots; the exponential cost curve naturally limits expansion.
- **FR-013**: The warehouse modal MUST display above other UI elements with proper z-index layering, following the same overlay pattern as the marketplace modal.
- **FR-014**: The warehouse modal MUST show the current slot count, used slots, and the cost to unlock the next slot.
- **FR-015**: All item categories (weapons, armor, resources, tools, food, healing, skill books, rings, amulets) may be stored in the warehouse. Only unequipped inventory items are eligible — equipped items cannot be transferred.
- **FR-016**: All item transfers MUST be validated server-side to prevent duplication or loss.

### Key Entities

- **Warehouse Storage**: Per-player, per-building item storage with a configurable slot count. Contains references to item instances and their quantities.
- **Warehouse Slot Expansion**: Tracks how many additional slots a player has purchased at each warehouse, determining current capacity and next-slot pricing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can deposit and withdraw items from the warehouse in under 2 seconds per action.
- **SC-002**: New players see exactly 15 available warehouse slots upon first opening a warehouse.
- **SC-003**: Bulk transfer operations complete within 3 seconds for inventories of up to 50 items.
- **SC-004**: Slot expansion purchases correctly deduct crowns and increase capacity immediately.
- **SC-005**: Items stored in Warehouse A are never visible in Warehouse B — 100% isolation between warehouse locations.
- **SC-006**: No item duplication or loss occurs during any warehouse operation.

## Clarifications

### Session 2026-04-07

- Q: Which pricing formula for slot expansion — `1000 * 2^n` (1k,2k,4k,8k) or `1000 * (2^(n+1) - 1)` (1k,3k,7k,15k)? → A: `1000 * (2^(n+1) - 1)` — steeper curve matching original intent (1k, 3k, 7k).
- Q: Is there a maximum number of extra warehouse slots a player can purchase? → A: No cap — the exponential cost curve is sufficient to naturally limit expansion.
- Q: Can all item categories be stored in the warehouse, or are some excluded? → A: All item categories — any unequipped item can be stored regardless of type.

## Assumptions

- The existing `building_actions` system will be extended with a `'warehouse'` action type, following the established pattern for new action types.
- The exponential pricing formula `cost = 1000 * (2^(n+1) - 1)` provides a progression of 1000, 3000, 7000, 15000, 31000 crowns. Exact values can be tuned later.
- The warehouse modal UI follows the same architectural pattern as the marketplace modal (HTML overlay, WebSocket communication).
- Stack merging during warehouse transfers follows the same mechanics as existing inventory stack operations.
- Stored items persist indefinitely — no expiration mechanic.

## Scope Boundaries

**In scope**:
- Warehouse building action type and server-side handler
- Per-building, per-player storage with persistent slots
- Drag-and-drop item transfer UI
- Three bulk transfer buttons (all to inventory, all to warehouse, merge)
- Slot expansion purchase with exponential pricing
- Admin panel support for assigning warehouse actions to buildings

**Out of scope**:
- Warehouse-to-warehouse direct transfers
- Shared/guild warehouses
- Item sorting or filtering within the warehouse
- Warehouse rental fees or maintenance costs
- Warehouse access permissions beyond building proximity
