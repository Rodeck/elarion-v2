# Feature Specification: Boss Encounter System

**Feature Branch**: `027-boss-encounters`
**Created**: 2026-03-28
**Status**: Draft
**Game Design**: `game_design/boss-encounters/design.md`
**Scope**: Code changes only — entity creation (Boss Challenge Token, individual bosses) handled separately via `/gd.execute` and admin panel.

## Context

Bosses are persistent world enemies that guard specific buildings. While a boss is alive, all building actions (explore, gather, craft, expedition) are blocked for all players. Bosses are visible on the map, have hidden HP, use abilities, persist HP between fights, and only allow one challenger at a time. Players need a consumable Boss Challenge Token to initiate a fight. When defeated, bosses respawn after a configurable delay.

This spec covers the system infrastructure: data storage, backend services, combat variant, frontend display, and admin management tools. It does NOT cover the creation of specific boss entities or items — those are handled through the game design execution pipeline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Boss Blocks Building Access (Priority: P1)

A player navigates to a building that has an active boss guarding it. All building actions are unavailable until the boss is defeated.

**Why this priority**: This is the core mechanic — without building blocking, bosses have no gameplay purpose. It must work before any other boss feature matters.

**Independent Test**: Create a boss assigned to a building, verify all building actions return a blocking message. Defeat the boss, verify actions become available.

**Acceptance Scenarios**:

1. **Given** a boss is alive and assigned to building X, **When** any player attempts to explore/gather/craft/expedition at building X, **Then** the action is rejected with a message indicating a guardian blocks the building.
2. **Given** a boss assigned to building X is defeated, **When** a player attempts any action at building X, **Then** the action proceeds normally.
3. **Given** a boss is in combat (another player fighting it), **When** a player attempts a building action, **Then** the action is still blocked (boss is not defeated yet).

---

### User Story 2 - Player Challenges a Boss (Priority: P1)

A player with a Boss Challenge Token approaches a boss on the map and initiates combat. The token is consumed, the boss is locked to that player, and combat begins with hidden enemy HP.

**Why this priority**: The challenge flow is the primary player interaction with the boss system and tightly coupled to Story 1.

**Independent Test**: Give a player a Boss Challenge Token, challenge an alive boss, verify token consumed, combat starts, boss locked.

**Acceptance Scenarios**:

1. **Given** a player has a Boss Challenge Token and the boss is alive, **When** the player clicks "Challenge", **Then** one token is consumed from inventory, boss status changes to "in combat", and combat begins.
2. **Given** a player has no Boss Challenge Token, **When** the player views the boss panel, **Then** the Challenge button is disabled with a message about needing a token.
3. **Given** a boss is currently being fought by another player, **When** a second player tries to challenge, **Then** the challenge is rejected with a message that the boss is already in combat.
4. **Given** a boss is defeated (respawn pending), **When** a player tries to challenge, **Then** the challenge is rejected and the remaining respawn time is shown.

---

### User Story 3 - Boss Combat with Hidden HP and Abilities (Priority: P1)

During boss combat, the player cannot see the boss's exact HP — only a rough bracket indicator. The boss uses abilities during its turns. Combat otherwise follows normal turn-based rules.

**Why this priority**: The combat experience is what makes bosses feel distinct from regular monsters. Hidden HP and abilities are core to the design.

**Independent Test**: Start a boss fight, verify HP bar shows brackets not numbers, verify boss fires abilities on its turns.

**Acceptance Scenarios**:

1. **Given** combat with a boss is active, **When** a turn result is displayed, **Then** the boss HP is shown as a bracket (full/high/medium/low/critical) without exact numbers.
2. **Given** a boss has abilities assigned, **When** the boss's turn occurs, **Then** the boss uses abilities based on priority order (highest priority first), subject to cooldown restrictions.
3. **Given** a boss has abilities on cooldown, **When** the boss's turn occurs, **Then** the boss uses its basic attack instead.
4. **Given** a player defeats the boss, **When** combat ends, **Then** XP, crowns, and loot from the boss's loot table are awarded. The boss instance is marked defeated and a respawn timer starts.
5. **Given** a player loses to the boss, **When** combat ends, **Then** the boss retains its current HP for the next challenger, the boss is unlocked, and the player sees a hint about the boss's remaining health bracket.

