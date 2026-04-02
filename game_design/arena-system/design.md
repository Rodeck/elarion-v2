# Arena System — Blood & Glory

## Context

The arena is the first player-versus-player system in Elarion. A dedicated building houses the fighting pit where warriors test their mettle against each other and against seasoned fighters retained by the arena master. Entry is voluntary, but once inside, challenges cannot be refused — the arena demands blood.

This system creates a high-stakes endgame loop: players gear up through crafting and monster hunting, then prove their worth in the arena. HP carries over between fights, so surviving multiple bouts requires careful ability loadout choices and knowing when to leave. The arena also serves as a crown and XP sink/source, and gives `combat_wins` a meaningful context beyond PvE.

**Core loops created:**
- **PvP combat** — Player vs player using the existing turn-based combat engine
- **Arena NPC fights** — Challenging arena-specific monsters (costs a consumable token)
- **Endurance** — HP persists between fights; staying longer = more risk, more reward
- **Cooldown management** — Minimum stay time + re-entry cooldown creates scarcity and planning

---

## System Design

### Arena Rules

| Rule | Value | Admin Configurable |
|------|-------|--------------------|
| Minimum stay time before voluntary leave | 60 minutes (default) | Yes — per arena |
| Re-entry cooldown after leaving/kicked | 30 minutes (default) | Yes — per arena |
| Winner XP reward | 50 (default) | Yes — per arena |
| Loser XP reward | 10 (default) | Yes — per arena |
| Winner crowns reward | 25 (default) | Yes — per arena |
| Loser crowns reward | 0 (default) | Yes — per arena |
| HP persistence | Between all fights | No — core mechanic |
| Loser kicked from arena | Always | No — core mechanic |
| NPC challenge requires token | Always | No — core mechanic |
| Max concurrent fights per arena | Unlimited (1 per player pair) | No |

### Player State Flow

```
Map (visible) ──► Enter Arena ──► Arena Lobby (invisible on map)
                                    │
                                    ├──► Challenge Player ──► PvP Combat
                                    │       ├──► Win → Stay in arena (HP reduced)
                                    │       └──► Lose → Kicked to map + cooldown
                                    │
                                    ├──► Challenge NPC (consume token) ──► PvE Combat
                                    │       ├──► Win → Stay in arena (HP reduced)
                                    │       └──► Lose → Kicked to map + cooldown
                                    │
                                    ├──► Leave (after min stay time) → Map + cooldown
                                    │
                                    └──► [In Fight] → Unchallengeable (UI indicator)
```

### PvP Combat Flow

PvP reuses the existing combat engine with symmetric turns:

1. **Challenge**: Player A targets Player B in the arena lobby
2. **Validation**: Both players must be in the same arena, not in combat, not already fighting
3. **Combat start**: Both players enter combat. Each player sees the combat UI — their opponent replaces the "monster" slot
4. **Turn resolution** (simultaneous):
   - Player A's auto-abilities fire against Player B
   - Player B's auto-abilities fire against Player A
   - Active window opens for BOTH players (3 seconds)
   - Active abilities resolve
   - Effects tick for both sides
5. **Combat end**: Player whose HP reaches 0 first loses. If both reach 0 on the same turn, the attacker (challenger) wins
6. **Rewards**: Winner gets `winner_xp` + `winner_crowns`, loser gets `loser_xp` + `loser_crowns`. Winner's `combat_wins` increments
7. **Post-combat**: Loser is removed from arena, placed back on the map at the arena building node, given re-entry cooldown. Winner stays with current HP (no healing)

### Visibility Rules

- Players inside the arena are **removed from the zone player list** — they do not appear on the map
- The arena lobby shows its own player list (arena participants only)
- Players in an active fight show a "In Combat" indicator in the arena lobby list
- Other map players cannot see or interact with arena participants

### Arena Fighter Challenges

