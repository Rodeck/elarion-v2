# Feature Specification: Skill Development System

**Feature Branch**: `032-skill-development`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: Game design document `game_design/skill-development/design.md` — Code Changes Required section  
**Design Reference**: `game_design/skill-development/design.md`

## Context / Background

Elarion's combat abilities are currently static — once learned, they never improve. This feature introduces a **skill leveling system** where players use consumable skill books to gain skill points toward leveling their abilities. Each ability can reach level 5, with per-level stat scaling (effect value, mana cost, duration, cooldown). Skill books drop from bosses and expeditions, creating a long-term progression loop.

Additionally, the admin ability management UI is overhauled from a side-panel form to a modal-based editor with support for defining per-level stats.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Skill Book from Inventory (Priority: P1)

A player who owns a skill book and has learned the corresponding ability uses the book from their inventory to gain skill points toward leveling that ability. Points are randomly rolled (60% for 10pts, 30% for 20pts, 9% for 30pts, 1% for 50pts). Once 100 points accumulate, the ability levels up and gains improved stats in combat.

**Why this priority**: This is the core mechanic — without skill book usage, the entire feature has no value.

**Independent Test**: Grant a player an ability and its skill book. Use the book from inventory. Verify points are gained, progress is tracked, and level-up occurs at 100 points.

**Acceptance Scenarios**:

1. **Given** a player owns "Drain Life" ability and has a "Drain Life Skill Book" in inventory, **When** they use the skill book, **Then** 10/20/30/50 points are randomly added to their Drain Life progress and 1 book is consumed from inventory.
2. **Given** a player has 95 points on Drain Life (level 1), **When** they use a skill book and roll 10 points, **Then** Drain Life becomes level 2 with 5 points carried over, and combat now uses level 2 stats.
3. **Given** a player does not own the ability linked to a skill book, **When** they try to use the book, **Then** they see an error message: "You haven't learned [ability name] yet."
4. **Given** a player used a Drain Life skill book less than 6 hours ago, **When** they try to use another Drain Life skill book, **Then** they see an error with the remaining cooldown time.
5. **Given** a player's ability is at level 5 (max), **When** they try to use the corresponding skill book, **Then** they see an error: "[ability name] is already at maximum level."

---

### User Story 2 - View Skill Progress in Loadout (Priority: P1)

A player opens their loadout panel and sees their abilities with level indicators, progress bars toward the next level, and cooldown timers showing when they can next use a skill book.

**Why this priority**: Players need visibility into their skill progress to make informed decisions about which books to use. Tied to core mechanic.

**Independent Test**: Have a player with abilities at various levels and cooldown states. Open loadout panel. Verify all progress information displays correctly.

**Acceptance Scenarios**:

1. **Given** a player owns abilities at different levels, **When** they open the loadout panel, **Then** each ability in the owned list shows its current level (e.g., "Lv.3") and a progress bar showing points toward the next level.
2. **Given** a player used a skill book 2 hours ago, **When** they view the loadout, **Then** the affected ability shows "4h 00m" remaining cooldown in red text.
3. **Given** a player has never used a skill book for an ability, **When** they view the loadout, **Then** the ability shows level 1, an empty progress bar, and no cooldown indicator.
4. **Given** a player has an ability at level 5, **When** they view the loadout, **Then** the progress bar is full and a "MASTERED" badge is shown instead of progress numbers.

---

### User Story 3 - View Skill Detail Modal (Priority: P2)

A player clicks on an ability in the loadout panel to open a detailed modal showing the ability's full stats at current level, stats at next level, description, and cooldown status.

**Why this priority**: Enhances player decision-making by showing exactly what leveling gives them. Important for engagement but not blocking core functionality.

**Independent Test**: Click an ability in the loadout. Verify modal shows correct current stats, next level stats, and cooldown timer.

**Acceptance Scenarios**:

1. **Given** a player has Drain Life at level 2 with 45 points, **When** they click on Drain Life in the loadout, **Then** a modal shows: ability icon, name, "Level 2 / 5", progress bar (45/100), current stats (effect_value=115, mana_cost=27), and next level stats (effect_value=130, mana_cost=29).
2. **Given** a player has an ability at level 5, **When** they click it, **Then** the modal shows "MASTERED" and current stats but no "next level" section.
3. **Given** a player has a cooldown active, **When** they view the modal, **Then** it shows "Can use skill book in: Xh Ym" or "Ready" if no cooldown.

