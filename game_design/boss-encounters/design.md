# Boss Encounters — Guardians of the Realm

## Context

Bosses introduce the first true high-stakes combat in Elarion. Unlike regular monsters found while exploring, bosses are persistent world entities that guard specific buildings, blocking all actions (explore, gather, craft, expedition) until defeated. They stand visibly on the map in front of their building, a constant reminder and challenge.

This creates a shared-world dynamic: when a boss is alive, *everyone* is locked out of that building. Defeating a boss is a community event — players take turns challenging it, each chipping away or falling. The Boss Challenge Token requirement ensures players prepare deliberately rather than throwing themselves at bosses unprepared.

Bosses are significantly stronger than regular monsters, can use abilities (a first for enemies in Elarion), and their HP is hidden from attackers — adding tension and uncertainty. Only one player can fight a boss at a time; others must wait for the attempt to resolve.

**Core Fantasy**: You see the hulking silhouette of a troll chieftain blocking the mine entrance. Other adventurers mill about, unable to enter. You clutch your Boss Challenge Token, check your loadout, and step forward.

---

## Tier/Category Design

Bosses are not tiered in the traditional sense — each boss is a unique guardian tied to a specific building. However, they scale in difficulty based on the building's content tier and zone.

| Difficulty | Zone | Buildings | Boss HP Range | Boss ATK Range | Design Intent |
|------------|------|-----------|--------------|----------------|---------------|
| Starter | Elarion City | Arena, Docs | 400-600 | 25-35 | Teach boss mechanics, beatable by mid-geared players |
| Standard | Ulysses Peninsula | Forgotten Mines, Brookly Forest, Mage Tower | 800-1500 | 35-50 | Require solid gear and preparation |
| Hard | Ulysses Peninsula | Old Cult | 2000+ | 50-65 | End-game challenge, require best gear and abilities |

**Note**: Specific boss entities are NOT defined in this design document. Bosses are created via the admin panel after the boss system code is implemented. This document defines the *system* and *mechanics* — the admin panel provides full flexibility to create, tune, and reassign bosses without code changes.

---

## Items to Create (1 total)

### Boss Tokens (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | Boss Challenge Token | 5 | A wax-sealed warrant bearing the city's crest. Present it to challenge a guardian beast. Consumed on use. |

**Source**: Boss Challenge Tokens are rewards from quests, rare expedition drops, and potentially crafted. The exact sources are configured separately (quest rewards, loot tables) — not part of this design's execution plan.

---

## NPCs to Create (0)

No new NPCs needed for the boss system.

---

## Abilities to Create (0)

Boss abilities are created per-boss via the admin panel. The system supports all existing ability effect types (damage, heal, buff, debuff, dot, drain, reflect) plus the ability to assign them to bosses. No new ability *definitions* are needed in this design — they are created when individual bosses are designed.

---

## Monsters

No regular monsters are created by this design. Bosses are a separate entity type with their own `bosses` table, not entries in the `monsters` table. This is intentional — bosses have fundamentally different behavior (persistent HP, building-blocking, ability loadouts, respawn timers, instance tracking).

---

## Economy Flow

```
[Quest/Expedition/Drop] ──> Boss Challenge Token ──> Boss Fight ──> Boss Loot (items, crowns, XP)
                                (consumed)              |
                                                        v
                                                Building Unlocked ──> Explore/Gather/Craft
```

**Token economy**: Tokens are the gate. If tokens are too common, bosses become trivial speed bumps. If too rare, players feel locked out of content. Target: a prepared player should be able to attempt a boss 2-3 times per play session (30-60 minutes).

**Boss loot**: Bosses should drop valuable items proportional to their difficulty — unique weapons, rare resources, crowns. Loot is defined per-boss via admin panel.

---

## Code Changes Required

This design requires significant code changes. The boss system is an entirely new game mechanic — new DB tables, new backend services, new WebSocket messages, new frontend UI, and new admin panel.

### Summary
| Change | Scope | Description |
|--------|-------|-------------|
| DB migration | backend | New tables: `bosses`, `boss_abilities`, `boss_loot`, `boss_instances` |
| Shared protocol types | shared | New DTOs and message types for boss state, combat, and admin |
| Boss instance manager | backend | Service managing boss spawn/despawn, HP persistence, lock/unlock |
| Boss combat handler | backend | Combat variant: hidden HP, boss abilities, token consumption, single-player lock |
| Building action blocker | backend | Check boss_instances before allowing building actions |
| Map boss display | frontend | Show boss sprites on map at building locations |
| Boss combat UI | frontend | Modified CombatScreen: no enemy HP bar, boss ability indicators |
| Boss info panel | frontend | Panel showing boss name, status (alive/dead/in combat), respawn timer |
| Admin boss management | admin | CRUD for bosses, ability assignment, loot tables, instance monitoring |

