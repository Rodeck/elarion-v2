CREATE TABLE IF NOT EXISTS character_classes (
  id                SMALLINT    PRIMARY KEY,
  name              VARCHAR(32) NOT NULL UNIQUE,
  base_hp           SMALLINT    NOT NULL,
  base_attack       SMALLINT    NOT NULL,
  base_defence      SMALLINT    NOT NULL,
  hp_per_level      SMALLINT    NOT NULL,
  attack_per_level  SMALLINT    NOT NULL,
  defence_per_level SMALLINT    NOT NULL,
  xp_curve          JSONB       NOT NULL
);
