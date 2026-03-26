# Feature Specification: Player Marketplace

**Feature Branch**: `023-player-marketplace`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Player marketplace system — a special building where players can list, browse, and buy items from other players with configurable fees, listing limits, expiration, and crown collection."

## Clarifications

### Session 2026-03-26

- Q: Can a seller cancel/delist an active listing before expiration? → A: Yes, cancel allowed; listing fee not refunded, items returned to inventory immediately, listing slot freed.
- Q: Are crown earnings global or per-marketplace-building? → A: Per-building — crowns accumulate at the building where the item was originally listed. Listings are also building-scoped (each marketplace building has its own listing pool).
- Q: How should the item grid handle large numbers of listings? → A: Paginated grid with fixed page size and page navigation controls.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Buy Items (Priority: P1)

A player enters a building marked as a marketplace. They see a "Browse Marketplace" action button. Clicking it opens a large modal showing all items currently listed for sale. The player can filter by item category (weapons, armor, resources, etc.) and search by name. Items are displayed in a grid showing icon, name, total quantity for sale, and min/max price range. Clicking an item reveals individual listings sorted by lowest per-item price. The player selects a listing and buys the entire stack, paying the listed total price in crowns.

**Why this priority**: Browsing and buying is the core marketplace interaction. Without it, no marketplace economy exists.

**Independent Test**: Can be tested by pre-seeding marketplace listings and verifying a player can browse, filter, search, select, and purchase items.

**Acceptance Scenarios**:

1. **Given** a player is at a marketplace building, **When** they click the "Browse Marketplace" action, **Then** a large modal opens displaying all active listings for that specific building, grouped by item type in a grid layout.
2. **Given** the marketplace modal is open, **When** the player selects a category filter (e.g., "Weapons"), **Then** only items of that category are shown in the grid.
3. **Given** the marketplace modal is open, **When** the player types in the search box, **Then** items are filtered by name in real time.
4. **Given** the player clicks an item in the grid, **When** individual listings are displayed, **Then** listings are sorted by lowest per-item price (price / quantity) by default.
5. **Given** a player clicks "Buy" on a listing, **When** they have enough crowns, **Then** the full stack is purchased, crowns are deducted, and the item stack is added to the buyer's inventory.
6. **Given** a player clicks "Buy" on a listing, **When** they do not have enough crowns, **Then** the purchase is rejected and an appropriate message is shown.
7. **Given** a player clicks "Buy" on a listing, **When** their inventory is full, **Then** the purchase is rejected and an appropriate message is shown.

---

### User Story 2 - List Items for Sale (Priority: P1)

A player drags an item from their inventory into the marketplace modal to list it for sale. If the item is stackable, a small dialog appears where the player chooses how many to sell and sets the per-item price. For non-stackable items, only a price field is shown. Listing costs a flat fee in crowns (configurable by admin). Listing is confirmed by clicking "Sell." The item is removed from the player's inventory and placed on the marketplace.

**Why this priority**: Listing items is equally essential as buying — a marketplace needs both sellers and buyers to function.

**Independent Test**: Can be tested by having a player drag inventory items to the marketplace and verifying the listing appears with correct quantity, price, and fee deduction.

**Acceptance Scenarios**:

1. **Given** the marketplace modal is open, **When** the player drags a stackable item from inventory into the marketplace area, **Then** a small dialog appears with quantity selector and per-item price field.
2. **Given** the marketplace modal is open, **When** the player drags a non-stackable item from inventory, **Then** a dialog appears with only a price field (no quantity selector).
3. **Given** the player has set quantity and price, **When** they click "Sell," **Then** the listing fee (e.g., 10 crowns) is deducted, the items are removed from inventory, and the listing appears on the marketplace.
4. **Given** the player does not have enough crowns to pay the listing fee, **When** they try to list an item, **Then** the listing is rejected with a message explaining insufficient funds for the fee.
5. **Given** the player already has 10 active listings (including expired uncollected ones), **When** they try to list another item, **Then** the listing is rejected with a message about the listing limit.

---

### User Story 3 - Manage Own Listings and Collect Earnings (Priority: P2)

