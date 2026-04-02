# Feature Specification: Character Stat Allocation System

**Feature Branch**: `030-stat-allocation`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Replace automatic level-up stat gains with a manual stat point allocation system using 5 core attributes (Constitution, Dexterity, Strength, Intelligence, Toughness), accessible through a new Trainer NPC."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Level Up and Receive Stat Points (Priority: P1)

A player earns enough XP to level up. Instead of automatically receiving HP/attack/defence increases, the player is notified that they have gained stat points to allocate. The level-up message shows how many unspent points they now have.

**Why this priority**: This is the foundational change — without replacing the automatic stat grants with point-based allocation, no other story functions.

**Independent Test**: Level up a character and verify no stats change automatically, but unspent stat points increase by the correct amount (7 points per level).

**Acceptance Scenarios**:

1. **Given** a character at level 1 with 0 unspent points, **When** the character gains enough XP to reach level 2, **Then** the character receives 7 stat points, and max_hp/attack_power/defence do not change from levelling alone.
2. **Given** a character that levels up from level 3 to level 4, **When** the level-up notification is shown, **Then** the notification displays the new level and total unspent stat points.
3. **Given** a character that gains enough XP for multiple levels at once, **When** levelling occurs, **Then** the character receives 7 points per level gained (e.g., 14 points for 2 levels).

---

### User Story 2 - Allocate Stat Points via Trainer NPC (Priority: P1)

A player visits a building containing a Trainer NPC, clicks the NPC to open dialog, selects "Train", and is presented with a stat allocation modal. The modal shows the 5 core stats (Constitution, Dexterity, Strength, Intelligence, Toughness), current allocated points per stat, the maximum allocatable per stat for the player's level, unspent points available, and a description of what each stat provides. The player distributes points and confirms.

**Why this priority**: This is the primary interaction — without the Trainer NPC and allocation UI, players cannot use their stat points.

**Independent Test**: Create a Trainer NPC in a building, visit it, allocate points, and verify derived stats (HP, attack, defence, etc.) update accordingly.

**Acceptance Scenarios**:

1. **Given** a player with 7 unspent stat points visiting a Trainer NPC, **When** they open the training modal, **Then** they see all 5 stats with current values, max caps per stat, unspent points, and stat descriptions.
2. **Given** a player allocating 5 points to Constitution and 2 to Dexterity, **When** they confirm, **Then** unspent points decrease by 7, Constitution and Dexterity increase by 5 and 2 respectively, and derived combat stats (HP, attack, crit chance, evasion) update.
3. **Given** a player trying to allocate more points to a stat than the per-level cap allows, **When** they attempt to exceed the cap, **Then** the UI prevents the allocation and shows the maximum allowed.
4. **Given** a player with 0 unspent points, **When** they open the training modal, **Then** they can view stats and descriptions but cannot allocate (no points available).

---

### User Story 3 - Stat-to-Combat Derivation (Priority: P1)

When the player allocates points to the 5 core stats, their derived combat stats update according to clear formulas. These derived stats are used in all combat calculations (monster combat, boss combat, arena PvP).

**Why this priority**: The stat derivation is the mechanical backbone — without it, allocating points has no gameplay effect.

**Independent Test**: Allocate points to each stat individually and verify the correct derived stat changes using combat encounters.

**Acceptance Scenarios**:

1. **Given** a player allocates 1 point to Constitution, **Then** their max HP increases and their attack power increases by the defined amounts.
2. **Given** a player allocates 1 point to Intelligence, **Then** their max mana increases by the defined amount.
3. **Given** a player allocates 1 point to Dexterity, **Then** their crit chance and evasion (dodge chance) increase by the defined amounts.
4. **Given** a player allocates 1 point to Toughness, **Then** their defence increases by the defined amount.
5. **Given** a player allocates 1 point to Strength, **Then** their attack power and critical damage multiplier increase by the defined amounts.
6. **Given** a player enters combat after allocating stats, **Then** combat calculations use the new derived values.

