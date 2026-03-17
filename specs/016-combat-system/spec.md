# Feature Specification: Combat System — Mana Threshold Auto-Battle

**Feature Branch**: `016-combat-system`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Use @combat-system-design.md for specification of new fight system that i want to implement..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Auto-Battle with Mana-Triggered Abilities (Priority: P1)

A player exploring the world encounters an enemy. Combat begins automatically. Each turn the player and enemy exchange auto-attacks. Dealing and receiving damage generates mana, which accumulates until it meets an equipped ability's threshold — at which point that ability fires automatically. The player can also trigger one manually-activated ability from their active slot at the right moment. Combat ends when either side reaches 0 HP.

**Why this priority**: This is the entire combat engine. Every other story depends on this loop working correctly.

**Independent Test**: Trigger combat against any enemy with at least one ability in an auto slot. Observe that turns resolve automatically, mana accrues, and auto-abilities fire when thresholds are met. A win/loss outcome is reached.

**Acceptance Scenarios**:

1. **Given** a player with a weapon and at least one ability in an auto slot, **When** they encounter an enemy, **Then** combat begins and turns alternate automatically until one side reaches 0 HP.
2. **Given** a player with Mana on Hit equipment, **When** their auto-attack lands, **Then** their mana increases by that stat's value.
3. **Given** a player with Mana on Damage Taken equipment, **When** the enemy hits them, **Then** their mana increases by that stat's value.
4. **Given** a player with a Mana Regen stat, **When** their turn begins, **Then** mana increases by the flat regen amount before any other action.
5. **Given** an ability in an auto slot costing 30 mana and the player reaches exactly 30 mana, **When** that turn's auto-ability resolution runs, **Then** the ability fires, mana is reduced by 30, and the effect is applied.
6. **Given** multiple abilities in auto slots with different costs and sufficient mana for all, **When** the turn resolves, **Then** all eligible abilities fire in descending priority order in a single turn.
7. **Given** an ability on cooldown when its mana threshold is met, **When** auto-resolution checks it, **Then** it does NOT fire; it skips until the cooldown expires.
8. **Given** an active-slot ability with sufficient mana and the player clicks the active button, **When** the action resolves, **Then** the ability fires, mana is consumed, and the cooldown timer starts.
9. **Given** an active-slot ability and insufficient mana, **When** the player views the active button, **Then** it is visually disabled and cannot be triggered.
10. **Given** either side's HP reaches 0, **When** combat ends, **Then** a win or loss outcome is shown and appropriate rewards are granted or withheld.

---

### User Story 2 — Pokemon-Style Combat UI (Priority: P2)

During combat the player sees a visual interface inspired by classic Pokemon battles: the enemy's placeholder sprite is displayed prominently in the upper area of the screen; the player's placeholder sprite is in the lower area. Both sides have clearly readable HP bars and mana bars. Each turn, events are narrated in a scrolling combat log. Ability activations, damage numbers, mana changes, dodges, and crits are all surfaced visually so the player understands exactly what happened without reading dense text.

**Why this priority**: Without a legible combat UI the core system is unplayable. The Pokemon-style framing is the primary UX requirement for the combat screen.

**Independent Test**: Enter combat against any enemy. Confirm the two-sided layout renders, both HP and mana bars update as turns resolve, all events appear in the combat log, and floating indicators show damage and mana changes.

**Acceptance Scenarios**:

