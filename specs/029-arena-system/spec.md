# Feature Specification: Arena System

**Feature Branch**: `029-arena-system`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: Game design document `game_design/arena-system/design.md` — Code Changes Required section  
**Design Reference**: `game_design/arena-system/design.md` — Full game design with entity definitions, economy flow, and testing walkthroughs

## Context

The arena system introduces Elarion's first player-versus-player combat. Players enter a dedicated arena building where they can challenge other players (mandatory acceptance) and NPC fighters (token-gated). HP persists between fights, losers are kicked from the arena, and configurable timers govern minimum stay and re-entry cooldowns. This spec covers only the code changes needed to support the arena mechanic — entity creation (items, monsters, NPCs) is handled separately via `/gd.execute`.

---

## User Scenarios & Testing

### User Story 1 — Enter and Leave Arena (Priority: P1)

A player navigates to an arena building and clicks the "Enter Arena" action. They are removed from the map (invisible to other players), and see the arena lobby showing other participants and available fighters. After the minimum stay time elapses, they can leave and return to the map with a re-entry cooldown applied.

**Why this priority**: Core arena lifecycle — without entry/exit, nothing else works.

**Independent Test**: A single player can enter an arena, see the lobby, wait out the timer, and leave. Verifiable without any combat.

**Acceptance Scenarios**:

1. **Given** a player at an arena building, **When** they activate the arena action, **Then** they are removed from the zone player list, see the arena lobby with participant list and fighter list, and a countdown timer shows time until they can leave.
2. **Given** a player inside an arena who has waited past the minimum stay time, **When** they click "Leave", **Then** they are returned to the map at the arena building node, become visible to other zone players, and receive a re-entry cooldown.
3. **Given** a player with an active re-entry cooldown, **When** they try to enter the arena, **Then** they are rejected with a message showing the remaining cooldown time.
4. **Given** a player inside an arena before the minimum stay time, **When** they try to leave, **Then** the leave button is disabled and shows the remaining time.

---

### User Story 2 — PvP Combat (Priority: P1)

A player in the arena lobby challenges another player who is also in the arena. Combat begins immediately (no option to refuse). Both players see the combat UI with their opponent's stats. Combat uses simultaneous turns — both auto-abilities fire, both get an active ability window. The loser is kicked from the arena with a cooldown. The winner stays with their current HP (no healing).

**Why this priority**: PvP is the arena's primary purpose — without it, the feature has no value.

**Independent Test**: Two players enter the arena, one challenges the other, combat plays out to completion, loser is kicked, winner remains.

**Acceptance Scenarios**:

1. **Given** two players in the same arena neither in combat, **When** Player A challenges Player B, **Then** both enter combat immediately with no option to refuse.
2. **Given** an active PvP combat, **When** a turn resolves, **Then** both players' auto-abilities fire against the opponent, both receive an active ability window simultaneously, and both see updated HP/mana/effects.
3. **Given** a PvP combat where one player's HP reaches 0, **Then** that player loses, is removed from the arena, placed on the map at the arena building node, given a re-entry cooldown, and receives loser XP/crowns. The winner stays in the arena with their post-combat HP, receives winner XP/crowns, and their combat_wins counter increments.
4. **Given** both players reach 0 HP on the same turn, **Then** the challenger (initiator) wins.
5. **Given** Player A (level 30) tries to challenge Player B (level 10) in an arena with level bracket of 5, **Then** the challenge is rejected with a message indicating the level difference exceeds the allowed bracket.
6. **Given** a PvP combat in progress, **When** the winner returns to the arena lobby, **Then** their HP matches the post-combat value with no automatic healing applied.

---

### User Story 3 — NPC Fighter Challenge (Priority: P2)

A player in the arena challenges one of the assigned NPC fighters. This consumes one Arena Challenge Token from their inventory. Combat uses the standard PvE combat engine but the player enters with their current arena HP (not max HP). Winning keeps them in the arena with reduced HP. Losing kicks them out.

**Why this priority**: Adds a single-player PvE dimension to the arena and creates the token economy, but the arena can function with PvP alone.

**Independent Test**: A player with Arena Challenge Tokens enters the arena, challenges a fighter, combat resolves, token is consumed, HP persists.

**Acceptance Scenarios**:

1. **Given** a player in the arena with Arena Challenge Tokens, **When** they challenge an NPC fighter, **Then** one token is consumed and combat starts with the player's current arena HP.
2. **Given** a player with no Arena Challenge Tokens, **When** they view the fighter list, **Then** the challenge buttons are disabled with a message indicating tokens are required.
3. **Given** a player who wins an NPC fight, **Then** they return to the arena lobby with their post-combat HP, no loot or crowns are awarded, and standard monster XP is granted.
4. **Given** a player who loses an NPC fight, **Then** they are kicked from the arena, placed on the map, and given a re-entry cooldown.

---

### User Story 4 — Arena Lobby Live State (Priority: P2)

The arena lobby shows all current participants with their name, level, and class. Players currently in a fight display a "In Combat" indicator and cannot be challenged. When players enter or leave the arena, the lobby updates in real time for all participants.

**Why this priority**: Essential for usability — players need to see who they can challenge — but the raw mechanic works without polished live updates.

**Independent Test**: Three players enter an arena. Two fight. The third sees both marked as "In Combat". When the fight ends, the winner becomes challengeable again.

**Acceptance Scenarios**:

1. **Given** a player in the arena lobby, **When** another player enters the arena, **Then** the new player appears in the participant list within 1 second.
2. **Given** two players start a PvP fight, **When** other arena participants view the lobby, **Then** both fighters show an "In Combat" indicator and their challenge buttons are disabled.
3. **Given** a fight ends, **When** the loser is removed, **Then** the loser disappears from the participant list and the winner's "In Combat" indicator clears.

---

### User Story 5 — Map Visibility Toggle (Priority: P2)

Players inside the arena are invisible on the game map. Other players in the zone cannot see them, interact with them, or know they are online (from the map perspective). When a player leaves or is kicked from the arena, they reappear on the map.

**Why this priority**: Prevents confusion from ghost players on the map, but gameplay functions without it.

**Independent Test**: Player A is visible on the map. Player A enters arena. Player B in the same zone no longer sees Player A. Player A leaves arena. Player B sees Player A again.

**Acceptance Scenarios**:

1. **Given** Player A is on the map and Player B can see them, **When** Player A enters the arena, **Then** Player B receives a "player left zone" notification and Player A disappears from the map.
2. **Given** Player A is in the arena, **When** Player B joins the zone, **Then** Player A is not included in the zone's player list.
3. **Given** Player A is kicked from the arena, **Then** Player A reappears on the map and all zone players receive a "player entered zone" notification.

---

### User Story 6 — Admin Arena Management (Priority: P3)

An admin can create and configure arenas through the admin panel: set name, assign a building, configure reward amounts (winner/loser XP and crowns), set timers (minimum stay, re-entry cooldown), assign NPC fighters from the existing monster list, view current participants, and force-kick players.

**Why this priority**: Required for content deployment but can be done via direct database operations if the admin UI is delayed.

**Independent Test**: Admin creates an arena via the admin panel, configures it, assigns fighters, and the arena becomes available to players in-game.

**Acceptance Scenarios**:

1. **Given** an admin on the arena management page, **When** they create a new arena with a name, building, and reward/timer config, **Then** the arena is saved and available in-game.
2. **Given** an existing arena, **When** the admin assigns monsters to it, **Then** those monsters appear in the arena's fighter list for players.
3. **Given** an arena with active participants, **When** the admin force-kicks a player, **Then** the player is immediately removed from the arena, returned to the map, and given a cooldown.
4. **Given** an arena, **When** the admin changes winner XP from 50 to 100, **Then** subsequent PvP wins in that arena award 100 XP.

---

### User Story 7 — HP Persistence Across Fights (Priority: P1)

A player's HP carries over between all arena fights (both PvP and NPC). There is no healing between bouts. The HP shown in the arena lobby matches the player's actual current HP. When kicked from the arena, the player's map character HP matches their arena HP at the time of removal.

**Why this priority**: Core to the endurance mechanic that makes the arena meaningful — without it, there's no risk in staying.

**Independent Test**: Player enters at full HP, fights and wins (taking damage), fights again with reduced HP, verifies no healing occurred.

**Acceptance Scenarios**:

1. **Given** a player entering the arena at 500/500 HP, **When** they win a fight ending at 380 HP, **Then** the arena lobby shows 380/500 HP and the next fight starts at 380 HP.
2. **Given** a player at 200/500 HP in the arena, **When** they are kicked (by losing or admin action), **Then** their map character shows 200/500 HP.

