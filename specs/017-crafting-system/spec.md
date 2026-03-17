# Feature Specification: Crafting System

**Feature Branch**: `017-crafting-system`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Introduce crafting system bound to NPCs with recipes, multi-craft, progress tracking, collect/cancel mechanics, admin commands, and server restart persistence"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Start Crafting (Priority: P1)

A player visits a building with a crafting NPC. They interact with the NPC and see a dialog option "I want to craft some items." Selecting it opens a crafting modal showing all recipes available at that NPC. The player selects a recipe, sees the required materials and crowns, chooses a quantity (1x, 5x, 20x, or custom), and starts crafting. The required items and crowns are deducted immediately.

**Why this priority**: Core crafting flow — without this, no other crafting features matter. This is the fundamental interaction that makes crafting exist.

**Independent Test**: Can be fully tested by visiting a crafting NPC, opening the crafting modal, selecting a recipe with a valid quantity, and confirming that materials/crowns are deducted and crafting begins.

**Acceptance Scenarios**:

1. **Given** a player is at a building with a crafting NPC and has sufficient materials and crowns, **When** they select a recipe and choose 5x, **Then** 5x the required materials and crowns are deducted and crafting begins with a visible progress indicator.
2. **Given** a player has insufficient materials for the selected quantity, **When** they attempt to start crafting, **Then** the system prevents crafting and informs the player which resources are missing.
3. **Given** a player has insufficient crowns, **When** they attempt to start crafting, **Then** the system prevents crafting and shows the crown shortfall.
4. **Given** a recipe is already in progress for the player at this NPC, **When** they view that recipe in the list, **Then** the craft button is disabled and the recipe shows its current progress instead.

---

### User Story 2 - Track Progress and Collect Finished Items (Priority: P1)

While crafting is in progress, the player can return to the crafting NPC at any time and see a progress bar with percentage and estimated time remaining. Progress is calculated based on elapsed real time (e.g., 10 swords at 1 minute each = 10 minutes total; after 5 minutes, 50% complete). When crafting finishes, a "Collect" button appears. Clicking it delivers the crafted items to the player's inventory.

**Why this priority**: Equally critical as starting — players must be able to see progress and receive their crafted items. Without collection, crafting has no payoff.

**Independent Test**: Can be tested by starting a craft, waiting for completion (or using admin fast-forward), returning to the NPC, and collecting items into inventory.

**Acceptance Scenarios**:

1. **Given** a player has a crafting session 50% complete, **When** they open the crafting modal at that NPC, **Then** the recipe shows a progress bar at 50% with the correct remaining time displayed.
2. **Given** a crafting session is 100% complete, **When** the player opens the crafting modal, **Then** a "Collect" button is shown for that recipe.
3. **Given** crafting is complete and the player clicks "Collect", **When** the player has enough inventory space, **Then** all crafted items are added to inventory and the crafting session is cleared.
4. **Given** crafting is complete and the player clicks "Collect", **When** the player's inventory is full, **Then** the system informs the player their inventory is full and keeps the items available for later collection.

---

### User Story 3 - Cancel In-Progress Crafting (Priority: P2)

A player who has crafting in progress can cancel it at any time. Cancelling refunds 50% of the materials and crowns originally spent (rounded down), regardless of how much time has passed or how close to completion the craft is. The crafting session is removed.

**Why this priority**: Players need an escape valve if they change their mind or need resources back urgently. This prevents frustration from being locked into a bad decision.

**Independent Test**: Can be tested by starting a craft, cancelling it, and verifying that 50% of resources (rounded down) are returned to inventory and crown balance.

**Acceptance Scenarios**:

1. **Given** a player has a crafting session in progress (any percentage), **When** they click "Cancel", **Then** they receive 50% of each material (rounded down) and 50% of crowns (rounded down) back.
2. **Given** a player cancels crafting that used 5 Iron Ore and 100 crowns, **When** the cancellation completes, **Then** 2 Iron Ore and 50 crowns are returned.
3. **Given** a player cancels crafting that used 1 of a material, **When** the cancellation completes, **Then** 0 of that material is returned (50% of 1 rounded down = 0).
4. **Given** a player's inventory is full when cancelling, **When** the refund would add items, **Then** the cancellation is prevented and the player is informed they need inventory space for the refund.

