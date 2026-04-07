#!/usr/bin/env node
// game-data.js — Query game database for planning and content design
// Usage: node scripts/game-data.js <command> [args...]

const path = require('path');
const { Pool } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'pg'));

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/elarion_dev';
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

// ─── Helpers ───────────────────────────────────────────────────────────────────

function table(rows, columns) {
  if (!rows.length) { console.log('  (no data)'); return; }
  const cols = columns || Object.keys(rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');
  const header = cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join('│');
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    console.log(cols.map((c, i) => ` ${String(row[c] ?? '').padEnd(widths[i])} `).join('│'));
  }
}

function section(title) { console.log(`\n═══ ${title} ${'═'.repeat(Math.max(0, 60 - title.length))}`); }

// ─── Commands ──────────────────────────────────────────────────────────────────

async function overview() {
  const counts = await Promise.all([
    pool.query(`SELECT COUNT(*) as n FROM item_definitions`),
    pool.query(`SELECT COUNT(*) as n FROM monsters`),
    pool.query(`SELECT COUNT(*) as n FROM map_zones`),
    pool.query(`SELECT COUNT(*) as n FROM buildings`),
    pool.query(`SELECT COUNT(*) as n FROM npcs`),
    pool.query(`SELECT COUNT(*) as n FROM crafting_recipes`),
    pool.query(`SELECT COUNT(*) as n FROM abilities`),
    pool.query(`SELECT COUNT(*) as n FROM quest_definitions`),
    pool.query(`SELECT COUNT(*) as n FROM characters`),
    pool.query(`SELECT COUNT(*) as n FROM accounts`),
    pool.query(`SELECT COUNT(*) as n FROM bosses`).catch(() => ({ rows: [{ n: 0 }] })),
    pool.query(`SELECT COUNT(*) as n FROM arenas`).catch(() => ({ rows: [{ n: 0 }] })),
  ]);
  const labels = ['Items', 'Monsters', 'Map Zones', 'Buildings', 'NPCs', 'Crafting Recipes', 'Abilities', 'Quests', 'Characters', 'Accounts', 'Bosses', 'Arenas'];
  section('Game Overview');
  table(labels.map((l, i) => ({ entity: l, count: counts[i].rows[0].n })));

  // Categories breakdown
  section('Items by Category');
  const cats = await pool.query(`SELECT category, COUNT(*) as count FROM item_definitions GROUP BY category ORDER BY count DESC`);
  table(cats.rows);

  // Zones summary
  section('Zones');
  const zones = await pool.query(`
    SELECT z.id, z.name, z.map_type, z.min_level,
      (SELECT COUNT(*) FROM buildings b WHERE b.zone_id = z.id) as buildings,
      (SELECT COUNT(*) FROM path_nodes pn WHERE pn.zone_id = z.id) as nodes,
      (SELECT COUNT(*) FROM map_random_encounter_tables re WHERE re.zone_id = z.id) as encounter_types
    FROM map_zones z ORDER BY z.id
  `);
  table(zones.rows);
}

async function items(category) {
  const q = category
    ? `SELECT id, name, category, weapon_subtype, attack, defence, heal_power, food_power, stack_size,
         dodge_chance, crit_chance, crit_damage, max_mana, mana_on_hit, armor_penetration, additional_attacks
       FROM item_definitions WHERE category = $1 ORDER BY id`
    : `SELECT id, name, category, weapon_subtype, attack, defence, heal_power, food_power, stack_size
       FROM item_definitions ORDER BY category, id`;
  const params = category ? [category] : [];
  const res = await pool.query(q, params);
  section(category ? `Items — ${category}` : 'All Items');
  table(res.rows);

  if (!category) {
    console.log('\nTip: filter by category with: game-data items <category>');
    console.log('Categories: resource, food, heal, weapon, boots, shield, greaves, bracer, tool, helmet, chestplate');
  }
}

async function itemDetail(id) {
  const res = await pool.query(`SELECT * FROM item_definitions WHERE id = $1`, [id]);
  if (!res.rows.length) { console.log(`Item #${id} not found`); return; }
  const item = res.rows[0];

  section(`Item #${id}: ${item.name}`);
  console.log(`  Category:       ${item.category}${item.weapon_subtype ? ` (${item.weapon_subtype})` : ''}`);
  console.log(`  Stack Size:     ${item.stack_size ?? 'unstackable'}`);
  if (item.attack)     console.log(`  Attack:         ${item.attack}`);
  if (item.defence)    console.log(`  Defence:        ${item.defence}`);
  if (item.heal_power) console.log(`  Heal Power:     ${item.heal_power}`);
  if (item.food_power) console.log(`  Food Power:     ${item.food_power}`);
  if (item.max_mana)   console.log(`  Max Mana:       ${item.max_mana}`);
  if (item.mana_on_hit) console.log(`  Mana on Hit:    ${item.mana_on_hit}`);
  if (item.mana_on_damage_taken) console.log(`  Mana on Dmg:    ${item.mana_on_damage_taken}`);
  if (item.mana_regen) console.log(`  Mana Regen:     ${item.mana_regen}`);
  if (item.dodge_chance) console.log(`  Dodge Chance:   ${item.dodge_chance}%`);
  if (item.crit_chance)  console.log(`  Crit Chance:    ${item.crit_chance}%`);
  if (item.crit_damage && item.crit_damage !== 150) console.log(`  Crit Damage:    ${item.crit_damage}%`);
  if (item.armor_penetration) console.log(`  Armor Pen:      ${item.armor_penetration}%`);
  if (item.additional_attacks) console.log(`  Extra Attacks:  ${item.additional_attacks}`);
  if (item.icon_filename) console.log(`  Icon:           ${item.icon_filename}`);

  // Where does this item drop?
  const drops = await pool.query(`
    SELECT m.id as monster_id, m.name as monster, ml.drop_chance, ml.quantity
    FROM monster_loot ml JOIN monsters m ON m.id = ml.monster_id
    WHERE ml.item_def_id = $1 ORDER BY ml.drop_chance DESC
  `, [id]);
  if (drops.rows.length) {
    section('Dropped By');
    table(drops.rows);
  }

  // Which recipes use this as ingredient?
  const ingredients = await pool.query(`
    SELECT cr.id as recipe_id, cr.name as recipe, n.name as crafter_npc, ri.quantity as qty_needed
    FROM recipe_ingredients ri
    JOIN crafting_recipes cr ON cr.id = ri.recipe_id
    JOIN npcs n ON n.id = cr.npc_id
    WHERE ri.item_def_id = $1 ORDER BY cr.name
  `, [id]);
  if (ingredients.rows.length) {
    section('Used in Recipes (as ingredient)');
    table(ingredients.rows);
  }

  // Which recipes produce this?
  const produced = await pool.query(`
    SELECT cr.id as recipe_id, cr.name as recipe, n.name as crafter_npc, cr.output_quantity as qty_produced,
      cr.cost_crowns, cr.craft_time_seconds as craft_time_s
    FROM crafting_recipes cr JOIN npcs n ON n.id = cr.npc_id
    WHERE cr.output_item_id = $1 ORDER BY cr.name
  `, [id]);
  if (produced.rows.length) {
    section('Produced by Recipes');
    table(produced.rows);
  }

  // Expedition rewards containing this item
  const expeditions = await pool.query(`
    SELECT ba.id as action_id, b.name as building, z.name as zone, ba.config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'expedition' AND ba.config::text LIKE '%"item_def_id":' || $1::text || '%'
  `, [id]);
  if (expeditions.rows.length) {
    section('Expedition Rewards');
    for (const e of expeditions.rows) {
      const itemEntry = (e.config.items || []).find(i => i.item_def_id === parseInt(id));
      console.log(`  ${e.zone} / ${e.building} — base qty: ${itemEntry ? itemEntry.base_quantity : '?'}`);
    }
  }

  // Gathering event rewards containing this item
  const gatherActions = await pool.query(`
    SELECT ba.id as action_id, b.name as building, z.name as zone, ba.config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'gather' AND ba.config::text LIKE '%"item_def_id":' || $1::text || '%'
  `, [id]);
  if (gatherActions.rows.length) {
    section('Gathering Sources');
    for (const g of gatherActions.rows) {
      const ev = (g.config.events || []).find(e => e.type === 'resource' && e.item_def_id === parseInt(id));
      console.log(`  ${g.zone} / ${g.building} — qty: ${ev ? ev.quantity : '?'}, weight: ${ev ? ev.weight : '?'}`);
    }
  }
}

