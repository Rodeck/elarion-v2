# Feature Specification: Squire System Overhaul

**Feature Branch**: `022-squire-overhaul`
**Created**: 2026-03-24
**Status**: Draft
**Input**: Overhaul the squire system from a single hardcoded squire to a collectible system with inventory slots, ranked progression, expedition power bonuses, NPC-based dismissal, and agent command support for squire content creation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Obtain and Manage Squires (Priority: P1)

A player acquires squires through various gameplay activities — looting monsters, gathering resources, exploring, or completing quests. Each obtained squire occupies one of the player's squire slots. The player can view their squire roster showing each squire's name, icon, rank, and power level.

**Why this priority**: Core mechanic — without squire acquisition and inventory, no other squire features work.

**Independent Test**: Can be tested by having a monster drop a squire on kill and verifying it appears in the player's squire roster.

**Acceptance Scenarios**:

1. **Given** a player defeats a monster configured to drop a squire, **When** the loot is awarded, **Then** the squire is added to the player's squire roster with its defined name, icon, rank, and power level.
2. **Given** a player has 2 of 2 unlocked slots filled, **When** a squire drop occurs, **Then** the squire is not awarded and the player sees a message that their squire roster is full.
3. **Given** a player has 3 of 5 total slots with 4 unlocked, **When** a squire drop occurs, **Then** the squire is added to the next available slot.
4. **Given** a player completes a quest with a squire reward, **When** rewards are granted, **Then** the squire appears in the player's roster.
5. **Given** a player performs a gathering action configured to yield a squire, **When** gathering completes, **Then** the squire is added to the roster (if slots available).

---

### User Story 2 - Send Squire on Expedition (Priority: P1)

A player visits a building with an expedition action and chooses which of their idle squires to send. The squire's power level affects the expedition yield — a max-rank squire doubles the base rewards. The player selects a duration and dispatches the chosen squire.

**Why this priority**: Expeditions are the primary squire interaction; choosing which squire to send is the core gameplay loop.

**Independent Test**: Can be tested by assigning two squires with different power levels, sending each on the same expedition, and verifying reward differences.

**Acceptance Scenarios**:

1. **Given** a player with multiple idle squires visits an expedition building, **When** the expedition panel opens, **Then** the player sees a list of their idle squires with name, icon, rank, and power level to choose from.
2. **Given** a player selects a squire with 50% power bonus and a 1-hour expedition, **When** viewing estimated rewards, **Then** the displayed rewards reflect a 50% increase over base values.
3. **Given** a player has one squire idle and one on expedition, **When** the expedition panel opens, **Then** only the idle squire is selectable.
4. **Given** a player has no idle squires, **When** the expedition panel opens, **Then** the player sees a message that no squires are available and cannot dispatch.

---

### User Story 3 - Admin Creates and Manages Squire Definitions (Priority: P1)

An admin defines squire templates in the admin panel — setting name, icon, and power level. These definitions serve as blueprints for squires that players can obtain. Squire definitions can then be assigned as monster loot, gathering drops, or quest rewards.

**Why this priority**: Without admin-defined squire templates, no squires can enter the game economy.

**Independent Test**: Can be tested by creating a squire definition in the admin panel and verifying it appears in loot configuration options.

**Acceptance Scenarios**:

1. **Given** an admin opens the squire management section, **When** they create a new squire definition with name, icon upload, and power level, **Then** the definition is saved and available for use in loot tables, quest rewards, and gathering drops.
2. **Given** an admin edits an existing squire definition, **When** they change the power level, **Then** existing player-owned squires of that type reflect the updated power level.
3. **Given** an admin views the rank table, **When** they see the 20 ranks, **Then** each rank shows its name and the corresponding level.

---

### User Story 4 - Squire Rank Display (Priority: P2)

Each squire has a level (1–20) that is displayed to the player as a named rank rather than a number. Ranks progress from humble origins (e.g., "Peasant") through nobility. The rank communicates the squire's progression in a thematic, immersive way.

**Why this priority**: Enhances immersion and differentiates squires beyond raw numbers, but the system functions without it.

**Independent Test**: Can be tested by obtaining squires of different levels and verifying the correct rank name displays instead of a number.

**Acceptance Scenarios**:

1. **Given** a player obtains a level 1 squire, **When** viewing the squire roster, **Then** the squire displays rank "Peasant" (not "Level 1").
2. **Given** a player has squires at levels 5, 10, and 20, **When** viewing the roster, **Then** each displays its corresponding rank name.
3. **Given** the rank table defines 20 named ranks, **When** any squire is displayed anywhere in the game, **Then** the rank name is shown instead of the numeric level.

---

### User Story 5 - Dismiss Squire via NPC (Priority: P2)

A player visits a designated NPC and selects the dialog option "I want to dismiss a squire." The player then chooses which squire to dismiss from a list of eligible squires (not currently on expedition). A confirmation dialog appears, and upon confirming, the squire is permanently removed and the slot is freed.

**Why this priority**: Slot management is essential once players fill their roster, but only becomes critical after acquisition works.

