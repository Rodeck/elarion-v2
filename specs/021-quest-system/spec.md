# Feature Specification: Quest System

**Feature Branch**: `021-quest-system`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Rich quest system with daily/weekly/monthly quests, chain quests, multiple conditions/prerequisites, various objective types, NPC quest givers, admin graphical UI for quest design, and AI agent quest catalog."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates a Quest via Admin UI (Priority: P1)

A game designer opens the admin panel, navigates to the Quests tab, and creates a new quest. They fill in the quest name, description, and type (e.g., "daily"). They add objectives (e.g., "Kill 5 Goblins"), prerequisites (e.g., "Player must be level 10+"), and rewards (e.g., "50 Crowns + 1 Iron Sword"). They assign the quest to one or more NPCs who will offer it to players. The quest is saved and immediately available in-game.

**Why this priority**: Without the ability to create quests, no other quest functionality can be tested or used. The admin UI is the production pipeline for all quest content.

**Independent Test**: Can be fully tested by logging into the admin panel, creating a quest with objectives/prerequisites/rewards/NPC assignments, saving it, and verifying the data persists correctly when reloading.

**Acceptance Scenarios**:

1. **Given** the admin is on the Quests tab, **When** they fill in all required fields (name, description, type, at least one objective, at least one reward, at least one NPC), **Then** the quest is saved and appears in the quest list.
2. **Given** an existing quest in the list, **When** the admin clicks Edit, **Then** all fields are pre-populated and can be modified.
3. **Given** an existing quest, **When** the admin deletes it, **Then** the quest and all its related data (objectives, prerequisites, rewards, NPC assignments) are removed.
4. **Given** the admin is adding objectives, **When** they select an objective type (e.g., "kill_monster"), **Then** type-specific fields appear (e.g., monster selector + quantity input).
5. **Given** the admin is adding prerequisites, **When** they select "completed_quest", **Then** a quest selector appears allowing them to pick the prerequisite quest (for chain quests).

---

### User Story 2 - Player Accepts a Quest from an NPC (Priority: P1)

A player enters a building, clicks on an NPC marked as a quest giver, and sees a dialogue option "Do you have any tasks for me?". Clicking it shows a list of available quests from that NPC. The player can view quest details (description, objectives, rewards) and accept a quest. The quest appears in their quest log.

**Why this priority**: This is the core player-facing interaction — without it, quests exist only in the database with no way for players to engage.

**Independent Test**: Can be tested by creating a quest in admin, assigning it to an NPC, then logging into the game, visiting the NPC, and accepting the quest.

**Acceptance Scenarios**:

1. **Given** an NPC has quests assigned and the player meets all prerequisites, **When** the player talks to the NPC and selects the quest option, **Then** available quests are displayed with their descriptions, objectives, and rewards.
2. **Given** an NPC offers a quest with a level prerequisite of 10, **When** a level 5 player talks to the NPC, **Then** the quest is not shown in available quests.
3. **Given** the player has already accepted a quest, **When** they talk to the same NPC, **Then** the quest shows as "In Progress" rather than available for acceptance.
4. **Given** the player accepts a quest, **Then** it appears in their quest log with all objectives showing 0 progress.

---

### User Story 3 - Player Completes Quest Objectives and Turns In (Priority: P1)

A player with an active quest performs actions that match quest objectives (kills specific monsters, collects items, crafts items, etc.). Progress updates appear in real time. When all objectives are complete, the player returns to the quest-giving NPC and turns in the quest to receive rewards.

**Why this priority**: Quest tracking and completion is the core gameplay loop — objectives must update in real time and rewards must be granted correctly.

**Independent Test**: Can be tested by accepting a "Kill 3 Goblins" quest, killing 3 goblins, verifying progress updates after each kill, returning to the NPC, and turning in the quest to receive rewards.

**Acceptance Scenarios**:

1. **Given** a player has an active quest with a "kill_monster" objective, **When** they kill the target monster, **Then** the objective progress increments by 1 and a progress update is shown.
2. **Given** all objectives are complete, **When** the player returns to the quest-giving NPC, **Then** a "Complete Quest" option is available.
3. **Given** the player completes a quest, **Then** all defined rewards (items, experience, currency) are granted to the player.
4. **Given** a quest rewards items and the player's inventory is full, **Then** the player is informed they cannot complete the quest until they free inventory space.
5. **Given** a "collect_item" objective requiring 5 Iron Ore, **When** the player has 5 Iron Ore and then drops 2, **Then** the objective progress reflects the current inventory count (3/5, no longer complete).

---

### User Story 4 - Player Views and Manages Quest Log (Priority: P2)

A player opens their quest log to see all active quests. Quests are organized by type (daily, weekly, main, side, etc.). Each quest shows its objectives with current progress. The player can abandon quests they no longer wish to pursue.

**Why this priority**: Players need visibility into their active quests and progress to know what to do next. This is essential for engagement but not blocking quest acceptance/completion.

**Independent Test**: Can be tested by accepting multiple quests of different types, opening the quest log, verifying categorization and progress display, and abandoning a quest.

