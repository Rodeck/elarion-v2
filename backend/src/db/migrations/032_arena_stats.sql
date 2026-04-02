-- 032_arena_stats.sql
-- Arena PvP statistics: persistent total wins + session win streak

ALTER TABLE characters ADD COLUMN arena_pvp_wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE arena_participants ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