---

### Edge Cases

- What happens if a player disconnects during an arena PvP fight? The disconnected player forfeits — treated as a loss. They are kicked from the arena with cooldown applied.
- What happens if both players disconnect during a fight? Both players are removed from the arena with cooldowns. No rewards are granted.
- What happens if a player's opponent disconnects mid-fight? The remaining player wins by forfeit, receives winner rewards, and stays in the arena.
- What happens if the arena is deleted or deactivated while players are inside? All participants are gracefully kicked, returned to the map, and no cooldown is applied (admin action, not player fault).
- What happens if a player tries to enter an arena while in combat or gathering? Entry is rejected with an appropriate message.
- What happens if the server restarts while players are in the arena? Arena participants are restored from persistent storage on server startup, preserving their HP and state. If a fight was in progress, it is cancelled — both players are returned to the arena lobby with their pre-fight HP (no rewards, no kick).

---

## Clarifications

### Session 2026-04-01

- Q: Can players access inventory (swap equipment, use items) between arena fights? → A: Full inventory access — players can heal, swap gear, use any item between fights.
- Q: Level disparity protection for PvP challenges? → A: Level bracket matching — players can only challenge opponents within N levels of their own (N is admin-configurable per arena).
- Q: What happens to in-progress arena combat on server crash? → A: Fight cancelled — both players returned to arena lobby with their pre-fight HP, no rewards, no kick.
- Q: Is re-entry cooldown per-arena or global? → A: Global — cooldown blocks entry to any arena, not just the one the player left.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST support a new `'arena'` building action type that transitions players from the map into an arena lobby.
- **FR-002**: System MUST track arena participants with their current HP, combat status, entry time, and earliest leave time in persistent storage.
- **FR-003**: System MUST remove arena participants from zone player broadcasts so they are invisible on the game map.
- **FR-004**: System MUST support PvP combat where both players attack simultaneously each turn, both can use auto-abilities and active abilities, and combat resolves using the existing combat engine's damage/ability formulas.
- **FR-005**: System MUST enforce mandatory challenge acceptance — when Player A challenges Player B (both in the same arena, not in combat, and within the allowed level bracket), combat begins immediately.
- **FR-022**: System MUST enforce level bracket matching for PvP challenges — a player can only challenge opponents whose level is within N levels of their own, where N is admin-configurable per arena. Challenges outside the bracket are rejected with a message indicating the level difference is too large.
- **FR-006**: System MUST preserve HP between arena fights — no automatic healing occurs between bouts. The player's post-combat HP is retained as the starting HP for subsequent fights. Players may manually use consumable items (heals, food) between fights per FR-021.
- **FR-007**: System MUST kick the losing player from the arena after any fight (PvP or NPC), return them to the map at the arena building node, and apply a re-entry cooldown.
- **FR-008**: System MUST enforce a configurable minimum stay time before a player can voluntarily leave the arena.
- **FR-009**: System MUST enforce a configurable re-entry cooldown after a player leaves or is kicked from the arena. The cooldown is global — it blocks entry to any arena, not just the one the player left.
- **FR-010**: System MUST consume one Arena Challenge Token from the player's inventory when challenging an NPC fighter, and reject the challenge if no tokens are available.
- **FR-011**: System MUST grant configurable XP and crown rewards to both winner and loser after PvP combat, with amounts set per arena by admins.
- **FR-012**: System MUST prevent players who are currently in combat from being challenged by other arena participants.
- **FR-013**: System MUST broadcast participant status changes (enter, leave, combat start, combat end) to all players in the same arena in real time.
- **FR-014**: System MUST provide admin CRUD operations for arenas: create, read, update, delete arena definitions with configurable name, building assignment, reward amounts, and timer durations.
- **FR-015**: System MUST allow admins to assign and remove NPC fighters (monsters) to/from arenas.
- **FR-016**: System MUST allow admins to view current arena participants and force-kick individual players.
- **FR-017**: System MUST increment the winner's `combat_wins` counter after a PvP victory.
- **FR-018**: System MUST sync the player's arena HP back to their character record when they leave or are kicked from the arena.
- **FR-019**: System MUST display a countdown timer in the arena lobby showing time remaining until the player can leave.
- **FR-020**: System MUST show an "In Combat" visual indicator on arena participants who are currently fighting.
- **FR-021**: System MUST allow players full inventory access while in the arena lobby (between fights) — including equipping/unequipping gear, using consumable items (heals, food), and viewing inventory. Inventory access is blocked only during active combat.