1. **Given** combat starts, **When** the combat screen loads, **Then** the enemy placeholder is visible in the upper half and the player placeholder in the lower half of the combat view.
2. **Given** a combat turn, **When** damage is dealt to either side, **Then** the corresponding HP bar animates to the new value and a floating damage number appears near the target.
3. **Given** a combat turn, **When** mana is gained, **Then** the mana bar fills and a "+N mana" indicator appears near it; when mana is consumed, a "−N mana" indicator appears.
4. **Given** an ability fires, **When** the event resolves, **Then** the ability name and effect (e.g., "Power Strike — 47 damage!") appear in the combat log.
5. **Given** a critical hit, **When** it resolves, **Then** the damage number is styled distinctively (different colour or size) and the combat log notes "Critical Hit!".
6. **Given** a dodge, **When** an attack is avoided, **Then** "Dodge!" appears near the dodging character and the combat log records the miss.
7. **Given** a buff or debuff being applied, **When** it activates, **Then** an icon or label shows the active effect and its remaining turn duration.
8. **Given** multiple events in one turn, **When** the turn resolves, **Then** all events are appended to the combat log in resolution order and older entries scroll upward.
9. **Given** the active ability button, **When** the ability is on cooldown, **Then** a countdown timer is shown on the button and it is non-interactive.

---

### User Story 3 — Player Loadout Management (Priority: P2)

In the character panel there is a "Loadouts" tab alongside Inventory and Equipment. The player can see all abilities they own and assign them to the 3 auto slots or the 1 active slot. They can set priority order for auto-slotted abilities. Each ability in the list shows its mana cost, effect type, cooldown, and a brief description. All abilities are available to all characters regardless of class. The loadout is locked and uneditable while a combat session is active.

**Why this priority**: Without loadout management players cannot configure their combat build — the mana and ability system becomes meaningless.

**Independent Test**: Open the Loadouts tab, assign one ability to each auto slot, assign one to the active slot, save, enter combat, and confirm all four abilities are present and behave according to their configuration.

**Acceptance Scenarios**:

1. **Given** the character panel is open, **When** the player selects the "Loadouts" tab, **Then** a view showing 3 auto slots, 1 active slot, and a scrollable list of owned abilities is displayed.
2. **Given** owned abilities in the list, **When** the player assigns an ability to an auto slot, **Then** the slot shows the ability name, mana cost, and a priority control.
3. **Given** an ability already in a slot, **When** the player assigns a different ability to that same slot, **Then** the displaced ability returns to the available pool.
4. **Given** multiple abilities in auto slots, **When** the player adjusts priority values, **Then** the new order is saved and used in the next combat.
5. **Given** the active slot, **When** the player places an ability there, **Then** it is usable only via manual trigger during combat.
6. **Given** any character regardless of class, **When** they open the Loadouts tab, **Then** all available abilities in the game are visible and assignable.
7. **Given** a player with no owned abilities, **When** they open the Loadouts tab, **Then** slots are empty and a guidance message explains how to acquire abilities.
8. **Given** a player with an active combat session in progress, **When** they open the Loadouts tab, **Then** all slot controls are read-only and a message indicates the loadout is locked until combat ends.

---

### User Story 4 — Admin Ability Configuration (Priority: P3)

An admin opens the admin panel, navigates to an "Abilities" section, and sees all abilities defined in the system. They can edit any ability's display properties (name, icon, description) and gameplay values (mana cost, effect value, cooldown, priority default) and save the changes. The ability type (damage/heal/buff/etc.) is read-only — only changeable in code. All default abilities are pre-loaded when the system first runs.

**Why this priority**: Admin configurability is important for ongoing tuning but does not block the core game loop. It can be refined iteratively after the core is stable.

**Independent Test**: In the admin panel change the mana cost and effect value of an existing ability, save, then enter combat in the game client and confirm the updated values are used.

**Acceptance Scenarios**:

1. **Given** the admin panel, **When** the admin navigates to the Abilities section, **Then** a list of all abilities is shown with their current name, icon, cost, effect value, cooldown, and description.
2. **Given** an ability in the admin list, **When** the admin edits its mana cost and saves, **Then** subsequent combats use the new mana cost.
3. **Given** an ability, **When** the admin uploads a new icon and saves, **Then** the new icon is displayed for that ability in game clients.
4. **Given** any ability, **When** the admin views its edit form, **Then** the effect type field is read-only (displayed but not editable).
5. **Given** the admin panel is first set up, **When** the Abilities section loads, **Then** the 9 default abilities (Power Strike, Mend, Iron Skin, Venom Edge, Battle Cry, Shatter, Execute, Reflect, Drain Life) are pre-loaded with their design-document properties.

