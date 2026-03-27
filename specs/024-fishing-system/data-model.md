# Data Model: Fishing System

**Feature**: 024-fishing-system | **Date**: 2026-03-26

## New Tables

### fishing_loot

Defines the weighted loot pool for fishing, gated by rod tier.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| min_rod_tier | SMALLINT | NOT NULL, CHECK (1-5) | Minimum rod tier required to access this entry |
| item_def_id | INTEGER | NOT NULL, FK item_definitions(id) ON DELETE CASCADE | Item that can be caught |
| drop_weight | INTEGER | NOT NULL, CHECK (>= 1) | Relative weight for weighted random selection |

**Indexes**: `idx_fishing_loot_tier` on `min_rod_tier`

**Loot resolution**: SELECT all entries WHERE `min_rod_tier <= player_rod_tier`, then weighted random pick using `drop_weight`.

### fishing_rod_tiers

Static reference table defining rod tier properties.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| tier | SMALLINT | PRIMARY KEY, CHECK (1-5) | Rod tier level |
| item_def_id | INTEGER | NOT NULL, FK item_definitions(id), UNIQUE | The item definition for this rod tier |
| upgrade_points_cost | INTEGER | NOT NULL, CHECK (>= 0) | Rod Upgrade Points required to reach this tier |
| max_durability | INTEGER | NOT NULL, CHECK (> 0) | Durability cap at this tier |

**Note**: T1 has `upgrade_points_cost = 0` (starting tier). Resource costs for upgrades are stored in the existing crafting/recipe system or as JSONB config — kept simple for MVP.

## Altered Tables

### characters

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| rod_upgrade_points | INTEGER | 0 | Accumulated fishing upgrade currency |

**Constraint**: CHECK (rod_upgrade_points >= 0)

### item_definitions

**CHECK constraint update** — extend `category` to include:
```
'resource' | 'food' | 'heal' | 'weapon' | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool' | 'helmet' | 'chestplate' | 'ring' | 'amulet'
```

**CHECK constraint update** — extend `tool_type` to include:
```
'pickaxe' | 'axe' | 'fishing_rod'
```

### inventory_items

**CHECK constraint update** — extend `equipped_slot` to include:
```
'helmet' | 'chestplate' | 'left_arm' | 'right_arm' | 'greaves' | 'bracer' | 'boots' | 'ring' | 'amulet'
```

### building_actions

**CHECK constraint update** — extend `action_type` to include:
```
'travel' | 'explore' | 'expedition' | 'gather' | 'marketplace' | 'fishing'
```

### quest_rewards (quest system)

**CHECK constraint update** — extend `reward_type` to include `'rod_upgrade_points'` (if CHECK exists on this column; otherwise handled in application code).

## Entity Relationship Summary

```
characters
  ├── rod_upgrade_points (INTEGER)
  ├── inventory_items ──→ item_definitions
  │     └── equipped_slot (ring | amulet | ...)
  └── character_quests ──→ quest_definitions
        └── quest_rewards (rod_upgrade_points type)

item_definitions
  ├── category: 'ring' | 'amulet' | 'tool' (fishing_rod) | 'resource' (fish)
  ├── tool_type: 'fishing_rod'
  └── stat columns (dodge_chance, crit_chance, mana_regen, etc.)

fishing_loot
  └── item_def_id ──→ item_definitions
  └── min_rod_tier (1-5)

fishing_rod_tiers
  └── item_def_id ──→ item_definitions

building_actions
  └── action_type: 'fishing'
  └── config: { min_rod_tier?: number } (JSONB)

npcs (Fisherman)
  └── is_quest_giver: true
  └── building_npcs ──→ buildings (fishing spot building)
```

## State Transitions

### Fishing Session (in-memory, not persisted)

```
IDLE → CASTING → WAITING_FOR_BITE → TENSION_PHASE → REELING → RESULT
  │                                                              │
  │       (disconnect/timeout at any phase)                      │
  └──────────── CANCELLED ←──────────────────────────────────────┘
```

- **IDLE**: No active session
- **CASTING**: Server validates rod/spot, picks fish, computes parameters
- **WAITING_FOR_BITE**: Server has sent parameters; bite delay counting down
- **TENSION_PHASE**: Fish has bitten; client running mini-game
- **REELING**: Player attempting final catch
- **RESULT**: Server evaluated timing data; loot granted or fish escaped
- **CANCELLED**: Session aborted (disconnect, timeout, snap check)

### Rod Lifecycle

```
PURCHASED/GRANTED (T1, full durability)
  │
  ├── FISH → durability -= 1
  │     └── if durability == 1 → LOCKED
  │
  ├── LOCKED → REPAIR (crowns + resources) → full durability
  │
  └── UPGRADE (points + resources) → tier += 1, durability = new tier max
```

## New Item Definitions (seed data)

### Fishing Rods (category: 'tool', tool_type: 'fishing_rod')

| Name | Tier | max_durability | power |
|------|------|---------------|-------|
| Crude Fishing Rod | T1 | 30 | 1 |
| Sturdy Fishing Rod | T2 | 50 | 2 |
| Reinforced Fishing Rod | T3 | 75 | 3 |
| Master Fishing Rod | T4 | 100 | 4 |
| Legendary Ashen Rod | T5 | 150 | 5 |

### Fish (category: 'resource', stackable)

| Name | Min Rod Tier | stack_size | drop_weight |
|------|-------------|------------|-------------|
| Mudfish | T1 | 20 | 40 |
| River Perch | T1 | 20 | 35 |
| Spotted Minnow | T1 | 20 | 25 |
| Silverscale Trout | T2 | 15 | 30 |
| Blackwater Catfish | T2 | 15 | 25 |
| Golden Carp | T3 | 10 | 20 |
| Ashfin Eel | T3 | 10 | 15 |
| Pale Sturgeon | T3 | 10 | 15 |
| Deep Lurker | T4 | 5 | 12 |
| Mistscale | T4 | 5 | 10 |
| Abyssal Leviathan Fin | T5 | 3 | 5 |
| Ghostfish | T5 | 3 | 3 |

### Rings (category: 'ring', non-stackable)

| Name | Min Rod Tier | Stats |
|------|-------------|-------|
| Copper River Ring | T2 | defence: 2 |
| Silverscale Band | T3 | dodge_chance: 3 |
| Ashfin Loop | T4 | crit_chance: 5, mana_regen: 2 |
| Leviathan's Coil | T5 | crit_damage: 158, dodge_chance: 5 |

### Amulets (category: 'amulet', non-stackable)

| Name | Min Rod Tier | Stats |
|------|-------------|-------|
| Tarnished River Pendant | T2 | max_mana: 3 |
| Mistscale Amulet | T3 | mana_regen: 5 |
| Deep Current Charm | T4 | mana_on_hit: 4, defence: 3 |
| Abyssal Talisman | T5 | max_mana: 10, mana_regen: 5, crit_chance: 3 |

Note: Ring/amulet `drop_weight` values should be low (1-3) compared to fish (10-40) to maintain rarity per SC-003.
