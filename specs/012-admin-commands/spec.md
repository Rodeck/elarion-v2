# Feature Specification: Admin Commands System

**Feature Branch**: `012-admin-commands`
**Created**: 2026-03-08
**Status**: Draft
**Input**: User description: "Let's introduce admin commands. If player is admin, can send admin commands in the chat, e.g /level_up Roddeck /level_up Roddeck 5 (levelup 5 times), /item Roddeck 1 1 (give 1 item with id 1 to roddeck) /clear_inventory Roddeck clear Roddecks inventory."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Level Up a Player (Priority: P1)

An admin player types `/level_up Roddeck` in the in-game chat to increase Roddeck's level by one. Optionally, the admin can specify a count: `/level_up Roddeck 5` to level up Roddeck five times at once. The target player's stats update immediately. The admin receives a confirmation message in chat. Non-admin players who attempt the same command see an error and nothing changes.

**Why this priority**: Level management is the most commonly needed admin action for balancing player progression during development and live operations.

**Independent Test**: Can be fully tested by having an admin type `/level_up <name>` in chat and verifying the target player's level increases by 1 (or N when specified).

**Acceptance Scenarios**:

1. **Given** a logged-in admin player, **When** they type `/level_up Roddeck` in chat, **Then** Roddeck's level increases by 1 and the admin sees a success confirmation.
2. **Given** a logged-in admin player, **When** they type `/level_up Roddeck 5` in chat, **Then** Roddeck's level increases by 5 and the admin sees a success confirmation.
3. **Given** a non-admin player, **When** they type `/level_up Roddeck` in chat, **Then** nothing changes and they see "You do not have permission to use this command."
4. **Given** a logged-in admin player, **When** they type `/level_up UnknownPlayer`, **Then** they see an error: "Player 'UnknownPlayer' not found."
5. **Given** a logged-in admin player, **When** they type `/level_up Roddeck 0` or `/level_up Roddeck -1`, **Then** they see an error: "Count must be a positive number."
6. **Given** a logged-in admin player, **When** they type `/level_up` with no arguments, **Then** they see a usage hint: "Usage: /level_up <player> [count]".

---

### User Story 2 - Give Items to a Player (Priority: P2)

An admin player types `/item Roddeck 1 1` in chat to give 1 unit of item ID 1 to Roddeck. The item is immediately added to Roddeck's inventory. The admin receives a confirmation message showing which item was given, in what quantity, and to whom.

**Why this priority**: Item granting is essential for rewarding players, testing item balance, and supporting players who experience bugs.

**Independent Test**: Can be fully tested by typing `/item <player> <item_id> <quantity>` and verifying the item appears in the target player's inventory.

**Acceptance Scenarios**:

1. **Given** a logged-in admin player, **When** they type `/item Roddeck 1 1` in chat, **Then** Roddeck receives 1 of item ID 1 and the admin sees a success confirmation.
2. **Given** a logged-in admin player, **When** they type `/item Roddeck 5 10` in chat, **Then** Roddeck receives 10 of item ID 5.
3. **Given** a logged-in admin player, **When** they type `/item Roddeck 999 1` where item ID 999 does not exist, **Then** they see an error: "Item with ID 999 does not exist."
4. **Given** a logged-in admin player, **When** they type `/item UnknownPlayer 1 1`, **Then** they see an error: "Player 'UnknownPlayer' not found."
5. **Given** a non-admin player, **When** they type `/item Roddeck 1 1`, **Then** nothing changes and they see "You do not have permission to use this command."
6. **Given** a logged-in admin player, **When** they type `/item Roddeck 1 0` or `/item Roddeck 1 -5`, **Then** they see an error: "Quantity must be a positive number."

---

### User Story 3 - Clear a Player's Inventory (Priority: P3)

An admin player types `/clear_inventory Roddeck` in chat to remove all items from Roddeck's inventory. The admin receives a confirmation message. Roddeck's inventory becomes empty immediately.

**Why this priority**: Inventory clearing is useful for testing and resetting player state, but is less frequently needed than leveling or item granting.