---

### Edge Cases

- What happens when a player enters combat with no abilities equipped? Auto-attacks still resolve; mana accumulates but nothing fires; combat is winnable through raw stats alone.
- What happens if mana regen or an on-hit event would push mana above max mana? Mana is capped at max; the excess is silently discarded.
- What happens if two auto-abilities share the same priority value? They resolve alphabetically by name as a stable tiebreaker.
- What happens when the player is defeated? A defeat screen is shown; the player retains 1 HP and is returned to their current location with no further penalty.
- What happens if an admin sets an ability's effect value to 0? The ability still fires and consumes mana but has no impact; the admin is responsible for valid values.
- What happens if the player disconnects mid-combat? The combat session continues turn-by-turn on the server in fully automated mode (no active ability inputs accepted) until it concludes. The outcome is stored to the database when combat ends so the player sees the result on reconnect. If the server restarts while combat is in-memory, the session is lost and treated as a forfeit.
- What happens if a DoT's remaining ticks outlast the target's HP going to 0? DoT stops applying once the target is at 0 HP; combat ends on the killing blow.
- What happens if the active ability button is clicked multiple times rapidly? Only the first click per player turn registers; subsequent clicks are ignored.
- What happens if the turn timer expires before the player uses the active ability? The active ability window closes, the active ability is skipped for that turn, and the enemy turn begins immediately.

## Requirements *(mandatory)*

### Functional Requirements

**Combat Engine**

- **FR-001**: The system MUST implement server-authoritative, real-time turn-based combat — each turn is resolved and broadcast to the client as it happens, never batch-computed and streamed after the fact. Combat session state is held in-memory in Phase A; migrating to persistent storage to enable mid-combat joining is deferred to a future feature.
- **FR-002**: Each combat MUST start with the player's mana at 0, with mana accumulating through: Mana on Hit (when the player deals damage), Mana on Damage Taken (when the player receives damage), and flat Mana Regen gained at the start of each player turn.
- **FR-003**: Player mana MUST be capped at the character's Max Mana stat and MUST reset to 0 at the start of each new combat.
- **FR-004**: Each player turn MUST resolve in this exact order: (1) gain flat Mana Regen, (2) player auto-attack with dodge/crit resolution, (3) auto-ability resolution in descending priority, (4) active ability window — a fixed-duration timer during which the player may trigger their active ability; turn advances automatically when the timer expires or immediately if the player triggers the active ability, (5) tick active DoTs/buffs/debuffs.
- **FR-005**: Auto-abilities MUST fire when mana ≥ ability cost AND the ability is not on cooldown; firing consumes mana and starts the cooldown timer.
- **FR-006**: Multiple auto-abilities MAY fire in a single turn if mana permits; they resolve in descending priority order, each consuming mana before the next is checked.
- **FR-007**: The player MUST have exactly 3 auto-ability slots and 1 active-ability slot.
- **FR-008**: The active ability MUST fire only when the player explicitly triggers it during the active ability window of their turn, with mana ≥ cost and the ability off cooldown. If the timer expires without the player triggering it, the active ability is skipped for that turn.
- **FR-009**: Equipment MUST support these stats: Attack, Defence, Max HP, Max Mana, Mana on Hit, Mana on Damage Taken, Mana Regen, Dodge Chance, Crit Chance, Crit Damage.
- **FR-010**: Each ability definition MUST include: Name, Mana Cost, Effect Type, Effect Value, Duration (for timed effects), Priority, Cooldown, and Slot Type (auto / active / both).
- **FR-011**: The enemy turn MUST consist solely of an auto-attack against the player (damage reduced by player Defence). Enemies do NOT use mana or abilities in Phase A; enemy abilities are deferred to a later phase.
- **FR-012**: Combat MUST end when either side's HP reaches 0; victory applies rewards to the player and defeat returns the player to their location at 1 HP.
- **FR-013**: Dodge chance MUST be rolled per incoming attack; a successful dodge negates all damage from that hit.
- **FR-014**: Crit chance MUST be rolled per outgoing attack; a critical hit multiplies damage by the Crit Damage stat (defaulting to 1.5× when not specified by equipment).

