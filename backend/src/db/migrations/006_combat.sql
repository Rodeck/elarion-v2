CREATE TABLE IF NOT EXISTS combat_simulations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID       NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  monster_id   SMALLINT   NOT NULL,
  zone_id      SMALLINT   NOT NULL REFERENCES map_zones(id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  outcome      VARCHAR(8)  NOT NULL DEFAULT 'pending' CHECK (outcome IN ('victory','defeat','pending')),
  xp_awarded   SMALLINT,
  rounds       JSONB
);

CREATE TABLE IF NOT EXISTS combat_participants (
  combat_simulation_id UUID     NOT NULL REFERENCES combat_simulations(id) ON DELETE CASCADE,
  character_id         UUID     NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  damage_dealt         SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (combat_simulation_id, character_id)
);

CREATE INDEX IF NOT EXISTS combat_sims_char_outcome_idx ON combat_simulations (character_id, outcome);
CREATE INDEX IF NOT EXISTS combat_sims_started_at_idx ON combat_simulations (started_at);