Arena fighters are humanoid combatants — brawlers, sellswords, veterans — stored as entries in the `monsters` table but themed as people rather than beasts. They are assigned to a specific arena by the admin. Fighting them uses the existing PvE combat system (not PvP). The key differences:
- Requires consuming 1x **Arena Challenge Token** from inventory
- HP carries over (player enters with current HP, not max)
- Losing kicks the player from the arena with cooldown
- Winning keeps the player in the arena with reduced HP
- No crown/loot drops from arena fighters — the reward is surviving

---

## Items to Create (1 total)

### Consumable Token (category: resource)

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | Arena Challenge Token | 50 | A worn brass disc stamped with crossed swords. Required to challenge the arena's resident fighters. Consumed on use. |

**Stat justification**: Stack size 50 matches Boss Challenge Token pattern (id 97). No combat stats — pure consumable.

**Source**: Arena Challenge Tokens should be obtainable via:
- Monster drops (add to existing mid-tier monster loot tables — Bandit Scout, Rabid Wolf, Mine Crawler)
- Crafting recipe (optional, Phase 2)
- Quest rewards (optional, Phase 2)

---

## Arena Fighters (Monsters to Create — 6 total)

New humanoid fighters created as monsters in the `monsters` table but themed as arena combatants — people, not beasts. Each represents a fighting archetype the player might face. Stats are calibrated against existing monster baselines (Sewer Rat 20 HP / 9 ATK at the low end, Cave Troll 300 HP / 35 ATK at the high end).

| Monster | ATK | DEF | HP | XP | Crowns | Target Level | Purpose |
|---------|-----|-----|-----|-----|--------|--------------|---------|
| Pit Brawler | 35 | 25 | 200 | 20 | 2–10 | ~10–15 | Bare-knuckle thug. Entry-level warmup — beatable by a geared level 10 but will take a chunk of HP. |
| Sellsword | 55 | 40 | 400 | 40 | 5–20 | ~15–25 | Hired blade with decent gear. Tests whether the player can handle a real swordfight. |
| Duellist | 80 | 30 | 350 | 55 | 8–25 | ~20–30 | Fast and aggressive, low armour. High ATK means heavy HP loss even on a win — dangerous for HP persistence. |
| Shieldwall Veteran | 50 | 70 | 700 | 60 | 10–30 | ~25–35 | Heavily armoured ex-soldier. Low damage but extremely hard to kill — a long war of attrition that bleeds your HP through sheer duration. |
| Reaver Captain | 100 | 60 | 800 | 80 | 15–40 | ~35–45 | Ruthless raider officer. Hits hard, takes hits. A genuine threat that demands good gear and ability loadout. |
| Arena Champion | 150 | 100 | 1500 | 120 | 30–75 | ~45–50+ | The arena's undefeated legend. Endgame challenge — a level 50 warrior with full gear will still need abilities and smart play to survive. |

**Stat justification** (reference: Warrior base ATK = 15 + 3/lv, DEF = 12 + 2/lv, HP = 120 + 20/lv; best weapon = 70 ATK Longbow, full leather set ~36 DEF):
- **Pit Brawler** (ATK 35, DEF 25, HP 200): A lv10 Warrior (ATK 42, DEF 30, HP 300) can take this but will lose ~40-60 HP. Serves as a token-sink warmup and HP tax
- **Sellsword** (ATK 55, DEF 40, HP 400): Matches a lv15 geared Warrior's stats. A lv20 player handles it; a lv15 takes serious damage
- **Duellist** (ATK 80, DEF 30, HP 350): Glass cannon — ATK exceeds a lv20 Warrior's DEF (50), dealing big per-hit damage. Lower HP means faster kill but the HP cost is steep. Unique threat profile
- **Shieldwall Veteran** (ATK 50, DEF 70, HP 700): DEF 70 means a lv25 Warrior (ATK ~87 base, ~157 geared) deals reduced damage per hit. The fight drags on, accumulating chip damage. ATK 50 is modest but adds up over many turns
- **Reaver Captain** (ATK 100, DEF 60, HP 800): A lv35 Warrior (ATK 117 base, DEF 80) faces a genuine peer. Both sides deal meaningful damage. Requires abilities to win efficiently
- **Arena Champion** (ATK 150, DEF 100, HP 1500): A lv50 Warrior (ATK 162 base, DEF 110, HP 1100) barely outscales this. With Longbow (ATK 232 total) the fight is winnable but costs ~400-600 HP. Below the Ancient Mage Spirit boss (5000 HP, 110 ATK, 160 DEF) but in the same weight class for raw threat per turn

