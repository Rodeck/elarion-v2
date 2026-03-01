---
description: "Task list for Elarion Core Game Design implementation"
---

# Tasks: Elarion — Core Game Design

**Input**: Design documents from `specs/001-game-design/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: Not requested — validation via quickstart.md checklist per user story.

**Organization**: Tasks grouped by user story (US1–US5) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US5)
- Exact file paths included in every task

## Path Conventions

- Backend: `backend/src/`
- Frontend: `frontend/src/`
- Shared protocol types: `shared/protocol/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the three-package monorepo. No user story can begin until
this phase is complete.

- [x] T001 Create monorepo root directory structure: `backend/`, `frontend/`, `shared/protocol/`, add root `.gitignore` covering `node_modules`, `.env`, `dist/`
- [x] T002 [P] Initialize backend TypeScript package: `backend/package.json` (Node 20, TypeScript 5, dependencies: `ws`, `pg`, `bcrypt`, `jose`, `fast-xml-parser`), `backend/tsconfig.json` (strict mode, target ES2022)
- [x] T003 [P] Initialize frontend TypeScript package: `frontend/package.json` (Vite, Phaser 3, TypeScript 5), `frontend/tsconfig.json`, `frontend/vite.config.ts`
- [x] T004 [P] Initialize shared protocol package: `shared/protocol/package.json`, `shared/protocol/tsconfig.json`; reference `shared/protocol` as local dependency in both `backend/package.json` and `frontend/package.json`
- [x] T005 Create backend environment config loader: `backend/src/config.ts` reads `DATABASE_URL`, `JWT_SECRET`, `WS_PORT`, `NODE_ENV` from process.env; add `backend/.env.example` with all required keys
- [x] T006 [P] Implement PostgreSQL connection pool: `backend/src/db/connection.ts` using `pg.Pool`, connects via `config.DATABASE_URL`, exports typed `query()` helper

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, seed data, WebSocket infrastructure, and logger.
Every user story depends on this phase being fully complete.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is done.