A player can view their own active and expired listings in the marketplace. When an item sells, the crowns accumulate in the marketplace. The player clicks a "Collect Crowns" button to receive all pending crown earnings. When a listing expires after 5 real days, the items can no longer be purchased but remain in the marketplace. The player can collect expired items back to their inventory. Both expired items and pending earnings occupy listing slots until collected.

**Why this priority**: Players need feedback on their sales activity and a way to retrieve earnings and expired items. Without this, the marketplace is a one-way system.

**Independent Test**: Can be tested by creating listings, simulating purchases and time passage, then verifying collection of crowns and expired items.

**Acceptance Scenarios**:

1. **Given** a player has sold items on the marketplace, **When** they open the marketplace, **Then** they see accumulated pending crowns with a "Collect Crowns" button.
2. **Given** a player clicks "Collect Crowns," **When** there are pending earnings, **Then** all pending crowns are added to the player's balance and the pending amount resets to zero.
3. **Given** a listing has been active for more than 5 real days without being purchased, **When** any player views the marketplace, **Then** the expired listing no longer appears in browse results.
4. **Given** a player has expired listings, **When** they view their own listings section, **Then** expired items are shown with a "Collect Items" button.
5. **Given** a player clicks "Collect Items" on an expired listing, **When** they have inventory space, **Then** the items return to their inventory and the listing slot is freed.
6. **Given** a player clicks "Collect Items" on an expired listing, **When** their inventory is full, **Then** collection is rejected with an appropriate message.

---

### User Story 4 - Admin Configuration (Priority: P3)

An administrator can configure marketplace parameters: the listing fee (in crowns), the maximum number of listings per player, and the listing duration (in real days). An admin can also designate a building as a marketplace through the existing building action system.

**Why this priority**: Admin controls are needed for balancing the economy, but the marketplace must work first before tuning is relevant.

**Independent Test**: Can be tested by changing marketplace settings via admin tools and verifying the new values take effect for players.

**Acceptance Scenarios**:

1. **Given** an admin accesses the building action configuration, **When** they add a marketplace action to a building, **Then** that building shows the "Browse Marketplace" option to players.
2. **Given** an admin sets the listing fee to 25 crowns, **When** a player lists an item, **Then** 25 crowns are deducted as the fee.
3. **Given** an admin sets the max listings to 15, **When** a player has fewer than 15 active listings, **Then** they can create new listings up to the limit.

---

### Edge Cases