### Detailed Requirements

1. **Database migration** (`XXX_boss_system.sql`):

   **`bosses` table**: Boss definitions (template data, not live state).
   - `id SERIAL PRIMARY KEY`
   - `name VARCHAR(100) NOT NULL`
   - `description TEXT`
   - `icon_filename VARCHAR(255)` — combat icon
   - `sprite_filename VARCHAR(255)` — map sprite (standing in front of building)
   - `max_hp INTEGER NOT NULL`
   - `attack INTEGER NOT NULL`
   - `defense INTEGER NOT NULL`
   - `xp_reward INTEGER NOT NULL DEFAULT 0`
   - `min_crowns INTEGER NOT NULL DEFAULT 0`
   - `max_crowns INTEGER NOT NULL DEFAULT 0`
   - `building_id INTEGER REFERENCES buildings(id)` — which building this boss guards
   - `respawn_min_seconds INTEGER NOT NULL DEFAULT 3600` — minimum respawn time after defeat
   - `respawn_max_seconds INTEGER NOT NULL DEFAULT 7200` — maximum respawn time (random within range)
   - `is_active BOOLEAN NOT NULL DEFAULT true` — admin toggle to enable/disable
   - `created_at TIMESTAMPTZ DEFAULT NOW()`

   **`boss_abilities` table**: Abilities assigned to a boss.
   - `id SERIAL PRIMARY KEY`
   - `boss_id INTEGER NOT NULL REFERENCES bosses(id) ON DELETE CASCADE`
   - `ability_id INTEGER NOT NULL REFERENCES abilities(id)`
   - `priority INTEGER NOT NULL DEFAULT 0` — higher = fires first (same as player auto abilities)
   - `UNIQUE(boss_id, ability_id)`

   **`boss_loot` table**: Loot table for a boss (same structure as monster_loot).
   - `id SERIAL PRIMARY KEY`
   - `boss_id INTEGER NOT NULL REFERENCES bosses(id) ON DELETE CASCADE`
   - `item_def_id INTEGER NOT NULL REFERENCES item_definitions(id)`
   - `drop_chance NUMERIC(5,2) NOT NULL` — percentage 0.00-100.00
   - `quantity INTEGER NOT NULL DEFAULT 1`

   **`boss_instances` table**: Live state of spawned bosses.
   - `id SERIAL PRIMARY KEY`
   - `boss_id INTEGER NOT NULL REFERENCES bosses(id)`
   - `current_hp INTEGER NOT NULL`
   - `status VARCHAR(20) NOT NULL DEFAULT 'alive'` — CHECK: `alive`, `in_combat`, `defeated`
   - `fighting_character_id INTEGER REFERENCES characters(id)` — who is currently fighting (NULL if not in_combat)
   - `total_attempts INTEGER NOT NULL DEFAULT 0` — how many players have attacked this instance
   - `spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `defeated_at TIMESTAMPTZ` — when killed, used to calculate respawn
   - `respawn_at TIMESTAMPTZ` — pre-calculated respawn time (defeated_at + random(min, max))

2. **Shared protocol types** (`shared/protocol/index.ts`):

   New DTOs:
   - `BossDto`: id, name, description, icon_url, sprite_url, building_id, status ('alive'|'in_combat'|'defeated'|'inactive'), respawn_at (ISO string, only when defeated)
   - `BossInstanceDto`: boss_id, current_hp (only for admin), status, fighting_character_name, total_attempts, spawned_at, defeated_at, respawn_at
   - `BossCombatStartPayload`: extends CombatStartPayload concept but: no enemy max_hp field, includes boss_id, boss_name, boss_icon_url, boss_abilities (names + icons for display only)
   - `BossCombatTurnResultPayload`: same as CombatTurnResultPayload but enemy_hp is omitted (or sent as a percentage bracket: 'full'|'high'|'medium'|'low'|'critical' — to give visual feedback without exact numbers)

   New message types:
   - `boss:state` — server broadcasts boss state changes to all players in the zone (spawn, death, combat start/end)
   - `boss:challenge` — client sends to initiate boss fight (includes boss_instance_id)
   - `boss:combat_start` — server sends to fighting player
   - `boss:combat_turn_result` — turn results with hidden HP
   - `boss:combat_active_window` — active ability window (same as regular combat)
   - `boss:combat_trigger_active` — client triggers active ability
   - `boss:combat_end` — fight over (win/loss with loot)

3. **Boss instance manager** (`backend/src/game/boss/boss-instance-manager.ts`):

   Singleton service that:
   - On server startup: loads all active boss definitions, creates/resumes boss_instances
   - Spawns a new instance when respawn_at is reached (set status='alive', current_hp=max_hp)
   - Sets status='in_combat' + fighting_character_id when a player challenges
   - Updates current_hp after each combat turn (persisted to DB for crash recovery)
   - Sets status='defeated' + defeated_at + respawn_at when HP reaches 0
   - Broadcasts `boss:state` to all players in the zone on state changes
   - Provides `isBossBlocking(buildingId): boolean` for building action checks
   - Tracks `total_attempts` increment on each challenge
   - Respawn check runs on a timer (e.g., every 30 seconds) or event-driven

4. **Boss combat handler** (`backend/src/game/boss/boss-combat-handler.ts`):

   Variant of combat-session.ts with these differences:
   - **Token check**: Verify player has Boss Challenge Token in inventory, consume 1 on combat start
   - **Single-player lock**: Check boss_instance.status === 'alive' before allowing challenge. Reject if 'in_combat' or 'defeated'. Race condition protection via DB transaction.
   - **Hidden HP**: Turn results include HP bracket ('full' >80%, 'high' 60-80%, 'medium' 40-60%, 'low' 20-40%, 'critical' <20%) instead of exact number
   - **Boss abilities**: Boss has an ability loadout (loaded from boss_abilities table). During enemy turn, boss fires abilities by priority (same logic as player auto abilities, but checking boss mana — bosses have infinite mana OR a fixed mana pool, design decision: **infinite mana** to keep it simple, abilities gated by cooldowns only)
   - **Persistent HP**: Boss HP carries across fights. If player loses, boss keeps its current HP for the next challenger. Only resets on respawn.
   - **On player disconnect**: End combat as loss (boss keeps current HP, unlock instance)
   - **On win**: Award loot from boss_loot table, XP, crowns. Set instance to defeated. Calculate respawn_at. Broadcast boss:state.
   - **On loss**: Unlock instance (status back to 'alive'), persist current_hp. Player keeps their HP (same as regular combat loss). Broadcast boss:state.

5. **Building action blocker** (`backend/src/game/world/building-action-handler.ts`):

   Before processing any building action (explore, gather, expedition, crafting, marketplace):
   - Call `bossInstanceManager.isBossBlocking(buildingId)`
   - If true: reject with error message "A powerful guardian blocks this building. Defeat the boss to gain access."
   - This check goes at the top of the action handler, before any action-type-specific logic

6. **Map boss display** (`frontend/src/scenes/GameScene.ts` + new `frontend/src/entities/BossSprite.ts`):

   - When entering a zone, server includes boss state in zone data (or separate boss:state message)
   - For each alive/in_combat boss: render boss sprite at the building's map position (offset slightly in front)
   - Boss sprite has idle animation (or static sprite with pulsing glow effect)
   - Click boss sprite: opens boss info panel
   - When boss is defeated: remove sprite, show respawn timer on building
   - When boss respawns: add sprite back with spawn animation

7. **Boss info panel** (`frontend/src/ui/BossInfoPanel.ts`):

   Shown when clicking a boss on the map:
   - Boss name, icon, description
   - Status: "Guarding" / "In Combat with [PlayerName]" / "Defeated (respawns in X:XX)"
   - "Challenge" button (grayed out if in_combat, defeated, or player has no token)
   - Stats hint: difficulty indicator (skulls or stars) but NOT exact stats
   - Total attempts on this instance
   - Token count in player inventory

8. **Boss combat UI modifications** (`frontend/src/ui/CombatScreen.ts`):

   When combat variant is 'boss':
   - Enemy HP bar replaced with bracket indicator (5 segments: full/high/medium/low/critical with colors but no numbers)
   - Boss name displayed larger, with special styling
   - Boss abilities shown as icons in the combat log when they fire
   - Victory screen shows boss-specific loot with special presentation
   - Defeat screen shows "The guardian stands firm. It appears [bracket] wounded."

9. **Admin boss management panel** (`admin/frontend/src/ui/boss-manager.ts` + `admin/backend/src/routes/bosses.ts`):

   Admin REST API:
   - `GET /api/bosses` — list all boss definitions
   - `POST /api/bosses` — create boss definition
   - `PUT /api/bosses/:id` — update boss definition
   - `DELETE /api/bosses/:id` — delete boss definition
   - `GET /api/bosses/:id/abilities` — list boss abilities
   - `POST /api/bosses/:id/abilities` — assign ability to boss
   - `DELETE /api/bosses/:id/abilities/:abilityId` — remove ability from boss
   - `GET /api/bosses/:id/loot` — list boss loot entries
   - `POST /api/bosses/:id/loot` — add loot entry
   - `DELETE /api/bosses/:id/loot/:lootId` — remove loot entry
   - `GET /api/bosses/instances` — list all live boss instances with current state
   - `POST /api/bosses/:id/respawn` — force respawn a boss (admin override)
   - `POST /api/bosses/:id/upload-icon` — upload boss combat icon
   - `POST /api/bosses/:id/upload-sprite` — upload boss map sprite

   Admin frontend:
   - Boss list with create/edit/delete
   - Boss form: name, description, stats (HP, ATK, DEF), XP, crowns, building assignment, respawn range, active toggle
   - Ability assignment panel: dropdown of existing abilities, add/remove with priority
   - Loot table panel: item search, drop chance, quantity
   - Icon/sprite upload
   - Live instances dashboard: current HP, status, fighting player, attempts, respawn countdown

### Implementation Sequence

Code changes must be implemented BEFORE entity execution. The order is:
1. `/speckit.specify` -- Create technical spec from this section
2. `speckit.plan` -> `speckit.tasks` -> `speckit.implement` -- Build the code
3. `/gd.execute` -- Create the Boss Challenge Token item
4. Create individual bosses via the admin panel (separate design effort per boss)

---

## Execution Plan

All content is created via the `game-entities` skill (admin REST API). Order matters for FK constraints.

### Phase 1 -- Core Items (after code implementation)
1. **Create 1 item** -- Boss Challenge Token (resource, stack_size 5)

### Phase 2 -- Boss Definitions (via admin panel, separate design per boss)
Individual bosses are created through the new admin boss management panel, NOT through the game-entities script. Each boss needs:
- Stats tuned to its building's content tier
- Abilities selected and prioritized
- Loot table designed
- Icon and sprite art generated (via `/gd.prompts`)
- Building assignment configured

This is deferred to follow-up designs (e.g., "boss-forgotten-mines", "boss-mage-tower") that define specific bosses with balanced stats, lore, and loot tables.

### Phase 3 -- Token Sources (via existing systems)
- Add Boss Challenge Token to relevant quest rewards
- Add Boss Challenge Token to expedition loot tables (rare drop)
- Optionally: crafting recipe for Boss Challenge Token at a specific NPC

---

## Testing Walkthrough

### Test 1: Boss Blocks Building
1. **Admin creates a boss** assigned to Forgotten Mines (building 12) -- boss appears on map
2. **Player navigates to Forgotten Mines** -- sees boss sprite in front of building
3. **Player clicks Forgotten Mines building** -- all actions (explore, expedition, gather) show "blocked by guardian" message
4. **Player clicks boss sprite** -- boss info panel opens with "Guarding" status

### Test 2: Boss Challenge Flow
1. **Player has Boss Challenge Token in inventory** -- Challenge button is enabled in boss info panel
2. **Player clicks Challenge** -- token consumed, boss status changes to "in_combat", other players see "In Combat with [Name]"
3. **Combat starts** -- boss combat screen shows: no HP numbers, bracket indicator, boss name
4. **Boss uses abilities during combat** -- abilities fire by priority on boss turns, shown in combat log
5. **Player wins** -- boss defeated, loot awarded, building actions unlocked, respawn timer starts
6. **OR player loses** -- boss keeps reduced HP, instance unlocked for next challenger, player sees bracket hint

### Test 3: Multi-Player Boss Interaction
1. **Player A challenges boss** -- boss locked to Player A
2. **Player B tries to challenge** -- rejected: "Another adventurer is already fighting this guardian"
3. **Player A loses** -- boss unlocked, Player B can now challenge (boss has reduced HP from Player A's attempt)
4. **Player B wins** -- boss defeated, all players get building access

### Test 4: Boss Respawn
1. **Boss defeated** -- respawn timer shown (e.g., "Respawns in 45:00")
2. **Building accessible** -- all actions work normally during respawn
3. **Timer expires** -- boss respawns at full HP, building blocked again, boss sprite reappears

### Test 5: Admin Boss Management
1. **Admin opens boss panel** -- sees list of boss definitions
2. **Admin creates boss** -- fills in stats, assigns to building, sets respawn range
3. **Admin assigns abilities** -- selects from existing abilities, sets priority order
4. **Admin configures loot** -- adds items with drop chances
5. **Admin views instances** -- sees live boss state, HP, current fighter, attempt count
6. **Admin force-respawns** -- boss immediately respawns regardless of timer

---

## Verification Checklist
- [ ] Boss Challenge Token created and visible in inventory
- [ ] Admin can create/edit/delete boss definitions
- [ ] Admin can assign abilities and loot to bosses
- [ ] Boss sprite appears on map at assigned building
- [ ] Building actions blocked while boss is alive
- [ ] Boss challenge requires and consumes token
- [ ] Only one player can fight boss at a time
- [ ] Boss HP hidden during combat (bracket indicator only)
- [ ] Boss uses abilities during combat
- [ ] Boss HP persists between fights
- [ ] Boss drops loot on defeat
- [ ] Boss respawns after configured time
- [ ] Building unlocks when boss defeated
- [ ] Admin can view live boss instances
- [ ] Admin can force-respawn bosses
