# Data Model: Monster Combat System (008)

**Branch**: `008-monster-combat`
**Migration**: `011_monster_combat.sql`

---

## Tables Removed (Migration 011)

| Table | Reason |
|-------|--------|
| `combat_simulations` | Old combat system, no longer needed |
| `combat_participants` | Old combat system |
| `monsters` (old, from 005) | New schema replaces it; old table referenced deleted `items` table |

`WorldStatePayload.monsters` field removed from the WebSocket protocol (old monsters were world-map roaming entities).

---

## New Tables

### `monsters`

Global monster templates managed by admins.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PK | Auto-incrementing ID |
| `name` | `VARCHAR(64)` | NOT NULL | Display name |
| `icon_filename` | `VARCHAR(256)` | NULLABLE | UUID filename under `backend/assets/monsters/icons/` |
| `attack` | `SMALLINT` | NOT NULL, DEFAULT 1, CHECK ≥ 0 | Damage stat |
| `defense` | `SMALLINT` | NOT NULL, DEFAULT 0, CHECK ≥ 0 | Damage mitigation stat |
| `hp` | `SMALLINT` | NOT NULL, DEFAULT 10, CHECK ≥ 1 | Hit points |
| `xp_reward` | `SMALLINT` | NOT NULL, DEFAULT 0, CHECK ≥ 0 | EXP granted to player on defeat |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | Creation timestamp |

### `monster_loot`

Per-monster item drop configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | PK | Auto-incrementing ID |
| `monster_id` | `INTEGER` | NOT NULL, FK → `monsters(id)` ON DELETE CASCADE | Owning monster |
| `item_def_id` | `INTEGER` | NOT NULL, FK → `item_definitions(id)` ON DELETE CASCADE | Item that may drop |
| `drop_chance` | `SMALLINT` | NOT NULL, CHECK 1–100 | Percentage roll (1 = 1%, 100 = always) |
| `quantity` | `SMALLINT` | NOT NULL, DEFAULT 1, CHECK ≥ 1 | Quantity dropped per successful roll |

### `building_actions` (modified)

No new columns. The `action_type` CHECK constraint is extended:

```sql
CHECK (action_type IN ('travel', 'explore'))
```

The `config` JSONB for explore actions follows this shape:

```json
{
  "encounter_chance": 15,
  "monsters": [
    { "monster_id": 1, "weight": 33 },
    { "monster_id": 2, "weight": 66 },
    { "monster_id": 3, "weight": 1  }
  ]
}
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `encounter_chance` | integer | 0–100 | Probability of encountering any monster per explore attempt |
| `monsters` | array | at least 1 entry if encounter_chance > 0 | Weighted monster table |
| `monsters[].monster_id` | integer | FK to `monsters.id` (soft reference) | Monster template to spawn |
| `monsters[].weight` | integer | > 0 | Relative weight for weighted random selection |

---

## Entity Relationships

```
monsters (1) ──────────< (N) monster_loot (N) >────────── (1) item_definitions
    |
    └── referenced by building_actions.config[].monster_id (soft JSON reference)

building_actions.building_id >──────────── buildings
```

---

## Combat Resolution Data Flow (in-memory, not persisted)

The following represents data computed in `explore-combat-service.ts` during a player explore action. It is NOT stored in the database (combat is transient).

```typescript
interface CombatRoundRecord {
  round: number;
  player_attack: number;    // damage dealt by player to monster
  monster_attack: number;   // damage dealt by monster to player (0 if monster died first)
  player_hp_after: number;
  monster_hp_after: number;
}

interface CombatResult {
  outcome: 'win' | 'loss';
  rounds: CombatRoundRecord[];
  xp_gained: number;        // 0 if loss
  items_dropped: ItemDroppedRecord[];
}

interface ItemDroppedRecord {
  item_def_id: number;
  name: string;
  quantity: number;
  icon_url: string | null;
}
```

**Combat formula:**
- Player starts at `character.max_hp`; monster starts at `monster.hp`
- Each round: player attacks first → monster attacks (if still alive)
- Player damage = `max(1, character.attack_power − monster.defense)`
- Monster damage = `max(1, monster.attack − character.defence)`
- Round ends when either party reaches ≤ 0 HP
- On win: roll each `monster_loot` entry independently (uniform random vs `drop_chance / 100`); award `monster.xp_reward` XP; apply level-up check

---

## DB Query Additions

### `backend/src/db/queries/monsters.ts` (rewritten)

| Function | SQL | Purpose |
|----------|-----|---------|
| `getAllMonsters()` | `SELECT * FROM monsters ORDER BY name` | Admin list |
| `getMonsterById(id)` | `SELECT * FROM monsters WHERE id = $1` | Admin detail + combat |
| `createMonster(data)` | `INSERT INTO monsters ...` | Admin create |
| `updateMonster(id, data)` | `UPDATE monsters SET ... WHERE id = $1` | Admin update |
| `deleteMonster(id)` | `DELETE FROM monsters WHERE id = $1` | Admin delete |

### `backend/src/db/queries/monster-loot.ts` (new)

| Function | SQL | Purpose |
|----------|-----|---------|
| `getLootByMonsterId(monsterId)` | `SELECT ml.*, id.name, id.icon_filename FROM monster_loot ml JOIN item_definitions id ON ...` | Fetch loot table |
| `addLootEntry(data)` | `INSERT INTO monster_loot ...` | Admin add loot |
| `updateLootEntry(id, data)` | `UPDATE monster_loot SET ... WHERE id = $1` | Admin update loot |
| `deleteLootEntry(id)` | `DELETE FROM monster_loot WHERE id = $1` | Admin delete loot |

---

## Migration File: `011_monster_combat.sql`

```sql
-- Remove old combat and monster tables
DROP TABLE IF EXISTS combat_participants;
DROP TABLE IF EXISTS combat_simulations;
DROP TABLE IF EXISTS monsters;

-- New monster definitions (admin-managed, building-based)
CREATE TABLE monsters (
  id            SERIAL       PRIMARY KEY,
  name          VARCHAR(64)  NOT NULL,
  icon_filename VARCHAR(256),
  attack        SMALLINT     NOT NULL DEFAULT 1  CHECK (attack  >= 0),
  defense       SMALLINT     NOT NULL DEFAULT 0  CHECK (defense >= 0),
  hp            SMALLINT     NOT NULL DEFAULT 10 CHECK (hp      >= 1),
  xp_reward     SMALLINT     NOT NULL DEFAULT 0  CHECK (xp_reward >= 0),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Per-monster loot table
CREATE TABLE monster_loot (
  id          SERIAL   PRIMARY KEY,
  monster_id  INTEGER  NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  item_def_id INTEGER  NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  drop_chance SMALLINT NOT NULL CHECK (drop_chance BETWEEN 1 AND 100),
  quantity    SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);

-- Allow 'explore' as a valid building action type
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check,
  ADD  CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore'));
```
