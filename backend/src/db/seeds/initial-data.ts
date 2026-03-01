import { query } from '../connection';
import { log } from '../../logger';

const XP_CURVE = [0, 100, 250, 500, 900, 1400];

async function seedCharacterClasses(): Promise<void> {
  const classes = [
    { id: 1, name: 'Warrior', base_hp: 120, base_attack: 15, base_defence: 12, hp_per_level: 20, attack_per_level: 3, defence_per_level: 2 },
    { id: 2, name: 'Mage',    base_hp: 70,  base_attack: 25, base_defence: 6,  hp_per_level: 10, attack_per_level: 5, defence_per_level: 1 },
    { id: 3, name: 'Ranger',  base_hp: 90,  base_attack: 20, base_defence: 9,  hp_per_level: 15, attack_per_level: 4, defence_per_level: 2 },
  ];

  for (const cls of classes) {
    await query(
      `INSERT INTO character_classes
         (id, name, base_hp, base_attack, base_defence, hp_per_level, attack_per_level, defence_per_level, xp_curve)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [cls.id, cls.name, cls.base_hp, cls.base_attack, cls.base_defence,
       cls.hp_per_level, cls.attack_per_level, cls.defence_per_level,
       JSON.stringify(XP_CURVE)],
    );
  }
  log('info', 'seed', 'character_classes_seeded', { count: classes.length });
}

async function seedMapZones(): Promise<void> {
  await query(
    `INSERT INTO map_zones (id, name, tmx_filename, width_tiles, height_tiles, spawn_x, spawn_y, min_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [1, 'Starter Plains', 'starter-plains.tmx', 20, 20, 5, 5, 1],
  );
  log('info', 'seed', 'map_zones_seeded', { count: 1 });
}

async function seedMonsters(): Promise<void> {
  const monsters = [
    { id: 1, name: 'Slime',     zone_id: 1, max_hp: 30,  attack_power: 5,  defence: 2,  xp_reward: 20,  respawn_seconds: 30, aggro_range: 2 },
    { id: 2, name: 'Goblin',    zone_id: 1, max_hp: 50,  attack_power: 10, defence: 4,  xp_reward: 40,  respawn_seconds: 45, aggro_range: 3 },
    { id: 3, name: 'Wolf',      zone_id: 1, max_hp: 70,  attack_power: 15, defence: 6,  xp_reward: 60,  respawn_seconds: 60, aggro_range: 4 },
    { id: 4, name: 'Bandit',    zone_id: 1, max_hp: 90,  attack_power: 18, defence: 8,  xp_reward: 80,  respawn_seconds: 90, aggro_range: 3 },
    { id: 5, name: 'Dark Elf',  zone_id: 1, max_hp: 110, attack_power: 22, defence: 10, xp_reward: 110, respawn_seconds: 120, aggro_range: 3 },
  ];

  for (const m of monsters) {
    await query(
      `INSERT INTO monsters
         (id, name, zone_id, max_hp, attack_power, defence, xp_reward, loot_table, respawn_seconds, aggro_range)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.name, m.zone_id, m.max_hp, m.attack_power, m.defence,
       m.xp_reward, '[]', m.respawn_seconds, m.aggro_range],
    );
  }
  log('info', 'seed', 'monsters_seeded', { count: monsters.length });
}

async function seedItems(): Promise<void> {
  const items = [
    { id: 1, name: 'Wooden Sword',   type: 'weapon',     stat_modifiers: { attack_power: 5 },  description: 'A basic training sword.' },
    { id: 2, name: 'Leather Armour', type: 'armour',     stat_modifiers: { defence: 4 },        description: 'Simple protective gear.' },
    { id: 3, name: 'Health Potion',  type: 'consumable', stat_modifiers: { current_hp: 30 },    description: 'Restores 30 HP when used.' },
    { id: 4, name: 'Iron Ring',      type: 'armour',     stat_modifiers: { defence: 2 },        description: 'A plain iron band.' },
    { id: 5, name: 'Short Bow',      type: 'weapon',     stat_modifiers: { attack_power: 8 },   description: 'A compact ranged weapon.' },
  ];

  for (const item of items) {
    await query(
      `INSERT INTO items (id, name, type, stat_modifiers, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.name, item.type, JSON.stringify(item.stat_modifiers), item.description],
    );
  }
  log('info', 'seed', 'items_seeded', { count: items.length });
}

export async function runSeeds(): Promise<void> {
  log('info', 'seed', 'starting');
  await seedCharacterClasses();
  await seedMapZones();
  await seedMonsters();
  await seedItems();
  log('info', 'seed', 'complete');
}
