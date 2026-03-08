-- Migration 014: Equipment System
-- Extends item_definitions categories and adds equipped_slot column to inventory_items

ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_category_check,
  ADD CONSTRAINT item_definitions_category_check
    CHECK (category IN (
      'resource','food','heal','weapon',
      'boots','shield','greaves','bracer','tool',
      'helmet','chestplate'
    ));

ALTER TABLE inventory_items
  ADD COLUMN equipped_slot VARCHAR(16)
    CHECK (equipped_slot IN (
      'helmet','chestplate','left_arm','right_arm','greaves','bracer','boots'
    ));

CREATE UNIQUE INDEX idx_inventory_items_equipped_slot
  ON inventory_items(character_id, equipped_slot)
  WHERE equipped_slot IS NOT NULL;
