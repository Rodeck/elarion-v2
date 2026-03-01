CREATE TABLE IF NOT EXISTS monsters (
  id              SMALLINT     PRIMARY KEY,
  name            VARCHAR(64)  NOT NULL,
  zone_id         SMALLINT     NOT NULL REFERENCES map_zones(id),
  max_hp          SMALLINT     NOT NULL,
  attack_power    SMALLINT     NOT NULL,
  defence         SMALLINT     NOT NULL,
  xp_reward       SMALLINT     NOT NULL,
  loot_table      JSONB        NOT NULL DEFAULT '[]',
  respawn_seconds SMALLINT     NOT NULL DEFAULT 30,
  aggro_range     SMALLINT     NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS items (
  id             SMALLINT    PRIMARY KEY,
  name           VARCHAR(64) NOT NULL UNIQUE,
  type           VARCHAR(16) NOT NULL CHECK (type IN ('weapon','armour','consumable')),
  stat_modifiers JSONB       NOT NULL DEFAULT '{}',
  description    TEXT
);

CREATE TABLE IF NOT EXISTS character_items (
  character_id UUID     NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id      SMALLINT NOT NULL REFERENCES items(id),
  quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  equipped     BOOLEAN  NOT NULL DEFAULT false,
  PRIMARY KEY (character_id, item_id)
);