async function monsters() {
  const res = await pool.query(`
    SELECT m.id, m.name, m.hp, m.attack, m.defense, m.xp_reward, m.min_crowns, m.max_crowns,
      (SELECT string_agg(i.name || ' (' || ml.drop_chance || '%)', ', ' ORDER BY ml.drop_chance DESC)
       FROM monster_loot ml JOIN item_definitions i ON i.id = ml.item_def_id
       WHERE ml.monster_id = m.id) as loot_summary,
      (SELECT string_agg(a.name || ' (' || mal.drop_chance || '%)', ', ' ORDER BY mal.drop_chance DESC)
       FROM monster_ability_loot mal JOIN abilities a ON a.id = mal.ability_id
       WHERE mal.monster_id = m.id) as ability_drops
    FROM monsters m ORDER BY m.id
  `);
  section('All Monsters');
  table(res.rows);
}

async function monsterDetail(id) {
  const res = await pool.query(`SELECT * FROM monsters WHERE id = $1`, [id]);
  if (!res.rows.length) { console.log(`Monster #${id} not found`); return; }
  const m = res.rows[0];

  section(`Monster #${id}: ${m.name}`);
  console.log(`  HP:          ${m.hp}`);
  console.log(`  Attack:      ${m.attack}`);
  console.log(`  Defense:     ${m.defense}`);
  console.log(`  XP Reward:   ${m.xp_reward}`);
  console.log(`  Crowns:      ${m.min_crowns}–${m.max_crowns}`);
  if (m.icon_filename) console.log(`  Icon:        ${m.icon_filename}`);

  // Loot table
  const loot = await pool.query(`
    SELECT i.id as item_id, i.name as item, i.category, ml.drop_chance, ml.quantity
    FROM monster_loot ml JOIN item_definitions i ON i.id = ml.item_def_id
    WHERE ml.monster_id = $1 ORDER BY ml.drop_chance DESC
  `, [id]);
  if (loot.rows.length) {
    section('Item Loot Table');
    table(loot.rows);
  }

  // Ability drops
  const abilityLoot = await pool.query(`
    SELECT a.id as ability_id, a.name as ability, a.effect_type, a.mana_cost, mal.drop_chance
    FROM monster_ability_loot mal JOIN abilities a ON a.id = mal.ability_id
    WHERE mal.monster_id = $1 ORDER BY mal.drop_chance DESC
  `, [id]);
  if (abilityLoot.rows.length) {
    section('Ability Drops');
    table(abilityLoot.rows);
  }

  // Where does this monster appear?
  const zones = await pool.query(`
    SELECT z.id as zone_id, z.name as zone, b.name as building, ba.id as action_id,
      (ba.config->'monsters') as encounter_config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'explore' AND ba.config::text LIKE '%"monster_id":' || $1::text || '%'
  `, [id]);
  if (zones.rows.length) {
    section('Appears in Explore Actions');
    for (const z of zones.rows) {
      const cfg = z.encounter_config || [];
      const entry = cfg.find(e => e.monster_id === parseInt(id));
      console.log(`  ${z.zone} / ${z.building} — weight: ${entry ? entry.weight : '?'}`);
    }
  }

  // Random encounter tables
  const encounters = await pool.query(`
    SELECT z.id as zone_id, z.name as zone, ret.weight
    FROM map_random_encounter_tables ret
    JOIN map_zones z ON z.id = ret.zone_id
    WHERE ret.monster_id = $1 ORDER BY z.id
  `, [id]);
  if (encounters.rows.length) {
    section('Night Random Encounters');
    table(encounters.rows);
  }

  // Gathering encounter appearances
  const gatherEncounters = await pool.query(`
    SELECT ba.id as action_id, b.name as building, z.name as zone, ba.config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'gather' AND ba.config::text LIKE '%"monster_id":' || $1::text || '%'
  `, [id]);
  if (gatherEncounters.rows.length) {
    section('Appears in Gathering Events');
    for (const g of gatherEncounters.rows) {
      const ev = (g.config.events || []).find(e => e.type === 'monster' && e.monster_id === parseInt(id));
      console.log(`  ${g.zone} / ${g.building} — weight: ${ev ? ev.weight : '?'}`);
    }
  }
}

