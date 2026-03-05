# Feature Specification: Monster Combat System

**Feature Branch**: `008-monster-combat`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "Let's implement monsters. Old monsters mechanism can be removed or adapted, no need for backwards compatibility. Monsters can be found while exploring a building, so new action Explore should be introduced in buildings, with possibility to define monsters that can be found in given location and percentage of chance of monster. Eg. in forgotten mines, there is 15% chance to find a monster, and 33% of monster X, 66% of Y and 1% of Z. Other 85% chance is another action, to be added later, or nothing if no other actions are present. Monsters can be added in admin UI, monster has icon (no animations, just an icon that will be displayed when monster combat starts), monsters have attack, defense, hp and each monster can drop items, admin can specify chance, quantity and item from dropdown while creating monster. When player fights a monster, there should be modal window streaming fight, and when won -> exp reward (also configurable by admin), and dropped item if any. If lost fight, there is info and no rewards are granted."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encounter and Fight a Monster (Priority: P1)

A player visits a building that has an Explore action configured (e.g., "Forgotten Mines"). They click Explore. The system rolls a probability check. If a monster is encountered, a combat modal appears showing the monster's icon and the fight plays out round by round in a streaming log. When the fight ends, the player either receives EXP and possibly a dropped item (win) or sees a defeat message with no rewards (loss). The combat modal can then be closed.

**Why this priority**: This is the core player-facing gameplay loop. Without it, the entire feature has no value. All other stories depend on monsters existing and exploration being configured.

**Independent Test**: Can be tested by configuring a building with 100% monster encounter rate, setting up a test monster, entering the building as a player, clicking Explore, and verifying the combat modal appears and resolves correctly.

**Acceptance Scenarios**:

1. **Given** a player is inside a building with Explore action configured, **When** the player clicks Explore, **Then** the system immediately rolls for a monster encounter based on the configured encounter chance.
2. **Given** the encounter roll succeeds, **When** combat begins, **Then** a modal appears showing the monster's icon, name, and a combat log that streams fight rounds one at a time until one side is defeated.
3. **Given** the player wins combat, **When** the modal shows the result, **Then** the player receives the configured EXP reward and any dropped items (based on drop chance roll), and these are applied to the player's character.
4. **Given** the player loses combat, **When** the modal shows the result, **Then** a defeat message is displayed and no EXP or items are granted.
5. **Given** the encounter roll fails (no monster), **When** no other action is available, **Then** nothing happens and the player sees a neutral message indicating nothing was found.

---

### User Story 2 - Admin Creates and Configures a Monster (Priority: P2)

An admin opens the admin panel and navigates to the Monsters section. They create a new monster by providing its name, uploading an icon image, and setting its combat stats (attack, defense, HP) and the EXP reward granted upon defeat. They then add one or more loot entries — each specifying an item from a dropdown, a drop quantity, and a percentage drop chance.

**Why this priority**: Without monsters defined in the system, the player-facing combat cannot function. Admin configuration of monsters is the prerequisite for gameplay.

**Independent Test**: Can be tested entirely in the admin UI: create a monster with valid data, verify it appears in the monster list, verify stats and loot entries are persisted correctly.

**Acceptance Scenarios**:

1. **Given** an admin is on the Monster creation page, **When** they submit a monster with name, icon, attack, defense, HP, and EXP reward, **Then** the monster is saved and appears in the monster list.
2. **Given** an admin is editing a monster, **When** they add a loot entry selecting an item, a drop quantity (e.g., 1–5), and a drop chance percentage (e.g., 25%), **Then** the loot entry is saved and displayed on the monster's detail view.
3. **Given** a monster has multiple loot entries, **When** a player defeats it, **Then** each loot entry is rolled independently against its drop chance; items that pass the roll are added to the player's inventory.
4. **Given** an admin uploads an icon image, **When** the monster is saved, **Then** the icon is stored and displayed in the combat modal when the monster is encountered by a player.

---

### User Story 3 - Admin Configures Building Exploration (Priority: P3)