---

### User Story 4 - Admin Recipe Management (Priority: P2)

An admin can create, edit, and delete crafting recipes through the admin backend. Each recipe is associated with an NPC and defines: a result item, result quantity, required input items with quantities, required crowns, and crafting time per unit. An admin can also mark/unmark an NPC as a crafting NPC.

**Why this priority**: Content creation tooling is needed for game designers to populate the crafting system. Without recipes, players have nothing to craft.

**Independent Test**: Can be tested by an admin creating a recipe in the admin panel, assigning it to an NPC, then verifying the recipe appears in the player-facing crafting modal.

**Acceptance Scenarios**:

1. **Given** an admin is on the NPC management page, **When** they enable crafting for an NPC and create a recipe with inputs, output, crown cost, and craft time, **Then** the recipe is saved and becomes available to players visiting that NPC.
2. **Given** an admin edits an existing recipe's crafting time, **When** the change is saved, **Then** new crafting sessions use the updated time (in-progress sessions are unaffected).
3. **Given** an admin deletes a recipe, **When** a player has that recipe in progress, **Then** the in-progress session continues to completion (recipe deletion does not cancel active sessions).

---

### User Story 5 - Admin Command: Force-Finish Crafting (Priority: P3)

An admin can use the chat command `/crafting_finish <player_name>` to instantly complete all in-progress crafting sessions for a specific player. The sessions are marked as complete and ready for collection.

**Why this priority**: Quality-of-life tool for testing and player support. Not needed for core functionality but important for game operations.

**Independent Test**: Can be tested by an admin running the command while a player has active crafting, then verifying all sessions show as complete and collectable.

**Acceptance Scenarios**:

1. **Given** a player "Roddeck" has 3 in-progress crafting sessions, **When** an admin runs `/crafting_finish Roddeck`, **Then** all 3 sessions are marked as complete and ready for collection.
2. **Given** a player has no in-progress crafting, **When** an admin runs `/crafting_finish <name>`, **Then** the admin receives a message stating the player has no active crafting sessions.
3. **Given** the target player is offline, **When** the admin runs `/crafting_finish <name>`, **Then** the sessions are still marked complete in the database (player sees them as collectable when they next log in).

---

### User Story 6 - Crafting Persists Across Server Restarts (Priority: P1)

All crafting sessions are stored persistently. When the server restarts, crafting progress is not lost. The system calculates elapsed time based on when crafting started and the current time, so progress continues accurately even through downtime. Server downtime counts toward crafting time (real wall-clock time).

**Why this priority**: Data loss on restart would severely damage player trust. This is a fundamental reliability requirement.

**Independent Test**: Can be tested by starting a craft, restarting the server, reconnecting, and verifying the progress bar reflects the correct elapsed wall-clock time.

**Acceptance Scenarios**:

1. **Given** a player starts a 10-minute craft at 12:00, the server restarts at 12:03 and comes back at 12:05, **When** the player checks progress at 12:06, **Then** the progress shows 60% (6 of 10 minutes elapsed based on wall-clock time).
2. **Given** a craft would have completed during server downtime, **When** the player reconnects after the server comes back, **Then** the craft shows as 100% complete and ready for collection.

---

### Edge Cases

