-- 022: Quest System
-- Adds quest definitions, objectives, prerequisites, rewards, NPC quest givers,
-- per-character quest tracking, and per-objective progress tracking.

-- ── NPC quest giver flag ────────────────────────────────────────────────────
ALTER TABLE npcs ADD COLUMN is_quest_giver BOOLEAN NOT NULL DEFAULT false;

-- ── Quest definitions ───────────────────────────────────────────────────────
CREATE TABLE quest_definitions (
  id              SERIAL       PRIMARY KEY,
  name            TEXT         NOT NULL UNIQUE,
  description     TEXT         NOT NULL,
  quest_type      TEXT         NOT NULL
                  CHECK (quest_type IN ('main','side','daily','weekly','monthly','repeatable')),
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  chain_id        TEXT,
  chain_step      INTEGER,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_quest_definitions_type ON quest_definitions(quest_type);
CREATE INDEX idx_quest_definitions_chain ON quest_definitions(chain_id) WHERE chain_id IS NOT NULL;

-- ── Quest objectives ────────────────────────────────────────────────────────
CREATE TABLE quest_objectives (
  id              SERIAL       PRIMARY KEY,
  quest_id        INTEGER      NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  objective_type  TEXT         NOT NULL
                  CHECK (objective_type IN (
                    'kill_monster','collect_item','craft_item','spend_crowns',
                    'gather_resource','reach_level','visit_location','talk_to_npc'
                  )),
  target_id       INTEGER,
  target_quantity INTEGER      NOT NULL DEFAULT 1 CHECK (target_quantity > 0),
  target_duration INTEGER,
  description     TEXT,
  dialog_prompt   TEXT,
  dialog_response TEXT,
  sort_order      INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX idx_quest_objectives_quest ON quest_objectives(quest_id);

-- ── Quest prerequisites ─────────────────────────────────────────────────────
CREATE TABLE quest_prerequisites (
  id              SERIAL       PRIMARY KEY,
  quest_id        INTEGER      NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  prereq_type     TEXT         NOT NULL
                  CHECK (prereq_type IN ('min_level','has_item','completed_quest','class_required')),
  target_id       INTEGER,
  target_value    INTEGER      NOT NULL DEFAULT 1
);

CREATE INDEX idx_quest_prerequisites_quest ON quest_prerequisites(quest_id);

-- ── Quest rewards ───────────────────────────────────────────────────────────
CREATE TABLE quest_rewards (
  id              SERIAL       PRIMARY KEY,
  quest_id        INTEGER      NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  reward_type     TEXT         NOT NULL CHECK (reward_type IN ('item','xp','crowns')),
  target_id       INTEGER,
  quantity        INTEGER      NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX idx_quest_rewards_quest ON quest_rewards(quest_id);

-- ── NPC quest givers (many-to-many) ─────────────────────────────────────────
CREATE TABLE quest_npc_givers (
  id              SERIAL       PRIMARY KEY,
  quest_id        INTEGER      NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  npc_id          INTEGER      NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  UNIQUE (quest_id, npc_id)
);

CREATE INDEX idx_quest_npc_givers_npc ON quest_npc_givers(npc_id);

-- ── Character quest tracking ────────────────────────────────────────────────
CREATE TABLE character_quests (
  id              SERIAL       PRIMARY KEY,
  character_id    UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_id        INTEGER      NOT NULL REFERENCES quest_definitions(id) ON DELETE CASCADE,
  status          TEXT         NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','completed','failed','abandoned')),
  accepted_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  reset_period_key TEXT,
  UNIQUE (character_id, quest_id, reset_period_key)
);

CREATE INDEX idx_character_quests_char_status ON character_quests(character_id, status);
CREATE INDEX idx_character_quests_quest ON character_quests(quest_id);

-- ── Character quest objective progress ──────────────────────────────────────
CREATE TABLE character_quest_objectives (
  id                   SERIAL       PRIMARY KEY,
  character_quest_id   INTEGER      NOT NULL REFERENCES character_quests(id) ON DELETE CASCADE,
  objective_id         INTEGER      NOT NULL REFERENCES quest_objectives(id),
  current_progress     INTEGER      NOT NULL DEFAULT 0,
  is_complete          BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (character_quest_id, objective_id)
);

CREATE INDEX idx_cqo_char_quest ON character_quest_objectives(character_quest_id);
