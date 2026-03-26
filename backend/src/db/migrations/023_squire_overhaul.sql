-- 023_squire_overhaul.sql
-- Squire System Overhaul: definition-based squires, leveling, monster drops,
-- quest rewards, NPC dismissal, and slot management.
--
-- Migrates the existing `squires` table (from 012) into the new
-- `squire_definitions` + `character_squires` two-table model.

BEGIN;

-- ============================================================
-- Step 1: Create squire_definitions table
-- Admin-managed squire templates (analogous to item_definitions)
-- ============================================================

CREATE TABLE IF NOT EXISTS squire_definitions (
  id              SERIAL       PRIMARY KEY,
  name            TEXT         NOT NULL UNIQUE,
  icon_filename   TEXT,
  power_level     INTEGER      NOT NULL DEFAULT 0
                               CHECK (power_level >= 0 AND power_level <= 100),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- Step 2: Insert default "Legacy Squire" definition
-- All pre-existing squires will be linked to this definition.
-- ============================================================

INSERT INTO squire_definitions (name, power_level, is_active)
VALUES ('Legacy Squire', 0, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Step 3: Add new columns to existing squires table
-- squire_def_id (nullable initially) and level
-- ============================================================

ALTER TABLE squires
  ADD COLUMN IF NOT EXISTS squire_def_id INTEGER,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- ============================================================
-- Step 4: Backfill existing rows with the Legacy Squire definition
-- ============================================================

UPDATE squires
SET squire_def_id = (SELECT id FROM squire_definitions WHERE name = 'Legacy Squire'),
    level = 1
WHERE squire_def_id IS NULL;

-- ============================================================
-- Step 5: Add NOT NULL constraint, FK, and CHECK on level
-- ============================================================

ALTER TABLE squires
  ALTER COLUMN squire_def_id SET NOT NULL;

ALTER TABLE squires
  ADD CONSTRAINT fk_squires_squire_def
    FOREIGN KEY (squire_def_id) REFERENCES squire_definitions(id);

ALTER TABLE squires
  ADD CONSTRAINT chk_squires_level
    CHECK (level >= 1 AND level <= 20);

-- ============================================================
-- Step 6: Rename squires → character_squires
-- ============================================================

ALTER TABLE IF EXISTS squires RENAME TO character_squires;

-- ============================================================
-- Step 7: Rename and add indexes
-- ============================================================

-- Rename the existing character_id index
ALTER INDEX IF EXISTS idx_squires_character_id
  RENAME TO idx_character_squires_character_id;

-- Add index on squire_def_id for lookups by definition
CREATE INDEX IF NOT EXISTS idx_character_squires_def
  ON character_squires(squire_def_id);

-- ============================================================
-- Step 8: Update squire_expeditions FK to reference character_squires
-- The table data is unchanged (same PK ids), but the constraint
-- name references the old table. Drop and recreate.
-- ============================================================

ALTER TABLE squire_expeditions
  DROP CONSTRAINT IF EXISTS squire_expeditions_squire_id_fkey;

ALTER TABLE squire_expeditions
  ADD CONSTRAINT squire_expeditions_squire_id_fkey
    FOREIGN KEY (squire_id) REFERENCES character_squires(id) ON DELETE CASCADE;

-- ============================================================
-- Step 9: Add squire_slots_unlocked to characters
-- Default 2 slots; max 5 enforced in application code.
-- ============================================================

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS squire_slots_unlocked INTEGER NOT NULL DEFAULT 2;

-- ============================================================
-- Step 10: Create monster_squire_loot table
-- Squire drops from monsters (parallel to monster_loot for items)
-- ============================================================

CREATE TABLE IF NOT EXISTS monster_squire_loot (
  id              SERIAL       PRIMARY KEY,
  monster_id      INTEGER      NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  squire_def_id   INTEGER      NOT NULL REFERENCES squire_definitions(id),
  drop_chance     INTEGER      NOT NULL CHECK (drop_chance >= 1 AND drop_chance <= 100),
  squire_level    INTEGER      NOT NULL DEFAULT 1
                               CHECK (squire_level >= 1 AND squire_level <= 20)
);

CREATE INDEX IF NOT EXISTS idx_monster_squire_loot_monster
  ON monster_squire_loot(monster_id);

-- ============================================================
-- Step 11: Extend quest_rewards CHECK to include 'squire'
-- When reward_type = 'squire': target_id → squire_definitions.id,
-- quantity = squire level (1-20).
-- ============================================================

ALTER TABLE quest_rewards
  DROP CONSTRAINT IF EXISTS quest_rewards_reward_type_check;

ALTER TABLE quest_rewards
  ADD CONSTRAINT quest_rewards_reward_type_check
    CHECK (reward_type IN ('item', 'xp', 'crowns', 'squire'));

-- ============================================================
-- Step 12: Add is_squire_dismisser flag to npcs
-- NPCs with this flag allow players to dismiss owned squires.
-- ============================================================

ALTER TABLE npcs
  ADD COLUMN IF NOT EXISTS is_squire_dismisser BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Step 13: Asset directory marker
-- Squire icon PNGs are stored at: backend/assets/squires/icons/
-- This directory must be created on the filesystem outside of SQL.
-- ============================================================

COMMIT;