- [x] T007 Implement database migration runner: `backend/src/db/migrate.ts` — reads and executes SQL files from `backend/src/db/migrations/` in filename order; idempotent (tracks applied migrations in a `schema_migrations` table)
- [x] T008 Write migration `001_accounts.sql`: `id UUID PRIMARY KEY`, `username VARCHAR(32) UNIQUE NOT NULL`, `password_hash VARCHAR(255) NOT NULL`, `created_at TIMESTAMP DEFAULT now()`, `banned_at TIMESTAMP`; create index `LOWER(username)`
- [x] T009 [P] Write migration `002_character_classes.sql`: `id SMALLINT PRIMARY KEY`, `name VARCHAR(32) UNIQUE NOT NULL`, `base_hp`, `base_attack`, `base_defence`, `hp_per_level`, `attack_per_level`, `defence_per_level` (all SMALLINT NOT NULL), `xp_curve JSONB NOT NULL`
- [x] T010 [P] Write migration `003_map_zones.sql`: `id SMALLINT PRIMARY KEY`, `name VARCHAR(64) UNIQUE NOT NULL`, `tmx_filename VARCHAR(128) NOT NULL`, `width_tiles`, `height_tiles`, `spawn_x`, `spawn_y`, `min_level` (all SMALLINT NOT NULL)
- [x] T011 [P] Write migration `004_characters.sql`: `id UUID PRIMARY KEY`, `account_id UUID UNIQUE NOT NULL REFERENCES accounts(id)`, `name VARCHAR(32) UNIQUE NOT NULL`, `class_id SMALLINT REFERENCES character_classes(id)`, `level`, `experience` (INTEGER), `max_hp`, `current_hp`, `attack_power`, `defence`, `zone_id SMALLINT REFERENCES map_zones(id)`, `pos_x`, `pos_y` (all SMALLINT), `in_combat BOOLEAN DEFAULT false`, `updated_at TIMESTAMP`; indexes on `zone_id`, `account_id`
- [x] T012 [P] Write migration `005_game_entities.sql`: `monsters` table (id, name, zone_id, max_hp, attack_power, defence, xp_reward, loot_table JSONB, respawn_seconds, aggro_range); `items` table (id, name, type, stat_modifiers JSONB, description); `character_items` table (character_id, item_id, quantity, equipped) with composite PK
- [x] T013 [P] Write migration `006_combat.sql`: `combat_simulations` table (id UUID PK, character_id, monster_id, zone_id, started_at, ended_at, outcome VARCHAR(8), xp_awarded, rounds JSONB); `combat_participants` table (combat_simulation_id, character_id, damage_dealt) with composite PK; indexes on `character_id + outcome`
- [x] T014 [P] Write migration `007_chat_messages.sql`: `id UUID PK`, `sender_character_id UUID REFERENCES characters(id)`, `channel VARCHAR(8)`, `zone_id SMALLINT nullable`, `message VARCHAR(256) NOT NULL`, `sent_at TIMESTAMP NOT NULL`; indexes on `(zone_id, sent_at)` and `sent_at`
- [x] T015 Write seed file `backend/src/db/seeds/initial-data.ts`: insert 3 character classes (Warrior hp=120 atk=15 def=12; Mage hp=70 atk=25 def=6; Ranger hp=90 atk=20 def=9) with xp_curve `[0,100,250,500,900,1400]`; insert zone "Starter Plains" (id=1, tmx_filename="starter-plains.tmx", spawn 5,5, min_level=1); insert 5 starter monster templates (Slime, Goblin, Wolf, Bandit, Dark Elf); insert starter item table (5 items: Wooden Sword, Leather Armour, Health Potion, Iron Ring, Short Bow)
- [x] T016 Define all WebSocket message type interfaces in `shared/protocol/index.ts`: one TypeScript `interface` per message type from `contracts/websocket-protocol.md` (20 interfaces total: auth.register, auth.login, character.create, player.move, combat.start, chat.send for client→server; auth.success, auth.error, character.created, world.state, player.moved, player.move_rejected, player.entered_zone, player.left_zone, combat.started, combat.round, combat.ended, character.levelled_up, chat.message, server.error, server.rate_limited for server→client); export `WsMessage<T>` envelope type `{ type: string; v: 1; payload: T }`
- [x] T017 Bootstrap WebSocket server in `backend/src/websocket/server.ts`: create `ws.WebSocketServer` on `config.WS_PORT`, handle `upgrade` event (validate JWT before accepting), emit `open`/`close`/`message` lifecycle events with structured log on each, track active connections in a `Map<ws.WebSocket, AuthenticatedSession>`
- [x] T018 Implement message dispatcher in `backend/src/websocket/dispatcher.ts`: parse incoming JSON messages, validate `v === 1` (reject with `server.error PROTOCOL_VERSION` otherwise), route by `type` to registered handler functions; export `registerHandler(type, fn)` and `dispatch(session, raw)` functions
- [x] T019 Implement structured JSON logger in `backend/src/logger.ts`: thin wrapper exporting `log(level, subsystem, event, data?)` that writes `JSON.stringify({ts, level, subsystem, event, ...data})` to stdout; levels: `debug | info | warn | error`; `debug` suppressed when `NODE_ENV=production`

**Checkpoint**: Run `npm run db:migrate && npm run db:seed` in backend. PostgreSQL tables created. Run `npm run dev` — WebSocket server starts, logs `{"level":"info","subsystem":"ws","event":"listening","port":4000}`.

---

## Phase 3: User Story 1 — New Player Enters the World (Priority: P1) 🎯 MVP

**Goal**: A new visitor can register, create a character, and appear on the game map.

**Independent Test**: Open the game in a browser. Register as `tester1`. Create a Warrior named `Hero`. Verify the tile map loads and the character appears at spawn position (5,5) in Starter Plains. (quickstart.md §4 US1)