---

### User Story 4 - Boss Persistent HP Across Fights (Priority: P2)

When a player loses to a boss, the boss keeps its reduced HP. The next challenger faces a weakened boss. HP only resets on respawn.

**Why this priority**: Persistent HP creates the shared progression loop where multiple players chip away at a boss. Important but the system works without it (bosses would just be very hard 1v1 fights).

**Independent Test**: Fight a boss, deal damage, lose. Have a second player challenge — verify boss HP is reduced from previous fight.

**Acceptance Scenarios**:

1. **Given** Player A fights a boss and reduces it to 60% HP before losing, **When** Player B challenges the same boss, **Then** the boss starts at 60% HP (bracket shows "medium").
2. **Given** a boss is defeated, **When** the respawn timer expires, **Then** the boss respawns at full HP.
3. **Given** the server restarts while a boss has reduced HP, **When** the server comes back up, **Then** the boss resumes with its persisted HP value.

---

### User Story 5 - Boss Visible on Map (Priority: P2)

Alive bosses appear as sprites on the zone map, positioned in front of their assigned building. Clicking the boss opens an info panel showing status, difficulty hint, and challenge option.

**Why this priority**: Visual presence is key to the design fantasy but the system is functional without it (players could challenge from the building panel).

**Independent Test**: Assign a boss to a building, enter the zone, verify boss sprite appears. Click it, verify info panel opens.

**Acceptance Scenarios**:

1. **Given** a boss is alive and assigned to a building, **When** a player enters the zone, **Then** the boss sprite is rendered on the map near the building position.
2. **Given** a player clicks on a boss sprite, **Then** an info panel opens showing: boss name, description, status (guarding/in combat/defeated), and a Challenge button.
3. **Given** a boss is defeated, **When** a player views the map, **Then** the boss sprite is removed and the building shows the remaining respawn time.
4. **Given** a boss respawns, **When** players are in the zone, **Then** the boss sprite appears and all players receive a notification of the boss's return.

---

### User Story 6 - Boss Respawn Cycle (Priority: P2)

After defeat, a boss respawns within a configurable time range (random between min and max seconds). On respawn, it returns to full HP and resumes blocking its building.

**Why this priority**: Respawn creates the ongoing gameplay loop. Without it, bosses are one-time obstacles.

**Independent Test**: Defeat a boss, verify it transitions to defeated state with a respawn timer. Wait for timer to expire, verify boss respawns at full HP and blocks building again.

**Acceptance Scenarios**:

1. **Given** a boss is defeated, **Then** a random respawn time is calculated between the configured min and max seconds, and all players in the zone see the countdown.
2. **Given** the respawn timer expires, **Then** a new boss instance spawns at full HP, the building is blocked again, and all players in the zone are notified.
3. **Given** no players are in the zone when a boss respawns, **When** a player enters the zone later, **Then** the boss is shown as alive with its full HP.

---

### User Story 7 - Admin Creates and Manages Bosses (Priority: P2)

Game administrators can create boss definitions, assign stats/abilities/loot, assign to buildings, upload icons/sprites, and monitor live boss instances.

**Why this priority**: Without admin tools, no bosses can exist. But the admin panel is a tool for content creators, not end-user facing, so it follows the core player-facing stories.

**Independent Test**: Open admin panel, create a boss with stats, assign abilities, add loot, assign to building. Verify boss appears in game.

**Acceptance Scenarios**:

1. **Given** an admin opens the boss management panel, **Then** they see a list of all boss definitions with create/edit/delete options.
2. **Given** an admin creates a boss, **When** they fill in name, stats (HP, ATK, DEF), XP, crowns, building assignment, respawn range, **Then** the boss is saved and an instance spawns at the assigned building.
3. **Given** an admin views the abilities panel for a boss, **Then** they can add existing abilities with priority ordering and remove assigned abilities.
4. **Given** an admin views the loot panel for a boss, **Then** they can add items with drop chance and quantity, and remove loot entries.
5. **Given** an admin views the instances dashboard, **Then** they see each boss's current HP, status, current fighter (if any), total attempts, and respawn countdown.
6. **Given** an admin clicks "Force Respawn" on a defeated boss, **Then** the boss immediately respawns regardless of its timer.

---

### User Story 8 - Boss State Broadcast (Priority: P3)

All players in a zone see real-time boss state changes: when a boss enters combat, when it's defeated, when it respawns. Players don't need to refresh or re-enter the zone.

**Why this priority**: Real-time updates enhance the shared-world feel but the system functions without them (players would see updated state on next zone entry).

**Independent Test**: Have two players in the same zone. Player A challenges a boss — verify Player B sees the status change to "in combat" without any action.

**Acceptance Scenarios**:

1. **Given** Player A challenges a boss, **When** combat starts, **Then** all other players in the zone see the boss status update to "In Combat with [PlayerA]".
2. **Given** a boss is defeated, **Then** all players in the zone see the boss disappear and the respawn timer appear.
3. **Given** a boss respawns, **Then** all players in the zone see the boss sprite appear and receive a notification.

---

### Edge Cases

- What happens if a player disconnects mid-boss-fight? The fight ends as a loss — boss keeps current HP, instance unlocks for next challenger.
- What happens if the server crashes during a boss fight? Boss HP is persisted periodically. On restart, boss instance resumes at last persisted HP with status "alive" (combat session is lost).
- What happens if an admin deletes a boss while it's being fought? The current combat ends (as a loss, no loot), the instance is cleaned up.
- What happens if an admin reassigns a boss to a different building while it's alive? The boss instance moves — old building unblocked, new building blocked, boss sprite repositions.
- What happens if two players send challenge requests at the exact same time? Only one succeeds — the lock is handled atomically. The second player receives "Another adventurer is already fighting this guardian."
- What happens if a boss has no abilities assigned? It fights using only basic attacks (same as regular monsters today).
- What happens if a boss has no loot entries? Player receives only XP and crowns on victory, no item drops.

## Requirements *(mandatory)*

### Functional Requirements

**Boss Definition & Storage**
- **FR-001**: System MUST store boss definitions with: name, description, combat icon, map sprite, stats (HP, ATK, DEF), rewards (XP, crown range), building assignment, respawn time range (min/max seconds), and active toggle.
- **FR-002**: System MUST store boss ability assignments linking bosses to existing abilities with a priority value for turn ordering.
- **FR-003**: System MUST store boss loot entries linking bosses to items with drop chance and quantity.

**Boss Instance Lifecycle**
- **FR-004**: System MUST maintain live boss instances tracking: current HP, status (alive/in_combat/defeated), current fighter, total attempts, spawn time, defeat time, and calculated respawn time.
- **FR-005**: System MUST spawn a boss instance at full HP when a boss definition is created or when a respawn timer expires.
- **FR-006**: System MUST persist boss instance HP to storage after each combat turn for crash recovery.
- **FR-007**: System MUST check respawn timers periodically and spawn new instances when timers expire.

**Building Blocking**
- **FR-008**: System MUST block all building actions (explore, gather, expedition, crafting) at a building when an alive or in-combat boss instance is assigned to it.
- **FR-009**: System MUST unblock building actions when the assigned boss is defeated (until respawn).

**Challenge Flow**
- **FR-010**: System MUST require exactly one Boss Challenge Token in the player's inventory to initiate a boss fight.
- **FR-011**: System MUST consume one Boss Challenge Token from inventory when combat begins.
- **FR-012**: System MUST prevent a boss challenge if the boss is already in combat, defeated, or inactive.
- **FR-013**: System MUST atomically lock a boss instance to a single player to prevent race conditions on simultaneous challenges.

