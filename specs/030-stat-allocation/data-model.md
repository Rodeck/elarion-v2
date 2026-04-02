# Data Model: Character Stat Allocation System

**Feature**: 030-stat-allocation | **Date**: 2026-04-02

## Schema Changes

### Migration: `033_stat_allocation.sql`

#### 1. ALTER `characters` — Add attribute columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `stat_points_unspent` | SMALLINT NOT NULL | 0 | Points available to allocate |
| `attr_constitution` | SMALLINT NOT NULL | 0 | Allocated Constitution points |
| `attr_strength` | SMALLINT NOT NULL | 0 | Allocated Strength points |
| `attr_intelligence` | SMALLINT NOT NULL | 0 | Allocated Intelligence points |
| `attr_dexterity` | SMALLINT NOT NULL | 0 | Allocated Dexterity points |
| `attr_toughness` | SMALLINT NOT NULL | 0 | Allocated Toughness points |

#### 2. ALTER `npcs` — Add trainer role

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `is_trainer` | BOOLEAN NOT NULL | false | NPC can train players (stat allocation) |

#### 3. Data migration — Reset existing characters

```sql
-- Reset max_hp, attack_power, defence to class base values
UPDATE characters c
SET max_hp       = cc.base_hp,
    attack_power = cc.base_attack,
    defence      = cc.base_defence,
    current_hp   = LEAST(c.current_hp, cc.base_hp),
    stat_points_unspent = 7 * (c.level - 1)
FROM character_classes cc
WHERE c.class_id = cc.id;
```

## Entity Relationships

```text
character_classes (1) ──── (N) characters
                                 │
                                 ├── attr_constitution
                                 ├── attr_strength
                                 ├── attr_intelligence
                                 ├── attr_dexterity
                                 ├── attr_toughness
                                 └── stat_points_unspent

npcs
  └── is_trainer (boolean role flag)
```

## Derived Stats Computation

**Input**: Character attributes + class base stats + equipment bonuses

```text
Base HP       = class.base_hp    + (attr_constitution × 4)
Base ATK      = class.base_attack + (attr_constitution × 1) + (attr_strength × 2)
Base DEF      = class.base_defence + (attr_toughness × 1)
Base Mana     = 100              + (attr_intelligence × 8)
Crit Chance   = 0%               + (attr_dexterity × 0.1%)  + equipment_crit
Crit Damage   = 150%             + (attr_strength × 0.3%)   + equipment_crit_dmg
Dodge Chance  = 0%               + (attr_dexterity × 0.1%)  + equipment_dodge

Final ATK     = Base ATK + equipment_attack
Final DEF     = Base DEF + equipment_defence
Final HP      = Base HP  (equipment doesn't add HP currently)
Final Mana    = Base Mana + equipment_mana
```

## Validation Rules

| Rule | Constraint |
|------|-----------|
| Per-stat cap | `attr_X <= 10 × (level - 1)` for each attribute |
| Total allocated | `SUM(all attrs) <= 7 × (level - 1)` |
| Unspent non-negative | `stat_points_unspent >= 0` |
| Allocation increment | Each attribute increment in a request must be >= 0 |
| Sum of increments | Must equal total points being spent (<= unspent) |
| Not in combat | Player must not be in active combat to allocate |

## State Transitions

```text
Level Up:
  stat_points_unspent += 7 × levels_gained
  (no changes to max_hp, attack_power, defence)

Allocate Points:
  stat_points_unspent -= sum_of_increments
  attr_X += increment_X (for each attribute)
  max_hp = class.base_hp + (attr_constitution × 4)
  attack_power = class.base_attack + (attr_constitution × 1) + (attr_strength × 2)
  defence = class.base_defence + (attr_toughness × 1)
  current_hp = LEAST(current_hp, max_hp)  -- only if max_hp decreased (shouldn't happen with allocation)
```