### Implementation — US1

- [x] T020 [P] [US1] Implement account DB query functions in `backend/src/db/queries/accounts.ts`: `insertAccount(username, passwordHash)`, `findByUsername(username)` (case-insensitive), `isBanned(accountId)` — all return typed results using shared Account interface
- [x] T021 [P] [US1] Implement character + class DB query functions in `backend/src/db/queries/characters.ts`: `insertCharacter(data)`, `findByAccountId(accountId)`, `updateCharacter(id, fields)`, `findAllClasses()`, `findClassById(id)` — return typed results
- [x] T022 [US1] Implement JWT utilities in `backend/src/auth/jwt.ts`: `signToken(accountId, characterId?)` returns signed JWT (10-min expiry, HS256, secret from config); `verifyToken(token)` returns decoded payload or throws; use `jose` library
- [x] T023 [US1] Implement `auth.register` message handler in `backend/src/auth/register-handler.ts`: validate username regex `[a-zA-Z0-9_]{3,32}`, password min 8 chars; check username not taken (case-insensitive); hash password with bcrypt; insert account; emit `auth.success`; on validation failure emit `auth.error` with appropriate code; log all outcomes via logger
- [x] T024 [US1] Implement `auth.login` message handler in `backend/src/auth/login-handler.ts`: find account by username; compare bcrypt hash; reject banned accounts; on success emit `auth.success` with fresh JWT and `has_character` flag; on failure emit `auth.error INVALID_CREDENTIALS`; log all outcomes
- [x] T025 [US1] Implement WebSocket auth gate in `backend/src/websocket/auth-gate.ts`: on HTTP upgrade request, extract JWT from `?token=` query string; call `verifyToken`; on success attach `AuthenticatedSession { accountId, characterId? }` to connection; on failure reject upgrade with HTTP 401; log all decisions
- [x] T026 [US1] Implement TMX zone loader in `backend/src/game/world/zone-loader.ts`: at server startup, for each zone in DB read the corresponding `*.tmx` file from `backend/assets/maps/`; parse XML with `fast-xml-parser`; extract tile layer (passability matrix: `boolean[][]`), object layer (spawn points, aggro zones); store in memory keyed by zone_id; export `getZone(id)` and `isPassable(zoneId, x, y)`; add `starter-plains.tmx` placeholder map (20×20 tiles, walkable except border tiles)
- [x] T027 [US1] Implement `character.create` message handler in `backend/src/game/world/character-create-handler.ts`: ensure account has no character (emit `server.error CHARACTER_EXISTS` otherwise); validate name regex; validate class_id in `{1,2,3}`; compute starting stats from CharacterClass template; insert character at zone 1 spawn (5,5); emit `character.created`; log outcome
- [x] T028 [US1] Implement `world.state` handler in `backend/src/websocket/handlers/world-state-handler.ts`: called after successful auth when character exists; serialise zone's active players (from zone-registry — built in US2 but mock empty array here) and monster instances (from monster-registry — built in US3 but mock empty array here) into `world.state` payload; emit to connecting player
- [x] T029 [P] [US1] Implement Phaser Boot scene in `frontend/src/scenes/BootScene.ts`: preload game assets (tileset image, character spritesheet, monster spritesheet, UI assets); on complete transition to LoginScene
- [x] T030 [P] [US1] Implement Login/Register scene in `frontend/src/scenes/LoginScene.ts`: render username + password form with tabs "Login" / "Register"; on submit create WSClient, connect to server (token='' for pre-auth), send `auth.register` or `auth.login`; on `auth.success` store JWT and transition to CharacterCreateScene (if !has_character) or GameScene; on `auth.error` show error text
- [x] T031 [P] [US1] Implement CharacterCreate scene in `frontend/src/scenes/CharacterCreateScene.ts`: display 3 class cards (Warrior/Mage/Ranger) with base stats from hardcoded class data; name input field; on confirm send `character.create`; on `character.created` transition to GameScene; on `server.error CHARACTER_EXISTS` skip to GameScene
- [x] T032 [US1] Implement WebSocket client in `frontend/src/network/WSClient.ts`: wrap browser `WebSocket`; connect to `ws://<host>:<port>/game?token=<jwt>`; `send<T>(type, payload)` serialises to envelope `{type, v:1, payload}`; `on(type, handler)` registers typed handler; auto-reconnect with exponential backoff (max 5 retries); emit `disconnected` event when all retries exhausted
- [x] T033 [US1] Implement Game scene initial render in `frontend/src/scenes/GameScene.ts`: on scene start, receive `world.state` via WSClient; load Tiled tilemap from TMX (embedded or fetched from backend static endpoint); render tile layer; place own character sprite at `my_character.pos_x, pos_y`; attach camera to character; instantiate StatsBar HUD
- [x] T034 [US1] Implement StatsBar HUD in `frontend/src/ui/StatsBar.ts`: Phaser DOM overlay showing character name, class, level, HP bar (`current_hp / max_hp`), XP bar (filled proportionally to next level); update methods `setHp(current, max)`, `setXp(current, threshold)`, `setLevel(n)`
- [x] T035 [US1] Add `auth.error` display in `frontend/src/scenes/LoginScene.ts`: map error codes (`USERNAME_TAKEN`, `INVALID_CREDENTIALS`, `USERNAME_INVALID`, `PASSWORD_TOO_SHORT`) to human-readable messages; display below form; clear on next submit attempt

