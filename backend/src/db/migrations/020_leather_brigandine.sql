-- 020: Leather Brigandine
-- Adds the first chestplate item, a Cave Troll loot drop, and a crafting recipe at Borin.

-- ── Item definition ─────────────────────────────────────────────────────────────
INSERT INTO item_definitions (name, description, category, defence, icon_filename)
VALUES (
  'Leather Brigandine',
  'A sturdy jacket of layered leather with small iron plates riveted between the layers. Covers the torso well.',
  'chestplate',
  12,
  NULL
);

-- ── Cave Troll loot drop (15%) ──────────────────────────────────────────────────
INSERT INTO monster_loot (monster_id, item_def_id, drop_chance, quantity)
VALUES (
  (SELECT id FROM monsters WHERE name = 'Cave Troll'),
  (SELECT id FROM item_definitions WHERE name = 'Leather Brigandine'),
  15,
  1
);

-- ── Crafting recipe at Borin ────────────────────────────────────────────────────
INSERT INTO crafting_recipes (npc_id, name, description, output_item_id, output_quantity, cost_crowns, craft_time_seconds, sort_order)
VALUES (
  (SELECT id FROM npcs WHERE name = 'Borin, Father of Eleina'),
  'Leather Brigandine',
  'Rivet iron plates between layers of tanned leather to form a protective chest piece.',
  (SELECT id FROM item_definitions WHERE name = 'Leather Brigandine'),
  1,
  25,
  60,
  10
);

INSERT INTO recipe_ingredients (recipe_id, item_def_id, quantity)
VALUES (
  (SELECT id FROM crafting_recipes WHERE name = 'Leather Brigandine'),
  (SELECT id FROM item_definitions WHERE name = 'Tanned Leather'),
  4
);