**Loot**: Arena fighters drop no loot — the reward for NPC fights is surviving with HP intact to continue PvP. This is a deliberate design choice: arena tokens are the cost, survival is the prize.

The admin assigns whichever fighters they want to each arena via the admin panel. The above 6 are the initial roster.

---

## NPCs to Create (1)

| NPC | Description | is_crafter | is_disassembler | Building Assignment |
|-----|-------------|------------|-----------------|---------------------|
| Varn Bloodkeeper | A scarred veteran who runs the arena's fighting pit. He recruits the fighters, sets the odds, and enforces the arena's one rule: no one leaves without earning it. | false | false | Arena building (created by admin) |

**Note**: Varn Bloodkeeper serves as the arena's thematic anchor. No crafter/disassembler role — his presence is narrative. He could be assigned a new `is_arena_master` role in a future iteration, but for Phase 1, the arena mechanic is building-action driven, not NPC-role driven.

---

## Economy Flow

```
[Monster Hunting] ──► Arena Challenge Token (loot drop)
                          │
                          ▼
[Arena Entry] ──► PvP Fights ──► Winner: +50 XP, +25 Crowns
                  │                Loser: +10 XP, kicked
                  │
                  ▼
              NPC Fights (consume 1 token) ──► Win: survive, HP reduced
                                               Lose: kicked
```

**XP analysis**: Winner gets 50 XP per PvP fight (between Bandit Scout 25 XP and Stone Golem 60 XP rewards). This is appropriate — PvP is harder than PvE since opponents have equipment and abilities. Loser gets 10 XP as consolation (between Field Mouse 3 XP and Wild Dog 15 XP).

**Crown analysis**: Winner gets 25 crowns (between Cultist Shade 8-25 and Cave Troll 20-60 ranges). No crown cost to enter the arena — the cost is time and risk.

**Token sink**: Arena Challenge Tokens are consumed on NPC challenges, creating demand for mid-tier monster farming. Added to Bandit Scout (10%), Rabid Wolf (8%), Mine Crawler (12%) loot tables.

---

## Code Changes Required

This design introduces a new game mechanic (PvP combat, arena state management, visibility toggling) that requires significant code changes across all packages.

### Summary

| Change | Scope | Description |
|--------|-------|-------------|
| DB migration `031_arena_system.sql` | backend | New tables: `arenas`, `arena_monsters`, `arena_participants`; new column `characters.arena_id` |
| WebSocket messages | shared/backend/frontend | ~15 new message types for arena enter/leave/challenge/lobby/combat |
| Arena handler | backend | Arena state manager, PvP combat handler, participant tracking |
| Building action type `'arena'` | all packages | New action type following CLAUDE.md checklist (7 locations) |
| Arena UI | frontend | Arena lobby panel showing participants, challenge buttons, fight status |
| PvP combat adaptation | backend | Modified combat engine calls for symmetric PvP turns |
| Admin arena management | admin | CRUD routes + UI for arena config (rewards, timers, monster assignments) |
| Map visibility | backend | Filter arena participants from zone player broadcasts |

### Detailed Requirements

#### 1. DB Migration — `031_arena_system.sql`

**`arenas` table**:
```
id SERIAL PRIMARY KEY
building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE (UNIQUE)
name TEXT NOT NULL
min_stay_seconds INTEGER NOT NULL DEFAULT 3600
reentry_cooldown_seconds INTEGER NOT NULL DEFAULT 1800
winner_xp INTEGER NOT NULL DEFAULT 50
loser_xp INTEGER NOT NULL DEFAULT 10
winner_crowns INTEGER NOT NULL DEFAULT 25
loser_crowns INTEGER NOT NULL DEFAULT 0
is_active BOOLEAN NOT NULL DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
```