**Checkpoint**: US1 fully functional — quickstart.md §4 US1 checklist passes.

---

## Phase 4: User Story 2 — Player Navigates the Game World (Priority: P2)

**Goal**: Logged-in players can move across the map and see each other in real time.

**Independent Test**: Log in as two accounts. Move characters. Each player sees the other appear/disappear as they enter/leave visibility. Walk into a wall — character stays put. (quickstart.md §4 US2)

### Implementation — US2

- [x] T036 [US2] Implement zone player registry in `backend/src/game/world/zone-registry.ts`: in-memory `Map<zoneId, Map<characterId, PlayerState>>` where `PlayerState = { characterId, name, classId, level, posX, posY, ws }`; export `addPlayer`, `removePlayer`, `getZonePlayers(zoneId)`, `getPlayerWs(characterId)`, `movePlayer(characterId, x, y)`; integrate with world.state handler (T028) to populate initial player list
- [x] T037 [US2] Implement `player.move` handler in `backend/src/game/world/movement-handler.ts`: look up player in zone registry; validate direction `n|s|e|w` → compute target (x,y); check `isPassable(zoneId, x, y)` (T026); check rate limit (≤10/sec per player); if valid: update zone registry + persist `pos_x, pos_y` to DB; broadcast `player.moved` to all zone players; if invalid: send `player.move_rejected` to requesting player with authoritative (x,y) and reason code; log every decision
- [x] T038 [US2] Implement move rate limiter in `backend/src/game/world/movement-rate-limiter.ts`: sliding window counter per `characterId`; limit = 10 requests/sec; returns `{ allowed: boolean, retryAfterMs?: number }`; used by movement-handler
- [x] T039 [US2] Implement zone entry/exit broadcasts in `backend/src/game/world/zone-broadcasts.ts`: `broadcastPlayerEntered(zoneId, playerState)` sends `player.entered_zone` to all existing zone players; `broadcastPlayerLeft(zoneId, characterId)` sends `player.left_zone` to remaining players; call `broadcastPlayerEntered` from `world-state-handler` (T028) after sending world.state to new player
- [x] T040 [US2] Implement player disconnect handler in `backend/src/websocket/disconnect-handler.ts`: on WS `close` event: start 5-second grace timer; if player does not reconnect within grace period, call `zone-registry.removePlayer` and `broadcastPlayerLeft`; cancel timer if reconnect occurs within grace period; log disconnection and removal
- [x] T041 [US2] Add keyboard movement input in `frontend/src/scenes/GameScene.ts`: listen to arrow keys and WASD via Phaser `CursorKeys`; on keydown send `player.move` with direction; apply client-side prediction (move sprite immediately); throttle to ≤10 sends/sec
- [x] T042 [US2] Render remote players in `frontend/src/entities/RemotePlayer.ts`: Phaser `Sprite` subclass showing player name label above sprite; `GameScene` handles `player.entered_zone` (create RemotePlayer), `player.moved` (update position), `player.left_zone` (destroy RemotePlayer)
- [x] T043 [US2] Implement client-side movement rollback in `frontend/src/scenes/GameScene.ts`: on receiving `player.move_rejected`, snap own character sprite to `payload.pos_x, pos_y`; display brief visual indicator (shake or flash)