async function maps() {
  const res = await pool.query(`
    SELECT z.id, z.name, z.map_type, z.min_level,
      z.image_filename, z.tmx_filename,
      (SELECT COUNT(*) FROM path_nodes pn WHERE pn.zone_id = z.id) as nodes,
      (SELECT COUNT(*) FROM buildings b WHERE b.zone_id = z.id) as buildings,
      (SELECT COUNT(*) FROM characters c WHERE c.zone_id = z.id) as online_chars
    FROM map_zones z ORDER BY z.id
  `);
  section('All Zones');
  table(res.rows);
}

async function zoneDetail(id) {
  const res = await pool.query(`SELECT * FROM map_zones WHERE id = $1`, [id]);
  if (!res.rows.length) { console.log(`Zone #${id} not found`); return; }
  const z = res.rows[0];

  section(`Zone #${id}: ${z.name}`);
  console.log(`  Type:        ${z.map_type}`);
  console.log(`  Min Level:   ${z.min_level}`);
  if (z.map_type === 'image') {
    console.log(`  Image:       ${z.image_filename} (${z.image_width_px}x${z.image_height_px})`);
  } else {
    console.log(`  TMX:         ${z.tmx_filename} (${z.width_tiles}x${z.height_tiles})`);
  }
  console.log(`  Spawn:       (${z.spawn_x}, ${z.spawn_y})`);

  // Buildings
  const buildings = await pool.query(`
    SELECT b.id, b.name, b.description, pn.x, pn.y,
      (SELECT COUNT(*) FROM building_actions ba WHERE ba.building_id = b.id) as actions,
      (SELECT COUNT(*) FROM building_npcs bn WHERE bn.building_id = b.id) as npcs
    FROM buildings b
    LEFT JOIN path_nodes pn ON pn.id = b.node_id
    WHERE b.zone_id = $1 ORDER BY b.id
  `, [id]);
  if (buildings.rows.length) {
    section('Buildings');
    table(buildings.rows);
  }

  // Building actions detail
  for (const b of buildings.rows) {
    const actions = await pool.query(`
      SELECT ba.id, ba.action_type, ba.sort_order, ba.config
      FROM building_actions ba WHERE ba.building_id = $1 ORDER BY ba.sort_order
    `, [b.id]);
    if (actions.rows.length) {
      console.log(`\n  ── ${b.name} Actions ──`);
      for (const a of actions.rows) {
        const cfg = a.config || {};
        if (a.action_type === 'travel') {
          const targetZone = await pool.query(`SELECT name FROM map_zones WHERE id = $1`, [cfg.target_zone_id]);
          console.log(`    [${a.id}] travel → ${targetZone.rows[0]?.name || 'zone ' + cfg.target_zone_id} (node ${cfg.target_node_id})`);
        } else if (a.action_type === 'explore') {
          const monsterNames = [];
          for (const m of (cfg.monsters || [])) {
            const mr = await pool.query(`SELECT name FROM monsters WHERE id = $1`, [m.monster_id]);
            monsterNames.push(`${mr.rows[0]?.name || '?'} (w:${m.weight})`);
          }
          console.log(`    [${a.id}] explore — chance: ${cfg.encounter_chance}% — ${monsterNames.join(', ') || 'no monsters'}`);
        } else if (a.action_type === 'expedition') {
          const itemNames = [];
          for (const it of (cfg.items || [])) {
            const ir = await pool.query(`SELECT name FROM item_definitions WHERE id = $1`, [it.item_def_id]);
            itemNames.push(`${ir.rows[0]?.name || '?'} x${it.base_quantity}`);
          }
          console.log(`    [${a.id}] expedition — gold: ${cfg.base_gold}, exp: ${cfg.base_exp} — items: ${itemNames.join(', ') || 'none'}`);
        } else if (a.action_type === 'gather') {
          const eventSummary = [];
          for (const ev of (cfg.events || [])) {
            if (ev.type === 'resource') {
              const ir = await pool.query(`SELECT name FROM item_definitions WHERE id = $1`, [ev.item_def_id]);
              eventSummary.push(`${ir.rows[0]?.name || '?'} x${ev.quantity} (w:${ev.weight})`);
            } else if (ev.type === 'gold') {
              eventSummary.push(`gold ${ev.min_amount}-${ev.max_amount} (w:${ev.weight})`);
            } else if (ev.type === 'monster') {
              const mr = await pool.query(`SELECT name FROM monsters WHERE id = $1`, [ev.monster_id]);
              eventSummary.push(`${mr.rows[0]?.name || '?'} encounter (w:${ev.weight})`);
            } else if (ev.type === 'accident') {
              eventSummary.push(`accident ${ev.hp_damage}dmg (w:${ev.weight})`);
            } else if (ev.type === 'nothing') {
              eventSummary.push(`nothing (w:${ev.weight})`);
            }
          }
          console.log(`    [${a.id}] gather — tool: ${cfg.required_tool_type}, dur/s: ${cfg.durability_per_second}, time: ${cfg.min_seconds}-${cfg.max_seconds}s — ${eventSummary.join(', ')}`);
        }
      }
    }

    // NPCs in this building
    const npcs = await pool.query(`
      SELECT n.id, n.name, n.is_crafter,
        (SELECT COUNT(*) FROM crafting_recipes cr WHERE cr.npc_id = n.id) as recipes
      FROM building_npcs bn JOIN npcs n ON n.id = bn.npc_id
      WHERE bn.building_id = $1 ORDER BY bn.sort_order
    `, [b.id]);
    if (npcs.rows.length) {
      console.log(`\n  ── ${b.name} NPCs ──`);
      table(npcs.rows);
    }
  }

  // Random encounter table
  const encounters = await pool.query(`
    SELECT m.id as monster_id, m.name as monster, m.hp, m.attack, m.defense, ret.weight
    FROM map_random_encounter_tables ret JOIN monsters m ON m.id = ret.monster_id
    WHERE ret.zone_id = $1 ORDER BY ret.weight DESC
  `, [id]);
  if (encounters.rows.length) {
    section('Night Random Encounters');
    table(encounters.rows);
  }
}

async function npcs() {
  const res = await pool.query(`
    SELECT n.id, n.name, n.is_crafter, n.is_trainer,
      (SELECT string_agg(b.name || ' (' || z.name || ')', ', ')
       FROM building_npcs bn JOIN buildings b ON b.id = bn.building_id JOIN map_zones z ON z.id = b.zone_id
       WHERE bn.npc_id = n.id) as locations,
      (SELECT COUNT(*) FROM crafting_recipes cr WHERE cr.npc_id = n.id) as recipes
    FROM npcs n ORDER BY n.id
  `);
  section('All NPCs');
  table(res.rows);
}

