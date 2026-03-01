# Data Model: Elarion Core Game Design

**Branch**: `001-game-design` | **Phase**: 1 — Design

---

## Entities

### Account

A registered user identity. One account owns exactly one character (MVP scope).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `username` | VARCHAR(32) | Unique, not null, 3–32 chars, alphanumeric + underscore |
| `password_hash` | VARCHAR(255) | Not null (bcrypt hash) |
| `created_at` | TIMESTAMP | Not null, default now() |
| `banned_at` | TIMESTAMP | Nullable; set when account is banned |

**Validation rules**:
- Username: 3–32 characters, `[a-zA-Z0-9_]` only, case-insensitive uniqueness check.
- Password: minimum 8 characters (enforced at application layer, not stored).

**Relationships**:
- `Account` 1 → 1 `Character` (MVP; expandable to 1→N later)

---

### Character

A player's in-game avatar. Holds all persistent game state for a player.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `account_id` | UUID | Foreign key → Account.id, unique (1-per-account) |
| `name` | VARCHAR(32) | Unique, not null, 3–32 chars |
| `class_id` | SMALLINT | Foreign key → CharacterClass.id |
| `level` | SMALLINT | Not null, default 1, min 1 |
| `experience` | INTEGER | Not null, default 0, min 0 |
| `max_hp` | SMALLINT | Not null, derived from class + level |
| `current_hp` | SMALLINT | Not null, 0 ≤ current_hp ≤ max_hp |
| `attack_power` | SMALLINT | Not null |
| `defence` | SMALLINT | Not null |
| `zone_id` | SMALLINT | Foreign key → MapZone.id |
| `pos_x` | SMALLINT | Not null, 0-based tile column |
| `pos_y` | SMALLINT | Not null, 0-based tile row |
| `in_combat` | BOOLEAN | Not null, default false |
| `updated_at` | TIMESTAMP | Not null, updated on every save |

**State transitions**:
```
idle ──[start combat]──► in_combat ──[combat ends: victory]──► idle
                                  └──[combat ends: defeat] ──► dead → respawn → idle
```
`current_hp = 0` implies dead; server sets `in_combat = false` and respawns.

**Relationships**:
- `Character` N → 1 `CharacterClass`
- `Character` N → 1 `MapZone` (current location)
- `Character` 1 → N `CharacterItem` (inventory)

---

### CharacterClass

A template defining the starting stats and per-level progression curve.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | SMALLINT | Primary key |
| `name` | VARCHAR(32) | Unique, not null |
| `base_hp` | SMALLINT | Not null |
| `base_attack` | SMALLINT | Not null |
| `base_defence` | SMALLINT | Not null |
| `hp_per_level` | SMALLINT | Not null |
| `attack_per_level` | SMALLINT | Not null |
| `defence_per_level` | SMALLINT | Not null |
| `xp_curve` | JSONB | Not null — array of XP thresholds per level, e.g. `[0, 100, 250, 500, …]` |

**Launch classes** (seeded at startup):

| id | name | base_hp | base_atk | base_def |
|----|------|---------|----------|----------|
| 1 | Warrior | 120 | 15 | 12 |
| 2 | Mage | 70 | 25 | 6 |
| 3 | Ranger | 90 | 20 | 9 |

**Derived stat formula** (applied at character creation and level-up):
```
max_hp     = base_hp     + (level - 1) × hp_per_level
attack     = base_attack + (level - 1) × attack_per_level
defence    = base_defence + (level - 1) × defence_per_level
```

---

### MapZone

A discrete area of the game world. Tile layout loaded from a TMX file at server
startup; stored in DB for metadata only.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | SMALLINT | Primary key |
| `name` | VARCHAR(64) | Unique, not null |
| `tmx_filename` | VARCHAR(128) | Not null — relative path to the TMX file |
| `width_tiles` | SMALLINT | Not null |
| `height_tiles` | SMALLINT | Not null |
| `spawn_x` | SMALLINT | Not null — default spawn column |
| `spawn_y` | SMALLINT | Not null — default spawn row |
| `min_level` | SMALLINT | Not null, default 1 — minimum player level to enter |

**Runtime data** (held in server memory, not persisted):
- Active player list (character_id → position)
- Active monster instances (see MonsterInstance)
- Tile passability matrix (derived from TMX on load)

---

### Monster (template)

Defines a monster type. Instances are spawned from this template at runtime.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | SMALLINT | Primary key |
| `name` | VARCHAR(64) | Not null |
| `zone_id` | SMALLINT | Foreign key → MapZone.id |
| `max_hp` | SMALLINT | Not null |
| `attack_power` | SMALLINT | Not null |
| `defence` | SMALLINT | Not null |
| `xp_reward` | SMALLINT | Not null |
| `loot_table` | JSONB | Not null — array of `{item_id, drop_chance_pct}` |
| `respawn_seconds` | SMALLINT | Not null — time after death before re-spawn |
| `aggro_range` | SMALLINT | Not null, in tiles |

