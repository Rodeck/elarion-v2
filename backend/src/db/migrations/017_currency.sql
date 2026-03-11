-- Migration 017: Currency System (Crowns)
-- Adds Crown balance to characters and Crown drop range to monsters.

ALTER TABLE characters
  ADD COLUMN crowns INTEGER NOT NULL DEFAULT 0;

ALTER TABLE characters
  ADD CONSTRAINT characters_crowns_non_negative CHECK (crowns >= 0);

ALTER TABLE monsters
  ADD COLUMN min_crowns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_crowns INTEGER NOT NULL DEFAULT 0;

ALTER TABLE monsters
  ADD CONSTRAINT monsters_crowns_non_negative CHECK (min_crowns >= 0 AND max_crowns >= 0),
  ADD CONSTRAINT monsters_crowns_range CHECK (min_crowns <= max_crowns);