---

### User Story 4 - View Stat Breakdown (Priority: P2)

A player wants to understand their character's stats in detail. The training modal shows: base stats from class, bonus from allocated points, bonus from equipment, and final effective values.

**Why this priority**: Important for player understanding and informed decision-making, but the system works without this detail view.

**Independent Test**: Open the training modal with some allocated points and equipped items, verify the breakdown shows correct values from each source.

**Acceptance Scenarios**:

1. **Given** a player with allocated stat points and equipped items, **When** they view the stat breakdown, **Then** each derived stat shows contributions from base class, allocated attributes, and equipment separately.
2. **Given** a player hovering/tapping a stat name, **When** the tooltip or info section appears, **Then** it describes what the stat does and the conversion rate (e.g., "1 Constitution = +X HP, +Y Attack").

---

### User Story 5 - Admin Manages Trainer NPCs (Priority: P2)

An admin creates/configures Trainer NPCs via the admin panel, assigns them to buildings, and toggles the trainer role on/off — following the same pattern as existing NPC roles (crafter, quest giver, disassembler).

**Why this priority**: Needed for content management but can be worked around during development by directly seeding Trainer NPCs in the database.

**Independent Test**: In the admin panel, create an NPC, toggle the "is_trainer" flag, assign to a building, then verify a player can interact with them in-game.

**Acceptance Scenarios**:

1. **Given** an admin in the NPC manager, **When** they toggle the "Trainer" checkbox on an NPC, **Then** the NPC gains the trainer role and appears with training dialog in-game.
2. **Given** a Trainer NPC assigned to a building, **When** a player enters that building, **Then** the NPC appears with a "Train" dialog option alongside any other roles.

---

### User Story 6 - Migration of Existing Characters (Priority: P1)

When the system updates, all existing characters must be properly migrated. Their auto-granted stats are removed (reset to class base values at level 1), and they receive retroactive unspent stat points based on their current level.

**Why this priority**: Without migration, existing characters would have both old auto-stats and the new system, breaking balance.

**Independent Test**: Run migration on a database with characters at various levels, verify each has correct base stats and unspent points.

**Acceptance Scenarios**:

1. **Given** an existing level 5 Warrior (base_hp=120, base_attack=15, base_defence=12), **When** migration runs, **Then** the character has max_hp=120, attack_power=15, defence=12, and 28 unspent stat points (7 × 4).
2. **Given** an existing level 1 character, **When** migration runs, **Then** the character has base class stats and 0 unspent stat points.
3. **Given** a character with current_hp above the new max_hp after reset, **When** migration runs, **Then** current_hp is capped at the new max_hp.

---

### Edge Cases

- What happens if a player has unspent points and levels up again? Points accumulate (e.g., 7 from level 2 + 7 from level 3 = 14 total if none spent).
- What happens if stat allocation would exceed integer limits? Stats are capped at reasonable system maximums.
- What happens if a player disconnects mid-allocation? No points are spent until the player confirms — the operation is atomic.
- What happens to existing characters who already have auto-granted stats? Migration resets to class base stats and grants retroactive unspent points.
- What if a player is in combat and tries to allocate stats? The Trainer NPC interaction is blocked while in combat (consistent with other NPC interactions).
- What if an NPC has both is_trainer and other roles (is_crafter, is_quest_giver)? All dialog options appear — roles are independent and additive.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace automatic stat grants on level-up with a fixed allocation of 7 stat points per level gained.
- **FR-002**: System MUST support 5 core attributes: Constitution, Dexterity, Strength, Intelligence, and Toughness.
- **FR-003**: Each core attribute MUST have a maximum allocatable cap per level equal to 10 points per level (i.e., at level N, max per stat = 10 × (N − 1)).
- **FR-004**: Players MUST receive 7 points per level, representing 70% of one stat's per-level maximum of 10.
- **FR-005**: System MUST derive combat stats from core attributes:
  - Constitution → max HP + attack power
  - Strength → attack power + critical damage multiplier
  - Intelligence → max mana
  - Dexterity → crit chance + evasion (dodge chance)
  - Toughness → defence