**`arena_monsters` table**:
```
id SERIAL PRIMARY KEY
arena_id INTEGER REFERENCES arenas(id) ON DELETE CASCADE
monster_id INTEGER REFERENCES monsters(id) ON DELETE CASCADE
sort_order INTEGER NOT NULL DEFAULT 0
UNIQUE(arena_id, monster_id)
```

**`arena_participants` table** (tracks who is currently in the arena):
```
id SERIAL PRIMARY KEY
arena_id INTEGER REFERENCES arenas(id) ON DELETE CASCADE
character_id UUID REFERENCES characters(id) ON DELETE CASCADE (UNIQUE)
entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
current_hp INTEGER NOT NULL
in_combat BOOLEAN NOT NULL DEFAULT false
fighting_character_id UUID REFERENCES characters(id) ON DELETE SET NULL
can_leave_at TIMESTAMPTZ NOT NULL
cooldown_until TIMESTAMPTZ
```

**Character column**:
```sql
ALTER TABLE characters ADD COLUMN arena_id INTEGER REFERENCES arenas(id) ON DELETE SET NULL;
```

This column tracks whether a character is currently inside an arena. `NULL` = not in arena. Used for quick lookups and zone visibility filtering.

**Building action type extension**:
```sql
ALTER TABLE building_actions DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions ADD CONSTRAINT building_actions_action_type_check
  CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing', 'arena'));
```

#### 2. Shared Protocol — New Message Types

**Client → Server**:
- `arena:enter` — `{ action_id: number }` (building action ID)
- `arena:leave` — `{ arena_id: number }`
- `arena:challenge_player` — `{ target_character_id: string }`
- `arena:challenge_npc` — `{ monster_id: number }`
- `arena:combat_trigger_active` — `{ combat_id: string }` (active ability in PvP)

**Server → Client**:
- `arena:entered` — `{ arena: ArenaDto, participants: ArenaParticipantDto[], monsters: MonsterCombatDto[] }`
- `arena:enter_rejected` — `{ reason: string, cooldown_until?: string }`
- `arena:left` — `{ arena_id: number }`
- `arena:leave_rejected` — `{ reason: string, can_leave_at: string }`
- `arena:player_entered` — `{ participant: ArenaParticipantDto }` (broadcast to arena)
- `arena:player_left` — `{ character_id: string }` (broadcast to arena)
- `arena:combat_start` — `{ combat_id: string, opponent: ArenaCombatantDto, player: PlayerCombatStateDto, loadout, is_pvp: boolean }`
- `arena:combat_active_window` — `{ combat_id: string, timer_ms: number, ability: AbilityStateDto | null }`
- `arena:combat_turn_result` — `{ combat_id: string, turn: number, phase: string, player_events: CombatEventDto[], opponent_events: CombatEventDto[], player_hp: number, player_mana: number, opponent_hp: number, ability_states: AbilityStateDto[], active_effects: ActiveEffectDto[] }`
- `arena:combat_end` — `{ combat_id: string, outcome: 'victory' | 'defeat', current_hp: number, xp_gained: number, crowns_gained: number, opponent_name: string }`
- `arena:participant_updated` — `{ character_id: string, in_combat: boolean }` (broadcast — fight status indicator)
- `arena:kicked` — `{ reason: string, cooldown_until: string }`

**New DTOs**:
```ts
interface ArenaDto {
  id: number;
  name: string;
  building_id: number;
  min_stay_seconds: number;
  reentry_cooldown_seconds: number;
}

interface ArenaParticipantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  in_combat: boolean;
  entered_at: string;
}

interface ArenaCombatantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  max_hp: number;
  attack: number;
  defence: number;
}
```

#### 3. Backend — Arena Handler (`backend/src/game/arena/`)

New files:
- `arena-handler.ts` — Entry/exit logic, participant management, cooldown enforcement
- `arena-combat-handler.ts` — PvP and arena NPC combat sessions
- `arena-state-manager.ts` — In-memory map of active arena participants and fights