async function recipes(npcId) {
  const q = npcId
    ? `SELECT cr.id, cr.name, n.name as npc, i.name as output_item, cr.output_quantity as qty,
         cr.cost_crowns as crowns, cr.craft_time_seconds as time_s,
         (SELECT string_agg(id2.name || ' x' || ri.quantity, ', ' ORDER BY ri.id)
          FROM recipe_ingredients ri JOIN item_definitions id2 ON id2.id = ri.item_def_id
          WHERE ri.recipe_id = cr.id) as ingredients
       FROM crafting_recipes cr
       JOIN npcs n ON n.id = cr.npc_id
       JOIN item_definitions i ON i.id = cr.output_item_id
       WHERE cr.npc_id = $1 ORDER BY cr.sort_order, cr.id`
    : `SELECT cr.id, cr.name, n.name as npc, i.name as output_item, cr.output_quantity as qty,
         cr.cost_crowns as crowns, cr.craft_time_seconds as time_s,
         (SELECT string_agg(id2.name || ' x' || ri.quantity, ', ' ORDER BY ri.id)
          FROM recipe_ingredients ri JOIN item_definitions id2 ON id2.id = ri.item_def_id
          WHERE ri.recipe_id = cr.id) as ingredients
       FROM crafting_recipes cr
       JOIN npcs n ON n.id = cr.npc_id
       JOIN item_definitions i ON i.id = cr.output_item_id
       ORDER BY n.name, cr.sort_order, cr.id`;
  const params = npcId ? [npcId] : [];
  const res = await pool.query(q, params);
  section(npcId ? `Recipes for NPC #${npcId}` : 'All Crafting Recipes');
  table(res.rows);
}

async function abilities() {
  const res = await pool.query(`
    SELECT a.id, a.name, a.effect_type, a.mana_cost, a.effect_value, a.duration_turns,
      a.cooldown_turns, a.slot_type,
      (SELECT string_agg(m.name || ' (' || mal.drop_chance || '%)', ', ')
       FROM monster_ability_loot mal JOIN monsters m ON m.id = mal.monster_id
       WHERE mal.ability_id = a.id) as dropped_by
    FROM abilities a ORDER BY a.id
  `);
  section('All Abilities');
  table(res.rows);
}

async function economy() {
  section('Crown Sources (Monster Drops)');
  const crownMonsters = await pool.query(`
    SELECT id, name, min_crowns, max_crowns, hp, attack, defense, xp_reward
    FROM monsters WHERE max_crowns > 0 ORDER BY max_crowns DESC
  `);
  table(crownMonsters.rows);

  section('Crafting Costs (Crown Sinks)');
  const crownRecipes = await pool.query(`
    SELECT cr.name as recipe, n.name as npc, cr.cost_crowns, i.name as output,
      cr.output_quantity as qty, cr.craft_time_seconds as time_s
    FROM crafting_recipes cr
    JOIN npcs n ON n.id = cr.npc_id
    JOIN item_definitions i ON i.id = cr.output_item_id
    WHERE cr.cost_crowns > 0 ORDER BY cr.cost_crowns DESC
  `);
  table(crownRecipes.rows);

  section('Equipment Stats Summary');
  const equipment = await pool.query(`
    SELECT id, name, category, weapon_subtype, attack, defence,
      dodge_chance, crit_chance, crit_damage, max_mana, armor_penetration, additional_attacks
    FROM item_definitions
    WHERE category IN ('weapon','helmet','chestplate','shield','greaves','bracer','boots')
    ORDER BY category, attack DESC NULLS LAST, defence DESC NULLS LAST
  `);
  table(equipment.rows);

  section('Expedition Rewards');
  const expeditions = await pool.query(`
    SELECT b.name as building, z.name as zone, ba.config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'expedition' ORDER BY z.id, b.id
  `);
  for (const e of expeditions.rows) {
    const cfg = e.config || {};
    const itemNames = [];
    for (const it of (cfg.items || [])) {
      const ir = await pool.query(`SELECT name FROM item_definitions WHERE id = $1`, [it.item_def_id]);
      itemNames.push(`${ir.rows[0]?.name || '?'} x${it.base_quantity}`);
    }
    console.log(`  ${e.zone} / ${e.building} — gold: ${cfg.base_gold}, exp: ${cfg.base_exp} — ${itemNames.join(', ') || 'no items'}`);
  }

  section('Gathering Rewards');
  const gatherActions = await pool.query(`
    SELECT b.name as building, z.name as zone, ba.config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'gather' ORDER BY z.id, b.id
  `);
  if (gatherActions.rows.length) {
    for (const g of gatherActions.rows) {
      const cfg = g.config || {};
      const parts = [`tool: ${cfg.required_tool_type}, ${cfg.min_seconds}-${cfg.max_seconds}s`];
      for (const ev of (cfg.events || [])) {
        if (ev.type === 'resource') {
          const ir = await pool.query(`SELECT name FROM item_definitions WHERE id = $1`, [ev.item_def_id]);
          parts.push(`${ir.rows[0]?.name || '?'} x${ev.quantity}`);
        } else if (ev.type === 'gold') {
          parts.push(`gold ${ev.min_amount}-${ev.max_amount}`);
        }
      }
      console.log(`  ${g.zone} / ${g.building} — ${parts.join(', ')}`);
    }
  } else {
    console.log('  (no gathering actions)');
  }
}

