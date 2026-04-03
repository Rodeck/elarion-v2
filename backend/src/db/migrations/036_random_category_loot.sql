-- 036_random_category_loot.sql
-- Allow loot entries to drop a random item from a category instead of a specific item.
-- Either item_def_id or item_category must be set, but not both.

-- ── Monster loot ─────────────���───────────────────────────────────────────────
ALTER TABLE monster_loot ALTER COLUMN item_def_id DROP NOT NULL;

ALTER TABLE monster_loot ADD COLUMN item_category VARCHAR(16);

ALTER TABLE monster_loot ADD CONSTRAINT monster_loot_item_or_category
  CHECK (
    (item_def_id IS NOT NULL AND item_category IS NULL) OR
    (item_def_id IS NULL AND item_category IS NOT NULL)
  );

-- ── Boss loot ───────────��──────────────────────────────────────���─────────────
ALTER TABLE boss_loot ALTER COLUMN item_def_id DROP NOT NULL;

ALTER TABLE boss_loot ADD COLUMN item_category VARCHAR(16);

ALTER TABLE boss_loot ADD CONSTRAINT boss_loot_item_or_category
  CHECK (
    (item_def_id IS NOT NULL AND item_category IS NULL) OR
    (item_def_id IS NULL AND item_category IS NOT NULL)
  );
