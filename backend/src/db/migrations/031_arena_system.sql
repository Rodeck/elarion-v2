-- 031_arena_system.sql
-- Arena system: PvP combat, NPC fighter challenges, arena state management

-- Arena definitions
CREATE TABLE arenas (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE UNIQUE,
    name TEXT NOT NULL,
    min_stay_seconds INTEGER NOT NULL DEFAULT 3600,
    reentry_cooldown_seconds INTEGER NOT NULL DEFAULT 1800,
    winner_xp INTEGER NOT NULL DEFAULT 50,
    loser_xp INTEGER NOT NULL DEFAULT 10,
    winner_crowns INTEGER NOT NULL DEFAULT 25,
    loser_crowns INTEGER NOT NULL DEFAULT 0,
    level_bracket INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Arena monster/fighter assignments
CREATE TABLE arena_monsters (
    id SERIAL PRIMARY KEY,
    arena_id INTEGER NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    monster_id INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(arena_id, monster_id)
);

-- Arena participants (currently inside the arena)
CREATE TABLE arena_participants (
    id SERIAL PRIMARY KEY,
    arena_id INTEGER NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_hp INTEGER NOT NULL,
    pre_fight_hp INTEGER,
    in_combat BOOLEAN NOT NULL DEFAULT false,
    fighting_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    can_leave_at TIMESTAMPTZ NOT NULL
);

-- Character arena tracking columns
ALTER TABLE characters ADD COLUMN arena_id INTEGER REFERENCES arenas(id) ON DELETE SET NULL;
ALTER TABLE characters ADD COLUMN arena_cooldown_until TIMESTAMPTZ;

-- Extend building_actions action_type CHECK to include 'arena'
ALTER TABLE building_actions DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions ADD CONSTRAINT building_actions_action_type_check
    CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace', 'fishing', 'arena'));