**Checkpoint**: US1 + US2 both independently functional — quickstart.md §4 US2 checklist passes.

---

## Phase 5: User Story 3 — Player Initiates and Observes Automatic Combat (Priority: P3)

**Goal**: Player triggers combat with a monster; server simulates turn-by-turn and streams results; player receives loot on victory.

**Independent Test**: Move adjacent to a monster, click it, watch combat log stream with no player input. Victory shows XP/items. Defeat respawns at spawn point. (quickstart.md §4 US3)

### Implementation — US3

- [x] T044 [P] [US3] Implement monster instance registry in `backend/src/game/world/monster-registry.ts`: in-memory `Map<zoneId, Map<instanceId, MonsterInstance>>`; export `spawnInstance(zoneId, template)`, `getInstance(instanceId)`, `killInstance(instanceId)`, `getZoneMonsters(zoneId)`, `addParticipant(instanceId, characterId)`, `getParticipants(instanceId)`
- [x] T045 [P] [US3] Implement monster spawner in `backend/src/game/world/monster-spawner.ts`: on server startup, for each zone read monster templates from DB; spawn N instances per template at random passable tiles within zone; register in monster-registry; on kill: schedule `setTimeout(respawn, template.respawn_seconds * 1000)` which calls `spawnInstance` and broadcasts `monster.spawned` to zone players; log all spawn/despawn events
- [x] T046 [US3] Integrate monster list into `world.state` response in `backend/src/websocket/handlers/world-state-handler.ts`: call `monster-registry.getZoneMonsters(zoneId)` and serialise to payload (replaces empty-array placeholder from T028)
- [x] T047 [US3] Implement `combat.start` handler in `backend/src/game/combat/combat-controller.ts`: verify player not already `in_combat`; look up monster instance — must exist, not dead, `!in_combat`; verify player is adjacent (|Δx|+|Δy| ≤ 1); reject duplicates with `server.error DUPLICATE_COMBAT`; mark player and monster `in_combat = true`; create `CombatSimulation` DB record (status pending); emit `combat.started` to player; launch `runSimulation()` asynchronously; log all decisions
- [x] T048 [US3] Implement turn-based combat simulation engine in `backend/src/game/combat/combat-engine.ts`: `runSimulation(simulation, player, monster)` loop: each turn compute `damage = max(1, attacker.attack - defender.defence + randInt(-3,3))`; 5% chance critical × 1.5; 5% miss = 0 damage; swap attacker/defender; stop when either HP ≤ 0; return `CombatRound[]`
- [x] T049 [US3] Implement combat round streamer in `backend/src/game/combat/combat-streamer.ts`: wraps simulation engine; after each round emits `combat.round` message to all `CombatParticipant` WebSocket connections; adds 200ms delay between rounds for readability; on completion calls combat-end-handler
- [x] T050 [US3] Implement item DB query functions in `backend/src/db/queries/items.ts`: `findItemById(id)`, `insertCharacterItem(characterId, itemId, quantity)`, `updateCharacterItemQuantity(characterId, itemId, delta)`
- [x] T051 [US3] Implement combat end handler in `backend/src/game/combat/combat-end-handler.ts`: persist simulation rounds + outcome to DB; for each participant in `combat-registry.getParticipants(instanceId)`: roll loot independently per monster loot_table (each drop_chance_pct checked with `Math.random()`); call `xp-service.awardXp` (built in US4, stub returning 0 here); emit `combat.ended` to participant; if player defeated: reset `pos_x, pos_y` to zone spawn + emit updated world state to player; call `monster-registry.killInstance`; emit `monster.despawned` to zone; mark player `in_combat = false`; log full outcome
- [x] T052 [US3] Render monster sprites in `frontend/src/entities/MonsterSprite.ts`: Phaser `Sprite` subclass; show monster name + HP bar above sprite; `MonsterSprite.takeDamage(newHp)` animates HP bar; `MonsterSprite.destroy()` plays death animation; `GameScene` creates MonsterSprites from `world.state.monsters`, handles `monster.spawned` (create) and `monster.despawned` (destroy)
- [x] T053 [US3] Implement combat trigger UI in `frontend/src/scenes/GameScene.ts`: make MonsterSprites interactive (`.setInteractive()`); on click: if own character is adjacent (client-side proximity hint only — server validates) send `combat.start { monster_instance_id }`; disable clicks on self during combat
- [x] T054 [US3] Implement CombatLog HUD in `frontend/src/ui/CombatLog.ts`: scrollable panel that appends one line per `combat.round` message (format: `Round N: <attacker> hits <defender> for <damage> dmg (<result>). HP: player <x> / monster <y>`); on `combat.ended` append summary line (victory or defeat, XP, item drops); auto-scroll to bottom; persist 50 most recent lines
- [x] T055 [US3] Handle `server.error` rejection for combat in `frontend/src/scenes/GameScene.ts`: display tooltip on MonsterSprite explaining why combat was rejected (`MONSTER_NOT_ADJACENT`, `ALREADY_IN_COMBAT`, `DUPLICATE_COMBAT`)

