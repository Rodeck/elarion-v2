# Feature Specification: Weapon Attributes

**Feature Branch**: `033-weapon-attributes`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Add three new weapon attributes: crit strike chance %, armor penetration %, and additional attacks count. Admin can assign these to items, game UI displays them, combat system uses them, and character stats panel shows aggregated totals."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Configures Weapon Attributes (Priority: P1)

An admin opens the item editor and creates or edits an equippable item. They can set three numeric attributes: crit strike chance (%), armor penetration (%), and additional attacks (count). These values are saved and displayed in the item list alongside existing stats like ATK and DEF.

**Why this priority**: Without admin tooling to set the values, no other part of the feature can function.

**Independent Test**: Can be fully tested by creating an item in the admin panel, setting all three attributes, saving, and verifying the values persist on reload.

**Acceptance Scenarios**:

1. **Given** the admin opens the item modal for a weapon, **When** they enter crit chance 5%, armor penetration 10%, additional attacks 1, **Then** all three values are saved and displayed in the item list.
2. **Given** the admin edits a non-equippable item (e.g., food, resource), **When** they open the item modal, **Then** the three weapon attribute fields are hidden.
3. **Given** the admin sets armor penetration to 0 on a weapon, **When** they save, **Then** the value is stored as 0 (not null).

---

### User Story 2 - Player Sees Weapon Attributes in Character Stats (Priority: P1)

When a player views the character stats panel, aggregated weapon attribute totals from all equipped items are displayed: total crit chance, total armor penetration, and total additional attacks.

**Why this priority**: Players need to see and understand the attributes to make meaningful gear decisions.

**Independent Test**: Equip a weapon with crit chance 5%, verify the stats panel shows +5% crit chance from gear. Equip a second item with 3% crit chance, verify the total shows 8%.

**Acceptance Scenarios**:

1. **Given** a player has a dagger equipped with 5% crit chance, **When** they view their character stats, **Then** crit chance shows the base value plus 5% gear bonus.
2. **Given** a player has a staff with 10% armor penetration equipped, **When** they view their character stats, **Then** armor penetration shows 10%.
3. **Given** a player has no items with additional attacks, **When** they view their character stats, **Then** additional attacks shows 0 or is omitted.
4. **Given** a player equips multiple items with crit chance, **When** they view stats, **Then** the values are summed additively.

---

### User Story 3 - Combat Uses Weapon Attributes (Priority: P2)

During combat, the three weapon attributes affect gameplay. Crit chance increases the probability of a critical strike. Armor penetration reduces the effective defense of the target. Additional attacks grant bonus hits at the start of combat before normal combat begins.

**Why this priority**: The attributes need to exist and be visible before combat integration matters, but this is the core gameplay payoff.

**Independent Test**: Start combat with a weapon that has 100% crit chance and verify every hit crits. Start combat with 2 additional attacks and verify 2 bonus hits occur before the first normal combat round.

**Acceptance Scenarios**:

1. **Given** a player has 100% crit chance (for testing), **When** they attack, **Then** every hit is a critical strike dealing bonus damage.
2. **Given** a player has 15% armor penetration and attacks a monster with 100 defense, **When** damage is calculated, **Then** the monster's effective defense is 85 for that attack.
3. **Given** a player has 2 additional attacks, **When** combat starts, **Then** the player deals 2 bonus hits before the first normal combat round begins.
4. **Given** a player has 0 additional attacks, **When** combat starts, **Then** combat proceeds normally with no bonus hits.

---

### User Story 4 - Attribute Values in Item Tooltips (Priority: P3)

When a player inspects an item in the inventory, the detail view shows the weapon attributes with clear labels (e.g., "+5% Crit Chance", "10% Armor Penetration", "+1 Additional Attacks").

**Why this priority**: Enhances item comparison and player understanding, but core functionality works without it.

**Independent Test**: View a weapon with all three attributes set, verify all three appear with correct values and labels.

**Acceptance Scenarios**:

1. **Given** a weapon has crit chance 5%, armor penetration 0%, additional attacks 1, **When** the player views the item, **Then** only non-zero attributes are shown (crit chance and additional attacks).
2. **Given** a weapon has no weapon attributes set (all zero/null), **When** the player views the item, **Then** no weapon attribute lines appear.

---

### Edge Cases

- What happens when crit chance exceeds 100%? Capped at 100%.
- What happens when armor penetration exceeds 100%? Capped at 100% (target defense cannot go below 0).
- What happens when additional attacks is 0 or not set? No bonus hits, combat proceeds normally.
- What happens when multiple items contribute to the same attribute? Values are summed additively (matching existing behavior for crit chance and dodge chance).
- Can non-weapon items (e.g., rings, amulets) have these attributes? Yes — any equippable item category can have them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store armor penetration (0–100%) and additional attacks (0–10) per item definition.
- **FR-002**: System MUST allow admins to set crit chance, armor penetration, and additional attacks when creating or editing equippable items.
- **FR-003**: System MUST hide the three weapon attribute fields for non-equippable item categories (resource, food, heal, tool, skill_book).
- **FR-004**: System MUST aggregate weapon attributes from all equipped items additively (sum across all slots).
- **FR-005**: System MUST cap crit chance at 100% and armor penetration at 100% after aggregation.
- **FR-006**: System MUST apply armor penetration during damage calculation by reducing target's effective defense by the penetration percentage. Applies in all combat types (monsters, bosses, PvP).
- **FR-007**: System MUST execute additional attacks as bonus hits at the start of combat before the first normal round. Bonus hits always deal normal (non-crit) damage.
- **FR-008**: System MUST display aggregated weapon attributes in the character stats panel.
- **FR-009**: System MUST include weapon attributes in item detail views, showing only non-zero values.
- **FR-010**: Crit chance already exists in the database; the system MUST reuse the existing column rather than creating a duplicate.

### Key Entities

- **Item Definition**: Extended with `armor_penetration` (percentage, 0–100) and `additional_attacks` (integer, 0–10). `crit_chance` already exists.
- **Derived Combat Stats**: Extended to include `armorPenetration` and `additionalAttacks` aggregated from all equipped items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can set all three weapon attributes on any equippable item and values persist correctly across save/reload cycles.
- **SC-002**: Players see aggregated crit chance, armor penetration, and additional attacks in the character stats panel reflecting all equipped gear.
- **SC-003**: Armor penetration correctly reduces target effective defense during combat damage calculation.
- **SC-004**: Additional attacks produce the correct number of bonus hits at the start of every combat encounter.
- **SC-005**: Item detail views display non-zero weapon attributes with clear labels and formatting.

## Clarifications

### Session 2026-04-03

- Q: Should additional attacks be eligible for critical strikes? → A: No — additional attacks always deal normal (non-crit) damage.
- Q: Do additional attacks and armor penetration apply in all combat types (monsters, bosses, PvP)? → A: Yes — apply uniformly across all combat types.

## Assumptions

- Crit chance is already implemented in the database (`crit_chance` SMALLINT 0–100) and in combat computation. This feature reuses it and ensures admin/UI parity.
- Armor penetration is a flat percentage reduction applied to the target's defense stat before damage calculation.
- Additional attacks deal normal attack damage (same formula as regular hits), are not critical-eligible, and occur before the first combat round.
- Values default to 0 when not specified.
- The equippable item categories are: weapon, shield, helmet, chestplate, greaves, bracer, boots, ring, amulet.
