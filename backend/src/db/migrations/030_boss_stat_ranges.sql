-- Add min stat columns for randomized boss instances
ALTER TABLE bosses ADD COLUMN min_hp INTEGER;
ALTER TABLE bosses ADD COLUMN min_attack INTEGER;
ALTER TABLE bosses ADD COLUMN min_defense INTEGER;

-- Rename existing columns for clarity (max_hp stays as-is since it's already named correctly)
-- attack/defense become the max values; min defaults to same value (no range = fixed)
UPDATE bosses SET min_hp = max_hp, min_attack = attack, min_defense = defense;

ALTER TABLE bosses ALTER COLUMN min_hp SET NOT NULL;
ALTER TABLE bosses ALTER COLUMN min_attack SET NOT NULL;
ALTER TABLE bosses ALTER COLUMN min_defense SET NOT NULL;

ALTER TABLE bosses ADD CONSTRAINT bosses_hp_range_check CHECK (min_hp > 0 AND min_hp <= max_hp);
ALTER TABLE bosses ADD CONSTRAINT bosses_attack_range_check CHECK (min_attack >= 0 AND min_attack <= attack);
ALTER TABLE bosses ADD CONSTRAINT bosses_defense_range_check CHECK (min_defense >= 0 AND min_defense <= defense);

-- Store actual rolled stats on instance so they persist
ALTER TABLE boss_instances ADD COLUMN actual_attack INTEGER;
ALTER TABLE boss_instances ADD COLUMN actual_defense INTEGER;
