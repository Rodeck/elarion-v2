CREATE TABLE IF NOT EXISTS fatigue_config (
  combat_type      VARCHAR(32)  PRIMARY KEY,
  start_round      INTEGER      NOT NULL DEFAULT 0,
  base_damage      INTEGER      NOT NULL DEFAULT 5,
  damage_increment INTEGER      NOT NULL DEFAULT 3,
  icon_filename    VARCHAR(255),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fatigue_config_combat_type_check
    CHECK (combat_type IN ('monster', 'boss', 'pvp'))
);

-- Pre-populate with all combat types (disabled by default)
INSERT INTO fatigue_config (combat_type, start_round, base_damage, damage_increment)
VALUES
  ('monster', 0, 5, 3),
  ('boss',    0, 10, 5),
  ('pvp',     0, 5, 3)
ON CONFLICT (combat_type) DO NOTHING;