- **FR-006**: System MUST provide a Trainer NPC role (`is_trainer` flag) following the existing NPC role pattern.
- **FR-007**: Players MUST be able to open a stat allocation modal by selecting "Train" from a Trainer NPC's dialog options.
- **FR-008**: The stat allocation modal MUST display: all 5 attributes with current allocated values, per-stat cap for current level, unspent points, and a description of each stat's effect.
- **FR-009**: System MUST prevent allocation beyond the per-stat cap or beyond available unspent points.
- **FR-010**: Stat point allocation MUST be atomic — the chosen allocation is applied all or nothing on confirmation. Players MAY allocate a subset of their unspent points and keep the remainder for later.
- **FR-011**: Existing characters MUST be migrated: reset to class base stats, grant retroactive unspent points (7 × (level − 1)).
- **FR-012**: The level-up notification MUST include the number of stat points gained and total unspent points.
- **FR-013**: Equipment bonuses MUST continue to stack additively on top of attribute-derived stats.
- **FR-014**: Admin panel MUST allow toggling the `is_trainer` role on NPCs, following the existing NPC role management pattern.
- **FR-015**: The StatsBar (top bar UI) MUST reflect the updated derived stats after allocation in real-time.
- **FR-016**: The StatsBar MUST show a notification badge when the player has unspent stat points (> 0). The badge is dismissible but reappears when new points are earned.

### Key Entities

- **Core Attributes**: The 5 allocatable stats (Constitution, Dexterity, Strength, Intelligence, Toughness) tracked per character with current allocated values.
- **Stat Points**: Unspent allocation currency earned on level-up (7 per level), stored per character.
- **Trainer NPC**: An NPC role enabling the stat allocation dialog, identified by an `is_trainer` flag.
- **Attribute Derivation**: Mapping from core attributes to derived combat stats (HP, attack, defence, mana, crit, evasion).

## Clarifications

### Session 2026-04-02

- Q: What does Strength provide as a derived combat stat? → A: Attack power + critical damage multiplier
- Q: Can players allocate only some of their unspent points and keep the rest? → A: Yes, spend any subset — remainder stays unspent
- Q: Should the StatsBar show an unspent stat points indicator? → A: Notification badge when unspent > 0, dismissible, reappears on new points

## Assumptions

- The 7-points-per-level rate and 10-point-per-stat-per-level cap are fixed for all classes. Class differentiation comes from different base stats, not different point allocations.
- "Trained by other methods" (the remaining 3 points worth of stats per level) refers to future systems (quests, items, events) and is out of scope for this feature.
- Strength is a separate stat from Constitution to give players more granular control — Constitution provides both HP and a smaller attack bonus; Strength provides attack power and increases the critical damage multiplier.
- Exact stat derivation formulas (HP per Constitution point, etc.) will be defined during implementation planning based on current balance values as reference.
- The character class system (Warrior/Mage/Ranger) remains — classes define base stats at level 1 but no longer grant per-level bonuses.
- Max level remains 7 (current cap). At max level, a player has 42 total stat points (7 × 6 levels).
- Stat point allocation is permanent — there is no respec mechanic in this feature (could be added later).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can allocate stat points within 30 seconds of opening the Trainer dialog — the UI is intuitive and responsive.
- **SC-002**: 100% of existing characters are correctly migrated with appropriate unspent points and reset base stats after the migration runs.
- **SC-003**: All combat encounters (monster, boss, arena) correctly use attribute-derived stats — no combat calculation regressions.
- **SC-004**: The stat allocation modal clearly communicates each attribute's effect — players can make informed decisions without external documentation.
- **SC-005**: Level-up no longer automatically changes HP, attack, or defence — only stat points are granted.
- **SC-006**: The Trainer NPC follows the same creation, assignment, and management workflow as existing NPC roles — no new admin workflows needed.