**Abilities**

- **FR-015**: The system MUST ship with 9 default abilities pre-loaded: Power Strike, Mend, Iron Skin, Venom Edge, Battle Cry, Shatter, Execute, Reflect, Drain Life — with properties matching the design document.
- **FR-016**: Abilities MUST be obtainable through at least two acquisition sources at launch: monster drops and quest rewards.
- **FR-017**: All characters, regardless of class, MUST be able to equip and use any ability in the game.

**Loadout Panel**

- **FR-018**: The character panel MUST include a "Loadouts" tab alongside the existing Inventory and Equipment tabs.
- **FR-019**: The Loadouts tab MUST display the 3 auto slots, the 1 active slot, and a scrollable list of all abilities owned by the character.
- **FR-020**: A player MUST be able to assign any owned ability to any compatible slot (auto slots accept slot type "auto" or "both"; the active slot accepts "active" or "both").
- **FR-021**: A player MUST be able to set a numeric priority value for each auto-slotted ability; higher numbers fire before lower ones.
- **FR-022**: Loadout configuration MUST persist across sessions.
- **FR-022a**: The loadout MUST be locked (read-only) for the duration of an active combat session; the player cannot change slot assignments or priorities while a fight is in progress. Changes take effect before the next combat.

**Combat UI**

- **FR-023**: The combat screen MUST display an enemy placeholder figure in the upper area and a player placeholder figure in the lower area, in a two-sided Pokemon-style layout.
- **FR-024**: The combat screen MUST display HP bars for both the player and enemy that update in real time as damage is dealt.
- **FR-025**: The combat screen MUST display a mana bar for the player showing current/maximum mana, with visual tick marks at each equipped auto-ability's cost threshold.
- **FR-026**: The combat screen MUST display a scrolling combat log that records each event in resolution order: attacks, ability activations, mana changes, dodges, crits, and buff/debuff applications.
- **FR-027**: The active ability button MUST be labelled with the ability name, visually disabled when mana is insufficient or cooldown is active, show a cooldown countdown when on cooldown, and display a turn timer countdown during the active ability window so the player knows how long they have to act.
- **FR-028**: Each equipped auto-ability MUST be represented by a small indicator showing its name/icon and current status: ready, on cooldown (with timer), or insufficient mana.
- **FR-029**: Floating damage numbers MUST appear near the target whenever damage is dealt; floating mana change indicators (+N / −N) MUST appear near the mana bar when mana changes.
- **FR-030**: Critical hits and dodges MUST be visually distinguished in both floating indicators and combat log entries.

**Admin Panel — Ability Configuration**

- **FR-031**: The admin panel MUST include an Abilities section listing all defined abilities with their current properties.
- **FR-032**: Admins MUST be able to edit the following fields for any ability: name, icon (file upload), description, mana cost, effect value, cooldown, and default priority.
- **FR-033**: The ability effect type MUST be read-only in the admin panel; it can only be changed in code.
- **FR-034**: Saved ability changes MUST take effect for new combats immediately, without requiring a server restart or redeployment.

### Key Entities

