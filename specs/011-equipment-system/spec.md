# Feature Specification: Equipment System

**Feature Branch**: `011-equipment-system`
**Created**: 2026-03-08
**Status**: Draft
**Input**: User description: "Let's add equipement system to the game. In left panel (where inventory currently is), create a tabs that will for now hold 1. Equipment, 2. Inventory. User can switch between tabs clicking proper icon of the tab on top of leftside panel. Currently selected tab is somehow marked. In equipement page, there are slots for different pieces. Helmet on top, chestpiece in the middle, left and right arms, greaves, bracer and boots. On the bottom there are inventory slots similiar to inventory, but with filters only for equipable items (weapons, armor). User can drag and drop item to specific slot to wear it, in case there already is item in slot, it's unequiped. Weared items influence player attack and defence."

## Clarifications

### Session 2026-03-08

- Q: Is there a standalone unequip mechanic, or can items only be removed via slot swap? → A: Players can unequip by dragging the equipped item from its slot back into the mini-inventory at the bottom of the Equipment tab.
- Q: How does a two-handed weapon interact with the Left Arm slot? → A: Two-handed weapons use the Right Arm slot only. When a two-handed weapon is equipped, the Left Arm slot is visually grayed out and cannot accept any item.
- Q: Can a player wear a two-handed weapon and a shield simultaneously? → A: No. Two-handed weapons and shields are mutually exclusive — a player cannot have both equipped at the same time.
- Q: When equipping a two-handed weapon with a shield already in Left Arm — auto-return shield to inventory or block? → A: Auto-swap: the shield is automatically returned to inventory when a two-handed weapon is equipped; the action is only blocked if the inventory is full.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch Between Equipment and Inventory Tabs (Priority: P1)

A player opens the left panel and sees two tab icons at the top — one for Equipment and one for Inventory. They can click either icon to switch the panel content. The currently active tab is visually distinguished from the inactive one.

**Why this priority**: The tabbed panel is the structural foundation for both equipment and inventory views. Without the tabs, neither feature is accessible. This is the first thing a player will see and interact with.

**Independent Test**: Can be fully tested by verifying that clicking the Equipment tab icon shows the equipment view, clicking the Inventory tab icon shows the inventory grid, and the active tab icon is visually highlighted regardless of which tab is selected.

**Acceptance Scenarios**:

1. **Given** the left panel is visible in the game, **When** the player clicks the Equipment tab icon, **Then** the equipment view is shown and the Equipment icon is visually marked as active.
2. **Given** the Equipment tab is active, **When** the player clicks the Inventory tab icon, **Then** the inventory grid view is shown and the Inventory icon is marked as active while the Equipment icon is not.
3. **Given** the player is on any tab, **When** they reload or re-enter the game scene, **Then** the panel defaults to showing the Inventory tab.

---

### User Story 2 - View Equipment Panel with Slots (Priority: P1)

A player switches to the Equipment tab and sees a visual layout of their character's body with labelled slots for each equipment piece. Empty slots are clearly visible as placeholders. Slots that already have items equipped show the item icon. The lower portion of the Equipment tab shows a mini-inventory grid with only equippable items (weapons and armor) visible, providing quick access to items available for equipping.

**Why this priority**: Establishing the visual layout of equipment slots is core to the feature and must exist before equipping mechanics can be built or tested.

**Independent Test**: Can be tested independently by opening the Equipment tab and confirming all 7 slots are visible and correctly labeled, and that the mini-inventory below shows only equipment-type items.

**Acceptance Scenarios**:

1. **Given** the player is on the Equipment tab, **When** no items are equipped, **Then** all 7 slots (Helmet, Chestpiece, Left Arm, Right Arm, Greaves, Bracer, Boots) are visible as empty placeholders.
2. **Given** a player has an item equipped in the Chestpiece slot, **When** they open the Equipment tab, **Then** the Chestpiece slot shows the equipped item's icon.
3. **Given** the player has a mix of weapons, food, and resources in their inventory, **When** they view the Equipment tab's mini-inventory section, **Then** only weapons and armor items are shown; food and resources are hidden.
4. **Given** the player has no equippable items in their inventory, **When** the Equipment tab's mini-inventory is shown, **Then** it appears empty with a clear indication (e.g., no items available message or empty grid).

---

### User Story 3 - Equip an Item by Drag and Drop (Priority: P1)

A player drags an item from the mini-inventory in the Equipment tab and drops it onto a compatible equipment slot. The item moves from the inventory into the slot, the slot now displays the item's icon, and the player's stats are updated to reflect the item's bonuses.

**Why this priority**: This is the central interaction of the feature — without equipping, the equipment system has no gameplay value.