**Acceptance Scenarios**:

1. **Given** the player has active quests of different types, **When** they open the quest log, **Then** quests are grouped by type with clear labels.
2. **Given** an active quest with partial progress, **When** the player views it in the log, **Then** each objective shows current/target progress (e.g., "Kill 3/5 Goblins").
3. **Given** the player abandons a quest, **Then** it is removed from the quest log and any tracked progress is lost.

---

### User Story 5 - Daily/Weekly/Monthly Quests Reset Automatically (Priority: P2)

A player completes a daily quest. The next day, the same quest becomes available again from the NPC. Weekly quests reset at the start of each week, and monthly quests at the start of each month. The player can complete repeating quests each period for ongoing rewards.

**Why this priority**: Repeating quests are a key retention mechanic, but the system works fine with one-time quests first.

**Independent Test**: Can be tested by creating a daily quest, completing it, advancing the game day, and verifying the quest becomes available again.

**Acceptance Scenarios**:

1. **Given** a player completed a daily quest today, **When** they talk to the NPC today, **Then** the quest shows as "Completed" and cannot be accepted again.
2. **Given** a player completed a daily quest yesterday, **When** they talk to the NPC today, **Then** the quest is available for acceptance again.
3. **Given** a weekly quest completed in week 12, **When** week 13 begins, **Then** the quest resets and becomes available.
4. **Given** a monthly quest completed in March, **When** April begins, **Then** the quest resets and becomes available.

---

### User Story 6 - Chain Quests Unlock Sequentially (Priority: P2)

A game designer creates a series of quests forming a storyline (e.g., "Blacksmith's Apprentice" parts 1, 2, 3). Each subsequent quest requires the previous one to be completed. Players experience the chain as a natural narrative progression.

**Why this priority**: Chain quests add narrative depth and progression but are a specialization of the prerequisite system, not a new mechanic.

**Independent Test**: Can be tested by creating quest A and quest B (with prerequisite: completed quest A), verifying B is unavailable until A is done.

**Acceptance Scenarios**:

1. **Given** quest B requires completion of quest A, **When** a player who hasn't completed A talks to the NPC, **Then** quest B is not available.
2. **Given** quest B requires completion of quest A, **When** a player who completed A talks to the NPC, **Then** quest B is available for acceptance.
3. **Given** a chain of 3 quests, **When** the admin views them in the admin UI, **Then** the chain grouping and ordering is visible.

---

### User Story 7 - AI Agent Creates Quests via API (Priority: P3)

An AI agent reads the quest catalog endpoint to understand all available objective types, prerequisite types, reward types, and their parameters. Using this information, the agent creates well-formed quests through the admin REST API without human intervention.

**Why this priority**: AI-generated content expands the game's quest library efficiently, but requires the core system and admin API to exist first.

**Independent Test**: Can be tested by fetching the catalog endpoint, then creating a quest via the POST API using the documented format, and verifying the quest appears in the admin UI and in-game.

**Acceptance Scenarios**:

1. **Given** the catalog endpoint is available, **When** an AI agent fetches it, **Then** it receives a structured document listing all objective types with parameters, prerequisite types, reward types, quest types, and API endpoint references.
2. **Given** the catalog information, **When** an AI agent sends a valid POST request to create a quest, **Then** the quest is created with all specified objectives, prerequisites, rewards, and NPC assignments.
3. **Given** an AI agent sends an invalid quest (e.g., missing required fields), **Then** the API returns clear error messages describing what is wrong.

---

### User Story 8 - Quest Tracker HUD Shows Active Progress (Priority: P3)

While playing, a small overlay on the game screen shows 1-3 pinned quest objectives with live progress. As the player completes actions, the tracker updates immediately, giving constant feedback without opening the full quest log.

**Why this priority**: Quality-of-life feature that improves player experience but is not required for core quest functionality.

**Independent Test**: Can be tested by accepting a quest, performing quest-relevant actions, and verifying the HUD tracker updates in real time.

**Acceptance Scenarios**:

1. **Given** the player has active quests, **When** they are in the game world, **Then** a small tracker shows up to 3 current objectives with progress.
2. **Given** an objective progresses, **When** the player kills a monster/collects an item, **Then** the tracker updates immediately without requiring the quest log to be opened.

---

### Edge Cases

