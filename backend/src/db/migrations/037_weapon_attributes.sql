-- 037: Add weapon attributes (armor penetration, additional attacks)
-- crit_chance already exists from migration 018

ALTER TABLE item_definitions
  ADD COLUMN armor_penetration SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN additional_attacks SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_armor_penetration_check
    CHECK (armor_penetration >= 0 AND armor_penetration <= 100);

ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_additional_attacks_check
    CHECK (additional_attacks >= 0 AND additional_attacks <= 10);