**Independent Test**: Can be tested by dragging a weapon from the mini-inventory onto the Right Arm slot and verifying the slot fills, the item leaves the inventory, and the player's attack stat increases accordingly.

**Acceptance Scenarios**:

1. **Given** a weapon is in the player's inventory and the Right Arm slot is empty, **When** the player drags the weapon icon onto the Right Arm slot, **Then** the weapon appears in the slot, disappears from the mini-inventory, and the player's attack stat increases by the weapon's attack value.
2. **Given** a boot item is in the player's inventory and the Boots slot is empty, **When** the player drags the boots onto the Boots slot, **Then** the boots appear in the slot, leave the inventory, and the player's defence stat increases.
3. **Given** a player attempts to drag a helmet onto the Boots slot, **When** they drop it, **Then** the drop is rejected and the item stays in the mini-inventory (incompatible slot type).
4. **Given** a player drags an item but releases it outside any valid slot, **When** the drop occurs, **Then** the item returns to its original position in the mini-inventory.

---

### User Story 4 - Unequip and Swap Items (Priority: P1)

A player can remove an item from an equipment slot in two ways: by dragging the equipped item directly back into the mini-inventory at the bottom of the Equipment tab (unequip), or by dragging a new item from the mini-inventory onto an already-occupied slot (swap). In both cases the displaced item returns to inventory and stats update immediately.

**Why this priority**: Without unequip and swap behaviors, players have no way to change gear once a slot is filled — making this equally critical to the equipping mechanic itself.

**Independent Test**: Can be tested by equipping an item, dragging it back to the mini-inventory (unequip), verifying the slot is empty and the item reappears in inventory; and by swapping — dragging a different compatible item onto the occupied slot and confirming the old item returns to inventory.

**Acceptance Scenarios**:

1. **Given** the Boots slot contains a pair of Iron Boots, **When** the player drags the Iron Boots icon from the slot into the mini-inventory area, **Then** the Boots slot becomes empty, the Iron Boots reappear in the mini-inventory, and the player's defence stat decreases accordingly.
2. **Given** the Right Arm slot contains an Iron Sword, **When** the player drags a Steel Sword onto the Right Arm slot, **Then** the Iron Sword returns to the player's inventory, the Steel Sword takes the slot, and the player's attack stat reflects the Steel Sword's value.
3. **Given** a player tries to unequip an item but their inventory is full, **When** they drag the equipped item toward the mini-inventory, **Then** the unequip is blocked, the item returns to its slot, and the player sees a notification that their inventory is full.
4. **Given** a slot swap would cause the inventory to exceed its capacity, **When** the player attempts to drag a new item onto an occupied slot, **Then** the swap is blocked and the player sees a notification that their inventory is full.
5. **Given** the player unequips or swaps an item, **When** the action completes, **Then** stats are updated immediately in a single step (no intermediate state visible).

---

### User Story 5 - Equipped Items Influence Player Stats (Priority: P2)

The player's displayed attack and defence values in the character stats bar reflect the sum of bonuses from all currently equipped items. When items are equipped or unequipped, the stat values update immediately.

**Why this priority**: Stat influence gives equipping meaningful gameplay value. It depends on the equipping mechanic (User Stories 3 and 4) being in place first.

**Independent Test**: Can be tested by noting base stats, equipping and unequipping items with known attack/defence values, and confirming the stats bar reflects the expected values at each step.

**Acceptance Scenarios**:

1. **Given** a player has base attack of 5 and equips a weapon with attack value 10, **When** the equip completes, **Then** the player's displayed attack becomes 15.
2. **Given** a player has a weapon (attack +10) and boots (defence +5) equipped, **When** they unequip the weapon, **Then** their attack returns to base and defence remains at base + 5.
3. **Given** a player equips multiple armour pieces across different slots, **When** they view their stats, **Then** defence is the sum of all equipped armour pieces' defence values plus base defence.
4. **Given** a slot swap replaces an item, **When** the swap completes, **Then** the stat updates in a single step (old bonus removed, new bonus added simultaneously — no intermediate flash of lower/higher stats visible).

---

### User Story 6 - Two-Handed Weapon Restricts Left Arm Slot (Priority: P1)

When a player equips a two-handed weapon in the Right Arm slot, the Left Arm slot is immediately grayed out and becomes non-interactive. The player cannot equip a shield or any other item in the Left Arm slot while a two-handed weapon is equipped. If a shield is already in the Left Arm slot when the player equips a two-handed weapon, the shield is automatically returned to the player's inventory to make room — this is only blocked if the inventory is full.