- What happens when a player accepts a quest, then loses the required prerequisite item before completing it? The quest remains active; only acceptance checks prerequisites, not ongoing progress.
- What happens when a quest's NPC is removed from a building while a player has an active quest from that NPC? The player can still complete objectives but must find another NPC assigned to the quest (or the same NPC if reassigned) to turn it in. If no NPC remains, the quest becomes un-turnable (admin should reassign).
- What happens when a quest definition is deactivated while players have it active? Active instances remain and can be completed, but new players cannot accept it.
- What happens when a player tries to accept more quests than the quest log allows? The system rejects with a clear message ("Quest log is full").
- What happens when daily/weekly/monthly reset occurs while a player has the quest active but incomplete? The active instance remains until abandoned or completed; a new instance is not created until the current one is resolved.
- What happens when a "collect_item" quest objective references an item the player uses (e.g., consumes a potion)? The objective progress decreases to reflect current inventory, potentially un-completing the objective.
- What happens when quest rewards would exceed inventory capacity? The turn-in is blocked with a message to free inventory space first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support quest types: main (one-time story), side (one-time), daily (resets each day), weekly (resets each week), monthly (resets each month), and repeatable (can be re-accepted immediately after completion).
- **FR-002**: System MUST support quest objectives of types: kill specific monster, collect specific item, craft specific item, spend currency, complete gathering sessions, reach a character level, visit a location, and talk to a specific NPC.
- **FR-003**: System MUST support quest prerequisites: minimum character level, possession of a specific item, completion of a specific quest (enabling chain quests), and character class restriction.
- **FR-004**: System MUST support quest rewards: items (with quantity), experience points, and currency (crowns).
- **FR-005**: System MUST allow quests to be assigned to one or more NPCs who serve as quest givers.
- **FR-006**: System MUST track per-player quest progress independently, updating objective progress in real time as the player performs relevant actions.
- **FR-007**: System MUST automatically reset daily/weekly/monthly quests at the start of each new period without requiring manual intervention or background jobs.
- **FR-008**: System MUST support chain quests where quest B requires completion of quest A, with visual grouping in the admin UI.
- **FR-009**: System MUST provide an admin graphical UI for creating, editing, and deleting quests with dynamic form builders for objectives, prerequisites, and rewards.
- **FR-010**: System MUST provide a quest catalog endpoint that documents all available objective types, prerequisite types, reward types, and their parameters in a structured format suitable for AI agents.
- **FR-011**: System MUST enforce a maximum quest log size per player (25 active quests).
- **FR-012**: System MUST allow players to abandon active quests, removing them from the quest log and discarding progress.
- **FR-013**: System MUST validate all prerequisites before allowing a player to accept a quest.
- **FR-014**: System MUST validate all objectives are complete and inventory has space before allowing quest turn-in.
- **FR-015**: System MUST support "collect_item" objectives that reflect actual current inventory count (decreasing if items are consumed/dropped).
- **FR-016**: System MUST display quest-giver NPCs with a dialogue option for quests when the player interacts with them.
- **FR-017**: System MUST provide a quest log UI showing all active quests grouped by type with per-objective progress.
- **FR-018**: System MUST allow admins to activate/deactivate quests without deleting them.
- **FR-019**: System MUST provide an in-game quest tracker HUD showing pinned objective progress.

### Key Entities

- **Quest Definition**: A template describing a quest — its name, description, type, chain grouping, active status, and ordering. Contains objectives, prerequisites, rewards, and NPC assignments.
- **Quest Objective**: A single task within a quest — type (kill, collect, craft, etc.), target reference (which monster/item/NPC/location), required quantity, and optional duration.
- **Quest Prerequisite**: A condition that must be met to accept a quest — type (level, item, completed quest, class), target reference, and required value.
- **Quest Reward**: Something granted on quest completion — type (item, XP, crowns), target reference (which item), and quantity.
- **Quest NPC Giver**: An association between a quest and an NPC who can offer/accept-turn-in for that quest.
- **Character Quest**: A player's instance of a quest — tracks acceptance time, completion status, and reset period key (for repeating quests).
- **Character Quest Objective**: A player's progress on a specific objective within an active quest — current count and completion flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Game designers can create a fully configured quest (with objectives, prerequisites, rewards, and NPC assignments) through the admin UI in under 5 minutes.
- **SC-002**: Quest objective progress updates are reflected to the player within 1 second of the triggering action (killing a monster, collecting an item, etc.).
- **SC-003**: Players can accept, track progress on, and complete quests through NPC interactions without any manual admin intervention per-player.
- **SC-004**: Daily/weekly/monthly quests correctly reset and become available at the start of each new period with zero manual intervention.
- **SC-005**: Chain quests correctly enforce ordering — players cannot access quest N+1 until quest N is completed.
- **SC-006**: The quest catalog endpoint provides sufficient documentation for an AI agent to create valid quests without additional human guidance.
- **SC-007**: All 8 objective types (kill, collect, craft, spend, gather, level, visit, talk) function correctly and track progress independently.
- **SC-008**: The admin quest list supports filtering and searching, allowing designers to find any quest within 10 seconds in a catalog of 100+ quests.

## Assumptions

- Quest log maximum is 25 active quests per player (reasonable for an RPG of this scope).
- Prerequisites use AND logic (all must be met) — no OR combinations needed initially.
- Daily reset occurs at midnight UTC; weekly at Monday midnight UTC; monthly at the 1st midnight UTC.
- Quest turn-in happens at the same NPC (or any NPC assigned to that quest), not automatically.
- Deactivated quests remain completable for players who already accepted them but are hidden from new players.
- The quest tracker HUD shows up to 3 pinned objectives (player can choose which to pin in a future iteration; initially shows most recent quest objectives).
- AI agents use the same admin REST API as the admin UI — no separate API needed.
