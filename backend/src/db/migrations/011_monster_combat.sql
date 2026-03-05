-- Remove old combat and monster tables
DROP TABLE IF EXISTS combat_participants;
DROP TABLE IF EXISTS combat_simulations;
DROP TABLE IF EXISTS monsters;

-- New monster definitions (admin-managed, building-based)
CREATE TABLE monsters (
  id            SERIAL       PRIMARY KEY,
  name          VARCHAR(64)  NOT NULL,
  icon_filename VARCHAR(256),
  attack        SMALLINT     NOT NULL DEFAULT 1  CHECK (attack  >= 0),
  defense       SMALLINT     NOT NULL DEFAULT 0  CHECK (defense >= 0),
  hp            SMALLINT     NOT NULL DEFAULT 10 CHECK (hp      >= 1),
  xp_reward     SMALLINT     NOT NULL DEFAULT 0  CHECK (xp_reward >= 0),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Per-monster loot table
CREATE TABLE monster_loot (
  id          SERIAL   PRIMARY KEY,
  monster_id  INTEGER  NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  item_def_id INTEGER  NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  drop_chance SMALLINT NOT NULL CHECK (drop_chance BETWEEN 1 AND 100),
  quantity    SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);

-- Allow 'explore' as a valid building action type
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check,
  ADD  CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore'));