An admin selects an existing building in the admin panel and adds or edits the Explore action for it. They set an overall encounter chance (e.g., 15%) and compose a monster table by selecting monsters and assigning each a relative weight (e.g., Monster X: 33, Monster Y: 66, Monster Z: 1). The weights are used to determine which monster appears when an encounter is triggered.

**Why this priority**: This connects the monster definitions to the game world. Without it, monsters can exist but cannot be encountered. However, monster creation (P2) must happen first.

**Independent Test**: Can be tested by configuring a building with a known encounter chance and monster table, then repeatedly triggering Explore as a player and verifying the encounter rate and monster distribution match the configured probabilities over multiple attempts.

**Acceptance Scenarios**:

1. **Given** an admin is editing a building, **When** they add an Explore action with a 0–100% encounter chance, **Then** the Explore action appears in the building's action list in the game.
2. **Given** an admin has set an encounter chance of 15%, **When** a player clicks Explore many times, **Then** approximately 15% of attempts result in a monster encounter.
3. **Given** an admin has configured a monster table with weighted entries, **When** an encounter occurs, **Then** the encountered monster is selected according to the configured relative weights (higher-weight monsters appear more frequently).
4. **Given** a building's encounter chance is 15% and no other actions are configured, **When** the 85% non-encounter result occurs, **Then** the player sees a message indicating nothing was found.

---

### Edge Cases

- What happens when a monster's drop chance rolls cause multiple items to drop simultaneously? Each loot entry is evaluated independently; all successful rolls grant their respective items.
- What happens when a monster is deleted while a building's encounter table still references it? The deleted monster is removed from the encounter table automatically; if the table becomes empty, the encounter chance effectively results in nothing.
- What happens when an item referenced in a monster's loot table is deleted? The loot entry is removed or disabled; the monster can still be fought but that loot slot produces nothing.
- What happens if a player closes the combat modal mid-fight? The fight continues to resolve server-side; on reopening (or on next action), the player sees the final outcome. No partial rewards are granted.
- What happens if the monster table weights sum to zero? The encounter roll is treated as no encounter; an admin warning is displayed in the UI.
- What happens when a monster has 0% drop chance on all loot entries? The monster is still defeatable and grants EXP; it simply never drops items.

## Requirements *(mandatory)*

### Functional Requirements

**Monster Management (Admin)**

- **FR-001**: Admins MUST be able to create monsters with a name, icon image, attack value, defense value, HP value, and EXP reward value.
- **FR-002**: Admins MUST be able to upload an icon image for each monster that is displayed during combat.
- **FR-003**: Admins MUST be able to add loot entries to a monster, each specifying an item (selected from a dropdown of existing items), a drop quantity, and a drop chance percentage (0–100).
- **FR-004**: Admins MUST be able to edit and delete monsters and their loot entries.
- **FR-005**: The system MUST prevent deletion of a monster that would leave a building with an empty and non-zero encounter table without warning the admin.

**Building Exploration Configuration (Admin)**

- **FR-006**: Admins MUST be able to add an Explore action to any building, configuring an encounter chance as a percentage (0–100).
- **FR-007**: Admins MUST be able to define a monster encounter table per building, specifying which monsters can appear and their relative weights (positive integers).
- **FR-008**: Admins MUST be able to edit and remove the Explore action and its monster table from any building.
- **FR-009**: The system MUST validate that monster table weights are positive integers and that at least one monster is in the table when the encounter chance is above 0%.

**Exploration Gameplay (Player)**

- **FR-010**: Players MUST see an Explore button in any building that has an Explore action configured.
- **FR-011**: When a player triggers Explore, the system MUST roll against the configured encounter chance to determine whether a monster is encountered.
- **FR-012**: When an encounter occurs, the system MUST select a monster from the building's encounter table using weighted random selection.
- **FR-013**: The combat resolution MUST be calculated server-side before streaming results to the player.

**Combat Modal (Player)**