---

### User Story 4 - Combat Uses Leveled Ability Stats (Priority: P1)

When a player enters combat, their abilities use the stats corresponding to their current skill level rather than the base level 1 stats. A level 3 Power Strike deals more damage (and costs more mana) than a level 1 Power Strike.

**Why this priority**: Without this, leveling abilities has no gameplay effect. Core to the feature's value proposition.

**Independent Test**: Level up an ability, enter combat, verify the ability uses level-appropriate stats (higher damage/heal/buff values, higher mana cost).

**Acceptance Scenarios**:

1. **Given** a player has Power Strike at level 3 (effect_value=200, mana_cost=24), **When** they enter combat, **Then** Power Strike deals damage using 200% attack multiplier and costs 24 mana.
2. **Given** a player has Iron Skin at level 5 (duration=5 turns), **When** Iron Skin triggers in combat, **Then** the buff lasts 5 turns instead of the base 3 turns.
3. **Given** a player has never used a skill book (all abilities at level 1), **When** they enter combat, **Then** abilities use their original base stats (backward compatible).

---

### User Story 5 - Admin Manages Ability Levels (Priority: P2)

An admin edits an ability through a modal-based UI (replacing the old side-panel form) and can define stat values for each of the 5 levels. The admin can also create and edit abilities through the modal.

**Why this priority**: Required for content management but can be done after player-facing features work.

**Independent Test**: Open admin panel, create/edit an ability via modal, define level 2-5 stats, save, verify stats persist.

**Acceptance Scenarios**:

1. **Given** an admin opens the ability manager, **When** they click "Add", **Then** a modal overlay opens with all ability fields (name, description, effect type, slot type, mana cost, effect value, duration, cooldown, priority, icon upload).
2. **Given** an admin has created an ability, **When** they open its edit modal, **Then** a "Level Stats" section shows a table with 5 rows (levels 1-5) where they can set effect_value, mana_cost, duration_turns, and cooldown_turns for each level.
3. **Given** an admin saves level stats, **When** they re-open the edit modal, **Then** the saved level stats are pre-filled.
4. **Given** the old left-panel form layout, **When** the feature is deployed, **Then** the left panel form is replaced by a full-width ability card grid with modal-based add/edit.

---

### User Story 6 - Skill Books Drop from Bosses and Expeditions (Priority: P3)

Skill books are added to boss loot tables and expedition reward configurations so players can acquire them through normal gameplay.

**Why this priority**: Content configuration via admin API — depends on skill book items existing first. Can be done during execution phase.

**Independent Test**: Kill a boss, verify skill books can drop. Complete an expedition, verify skill books can be received.

**Acceptance Scenarios**:

1. **Given** a boss has a skill book in its loot table at 10% drop chance, **When** a player defeats the boss, **Then** the skill book drops approximately 10% of the time.
2. **Given** an expedition has a skill book in its reward config, **When** a player collects expedition rewards, **Then** the skill book is included in the reward snapshot.

---

### Edge Cases

