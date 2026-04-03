-- 034_stat_training.sql
-- Adds consumable-item-based stat training system.
-- NPCs with trainer_stat can accept training items for a chance to increase a stat.

-- Table: maps items to stats with tier/chance/decay configuration
CREATE TABLE stat_training_items (
  id SERIAL PRIMARY KEY,
  item_def_id INTEGER NOT NULL REFERENCES item_definitions(id),
  stat_name TEXT NOT NULL CHECK (stat_name IN ('constitution', 'strength', 'intelligence', 'dexterity', 'toughness')),
  tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  base_chance SMALLINT NOT NULL CHECK (base_chance BETWEEN 1 AND 100),
  decay_per_level NUMERIC(4,2) NOT NULL CHECK (decay_per_level > 0),
  npc_id INTEGER NOT NULL REFERENCES npcs(id),
  UNIQUE (item_def_id)
);

-- Add trainer_stat column to NPCs (which stat this NPC trains via consumable items)
ALTER TABLE npcs ADD COLUMN trainer_stat TEXT DEFAULT NULL
  CHECK (trainer_stat IS NULL OR trainer_stat IN ('constitution', 'strength', 'intelligence', 'dexterity', 'toughness'));
