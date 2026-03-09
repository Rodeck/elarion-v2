-- Migration 015: Day/Night Cycle
-- Adds per-map random encounter configuration for night travel encounters.

CREATE TABLE map_random_encounter_tables (
  id         SERIAL PRIMARY KEY,
  zone_id    INT NOT NULL REFERENCES map_zones(id) ON DELETE CASCADE,
  monster_id INT NOT NULL REFERENCES monsters(id)  ON DELETE CASCADE,
  weight     INT NOT NULL DEFAULT 1 CHECK (weight > 0),
  UNIQUE (zone_id, monster_id)
);

CREATE INDEX idx_random_encounters_zone ON map_random_encounter_tables(zone_id);