### Key Entities

- **Arena**: A configurable fighting venue linked to a building. Has reward amounts (winner/loser XP and crowns), timer durations (minimum stay, re-entry cooldown), level bracket range (max level difference for PvP challenges), active/inactive status, and a list of assigned NPC fighters.
- **Arena Participant**: A player currently inside an arena. Tracks their arena HP, combat status, entry time, earliest leave time, and who they are fighting (if anyone).
- **Arena Monster Assignment**: A link between an arena and a monster from the existing monster table, with display ordering.
- **Arena Building Action**: A building action of type `'arena'` with configuration pointing to a specific arena definition.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Two players can complete a full PvP arena fight (enter arena, challenge, combat, resolution, loser kicked) within 5 minutes of real time.
- **SC-002**: A player's HP after winning an arena fight matches exactly the HP they had when combat ended — no automatic healing occurs. HP changes between fights only if the player manually uses consumable items.
- **SC-003**: Players inside the arena are not visible to any other players on the game map — verified by a second player in the same zone seeing an empty map position.
- **SC-004**: Arena re-entry is blocked for the configured cooldown duration after leaving or being kicked — early re-entry attempts are rejected with remaining time shown.
- **SC-005**: NPC fighter challenges consume exactly one Arena Challenge Token per fight — token count decreases by 1 and challenge is blocked when count reaches 0.
- **SC-006**: Admin changes to arena rewards (XP, crowns) take effect on the next fight without requiring server restart.
- **SC-007**: Arena lobby updates (player enters, leaves, starts/ends fight) are visible to all other arena participants within 2 seconds.
- **SC-008**: Concurrent arena fights between different player pairs operate independently without interference.

---

## Assumptions

- The existing turn-based combat engine (damage formulas, ability resolution, effect system) is reusable for PvP with adaptation for symmetric turns — no fundamental engine rewrite is needed.
- PvP combat shows exact opponent HP (not bracket-hidden like boss combat) since both players are human and fairness requires transparency.
- Arena NPC fights use the standard PvE combat flow (asymmetric turns — player attacks, then monster attacks) rather than the PvP simultaneous model.
- Arena NPC fights award the monster's standard XP reward but no crowns and no loot drops — the value is in surviving for continued PvP.
- The `combat_wins` column (added in migration 028) is available on the characters table for PvP win tracking.
- Disconnection during combat is treated as a forfeit (loss) for the disconnected player.
- The arena does not affect ability loadouts — players use whatever loadout they had when entering.
- Players retain full inventory access between arena fights — they can heal with items, swap equipment, or use consumables. HP persistence means no automatic healing, but players may spend their own resources to recover.
- Server restart recovery restores arena participants from the persistent arena_participants storage. Any in-progress fights are cancelled — both combatants return to the arena lobby with their pre-fight HP (no rewards, no kick). This requires persisting pre-fight HP before combat starts.

---

## Constraints

- Must follow the existing "Adding a New Building Action Type" checklist in CLAUDE.md (7 locations across all packages).
- Must not modify the core combat engine's damage/ability formulas — PvP adapts the engine, not rewrites it.
- Entity creation (Arena Challenge Token item, 6 arena fighter monsters, Varn Bloodkeeper NPC) is out of scope for this spec — handled via `/gd.execute` after code is deployed.
- All arena configuration (rewards, timers) must be admin-configurable at runtime without code changes.

---

## Dependencies

- Existing combat system — combat engine, stats service, ability resolution
- Existing building action system — action type constraint, city-map-loader, building-action-handler
- Existing zone/player broadcast system — player visibility management
- Existing inventory system — token consumption on NPC challenge
- `combat_wins` column on characters table (migration 028)

---

## Out of Scope

- Arena rankings leaderboard
- Arena seasons / periodic reward resets
- Spectator mode for watching ongoing fights
- Team arenas (2v2, 3v3)
- Crafting recipes for Arena Challenge Tokens
- Arena-exclusive loot drops
- Any changes to the core PvE combat flow