**Independent Test**: Can be tested by filling squire slots, visiting the dismissal NPC, and confirming a squire is removed and the slot becomes available.

**Acceptance Scenarios**:

1. **Given** a player with 2 squires (1 idle, 1 on expedition) talks to the dismissal NPC and selects "I want to dismiss a squire", **When** the squire list appears, **Then** only the idle squire is shown as dismissable.
2. **Given** a player selects a squire to dismiss, **When** the confirmation dialog appears and the player confirms, **Then** the squire is permanently removed and the slot count decreases by one.
3. **Given** a player selects a squire to dismiss, **When** the confirmation dialog appears and the player cancels, **Then** nothing changes and the dialog closes.
4. **Given** a player has no idle squires (all on expedition), **When** they select "I want to dismiss a squire", **Then** they see a message that no squires are available for dismissal.

---

### User Story 6 - Squire Slot System (Priority: P3)

Players start with 5 total squire slots but only 2 are unlocked. The roster UI shows all 5 slots — filled, empty-unlocked, and locked — so players understand the progression potential. Additional slots become available through future game progression mechanics.

**Why this priority**: The slot cap matters for balance but the unlock mechanism can be added later; the initial 2-slot limit is sufficient for launch.

**Independent Test**: Can be tested by verifying a new character has 2 unlocked slots and cannot exceed that limit.

**Acceptance Scenarios**:

1. **Given** a new character is created, **When** viewing the squire roster, **Then** 2 of 5 slots are shown as unlocked and the remaining 3 are visually locked.
2. **Given** a player has 2 squires in 2 unlocked slots, **When** a squire acquisition event occurs, **Then** the squire is not granted and a "roster full" message appears.
3. **Given** a player's unlocked slot count increases (via future mechanic), **When** viewing the roster, **Then** the newly unlocked slot is available for use.

---

### User Story 7 - Agent Commands for Squire Content Creation (Priority: P2)

An agent (Claude Code via the game-entities skill) can create and manage squire content through commands. This includes creating squire definitions, uploading squire icons, adding squires as monster loot drops, configuring squires as quest rewards, and adding squires as gathering event drops. These commands follow the same pattern as existing game-entities commands (create-item, create-monster-loot, create-quest, etc.).

**Why this priority**: Enables rapid game content population and iteration by agents, but the admin panel UI (US-3) provides the same capabilities manually. Agent commands accelerate content creation workflows.

**Independent Test**: Can be tested by running the `create-squire` command and verifying the squire definition appears in the admin panel and is available as a loot/reward option.

**Acceptance Scenarios**:

1. **Given** an agent runs the `create-squire` command with name, power level, and level, **When** the command executes, **Then** a new squire definition is created and a success response with the squire definition ID is returned.
2. **Given** an agent runs `upload-squire-icon` with a squire definition ID and icon file path, **When** the command executes, **Then** the icon is uploaded and associated with the squire definition.
3. **Given** an agent runs `create-monster-squire-loot` with a monster ID, squire definition ID, drop chance, and squire level, **When** the command executes, **Then** the squire is added to the monster's loot table with the specified drop parameters.
4. **Given** an agent runs `create-quest` with a reward of type "squire" including a squire definition ID and level, **When** the quest is created, **Then** the squire reward is configured and granted upon quest completion.
5. **Given** an agent provides an invalid squire definition ID in any command, **When** the command executes, **Then** the command fails with a clear validation error message.
6. **Given** an agent adds a squire as a gathering event drop with type "squire", squire definition ID, level, and weight, **When** gathering triggers that event, **Then** the player receives the squire (if roster has space).

---

### Edge Cases

