# Feature Specification: Combat Fatigue System

**Feature Branch**: `035-combat-fatigue`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "Add combat fatigue system that triggers after X rounds, dealing escalating damage of Y per turn. Configurable per combat type via admin panel. Both parties take fatigue damage. Extensible for future items/buffs/skills. Visual fatigue timer and debuff display."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fatigue Activates During Prolonged Combat (Priority: P1)

A player is engaged in combat (monster, boss, PvP, or arena). After a configured number of rounds pass without either side winning, fatigue kicks in. Both the player and their opponent begin taking fatigue damage at the end of each round. The damage starts at a base amount and increases by a fixed increment every subsequent round. This continues until one side is defeated.

**Why this priority**: Core mechanic — without fatigue triggering and dealing escalating damage, the entire feature has no value. This is the fundamental game rule that prevents infinite stalling.

**Independent Test**: Start a combat encounter, let rounds pass beyond the fatigue threshold, and verify both combatants take increasing damage each round after the threshold.

**Acceptance Scenarios**:

1. **Given** a monster combat with fatigue configured to start at round 10 with base damage 5 and increment 3, **When** round 10 ends, **Then** both the player and the monster take 5 fatigue damage.
2. **Given** fatigue is active and base damage is 5 with increment 3, **When** round 11 ends, **Then** both combatants take 8 fatigue damage (5 + 3).
3. **Given** fatigue is active, **When** round 12 ends, **Then** both combatants take 11 fatigue damage (5 + 3 + 3), and so on each subsequent round.
4. **Given** a combat type with fatigue start round set to 0 (disabled), **When** combat proceeds, **Then** no fatigue damage is ever applied.
5. **Given** fatigue damage reduces a combatant's HP to 0 or below, **When** the round ends, **Then** that combatant is defeated normally (standard defeat/death flow).

---

### User Story 2 - Admin Configures Fatigue Per Combat Type (Priority: P1)

A game administrator opens the admin panel and configures fatigue settings independently for each combat type (monster combat, boss combat, PvP arena). For each type, the admin sets three values: the round at which fatigue begins (X), the base damage dealt on the first fatigue round, and the damage increment added each subsequent round. For example, base_damage=5, increment=3 means fatigue deals 5, 8, 11, 14... damage per round.

**Why this priority**: Equal to P1 because the mechanic is only useful if admins can tune it per combat type. Different combat types need different fatigue timings (e.g., bosses may allow longer fights than regular monsters).

**Independent Test**: Open the admin panel, set fatigue values for a specific combat type, save, then verify those values are used in the next combat of that type.

**Acceptance Scenarios**:

1. **Given** an admin is on the combat configuration page, **When** they set monster combat fatigue start to round 8 and increment to 4, **Then** the values are saved and applied to all new monster combats.
2. **Given** fatigue is configured differently for boss combat (round 15, increment 10) and monster combat (round 8, increment 4), **When** a player fights a boss, **Then** fatigue uses the boss combat settings.
3. **Given** an admin sets fatigue start round to 0 for PvP, **When** a PvP combat occurs, **Then** fatigue is effectively disabled for that combat type.
4. **Given** an admin changes fatigue settings, **When** a combat is already in progress, **Then** the change does not affect the ongoing combat (only new combats).

---

### User Story 3 - Fatigue Timer Visual (Priority: P2)

During combat, the player sees a fatigue timer displayed as a segmented progress bar. Each segment represents one round remaining before fatigue activates. As rounds pass, segments are consumed. This gives the player a clear visual countdown to when fatigue will begin dealing damage.

**Why this priority**: Important for player experience — players need to understand fatigue is coming so they can make tactical decisions (use potions, change strategy, etc.).

**Independent Test**: Enter combat, observe the fatigue timer bar, verify it shows the correct number of segments and counts down each round.

**Acceptance Scenarios**:

1. **Given** combat starts with fatigue set to activate at round 10, **When** the combat screen loads, **Then** a fatigue progress bar appears with 10 segments.
2. **Given** round 3 has just ended, **When** the player views the fatigue timer, **Then** 3 segments are consumed and 7 remain.
3. **Given** fatigue is disabled (start round = 0) for this combat type, **When** combat starts, **Then** no fatigue timer is displayed.

---

### User Story 4 - Fatigue Debuff Display (Priority: P2)

Once fatigue activates, a fatigue debuff icon appears in the debuff area alongside other active debuffs. The debuff shows the current fatigue damage being dealt per round. The damage amount displayed updates each round as it escalates.

**Why this priority**: Players need to understand what is happening once fatigue is active — how much damage they are taking and that it is increasing.

**Independent Test**: Let fatigue activate, verify the debuff icon appears with correct damage numbers, and that the number updates each subsequent round.

**Acceptance Scenarios**:

1. **Given** fatigue activates on round 10, **When** round 10 ends, **Then** a fatigue debuff icon appears on both the player and opponent showing the current fatigue damage.
2. **Given** fatigue is active and dealing 8 damage this round, **When** the next round ends, **Then** the debuff tooltip/value updates to show the new higher damage amount.
3. **Given** fatigue has not yet activated, **When** the player checks their debuffs, **Then** no fatigue debuff is visible.

---

### User Story 5 - Extensibility for Future Fatigue Modifiers (Priority: P3)

The fatigue system is designed so that future items, buffs, or skills can modify fatigue behavior. This includes delaying fatigue onset (adding extra rounds before it starts), granting temporary fatigue immunity (skipping fatigue damage for N rounds), or reducing fatigue damage. The current implementation does not include any such modifiers, but the data model and logic must accommodate them.

**Why this priority**: No immediate user-facing value, but the system architecture must support this to avoid costly rewrites when fatigue-modifying items are introduced.

**Independent Test**: Verify that the fatigue calculation consults modifier values (even if all modifiers are currently zero/empty), and that adding a modifier value changes the fatigue behavior accordingly.

**Acceptance Scenarios**:

1. **Given** no fatigue modifiers exist on a character, **When** fatigue triggers, **Then** it behaves identically to the base configuration (no delay, no immunity, no reduction).
2. **Given** a character has a fatigue onset delay of +3 rounds (from a future buff), **When** fatigue would normally start at round 10, **Then** it starts at round 13 instead.
3. **Given** a character has temporary fatigue immunity for 2 rounds, **When** fatigue activates, **Then** the character takes no fatigue damage for the first 2 fatigue rounds, then takes normal escalating damage.

---

### Edge Cases

- What happens when fatigue damage exceeds a combatant's remaining HP? The combatant is defeated — standard defeat logic applies.
- What happens if both combatants are defeated by fatigue in the same round? The attacker (player who initiated combat) wins in PvE. In PvP, the defender wins (defender advantage on simultaneous KO).
- What happens when fatigue start round is set to 1? Fatigue begins on the very first round — effectively immediate fatigue from the start.
- What happens when the damage increment is 0? Fatigue deals a flat amount each round (no escalation) — this is a valid configuration for a constant pressure mechanic.
- What if a combat ends before fatigue activates? No fatigue effect occurs; the timer simply never completes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST apply fatigue damage to both combatants at the end of each round once the fatigue threshold round is reached.
- **FR-002**: Fatigue damage MUST start at the configured base amount and increase by the configured increment each subsequent round (formula: on round N after fatigue starts, damage = base_damage + (N - 1) * increment).
- **FR-003**: System MUST support independent fatigue configuration (start round and damage increment) for each combat type: monster, boss, PvP arena.
- **FR-004**: Admin panel MUST provide a configuration interface for fatigue settings per combat type.
- **FR-005**: Fatigue configuration changes MUST NOT affect combats already in progress.
- **FR-006**: The combat screen MUST display a segmented progress bar showing rounds remaining until fatigue activates.
- **FR-007**: Once fatigue activates, a debuff icon MUST appear in the debuff display area showing current fatigue damage per round.
- **FR-008**: The fatigue debuff display MUST update each round to reflect the escalating damage amount.
- **FR-014**: Each round that fatigue damage is applied, the combat log MUST display a distinct entry for each combatant showing the fatigue damage dealt (e.g., "Fatigue deals 8 damage to Player.").
- **FR-009**: Setting fatigue start round to 0 MUST disable fatigue for that combat type (no timer displayed, no damage applied).
- **FR-015**: Once fatigue activates, the segmented progress bar MUST remain visible but change appearance (e.g., turn red, pulse) to indicate fatigue is now active. The timer and debuff icon are both displayed simultaneously.
- **FR-010**: Fatigue damage MUST be able to defeat a combatant (reduce HP to 0 triggers standard defeat).
- **FR-011**: The fatigue system MUST support modifier values (onset delay, temporary immunity, damage reduction) for future extensibility, even if no modifiers are available at launch.
- **FR-012**: In the event of simultaneous fatigue KO, the system MUST resolve the winner deterministically (combat initiator wins in PvE; defender wins in PvP).
- **FR-013**: Fatigue damage MUST bypass normal defense/armor — it is true damage that can only be mitigated by fatigue-specific modifiers.