**MonsterInstance** (runtime / in-memory, not persisted):

| Field | Type |
|-------|------|
| `instance_id` | UUID (generated at spawn) |
| `template_id` | SMALLINT → Monster.id |
| `zone_id` | SMALLINT |
| `pos_x`, `pos_y` | SMALLINT |
| `current_hp` | SMALLINT |
| `in_combat` | BOOLEAN |
| `combatant_character_ids` | Set\<UUID\> |
| `respawn_at` | Timestamp or null |

---

### CombatSimulation

Persisted record of a completed or in-progress combat between one character and
one monster instance.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `character_id` | UUID | Foreign key → Character.id |
| `monster_id` | SMALLINT | Monster template id (for audit) |
| `zone_id` | SMALLINT | Zone where combat occurred |
| `started_at` | TIMESTAMP | Not null |
| `ended_at` | TIMESTAMP | Nullable until resolved |
| `outcome` | VARCHAR(8) | `'victory'` \| `'defeat'` \| `'pending'` |
| `xp_awarded` | SMALLINT | Nullable until outcome known |
| `rounds` | JSONB | Array of round summaries (attacker, action, damage, hp_after) |

**Note**: `rounds` is stored as JSONB for audit/replay purposes but streamed to
the client round-by-round during simulation.

---

### CombatParticipant

Tracks all characters who dealt damage to a monster instance (for shared-kill
reward distribution).

| Field | Type | Constraints |
|-------|------|-------------|
| `combat_simulation_id` | UUID | FK → CombatSimulation.id |
| `character_id` | UUID | FK → Character.id |
| `damage_dealt` | SMALLINT | Total damage by this character |

Primary key: `(combat_simulation_id, character_id)`

---

### Item

Defines an item template. Characters hold instances via CharacterItem.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | SMALLINT | Primary key |
| `name` | VARCHAR(64) | Unique, not null |
| `type` | VARCHAR(16) | `'weapon'` \| `'armour'` \| `'consumable'` |
| `stat_modifiers` | JSONB | e.g. `{"attack_power": 5, "defence": 2}` |
| `description` | TEXT | Nullable |

---

### CharacterItem

Junction table tracking each character's inventory.

| Field | Type | Constraints |
|-------|------|-------------|
| `character_id` | UUID | FK → Character.id |
| `item_id` | SMALLINT | FK → Item.id |
| `quantity` | SMALLINT | Not null, ≥ 1 |
| `equipped` | BOOLEAN | Not null, default false |

Primary key: `(character_id, item_id)`

---

### ChatMessage

Persisted chat messages (retained for moderation, short TTL acceptable).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `sender_character_id` | UUID | FK → Character.id |
| `channel` | VARCHAR(8) | `'local'` \| `'global'` |
| `zone_id` | SMALLINT | Nullable — only set for local channel |
| `message` | VARCHAR(256) | Not null, max 256 chars |
| `sent_at` | TIMESTAMP | Not null |

---

## Entity Relationship Summary

```
Account ──1:1──► Character ──N:1──► CharacterClass
                     │
                     ├──N:1──► MapZone
                     │
                     ├──1:N──► CharacterItem ──N:1──► Item
                     │
                     └──1:N──► CombatSimulation ──1:N──► CombatParticipant

Monster ──N:1──► MapZone
ChatMessage ──N:1──► Character
```

---

## Combat Simulation Algorithm

The server runs the following loop when combat is triggered:

```
1. Lock monster instance (prevent double-combat)
2. Create CombatSimulation record (status: pending)
3. Repeat until one party's HP = 0:
   a. Attacker deals damage:
      damage = max(1, attacker.attack_power - defender.defence + random(-3, +3))
      critical = random() < 0.05 → damage × 1.5
   b. Record round in simulation.rounds[]
   c. Stream `combat.round` message to all participants
   d. Swap attacker/defender (monster attacks back)
4. On player victory:
   - Award XP to all CombatParticipant entries (FR-018)
   - Roll loot for each participant independently
   - Check level-up threshold; apply if crossed
   - Emit `combat.ended`, `character.levelled_up` as applicable
5. On player defeat:
   - Respawn player at zone spawn point with 50% HP
   - Emit `combat.ended` with outcome = 'defeat'
6. Schedule monster respawn (respawn_seconds from template)
```

---

## Database Indexes

| Table | Index | Reason |
|-------|-------|--------|
| Account | UNIQUE(username LOWER) | Fast case-insensitive username lookup |
| Character | UNIQUE(account_id) | Enforce one-per-account |
| Character | INDEX(zone_id) | Fetch all players in a zone |
| CombatSimulation | INDEX(character_id, outcome) | Player combat history |
| ChatMessage | INDEX(zone_id, sent_at) | Fetch recent local messages |
| ChatMessage | INDEX(sent_at) | Fetch recent global messages |