- What happens when a player tries to buy their own listing? Purchase is allowed — the player may want to delist, but the listing fee is non-refundable as a natural cost.
- What happens when two players try to buy the same listing simultaneously? Only the first purchase succeeds; the second receives a "listing no longer available" message.
- What happens when a player lists a partial stack (e.g., 5 of 20 iron ore)? Only the listed quantity is removed from inventory; the remaining 15 stay.
- What happens when a player's inventory is modified while the marketplace modal is open? The modal reflects current inventory state; stale drag-and-drop attempts are rejected server-side.
- What happens if the marketplace has zero listings? An empty state message is shown (e.g., "No items for sale").
- What happens when a player cancels listing creation mid-dialog? No fee is charged, items remain in inventory.
- What happens when a seller collects crowns but has earned zero? The collect button is hidden or disabled when there are no pending crowns.
- What happens when a player lists a tool with reduced durability? The listing preserves the item's current durability; buyers see the durability state before purchasing.
- What happens when a seller wants to remove an active listing? The seller can cancel the listing; items are returned to inventory immediately, but the listing fee is not refunded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow buildings to be designated as marketplaces through a new building action type ("marketplace").
- **FR-002**: System MUST display a "Browse Marketplace" action when a player enters a marketplace building.
- **FR-003**: System MUST open a large modal window showing all active listings for the current marketplace building when the player activates the marketplace action.
- **FR-004**: System MUST display items in a paginated grid view grouped by item definition, showing icon, name, total quantity for sale across all listings, and min/max per-item price, with page navigation controls.
- **FR-005**: System MUST provide category filters matching existing item categories (weapon, armor, resource, tool, food, heal, etc.).
- **FR-006**: System MUST provide a text search field that filters items by name.
- **FR-007**: System MUST display individual listings for a selected item, sorted by lowest per-item price, showing seller name, quantity, per-item price, total price, and a "Buy" button.
- **FR-008**: System MUST allow purchasing an entire listing stack only — no partial purchases.
- **FR-009**: System MUST deduct the total listing price from buyer's crowns and add the item stack to buyer's inventory upon purchase.
- **FR-010**: System MUST reject purchases when buyer has insufficient crowns or insufficient inventory space.
- **FR-011**: System MUST allow players to list items for sale by dragging from inventory into the marketplace modal.
- **FR-012**: System MUST show a quantity selector and per-item price field for stackable items, and only a price field for non-stackable items.
- **FR-013**: System MUST deduct a configurable listing fee (in crowns) when an item is listed; fee is non-refundable.
- **FR-014**: System MUST enforce a per-player listing limit (default: 10) counting both active and expired-uncollected listings across all marketplace buildings.
- **FR-015**: System MUST expire listings after a configurable duration (default: 5 real days), making them no longer purchasable.
- **FR-016**: System MUST accumulate sale proceeds (crowns) at the marketplace building where the item was listed, for the seller to collect at that building.
- **FR-017**: System MUST allow sellers to collect all pending crowns via a single "Collect Crowns" action.
- **FR-018**: System MUST allow sellers to collect expired listing items back to their inventory (if space available).
- **FR-019**: System MUST free the listing slot only when the seller collects the expired items or the sold listing's crowns are collected.
- **FR-020**: System MUST handle concurrent purchase attempts gracefully — first buyer succeeds, subsequent buyers are rejected.
- **FR-021**: System MUST validate all marketplace operations server-side (price, quantity, ownership, inventory space, crown balance).
- **FR-022**: System MUST show the player's own listing count and limit (e.g., "3/10 listings used").
- **FR-023**: System MUST enforce a minimum per-item price of 1 crown.
- **FR-024**: System MUST prevent listing of equipped items — player must unequip first.
- **FR-025**: System MUST allow sellers to cancel an active listing, returning items to inventory immediately; the listing fee is not refunded and the listing slot is freed.

### Key Entities

- **Marketplace Listing**: Represents an item listed for sale — includes seller, item definition, quantity, per-item price, listing timestamp, expiration timestamp, status (active / expired / sold / cancelled), and for tools, current durability.
- **Marketplace Earnings**: Tracks accumulated crowns from sales per player per marketplace building, available for collection only at the building where the item was listed.
- **Marketplace Configuration**: Admin-configurable settings for listing fee, max listings per player, and listing duration — stored as building action config.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can browse marketplace listings, filter by category, and search by name with each interaction feeling instant (under 1 second feedback).
- **SC-002**: Players can complete a purchase (select item, view listings, buy) in under 5 clicks from opening the marketplace.
- **SC-003**: Players can list an item for sale (drag, set price/quantity, confirm) in under 10 seconds.
- **SC-004**: Expired listings are no longer purchasable after the configured duration has elapsed.
- **SC-005**: Concurrent purchases of the same listing result in exactly one successful transaction — no item duplication or crown loss.
- **SC-006**: All marketplace financial transactions (fee deduction, purchase, crown collection) maintain perfect accuracy with no crown duplication or loss.
- **SC-007**: Marketplace supports at least 1,000 active listings without noticeable performance degradation when browsing.
- **SC-008**: Players can view their active listings, expired listings, and pending earnings in a single "My Listings" section of the marketplace modal.

## Assumptions

- The marketplace is building-scoped — each marketplace building has its own independent listing pool. Players only see listings created at the marketplace they are currently visiting. This allows regional economies and thematic marketplaces (e.g., a weapons bazaar vs. a resource market).
- Listing fee, max listings, and listing duration are configured per marketplace building action (in config), allowing different marketplaces to have different settings if desired.
- The drag-and-drop interaction for listing items reuses the existing inventory panel's item representation and extends it to support dragging into the marketplace modal.
- Equipped items cannot be listed for sale — they must be unequipped first.
- Items with durability (tools) can be listed; the listing preserves the item's current durability state.
- The per-item price must be at least 1 crown (no free listings).
- A player does not need to be at the marketplace building to have their listings remain active — listings persist independently.
- The listing limit (default 10) is a fixed value for now; future features (leveling, skills) may increase it, but that is out of scope.
