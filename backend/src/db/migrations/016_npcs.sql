-- Migration 016: NPC system
-- Creates npcs catalog table and building_npcs many-to-many join table

CREATE TABLE npcs (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(128) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_filename VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE building_npcs (
  id          SERIAL PRIMARY KEY,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  npc_id      INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (building_id, npc_id)
);