- **FR-014**: When a monster is encountered, a modal MUST appear displaying the monster's icon, name, and a scrolling combat log.
- **FR-015**: Combat rounds MUST be revealed to the player progressively (streamed one at a time with a short delay), showing each round's action and remaining HP values for both sides.
- **FR-016**: The combat log MUST clearly indicate when the fight ends and whether the player won or lost.
- **FR-017**: Upon player victory, the combat result MUST display the EXP gained and any items dropped, and these MUST be applied to the player's character immediately.
- **FR-018**: Upon player defeat, the combat result MUST display a defeat message and no rewards MUST be granted.
- **FR-019**: The player MUST be able to close the combat modal once the fight has fully resolved.

**Combat Mechanics**

- **FR-020**: Combat MUST be turn-based: player attacks first each round, then the monster attacks.
- **FR-021**: Damage dealt per turn MUST be calculated as attacker's attack minus defender's defense, with a minimum of 1 damage per hit.
- **FR-022**: A fight ends when either the player or monster reaches 0 HP.
- **FR-023**: The player's HP used in combat MUST reflect their current character stats; combat results do NOT permanently modify the player's HP (each fight is self-contained).
- **FR-024**: Each monster loot entry's drop chance MUST be rolled independently; a player can receive multiple items from one fight.

**Legacy Removal**

- **FR-025**: Any existing monster mechanism or data that is superseded by this feature MUST be removed or migrated; no backwards compatibility with the old system is required.

### Key Entities

- **Monster**: A combat entity defined by an admin. Key attributes: name, icon image, attack, defense, HP, EXP reward, list of loot entries. Monsters are global (not tied to a specific building at definition time).
- **MonsterLootEntry**: A child record of a Monster defining what the monster can drop. Attributes: reference to an item definition, drop chance (0–100%), quantity to drop.
- **BuildingExploreConfig**: The configuration for the Explore action on a building. Attributes: reference to building, overall encounter chance percentage, list of monster table entries.
- **MonsterTableEntry**: A child record of BuildingExploreConfig defining which monsters can appear. Attributes: reference to monster, relative weight (positive integer).
- **CombatResult**: A transient record of a completed fight. Attributes: monster encountered, rounds played, outcome (win/loss), EXP granted, items dropped. Used to stream results to the player; not necessarily persisted long-term.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can trigger Explore in a configured building and see a combat encounter within 2 seconds of clicking the button.
- **SC-002**: The combat modal streams each round of a fight with a visible delay between rounds, so a player can follow the action without the result appearing instantaneously.
- **SC-003**: EXP and dropped items are correctly applied to the player's character in 100% of winning encounters, verifiable by checking the character sheet immediately after the combat modal is closed.
- **SC-004**: The monster encounter distribution across 100+ Explore attempts in a building matches the configured weighted probabilities within a ±10% margin, confirming the weighted random selection is correct.
- **SC-005**: An admin can create a fully configured monster (with stats, icon, and loot table) and attach it to a building's Explore action within 3 minutes using the admin UI.
- **SC-006**: Zero EXP or items are applied to the player's character upon a defeat outcome, verifiable by checking the character sheet before and after the fight.
- **SC-007**: All existing monster-related data and code from the prior system is removed; no dead code or orphaned data remains after the migration.

## Assumptions

- **A-001**: The player's combat HP is derived from their existing character stats (e.g., a "max HP" stat). If no such stat exists in the current system, a fixed default HP value will be used for combat.
- **A-002**: Combat is not affected by any player equipment or status effects — only base attack and defense stats are used. Advanced combat mechanics (skills, buffs) are out of scope.
- **A-003**: The "streaming" combat display uses a fixed delay between rounds (e.g., ~800ms per round). The exact timing is an implementation detail.
- **A-004**: A player cannot trigger Explore again while a combat modal is open; the Explore button is disabled until the previous combat is resolved.
- **A-005**: Multiple loot entries per monster can reference the same item; each entry is evaluated separately.
- **A-006**: The Explore action replaces or coexists with other building actions (the slot system from 006-building-actions); if no other actions are defined and no encounter occurs, the player sees a "nothing found" message.
- **A-007**: Monster icons are stored as uploaded image files (similar to how item icons are handled in 007-item-inventory).
- **A-008**: The player's HP is not permanently reduced by losing a combat encounter — defeat is informational only with no lasting penalty. Future features may introduce consequences.
