# Data Model: Combat System — Mana Threshold Auto-Battle

**Branch**: `016-combat-system` | **Date**: 2026-03-13

---

## New Tables

### `abilities`

Master definitions for all combat abilities. Managed via admin panel.

```sql
CREATE TABLE abilities (
  id               SERIAL        PRIMARY KEY,
  name             VARCHAR(64)   NOT NULL UNIQUE,
  icon_filename    VARCHAR(256),
  description      TEXT          NOT NULL DEFAULT '',
  effect_type      VARCHAR(16)   NOT NULL
    CHECK (effect_type IN ('damage','heal','buff','debuff','dot','shield','reflect','drain')),
  mana_cost        SMALLINT      NOT NULL DEFAULT 20  CHECK (mana_cost  > 0),
  effect_value     INTEGER       NOT NULL DEFAULT 0,
  duration_turns   SMALLINT      NOT NULL DEFAULT 0   CHECK (duration_turns  >= 0),
  cooldown_turns   SMALLINT      NOT NULL DEFAULT 0   CHECK (cooldown_turns  >= 0),
  priority_default SMALLINT      NOT NULL DEFAULT 1   CHECK (priority_default >= 1),
  slot_type        VARCHAR(8)    NOT NULL DEFAULT 'both'
    CHECK (slot_type IN ('auto','active','both')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
```

**Notes**:
- `effect_type` is the code-defined category; read-only in the admin UI.
- `effect_value` semantics depend on `effect_type`: damage = flat damage, heal = % of max HP, buff = stat modifier %, dot = damage per tick, reflect = % of incoming damage.
- `duration_turns = 0` means instant (no ongoing effect).
- `cooldown_turns = 0` means no cooldown.

---

### `character_owned_abilities`

Many-to-many junction: which characters own which abilities.

```sql
CREATE TABLE character_owned_abilities (
  character_id  VARCHAR(36)  NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ability_id    INTEGER      NOT NULL REFERENCES abilities(id)  ON DELETE CASCADE,
  obtained_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, ability_id)
);
```

---

### `character_loadouts`

One row per slot per character. Upserted on every loadout change.

```sql
CREATE TABLE character_loadouts (
  character_id  VARCHAR(36)  NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_name     VARCHAR(8)   NOT NULL
    CHECK (slot_name IN ('auto_1','auto_2','auto_3','active')),
  ability_id    INTEGER      REFERENCES abilities(id) ON DELETE SET NULL,
  priority      SMALLINT     NOT NULL DEFAULT 1 CHECK (priority >= 1),
  PRIMARY KEY (character_id, slot_name)
);
```

**Notes**:
- `ability_id = NULL` means the slot is empty.
- `priority` is the firing order for auto slots (higher = fires first). Ignored for the `active` slot.
- Constraint check: slot `auto_*` may only hold abilities with `slot_type IN ('auto','both')`; `active` slot may only hold `slot_type IN ('active','both')` — enforced in application logic, not DB constraint.

---

### `monster_ability_loot`

Per-monster droppable ability table (mirrors `monster_loot` pattern).

```sql
CREATE TABLE monster_ability_loot (
  id          SERIAL    PRIMARY KEY,
  monster_id  INTEGER   NOT NULL REFERENCES monsters(id)  ON DELETE CASCADE,
  ability_id  INTEGER   NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  drop_chance SMALLINT  NOT NULL CHECK (drop_chance BETWEEN 1 AND 100),
  UNIQUE (monster_id, ability_id)
);
```

---

## Modified Tables

### `item_definitions` — new mana stat columns

```sql
ALTER TABLE item_definitions
  ADD COLUMN max_mana             SMALLINT NOT NULL DEFAULT 0 CHECK (max_mana             >= 0),
  ADD COLUMN mana_on_hit          SMALLINT NOT NULL DEFAULT 0 CHECK (mana_on_hit          >= 0),
  ADD COLUMN mana_on_damage_taken SMALLINT NOT NULL DEFAULT 0 CHECK (mana_on_damage_taken >= 0),
  ADD COLUMN mana_regen           SMALLINT NOT NULL DEFAULT 0 CHECK (mana_regen           >= 0),
  ADD COLUMN dodge_chance         SMALLINT NOT NULL DEFAULT 0 CHECK (dodge_chance  BETWEEN 0 AND 100),
  ADD COLUMN crit_chance          SMALLINT NOT NULL DEFAULT 0 CHECK (crit_chance   BETWEEN 0 AND 100),
  ADD COLUMN crit_damage          SMALLINT NOT NULL DEFAULT 150 CHECK (crit_damage >= 100);
  -- crit_damage stored as integer percentage: 150 = 1.5× (default), 200 = 2×
```