**Boss Combat**
- **FR-014**: System MUST conduct boss combat using the same turn-based rules as regular combat (auto-attacks, active ability window, mana, effects).
- **FR-015**: System MUST NOT reveal the boss's exact HP to the player during combat — only a bracket indicator (full >80%, high 60-80%, medium 40-60%, low 20-40%, critical <20%).
- **FR-016**: System MUST execute boss abilities during the boss's turn based on priority ordering, gated by cooldowns (bosses have unlimited mana).
- **FR-017**: On player victory, system MUST award XP, crowns (random within range), and loot (rolled from boss loot table).
- **FR-018**: On player defeat, system MUST retain the boss's current HP for the next challenger and unlock the boss instance.
- **FR-019**: On player disconnect during boss combat, system MUST treat it as a defeat (FR-018 applies).

**Map Display**
- **FR-020**: System MUST render a boss sprite on the zone map at the assigned building's position when the boss is alive or in combat.
- **FR-021**: System MUST remove the boss sprite and show respawn information when the boss is defeated.
- **FR-022**: Clicking a boss on the map MUST open an info panel showing: name, description, status, and challenge option.

**Real-Time Updates**
- **FR-023**: System MUST broadcast boss state changes (combat start, defeat, respawn) to all players in the same zone in real time.

**Admin Management**
- **FR-024**: Administrators MUST be able to create, read, update, and delete boss definitions.
- **FR-025**: Administrators MUST be able to assign and remove abilities from bosses with configurable priority.
- **FR-026**: Administrators MUST be able to configure boss loot tables (add/remove items with drop chance and quantity).
- **FR-027**: Administrators MUST be able to upload boss combat icons and map sprites.
- **FR-028**: Administrators MUST be able to view all live boss instances with current state (HP, status, fighter, attempts, respawn timer).
- **FR-029**: Administrators MUST be able to force-respawn a defeated boss immediately.

### Key Entities

- **Boss Definition**: Template for a boss — name, stats, building assignment, respawn config. One definition produces one instance at a time.
- **Boss Ability Assignment**: Links a boss to an existing ability with a priority for turn ordering.
- **Boss Loot Entry**: Links a boss to an item with drop chance and quantity.
- **Boss Instance**: The live state of a spawned boss — current HP, status, current fighter, attempts counter, timestamps.

## Assumptions

- Boss abilities use the same effect system as player abilities (damage, heal, buff, debuff, dot, drain, reflect) — no new effect types needed.
- Bosses have unlimited mana; abilities are gated only by cooldowns. This keeps the system simple and avoids needing boss mana management.
- One boss per building maximum. Assigning a new boss to a building that already has one replaces the existing assignment.
- Boss combat uses the same turn timer (3 seconds) and active window (3 seconds) as regular combat.
- The Boss Challenge Token is a standard stackable resource item — no special item mechanics needed beyond consumption on challenge.
- Party boss battles are explicitly out of scope for this version. The single-player lock is designed to be replaceable with party support later.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can challenge and fight a boss within 5 seconds of clicking the Challenge button (combat loads and first turn begins).
- **SC-002**: Building actions are blocked within 1 second of a boss spawning and unblocked within 1 second of a boss being defeated.
- **SC-003**: Boss state changes (combat start, defeat, respawn) are visible to all players in the zone within 2 seconds.
- **SC-004**: 100% of simultaneous challenge attempts result in exactly one player entering combat (no race conditions).
- **SC-005**: Boss HP persists accurately across server restarts — no HP loss or gain on recovery.
- **SC-006**: Administrators can create a fully configured boss (stats, abilities, loot, icon, building assignment) in under 5 minutes using the admin panel.
- **SC-007**: Boss combat with abilities feels distinct from regular monster combat — players report that boss fights are more challenging and strategic.
