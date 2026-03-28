# Boss Encounter System — Data Model

## Entity Relationship Diagram

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────┐
│  abilities   │     │      bosses       │     │  buildings   │
│              │◄────┤                   ├────►│             │
│  id          │     │  id               │     │  id         │
│  name        │     │  name             │     │  name       │
│  effect_type │     │  description      │     │  zone_id    │
│  ...         │     │  icon_filename    │     └─────────────┘
└──────────────┘     │  sprite_filename  │
       ▲             │  max_hp           │
       │             │  attack           │
┌──────┴───────┐     │  defense          │
│boss_abilities│     │  xp_reward        │
│              │     │  min_crowns       │
│  id          │     │  max_crowns       │
│  boss_id  ──►├────►│  building_id  ───►│
│  ability_id  │     │  respawn_min_s    │
│  priority    │     │  respawn_max_s    │
└──────────────┘     │  is_active        │
                     │  created_at       │
┌──────────────┐     └────────┬──────────┘
│  boss_loot   │              │
│              │              │
│  id          │     ┌────────▼──────────┐
│  boss_id  ──►├────►│  boss_instances   │
│  item_def_id │     │                   │
│  drop_chance │     │  id               │
│  quantity    │     │  boss_id          │
└──────────────┘     │  current_hp       │
                     │  status           │
┌──────────────┐     │  fighting_char_id │
│item_definitns│     │  total_attempts   │
│              │◄────┤  spawned_at       │
│  id          │     │  defeated_at      │
│  name        │     │  respawn_at       │
│  ...         │     └───────────────────┘
└──────────────┘
```

## Entities

### Boss Definition (`bosses`)

The template for a boss. One definition produces one live instance at a time.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Display name |
| description | TEXT | | Flavor text shown in info panel |
| icon_filename | VARCHAR(255) | | Combat icon PNG filename |
| sprite_filename | VARCHAR(255) | | Map sprite PNG filename |
| max_hp | INTEGER | NOT NULL, > 0 | Full health pool |
| attack | INTEGER | NOT NULL, >= 0 | Base attack stat |
| defense | INTEGER | NOT NULL, >= 0 | Base defense stat |
| xp_reward | INTEGER | NOT NULL, DEFAULT 0, >= 0 | XP granted on defeat |
| min_crowns | INTEGER | NOT NULL, DEFAULT 0, >= 0 | Minimum crown drop |
| max_crowns | INTEGER | NOT NULL, DEFAULT 0, >= min_crowns | Maximum crown drop |
| building_id | INTEGER | REFERENCES buildings(id), UNIQUE | Guarded building (one boss per building) |
| respawn_min_seconds | INTEGER | NOT NULL, DEFAULT 3600, > 0 | Minimum respawn delay |
| respawn_max_seconds | INTEGER | NOT NULL, DEFAULT 7200, >= respawn_min_seconds | Maximum respawn delay |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Admin toggle |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |

**Validation rules**:
- `max_crowns >= min_crowns`
- `respawn_max_seconds >= respawn_min_seconds`
- `building_id` is UNIQUE — one boss per building maximum
- When `is_active` is false, no instance is spawned and building is unblocked

### Boss Ability Assignment (`boss_abilities`)

Links a boss to existing abilities with priority ordering.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| boss_id | INTEGER | NOT NULL, REFERENCES bosses(id) ON DELETE CASCADE | Parent boss |
| ability_id | INTEGER | NOT NULL, REFERENCES abilities(id) | Linked ability |
| priority | INTEGER | NOT NULL, DEFAULT 0 | Higher = fires first (same as player auto ability priority) |

**Constraints**: UNIQUE(boss_id, ability_id) — can't assign same ability twice.

### Boss Loot Entry (`boss_loot`)

Loot table for a boss. Same pattern as `monster_loot`.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| boss_id | INTEGER | NOT NULL, REFERENCES bosses(id) ON DELETE CASCADE | Parent boss |
| item_def_id | INTEGER | NOT NULL, REFERENCES item_definitions(id) | Dropped item |
| drop_chance | NUMERIC(5,2) | NOT NULL, 0.00-100.00 | Drop probability as percentage |
| quantity | INTEGER | NOT NULL, DEFAULT 1, > 0 | Number of items dropped |

### Boss Instance (`boss_instances`)

Live state of a spawned boss. One row per active/defeated boss.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| boss_id | INTEGER | NOT NULL, REFERENCES bosses(id) ON DELETE CASCADE | Boss definition |
| current_hp | INTEGER | NOT NULL | Current health (decreases during fights) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'alive', CHECK IN ('alive','in_combat','defeated') | Current state |
| fighting_character_id | INTEGER | REFERENCES characters(id) | Who is currently fighting (NULL unless in_combat) |
| total_attempts | INTEGER | NOT NULL, DEFAULT 0 | Number of challenge attempts on this instance |
| spawned_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When this instance was created |
| defeated_at | TIMESTAMPTZ | | When killed (NULL if alive/in_combat) |
| respawn_at | TIMESTAMPTZ | | Pre-calculated respawn time (NULL if alive/in_combat) |

**State machine**:

```
                ┌─────────┐
   spawn/       │  alive  │◄──────────────── respawn timer expires
   respawn      │         │                  (create new instance)
                └────┬────┘
                     │ player challenges
                     ▼
                ┌──────────┐
                │in_combat │
                │          │──── player disconnect → back to alive
                └────┬─────┘    (boss keeps current HP)
                     │
              ┌──────┴──────┐
              ▼             ▼
         player wins    player loses
              │             │
              ▼             ▼
        ┌──────────┐   back to alive
        │ defeated  │   (boss keeps HP)
        │          │
        └────┬─────┘
             │ respawn_at reached
             ▼
        new instance (alive, full HP)
