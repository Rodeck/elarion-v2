-- 035_skill_development.sql
-- Adds skill leveling system: ability level definitions, character skill progress,
-- and skill_book item category linked to abilities.

-- ── Extend item_definitions with ability_id and skill_book category ──────────
ALTER TABLE item_definitions
  ADD COLUMN ability_id INTEGER REFERENCES abilities(id) ON DELETE SET NULL;

ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_category_check;
ALTER TABLE item_definitions
  ADD CONSTRAINT item_definitions_category_check
  CHECK (category IN (
    'resource', 'food', 'heal', 'weapon',
    'boots', 'shield', 'greaves', 'bracer', 'tool',
    'helmet', 'chestplate',
    'ring', 'amulet',
    'skill_book'
  ));

-- ── Per-ability level stat definitions (admin-managed) ──────────────────────
CREATE TABLE ability_levels (
  ability_id    INTEGER   NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  level         SMALLINT  NOT NULL CHECK (level BETWEEN 1 AND 5),
  effect_value  INTEGER   NOT NULL DEFAULT 0,
  mana_cost     SMALLINT  NOT NULL DEFAULT 0   CHECK (mana_cost >= 0),
  duration_turns SMALLINT NOT NULL DEFAULT 0   CHECK (duration_turns >= 0),
  cooldown_turns SMALLINT NOT NULL DEFAULT 0   CHECK (cooldown_turns >= 0),
  PRIMARY KEY (ability_id, level)
);

-- ── Per-character, per-ability skill progress ────────────────────────────────
CREATE TABLE character_ability_progress (
  character_id    UUID      NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ability_id      INTEGER   NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  current_level   SMALLINT  NOT NULL DEFAULT 1  CHECK (current_level BETWEEN 1 AND 5),
  current_points  SMALLINT  NOT NULL DEFAULT 0  CHECK (current_points BETWEEN 0 AND 99),
  last_book_used_at TIMESTAMPTZ,
  PRIMARY KEY (character_id, ability_id)
);

-- ── Seed level 1 rows from existing ability base stats ──────────────────────
INSERT INTO ability_levels (ability_id, level, effect_value, mana_cost, duration_turns, cooldown_turns)
SELECT id, 1, effect_value, mana_cost, duration_turns, cooldown_turns
FROM abilities;