- What happens when a squire drop occurs during combat and roster is full? The squire is not awarded; a message informs the player their squire roster is full.
- What happens to existing characters' hardcoded squires after migration? The legacy squire is migrated as a level 1 squire of a default squire definition, preserving the original name.
- What if admin tries to delete a squire definition that players already own? Deletion is blocked; admin can only deactivate the definition to hide it from future drops.
- What if a player disconnects mid-dismissal confirmation? No change occurs; dismissal requires explicit server-side confirmation message.
- Can a player obtain duplicate squire types? Yes — a player can have multiple squires of the same definition (e.g., two "Brand" squires).
- What happens if a squire on expedition is somehow targeted for dismissal? Server enforces the constraint — dismissal is rejected with a reason message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support admin-defined squire definitions with name, uploadable icon, and power level.
- **FR-002**: System MUST display squire level as a named rank from a 20-tier rank table (e.g., "Peasant", "Commoner", "Squire", "Page", "Yeoman", "Footman", "Sergeant", "Knight-Errant", "Knight", "Knight-Captain", "Baron", "Viscount", "Count", "Marquess", "Earl", "Lord", "Duke", "Archduke", "Prince", "Sovereign").
- **FR-003**: System MUST support squire acquisition from monster loot, gathering drops, quest rewards, and exploration.
- **FR-004**: System MUST enforce a per-character squire slot limit (5 total, 2 initially unlocked) and reject acquisitions when all unlocked slots are full.
- **FR-005**: System MUST allow players to choose which idle squire to send on an expedition.
- **FR-006**: System MUST scale expedition rewards based on the dispatched squire's power level, with maximum power granting up to 100% bonus yield over base rewards.
- **FR-007**: System MUST provide squire dismissal through a designated NPC with dialog option "I want to dismiss a squire".
- **FR-008**: System MUST prevent dismissal of squires currently on expedition.
- **FR-009**: System MUST require explicit player confirmation before dismissing a squire.
- **FR-010**: System MUST display a squire roster UI showing all owned squires with name, icon, rank, and current status (idle/on expedition).
- **FR-011**: System MUST migrate existing legacy squires (one per character) to the new system as level 1 squires of a default definition.
- **FR-012**: System MUST allow admin to upload icons for squire definitions.
- **FR-013**: System MUST prevent deletion of squire definitions that are owned by any player; admin may only deactivate them.
- **FR-014**: System MUST track unlocked vs total squire slots per character, starting at 2 unlocked out of 5 total.
- **FR-015**: System MUST provide agent commands to create squire definitions (`create-squire`) with name, power level, and level, following the existing game-entities command pattern.
- **FR-016**: System MUST provide an agent command to upload squire icons (`upload-squire-icon`) for a given squire definition.
- **FR-017**: System MUST provide an agent command to add a squire as monster loot (`create-monster-squire-loot`) with monster ID, squire definition ID, drop chance, and squire level.
- **FR-018**: System MUST extend quest rewards to support a "squire" reward type, configurable via agent commands and admin panel, specifying squire definition ID and level.
- **FR-019**: System MUST extend gathering events to support a "squire" event type, configurable via agent commands and admin panel, specifying squire definition ID, level, and weight.
- **FR-020**: All agent commands MUST validate inputs (reference integrity, value ranges) and return standardized success/error responses consistent with existing game-entities commands.

### Key Entities

- **Squire Definition**: A template defined by admin — name, icon filename, base power level, active/inactive status. Serves as the blueprint for squires players can obtain.
- **Player Squire**: An instance of a squire definition owned by a specific character — references the definition, has a level (1–20), and occupies a slot. Status is derived from whether the squire is on an active expedition.
- **Squire Rank**: A mapping from numeric level (1–20) to a named rank title (e.g., level 1 = "Peasant", level 20 = "Sovereign"). Shared across all squires.
- **Squire Slot Configuration**: A per-character capacity — total slots (5) and unlocked slots (initially 2). Controls how many squires a player can hold simultaneously.
- **Monster Squire Loot**: A drop entry linking a monster to a squire definition — specifies drop chance (1–100%), and the level of squire granted on drop. Analogous to existing monster item loot entries.
- **Squire Quest Reward**: A quest reward entry of type "squire" — specifies which squire definition and level are granted upon quest completion. Extends the existing quest reward system.
- **Squire Gathering Event**: A gathering event of type "squire" — specifies which squire definition and level are granted when the event triggers, with a probability weight. Extends the existing gathering event system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can obtain squires from at least 3 different sources (combat loot, gathering, quests) and view them in their roster within one gameplay session.
- **SC-002**: Expedition reward output for a max-power squire is exactly double that of a minimum-power squire for the same expedition and duration.
- **SC-003**: Players can dismiss an idle squire via NPC dialog and immediately have the freed slot available for a new squire acquisition.
- **SC-004**: Admin can create a new squire definition with icon and have it appear as a configurable reward source within one admin session.
- **SC-005**: All squire levels display as named ranks throughout the entire game UI — no numeric levels are visible to players.
- **SC-006**: New characters start with exactly 2 unlocked squire slots out of 5 total.
- **SC-007**: 100% of existing characters retain their current squire after migration with no data loss.
- **SC-008**: An agent can create a squire definition, upload its icon, and configure it as a monster drop, quest reward, or gathering event using only agent commands — no manual admin panel interaction required.

## Assumptions

- The 20 rank names are a fixed progression defined in data, not editable by admin. Admin manages squire definitions, not rank names.
- Squire level is assigned at acquisition time (determined by the source — e.g., harder monsters drop higher-level squires). Level does not change after acquisition.
- Power level is defined on the squire definition by admin. The expedition bonus formula scales linearly: a squire's bonus = `(power_level / max_possible_power) * 100%`, where 100% means double the base rewards.
- The dismissal NPC is configured via the admin panel as an existing or new NPC with a dismissal dialog option — not a hardcoded entity.
- Squire slot unlock mechanism beyond the initial 2 is deferred to a future feature. The remaining 3 locked slots are visible but non-functional.
- Duplicate squire types are allowed — a player can own multiple instances of the same squire definition.
- Agent commands follow the existing game-entities pattern: validate inputs locally, POST/PUT to admin REST API, return standardized JSON response with success/error.
- The `create-squire` command creates the squire definition (admin template), not a player-owned squire instance. Player squires are only created through gameplay (loot, quests, gathering).
- Monster squire loot, quest squire rewards, and gathering squire events each specify the squire level at configuration time (not derived from the definition's default).