**All new columns default to 0 (or 150 for `crit_damage`). Existing items are unaffected.**

---

## Default Ability Seeds (in migration)

These 9 abilities are inserted via `INSERT … ON CONFLICT (name) DO NOTHING` in the migration:

| Name | Effect Type | Mana Cost | Effect Value | Duration | Cooldown | Slot Type |
|------|-------------|-----------|--------------|----------|----------|-----------|
| Power Strike | damage | 20 | 150 | 0 | 0 | both |
| Mend | heal | 30 | 20 | 0 | 0 | both |
| Iron Skin | buff | 25 | 30 | 3 | 0 | auto |
| Venom Edge | dot | 15 | 5 | 4 | 0 | auto |
| Battle Cry | buff | 40 | 25 | 3 | 0 | both |
| Shatter | debuff | 35 | 20 | 2 | 0 | active |
| Execute | damage | 50 | 300 | 0 | 0 | active |
| Reflect | reflect | 30 | 40 | 2 | 0 | auto |
| Drain Life | drain | 25 | 100 | 0 | 0 | both |

*Effect value semantics per type: damage = % of attack power, heal = % of max HP, buff = % stat increase, dot = % of attack per tick, debuff = % defence reduction, reflect = % of incoming damage returned, drain = % of attack power dealt as damage (50% returned as HP).*

---

## In-Memory Combat Session State

Not persisted in Phase A. Defined here for completeness.

```typescript
interface CombatSession {
  combatId: string;           // UUID
  characterId: string;
  monsterId: number;
  turn: number;               // current turn counter (1-based)

  // Combatant state
  playerHp: number;
  playerMaxHp: number;
  playerMana: number;
  playerMaxMana: number;
  playerStats: DerivedCombatStats;

  enemyHp: number;
  enemyMaxHp: number;
  enemyAttack: number;
  enemyDefence: number;

  // Loadout (snapshot at combat start — frozen until combat ends)
  loadout: CombatLoadout;

  // Transient per-combat state
  activeEffects: ActiveEffect[];    // buffs, debuffs, DoTs on player or enemy
  abilityCooldowns: Map<number, number>; // abilityId → turns remaining

  // Timer
  activeWindowTimerRef: NodeJS.Timeout | null;
  phase: 'player_turn' | 'active_window' | 'enemy_turn' | 'ended';
}

interface DerivedCombatStats {
  attack: number;
  defence: number;
  maxMana: number;
  manaOnHit: number;
  manaOnDamageTaken: number;
  manaRegen: number;
  dodgeChance: number;   // 0–100
  critChance: number;    // 0–100
  critDamage: number;    // integer %, e.g. 150 = 1.5×
}

interface ActiveEffect {
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  effectType: 'buff' | 'debuff' | 'dot' | 'reflect';
  stat?: string;         // for buff/debuff: 'attack' | 'defence'
  value: number;         // % modifier or flat damage per tick
  turnsRemaining: number;
}

interface CombatLoadout {
  auto_1: LoadoutSlotSnapshot | null;
  auto_2: LoadoutSlotSnapshot | null;
  auto_3: LoadoutSlotSnapshot | null;
  active:  LoadoutSlotSnapshot | null;
}

interface LoadoutSlotSnapshot {
  abilityId: number;
  name: string;
  manaCost: number;
  effectType: string;
  effectValue: number;
  durationTurns: number;
  cooldownTurns: number;
  priority: number;
  slotType: string;
}
```

---

## Migration File

`backend/src/db/migrations/018_combat_system.sql`

Contains, in order:
1. `ALTER TABLE item_definitions` — add mana stat columns
2. `CREATE TABLE abilities`
3. `CREATE TABLE character_owned_abilities`
4. `CREATE TABLE character_loadouts`
5. `CREATE TABLE monster_ability_loot`
6. `INSERT INTO abilities … ON CONFLICT (name) DO NOTHING` — 9 default abilities
