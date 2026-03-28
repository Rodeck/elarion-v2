-- Boss definitions (templates)
CREATE TABLE IF NOT EXISTS bosses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_filename VARCHAR(255),
  sprite_filename VARCHAR(255),
  max_hp INTEGER NOT NULL CHECK (max_hp > 0),
  attack INTEGER NOT NULL CHECK (attack >= 0),
  defense INTEGER NOT NULL CHECK (defense >= 0),
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  min_crowns INTEGER NOT NULL DEFAULT 0 CHECK (min_crowns >= 0),
  max_crowns INTEGER NOT NULL DEFAULT 0,
  building_id INTEGER UNIQUE REFERENCES buildings(id) ON DELETE SET NULL,
  respawn_min_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (respawn_min_seconds > 0),
  respawn_max_seconds INTEGER NOT NULL DEFAULT 7200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bosses_crowns_check CHECK (max_crowns >= min_crowns),
  CONSTRAINT bosses_respawn_check CHECK (respawn_max_seconds >= respawn_min_seconds)
);

CREATE INDEX IF NOT EXISTS idx_bosses_building ON bosses(building_id);

-- Boss ability assignments
CREATE TABLE IF NOT EXISTS boss_abilities (
  id SERIAL PRIMARY KEY,
  boss_id INTEGER NOT NULL REFERENCES bosses(id) ON DELETE CASCADE,
  ability_id INTEGER NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  UNIQUE(boss_id, ability_id)
);

CREATE INDEX IF NOT EXISTS idx_boss_abilities_boss ON boss_abilities(boss_id);

-- Boss loot table
CREATE TABLE IF NOT EXISTS boss_loot (
  id SERIAL PRIMARY KEY,
  boss_id INTEGER NOT NULL REFERENCES bosses(id) ON DELETE CASCADE,
  item_def_id INTEGER NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  drop_chance NUMERIC(5,2) NOT NULL CHECK (drop_chance >= 0 AND drop_chance <= 100),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_boss_loot_boss ON boss_loot(boss_id);

-- Live boss instances
CREATE TABLE IF NOT EXISTS boss_instances (
  id SERIAL PRIMARY KEY,
  boss_id INTEGER NOT NULL REFERENCES bosses(id) ON DELETE CASCADE,
  current_hp INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'alive',
  fighting_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  defeated_at TIMESTAMPTZ,
  respawn_at TIMESTAMPTZ,
  CONSTRAINT boss_instances_status_check CHECK (status IN ('alive', 'in_combat', 'defeated'))
);

CREATE INDEX IF NOT EXISTS idx_boss_instances_boss ON boss_instances(boss_id);
CREATE INDEX IF NOT EXISTS idx_boss_instances_status ON boss_instances(status);
