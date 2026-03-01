# Feature Specification: Elarion — Core Game Design

**Feature Branch**: `001-game-design`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Plan game design"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — New Player Enters the World (Priority: P1)

A first-time visitor registers an account, creates their character by choosing a
name and class, and arrives in the game world for the first time. They can see the
game map, their character's stats, and the starting area around them.

**Why this priority**: Without account creation and world entry, no other part of
the game is reachable. This is the single gate every player must pass through.

**Independent Test**: A tester can open the game in a browser, register an
account, pick a character class, and land on the starting map with a visible
character — without any other feature being implemented.

**Acceptance Scenarios**:

1. **Given** a visitor on the game's landing page, **When** they complete
   registration with a unique username and password, **Then** they are logged in
   and prompted to create a character.
2. **Given** a logged-in player on the character creation screen, **When** they
   choose a name and class and confirm, **Then** their character is created and
   placed on the starting map.
3. **Given** a player on the starting map, **When** the world loads, **Then**
   their character position, stats (health, level), and surrounding map tiles are
   visible.
4. **Given** a username already taken, **When** a new player registers with it,
   **Then** they see a clear error and are prompted to choose a different username.

---

### User Story 2 — Player Navigates the Game World (Priority: P2)

A logged-in player moves their character across the game world. The map updates
in real time as they move, revealing new areas. They can see other players
currently in the same area.

**Why this priority**: World exploration is the primary activity binding all other
gameplay together. Without movement, combat, trading, and social play are
unreachable.

**Independent Test**: A tester can log in, move their character in all directions,
and observe that the map updates and other connected players appear or disappear
as players enter or leave areas — without combat or progression being implemented.

**Acceptance Scenarios**:

1. **Given** a player on the map, **When** they issue a move command, **Then**
   their character moves to the target position and the map view updates within
   300ms as perceived by the player.
2. **Given** two players in the same area, **When** one player moves away, **Then**
   the departing player disappears from the other's view.
3. **Given** a player at the edge of a traversable zone, **When** they attempt to
   move into a blocked tile (wall, water, obstacle), **Then** the move is rejected
   and the character stays in place with a visual indication.
4. **Given** a player who loses connection mid-movement, **When** they reconnect,
   **Then** their character appears at the last server-confirmed position.

---

### User Story 3 — Player Initiates and Observes Automatic Combat (Priority: P3)

A player encounters a hostile NPC monster and initiates combat with a single
action (e.g., clicking "Attack" or moving into an aggro zone). From that point the
server automatically simulates the entire fight turn by turn using both parties'
statistics — no further player input is required or possible. The player watches
the combat log unfold and receives the outcome (loot, experience, defeat) when it
concludes.

**Why this priority**: Combat is the core progression engine. It must exist before
the character progression system and economy make sense.

**Independent Test**: A tester can navigate to a monster, trigger combat, watch
the server-simulated fight resolve automatically in a combat log, and receive
experience and loot on victory — without progression or economy systems being
active.

**Acceptance Scenarios**:

1. **Given** a player who triggers combat with a hostile NPC, **When** combat
   begins, **Then** the server simulates the fight turn by turn using both parties'
   stats, and the player sees a real-time combat log (who attacked, damage dealt,
   remaining health) without needing to take any action.
2. **Given** an ongoing simulated combat, **When** the monster's health reaches
   zero, **Then** the monster is removed from the map, the player receives
   experience points and any item drops, and a combat summary is shown.
3. **Given** an ongoing simulated combat, **When** the player's health reaches
   zero, **Then** the player is defeated and respawned at a designated safe
   location with a short cooldown; the monster resets to full health.
4. **Given** a client that sends repeated "start combat" requests for the same
   monster while a simulation is already in progress, **When** those duplicate
   requests arrive at the server, **Then** they are ignored and only one combat
   simulation runs. *(Anti-cheat / anti-abuse gate.)*

---

### User Story 4 — Character Gains Experience and Levels Up (Priority: P4)

After defeating enemies, a player's character accumulates experience points. When
enough experience is gained the character levels up: stats increase, new abilities
may unlock, and the world acknowledges the event.

