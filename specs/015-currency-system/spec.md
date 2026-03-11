# Feature Specification: Currency System (Crowns)

**Feature Branch**: `015-currency-system`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Let's introduce Money concept in the game. First propose fitting name for currency, i don't want it to be just 'gold' because gold could be resource, find some good name for it. Add gold for player, show it on character panel. Each monster can be configured to give random gold from min to max. Add admin command to give player XX gold /gold Roddeck 1000"

---

## Currency Name Proposal

**Chosen name: Crowns (singular: Crown)**

Rationale: "Crowns" fits a medieval fantasy setting, evokes nobility and wealth, is distinct from raw resources like gold or iron, and has historical precedent (Czech koruna, British Crown coin). It can be naturally abbreviated as "cr" in compact UI displays (e.g. "1,250 cr").

Alternative names considered: Marks, Ducats, Florins, Sovereigns, Shards, Solari. "Crowns" was selected as the most recognizable and thematically fitting option.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player Sees Crown Balance on Character Panel (Priority: P1)

A player opens the game and can see their current Crown balance displayed on the character stats panel at all times during gameplay.

**Why this priority**: Foundation of the currency system — without visible balance, no other currency feature is meaningful. Must be in place before loot and admin command are useful.

**Independent Test**: Launch the game with a character that has a Crown balance greater than 0 and verify the value appears on the character panel.

**Acceptance Scenarios**:

1. **Given** a character has 500 Crowns, **When** the player loads into the game world, **Then** the character panel displays the Crown balance with a recognizable currency indicator.
2. **Given** a character has 0 Crowns, **When** the player opens the character panel, **Then** the panel shows "0" Crowns rather than hiding the field.
3. **Given** a player's Crown balance changes (e.g., after a monster kill), **When** the update is received, **Then** the displayed value updates in real time without requiring a page reload.

---

### User Story 2 - Monsters Drop Crowns on Death (Priority: P2)

When a player defeats a monster, they receive a random number of Crowns within the range configured for that monster type. The amount is credited to their character and reflected on the UI immediately.

**Why this priority**: Core gameplay loop reward — killing monsters should yield currency, making combat feel meaningful and progression tangible.

**Independent Test**: Kill a monster with a configured drop range of 10–50 Crowns and verify that between 10 and 50 Crowns are added to the player's balance.

**Acceptance Scenarios**:

1. **Given** a monster is configured with min 10 and max 50 Crowns, **When** the player kills it, **Then** the player receives a random whole-number amount between 10 and 50 Crowns inclusive.
2. **Given** a monster is configured with min 0 and max 0 Crowns, **When** the player kills it, **Then** no Crowns are added to the player's balance.
3. **Given** the player receives Crowns from a kill, **When** the loot is applied, **Then** the character panel balance updates immediately to reflect the gain.
4. **Given** a monster type has no Crown configuration, **When** it is killed, **Then** it drops 0 Crowns as a safe default.

---

### User Story 3 - Admin Grants Crowns to a Player via Command (Priority: P3)

An administrator can run the in-game command `/crown <PlayerName> <Amount>` to instantly grant a specified number of Crowns to any online player.

**Why this priority**: Operational necessity for testing, balancing, and player support. Depends on P1 and P2 being in place so the effect can be observed.

**Independent Test**: Run `/crown Roddeck 1000` while Roddeck is online and verify their balance increases by exactly 1000 Crowns.

**Acceptance Scenarios**:

1. **Given** an admin is logged in and Roddeck is online with 200 Crowns, **When** the admin runs `/crown Roddeck 1000`, **Then** Roddeck's balance becomes 1,200 Crowns and the change is reflected on Roddeck's panel immediately.
2. **Given** an admin runs `/crown UnknownPlayer 500`, **When** the target player is not found online, **Then** the admin receives a clear error message and no Crowns are awarded.
3. **Given** a non-admin player runs `/crown Roddeck 1000`, **When** the command is processed, **Then** the server rejects it with a permission-denied message.
4. **Given** an admin runs `/crown Roddeck -100`, **When** a negative amount is provided, **Then** the server rejects the command with a validation error message.

---

### Edge Cases

- What happens when a player's Crown balance reaches the maximum storable value?
  The system caps the balance at the defined maximum integer value. Overflow is silently clamped rather than returning an error.
- What if two monsters die simultaneously and both try to credit the same player?
  Concurrent credits must be handled atomically so both amounts are applied correctly with no loss.
- What if the admin command is issued for a player who is offline?
  Offline grants are not supported in this feature. The command fails gracefully with a message indicating the player is not online.
- What if `min_crowns` is greater than `max_crowns` in a monster's configuration?
  Treat as misconfiguration; the server drops exactly `min_crowns` (uses it for both bounds).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store a Crown balance per character, initialized to 0 for new characters.
- **FR-002**: The character panel MUST display the current Crown balance at all times during gameplay, updating in real time when the balance changes.
- **FR-003**: Each monster type MUST support a configurable minimum and maximum Crown drop range, both defaulting to 0.
- **FR-004**: When a monster is killed, the system MUST award the killing player a random whole-number Crown amount within the configured min–max range inclusive.
- **FR-005**: The Crown award from monster death MUST be applied to the character's persistent balance and survive logout/login cycles.
- **FR-006**: Administrators MUST be able to run `/crown <PlayerName> <Amount>` in-game to grant Crowns to an online player.
- **FR-007**: The admin Crown command MUST be restricted to accounts with administrator privileges; non-admins receive a permission-denied response.
- **FR-008**: The admin Crown command MUST validate that the amount is a positive integer and the target player is currently online; invalid inputs MUST return descriptive error messages.
- **FR-009**: The currency MUST be named "Crowns" (singular: "Crown") everywhere it is displayed to players.

### Key Entities

- **Character**: Has a Crown balance (non-negative whole number). Balance persists across sessions.
- **MonsterDefinition**: Has `min_crowns` and `max_crowns` configuration fields (non-negative whole numbers, both default to 0).
- **CrownTransaction**: Records how many Crowns were awarded, to which character, and the source (monster loot or admin grant). Used for audit and debugging.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of monster kills with a configured Crown range result in a Crown award within that range.
- **SC-002**: The Crown balance displayed on the character panel reflects the correct value within 1 second of any change (kill reward or admin grant).
- **SC-003**: The admin `/crown` command successfully grants Crowns in 100% of valid invocations (correct admin, online player, positive amount).
- **SC-004**: Invalid admin command inputs (negative amount, unknown player, non-admin caller) are rejected with a descriptive error in 100% of cases.
- **SC-005**: New characters start with exactly 0 Crowns.
- **SC-006**: Crown balances survive logout and login cycles with no data loss.

---

## Assumptions

- The admin command is named `/crown` to match the currency name (the user's example `/gold Roddeck 1000` was illustrative; naming is updated to match "Crowns").
- Monster loot is applied server-side upon monster death and communicated to the client via the existing WebSocket protocol.
- Only online players can receive admin-granted Crowns; offline grant support is out of scope.
- Crown amounts are whole numbers (integers); fractional Crowns are not supported.
- The character panel UI update extends the existing stats bar component with a new Crowns field.
- No spending or purchasing mechanics are in scope for this feature — only earning and displaying Crowns.
- Monster Crown drop configuration is managed via the existing admin panel interface.