**Key behaviors**:
- **Enter**: Validate not in combat, not in gathering, not already in arena, cooldown expired. Set `characters.arena_id`, insert `arena_participants` row with `current_hp = characters.current_hp`, compute `can_leave_at = NOW() + min_stay_seconds`. Remove player from zone broadcast list. Broadcast `arena:player_entered` to arena participants
- **Leave**: Validate `can_leave_at <= NOW()`. Delete `arena_participants` row, set `characters.arena_id = NULL`, set cooldown on character (store `cooldown_until` in participants table before delete, or on a separate column). Re-add player to zone. Broadcast `arena:player_left`
- **Challenge player**: Validate both in same arena, neither `in_combat`. Set both `in_combat = true` in `arena_participants`. Start PvP combat session. Broadcast `arena:participant_updated` for both
- **Challenge NPC**: Validate player in arena, not in combat. Check and consume 1x Arena Challenge Token from inventory. Start PvE combat session using existing combat engine with the arena monster's stats. Player enters with `arena_participants.current_hp`, not `characters.max_hp`
- **PvP combat resolution**: Adapts combat engine — each turn, both players attack simultaneously. Player A's auto-abilities target B's stats, B's target A's. Active window opens for both. On combat end: winner stays (update `arena_participants.current_hp`, set `in_combat = false`), loser is kicked (delete from `arena_participants`, set cooldown, restore to map). Grant XP/crowns per arena config
- **NPC combat resolution**: Uses existing combat engine. On win: update `arena_participants.current_hp`, set `in_combat = false`. On loss: kick from arena with cooldown
- **Kick**: Delete `arena_participants` row, set `characters.arena_id = NULL`, set `characters.current_hp` to arena HP, broadcast `arena:kicked` to the player, `arena:player_left` to arena, re-add to zone

**Map visibility integration** — In `zone-registry.ts` / `zone-broadcasts.ts`:
- When building `PlayerSummary[]` for `world.state`, exclude characters where `arena_id IS NOT NULL`
- When a player enters an arena, send `player.left_zone` to the zone
- When a player leaves/is kicked from the arena, send `player.entered_zone` to the zone

#### 4. Building Action Type — `'arena'` (CLAUDE.md 7-location checklist)

Following the "Adding a New Building Action Type" checklist:

1. **DB CHECK constraint** — Migration `031_arena_system.sql` (see above)
2. **Shared protocol types** — `ArenaBuildingActionDto` with `arena_id: number, arena_name: string`; add to `BuildingActionDto` union and `CityBuildingActionPayload.action_type`
3. **Game backend city-map-loader** — Add `if (a.action_type === 'arena')` branch mapping to `ArenaBuildingActionDto`
4. **Game backend building-action-handler** — Add `if (action.action_type === 'arena')` branch that sends `arena:enter` flow
5. **Admin backend buildings route** — Add `'arena'` to validation, add config processing branch (reads `arena_id` from config)
6. **Admin frontend API types** — Add `'arena'` to action type unions
7. **Admin frontend properties panel** — Add arena dropdown, save handler, display label

**Arena building action config**: `{ arena_id: number }` — links the building action to an arena definition.

#### 5. Frontend — Arena Lobby UI (`frontend/src/ui/ArenaPanel.ts`)

New panel replacing the building panel when player enters arena:
- **Header**: Arena name, time remaining before can leave (countdown timer)
- **Participant list**: Shows all arena players with name, level, class. Players `in_combat` show a crossed-swords icon and are non-interactive. Available players show a "Challenge" button
- **Fighter list**: Shows arena fighters (humanoid NPCs) with name, HP, ATK, DEF. Each has a "Challenge" button (grayed out if player has no Arena Challenge Tokens)
- **Leave button**: Disabled until `can_leave_at` passes, then enabled with confirmation dialog
- **Token count**: Shows current Arena Challenge Token quantity in inventory

Combat UI reuses the existing `CombatScreen.ts` with minor adaptation:
- PvP opponent shown where monster normally appears (name, level, class icon instead of monster icon)
- HP bar shows opponent's current HP (not bracket-hidden like bosses — PvP shows exact HP)
- Both players see the active window timer simultaneously

