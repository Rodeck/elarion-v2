# Data Model: Warehouse System

**Feature**: 036-warehouse-system  
**Date**: 2026-04-07

## New Tables

### warehouse_slots

Tracks per-player, per-building warehouse capacity. Created lazily on first warehouse open.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Row ID |
| character_id | UUID | NOT NULL, FK → characters(id) | Owning character |
| building_id | INTEGER | NOT NULL, FK → buildings(id) | Warehouse building |
| extra_slots | SMALLINT | NOT NULL DEFAULT 0 | Number of purchased extra slots |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Row creation time |

**Unique constraint**: `(character_id, building_id)` — one record per player per warehouse.

**Capacity formula**: `15 + extra_slots`

**Pricing formula**: Slot N costs `1000 * (2^(N+1) - 1)` crowns, where N = current `extra_slots` value (0-indexed).

### warehouse_items

Stores items deposited in a warehouse. Mirrors `inventory_items` structure for per-instance stat fidelity.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Row ID (used as slot_id in protocol) |
| character_id | UUID | NOT NULL, FK → characters(id) | Owning character |
| building_id | INTEGER | NOT NULL, FK → buildings(id) | Warehouse building |
| item_def_id | INTEGER | NOT NULL, FK → item_definitions(id) | Item definition |
| quantity | SMALLINT | NOT NULL, CHECK >= 1 | Stack quantity |
| current_durability | INTEGER | NULL | Tool durability |
| instance_attack | SMALLINT | NULL | Per-instance stat override |
| instance_defence | SMALLINT | NULL | Per-instance stat override |
| instance_crit_chance | SMALLINT | NULL | Per-instance stat override |
| instance_additional_attacks | SMALLINT | NULL | Per-instance stat override |
| instance_armor_penetration | SMALLINT | NULL | Per-instance stat override |
| instance_max_mana | SMALLINT | NULL | Per-instance stat override |
| instance_mana_on_hit | SMALLINT | NULL | Per-instance stat override |
| instance_mana_regen | SMALLINT | NULL | Per-instance stat override |
| instance_quality_tier | SMALLINT | NULL | Item variation quality tier |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Deposit time |

**Indexes**:
- `(character_id, building_id)` — fast lookup of all items in a specific warehouse
- `(character_id, building_id, item_def_id)` — fast stackable item lookup

## Modified Tables

### building_actions

Extend `action_type` CHECK constraint to include `'warehouse'`:

```
('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing', 'arena', 'warehouse')
```

Config for warehouse actions: `{}` (empty — behavior is uniform across warehouses).

## Entity Relationships

```
characters ──1:N──▷ warehouse_slots (per building)
characters ──1:N──▷ warehouse_items (per building)
buildings  ──1:N──▷ warehouse_slots (per character)
buildings  ──1:N──▷ warehouse_items (per character)
warehouse_items ──N:1──▷ item_definitions
building_actions (action_type = 'warehouse') ──N:1──▷ buildings
```

## State Transitions

### Warehouse Slot Record
```
[does not exist] ──(first open)──▷ {extra_slots: 0}
{extra_slots: N} ──(purchase)──▷ {extra_slots: N+1}
```

### Warehouse Item
```
[in inventory] ──(deposit)──▷ [in warehouse_items]
[in warehouse_items] ──(withdraw)──▷ [in inventory]
[in warehouse_items] ──(stack merge)──▷ [quantity increased, source deleted]
```

## Migration File

`041_warehouse_system.sql`

```sql
-- Warehouse slot capacity per player per building
CREATE TABLE warehouse_slots (
  id            SERIAL PRIMARY KEY,
  character_id  UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  building_id   INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  extra_slots   SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (character_id, building_id)
);

-- Warehouse item storage
CREATE TABLE warehouse_items (
  id                          SERIAL PRIMARY KEY,
  character_id                UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  building_id                 INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  item_def_id                 INTEGER NOT NULL REFERENCES item_definitions(id),
  quantity                    SMALLINT NOT NULL CHECK (quantity >= 1),
  current_durability          INTEGER NULL,
  instance_attack             SMALLINT NULL,
  instance_defence            SMALLINT NULL,
  instance_crit_chance        SMALLINT NULL,
  instance_additional_attacks SMALLINT NULL,
  instance_armor_penetration  SMALLINT NULL,
  instance_max_mana           SMALLINT NULL,
  instance_mana_on_hit        SMALLINT NULL,
  instance_mana_regen         SMALLINT NULL,
  instance_quality_tier       SMALLINT NULL,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_items_char_bldg
  ON warehouse_items (character_id, building_id);

CREATE INDEX idx_warehouse_items_char_bldg_def
  ON warehouse_items (character_id, building_id, item_def_id);

-- Extend building_actions action_type
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
  CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing', 'arena', 'warehouse'));
```