- What happens when a player tries to craft at an NPC they are no longer physically near? The server rejects the request.
- What happens when a recipe requires an item the player has equipped? Equipped items are not counted as available materials; only inventory items are used.
- What happens if two players try to craft the same recipe at the same NPC simultaneously? Each player has independent crafting sessions — no contention.
- What happens if an admin deletes an item definition that is a crafting output while a session is in progress? The session completes but collection fails gracefully with an error message.
- What happens if the custom quantity input is 0 or negative? The system rejects non-positive quantities.
- What happens if the custom quantity would exceed inventory capacity for the output items? The system warns before starting but does not block (player can make space before collecting).
- What happens if a player disconnects mid-craft? Crafting continues server-side based on wall-clock time; progress is intact when they reconnect.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow admins to designate any NPC as a "crafting NPC" via the admin backend.
- **FR-002**: System MUST allow admins to create crafting recipes associated with a crafting NPC, specifying: output item, output quantity per craft, 1–N required input items with quantities, 0–N required crowns, and crafting duration per unit.
- **FR-003**: System MUST display an "I want to craft some items" dialog option when a player interacts with a crafting NPC that has at least one recipe.
- **FR-004**: System MUST show a crafting modal listing all available recipes at the selected NPC, with each recipe displaying its inputs, crown cost, output, and craft time.
- **FR-005**: System MUST provide quantity selection via preset buttons (1x, 5x, 20x) and a custom numeric input field.
- **FR-006**: System MUST validate that the player possesses all required materials and crowns for the chosen recipe and quantity before starting.
- **FR-007**: System MUST deduct all required materials and crowns atomically when crafting starts.
- **FR-008**: System MUST prevent a player from starting a second crafting session for the same recipe at the same NPC while one is already in progress.
- **FR-009**: System MUST calculate crafting progress based on wall-clock time elapsed since the session started, where total time = (craft duration per unit) × (quantity).
- **FR-010**: System MUST display a progress bar showing percentage complete and estimated time remaining for in-progress recipes.
- **FR-011**: System MUST show a "Collect" button when a crafting session reaches 100% completion.
- **FR-012**: System MUST deliver all crafted items to the player's inventory upon collection, subject to available inventory space.
- **FR-013**: System MUST prevent collection when inventory space is insufficient and inform the player.
- **FR-014**: System MUST allow cancellation of in-progress crafting at any time, refunding 50% of each material (rounded down) and 50% of crowns (rounded down).
- **FR-015**: System MUST prevent cancellation if the player lacks inventory space for the refunded materials.
- **FR-016**: System MUST persist all crafting sessions to permanent storage so they survive server restarts.
- **FR-017**: System MUST treat server downtime as elapsed crafting time (wall-clock model).
- **FR-018**: System MUST support the admin command `/crafting_finish <player_name>` to instantly complete all of a player's in-progress crafting sessions.
- **FR-019**: System MUST allow admins to edit and delete recipes. Editing does not affect in-progress sessions. Deletion does not cancel in-progress sessions.
- **FR-020**: System MUST only count unequipped inventory items as available crafting materials.

### Key Entities

- **Crafting Recipe**: Defines what can be crafted at a specific NPC. Attributes: associated NPC, output item and quantity, list of required input items with quantities, crown cost, crafting duration per unit, display order.
- **Recipe Ingredient**: A required input for a recipe. Attributes: item reference, required quantity per craft.
- **Crafting Session**: An in-progress or completed crafting job for a specific player. Attributes: player reference, recipe reference, quantity being crafted, timestamp when crafting started, total duration, completion status, collection status.

### Assumptions

- A player can have multiple crafting sessions active simultaneously at different NPCs or for different recipes, but not duplicate sessions for the same recipe at the same NPC.
- The crafting modal is an HTML overlay (consistent with existing UI patterns like building menus), not a Phaser scene.
- Crafting recipes produce exactly one type of output item (not multiple different items).
- The custom quantity input accepts positive integers only, with no upper bound beyond what the player's materials allow.
- Recipe ingredients reference existing item definitions from the item system.
- Crafting does not grant experience points (can be added later as a separate feature).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can browse recipes, start crafting, and collect finished items in under 30 seconds of interaction time (excluding craft duration).
- **SC-002**: Crafting progress is accurate to within 1 second of real elapsed time after any server restart.
- **SC-003**: 100% of started crafting sessions are recoverable after server restart with no data loss.
- **SC-004**: Resource deduction and refund calculations are mathematically correct in all cases (no item duplication or loss beyond the intended 50% cancellation penalty).
- **SC-005**: Admins can create a complete recipe (with inputs, output, cost, and timing) in under 2 minutes through the admin interface.
- **SC-006**: The crafting modal is closable at any time without interrupting active crafting sessions.