**Independent Test**: Can be fully tested by typing `/clear_inventory <player>` and verifying the target player's inventory is empty afterward.

**Acceptance Scenarios**:

1. **Given** a logged-in admin player, **When** they type `/clear_inventory Roddeck` in chat, **Then** all items are removed from Roddeck's inventory and the admin sees a success confirmation.
2. **Given** Roddeck already has an empty inventory, **When** the admin types `/clear_inventory Roddeck`, **Then** the command succeeds with a confirmation (no error for already-empty inventory).
3. **Given** a non-admin player, **When** they type `/clear_inventory Roddeck`, **Then** nothing changes and they see "You do not have permission to use this command."
4. **Given** a logged-in admin player, **When** they type `/clear_inventory UnknownPlayer`, **Then** they see an error: "Player 'UnknownPlayer' not found."

---

### Edge Cases

- What happens when the admin types a command with missing required arguments (e.g., `/level_up` alone)? → They see a usage hint specific to that command.
- What happens when the targeted player is offline? → Command applies to the player's stored data; changes are reflected when they next log in (or immediately if already online).
- What happens when the quantity for `/item` is 0 or negative? → Error: "Quantity must be a positive number."
- What happens when an admin targets themselves with a command? → Allowed; same rules apply.
- What happens when an unrecognized slash command is typed? → Treated as regular chat text; no special handling for this feature.
- What happens when `/level_up` count is non-numeric (e.g., `/level_up Roddeck abc`)? → Error: "Count must be a positive number."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST restrict admin command execution to players flagged as admin; all other players who attempt admin commands MUST receive a permission error visible only to themselves with no side effects.
- **FR-002**: Admin commands MUST be entered through the existing in-game chat input field, prefixed with `/`.
- **FR-003**: System MUST support `/level_up <player> [count]`: increase the named player's level by 1 when count is omitted, or by the specified positive integer count.
- **FR-004**: System MUST support `/item <player> <item_id> <quantity>`: add the specified positive integer quantity of the item to the named player's inventory.
- **FR-005**: System MUST support `/clear_inventory <player>`: remove all items from the named player's inventory.
- **FR-006**: System MUST validate that the named player exists before executing any command and return a clear error message if not found.
- **FR-007**: System MUST validate all numeric arguments (count, item_id, quantity) are positive integers; invalid values MUST trigger a usage hint with the correct syntax.
- **FR-008**: System MUST validate that the referenced item ID exists before granting it and return a clear error if not found.
- **FR-009**: System MUST send a confirmation message to the admin after each successful command execution, summarising the action taken.
- **FR-010**: Admin commands MUST NOT be broadcast to other players in chat; they are private between the admin and the server.

### Key Entities

- **Player**: A game character with a name, level, admin flag, and inventory; admin flag determines command access.
- **Item Definition**: A catalogue entry identified by a numeric ID describing what can be owned.
- **Inventory Item**: A record associating a player with an item and a quantity.
- **Admin Command**: A slash-prefixed message sent by an admin player that triggers a privileged server-side action without appearing in public chat.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin players see the effect of any supported command reflected within 1 second of sending it.
- **SC-002**: 100% of admin command attempts by non-admin players are rejected with no side effects.
- **SC-003**: Every admin command with invalid or missing arguments returns a human-readable usage hint — zero silent failures.
- **SC-004**: Admin commands are never visible in other players' chat — 0% leakage to non-targeted players.
- **SC-005**: All three commands (level_up, item, clear_inventory) function correctly for any registered player, online or offline.

## Assumptions

- The system already has an "is admin" flag stored per player account or character.
- Player names are unique identifiers within the game world.
- The existing chat input field is used for admin commands; no separate admin UI is required.
- Commands affect persistent player data regardless of whether the target player is currently online.
- The count parameter in `/level_up` defaults to 1 when omitted; no maximum level cap is enforced for admin use.
- Item IDs are numeric and defined in the existing item catalogue (established in feature 007-item-inventory).
- `/clear_inventory` removes all inventory items including equipped items (conservative assumption; can be revisited during planning).