async function gathering() {
  const res = await pool.query(`
    SELECT ba.id, b.name as building, z.name as zone, ba.config
    FROM building_actions ba
    JOIN buildings b ON b.id = ba.building_id
    JOIN map_zones z ON z.id = b.zone_id
    WHERE ba.action_type = 'gather' ORDER BY z.id, b.id
  `);
  section('All Gathering Actions');
  if (!res.rows.length) { console.log('  (no gathering actions defined)'); return; }

  for (const row of res.rows) {
    const cfg = row.config || {};
    console.log(`\n  [${row.id}] ${row.zone} / ${row.building}`);
    console.log(`    Tool: ${cfg.required_tool_type}  |  Durability/s: ${cfg.durability_per_second}  |  Time: ${cfg.min_seconds}–${cfg.max_seconds}s`);

    if (cfg.events && cfg.events.length) {
      console.log('    Events:');
      for (const ev of cfg.events) {
        if (ev.type === 'resource') {
          const ir = await pool.query(`SELECT name FROM item_definitions WHERE id = $1`, [ev.item_def_id]);
          console.log(`      resource: ${ir.rows[0]?.name || `item#${ev.item_def_id}`} x${ev.quantity} (weight: ${ev.weight})`);
        } else if (ev.type === 'gold') {
          console.log(`      gold: ${ev.min_amount}–${ev.max_amount} crowns (weight: ${ev.weight})`);
        } else if (ev.type === 'monster') {
          const mr = await pool.query(`SELECT name FROM monsters WHERE id = $1`, [ev.monster_id]);
          console.log(`      monster: ${mr.rows[0]?.name || `monster#${ev.monster_id}`} (weight: ${ev.weight})`);
        } else if (ev.type === 'accident') {
          console.log(`      accident: ${ev.hp_damage} HP damage (weight: ${ev.weight})`);
        } else if (ev.type === 'nothing') {
          console.log(`      nothing (weight: ${ev.weight})`);
        }
      }
    }
  }

  // Tool items summary
  section('Tool Items');
  const tools = await pool.query(`
    SELECT id, name, tool_type, max_durability, power
    FROM item_definitions WHERE tool_type IS NOT NULL ORDER BY tool_type, id
  `);
  if (tools.rows.length) {
    table(tools.rows);
  } else {
    console.log('  (no tool items defined)');
  }
}

async function search(term) {
  const like = `%${term}%`;
  section(`Search: "${term}"`);

  const itemRes = await pool.query(`SELECT id, name, category FROM item_definitions WHERE LOWER(name) LIKE LOWER($1) ORDER BY id`, [like]);
  if (itemRes.rows.length) { console.log('\nItems:'); table(itemRes.rows); }

  const monsterRes = await pool.query(`SELECT id, name, hp, attack FROM monsters WHERE LOWER(name) LIKE LOWER($1) ORDER BY id`, [like]);
  if (monsterRes.rows.length) { console.log('\nMonsters:'); table(monsterRes.rows); }

  const npcRes = await pool.query(`SELECT id, name, is_crafter FROM npcs WHERE LOWER(name) LIKE LOWER($1) ORDER BY id`, [like]);
  if (npcRes.rows.length) { console.log('\nNPCs:'); table(npcRes.rows); }

  const buildingRes = await pool.query(`
    SELECT b.id, b.name, z.name as zone FROM buildings b JOIN map_zones z ON z.id = b.zone_id
    WHERE LOWER(b.name) LIKE LOWER($1) ORDER BY b.id
  `, [like]);
  if (buildingRes.rows.length) { console.log('\nBuildings:'); table(buildingRes.rows); }

  const abilityRes = await pool.query(`SELECT id, name, effect_type FROM abilities WHERE LOWER(name) LIKE LOWER($1) ORDER BY id`, [like]);
  if (abilityRes.rows.length) { console.log('\nAbilities:'); table(abilityRes.rows); }

  const recipeRes = await pool.query(`SELECT cr.id, cr.name, n.name as npc FROM crafting_recipes cr JOIN npcs n ON n.id = cr.npc_id WHERE LOWER(cr.name) LIKE LOWER($1) ORDER BY cr.id`, [like]);
  if (recipeRes.rows.length) { console.log('\nRecipes:'); table(recipeRes.rows); }

  const total = itemRes.rows.length + monsterRes.rows.length + npcRes.rows.length + buildingRes.rows.length + abilityRes.rows.length + recipeRes.rows.length;
  if (total === 0) console.log('  No results found.');
}

// ─── SQL (raw query) ───────────────────────────────────────────────────────────

async function rawSql(sql) {
  section('SQL Query');
  console.log(`  ${sql}\n`);
  const res = await pool.query(sql);
  if (res.rows.length) {
    table(res.rows);
  } else {
    console.log('  (no rows returned)');
  }
  console.log(`\n  ${res.rowCount} row(s)`);
}

// ─── Quests ─────────────────────────────────────────────────────────────────────

async function quests(questType) {
  const q = questType
    ? `SELECT qd.id, qd.name, qd.quest_type, qd.is_active, qd.chain_id, qd.chain_step,
         (SELECT COUNT(*) FROM quest_objectives qo WHERE qo.quest_id = qd.id) as objectives,
         (SELECT COUNT(*) FROM quest_prerequisites qp WHERE qp.quest_id = qd.id) as prereqs,
         (SELECT COUNT(*) FROM quest_rewards qr WHERE qr.quest_id = qd.id) as rewards,
         (SELECT string_agg(n.name, ', ') FROM quest_npc_givers qng JOIN npcs n ON n.id = qng.npc_id WHERE qng.quest_id = qd.id) as npcs
       FROM quest_definitions qd WHERE qd.quest_type = $1 ORDER BY qd.sort_order, qd.id`
    : `SELECT qd.id, qd.name, qd.quest_type, qd.is_active, qd.chain_id, qd.chain_step,
         (SELECT COUNT(*) FROM quest_objectives qo WHERE qo.quest_id = qd.id) as objectives,
         (SELECT COUNT(*) FROM quest_prerequisites qp WHERE qp.quest_id = qd.id) as prereqs,
         (SELECT COUNT(*) FROM quest_rewards qr WHERE qr.quest_id = qd.id) as rewards,
         (SELECT string_agg(n.name, ', ') FROM quest_npc_givers qng JOIN npcs n ON n.id = qng.npc_id WHERE qng.quest_id = qd.id) as npcs
       FROM quest_definitions qd ORDER BY qd.quest_type, qd.sort_order, qd.id`;
  const params = questType ? [questType] : [];
  const res = await pool.query(q, params);
  section(questType ? `Quests — ${questType}` : 'All Quests');
  table(res.rows);

  if (!questType) {
    console.log('\nTip: filter by type with: game-data quests <type>');
    console.log('Types: main, side, daily, weekly, monthly, repeatable');
  }
}

async function questDetail(id) {
  const res = await pool.query('SELECT * FROM quest_definitions WHERE id = $1', [id]);
  if (!res.rows.length) { console.log(`Quest #${id} not found`); return; }
  const quest = res.rows[0];

  section(`Quest #${quest.id}: ${quest.name}`);
  console.log(`  Type: ${quest.quest_type}  |  Active: ${quest.is_active}  |  Chain: ${quest.chain_id || '—'} step ${quest.chain_step ?? '—'}`);
  console.log(`  Description: ${quest.description}`);

  // Objectives
  section('Objectives');
  const objs = await pool.query(
    `SELECT qo.id, qo.objective_type, qo.target_id, qo.target_quantity, qo.target_duration, qo.description
     FROM quest_objectives qo WHERE qo.quest_id = $1 ORDER BY qo.sort_order, qo.id`, [id]);
  for (const obj of objs.rows) {
    let targetName = '';
    if (obj.target_id) {
      if (obj.objective_type === 'kill_monster') {
        const m = await pool.query('SELECT name FROM monsters WHERE id = $1', [obj.target_id]);
        targetName = m.rows[0]?.name || `monster#${obj.target_id}`;
      } else if (obj.objective_type === 'collect_item' || obj.objective_type === 'craft_item') {
        const i = await pool.query('SELECT name FROM item_definitions WHERE id = $1', [obj.target_id]);
        targetName = i.rows[0]?.name || `item#${obj.target_id}`;
      } else if (obj.objective_type === 'talk_to_npc') {
        const n = await pool.query('SELECT name FROM npcs WHERE id = $1', [obj.target_id]);
        targetName = n.rows[0]?.name || `npc#${obj.target_id}`;
      } else if (obj.objective_type === 'visit_location') {
        const z = await pool.query('SELECT name FROM map_zones WHERE id = $1', [obj.target_id]);
        targetName = z.rows[0]?.name || `zone#${obj.target_id}`;
      } else if (obj.objective_type === 'gather_resource') {
        const b = await pool.query('SELECT name FROM buildings WHERE id = $1', [obj.target_id]);
        targetName = b.rows[0]?.name || `building#${obj.target_id}`;
      }
    }
    const dur = obj.target_duration ? ` (${obj.target_duration}s)` : '';
    const desc = obj.description ? ` — "${obj.description}"` : '';
    console.log(`  [${obj.objective_type}] ${targetName || '—'} x${obj.target_quantity}${dur}${desc}`);
  }

  // Prerequisites
  section('Prerequisites');
  const prereqs = await pool.query(
    'SELECT * FROM quest_prerequisites WHERE quest_id = $1 ORDER BY id', [id]);
  if (!prereqs.rows.length) {
    console.log('  (none)');
  } else {
    for (const p of prereqs.rows) {
      let desc = '';
      switch (p.prereq_type) {
        case 'min_level': desc = `Level >= ${p.target_value}`; break;
        case 'has_item': {
          const i = await pool.query('SELECT name FROM item_definitions WHERE id = $1', [p.target_id]);
          desc = `Have ${p.target_value}x ${i.rows[0]?.name || `item#${p.target_id}`}`; break;
        }
        case 'completed_quest': {
          const q = await pool.query('SELECT name FROM quest_definitions WHERE id = $1', [p.target_id]);
          desc = `Complete "${q.rows[0]?.name || `quest#${p.target_id}`}"`; break;
        }
        case 'class_required': desc = `Class ID = ${p.target_id}`; break;
        default: desc = `${p.prereq_type} target=${p.target_id} value=${p.target_value}`;
      }
      console.log(`  [${p.prereq_type}] ${desc}`);
    }
  }

  // Rewards
  section('Rewards');
  const rewards = await pool.query(
    'SELECT * FROM quest_rewards WHERE quest_id = $1 ORDER BY id', [id]);
  if (!rewards.rows.length) {
    console.log('  (none)');
  } else {
    for (const r of rewards.rows) {
      let desc = '';
      switch (r.reward_type) {
        case 'item': {
          const i = await pool.query('SELECT name FROM item_definitions WHERE id = $1', [r.target_id]);
          desc = `${r.quantity}x ${i.rows[0]?.name || `item#${r.target_id}`}`; break;
        }
        case 'xp': desc = `${r.quantity} XP`; break;
        case 'crowns': desc = `${r.quantity} Crowns`; break;
        default: desc = `${r.reward_type} x${r.quantity}`;
      }
      console.log(`  [${r.reward_type}] ${desc}`);
    }
  }

  // NPC Givers
  section('NPC Givers');
  const givers = await pool.query(
    `SELECT n.id, n.name FROM quest_npc_givers qng JOIN npcs n ON n.id = qng.npc_id WHERE qng.quest_id = $1 ORDER BY n.name`, [id]);
  if (!givers.rows.length) {
    console.log('  (none — quest has no NPC givers assigned)');
  } else {
    table(givers.rows);
  }

  // Player stats
  section('Player Stats');
  const stats = await pool.query(
    `SELECT status, COUNT(*) as count FROM character_quests WHERE quest_id = $1 GROUP BY status`, [id]);
  if (stats.rows.length) {
    table(stats.rows);
  } else {
    console.log('  (no players have interacted with this quest)');
  }
}

// ─── Disassembly ──────────────────────────────────────────────────────────────

async function disassembly(itemDefId) {
  const where = itemDefId ? 'WHERE r.item_def_id = $1' : '';
  const params = itemDefId ? [Number(itemDefId)] : [];

  const { rows } = await pool.query(`
    SELECT r.id AS recipe_id, r.item_def_id, d.name AS item_name,
           r.chance_percent, r.sort_order,
           o.output_item_def_id, od.name AS output_name, o.quantity,
           d.disassembly_cost
    FROM disassembly_recipes r
    JOIN item_definitions d ON d.id = r.item_def_id
    JOIN disassembly_recipe_outputs o ON o.recipe_id = r.id
    JOIN item_definitions od ON od.id = o.output_item_def_id
    ${where}
    ORDER BY r.item_def_id, r.sort_order, r.id, o.id
  `, params);

  if (rows.length === 0) {
    console.log(itemDefId ? `No disassembly recipes for item ${itemDefId}.` : 'No disassembly recipes configured.');
    return;
  }

  // Group by item
  const byItem = new Map();
  for (const row of rows) {
    const key = row.item_def_id;
    if (!byItem.has(key)) byItem.set(key, { name: row.item_name, cost: row.disassembly_cost, recipes: new Map() });
    const item = byItem.get(key);
    if (!item.recipes.has(row.recipe_id)) item.recipes.set(row.recipe_id, { chance: row.chance_percent, outputs: [] });
    item.recipes.get(row.recipe_id).outputs.push({ name: row.output_name, qty: row.quantity });
  }

  for (const [id, item] of byItem) {
    section(`${item.name} (id:${id}) — cost: ${item.cost} crowns`);
    for (const [, recipe] of item.recipes) {
      const outputs = recipe.outputs.map(o => `${o.qty}x ${o.name}`).join(', ');
      console.log(`  ${recipe.chance}% → ${outputs}`);
    }
  }
}

// ─── Bosses ───────────────────────────────────────────────────────────────────

async function bosses() {
  section('All Bosses');
  const result = await pool.query(`
    SELECT b.id, b.name, b.max_hp, b.attack, b.defense, b.xp_reward, b.min_crowns, b.max_crowns,
           b.respawn_min_seconds, b.respawn_max_seconds, b.is_active,
           bld.name AS building_name,
           (SELECT COUNT(*) FROM boss_abilities ba WHERE ba.boss_id = b.id) AS ability_count,
           (SELECT COUNT(*) FROM boss_loot bl WHERE bl.boss_id = b.id) AS loot_count
    FROM bosses b
    LEFT JOIN buildings bld ON bld.id = b.building_id
    ORDER BY b.id
  `);
  table(result.rows);

  for (const boss of result.rows) {
    // Abilities
    const abilities = await pool.query(`
      SELECT a.name, a.effect_type, a.effect_value, a.cooldown_turns, ba.priority
      FROM boss_abilities ba
      JOIN abilities a ON a.id = ba.ability_id
      WHERE ba.boss_id = $1
      ORDER BY ba.priority DESC
    `, [boss.id]);
    if (abilities.rows.length) {
      console.log(`\n  ${boss.name} Abilities:`);
      table(abilities.rows);
    }

    // Loot
    const loot = await pool.query(`
      SELECT i.name AS item, bl.drop_chance, bl.quantity
      FROM boss_loot bl
      JOIN item_definitions i ON i.id = bl.item_def_id
      WHERE bl.boss_id = $1
      ORDER BY bl.drop_chance DESC
    `, [boss.id]);
    if (loot.rows.length) {
      console.log(`  ${boss.name} Loot: ${loot.rows.map(l => `${l.item} (${l.drop_chance}%, x${l.quantity})`).join(', ')}`);
    }
  }
}

async function bossInstances() {
  section('Live Boss Instances');
  const result = await pool.query(`
    SELECT bi.id, b.name AS boss_name, bld.name AS building_name,
           bi.current_hp, b.max_hp, bi.status,
           c.name AS fighting_character,
           bi.total_attempts, bi.spawned_at, bi.defeated_at, bi.respawn_at
    FROM boss_instances bi
    JOIN bosses b ON b.id = bi.boss_id
    LEFT JOIN buildings bld ON bld.id = b.building_id
    LEFT JOIN characters c ON c.id = bi.fighting_character_id
    ORDER BY bi.spawned_at DESC
  `);
  table(result.rows);
}

async function arenas() {
  section('All Arenas');
  const result = await pool.query(`
    SELECT a.id, a.name, bld.name AS building, a.min_stay_seconds, a.reentry_cooldown_seconds,
           a.winner_xp, a.loser_xp, a.winner_crowns, a.loser_crowns,
           a.level_bracket, a.is_active,
           (SELECT COUNT(*) FROM arena_monsters am WHERE am.arena_id = a.id) AS monster_count,
           (SELECT COUNT(*) FROM arena_participants ap WHERE ap.arena_id = a.id) AS participant_count
    FROM arenas a
    LEFT JOIN buildings bld ON bld.id = a.building_id
    ORDER BY a.id
  `);
  table(result.rows);
}

async function arenaDetail(id) {
  if (!id) { console.error('Usage: game-data arena <id>'); process.exit(1); }
  const res = await pool.query(`
    SELECT a.id, a.name, bld.name AS building, a.building_id,
           a.min_stay_seconds, a.reentry_cooldown_seconds,
           a.winner_xp, a.loser_xp, a.winner_crowns, a.loser_crowns,
           a.level_bracket, a.is_active
    FROM arenas a
    LEFT JOIN buildings bld ON bld.id = a.building_id
    WHERE a.id = $1
  `, [id]);
  if (!res.rows.length) { console.error(`Arena ${id} not found`); process.exit(1); }
  const arena = res.rows[0];
  section(`Arena: ${arena.name} (id ${arena.id})`);
  table([arena]);

  // Assigned monsters
  const monsters = await pool.query(`
    SELECT m.id, m.name, m.attack, m.defense, m.hp, m.xp_reward, am.sort_order
    FROM arena_monsters am
    JOIN monsters m ON m.id = am.monster_id
    WHERE am.arena_id = $1
    ORDER BY am.sort_order, m.id
  `, [id]);
  if (monsters.rows.length) {
    console.log(`\n  Assigned Monsters:`);
    table(monsters.rows);
  } else {
    console.log(`\n  (no monsters assigned)`);
  }

  // Current participants
  const participants = await pool.query(`
    SELECT c.name, c.level, c.class_id, ap.current_hp, ap.in_combat, ap.entered_at, ap.can_leave_at
    FROM arena_participants ap
    JOIN characters c ON c.id = ap.character_id
    WHERE ap.arena_id = $1
    ORDER BY ap.entered_at
  `, [id]);
  if (participants.rows.length) {
    console.log(`\n  Current Participants:`);
    table(participants.rows);
  } else {
    console.log(`\n  (no participants)`);
  }
}

async function statTraining() {
  section('Stat Training Items');
  const res = await pool.query(`
    SELECT st.id, d.name AS item_name, st.stat_name, st.tier, st.base_chance, st.decay_per_level, n.name AS npc_name
    FROM stat_training_items st
    JOIN item_definitions d ON d.id = st.item_def_id
    JOIN npcs n ON n.id = st.npc_id
    ORDER BY st.stat_name, st.tier
  `);
  table(res.rows, ['id', 'item_name', 'stat_name', 'tier', 'base_chance', 'decay_per_level', 'npc_name']);
}

async function fatigueConfig() {
  section('Fatigue Configuration');
  const res = await pool.query(`
    SELECT combat_type, start_round, base_damage, damage_increment, updated_at
    FROM fatigue_config
    ORDER BY combat_type
  `);
  table(res.rows, ['combat_type', 'start_round', 'base_damage', 'damage_increment', 'updated_at']);
}

async function characterStats(name) {
  if (!name) { console.error('Usage: character-stats <name>'); return; }
  const res = await pool.query(`
    SELECT c.name, c.level, c.experience,
      c.attr_constitution, c.attr_strength, c.attr_intelligence, c.attr_dexterity, c.attr_toughness,
      c.stat_points_unspent, c.max_hp, c.attack_power, c.defence,
      cc.name as class_name, cc.base_hp, cc.base_attack, cc.base_defence
    FROM characters c
    JOIN character_classes cc ON cc.id = c.class_id
    WHERE LOWER(c.name) = LOWER($1)
  `, [name]);
  if (!res.rows.length) { console.log(`Character '${name}' not found.`); return; }
  const c = res.rows[0];
  section(`Character: ${c.name} (${c.class_name} Lv.${c.level})`);
  console.log(`  Unspent Points: ${c.stat_points_unspent}`);
  console.log(`  CON: ${c.attr_constitution}  STR: ${c.attr_strength}  INT: ${c.attr_intelligence}  DEX: ${c.attr_dexterity}  TOU: ${c.attr_toughness}`);
  console.log(`  Derived → HP: ${c.base_hp + c.attr_constitution * 4}  ATK: ${c.base_attack + c.attr_constitution + c.attr_strength * 2}  DEF: ${c.base_defence + c.attr_toughness}`);
  console.log(`  DB columns → max_hp: ${c.max_hp}  attack_power: ${c.attack_power}  defence: ${c.defence}`);
}

// ─── Ability Levels ──────────────────────────────────────────────────────────

async function abilityLevels(abilityId) {
  const q = abilityId
    ? `SELECT al.*, a.name AS ability_name FROM ability_levels al JOIN abilities a ON a.id = al.ability_id WHERE al.ability_id = $1 ORDER BY al.level`
    : `SELECT al.*, a.name AS ability_name FROM ability_levels al JOIN abilities a ON a.id = al.ability_id ORDER BY a.name, al.level`;
  const params = abilityId ? [abilityId] : [];
  const res = await pool.query(q, params);
  section(abilityId ? `Ability Levels for Ability #${abilityId}` : 'All Ability Levels');
  table(res.rows, ['ability_name', 'level', 'effect_value', 'mana_cost', 'duration_turns', 'cooldown_turns']);
}

// ─── Ability Progress ────────────────────────────────────────────────────────

async function abilityProgress(characterId) {
  const q = characterId
    ? `SELECT cap.*, a.name AS ability_name, c.name AS character_name FROM character_ability_progress cap JOIN abilities a ON a.id = cap.ability_id JOIN characters c ON c.id = cap.character_id WHERE cap.character_id = $1 ORDER BY a.name`
    : `SELECT cap.*, a.name AS ability_name, c.name AS character_name FROM character_ability_progress cap JOIN abilities a ON a.id = cap.ability_id JOIN characters c ON c.id = cap.character_id ORDER BY c.name, a.name`;
  const params = characterId ? [characterId] : [];
  const res = await pool.query(q, params);
  section(characterId ? `Ability Progress for Character #${characterId}` : 'All Character Ability Progress');
  table(res.rows, ['character_name', 'ability_name', 'current_level', 'current_points', 'last_book_used_at']);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const HELP = `
Usage: node scripts/game-data.js <command> [args...]

Commands:
  overview                 High-level game stats
  items [category]         List items (optional: resource|food|heal|weapon|boots|shield|greaves|bracer|tool|helmet|chestplate)
  item <id>                Item detail with drop sources, recipe usage
  monsters                 List all monsters with loot summaries
  monster <id>             Monster detail with full loot table and zone appearances
  maps                     List all zones
  zone <id>                Full zone breakdown (buildings, actions, NPCs, encounters)
  npcs                     List all NPCs with locations
  recipes [npc_id]         Crafting recipes (optional: filter by NPC)
  abilities                List all abilities with monster drop sources
  quests [type]            List quests (optional: main|side|daily|weekly|monthly|repeatable)
  quest <id>               Quest detail with objectives, prerequisites, rewards, NPC givers
  gathering                All gathering actions with events, tool requirements, and tool items
  arenas                   List all arenas with rewards, brackets, and participant/monster counts
  arena <id>               Arena detail with assigned monsters and current participants
  bosses                   List all boss definitions with abilities and loot
  boss-instances           Live boss instances with HP, status, and respawn timers
  disassembly [item_id]    Disassembly recipes with chance entries and outputs
  economy                  Crown sources/sinks, equipment stats, expedition rewards
  stat-training            Stat training item mappings with tiers and success rates
  fatigue-config           Fatigue settings per combat type (start round, base damage, increment)
  ability-levels [id]      Ability level scaling (optional: filter by ability ID)
  ability-progress [id]    Character ability progress (optional: filter by character ID)
  character-stats <name>   Character attributes, unspent points, derived stats
  search <term>            Search across all entity types by name
  sql "<query>"            Run a raw SELECT query
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (cmd) {
      case 'overview':  await overview(); break;
      case 'items':     await items(args[0]); break;
      case 'item':      await itemDetail(args[0]); break;
      case 'monsters':  await monsters(); break;
      case 'monster':   await monsterDetail(args[0]); break;
      case 'maps':      await maps(); break;
      case 'zone':      await zoneDetail(args[0]); break;
      case 'npcs':      await npcs(); break;
      case 'recipes':   await recipes(args[0]); break;
      case 'abilities': await abilities(); break;
      case 'quests':    await quests(args[0]); break;
      case 'quest':     await questDetail(args[0]); break;
      case 'gathering':    await gathering(); break;
      case 'disassembly': await disassembly(args[0]); break;
      case 'economy':     await economy(); break;
      case 'character-stats': await characterStats(args.join(' ')); break;
      case 'search':    await search(args.join(' ')); break;
      case 'arenas':       await arenas(); break;
      case 'arena':        await arenaDetail(args[0]); break;
      case 'bosses':       await bosses(); break;
      case 'boss-instances': await bossInstances(); break;
      case 'stat-training':  await statTraining(); break;
      case 'fatigue-config': await fatigueConfig(); break;
      case 'ability-levels':   await abilityLevels(args[0]); break;
      case 'ability-progress': await abilityProgress(args[0]); break;
      case 'sql':       await rawSql(args.join(' ')); break;
      default:
        console.error(`Unknown command: ${cmd}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('Could not connect to PostgreSQL. Is the database running?');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