#### 6. Admin — Arena Management (`admin/backend/src/routes/arenas.ts`, `admin/frontend/src/ui/arena-manager.ts`)

**Admin routes**:
- `GET /api/arenas` — List all arenas
- `GET /api/arenas/:id` — Arena detail with monsters
- `POST /api/arenas` — Create arena (name, building_id, reward/timer config)
- `PUT /api/arenas/:id` — Update arena config
- `DELETE /api/arenas/:id` — Delete arena
- `GET /api/arenas/:id/monsters` — List assigned monsters
- `POST /api/arenas/:id/monsters` — Assign monster to arena
- `DELETE /api/arenas/:id/monsters/:monsterId` — Remove monster from arena
- `GET /api/arenas/:id/participants` — View current participants (admin monitoring)
- `POST /api/arenas/:id/kick/:characterId` — Force-kick a player (admin tool)

**Admin UI**:
- Arena manager tab in admin panel
- Create/edit form with all configurable fields (name, building, timers, rewards)
- Monster assignment with drag-and-drop or select from existing monsters
- Live participant viewer showing who's in each arena
- Force-kick button for moderation

### Implementation Sequence

Code changes must be implemented BEFORE entity execution:
1. `/speckit.specify` — Create technical spec from this Code Changes section
2. `speckit.plan` -> `speckit.tasks` -> `speckit.implement` — Build the code
3. `/gd.execute` — Create the Arena Challenge Token item, 6 arena fighter monsters, and Varn Bloodkeeper NPC via admin API

---

## Execution Plan

All content is created via the `game-entities` skill (admin REST API) **after code changes are implemented**. Order matters for FK constraints.

### Phase 1 — Core Arena Content

1. **Create 1 item** — Arena Challenge Token (resource, stack_size 50)
2. **Create 6 arena fighter monsters** — Pit Brawler, Sellsword, Duellist, Shieldwall Veteran, Reaver Captain, Arena Champion (no loot entries)
3. **Create 1 NPC** — Varn Bloodkeeper (no crafter/disassembler flags)
4. **Add Arena Challenge Token to existing monster loot tables**:
   - Bandit Scout (id 9): 10% drop, qty 1
   - Rabid Wolf (id 10): 8% drop, qty 1
   - Mine Crawler (id 11): 12% drop, qty 1
5. **Create arena via admin panel** — After code is deployed, use the new arena admin UI to:
   - Create an arena linked to a building
   - Configure rewards (50 XP winner, 10 XP loser, 25 crowns winner)
   - Configure timers (3600s min stay, 1800s cooldown)
   - Assign arena fighters (Pit Brawler, Sellsword, Duellist, Shieldwall Veteran, Reaver Captain, Arena Champion)
6. **Assign Varn Bloodkeeper to the arena building**
7. **Create arena building action** on the arena building (action_type: 'arena')

### Phase 2 — Future Content (Deferred)

- **Arena rankings leaderboard** — Display top combatants by `combat_wins`. Deferred because it needs a new UI screen and the ranking system may evolve
- **Arena seasons / rewards** — Periodic reset with special rewards for top-ranked players
- **Crafting recipe for Arena Challenge Tokens** — E.g., 3x Iron Bar + 1x Charite = 5x Arena Challenge Token at a smith
- **Arena-exclusive loot** — Special items that can only be earned through PvP win streaks
- **Spectator mode** — Allow non-participants to watch ongoing fights
- **Team arenas** — 2v2 or 3v3 group combat

---

## Testing Walkthrough

### Test 1: Basic Arena Entry and Exit

1. **Navigate to arena building** — Player sees the building with an "Enter Arena" action button
2. **Click Enter Arena** — Player disappears from the map. Arena lobby panel opens showing participant list (just this player), fighter list, and a grayed-out "Leave" button with countdown timer
3. **Verify map invisibility** — A second player in the same zone should NOT see the first player on the map
4. **Wait for min stay timer** — Leave button becomes active after configured time (test with short timer, e.g., 60 seconds)
5. **Click Leave** — Player reappears on the map at the arena building node. Arena panel closes. Leave button should show confirmation dialog first
6. **Try immediate re-entry** — Should be rejected with "You must wait X minutes before re-entering the arena" message