### Key Entities

- **Fatigue Configuration**: Per-combat-type settings including fatigue start round, base damage, and damage increment. Managed by admins. One configuration entry per combat type.
- **Fatigue State**: Per-combat-session tracking of current round counter, whether fatigue is active, current fatigue damage amount, and any modifier effects (onset delay, immunity rounds remaining, damage reduction). Exists only for the duration of a combat.
- **Fatigue Modifier**: A set of values (onset delay bonus, immunity rounds, damage reduction percentage) that can be applied to a combatant's fatigue state. Initially all zero; designed to be populated by future items/buffs/skills.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of prolonged combats (exceeding fatigue threshold) result in fatigue damage being applied to both combatants, preventing indefinite stalling.
- **SC-002**: Admins can configure fatigue settings for any combat type in under 30 seconds via the admin panel.
- **SC-003**: Players can visually determine rounds remaining until fatigue within 2 seconds of glancing at the combat screen (fatigue timer is immediately readable).
- **SC-004**: The fatigue debuff accurately displays current damage amount, updating each round with zero visual delay.
- **SC-005**: No combat can last indefinitely — every combat type either has fatigue enabled or is explicitly configured with fatigue disabled by admin choice.

## Clarifications

### Session 2026-04-06

- Q: Should fatigue use two separate config values (base_damage + increment) or a single value Y? → A: Two separate values — base_damage for first fatigue round, increment added each subsequent round. Gives admins more tuning control.
- Q: Should fatigue damage appear in the combat log? → A: Yes, as distinct entries each round for both combatants.
- Q: What happens to the fatigue timer bar once fatigue activates? → A: Timer stays visible but changes appearance (red/pulse) to indicate fatigue is active. Displayed alongside the debuff icon.

## Assumptions

- Fatigue damage is applied after all other combat actions in a round (attacks, abilities, buffs) but before defeat/death checks.
- The fatigue damage formula is: on the Nth fatigue round (N starting at 1), damage = base_damage + (N - 1) * increment. So the first fatigue round deals base_damage, the second deals base_damage + increment, etc.
- Fatigue damage bypasses armor/defense — it is true damage that cannot be mitigated (except by future fatigue-specific modifiers).
- All combat types that exist in the game (monster, boss, PvP/arena) will have fatigue configuration entries. New combat types added in the future should also receive fatigue configuration.
- Fatigue affects monsters, bosses, and other players equally — there is no inherent resistance for non-player entities.
- Fatigue configuration uses three values per combat type: start_round (X), base_damage, and damage_increment. The first fatigue round deals base_damage; each subsequent round adds damage_increment (e.g., base=5, increment=3 → 5, 8, 11, 14...).
