-- Energy & Movement Speed System
-- Adds energy resource and movement speed to characters

ALTER TABLE characters ADD COLUMN max_energy     SMALLINT NOT NULL DEFAULT 1000;
ALTER TABLE characters ADD COLUMN current_energy  SMALLINT NOT NULL DEFAULT 1000;
ALTER TABLE characters ADD COLUMN movement_speed  SMALLINT NOT NULL DEFAULT 100;

ALTER TABLE characters ADD CONSTRAINT characters_current_energy_range
  CHECK (current_energy >= 0 AND current_energy <= max_energy);
ALTER TABLE characters ADD CONSTRAINT characters_movement_speed_positive
  CHECK (movement_speed > 0);