- **Ability Definition**: Blueprint for a combat ability — name, icon URL, description, effect type (code-defined, read-only in admin), mana cost, effect value, duration (turns), cooldown (turns), priority default, slot type (auto/active/both).
- **Character Loadout**: The player's slot configuration — maps slot positions (auto-1, auto-2, auto-3, active) to ability definition IDs, with per-slot priority overrides. Owned abilities are a separate collection.
- **Character Combat Stats**: Derived stat block for a combat session — Max Mana, Mana on Hit, Mana on Damage Taken, Mana Regen, Dodge Chance, Crit Chance, Crit Damage — computed from all equipped gear.
- **Combat Session**: Live server-side state for an ongoing fight — current HP and mana for both sides, active buffs/debuffs (with duration countdown), ability cooldown timers, turn counter. Stored in-memory in Phase A. A future migration to persistent storage is required before mid-combat joining by other players can be supported.
- **Active Effect**: A buff, debuff, or DoT applied to a combatant during a fight — references the source ability, affected stat(s), magnitude, and remaining duration in turns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can enter combat, have abilities fire automatically through mana accumulation, and reach a win/loss outcome without any manual input — the economy player path is fully functional.
- **SC-002**: A player can manually trigger the active ability at the correct mana threshold in a new combat session without requiring instruction — the active button state (available/disabled/cooldown) is self-explanatory.
- **SC-003**: Every combat event (damage dealt, damage received, mana changes, ability activations, dodges, crits) is recorded in the combat log within the same turn it occurs — zero silent events.
- **SC-004**: An admin can change any editable ability property and see the update reflected in the next combat session with a single save action, without any deployment.
- **SC-005**: A player can navigate to the Loadouts tab, assign abilities to all 4 slots, and save the loadout in under 2 minutes on first use.
- **SC-006**: The combat UI conveys HP, mana, and the most recent turn's events at a glance without requiring the player to read the full combat log.
- **SC-007**: All 9 default abilities are present at launch and behave according to their design-document definitions.

## Clarifications

### Session 2026-03-13

- Q: Can combat be batch-computed and streamed, or must it be resolved turn-by-turn in real-time? → A: Combat MUST be resolved turn-by-turn in real-time (server-authoritative). Batch computation is not permitted because future versions require other players to be able to join mid-combat.
- Q: Does each player turn have a time limit for using the active ability, or does it pause until the player acts? → A: Auto-advancing timer — each player turn runs for a fixed duration; the active ability can be used at any point during that window; the turn advances automatically when the timer expires.
- Q: Where is combat session state stored — in-memory or persisted to DB? → A: In-memory only for Phase A. Future multi-player joining will require migrating session state to a persistent store; this is a known constraint deferred to a later feature.
- Q: Do enemies use the mana/ability system in Phase A? → A: No — enemies only auto-attack in Phase A. The ability system is player-side only; enemy abilities are deferred to a later phase.
- Q: Can a player change their loadout while combat is in progress? → A: No — the loadout is locked for the duration of an active combat session; changes take effect only before the next fight.

## Assumptions

- **Phase A only**: This specification covers Phase A of the combat design document. Phases B (pre-combat stances) and C (conditional ability programming) are explicitly out of scope.
- **Speed stat deferred**: The Speed stat is listed as optional in the design document and is excluded from this specification.
- **Turn timer default**: The default active-ability window duration is 15 seconds; this is a configurable server parameter, not a hardcoded value.
- **Combat session storage**: Combat session state is held in server memory only for Phase A. Persistent storage for session state (required for mid-combat joining and crash recovery) is deferred to a future feature.
- **Asynchronous PvP**: Phase A PvP is out of scope for the core implementation; combat is PvE-only in this phase.
- **Enemy abilities deferred**: Enemies only auto-attack in Phase A. The mana and ability system is player-side only. Enemy abilities are explicitly out of scope for this feature.
- **Placeholder visuals**: Combat figures are visual placeholders (coloured rectangles or silhouettes); sprite animations and visual polish are a separate future feature.
- **Ability acquisition — basic scope**: Drops from monsters are included at a basic implementation level (configurable drop rates); crafting is deferred to a follow-up feature.
- **Max Mana default**: Characters with no Max Mana equipment default to 100 mana.
- **Mana Regen default**: Characters with no Mana Regen equipment have 0 flat regen; mana accumulates only through hits.
- **Defeat penalty**: On defeat the player retains 1 HP and returns to their current location with no currency or item loss; this is intentionally lenient and can be changed later.
- **Icon storage**: Ability icons uploaded through the admin panel are stored alongside existing backend asset directories.