```

## Shared Protocol Types (DTOs)

### BossDto
Sent to game clients as part of zone state.

```
BossDto {
  id: number
  name: string
  description: string | null
  icon_url: string | null
  sprite_url: string | null
  building_id: number
  status: 'alive' | 'in_combat' | 'defeated' | 'inactive'
  fighting_character_name: string | null  // only when in_combat
  total_attempts: number
  respawn_at: string | null               // ISO 8601, only when defeated
}
```

### BossHpBracket
Used instead of exact HP in combat payloads.

```
BossHpBracket = 'full' | 'high' | 'medium' | 'low' | 'critical'
  full:     > 80% HP
  high:     60-80% HP
  medium:   40-60% HP
  low:      20-40% HP
  critical: <= 20% HP
```

### BossCombatStartPayload
Sent to the fighting player when combat begins.

```
BossCombatStartPayload {
  combat_id: string
  boss: {
    id: number
    name: string
    icon_url: string | null
    attack: number
    defense: number
    hp_bracket: BossHpBracket    // NOT exact HP
    abilities: { name: string, icon_url: string | null }[]  // display only
  }
  player: PlayerCombatStateDto   // reuse existing type
  loadout: { slots: CombatAbilityStateDto[] }  // reuse existing type
  turn_timer_ms: number
}
```

### BossCombatTurnResultPayload
Same structure as CombatTurnResultPayload but with bracket instead of exact HP.

```
BossCombatTurnResultPayload {
  combat_id: string
  turn: number
  phase: 'player' | 'enemy'
  events: CombatEventDto[]       // reuse existing type
  player_hp: number
  player_mana: number
  enemy_hp_bracket: BossHpBracket  // NOT exact HP
  ability_states: CombatAbilityStateDto[]
}
```

### BossCombatEndPayload
Sent when boss fight ends.

```
BossCombatEndPayload {
  combat_id: string
  outcome: 'win' | 'loss'
  current_hp: number              // player HP remaining
  boss_name: string
  boss_icon_url: string | null
  enemy_hp_bracket: BossHpBracket // hint for loser
  xp_gained: number
  crowns_gained: number
  items_dropped: ItemDroppedDto[]
}
```

### BossStatePayload
Broadcast to all players in the zone on state changes.

```
BossStatePayload {
  boss_id: number
  building_id: number
  status: 'alive' | 'in_combat' | 'defeated'
  fighting_character_name: string | null
  total_attempts: number
  respawn_at: string | null
}
```