**Checkpoint**: US1 + US2 + US3 independently functional — quickstart.md §4 US3 checklist passes.

---

## Phase 6: User Story 4 — Character Gains Experience and Levels Up (Priority: P4)

**Goal**: Defeating monsters awards XP; filling the XP bar triggers a level-up with stat increases.

**Independent Test**: Defeat monsters until level 2 (100 XP). Observe level-up notification and stat bar updates. (quickstart.md §4 US4)

### Implementation — US4

- [x] T056 [US4] Implement XP award service in `backend/src/game/progression/xp-service.ts`: `awardXp(characterId, amount)` — loads current character from DB; adds XP; calls `checkLevelUp(character, newXp)`; persists updated XP (and level/stats if levelled up) to DB; returns `{ newXp, levelledUp: boolean, newLevel?, newStats? }`; replaces stub in T051
- [x] T057 [US4] Implement level-up checker in `backend/src/game/progression/level-up-service.ts`: `checkLevelUp(character, newXp)` — load character class `xp_curve`; find highest level where `xp_curve[level-1] <= newXp`; if new level > current level: compute new stats using class growth formula from data-model.md; return updated character fields; log level-up event
- [x] T058 [US4] Emit `character.levelled_up` after a level-up in `backend/src/game/progression/xp-service.ts`: after persisting new stats, if `levelledUp === true` send `character.levelled_up` WS message to the character's WebSocket connection with `new_level, new_max_hp, new_attack_power, new_defence, new_experience`
- [x] T059 [US4] Handle `character.levelled_up` in `frontend/src/scenes/GameScene.ts`: call `statsBar.setLevel(new_level)`, `statsBar.setHp(new_max_hp, new_max_hp)`, `statsBar.setXp(new_experience, nextLevelThreshold)`; display temporary "LEVEL UP!" overlay text centred on screen for 2 seconds

