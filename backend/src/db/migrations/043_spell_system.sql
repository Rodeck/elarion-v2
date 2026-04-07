-- 043_spell_system.sql
-- Adds spell system: spell definitions, per-level stats, per-level item costs,
-- character spell progress, active spell buffs, and spell_book_spell item category.

-- ── Spell definitions ───────────────────────────────────────────────────────
CREATE TABLE spells (
  id                SERIAL        PRIMARY KEY,
  name              VARCHAR(64)   NOT NULL UNIQUE,
  icon_filename     VARCHAR(256),
  description       TEXT          NOT NULL DEFAULT '',
  effect_type       VARCHAR(24)   NOT NULL
    CHECK (effect_type IN (
      'attack_pct', 'defence_pct', 'crit_chance_pct', 'crit_damage_pct',
      'heal', 'movement_speed', 'energy'
    )),
  effect_value      INTEGER       NOT NULL DEFAULT 0,
  duration_seconds  INTEGER       NOT NULL DEFAULT 0   CHECK (duration_seconds >= 0),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Per-spell level stat overrides ──────────────────────────────────────────
CREATE TABLE spell_levels (
  spell_id          INTEGER   NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  level             SMALLINT  NOT NULL CHECK (level BETWEEN 1 AND 5),
  effect_value      INTEGER   NOT NULL DEFAULT 0,
  duration_seconds  INTEGER   NOT NULL DEFAULT 0   CHECK (duration_seconds >= 0),
  gold_cost         INTEGER   NOT NULL DEFAULT 0   CHECK (gold_cost >= 0),
  PRIMARY KEY (spell_id, level)
);

-- ── Per-spell-level item costs (multiple items per level) ───────────────────
CREATE TABLE spell_costs (
  spell_id      INTEGER   NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  level         SMALLINT  NOT NULL CHECK (level BETWEEN 1 AND 5),
  item_def_id   INTEGER   NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  quantity      SMALLINT  NOT NULL CHECK (quantity >= 1),
  PRIMARY KEY (spell_id, level, item_def_id)
);

-- ── Character spell ownership + training progress ───────────────────────────
CREATE TABLE character_spells (
  character_id      UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_id          INTEGER     NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  current_level     SMALLINT    NOT NULL DEFAULT 1  CHECK (current_level BETWEEN 1 AND 5),
  current_points    SMALLINT    NOT NULL DEFAULT 0  CHECK (current_points BETWEEN 0 AND 99),
  last_book_used_at TIMESTAMPTZ,
  obtained_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, spell_id)
);

-- ── Active spell buffs (persisted for server restart survival) ──────────────
CREATE TABLE active_spell_buffs (
  id              SERIAL        PRIMARY KEY,
  character_id    UUID          NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_id        INTEGER       NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  caster_id       UUID          NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  level           SMALLINT      NOT NULL,
  effect_type     VARCHAR(24)   NOT NULL,
  effect_value    INTEGER       NOT NULL,
  expires_at      TIMESTAMPTZ   NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (character_id, spell_id)
);

CREATE INDEX idx_active_spell_buffs_character
  ON active_spell_buffs (character_id, expires_at);

-- ── Extend item_definitions with spell_id and spell_book_spell category ─────
ALTER TABLE item_definitions
  ADD COLUMN spell_id INTEGER REFERENCES spells(id) ON DELETE SET NULL;

ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_category_check;
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_category_check
  CHECK (category IN (
    'resource', 'food', 'heal', 'weapon',
    'boots', 'shield', 'greaves', 'bracer', 'tool',
    'helmet', 'chestplate',
    'ring', 'amulet',
    'skill_book', 'spell_book_spell'
  ));
