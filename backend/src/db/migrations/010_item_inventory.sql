-- Migration 010: Item and Inventory System
-- Replaces legacy items/character_items with item_definitions/inventory_items

-- Drop old tables (character_items first due to FK dependency)
DROP TABLE IF EXISTS character_items;
DROP TABLE IF EXISTS items;

-- Item definitions managed by admin
CREATE TABLE item_definitions (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(64) NOT NULL UNIQUE,
  description   TEXT,
  category      VARCHAR(16) NOT NULL CHECK (category IN ('resource','food','heal','weapon','boots','shield','greaves','bracer','tool')),
  weapon_subtype VARCHAR(16) CHECK (weapon_subtype IN ('one_handed','two_handed','dagger','wand','staff','bow')),
  attack        SMALLINT CHECK (attack >= 0),
  defence       SMALLINT CHECK (defence >= 0),
  heal_power    SMALLINT CHECK (heal_power >= 0),
  food_power    SMALLINT CHECK (food_power >= 0),
  stack_size    SMALLINT CHECK (stack_size >= 1),
  icon_filename VARCHAR(256),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-character inventory slots
CREATE TABLE inventory_items (
  id            SERIAL PRIMARY KEY,
  character_id  UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_def_id   INTEGER NOT NULL REFERENCES item_definitions(id),
  quantity      SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_items_character ON inventory_items(character_id);
CREATE INDEX idx_inventory_items_def ON inventory_items(item_def_id);