**Why this priority**: Progression is the core retention mechanism without which
players have no long-term goal.

**Independent Test**: A tester can defeat a sufficient number of monsters, observe
the experience bar fill, and witness the level-up event and resulting stat
increase — without social or trading systems being implemented.

**Acceptance Scenarios**:

1. **Given** a player who defeats a monster, **When** experience is awarded,
   **Then** the experience total and experience bar update immediately.
2. **Given** a player whose experience reaches the threshold for their current
   level, **When** the threshold is crossed, **Then** the character's level
   increments, base stats increase according to class progression, and a level-up
   notification is shown.
3. **Given** a level-up that unlocks new abilities, **When** the level-up occurs,
   **Then** those abilities are added to the character's action bar and are
   immediately usable.

---

### User Story 5 — Players Communicate in Real Time (Priority: P5)

Players in the same area can send and read short text messages visible to everyone
in that area (local chat). A global channel visible to all connected players also
exists.

**Why this priority**: Multiplayer without communication is effectively a solo
game. Chat enables cooperation, community, and the social identity of Elarion.

**Independent Test**: Two testers in the same map area can exchange local
messages, while a third tester in a different area sees only global messages —
without combat or progression being required.

**Acceptance Scenarios**:

1. **Given** two players in the same map area, **When** one sends a local message,
   **Then** both players see it labelled with the sender's name within 500ms.
2. **Given** a player in any area, **When** they send a global channel message,
   **Then** all connected players see it regardless of location.
3. **Given** a player who sends more than 5 messages in 3 seconds, **When** the
   excess messages arrive at the server, **Then** they are rate-limited and the
   player sees a "slow down" notice.

---

### Edge Cases

- What happens when a player logs in from two browser tabs simultaneously?
  (Assumption: second login disconnects the first session with a notification.)
- What happens when the server rejects a move while the client has already
  rendered a position prediction? (Client MUST roll back to the last server-confirmed
  position.)
- What happens when a player disconnects during active combat? (Character remains
  in the world for a short grace period, then is safely removed; no permanent
  consequence if the grace period expires during NPC combat.)
- What happens when two players attack the same monster simultaneously?
  (Default: every player who dealt at least one hit receives full experience and
  their own independent loot roll; this encourages cooperative play in line with
  the economy-focused design.)
- What happens when a player tries to create a character name containing
  profanity or reserved words? (System rejects with a clear message.)
- What happens when the server is unreachable and the client cannot establish a
  connection? (A clear "Unable to connect" screen is shown; no partial game state
  is displayed.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow new visitors to register an account with a unique
  username and password.
- **FR-002**: System MUST authenticate registered players before granting access
  to the game world.
- **FR-003**: Players MUST be able to create a character by choosing a name and
  one of the available character classes.
- **FR-004**: System MUST place newly created characters in a designated starting
  area of the game world.
- **FR-005**: Players MUST be able to move their character across the game map;
  all movement MUST be validated server-side before taking effect.
- **FR-006**: System MUST render the visible portion of the game world around the
  player's current position, updating as the player moves.
- **FR-007**: System MUST display other players present in the same map area as
  the current player.
- **FR-008**: Players MUST be able to initiate combat against hostile NPC monsters
  in their area; all combat actions MUST be validated server-side.
- **FR-009**: System MUST calculate combat outcomes (damage, critical hits, misses)
  based on attacker and defender stats and apply the results to both parties.
- **FR-010**: System MUST award experience points upon defeating a monster and MUST
  automatically level up the character when the experience threshold is reached.
- **FR-011**: System MUST increase base stats upon levelling up according to the
  character's class progression table.
- **FR-012**: Players MUST be able to send local-area chat messages visible to all
  players in the same map zone.
- **FR-013**: Players MUST be able to send global channel messages visible to all
  connected players.
- **FR-014**: System MUST enforce rate limiting on player actions (movement,
  combat initiation, chat messages) to prevent bot behaviour and exploits.
- **FR-015**: System MUST persist each character's state (position, stats, level,
  experience, inventory) so it is restored correctly on reconnection.
