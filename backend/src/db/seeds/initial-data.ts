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
  // Map zones are created via admin portal — no seeds needed
  log('info', 'seed', 'map_zones_skipped', { reason: 'admin-managed' });
}

async function seedMonsters(): Promise<void> {
  // Monsters will be assigned to zones via admin portal
  log('info', 'seed', 'monsters_skipped', { reason: 'admin-managed zones' });
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
