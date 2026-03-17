-- 019: Crafting System
-- Adds NPC crafting designation, recipes, ingredients, sessions, and session costs.

-- ── NPC crafting flag ─────────────────────────────────────────────────────────
ALTER TABLE npcs ADD COLUMN is_crafter BOOLEAN NOT NULL DEFAULT false;

-- ── Crafting recipes ──────────────────────────────────────────────────────────
CREATE TABLE crafting_recipes (
  id               SERIAL       PRIMARY KEY,
  npc_id           INTEGER      NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  description      TEXT,
  output_item_id   INTEGER      NOT NULL REFERENCES item_definitions(id),
  output_quantity  INTEGER      NOT NULL DEFAULT 1 CHECK (output_quantity > 0),
  cost_crowns      INTEGER      NOT NULL DEFAULT 0 CHECK (cost_crowns >= 0),
  craft_time_seconds INTEGER    NOT NULL CHECK (craft_time_seconds > 0),
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_crafting_recipes_npc_id ON crafting_recipes(npc_id);

-- ── Recipe ingredients ────────────────────────────────────────────────────────
CREATE TABLE recipe_ingredients (
  id           SERIAL   PRIMARY KEY,
  recipe_id    INTEGER  NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
  item_def_id  INTEGER  NOT NULL REFERENCES item_definitions(id),
  quantity     INTEGER  NOT NULL CHECK (quantity > 0),
  UNIQUE (recipe_id, item_def_id)
);

-- ── Crafting sessions ─────────────────────────────────────────────────────────
CREATE TABLE crafting_sessions (
  id                    SERIAL       PRIMARY KEY,
  character_id          UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  recipe_id             INTEGER      NOT NULL REFERENCES crafting_recipes(id),
  npc_id                INTEGER      NOT NULL REFERENCES npcs(id),
  quantity              INTEGER      NOT NULL CHECK (quantity > 0),
  started_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  total_duration_seconds INTEGER     NOT NULL CHECK (total_duration_seconds > 0),
  cost_crowns           INTEGER      NOT NULL DEFAULT 0,
  status                TEXT         NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'completed', 'collected', 'cancelled')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_crafting_sessions_character_status ON crafting_sessions(character_id, status);

-- Prevent duplicate active sessions for same recipe at same NPC
CREATE UNIQUE INDEX idx_crafting_sessions_active_unique
  ON crafting_sessions(character_id, recipe_id, npc_id)
  WHERE status = 'in_progress';

-- ── Crafting session costs (snapshot for refund) ──────────────────────────────
CREATE TABLE crafting_session_costs (
  id             SERIAL   PRIMARY KEY,
  session_id     INTEGER  NOT NULL REFERENCES crafting_sessions(id) ON DELETE CASCADE,
  item_def_id    INTEGER  NOT NULL REFERENCES item_definitions(id),
  quantity_spent INTEGER  NOT NULL CHECK (quantity_spent > 0)
);

CREATE INDEX idx_crafting_session_costs_session_id ON crafting_session_costs(session_id);