**Why this priority**: This is a gameplay rule that affects both UI state and equip validation. Without it, players could violate game balance by wearing a two-handed weapon and a shield simultaneously.

**Independent Test**: Can be tested by equipping a two-handed weapon and verifying: (a) Left Arm slot is visually grayed out; (b) attempting to drag a shield to Left Arm is rejected; (c) unequipping the two-handed weapon restores the Left Arm slot to normal.

**Acceptance Scenarios**:

1. **Given** a two-handed weapon is in the Right Arm slot, **When** the player views the Equipment tab, **Then** the Left Arm slot is visually grayed out and displays no drop target affordance.
2. **Given** a two-handed weapon is equipped and the Left Arm slot is grayed out, **When** the player drags a shield onto the Left Arm slot, **Then** the drop is rejected and the shield stays in the mini-inventory.
3. **Given** a two-handed weapon is equipped, **When** the player unequips the two-handed weapon (drags it back to mini-inventory), **Then** the Left Arm slot returns to its normal interactive state.
4. **Given** no two-handed weapon is equipped, **When** the player equips any one-handed weapon or leaves the Right Arm slot empty, **Then** the Left Arm slot is fully interactive.
5. **Given** a shield is in the Left Arm slot and the player drags a two-handed weapon onto the Right Arm slot, **When** the drop occurs and inventory has space, **Then** the shield is automatically returned to the player's inventory, the two-handed weapon takes the Right Arm slot, and the Left Arm slot becomes grayed out.
6. **Given** a shield is in the Left Arm slot, the inventory is full, and the player attempts to equip a two-handed weapon, **When** the drop occurs, **Then** the equip is blocked and the player sees a notification that their inventory is full.

---

### Edge Cases

- What if a player's inventory is full and they try to unequip an item — the unequip is blocked and the item stays in its slot; a notification is shown.
- What if a player's inventory is full and they try to swap an item — the swap is blocked; both items stay in their current positions; a notification is shown.
- What happens if the player has an item equipped that is later deleted from item definitions by an admin — the equipped item remains on the character using cached data; the stat contribution remains until the item is unequipped.
- What if the player drags an item from the mini-inventory in Equipment tab to the regular Inventory tab — the item stays in inventory (no visual confusion between tabs during drag).
- What if a player equips items and then switches tabs — the equipped state persists across tab switches and game sessions.
- What happens if the player attempts to equip a stackable resource item (impossible since only weapons/armor are shown in mini-inventory, but guard against programmatic errors).
- The mini-inventory in the Equipment tab shows current inventory state; if items are added or removed in the Inventory tab, the Equipment tab's mini-inventory must reflect those changes.
- What happens when a two-handed weapon is equipped and the player attempts to drag a shield to the grayed-out Left Arm slot — the drop must be rejected regardless of inventory state.

## Requirements *(mandatory)*

### Functional Requirements

**Tab Navigation**

- **FR-001**: The left panel MUST display two tab icons at the top — one for Equipment and one for Inventory — that the player can click to switch between views.
- **FR-002**: The currently active tab icon MUST be visually distinguished from the inactive tab (e.g., highlighted border, different icon state, or background change).
- **FR-003**: The panel MUST default to the Inventory tab when the player enters the game scene.

**Equipment Panel — Layout**

- **FR-004**: The Equipment tab MUST display 7 named equipment slots arranged to represent the character body: Helmet (top), Chestpiece (centre), Left Arm, Right Arm, Greaves, Bracer, and Boots.
- **FR-005**: Each equipment slot MUST display a placeholder icon when empty and the equipped item's icon when occupied.
- **FR-006**: The Equipment tab MUST display a mini-inventory grid in its lower section, showing only the player's equippable items (weapons and armour categories: weapon, helmet, chestpiece, shield, greaves, bracer, boots).
- **FR-007**: The mini-inventory grid in the Equipment tab MUST support filtering by equippable item category (weapon or armour sub-type), matching the filtering behaviour of the main Inventory panel.

**Equipping and Unequipping**

