CREATE TABLE IF NOT EXISTS characters (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID     NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  name         VARCHAR(32) NOT NULL UNIQUE,
  class_id     SMALLINT NOT NULL REFERENCES character_classes(id),
  level        SMALLINT NOT NULL DEFAULT 1,
  experience   INTEGER  NOT NULL DEFAULT 0,
  max_hp       SMALLINT NOT NULL,
  current_hp   SMALLINT NOT NULL,
  attack_power SMALLINT NOT NULL,
  defence      SMALLINT NOT NULL,
  zone_id      SMALLINT NOT NULL REFERENCES map_zones(id),
  pos_x        SMALLINT NOT NULL,
  pos_y        SMALLINT NOT NULL,
  in_combat    BOOLEAN  NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS characters_zone_id_idx ON characters (zone_id);