### Test 2: PvP Challenge Flow

1. **Two players enter the same arena** — Both see each other in the participant list
2. **Player A clicks "Challenge" on Player B** — Both players immediately enter combat. The arena lobby shows both as "In Combat" with crossed-swords icon
3. **A third player enters the arena** — They see Player A and B listed as "In Combat" and cannot challenge either
4. **Combat plays out** — Both players see the combat UI. Auto-abilities fire each turn. Active windows appear for both simultaneously
5. **One player wins** — Winner sees victory screen with XP and crowns gained. Winner returns to arena lobby with reduced HP. Loser sees defeat screen, is removed from arena, reappears on map
6. **Verify loser cooldown** — Loser tries to re-enter arena, rejected with cooldown message
7. **Verify winner HP** — Winner's HP in arena lobby matches post-combat HP (no healing between fights)

### Test 3: NPC Challenge with Token Consumption

1. **Player enters arena with Arena Challenge Tokens in inventory**
2. **Click "Challenge" on an arena fighter (e.g., Pit Brawler)** — 1x Arena Challenge Token is consumed. Combat starts using existing PvE combat UI
3. **Win the fight** — Player stays in arena with reduced HP. No loot drops, no crowns. XP is the fighter's standard XP reward
4. **Challenge another fighter** — Another token consumed. Player enters with carried-over HP
5. **Lose to a fighter** — Player is kicked from arena, placed on map, cooldown applied
6. **Try to challenge NPC with no tokens** — Challenge button grayed out, tooltip says "Requires Arena Challenge Token"

### Test 4: HP Persistence Chain

1. **Player enters arena at full HP (e.g., 100/100)**
2. **Fights NPC, wins with 80 HP remaining** — Arena lobby shows 80 HP
3. **Fights another player, wins with 55 HP remaining** — Arena lobby shows 55 HP
4. **Fights another player, loses** — Kicked from arena. Map character HP should be whatever the post-combat HP was on the losing turn
5. **Verify**: At no point between fights does HP regenerate or reset to max

### Test 5: Concurrent Fight Protection

1. **Players A, B, C are all in the arena**
2. **A challenges B** — Fight starts. Both marked as "In Combat"
3. **C tries to challenge A** — Rejected: "This player is already in combat"
4. **C tries to challenge B** — Rejected: "This player is already in combat"
5. **A vs B fight ends** — Winner returns to available state. C can now challenge the winner

### Test 6: Admin Configuration

1. **Admin creates arena via admin panel** — Sets name, building, timers, rewards
2. **Admin assigns monsters** — Selects from existing monster list
3. **Admin changes winner XP to 100** — Subsequent PvP wins award 100 XP
4. **Admin force-kicks a player** — Player is removed from arena immediately
5. **Admin deactivates arena** — No new entries allowed, existing participants can finish and leave

---

## Verification Checklist

- [ ] Arena Challenge Token created and droppable from monsters
- [ ] Varn Bloodkeeper NPC created and assigned to arena building
- [ ] Arena building action type works (enter arena flow)
- [ ] Players disappear from map when in arena
- [ ] Players reappear on map when leaving/kicked
- [ ] PvP combat works with both players using abilities
- [ ] NPC combat consumes Arena Challenge Token
- [ ] HP persists between arena fights (no healing)
- [ ] Loser is kicked from arena and gets cooldown
- [ ] Winner stays with reduced HP
- [ ] Min stay timer prevents early leaving
- [ ] Re-entry cooldown enforced
- [ ] In-combat players cannot be challenged
- [ ] Admin can create/configure arenas
- [ ] Admin can assign/remove monsters
- [ ] Admin can force-kick players
- [ ] XP and crown rewards match admin configuration
- [ ] No duplicate items/NPCs with existing content