- **FR-016**: System MUST resolve combat automatically using a server-side
  turn-based simulation: given the attacker's and defender's current stats, the
  server computes all rounds sequentially and streams the combat log to the
  player. No player input is required or accepted during an ongoing simulation.
- **FR-017**: System MUST support passive abilities and spells that activate
  automatically at configured thresholds during the combat simulation (e.g.,
  "cast Heal when HP drops below 30%"); players configure these before combat,
  not during it.
- **FR-018**: When multiple players are attacking the same monster simultaneously,
  each player who dealt at least one hit MUST receive the full experience reward
  and an independent loot roll upon the monster's defeat.

### Key Entities

- **Account**: A registered user identity. Attributes: username (unique), hashed
  credentials, registration date. Owns one character (expandable later).
- **Character**: A player's in-game avatar. Attributes: name, class, level,
  experience points, current and maximum health, attack power, defence rating,
  current zone and position. Belongs to one Account.
- **Character Class**: Template defining starting stats and progression. Examples:
  Warrior, Mage, Ranger. Attributes: class name, base stats, stat growth per
  level, starting abilities.
- **Map Zone**: A discrete area of the world. Attributes: zone identifier, tile
  layout, list of active players, list of active monsters, spawn points.
- **Monster**: A server-controlled hostile entity. Attributes: name, health,
  attack power, defence, experience reward, loot table, spawn zone, respawn timer.
- **Combat Event**: A single exchange in a fight. Attributes: attacker, defender,
  damage dealt, result (hit/miss/critical), timestamp.
- **Chat Message**: A message sent by a player. Attributes: sender name, message
  text, channel (local/global), timestamp.
- **Item**: An object dropped by monsters or acquired through play. Attributes:
  name, type (weapon/armour/consumable), stat modifiers, drop rate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can register, create a character, and appear on the
  game map in under 3 minutes from first visiting the game.
- **SC-002**: Player movement updates are visible to all players in the same area
  within 300ms under normal network conditions.
- **SC-003**: 100% of combat actions are validated server-side; no client-only
  damage calculation is accepted (verifiable via server audit log).
- **SC-004**: The system supports at least 200 concurrent players without
  observable degradation in movement or combat response times.
- **SC-005**: A player can complete the first 5 levels of character progression
  within a single 30-minute session, confirming an engaging early progression pace.
- **SC-006**: Chat messages are delivered to all recipients in the same zone within
  500ms of being sent.
- **SC-007**: Characters are restored to their last saved state on reconnection
  100% of the time for clean disconnects (no lost progress).

## Assumptions

- **Authentication**: Username and password with a persistent login session;
  third-party OAuth is not required at this stage.
- **Character limit**: One character per account initially; multiple characters
  may be added in a future iteration.
- **Classes at launch**: Three classes minimum (e.g., Warrior, Mage, Ranger);
  exact names, stats, and ability lists to be defined during the planning phase.
- **Map structure**: The world is divided into discrete zones; all players in the
  same zone share a real-time view of one another.
- **Combat model**: Combat is fully automatic and server-simulated. The player
  triggers it and observes the combat log; no manual actions are taken during the
  fight. Passive abilities/spells that auto-activate at stat thresholds are
  planned for a future iteration.
- **PvP scope**: Player-vs-player combat is out of scope for this design phase;
  all combat targets are NPC monsters.
- **Shared kill rewards**: Every player who participates in a kill (at least one
  hit) receives the full experience reward and an independent loot roll.
- **Inventory**: A basic item inventory exists for monster drops; player-to-player
  trading and a broader economy system (crafting, markets, resources) are planned
  as major future pillars but are out of scope for this foundational phase.
- **Monster aggro**: Monsters may initiate combat when a player enters their
  proximity range, in addition to player-triggered combat.
- **Future economy**: The game is designed to grow into a multi-pillar experience
  (combat + economy + social). This spec covers the combat and progression
  foundation only; economy features (trading, crafting, resources, markets) will
  be specified separately.
