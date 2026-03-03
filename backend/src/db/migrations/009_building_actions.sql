-- 009_building_actions.sql
-- Add description to buildings; create building_actions table

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS building_actions (
  id          SERIAL      PRIMARY KEY,
  building_id INTEGER     NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  action_type TEXT        NOT NULL CHECK (action_type IN ('travel')),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_building_actions_building_id
  ON building_actions(building_id);