- **Point overflow on level-up**: If a player has 95 points and rolls 50, they level up and carry over 45 points to the next level (excess is not lost).
- **Max level cap**: At level 5, additional points are harmless — level stays at 5, points cap at 99.
- **Per-ability cooldown independence**: Using a Drain Life book does not prevent using a Power Strike book simultaneously. Each ability tracks its own 6-hour cooldown.
- **Inventory consumption**: Skill book usage always works even if inventory is full (it consumes an item, not adds one).
- **Admin deletes ability**: Cascading deletes clean up progress rows. Orphaned skill book items (ability_id referencing deleted ability) should show an error on use.
- **Combat in progress**: Skill book usage is rejected while the character is in combat.
- **No double level-up possible**: Maximum single roll is 50 points, maximum pre-roll points is 99, so at most one level-up per use (99 + 50 = 149, carrying over 49 to next level).
- **New abilities without level definitions**: If an ability has no rows in the level stats table, combat defaults to the base ability stats (level 1 equivalent).
- **Partial level definitions**: If an ability has level rows for 1-3 but not 4-5, and a player reaches level 4, the system falls back to the highest defined level's stats (level 3 in this example). Admins are not required to define all 5 levels upfront.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a new `skill_book` item category that links each item to a specific ability via an `ability_id` field on item definitions.
- **FR-002**: System MUST track per-character, per-ability skill progress including current level (1-5), current points (0-99), and last skill book usage timestamp.
- **FR-003**: System MUST allow players to use skill books from their inventory, consuming 1 item and granting randomly-rolled skill points (60%: 10pts, 30%: 20pts, 9%: 30pts, 1%: 50pts).
- **FR-004**: System MUST enforce a 6-hour cooldown per ability per character for skill book usage. Cooldowns are independent per ability.
- **FR-005**: System MUST level up an ability when accumulated points reach 100, resetting points with carry-over and incrementing the level.
- **FR-006**: System MUST cap ability levels at 5. Attempts to use skill books on max-level abilities are rejected with an error message.
- **FR-007**: System MUST reject skill book usage if the character does not own the linked ability, with an appropriate error message.
- **FR-008**: System MUST reject skill book usage if the character is currently in combat.
- **FR-009**: System MUST store per-level stat definitions (effect_value, mana_cost, duration_turns, cooldown_turns) for each ability, supporting levels 1 through 5. Partial definitions are allowed — if a level row is missing, the system MUST fall back to the highest defined level's stats.
- **FR-010**: The combat engine MUST use the character's current ability level to determine ability stats during combat. Characters without progress records default to level 1.
- **FR-011**: The loadout panel MUST display each owned ability's current level, a progress bar showing points toward next level, and a cooldown timer when applicable.
- **FR-012**: The loadout panel MUST support clicking an ability to open a detail modal showing current stats, next level stats, progress, and cooldown status.
- **FR-013**: The admin ability manager MUST use a modal-based editor (replacing the side-panel form) for creating and editing abilities.
- **FR-014**: The admin ability editor modal MUST include a "Level Stats" section for defining stats at each of the 5 levels.
- **FR-015**: The admin API MUST support reading and writing per-level ability stats.
- **FR-016**: System MUST send ability progress state to clients on login and after any progress changes.
- **FR-017**: Inventory detail panel MUST show a "Use" button for skill book category items.
- **FR-018**: System MUST display appropriate error messages for all rejection scenarios (no ability owned, cooldown active, max level reached, in combat).

### Key Entities

- **Ability Level Definition**: Per-ability, per-level stat configuration (effect_value, mana_cost, duration_turns, cooldown_turns). Up to 5 rows per ability, keyed by ability ID and level number.
- **Character Ability Progress**: Per-character, per-ability tracking of current level (1-5), accumulated points toward next level (0-99), and timestamp of last skill book usage for cooldown enforcement.
- **Skill Book Item**: An item definition with category `skill_book` and a reference to the ability it trains. Stackable and consumable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can use a skill book and see skill points gained within 1 second of clicking "Use".
- **SC-002**: Ability level-ups are reflected in the next combat session — leveled abilities use their correct per-level stats.
- **SC-003**: The loadout panel accurately shows level, progress, and cooldown for all owned abilities with no stale data after skill book usage.
- **SC-004**: The 6-hour per-ability cooldown is enforced server-side — repeated requests within the window are rejected.
- **SC-005**: Existing characters with abilities but no skill progress records function identically to before (backward compatible at level 1).
- **SC-006**: Admins can define all 5 level stats for an ability and save them in under 2 minutes using the modal editor.
- **SC-007**: The admin ability manager modal replaces the old side-panel form entirely with no regressions in ability CRUD functionality.

## Assumptions

- Maximum ability level is 5 and points-per-level is 100 — these are constants, not admin-configurable.
- Skill book point distribution (60/30/9/1 for 10/20/30/50 points) is hardcoded server-side, not admin-configurable.
- The 6-hour cooldown is a server-side constant, not admin-configurable.
- Level stats in the ability levels table are independent of the base stats in the abilities table. Editing base ability stats does not auto-update level stat rows. The combat engine reads exclusively from level definitions when they exist, falling back to base ability stats only when no level rows are defined at all.
- Skill book items are created and linked to abilities via the admin API / game-entities script during the execution phase — not part of this spec's implementation scope.
- Boss loot and expedition reward configuration for skill books is done via existing admin APIs during the execution phase.

## Clarifications

### Session 2026-04-03

- Q: What happens when an admin defines levels 1-3 but not 4-5, and a player reaches level 4? → A: Fall back to the highest defined level's stats (previous level fallback).
- Q: If an admin edits base ability stats, should level 1 stats auto-update to match? → A: No — level stats are fully independent. Combat reads from level definitions when they exist, base stats only when no level rows exist at all.
