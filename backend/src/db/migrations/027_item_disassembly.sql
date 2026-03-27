-- 027_item_disassembly.sql
-- Item Disassembly System: recipe tables, kiln tool type, NPC flag, disassembly cost

-- 1. Add disassembly cost to item definitions (crowns per unit to disassemble)
ALTER TABLE item_definitions
  ADD COLUMN disassembly_cost INTEGER NOT NULL DEFAULT 0
  CHECK (disassembly_cost >= 0);

-- 2. Extend tool_type to include 'kiln'
ALTER TABLE item_definitions DROP CONSTRAINT item_definitions_tool_type_check;
ALTER TABLE item_definitions ADD CONSTRAINT item_definitions_tool_type_check
  CHECK (tool_type IS NULL OR tool_type IN ('pickaxe', 'axe', 'fishing_rod', 'kiln'));

-- 3. Add is_disassembler flag to NPCs
ALTER TABLE npcs
  ADD COLUMN is_disassembler BOOLEAN NOT NULL DEFAULT false;

-- 4. Create disassembly recipe tables
CREATE TABLE disassembly_recipes (
  id            SERIAL PRIMARY KEY,
  item_def_id   INTEGER NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  chance_percent SMALLINT NOT NULL CHECK (chance_percent >= 1 AND chance_percent <= 100),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disassembly_recipes_item ON disassembly_recipes(item_def_id);

CREATE TABLE disassembly_recipe_outputs (
  id                 SERIAL PRIMARY KEY,
  recipe_id          INTEGER NOT NULL REFERENCES disassembly_recipes(id) ON DELETE CASCADE,
  output_item_def_id INTEGER NOT NULL REFERENCES item_definitions(id),
  quantity           SMALLINT NOT NULL CHECK (quantity >= 1)
);

CREATE INDEX idx_disassembly_recipe_outputs_recipe ON disassembly_recipe_outputs(recipe_id);