- **FR-008**: Players MUST be able to equip an item by dragging it from the Equipment tab's mini-inventory and dropping it onto a compatible equipment slot.
- **FR-009**: Each equipment slot MUST only accept items of a compatible category (e.g., Helmet slot only accepts helmet items; Right Arm accepts weapons; Left Arm accepts shields).
- **FR-010**: Dropping an item onto an incompatible slot MUST be rejected; the item MUST return to its original position in the mini-inventory.
- **FR-011**: Dropping an item onto an empty compatible slot MUST move the item from the player's inventory into the equipment slot.
- **FR-012**: Dropping an item onto an already-occupied compatible slot MUST swap the items: the previously equipped item returns to the player's inventory and the new item takes the slot.
- **FR-013**: If swapping or unequipping an item would cause the player's inventory to exceed its capacity, the action MUST be blocked and the player MUST receive a notification that their inventory is full.
- **FR-014**: Dropping a dragged item outside any valid slot MUST return the item to its original position without any state change.
- **FR-020**: Players MUST be able to unequip an item by dragging it from an equipment slot directly into the mini-inventory area at the bottom of the Equipment tab.
- **FR-021**: When a two-handed weapon is equipped in the Right Arm slot, the Left Arm slot MUST be visually grayed out and MUST reject all drop attempts until the two-handed weapon is removed.
- **FR-022**: When a player equips a two-handed weapon and a shield is currently in the Left Arm slot, the system MUST automatically return the shield to the player's inventory and complete the equip. If the inventory is full and the shield cannot be returned, the equip MUST be blocked with a notification.
- **FR-023**: A player MUST NOT be able to equip a shield when a two-handed weapon is currently in the Right Arm slot; the equip action MUST be blocked with a notification.

**Stat Effects**

- **FR-015**: A player's effective attack stat MUST equal their base attack value plus the sum of all equipped items' attack values.
- **FR-016**: A player's effective defence stat MUST equal their base defence value plus the sum of all equipped items' defence values.
- **FR-017**: Stat values MUST update immediately upon any equip or unequip action without requiring a scene reload or manual refresh.
- **FR-018**: The updated stat values MUST be visible in the character stats bar (top panel) after equipping or unequipping.

**Persistence**

- **FR-019**: The player's equipped items MUST persist across sessions — when the player logs back in, their equipment slots are restored to the state at logout.

### Key Entities

- **Character Equipment**: The set of items currently worn by a player. Contains up to 7 slots (Helmet, Chestpiece, Left Arm, Right Arm, Greaves, Bracer, Boots), each holding zero or one Item Instance reference. Belongs to one player.
- **Equipment Slot**: A named body location that accepts one specific category or set of item categories. Has a slot type (enum), holds an optional Item Instance reference.
- **Item Instance** *(existing)*: An item in a player's inventory. When equipped, it moves from the inventory pool to an equipment slot.
- **Effective Stats**: Derived values for a player — effective attack and effective defence — computed as base stat plus sum of all equipped item stat contributions. Not stored independently; recalculated on change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can switch between the Equipment and Inventory tabs with a single click, and the transition is immediate (no loading state or delay visible).
- **SC-002**: All 7 equipment slots are visible and correctly labelled on the Equipment tab when opened.
- **SC-003**: A player can successfully equip an item via drag and drop in under 5 seconds from opening the Equipment tab.
- **SC-004**: Player attack and defence stats displayed in the top bar correctly reflect all equipped items after every equip or unequip action, with no refresh required.
- **SC-005**: Slot swap (replacing an equipped item) works correctly in 100% of cases — the displaced item always returns to inventory or the swap is cleanly blocked when inventory is full.
- **SC-006**: The mini-inventory filter in the Equipment tab hides all non-equippable item types (resources, food, heal, tool) in all cases.
- **SC-007**: Equipment state is fully restored after a player logs out and back in — no equipped items are lost between sessions.

## Assumptions

- The existing item category system (from 007-item-inventory) will be extended to include two new categories: **Helmet** and **Chestpiece**, as these are referenced in the equipment slots but not present in the current item type enum. Admin tooling for these new categories is out of scope for this feature but must be accounted for in the data model.
- The Right Arm slot accepts weapon items (any weapon subtype); the Left Arm slot accepts shield items. This mapping follows conventional RPG conventions.
- The Bracer slot is a single slot (one item, not one per arm) following the description's singular usage.
- Greaves represent leg armour (a single slot).
- Base attack and defence values for each character are already tracked by the backend. This feature adds the equipment bonus on top of that base.
- Item drag-and-drop for equipping operates within the Equipment tab only (from mini-inventory to slot, or slot to mini-inventory for unequipping). Players cannot drag directly from the main Inventory tab to an equipment slot; they must be on the Equipment tab.
- The Equipment tab's mini-inventory does not support all inventory actions (e.g., item deletion) — it is a filtered view for equipping and unequipping only.
- Two-handed weapons occupy only the Right Arm slot. When a two-handed weapon is equipped, the Left Arm slot is visually grayed out and non-interactive. Equipping a two-handed weapon while a shield is in Left Arm automatically returns the shield to inventory (blocked only if inventory is full). Equipping a shield while a two-handed weapon is in Right Arm is always blocked.
- Equipped item bonuses stack additively with no diminishing returns in this iteration.