**Checkpoint**: US1 + US2 + US3 + US4 independently functional — quickstart.md §4 US4 checklist passes.

---

## Phase 7: User Story 5 — Players Communicate in Real Time (Priority: P5)

**Goal**: Players in the same zone exchange local chat; all players share a global channel.

**Independent Test**: Two testers in the same zone exchange local messages. A third tester in another zone receives only global messages. Sending 6 messages in 3 seconds triggers a rate-limit notice. (quickstart.md §4 US5)

### Implementation — US5

- [x] T060 [P] [US5] Implement chat rate limiter in `backend/src/game/chat/chat-rate-limiter.ts`: sliding window counter per `characterId`; limit = 5 messages per 3000ms; returns `{ allowed: boolean, retryAfterMs?: number }`
- [x] T061 [US5] Implement `chat.send` handler in `backend/src/game/chat/chat-handler.ts`: validate `channel` is `'local'` or `'global'`; validate `message` 1–256 chars; check rate limiter (emit `server.rate_limited` if exceeded); persist to DB via `insertChatMessage`; if `local`: broadcast `chat.message` to all players in sender's zone via zone-registry; if `global`: broadcast to all active WebSocket connections; log all messages and rate-limit events
- [x] T062 [US5] Implement chat message DB query functions in `backend/src/db/queries/chat.ts`: `insertChatMessage(senderId, channel, zoneId, message)` — inserts and returns record; `getRecentZoneMessages(zoneId, limit)` — fetch last N local messages for zone on reconnect
- [x] T063 [US5] Implement ChatBox UI in `frontend/src/ui/ChatBox.ts`: fixed-position panel (bottom-left); two-tab header ("Local" / "Global"); scrollable message list per tab; text input + "Send" button; on Enter or button click: if input non-empty send `chat.send { channel: activeTab, message }`; clear input on send; `appendMessage(channel, senderName, message, timestamp)` adds formatted entry to correct tab; auto-scroll to bottom
- [x] T064 [US5] Handle `chat.message` from server in `frontend/src/scenes/GameScene.ts`: call `chatBox.appendMessage(channel, sender_name, message, timestamp)`; badge active tab indicator with unread count when tab is not active
- [x] T065 [US5] Handle `server.rate_limited` for chat in `frontend/src/ui/ChatBox.ts`: disable send button for `retry_after_ms`; display countdown notice "Slow down — wait Xs" above input

**Checkpoint**: All 5 user stories independently functional — run full quickstart.md §4 checklist.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, protocol safety, and final validation.

