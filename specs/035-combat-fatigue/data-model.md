# Data Model: Combat Fatigue System

**Branch**: `035-combat-fatigue` | **Date**: 2026-04-06

## Entities

### FatigueConfig (persistent, database)

Per-combat-type fatigue configuration managed by admins.

| Field            | Type        | Constraints                         | Description                                    |
|------------------|-------------|-------------------------------------|------------------------------------------------|
| combat_type      | VARCHAR(32) | PRIMARY KEY                         | One of: `'monster'`, `'boss'`, `'pvp'`         |
| start_round      | INTEGER     | NOT NULL, DEFAULT 0, >= 0           | Round at which fatigue begins (0 = disabled)   |
| base_damage      | INTEGER     | NOT NULL, DEFAULT 5, >= 0           | Damage dealt on the first fatigue round        |
| damage_increment | INTEGER     | NOT NULL, DEFAULT 3, >= 0           | Damage increase per subsequent fatigue round   |
| updated_at       | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()             | Last modification timestamp                    |

**Relationships**: None — standalone configuration table.

**Lifecycle**: Rows created by migration (one per combat type). Updated via admin panel. Never deleted.

**Validation rules**:
- `start_round` must be >= 0 (0 means disabled)
- `base_damage` must be >= 0
- `damage_increment` must be >= 0
- `combat_type` must be one of the allowed values (CHECK constraint)

---

### FatigueState (ephemeral, in-memory)

Per-combatant fatigue tracking during an active combat session. Not persisted.

| Field                | Type    | Description                                                        |
|----------------------|---------|-------------------------------------------------------------------|
| fatigueStartRound    | number  | Effective start round (config start_round + onset_delay_modifier)  |
| baseDamage           | number  | Config base_damage                                                 |
| damageIncrement      | number  | Config damage_increment                                            |
| fatigueActive        | boolean | Whether fatigue is currently dealing damage                        |
| fatigueTurnCount     | number  | Number of rounds fatigue has been active (starts at 0)             |
| onsetDelayModifier   | number  | Extra rounds before fatigue starts (from future buffs, default 0)  |
| immunityRoundsLeft   | number  | Rounds of fatigue immunity remaining (from future buffs, default 0)|
| damageReduction      | number  | Percentage damage reduction (0-100, from future buffs, default 0)  |

**Lifecycle**: Created when combat session starts (initialized from FatigueConfig). Updated each round. Destroyed when combat session ends.

**State transitions**:
```
INACTIVE (round < fatigueStartRound)
  → ACTIVE (round >= fatigueStartRound)
    → IMMUNE (if immunityRoundsLeft > 0, skip damage, decrement immunity)
    → DEALING_DAMAGE (apply damage formula, increment fatigueTurnCount)
```

**Damage formula**: `max(0, (baseDamage + (fatigueTurnCount - 1) * damageIncrement) * (1 - damageReduction / 100))`

---

### FatigueModifier (conceptual, for future extensibility)

Not a database entity. Represents the interface that future items/buffs/skills will populate.

| Field              | Type   | Description                                              |
|--------------------|--------|----------------------------------------------------------|
| onset_delay_bonus  | number | Additional rounds before fatigue starts                   |
| immunity_rounds    | number | Rounds of complete fatigue immunity once fatigue activates|
| damage_reduction   | number | Percentage reduction to fatigue damage (0-100)            |

**Source**: Will come from equipped items, active buffs, or ability effects. Currently all values are 0.

## Entity Relationships

```
FatigueConfig (DB, 3 rows)
  ──reads──▶ FatigueState (in-memory, per combatant per session)
                 ◀──modifies── FatigueModifier (future: from items/buffs/skills)
```

## Migration: 039_combat_fatigue.sql

```sql
CREATE TABLE IF NOT EXISTS fatigue_config (
  combat_type      VARCHAR(32)  PRIMARY KEY,
  start_round      INTEGER      NOT NULL DEFAULT 0,
  base_damage      INTEGER      NOT NULL DEFAULT 5,
  damage_increment INTEGER      NOT NULL DEFAULT 3,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fatigue_config_combat_type_check
    CHECK (combat_type IN ('monster', 'boss', 'pvp'))
);

-- Pre-populate with all combat types (disabled by default)
INSERT INTO fatigue_config (combat_type, start_round, base_damage, damage_increment)
VALUES
  ('monster', 0, 5, 3),
  ('boss',    0, 10, 5),
  ('pvp',     0, 5, 3)
ON CONFLICT (combat_type) DO NOTHING;
```
