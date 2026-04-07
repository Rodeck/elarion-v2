-- 041: Warehouse System
-- Per-player, per-building item storage with expandable slot capacity.

-- Warehouse slot capacity per player per building (lazy init on first open)
CREATE TABLE warehouse_slots (
  id            SERIAL PRIMARY KEY,
  character_id  UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  building_id   INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  extra_slots   SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (character_id, building_id)
);

-- Warehouse item storage (mirrors inventory_items for per-instance stat fidelity)
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

-- Extend building_actions action_type to include 'warehouse'
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
  CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing', 'arena', 'warehouse'));