- [x] T066 [P] Add JSON schema validation for all incoming WS messages in `backend/src/websocket/validator.ts`: for each registered message type define required fields and types; `validateMessage(type, payload)` returns `{ valid: boolean, error?: string }`; dispatcher (T018) calls validator before routing; invalid messages receive `server.error PROTOCOL_VERSION` or descriptive error
- [x] T067 [P] Add protocol version gate in `backend/src/websocket/dispatcher.ts`: reject any message where `v !== 1` with `server.error PROTOCOL_VERSION` before routing
- [x] T068 Add graceful server shutdown in `backend/src/websocket/server.ts`: listen to `SIGINT`/`SIGTERM`; close all WebSocket connections cleanly (send `server.error SHUTTING_DOWN`); wait for in-progress combat simulations to complete or timeout after 5s; close DB pool; exit with code 0; log shutdown sequence
- [x] T069 [P] Enforce TypeScript strict mode in all three `tsconfig.json` files (`backend`, `frontend`, `shared/protocol`): ensure `"strict": true`, `"noUncheckedIndexedAccess": true`; fix any resulting type errors
- [x] T070 Run quickstart.md validation checklist end-to-end: follow every step in `specs/001-game-design/quickstart.md`; fix any step that fails; verify structured log output parses as JSON (`npm run dev 2>&1 | head -20 | jq .`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**.
- **US1 (Phase 3)**: Depends on Phase 2 — no dependency on US2–US5.
- **US2 (Phase 4)**: Depends on Phase 2 — no dependency on US3–US5. May begin in parallel with US1 if staffed.
- **US3 (Phase 5)**: Depends on Phase 2 — requires US1 (auth) for combat to be triggered. Logically after US1.
- **US4 (Phase 6)**: Depends on US3 (XP is awarded inside combat-end-handler via xp-service stub replaced in T056).
- **US5 (Phase 7)**: Depends on Phase 2 + zone-registry from US2 (T036) for local chat delivery. Can begin after T036 is done.
- **Polish (Phase 8)**: Depends on all stories being complete.

### Within Each User Story

- DB query functions and TypeScript interfaces marked [P] can start simultaneously.
- Backend handler depends on DB queries.
- Frontend scene depends on WSClient (T032).
- Within GameScene, each US adds features to the same file — implement in story order.

---

## Parallel Execution Examples

### Phase 2 Parallel Batch (T009–T014)
```
Parallel:
  T009: migration 002_character_classes.sql
  T010: migration 003_map_zones.sql
  T011: migration 004_characters.sql
  T012: migration 005_game_entities.sql
  T013: migration 006_combat.sql
  T014: migration 007_chat_messages.sql

Then sequential:
  T015: seed data (depends on all tables existing)
```

### US1 Parallel Batch (T020–T022, T029–T031)
```
Parallel:
  T020: accounts DB queries
  T021: characters + classes DB queries
  T022: JWT utilities
  T029: Boot scene
  T030: Login scene
  T031: CharacterCreate scene

Then sequential:
  T023 (depends T020), T024 (depends T020), T025 (depends T022)
  T032: WSClient (T029–T031 depend on it)
  T033–T035: GameScene features
```

### US3 Parallel Batch (T044–T045)
```
Parallel:
  T044: monster-registry
  T045: monster-spawner

Then:
  T046: integrate monsters into world.state (depends T044 + T045)
  T047: combat.start handler
  ...
```

---

## Implementation Strategy

### MVP First (US1 Only — ~35 tasks)

1. Complete Phase 1 (Setup) — T001–T006
2. Complete Phase 2 (Foundational) — T007–T019
3. Complete Phase 3 (US1) — T020–T035
4. **STOP**: Run quickstart.md §4 US1 checklist
5. Deploy / demo: player can register, create character, appear on map

### Incremental Delivery

| Phase | Deliverable | Cumulative tasks |
|-------|-------------|-----------------|
| Setup + Foundational | Infrastructure ready | T001–T019 (19) |
| + US1 | MVP: account + character + map | T020–T035 (+16) |
| + US2 | Multiplayer movement | T036–T043 (+8) |
| + US3 | Combat loop | T044–T055 (+12) |
| + US4 | Progression | T056–T059 (+4) |
| + US5 | Chat | T060–T065 (+6) |
| + Polish | Production-ready | T066–T070 (+5) |
| **Total** | | **70 tasks** |

### Parallel Team Strategy

With two developers after Phase 2 is complete:
- **Dev A**: US1 backend (T020–T028) then US2 backend (T036–T040)
- **Dev B**: US1 frontend (T029–T035) then US2 frontend (T041–T043)

---

## Notes

- `[P]` = different files, no blocking dependencies — safe to run in parallel
- `[US#]` maps task to its user story for traceability
- Each phase ends with a Checkpoint — validate before proceeding
- Combat simulation engine (T048) is the most complex single task — budget extra time
- GameScene (frontend) accumulates features across US1–US5; implement in priority order to avoid merge conflicts when pairing
- US3 T051 calls `xp-service.awardXp` which starts as a no-op stub — replaced by T056 in US4
