-- 024_drop_character_squires_name.sql
-- Fix: drop the legacy 'name' column from character_squires.
-- The name is now derived from squire_definitions via JOIN, not stored per-instance.

ALTER TABLE character_squires DROP COLUMN IF EXISTS name;
