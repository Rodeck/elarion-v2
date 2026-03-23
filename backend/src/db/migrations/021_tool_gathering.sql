-- 021: Tool Durability & Gathering System
-- Adds tool-specific columns to item_definitions, per-instance durability to
-- inventory_items, extends building_actions for 'gather' type, and adds
-- in_gathering lock to characters.

-- ── item_definitions: tool columns ──────────────────────────────────────────
ALTER TABLE item_definitions
  ADD COLUMN tool_type      VARCHAR(16) DEFAULT NULL,
  ADD COLUMN max_durability INTEGER     DEFAULT NULL,
  ADD COLUMN power          SMALLINT    DEFAULT NULL;

ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_tool_type_check
    CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe'));

ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_max_durability_check
    CHECK (max_durability IS NULL OR max_durability > 0);

ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_power_check
    CHECK (power IS NULL OR power > 0);

-- Enforce: when category = 'tool', tool_type and max_durability are required;
-- when category != 'tool', all three tool fields must be NULL.
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_tool_fields_check
    CHECK (
      (category = 'tool' AND tool_type IS NOT NULL AND max_durability IS NOT NULL)
      OR
      (category != 'tool' AND tool_type IS NULL AND max_durability IS NULL AND power IS NULL)
    );

-- ── inventory_items: per-instance durability ────────────────────────────────
ALTER TABLE inventory_items
  ADD COLUMN current_durability INTEGER DEFAULT NULL;

ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_durability_check
    CHECK (current_durability IS NULL OR current_durability >= 0);

-- ── building_actions: add 'gather' to action_type CHECK ─────────────────────
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;

ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather'));

-- ── characters: gathering lock flag ─────────────────────────────────────────
ALTER TABLE characters
  ADD COLUMN in_gathering BOOLEAN NOT NULL DEFAULT false;
