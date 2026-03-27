-- 026_fishing_system.sql
-- Fishing system: new tables, CHECK constraint extensions, seed data

-- =============================================================================
-- 1. Extend CHECK constraints for new categories/types
-- =============================================================================

-- Add 'ring' and 'amulet' to item_definitions.category
ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_category_check;
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_category_check
  CHECK (category IN (
    'resource', 'food', 'heal', 'weapon',
    'boots', 'shield', 'greaves', 'bracer', 'tool',
    'helmet', 'chestplate',
    'ring', 'amulet'
  ));

-- Add 'fishing_rod' to item_definitions.tool_type
ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_tool_type_check;
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_tool_type_check
  CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe', 'fishing_rod'));

-- Relax the tool cross-field constraint to allow fishing_rod category='tool'
-- (existing constraint requires category='tool' ↔ tool_type IS NOT NULL)
-- No change needed — fishing rods ARE category='tool' with tool_type='fishing_rod'

-- Add 'ring' and 'amulet' to inventory_items.equipped_slot
ALTER TABLE inventory_items
  DROP CONSTRAINT inventory_items_equipped_slot_check;
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_equipped_slot_check
  CHECK (equipped_slot IN (
    'helmet', 'chestplate', 'left_arm', 'right_arm',
    'greaves', 'bracer', 'boots',
    'ring', 'amulet'
  ));

-- Add 'fishing' to building_actions.action_type
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
  CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing'));

-- =============================================================================
-- 2. Add rod_upgrade_points to characters
-- =============================================================================

ALTER TABLE characters
  ADD COLUMN rod_upgrade_points INTEGER NOT NULL DEFAULT 0;

ALTER TABLE characters
  ADD CONSTRAINT characters_rod_upgrade_points_check
  CHECK (rod_upgrade_points >= 0);

-- =============================================================================
-- 3. Create fishing tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS fishing_rod_tiers (
  tier              SMALLINT    PRIMARY KEY CHECK (tier BETWEEN 1 AND 5),
  item_def_id       INTEGER     NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  upgrade_points_cost INTEGER   NOT NULL CHECK (upgrade_points_cost >= 0),
  max_durability    INTEGER     NOT NULL CHECK (max_durability > 0),
  repair_crown_cost INTEGER     NOT NULL DEFAULT 10 CHECK (repair_crown_cost >= 0),
  UNIQUE (item_def_id)
);

CREATE TABLE IF NOT EXISTS fishing_loot (
  id                SERIAL      PRIMARY KEY,
  min_rod_tier      SMALLINT    NOT NULL CHECK (min_rod_tier BETWEEN 1 AND 5),
  item_def_id       INTEGER     NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  drop_weight       INTEGER     NOT NULL CHECK (drop_weight >= 1)
);

CREATE INDEX IF NOT EXISTS idx_fishing_loot_tier ON fishing_loot(min_rod_tier);

-- Seed data removed — create entities via admin API / game-entities skill
