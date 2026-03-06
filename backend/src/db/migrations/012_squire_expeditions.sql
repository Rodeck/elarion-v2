-- 012_squire_expeditions.sql
-- Add gold to characters; extend building_actions; create squires and squire_expeditions tables

-- Add gold column to characters (starts at 0)
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS gold INTEGER NOT NULL DEFAULT 0;

-- Extend building_actions.action_type to include 'expedition'
ALTER TABLE building_actions
  DROP CONSTRAINT IF EXISTS building_actions_action_type_check;

ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore', 'expedition'));

-- Squires: one or more per character (initially one, assigned at character creation)
CREATE TABLE IF NOT EXISTS squires (
  id           SERIAL       PRIMARY KEY,
  character_id UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squires_character_id ON squires(character_id);

-- Active and historical expeditions sent by squires
CREATE TABLE IF NOT EXISTS squire_expeditions (
  id              SERIAL       PRIMARY KEY,
  squire_id       INTEGER      NOT NULL REFERENCES squires(id) ON DELETE CASCADE,
  character_id    UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  building_id     INTEGER      NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  action_id       INTEGER      NOT NULL REFERENCES building_actions(id) ON DELETE CASCADE,
  duration_hours  INTEGER      NOT NULL CHECK (duration_hours IN (1, 3, 6)),
  reward_snapshot JSONB        NOT NULL,
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completes_at    TIMESTAMPTZ  NOT NULL,
  collected_at    TIMESTAMPTZ  NULL,
  notified_at     TIMESTAMPTZ  NULL
);

CREATE INDEX IF NOT EXISTS idx_squire_expeditions_squire_id
  ON squire_expeditions(squire_id);

CREATE INDEX IF NOT EXISTS idx_squire_expeditions_character_id_active
  ON squire_expeditions(character_id)
  WHERE collected_at IS NULL;
