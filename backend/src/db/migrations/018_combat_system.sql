-- Migration 018: Combat System — Mana Threshold Auto-Battle
-- Adds mana stats to items, ability definitions, loadouts, and ability drop tables.

-- ── Extend item_definitions with mana combat stats ──────────────────────────
ALTER TABLE item_definitions
  ADD COLUMN max_mana             SMALLINT NOT NULL DEFAULT 0   CHECK (max_mana             >= 0),
  ADD COLUMN mana_on_hit          SMALLINT NOT NULL DEFAULT 0   CHECK (mana_on_hit          >= 0),
  ADD COLUMN mana_on_damage_taken SMALLINT NOT NULL DEFAULT 0   CHECK (mana_on_damage_taken >= 0),
  ADD COLUMN mana_regen           SMALLINT NOT NULL DEFAULT 0   CHECK (mana_regen           >= 0),
  ADD COLUMN dodge_chance         SMALLINT NOT NULL DEFAULT 0   CHECK (dodge_chance  BETWEEN 0 AND 100),
  ADD COLUMN crit_chance          SMALLINT NOT NULL DEFAULT 0   CHECK (crit_chance   BETWEEN 0 AND 100),
  ADD COLUMN crit_damage          SMALLINT NOT NULL DEFAULT 150 CHECK (crit_damage   >= 100);
  -- crit_damage stored as integer %: 150 = 1.5× multiplier (default)

-- ── Ability definitions (admin-managed) ─────────────────────────────────────
CREATE TABLE abilities (
  id               SERIAL        PRIMARY KEY,
  name             VARCHAR(64)   NOT NULL UNIQUE,
  icon_filename    VARCHAR(256),
  description      TEXT          NOT NULL DEFAULT '',
  effect_type      VARCHAR(16)   NOT NULL
    CHECK (effect_type IN ('damage','heal','buff','debuff','dot','shield','reflect','drain')),
  mana_cost        SMALLINT      NOT NULL DEFAULT 20  CHECK (mana_cost  > 0),
  effect_value     INTEGER       NOT NULL DEFAULT 0,
  duration_turns   SMALLINT      NOT NULL DEFAULT 0   CHECK (duration_turns  >= 0),
  cooldown_turns   SMALLINT      NOT NULL DEFAULT 0   CHECK (cooldown_turns  >= 0),
  priority_default SMALLINT      NOT NULL DEFAULT 1   CHECK (priority_default >= 1),
  slot_type        VARCHAR(8)    NOT NULL DEFAULT 'both'
    CHECK (slot_type IN ('auto','active','both')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Character ability ownership ──────────────────────────────────────────────
CREATE TABLE character_owned_abilities (
  character_id  UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ability_id    INTEGER      NOT NULL REFERENCES abilities(id)  ON DELETE CASCADE,
  obtained_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, ability_id)
);

-- ── Per-character loadout slot configuration ─────────────────────────────────
CREATE TABLE character_loadouts (
  character_id  UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_name     VARCHAR(8)   NOT NULL
    CHECK (slot_name IN ('auto_1','auto_2','auto_3','active')),
  ability_id    INTEGER      REFERENCES abilities(id) ON DELETE SET NULL,
  priority      SMALLINT     NOT NULL DEFAULT 1 CHECK (priority >= 1),
  PRIMARY KEY (character_id, slot_name)
);

-- ── Per-monster ability drop table ───────────────────────────────────────────
CREATE TABLE monster_ability_loot (
  id          SERIAL    PRIMARY KEY,
  monster_id  INTEGER   NOT NULL REFERENCES monsters(id)  ON DELETE CASCADE,
  ability_id  INTEGER   NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  drop_chance SMALLINT  NOT NULL CHECK (drop_chance BETWEEN 1 AND 100),
  UNIQUE (monster_id, ability_id)
);

-- ── Seed default abilities ───────────────────────────────────────────────────
-- effect_value for damage/drain = % of attack power; heal = % of max HP;
-- buff/debuff = % stat modifier; dot = % attack per tick; reflect = % of incoming damage.

INSERT INTO abilities (name, effect_type, mana_cost, effect_value, duration_turns, cooldown_turns, priority_default, slot_type, description) VALUES
  ('Power Strike', 'damage',  20, 150, 0, 0, 1, 'both',   'Deal 150% attack damage.'),
  ('Mend',         'heal',    30,  20, 0, 0, 1, 'both',   'Heal 20% of max HP.'),
  ('Iron Skin',    'buff',    25,  30, 3, 0, 1, 'auto',   '+30% defence for 3 turns.'),
  ('Venom Edge',   'dot',     15,   5, 4, 0, 1, 'auto',   'Apply DoT: 5% attack damage per turn for 4 turns.'),
  ('Battle Cry',   'buff',    40,  25, 3, 0, 1, 'both',   '+25% attack for 3 turns.'),
  ('Shatter',      'debuff',  35,  20, 2, 0, 1, 'active', 'Deal damage and reduce enemy defence 20% for 2 turns.'),
  ('Execute',      'damage',  50, 300, 0, 0, 1, 'active', 'Deal 300% damage. Only effective if enemy is below 30% HP.'),
  ('Reflect',      'reflect', 30,  40, 2, 0, 1, 'auto',   'Return 40% of damage taken for 2 turns.'),
  ('Drain Life',   'drain',   25, 100, 0, 0, 1, 'both',   'Deal 100% damage, heal for 50% of damage dealt.')
ON CONFLICT (name) DO NOTHING;
