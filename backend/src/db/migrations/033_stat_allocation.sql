-- 033: Character Stat Allocation System
-- Replace automatic level-up stat grants with manual point allocation via 5 core attributes.

-- 1. Add attribute columns to characters
ALTER TABLE characters ADD COLUMN stat_points_unspent SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN attr_constitution   SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN attr_strength       SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN attr_intelligence   SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN attr_dexterity      SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN attr_toughness      SMALLINT NOT NULL DEFAULT 0;

-- 2. Add trainer role to NPCs
ALTER TABLE npcs ADD COLUMN is_trainer BOOLEAN NOT NULL DEFAULT false;

-- 3. Reset existing characters to class base stats and grant retroactive stat points
UPDATE characters c
SET max_hp              = cc.base_hp,
    attack_power        = cc.base_attack,
    defence             = cc.base_defence,
    current_hp          = LEAST(c.current_hp, cc.base_hp),
    stat_points_unspent = 7 * (c.level - 1)
FROM character_classes cc
WHERE c.class_id = cc.id;
