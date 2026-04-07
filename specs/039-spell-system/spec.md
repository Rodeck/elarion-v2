# Feature Specification: Spell System

**Feature Branch**: `039-spell-system`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Add second set of non-combat abilities (Spells) — buff spells cast on self or other players, trained via Spell Books, with duration timers, resource costs, and admin management"

## Context & Background

Spells are a distinct, non-combat ability system. While combat abilities (existing system) fire during battles from loadout slots, spells are out-of-combat buffs cast by players on themselves or other players. Spells are the future core mechanic of the Mage class, but all classes can use them in a narrower manner.

Key distinction from existing abilities:
- **Abilities** = combat-time, mana-based, loadout slots, auto/active trigger
- **Spells** = out-of-combat, resource-cost (items/gold), timed buffs, cast on self or others

**Out of scope**: The original design mentions spells scoped to buildings or maps. This feature covers character-targeted spells only. Building/map-scope spells are deferred to a future feature.

Spells are trained the same way as abilities — via consumable "Spell Book" items — but use a new item category (`spell_book_spell`) to distinguish from skill books (`skill_book`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Defines and Manages Spells (Priority: P1)

An admin creates spell definitions through the admin panel, specifying spell name, icon, description, effect type (attack%, defence%, crit chance%, crit damage%, heal, movement speed, energy), effect values per level, duration, and resource cost per level. Spells are managed in a dedicated Spell Manager section, similar to the existing Ability Manager.

**Why this priority**: Without spell definitions, no other functionality works. This is the data foundation.

**Independent Test**: Admin can create, edit, and delete spells via the admin panel. Spell data persists in the database.

**Acceptance Scenarios**:

1. **Given** the admin panel is open, **When** admin navigates to Spell Manager and creates a new spell with name, icon, effect type, base stats, duration, and resource cost, **Then** the spell is saved and appears in the spell list.
2. **Given** a spell exists, **When** admin edits its level stats (effect values, duration, costs per level up to 5), **Then** changes are persisted and reflected immediately.
3. **Given** a spell exists, **When** admin deletes it, **Then** it is removed and no longer available to any player.

---

### User Story 2 — Player Trains Spells via Spell Books (Priority: P1)

Players acquire spell book items (new item category) that are linked to specific spells. Using a spell book grants progress points toward the linked spell, leveling it up (same mechanic as existing skill books). Spells have 5 levels. A 6-hour cooldown applies per spell after using a spell book.

**Why this priority**: Players need to learn and level spells before they can cast them.

**Independent Test**: Player uses a spell book item, gains spell progress points, and eventually levels up the spell.

**Acceptance Scenarios**:

1. **Given** a player has a spell book item in inventory and owns the linked spell, **When** they use the spell book, **Then** they gain progress points, the book is consumed (1 qty), and a 6-hour cooldown starts for that spell's training.
2. **Given** a player does not yet own the spell, **When** they use a spell book linked to that spell, **Then** the spell is granted at level 1 and progress points are applied.
3. **Given** a player's spell is at max level (5), **When** they try to use a spell book for that spell, **Then** the action is rejected with a clear message.

---

### User Story 3 — Player Casts Spell on Self (Priority: P1)

Players open a "Spells" tab (located next to the existing Loadout tab) showing all their learned spells. Each spell displays its icon, name, and current level. Clicking a spell opens a detail view with description, detailed stats, next level bonuses, and a "Cast" button. Casting consumes the required resources (items and/or gold) and applies the buff for the spell's duration.

**Why this priority**: Self-casting is the primary spell interaction. This delivers the core player experience.

**Independent Test**: Player opens Spells tab, selects a spell, clicks Cast, resources are consumed, buff is applied and visible.

**Acceptance Scenarios**:

1. **Given** a player has a learned spell and sufficient resources, **When** they click Cast in the spell detail view, **Then** the spell's resource cost is deducted, the buff is applied for the defined duration, and the active buff appears in the buff display area.
2. **Given** a player lacks the required resources, **When** they attempt to cast, **Then** the Cast button is disabled or the action is rejected with a message indicating which resources are missing.
3. **Given** a player already has an active buff of the same spell at level 2, **When** they cast the same spell at level 2 or higher, **Then** the buff is refreshed (timer resets). If they try to cast level 1, the action is rejected with a message explaining the active buff is of equal or higher level.
4. **Given** a player casts a spell, **When** the duration expires, **Then** the buff is removed and stats return to normal.

---

### User Story 4 — Active Buffs Display Replaces XP Bar (Priority: P2)

The current XP bar area in the stats panel is replaced. XP is instead shown as a circular progress ring around the level indicator. The freed space displays active spell buffs as icons with progress bars showing remaining duration. Hovering a buff icon shows a styled tooltip with spell name, effect details, and remaining time.

**Why this priority**: Players need to see their active buffs at a glance. The XP bar relocation is a necessary UI prerequisite.

**Independent Test**: XP displays as circular ring around level badge. Active buffs appear with countdown progress bars. Tooltips show correct details.

**Acceptance Scenarios**:

1. **Given** a player has XP progress, **When** the stats panel renders, **Then** XP is shown as a circular progress ring around the level number (not as the old horizontal bar).
2. **Given** a player hovers over the level ring, **Then** a tooltip shows exact XP values (current / threshold).
3. **Given** a player has active spell buffs, **When** viewing the stats panel, **Then** each buff is represented by its spell icon with a small progress bar showing remaining time.
4. **Given** a player hovers over a buff icon, **Then** a game-styled tooltip shows spell name, effect description, remaining duration in human-readable format (e.g., "1h 19min").

---

### User Story 5 — Player Casts Spell on Another Player (Priority: P2)

When a player opens another player's detail modal (same location), available spells are displayed. The casting player can select a spell to buff the target player, consuming the caster's resources.

**Why this priority**: Social interaction and party support mechanics. Builds on self-casting (P1).

**Independent Test**: Player A opens Player B's detail modal, selects a spell, casts it on Player B. Player B receives the buff.

**Acceptance Scenarios**:

1. **Given** Player A has learned spells and Player B is in the same location, **When** Player A opens Player B's detail modal, **Then** available spells are listed with cast buttons.
2. **Given** Player A casts a buff spell on Player B, **When** the cast succeeds, **Then** Player A's resources are consumed, Player B receives the buff, and both players see appropriate feedback.
3. **Given** Player B already has the same spell active at a higher level, **When** Player A tries to cast a lower-level version, **Then** the cast is rejected with a message.
4. **Given** Player B goes offline or leaves the location after the spell is cast, **Then** the buff persists for its full duration (server-side timer).

---

### User Story 6 — Admin Command to Grant All Spells (Priority: P3)

An admin command `/spells.all <player>` grants a player all defined spells. Additionally, the existing `/skill_all` command is renamed to `/abilities.all` for consistency.

**Why this priority**: Quality-of-life for testing and administration. Low complexity.

**Independent Test**: Admin types `/spells.all player_name`, player receives all spells. `/abilities.all` works as the old `/skill_all`.

**Acceptance Scenarios**:

1. **Given** an admin player, **When** they type `/spells.all <player>`, **Then** the target player is granted all spells defined in the system.
2. **Given** an admin player, **When** they type `/abilities.all <player>`, **Then** it functions identically to the old `/skill_all` command.
3. **Given** a non-admin player, **When** they type either command, **Then** nothing happens (commands are admin-only).

---

### Edge Cases

- What happens when a player casts a spell but the required item is removed from the game between opening the detail view and clicking Cast? → Server validates resources at cast time; reject with error.
- What happens if a player is in combat and tries to cast a spell? → Spells are non-combat; casting is rejected while in combat.
- What happens when a buff duration is very long (e.g., 24 hours) and the server restarts? → Buff expiry timestamps must be persisted; on reconnect, remaining buffs are restored.
- What happens when the admin deletes a spell definition while a player has an active buff from it? → Active buff continues until expiry; the spell is simply no longer learnable or castable.
- What if a player has zero spells learned? → Spells tab shows an empty state with guidance on how to obtain spell books.
- What happens if a spell costs both items and gold, and the player has enough gold but not enough items? → Cast fails; no partial deduction occurs.
- Duration display: durations are shown in human-readable format (e.g., "2h 30min", "45min", "10s").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support defining spells with: name, icon, description, effect type, effect values per level, duration (seconds), and resource costs (items and/or gold) per level.
- **FR-002**: Spell effect types MUST include: attack% bonus, defence% bonus, critical chance% bonus, critical damage% bonus, flat heal, movement speed bonus, and energy grant.
- **FR-003**: Spells MUST have up to 5 levels, with each level able to override effect value, duration, and resource cost.
- **FR-004**: System MUST support a new item category for spell books that link to spell definitions.
- **FR-005**: Using a spell book MUST follow the same training mechanic as existing skill books (progress points, level-up at 100pts, 6-hour cooldown, random point rolls).
- **FR-006**: Players MUST be able to view all their learned spells in a dedicated Spells tab next to the Loadout tab.
- **FR-007**: Players MUST be able to cast a spell on themselves, consuming the required resources and applying the buff.
- **FR-008**: Players MUST be able to cast a spell on another player who is in the same location, via the player detail modal.
- **FR-009**: Casting a spell MUST validate resource availability atomically — no partial deductions if any resource is insufficient.
- **FR-010**: Active spell buffs MUST be tracked with real-time countdown timers and persisted server-side to survive reconnects and server restarts.
- **FR-011**: All spell durations MUST be displayed in human-readable format (e.g., "1h 19min", "45min").
- **FR-012**: An active buff MUST only be replaced by the same spell at an equal or higher level — lower-level casts are rejected.
- **FR-013**: Spell buffs MUST modify the player's effective stats for the buff duration, affecting combat and movement as appropriate.
- **FR-014**: XP progress MUST be relocated from a horizontal bar to a circular progress ring around the level indicator, with exact values shown on hover.
- **FR-015**: Active buffs MUST be displayed as icons with remaining-time progress bars in the area vacated by the XP bar.
- **FR-016**: Hovering a buff icon MUST show a styled tooltip with spell name, effect, and remaining duration.
- **FR-017**: Admin MUST be able to create, edit, and delete spells through a dedicated admin panel section.
- **FR-018**: System MUST provide an admin command `/spells.all <player>` to grant all defined spells to a player.
- **FR-019**: The existing `/skill_all` admin command MUST be renamed to `/abilities.all` for naming consistency.
- **FR-020**: Casting spells MUST be blocked while a player is in combat.
- **FR-021**: When a player with active buffs reconnects, all non-expired buffs MUST be restored with correct remaining duration.

### Key Entities

- **Spell Definition**: A template defining spell name, icon, description, effect type, base stats, and per-level overrides. Similar structure to abilities but without combat-specific fields (no mana cost, no slot type, no cooldown turns). Has resource cost configuration per level.
- **Spell Level**: Per-level stat overrides for a spell (effect value, duration, resource cost).
- **Character Spell**: Tracks which spells a character has learned, current level, and training progress (points, cooldown).
- **Active Spell Buff**: A time-limited buff applied to a character, tracking spell reference, caster, level, effect details, and expiry timestamp.
- **Spell Book Item**: An item definition with a new category linking to a specific spell (analogous to skill books for abilities).
- **Spell Cost**: Per-level cost definition specifying one or more required item types (each with quantity) and/or a gold amount. A single level can require multiple different items (e.g., 2x Iron Bar + 1x Ruby + 50 gold).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can learn a new spell and cast it on themselves within 30 seconds of having the required resources.
- **SC-002**: Active buff duration countdowns are accurate to within 1 second of real time across reconnections and server restarts.
- **SC-003**: Players can cast a spell on another player in the same location within 3 clicks from the player detail modal.
- **SC-004**: All spell durations display in human-readable format consistently across all UI surfaces (spell detail, buff tooltip, buff bar).
- **SC-005**: Resource deduction for spell casting is atomic — either all resources are consumed and the buff applies, or nothing changes.
- **SC-006**: Admin can define a complete spell (all 5 levels with costs) within 5 minutes using the admin panel.
- **SC-007**: The XP circular progress ring accurately reflects XP progress and shows exact values on hover.
- **SC-008**: Buff replacement rules are enforced — same spell at equal or higher level replaces; lower level is always rejected.

## Clarifications

### Session 2026-04-07

- Q: If two different spells both buff the same stat (e.g., two spells both give +attack%), do they stack? → A: Yes, different spells stack additively. Each spell is tracked independently; only same-spell replacement rules apply.
- Q: Is there a cooldown between casting the same spell (separate from the training cooldown)? → A: No cast cooldown. Resource cost is the only gate — players can recast freely to refresh duration as long as they have resources.
- Q: Should building-scope and map-scope spells (mentioned in original design doc) be included? → A: No, explicitly deferred. This feature covers character-targeted spells only. Building/map scope is a future feature.
- Q: Can a spell level require multiple different item types as cost? → A: Yes, multiple item types plus optional gold per level (e.g., 2x Iron Bar + 1x Ruby + 50 gold).

## Assumptions

- Spell training uses the same point progression as skill books: 60%→10pts, 30%→20pts, 9%→30pts, 1%→50pts; 100pts per level; max level 5; 6-hour cooldown per spell after book use.
- Spell effects that grant flat values (heal, energy) are applied once at cast time, not over duration. Percentage-based buffs (attack%, defence%, crit%) persist for the duration.
- Movement speed buff affects the same movement speed stat already used by the energy system.
- A player can have multiple different spell buffs active simultaneously (e.g., a haste buff and an attack buff), but only one instance of each specific spell. Multiple spells affecting the same stat stack additively (e.g., two different spells each giving +10% attack = +20% total).
- Buff persistence uses server-side expiry timestamps stored in the database; the server does not need a real-time tick loop — it checks on stat computation and on reconnect.
- The "Spells" tab appears next to "Loadout" in the game UI's bottom panel area (or equivalent tab bar).
- Spell books use a new item category distinct from ability skill books to avoid confusion in the use handler.
