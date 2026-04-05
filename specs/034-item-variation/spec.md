# Feature Specification: Item Bonus Variation

**Feature Branch**: `034-item-variation`  
**Created**: 2026-04-05  
**Status**: Clarified  
**Input**: User description: "Add random item bonus variation for weapons and armor — staves/daggers/bows randomize built-in bonuses, weapons and armor get up to +20% attack/armor bonus"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Randomized Built-in Bonuses for Special Weapons (Priority: P1)

When a player receives a dagger, bow, or staff through any means (combat loot, crafting, quest reward, fishing, expedition, marketplace purchase, admin grant, etc.), the item's special bonus is randomly rolled within a defined range. For example, a dagger with a base 5% crit chance might roll anywhere from 0% to 5% crit chance. Each individual item instance is unique.

**Why this priority**: This is the core mechanic — without per-instance bonus randomization, no item variation exists. Daggers, bows, and staves have distinct built-in bonuses (crit chance, additional attacks, and armor penetration respectively) that currently apply at fixed values from the item definition.

**Independent Test**: Grant the same dagger item definition to a player 10 times and verify that the crit_chance values vary across instances (not all identical to the definition's base value).

**Acceptance Scenarios**:

1. **Given** a dagger definition with crit_chance=5, **When** the dagger is granted to a player, **Then** the inventory item has a crit_chance between 0 and 5 (inclusive), randomly determined.
2. **Given** a bow definition with additional_attacks=4, **When** the bow is granted to a player, **Then** the inventory item has additional_attacks between 0 and 4 (inclusive integer), randomly determined.
3. **Given** a staff definition with armor_penetration=10, **When** the staff is granted to a player, **Then** the inventory item has armor_penetration between 0 and 10 (inclusive), randomly determined.
4. **Given** any item acquisition method (crafting, loot, marketplace, quest, admin command, expedition, fishing, gathering, night encounter), **When** a dagger/bow/staff is granted, **Then** the randomization applies consistently.

---

### User Story 2 - Randomized Attack/Armor Bonus for Standard Weapons and Armor (Priority: P1)

When a player receives a one-handed weapon, two-handed weapon, or any armor piece (helmet, chestplate, shield, greaves, bracer, boots), the item gets a random bonus of 0% to +20% on its primary stat (attack for weapons, defence for armor). This bonus is applied on top of the base definition value and stored per-instance.

**Why this priority**: Equally core to the feature — covers the majority of equippable items and creates meaningful variation in the most common gear.

**Independent Test**: Grant the same one-handed sword (attack=10) to a player 10 times and verify attack values range from 10 to 12 (base 10 + up to 20% = up to 12).

**Acceptance Scenarios**:

1. **Given** a one-handed weapon with attack=10, **When** it is granted to a player, **Then** the inventory item has attack between 10 and 12 (base + 0-20% bonus, rounded down).
2. **Given** a two-handed weapon with attack=20, **When** it is granted to a player, **Then** the inventory item has attack between 20 and 24.
3. **Given** a chestplate with defence=15, **When** it is granted to a player, **Then** the inventory item has defence between 15 and 18.
4. **Given** a shield with defence=8, **When** it is granted to a player, **Then** the inventory item has defence between 8 and 9 (8 * 1.2 = 9.6, rounded down to 9).
5. **Given** any item acquisition method, **When** a weapon or armor piece is granted, **Then** the bonus applies consistently.

---

### User Story 3 - Combat Stats Reflect Per-Instance Bonuses (Priority: P1)

When a player equips an item with randomized bonuses, their combat stats correctly reflect the specific instance's values rather than the item definition's base values.

**Why this priority**: Without this, the randomization has no gameplay effect — combat must use per-instance values.

**Independent Test**: Equip a dagger with rolled crit_chance=3 (from a base of 5) and verify character combat stats show +3 crit chance, not +5.

**Acceptance Scenarios**:

1. **Given** a player equips a dagger with instance crit_chance=3, **When** combat stats are computed, **Then** the crit chance contribution from this item is 3, not the definition's base 5.
2. **Given** a player equips a sword with instance attack=12 (from base 10 + 20% bonus), **When** combat stats are computed, **Then** the attack contribution is 12.

---

### User Story 4 - Item Display Shows Actual Instance Values (Priority: P2)

When a player views an item in their inventory or equipment panel, the displayed stats reflect the specific instance's rolled values, not the base definition values.

**Why this priority**: Players need to see and compare item quality to make meaningful equipment decisions.

**Independent Test**: View two daggers in inventory — one with crit_chance=2 and one with crit_chance=5 — and verify each shows its own value.

**Acceptance Scenarios**:

1. **Given** a player has two daggers with different rolled crit_chance values, **When** viewing inventory, **Then** each dagger shows its specific crit_chance.
2. **Given** a player has a sword with attack=12 (from base 10 + bonus), **When** viewing the item, **Then** attack displays as 12.

---

### User Story 5 - Marketplace Items Retain Rolled Values (Priority: P2)

When an item is listed and sold on the player marketplace, the buyer receives the exact same instance with the same rolled bonuses.

**Why this priority**: Marketplace trading of items with varying quality creates an economy around item rolls — higher-rolled items are more valuable.

**Independent Test**: Seller lists a dagger with crit_chance=5 on marketplace; buyer purchases it and receives a dagger with crit_chance=5.

**Acceptance Scenarios**:

1. **Given** a player lists a sword with instance attack=12 on the marketplace, **When** another player buys it, **Then** the buyer receives the item with attack=12.
2. **Given** a player lists a dagger with crit_chance=2, **When** it is purchased, **Then** the buyer receives crit_chance=2 (not a fresh random roll).

---

### User Story 6 - Visual Quality Indicators (Priority: P2)

When a player views an item, its rolled bonus quality is immediately apparent through both a named quality tier label (e.g., "Poor", "Fine", "Superior") and color-coded stat values. This lets players quickly assess and compare items without mentally calculating percentages.

**Why this priority**: Visual indicators transform raw numbers into intuitive quality signals, making the variation system feel rewarding and easy to use.

**Independent Test**: View two swords of the same type — one with a low roll and one with a high roll — and verify they display different tier labels and stat colors.

**Acceptance Scenarios**:

1. **Given** a sword with a low attack roll (near base), **When** viewing the item, **Then** the attack value is displayed in a muted color and the item shows a low-tier label (e.g., "Poor").
2. **Given** a sword with a max attack roll (base + 20%), **When** viewing the item, **Then** the attack value is displayed in a premium color and the item shows a high-tier label (e.g., "Superior").
3. **Given** items across all quality tiers, **When** viewing them side by side, **Then** the tier labels and colors are visually distinct and consistently applied.

---

### Edge Cases

- What happens when the base stat is 0? The rolled value is 0 — no negative bonuses possible.
- What happens with rings and amulets? They are accessories, not weapons or armor — their stats remain fixed at definition values.
- What happens when the +20% bonus rounds to 0 (e.g., base attack=1, 20% = 0.2)? Floor rounding means 0 bonus — the item stays at base value.
- What happens with stackable items (resources, food, heals)? Stackable items never have per-instance bonuses.
- What happens when disassembling an item with bonuses? Bonuses are lost — disassembly yields standard components based on the item definition.
- What happens with existing items already in player inventories? Existing items retain their current stats (effectively the maximum/base value). Only newly granted items get randomized.
- What happens with wands? Wands randomize their mana-related bonuses (max_mana, mana_on_hit, mana_regen) within 0 to base value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store per-instance bonus values for each non-stackable equippable item when it is created in a player's inventory.
- **FR-002**: For daggers, the system MUST randomize `crit_chance` within the range 0 to the definition's base value (inclusive integer) at grant time.
- **FR-003**: For bows, the system MUST randomize `additional_attacks` within the range 0 to the definition's base value (inclusive integer) at grant time.
- **FR-004**: For staves, the system MUST randomize `armor_penetration` within 0 to definition base value at grant time.
- **FR-005**: For wands, the system MUST randomize `max_mana`, `mana_on_hit`, and `mana_regen` each within 0 to their respective definition base values at grant time.
- **FR-006**: For one-handed weapons, two-handed weapons, and armor (helmet, chestplate, shield, greaves, bracer, boots), the system MUST apply a random bonus of 0% to +20% to the primary stat (attack for weapons, defence for armor) at grant time. Special weapon subtypes (dagger, bow, staff, wand) are excluded from this bonus — their variation comes only from their category-specific bonus (FR-002 through FR-005).
- **FR-007**: The +20% bonus calculation MUST use floor rounding (round down to nearest integer).
- **FR-008**: The randomization MUST use a distribution weighted toward lower values (average ~30% of max), making high rolls rare and desirable.
- **FR-009**: The randomization MUST occur at the single point where items enter a player's inventory, ensuring consistent behavior across all 10+ acquisition sources.
- **FR-010**: Combat stat computation MUST use per-instance bonus values, not item definition base values.
- **FR-011**: Item display in inventory, equipment panels, and marketplace listings MUST show per-instance values.
- **FR-012**: Each item with randomized bonuses MUST display a quality tier label derived from its roll quality relative to the possible range (e.g., "Poor", "Common", "Fine", "Superior", or similar tiered naming).
- **FR-013**: Randomized stat values MUST be color-coded based on roll quality (e.g., muted color for low rolls, premium color for high rolls), visually distinct across tiers.
- **FR-014**: Marketplace transactions MUST preserve per-instance bonus values — no re-rolling on purchase.
- **FR-015**: Items with a base stat of 0 MUST roll 0 (no negative values possible).
- **FR-016**: Existing items in player inventories MUST continue to function with their current definition-based stats.

### Key Entities

- **Item Definition**: The template/blueprint for an item. Contains base stat values that represent the maximum possible roll for special weapons, or the base value for the +20% range. Unchanged by this feature.
- **Inventory Item Instance**: A specific item owned by a player. Now stores per-instance bonus values that may differ from the definition's base values. Values are determined at creation time and never change afterward.
- **Bonus Roll**: The randomization event at item grant time. For special weapons (dagger/bow/staff/wand), rolls category-specific bonuses within 0 to base. For standard weapons/armor, rolls a 0-20% bonus on the primary stat.

## Clarifications

### Session 2026-04-05

- Q: What random distribution should be used for bonus rolls? → A: Weighted toward lower values (average ~30% of max); high rolls are rare.
- Q: Do special weapons (dagger/bow/staff/wand) also get the +20% attack bonus? → A: No, special bonus only; their attack stays at base definition value.
- Q: Should items display a visual quality indicator beyond raw numbers? → A: Both color-coded stat values and a named quality tier label (e.g., "Poor", "Fine", "Superior").
- Q: Should admins be able to force specific roll values when granting items? → A: No, admin grants are randomized like all other sources.

## Assumptions

- The +20% bonus for weapons/armor is additive on the base definition value (e.g., base 10 attack → max 12 attack).
- Daggers randomize `crit_chance`. Bows randomize `additional_attacks`. Staves randomize `armor_penetration`. Wands randomize mana stats.
- Rings and amulets are excluded — they are accessories, not weapons or armor.
- The item definition values continue to represent the maximum roll for special weapons and the base for the +20% range.
- Stackable items (resources, food, heals, skill books) are never randomized.
- The feature does not retroactively change existing inventory items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every newly granted dagger, bow, or staff has per-instance bonus values that vary from the definition base — verified by granting 20+ instances and observing statistical variation.
- **SC-002**: Every newly granted weapon or armor piece has attack/defence within the expected 100-120% range of its base value.
- **SC-003**: Combat outcomes reflect per-instance item quality — a player with a max-rolled weapon deals more damage than one with a min-rolled weapon of the same type.
- **SC-004**: Players can visually distinguish item quality when comparing two items of the same definition in their inventory.
- **SC-005**: Marketplace item transfers preserve exact per-instance values with zero data loss.
- **SC-006**: All 10+ item acquisition paths produce correctly randomized items without exception.
