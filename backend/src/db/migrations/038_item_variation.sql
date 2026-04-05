-- Migration 038: Item Bonus Variation
-- Adds per-instance stat columns to inventory_items and marketplace_listings
-- NULL = use item_definitions base value (backward compatible)

ALTER TABLE inventory_items
  ADD COLUMN instance_attack              SMALLINT DEFAULT NULL CHECK (instance_attack >= 0 OR instance_attack IS NULL),
  ADD COLUMN instance_defence             SMALLINT DEFAULT NULL CHECK (instance_defence >= 0 OR instance_defence IS NULL),
  ADD COLUMN instance_crit_chance         SMALLINT DEFAULT NULL CHECK (instance_crit_chance >= 0 OR instance_crit_chance IS NULL),
  ADD COLUMN instance_additional_attacks  SMALLINT DEFAULT NULL CHECK (instance_additional_attacks >= 0 OR instance_additional_attacks IS NULL),
  ADD COLUMN instance_armor_penetration   SMALLINT DEFAULT NULL CHECK (instance_armor_penetration >= 0 OR instance_armor_penetration IS NULL),
  ADD COLUMN instance_max_mana            SMALLINT DEFAULT NULL CHECK (instance_max_mana >= 0 OR instance_max_mana IS NULL),
  ADD COLUMN instance_mana_on_hit         SMALLINT DEFAULT NULL CHECK (instance_mana_on_hit >= 0 OR instance_mana_on_hit IS NULL),
  ADD COLUMN instance_mana_regen          SMALLINT DEFAULT NULL CHECK (instance_mana_regen >= 0 OR instance_mana_regen IS NULL),
  ADD COLUMN instance_quality_tier        SMALLINT DEFAULT NULL CHECK (instance_quality_tier IS NULL OR instance_quality_tier IN (1, 2, 3, 4));

ALTER TABLE marketplace_listings
  ADD COLUMN instance_attack              SMALLINT DEFAULT NULL,
  ADD COLUMN instance_defence             SMALLINT DEFAULT NULL,
  ADD COLUMN instance_crit_chance         SMALLINT DEFAULT NULL,
  ADD COLUMN instance_additional_attacks  SMALLINT DEFAULT NULL,
  ADD COLUMN instance_armor_penetration   SMALLINT DEFAULT NULL,
  ADD COLUMN instance_max_mana            SMALLINT DEFAULT NULL,
  ADD COLUMN instance_mana_on_hit         SMALLINT DEFAULT NULL,
  ADD COLUMN instance_mana_regen          SMALLINT DEFAULT NULL,
  ADD COLUMN instance_quality_tier        SMALLINT DEFAULT NULL;
