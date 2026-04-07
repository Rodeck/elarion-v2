#!/usr/bin/env node
// game-entities.js — Create game entities via the admin REST API
// Usage: node scripts/game-entities.js <command> '<json-data>'

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon', 'boots', 'shield',
  'greaves', 'bracer', 'tool', 'helmet', 'chestplate',
  'ring', 'amulet', 'skill_book',
];
const VALID_WEAPON_SUBTYPES = ['one_handed', 'two_handed', 'dagger', 'wand', 'staff', 'bow'];
const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food', 'skill_book']);
const DEFENCE_CATEGORIES = new Set(['boots', 'shield', 'greaves', 'bracer', 'helmet', 'chestplate', 'ring', 'amulet']);
const VALID_EFFECT_TYPES = ['damage', 'heal', 'buff', 'debuff', 'dot', 'reflect', 'drain'];
const VALID_SLOT_TYPES = ['auto', 'active', 'both'];
const VALID_ACTION_TYPES = ['travel', 'explore', 'expedition', 'gather', 'fishing', 'arena', 'warehouse'];
const VALID_TOOL_TYPES = ['pickaxe', 'axe', 'fishing_rod', 'kiln'];
const VALID_GATHER_EVENT_TYPES = ['resource', 'gold', 'monster', 'accident', 'nothing', 'squire'];

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.ADMIN_API_URL || 'http://localhost:4001';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456789';

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

function httpRequest(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
    };

    let bodyData = null;
    if (body !== null && body !== undefined) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        bodyData = body;
      } else {
        bodyData = JSON.stringify(body);
        if (!opts.headers['Content-Type']) {
          opts.headers['Content-Type'] = 'application/json';
        }
      }
      opts.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function authenticate() {
  const res = await httpRequest('POST', `${BASE_URL}/login`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Authentication failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data.token;
}

async function apiPost(path, body, token) {
  const res = await httpRequest('POST', `${BASE_URL}${path}`, body, {
    Authorization: `Bearer ${token}`,
  });
  return res;
}

async function apiPut(path, body, token) {
  const res = await httpRequest('PUT', `${BASE_URL}${path}`, body, {
    Authorization: `Bearer ${token}`,
  });
  return res;
}

async function apiDelete(path, token) {
  const res = await httpRequest('DELETE', `${BASE_URL}${path}`, null, {
    Authorization: `Bearer ${token}`,
  });
  return res;
}

async function apiPostMultipart(apiPath, filePath, fieldName, token) {
  const boundary = '----FormBoundary' + Date.now().toString(36);
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  const res = await httpRequest('POST', `${BASE_URL}${apiPath}`, body, {
    Authorization: `Bearer ${token}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  });
  return res;
}

// ─── Output ───────────────────────────────────────────────────────────────────

function output(command, success, dataOrErrors) {
  if (success) {
    console.log(JSON.stringify({ success: true, command, data: dataOrErrors }, null, 2));
  } else {
    console.log(JSON.stringify({ success: false, command, errors: dataOrErrors }, null, 2));
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────

function validateItem(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  else if (data.name.trim().length > 64) errors.push('name must be 64 characters or fewer');
  if (!data.category) errors.push('category is required');
  else if (!VALID_CATEGORIES.includes(data.category)) errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);

  if (data.category) {
    if (data.category === 'weapon') {
      if (!data.weapon_subtype) errors.push('weapon_subtype is required for weapons');
      else if (!VALID_WEAPON_SUBTYPES.includes(data.weapon_subtype)) errors.push(`weapon_subtype must be one of: ${VALID_WEAPON_SUBTYPES.join(', ')}`);
    } else {
      if (data.weapon_subtype) errors.push('weapon_subtype is only allowed for weapons');
    }

    if (data.attack != null && data.category !== 'weapon') errors.push('attack is only allowed for weapons');
    if (data.attack != null && (!Number.isInteger(data.attack) || data.attack < 0)) errors.push('attack must be a non-negative integer');

    if (data.defence != null && !DEFENCE_CATEGORIES.has(data.category)) errors.push(`defence is only allowed for: ${[...DEFENCE_CATEGORIES].join(', ')}`);
    if (data.defence != null && (!Number.isInteger(data.defence) || data.defence < 0)) errors.push('defence must be a non-negative integer');

    if (data.heal_power != null && data.category !== 'heal') errors.push('heal_power is only allowed for heal items');
    if (data.heal_power != null && (!Number.isInteger(data.heal_power) || data.heal_power < 0)) errors.push('heal_power must be a non-negative integer');

    if (data.food_power != null && data.category !== 'food') errors.push('food_power is only allowed for food items');
    if (data.food_power != null && (!Number.isInteger(data.food_power) || data.food_power < 0)) errors.push('food_power must be a non-negative integer');

    if (data.crit_chance != null && (!Number.isInteger(data.crit_chance) || data.crit_chance < 0 || data.crit_chance > 100)) errors.push('crit_chance must be an integer 0–100');
    if (data.armor_penetration != null && (!Number.isInteger(data.armor_penetration) || data.armor_penetration < 0 || data.armor_penetration > 100)) errors.push('armor_penetration must be an integer 0–100');
    if (data.additional_attacks != null && (!Number.isInteger(data.additional_attacks) || data.additional_attacks < 0 || data.additional_attacks > 10)) errors.push('additional_attacks must be an integer 0–10');

    if (data.max_mana != null && (!Number.isInteger(data.max_mana) || data.max_mana < 0)) errors.push('max_mana must be a non-negative integer');
    if (data.mana_on_hit != null && (!Number.isInteger(data.mana_on_hit) || data.mana_on_hit < 0)) errors.push('mana_on_hit must be a non-negative integer');
    if (data.mana_on_damage_taken != null && (!Number.isInteger(data.mana_on_damage_taken) || data.mana_on_damage_taken < 0)) errors.push('mana_on_damage_taken must be a non-negative integer');
    if (data.mana_regen != null && (!Number.isInteger(data.mana_regen) || data.mana_regen < 0)) errors.push('mana_regen must be a non-negative integer');
    if (data.dodge_chance != null && (!Number.isInteger(data.dodge_chance) || data.dodge_chance < 0 || data.dodge_chance > 100)) errors.push('dodge_chance must be an integer 0–100');

    if (data.category === 'skill_book') {
      if (data.ability_id == null) errors.push('ability_id is required for skill_book items');
      else if (!Number.isInteger(data.ability_id) || data.ability_id < 1) errors.push('ability_id must be a positive integer');
      if (data.attack != null) errors.push('attack is not allowed for skill_book items');
      if (data.defence != null) errors.push('defence is not allowed for skill_book items');
      if (data.tool_type != null) errors.push('tool_type is not allowed for skill_book items');
    } else {
      if (data.ability_id != null) errors.push('ability_id is only allowed for skill_book items');
    }

    if (STACKABLE_CATEGORIES.has(data.category)) {
      if (data.stack_size == null) errors.push(`stack_size is required for ${data.category} items`);
      else if (!Number.isInteger(data.stack_size) || data.stack_size < 1) errors.push('stack_size must be a positive integer');
    } else {
      if (data.stack_size != null) errors.push(`stack_size is not allowed for ${data.category} items`);
    }
  }

  return errors;
}

function validateMonster(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (data.attack == null || !Number.isInteger(data.attack) || data.attack < 0) errors.push('attack must be a non-negative integer');
  if (data.defense == null || !Number.isInteger(data.defense) || data.defense < 0) errors.push('defense must be a non-negative integer');
  if (data.hp == null || !Number.isInteger(data.hp) || data.hp < 1) errors.push('hp must be a positive integer');
  if (data.xp_reward == null || !Number.isInteger(data.xp_reward) || data.xp_reward < 0) errors.push('xp_reward must be a non-negative integer');

  const minCrowns = data.min_crowns ?? 0;
  const maxCrowns = data.max_crowns ?? 0;
  if (!Number.isInteger(minCrowns) || minCrowns < 0) errors.push('min_crowns must be a non-negative integer');
  if (!Number.isInteger(maxCrowns) || maxCrowns < 0) errors.push('max_crowns must be a non-negative integer');
  if (minCrowns > maxCrowns) errors.push('min_crowns must be <= max_crowns');

  return errors;
}

function validateMonsterLoot(data) {
  const errors = [];
  if (!data.monster_id || !Number.isInteger(data.monster_id) || data.monster_id < 1) errors.push('monster_id must be a positive integer');
  const hasItemId = data.item_def_id != null;
  const hasCategory = typeof data.item_category === 'string' && data.item_category.length > 0;
  if (hasItemId === hasCategory) errors.push('Provide exactly one of item_def_id or item_category');
  if (hasItemId && (!Number.isInteger(data.item_def_id) || data.item_def_id < 1)) errors.push('item_def_id must be a positive integer');
  if (!data.drop_chance || !Number.isInteger(data.drop_chance) || data.drop_chance < 1 || data.drop_chance > 100) errors.push('drop_chance must be 1–100');
  const qty = data.quantity ?? 1;
  if (!Number.isInteger(qty) || qty < 1) errors.push('quantity must be a positive integer');
  return errors;
}

function validateNpc(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (!data.description || typeof data.description !== 'string' || !data.description.trim()) errors.push('description is required');
  if (!data.icon_filename || typeof data.icon_filename !== 'string' || !data.icon_filename.trim()) errors.push('icon_filename is required (upload icon first with upload-npc-icon)');
  return errors;
}

function validateRecipe(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (data.npc_id == null || !Number.isInteger(data.npc_id)) errors.push('npc_id is required (integer)');
  if (data.output_item_id == null || !Number.isInteger(data.output_item_id)) errors.push('output_item_id is required (integer)');
  if (data.output_quantity == null || !Number.isInteger(data.output_quantity) || data.output_quantity < 1) errors.push('output_quantity must be a positive integer');
  if (data.cost_crowns == null || !Number.isInteger(data.cost_crowns) || data.cost_crowns < 0) errors.push('cost_crowns must be a non-negative integer');
  if (data.craft_time_seconds == null || !Number.isInteger(data.craft_time_seconds) || data.craft_time_seconds < 0) errors.push('craft_time_seconds must be a non-negative integer');

  if (data.ingredients !== undefined) {
    if (!Array.isArray(data.ingredients)) {
      errors.push('ingredients must be an array');
    } else {
      for (let i = 0; i < data.ingredients.length; i++) {
        const ing = data.ingredients[i];
        if (!ing.item_def_id || !Number.isInteger(ing.item_def_id) || ing.item_def_id < 1) {
          errors.push(`ingredients[${i}].item_def_id must be a positive integer`);
        }
        if (!ing.quantity || !Number.isInteger(ing.quantity) || ing.quantity < 1) {
          errors.push(`ingredients[${i}].quantity must be a positive integer`);
        }
      }
    }
  }

  return errors;
}

function validateBuildingAction(data) {
  const errors = [];
  if (data.zone_id == null || !Number.isInteger(data.zone_id)) errors.push('zone_id is required (integer)');
  if (data.building_id == null || !Number.isInteger(data.building_id)) errors.push('building_id is required (integer)');
  if (!data.action_type || !VALID_ACTION_TYPES.includes(data.action_type)) {
    errors.push(`action_type must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
  }

  if (data.config == null || typeof data.config !== 'object') {
    errors.push('config object is required');
  } else if (data.action_type === 'travel') {
    if (!Number.isInteger(data.config.target_zone_id)) errors.push('config.target_zone_id must be an integer');
    if (!Number.isInteger(data.config.target_node_id)) errors.push('config.target_node_id must be an integer');
  } else if (data.action_type === 'explore') {
    const chance = data.config.encounter_chance;
    if (!Number.isInteger(chance) || chance < 0 || chance > 100) errors.push('config.encounter_chance must be 0–100');
    if (chance > 0) {
      if (!Array.isArray(data.config.monsters) || data.config.monsters.length === 0) {
        errors.push('config.monsters array is required when encounter_chance > 0');
      } else {
        for (let i = 0; i < data.config.monsters.length; i++) {
          const m = data.config.monsters[i];
          if (!Number.isInteger(m.monster_id) || m.monster_id < 1) errors.push(`config.monsters[${i}].monster_id must be a positive integer`);
          if (!Number.isInteger(m.weight) || m.weight < 1) errors.push(`config.monsters[${i}].weight must be a positive integer`);
        }
      }
    }
  } else if (data.action_type === 'expedition') {
    if (!Number.isInteger(data.config.base_gold) || data.config.base_gold < 0) errors.push('config.base_gold must be a non-negative integer');
    if (!Number.isInteger(data.config.base_exp) || data.config.base_exp < 0) errors.push('config.base_exp must be a non-negative integer');
    if (data.config.items && Array.isArray(data.config.items)) {
      for (let i = 0; i < data.config.items.length; i++) {
        const it = data.config.items[i];
        if (!Number.isInteger(it.item_def_id) || it.item_def_id < 1) errors.push(`config.items[${i}].item_def_id must be a positive integer`);
        if (!Number.isInteger(it.base_quantity) || it.base_quantity < 1) errors.push(`config.items[${i}].base_quantity must be a positive integer`);
      }
    }
  } else if (data.action_type === 'gather') {
    if (!data.config.required_tool_type || !VALID_TOOL_TYPES.includes(data.config.required_tool_type)) {
      errors.push(`config.required_tool_type must be one of: ${VALID_TOOL_TYPES.join(', ')}`);
    }
    if (!Number.isInteger(data.config.durability_per_second) || data.config.durability_per_second < 1) {
      errors.push('config.durability_per_second must be a positive integer');
    }
    if (!Number.isInteger(data.config.min_seconds) || data.config.min_seconds < 1) {
      errors.push('config.min_seconds must be a positive integer');
    }
    if (!Number.isInteger(data.config.max_seconds) || data.config.max_seconds < 1) {
      errors.push('config.max_seconds must be a positive integer');
    }
    if (data.config.min_seconds > data.config.max_seconds) {
      errors.push('config.min_seconds must be <= config.max_seconds');
    }
    if (!Array.isArray(data.config.events) || data.config.events.length === 0) {
      errors.push('config.events array is required and must not be empty');
    } else {
      for (let i = 0; i < data.config.events.length; i++) {
        const ev = data.config.events[i];
        if (!ev.type || !VALID_GATHER_EVENT_TYPES.includes(ev.type)) {
          errors.push(`config.events[${i}].type must be one of: ${VALID_GATHER_EVENT_TYPES.join(', ')}`);
        }
        if (!Number.isInteger(ev.weight) || ev.weight < 1) {
          errors.push(`config.events[${i}].weight must be a positive integer`);
        }
        if (ev.type === 'resource') {
          if (!Number.isInteger(ev.item_def_id) || ev.item_def_id < 1) errors.push(`config.events[${i}].item_def_id must be a positive integer`);
          if (!Number.isInteger(ev.quantity) || ev.quantity < 1) errors.push(`config.events[${i}].quantity must be a positive integer`);
        } else if (ev.type === 'gold') {
          if (!Number.isInteger(ev.min_amount) || ev.min_amount < 0) errors.push(`config.events[${i}].min_amount must be a non-negative integer`);
          if (!Number.isInteger(ev.max_amount) || ev.max_amount < 1) errors.push(`config.events[${i}].max_amount must be a positive integer`);
          if (ev.min_amount > ev.max_amount) errors.push(`config.events[${i}].min_amount must be <= max_amount`);
        } else if (ev.type === 'monster') {
          if (!Number.isInteger(ev.monster_id) || ev.monster_id < 1) errors.push(`config.events[${i}].monster_id must be a positive integer`);
        } else if (ev.type === 'accident') {
          if (!Number.isInteger(ev.hp_damage) || ev.hp_damage < 1) errors.push(`config.events[${i}].hp_damage must be a positive integer`);
        } else if (ev.type === 'squire') {
          if (!Number.isInteger(ev.squire_def_id) || ev.squire_def_id < 1) errors.push(`config.events[${i}].squire_def_id must be a positive integer`);
          const sqLvl = ev.squire_level ?? 1;
          if (!Number.isInteger(sqLvl) || sqLvl < 1 || sqLvl > 20) errors.push(`config.events[${i}].squire_level must be 1–20`);
        }
      }
    }
  } else if (data.action_type === 'arena') {
    if (!Number.isInteger(data.config.arena_id) || data.config.arena_id < 1) {
      errors.push('config.arena_id must be a positive integer');
    }
  }

  return errors;
}

function validateBuildingNpc(data) {
  const errors = [];
  if (data.zone_id == null || !Number.isInteger(data.zone_id)) errors.push('zone_id is required (integer)');
  if (data.building_id == null || !Number.isInteger(data.building_id)) errors.push('building_id is required (integer)');
  if (data.npc_id == null || !Number.isInteger(data.npc_id)) errors.push('npc_id is required (integer)');
  return errors;
}

function validateAbility(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (!data.effect_type || !VALID_EFFECT_TYPES.includes(data.effect_type)) {
    errors.push(`effect_type must be one of: ${VALID_EFFECT_TYPES.join(', ')}`);
  }
  if (data.mana_cost == null || !Number.isInteger(data.mana_cost) || data.mana_cost < 0) errors.push('mana_cost must be a non-negative integer');
  if (data.effect_value == null || !Number.isInteger(data.effect_value) || data.effect_value < 0) errors.push('effect_value must be a non-negative integer');

  const slotType = data.slot_type ?? 'both';
  if (!VALID_SLOT_TYPES.includes(slotType)) errors.push(`slot_type must be one of: ${VALID_SLOT_TYPES.join(', ')}`);

  const priority = data.priority_default ?? 1;
  if (!Number.isInteger(priority) || priority < 1 || priority > 99) errors.push('priority_default must be 1–99');

  return errors;
}

function validateEncounterEntry(data) {
  const errors = [];
  if (data.zone_id == null || !Number.isInteger(data.zone_id) || data.zone_id < 1) errors.push('zone_id must be a positive integer');
  if (data.monster_id == null || !Number.isInteger(data.monster_id) || data.monster_id < 1) errors.push('monster_id must be a positive integer');
  if (data.weight == null || !Number.isInteger(data.weight) || data.weight < 1) errors.push('weight must be a positive integer');
  return errors;
}

function validateSquireDefinition(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (data.power_level == null || !Number.isInteger(data.power_level) || data.power_level < 0 || data.power_level > 100) {
    errors.push('power_level must be an integer 0–100');
  }
  return errors;
}

function validateMonsterSquireLoot(data) {
  const errors = [];
  if (!data.monster_id || !Number.isInteger(data.monster_id) || data.monster_id < 1) errors.push('monster_id must be a positive integer');
  if (!data.squire_def_id || !Number.isInteger(data.squire_def_id) || data.squire_def_id < 1) errors.push('squire_def_id must be a positive integer');
  if (!data.drop_chance || !Number.isInteger(data.drop_chance) || data.drop_chance < 1 || data.drop_chance > 100) errors.push('drop_chance must be 1–100');
  const lvl = data.squire_level ?? 1;
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > 20) errors.push('squire_level must be 1–20');
  return errors;
}

function validateSkillBook(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (data.description != null && typeof data.description !== 'string') errors.push('description must be a string');
  if (data.stack_size == null || !Number.isInteger(data.stack_size) || data.stack_size < 1) errors.push('stack_size must be a positive integer');
  if (data.ability_id == null || !Number.isInteger(data.ability_id) || data.ability_id < 1) errors.push('ability_id must be a positive integer');
  return errors;
}

function validateAbilityLevels(data) {
  const errors = [];
  if (data.ability_id == null || !Number.isInteger(data.ability_id) || data.ability_id < 1) errors.push('ability_id must be a positive integer');
  if (!Array.isArray(data.levels) || data.levels.length === 0) {
    errors.push('levels must be a non-empty array');
  } else {
    for (let i = 0; i < data.levels.length; i++) {
      const l = data.levels[i];
      if (!Number.isInteger(l.level) || l.level < 1 || l.level > 5) errors.push(`levels[${i}].level must be 1–5`);
      if (!Number.isInteger(l.effect_value) || l.effect_value < 0) errors.push(`levels[${i}].effect_value must be a non-negative integer`);
      if (!Number.isInteger(l.mana_cost) || l.mana_cost < 0) errors.push(`levels[${i}].mana_cost must be a non-negative integer`);
      if (!Number.isInteger(l.duration_turns) || l.duration_turns < 0) errors.push(`levels[${i}].duration_turns must be a non-negative integer`);
      if (!Number.isInteger(l.cooldown_turns) || l.cooldown_turns < 0) errors.push(`levels[${i}].cooldown_turns must be a non-negative integer`);
    }
  }
  return errors;
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

async function createItem(data) {
  const errors = validateItem(data);
  if (errors.length) return output('create-item', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/items', data, token);
  if (res.status === 201) {
    output('create-item', true, res.data);
  } else {
    output('create-item', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createMonsterCmd(data) {
  const errors = validateMonster(data);
  if (errors.length) return output('create-monster', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/monsters', data, token);
  if (res.status === 201) {
    output('create-monster', true, res.data);
  } else {
    output('create-monster', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createMonsterLootCmd(data) {
  const errors = validateMonsterLoot(data);
  if (errors.length) return output('create-monster-loot', false, errors);

  const token = await authenticate();
  const payload = { drop_chance: data.drop_chance, quantity: data.quantity ?? 1 };
  if (data.item_def_id != null) payload.item_def_id = data.item_def_id;
  if (data.item_category) payload.item_category = data.item_category;
  const res = await apiPost(`/api/monsters/${data.monster_id}/loot`, payload, token);
  if (res.status === 201) {
    output('create-monster-loot', true, res.data);
  } else {
    output('create-monster-loot', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createNpcCmd(data) {
  const errors = validateNpc(data);
  if (errors.length) return output('create-npc', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/npcs', data, token);
  if (res.status === 201) {
    output('create-npc', true, res.data);
  } else {
    output('create-npc', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function uploadNpcIconCmd(data) {
  if (!data.file_path) return output('upload-npc-icon', false, ['file_path is required (absolute path to PNG)']);
  if (!fs.existsSync(data.file_path)) return output('upload-npc-icon', false, [`File not found: ${data.file_path}`]);

  const token = await authenticate();
  const res = await apiPostMultipart('/api/npcs/upload', data.file_path, 'icon', token);
  if (res.status === 200) {
    output('upload-npc-icon', true, res.data);
  } else {
    output('upload-npc-icon', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function setNpcCrafterCmd(data) {
  if (data.npc_id == null || !Number.isInteger(data.npc_id)) return output('set-npc-crafter', false, ['npc_id is required (integer)']);
  if (typeof data.is_crafter !== 'boolean') return output('set-npc-crafter', false, ['is_crafter must be a boolean']);

  const token = await authenticate();
  const res = await apiPut(`/api/npcs/${data.npc_id}/crafter`, { is_crafter: data.is_crafter }, token);
  if (res.status === 200) {
    output('set-npc-crafter', true, res.data);
  } else {
    output('set-npc-crafter', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createRecipeCmd(data) {
  const errors = validateRecipe(data);
  if (errors.length) return output('create-recipe', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/recipes', data, token);
  if (res.status === 201) {
    output('create-recipe', true, res.data);
  } else {
    output('create-recipe', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createBuildingActionCmd(data) {
  const errors = validateBuildingAction(data);
  if (errors.length) return output('create-building-action', false, errors);

  const token = await authenticate();
  const res = await apiPost(
    `/api/maps/${data.zone_id}/buildings/${data.building_id}/actions`,
    { action_type: data.action_type, sort_order: data.sort_order ?? 0, config: data.config },
    token,
  );
  if (res.status === 201) {
    output('create-building-action', true, res.data);
  } else {
    output('create-building-action', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function assignBuildingNpcCmd(data) {
  const errors = validateBuildingNpc(data);
  if (errors.length) return output('assign-building-npc', false, errors);

  const token = await authenticate();
  const res = await apiPost(
    `/api/maps/${data.zone_id}/buildings/${data.building_id}/npcs`,
    { npc_id: data.npc_id },
    token,
  );
  if (res.status === 201) {
    output('assign-building-npc', true, res.data);
  } else {
    output('assign-building-npc', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createAbilityCmd(data) {
  const errors = validateAbility(data);
  if (errors.length) return output('create-ability', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/abilities', data, token);
  if (res.status === 201) {
    output('create-ability', true, res.data);
  } else {
    output('create-ability', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function setEncounterCmd(data) {
  const errors = validateEncounterEntry(data);
  if (errors.length) return output('set-encounter', false, errors);

  const token = await authenticate();
  const res = await apiPut(`/api/encounter-tables/${data.zone_id}`, {
    monster_id: data.monster_id,
    weight: data.weight,
  }, token);
  if (res.status === 200) {
    output('set-encounter', true, res.data);
  } else {
    output('set-encounter', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

// ─── Squire Commands ─────────────────────────────────────────────────────────

async function createSquireCmd(data) {
  const errors = validateSquireDefinition(data);
  if (errors.length) return output('create-squire', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/squire-definitions', data, token);
  if (res.status === 201) {
    output('create-squire', true, res.data);
  } else {
    output('create-squire', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function uploadSquireIconCmd(data) {
  if (!data.squire_def_id || !Number.isInteger(data.squire_def_id) || data.squire_def_id < 1) {
    return output('upload-squire-icon', false, ['squire_def_id must be a positive integer']);
  }
  if (!data.file_path) return output('upload-squire-icon', false, ['file_path is required (absolute path to PNG)']);
  if (!fs.existsSync(data.file_path)) return output('upload-squire-icon', false, [`File not found: ${data.file_path}`]);

  const token = await authenticate();
  const res = await apiPostMultipart(`/api/squire-definitions/${data.squire_def_id}/icon`, data.file_path, 'icon', token);
  if (res.status === 200) {
    output('upload-squire-icon', true, res.data);
  } else {
    output('upload-squire-icon', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createMonsterSquireLootCmd(data) {
  const errors = validateMonsterSquireLoot(data);
  if (errors.length) return output('create-monster-squire-loot', false, errors);

  const token = await authenticate();
  const res = await apiPost(`/api/monsters/${data.monster_id}/squire-loot`, {
    squire_def_id: data.squire_def_id,
    drop_chance: data.drop_chance,
    squire_level: data.squire_level ?? 1,
  }, token);
  if (res.status === 201) {
    output('create-monster-squire-loot', true, res.data);
  } else {
    output('create-monster-squire-loot', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function setNpcDismisserCmd(data) {
  if (data.npc_id == null || !Number.isInteger(data.npc_id)) return output('set-npc-dismisser', false, ['npc_id is required (integer)']);
  if (typeof data.is_squire_dismisser !== 'boolean') return output('set-npc-dismisser', false, ['is_squire_dismisser must be a boolean']);

  const token = await authenticate();
  const res = await apiPut(`/api/npcs/${data.npc_id}/squire-dismisser`, { is_squire_dismisser: data.is_squire_dismisser }, token);
  if (res.status === 200) {
    output('set-npc-dismisser', true, res.data);
  } else {
    output('set-npc-dismisser', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

// ─── Quest Commands ──────────────────────────────────────────────────────────

const VALID_QUEST_TYPES = ['main', 'side', 'daily', 'weekly', 'monthly', 'repeatable'];
const VALID_OBJECTIVE_TYPES = ['kill_monster', 'collect_item', 'craft_item', 'spend_crowns', 'gather_resource', 'reach_level', 'visit_location', 'talk_to_npc'];
const VALID_PREREQ_TYPES = ['min_level', 'has_item', 'completed_quest', 'class_required'];
const VALID_REWARD_TYPES = ['item', 'xp', 'crowns', 'squire', 'rod_upgrade_points'];

function validateQuest(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name is required');
  if (!data.description || typeof data.description !== 'string' || !data.description.trim()) errors.push('description is required');
  if (!data.quest_type || !VALID_QUEST_TYPES.includes(data.quest_type)) errors.push(`quest_type must be one of: ${VALID_QUEST_TYPES.join(', ')}`);

  if (!Array.isArray(data.objectives) || data.objectives.length === 0) {
    errors.push('objectives array with at least one entry is required');
  } else {
    for (let i = 0; i < data.objectives.length; i++) {
      const obj = data.objectives[i];
      if (!obj.objective_type || !VALID_OBJECTIVE_TYPES.includes(obj.objective_type)) {
        errors.push(`objectives[${i}].objective_type must be one of: ${VALID_OBJECTIVE_TYPES.join(', ')}`);
      }
      if (!obj.target_quantity || !Number.isInteger(obj.target_quantity) || obj.target_quantity < 1) {
        errors.push(`objectives[${i}].target_quantity must be a positive integer`);
      }
    }
  }

  if (data.prerequisites && !Array.isArray(data.prerequisites)) {
    errors.push('prerequisites must be an array');
  } else if (data.prerequisites) {
    for (let i = 0; i < data.prerequisites.length; i++) {
      const p = data.prerequisites[i];
      if (!p.prereq_type || !VALID_PREREQ_TYPES.includes(p.prereq_type)) {
        errors.push(`prerequisites[${i}].prereq_type must be one of: ${VALID_PREREQ_TYPES.join(', ')}`);
      }
    }
  }

  if (data.rewards && !Array.isArray(data.rewards)) {
    errors.push('rewards must be an array');
  } else if (data.rewards) {
    for (let i = 0; i < data.rewards.length; i++) {
      const r = data.rewards[i];
      if (!r.reward_type || !VALID_REWARD_TYPES.includes(r.reward_type)) {
        errors.push(`rewards[${i}].reward_type must be one of: ${VALID_REWARD_TYPES.join(', ')}`);
      }
      if (!r.quantity || !Number.isInteger(r.quantity) || r.quantity < 1) {
        errors.push(`rewards[${i}].quantity must be a positive integer`);
      }
      if (r.reward_type === 'squire') {
        if (!r.target_id || !Number.isInteger(r.target_id) || r.target_id < 1) {
          errors.push(`rewards[${i}].target_id (squire_def_id) must be a positive integer`);
        }
        if (!Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 20) {
          errors.push(`rewards[${i}].quantity (squire level) must be 1–20`);
        }
      }
    }
  }

  if (data.npc_ids && !Array.isArray(data.npc_ids)) {
    errors.push('npc_ids must be an array of integer NPC IDs');
  }

  return errors;
}

async function createQuestCmd(data) {
  const errors = validateQuest(data);
  if (errors.length) return output('create-quest', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/quests', data, token);
  if (res.status === 201) {
    output('create-quest', true, res.data);
  } else {
    output('create-quest', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function updateQuestCmd(data) {
  if (data.id == null || !Number.isInteger(data.id)) {
    return output('update-quest', false, ['id is required (integer, the quest to update)']);
  }
  const questId = data.id;
  const updateData = { ...data };
  delete updateData.id;

  // Validate objectives if provided
  if (updateData.objectives) {
    if (!Array.isArray(updateData.objectives) || updateData.objectives.length === 0) {
      return output('update-quest', false, ['objectives must be a non-empty array if provided']);
    }
    for (let i = 0; i < updateData.objectives.length; i++) {
      const obj = updateData.objectives[i];
      if (!obj.objective_type || !VALID_OBJECTIVE_TYPES.includes(obj.objective_type)) {
        return output('update-quest', false, [`objectives[${i}].objective_type must be one of: ${VALID_OBJECTIVE_TYPES.join(', ')}`]);
      }
    }
  }

  const token = await authenticate();
  const res = await apiPut(`/api/quests/${questId}`, updateData, token);
  if (res.status === 200) {
    output('update-quest', true, res.data);
  } else {
    output('update-quest', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function deleteQuestCmd(data) {
  if (data.id == null || !Number.isInteger(data.id)) {
    return output('delete-quest', false, ['id is required (integer, the quest to delete)']);
  }
  const token = await authenticate();
  const res = await httpRequest('DELETE', `${BASE_URL}/api/quests/${data.id}`, null, {
    Authorization: `Bearer ${token}`,
  });
  if (res.status === 204) {
    output('delete-quest', true, { deleted: data.id });
  } else {
    output('delete-quest', false, [res.data?.error || `HTTP ${res.status}`]);
  }
}

// ─── Stat Training Commands ──────────────────────────────────────────────────

const VALID_STAT_NAMES = ['constitution', 'strength', 'intelligence', 'dexterity', 'toughness'];

async function createStatTrainingItemCmd(data) {
  const { item_def_id, stat_name, tier, base_chance, decay_per_level, npc_id } = data;
  if (!item_def_id || !Number.isInteger(item_def_id)) return output('create-stat-training-item', false, ['item_def_id must be a positive integer']);
  if (!stat_name || !VALID_STAT_NAMES.includes(stat_name)) return output('create-stat-training-item', false, [`stat_name must be one of: ${VALID_STAT_NAMES.join(', ')}`]);
  if (!tier || ![1, 2, 3].includes(tier)) return output('create-stat-training-item', false, ['tier must be 1, 2, or 3']);
  if (!base_chance || base_chance < 1 || base_chance > 100) return output('create-stat-training-item', false, ['base_chance must be 1-100']);
  if (!decay_per_level || decay_per_level <= 0) return output('create-stat-training-item', false, ['decay_per_level must be positive']);
  if (!npc_id || !Number.isInteger(npc_id)) return output('create-stat-training-item', false, ['npc_id must be a positive integer']);

  const token = await authenticate();
  const res = await apiPost('/api/stat-training', data, token);
  if (res.status === 201 || res.status === 200) {
    output('create-stat-training-item', true, res.data);
  } else {
    output('create-stat-training-item', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function setNpcTrainerStatCmd(data) {
  if (data.npc_id == null || !Number.isInteger(data.npc_id)) return output('set-npc-trainer-stat', false, ['npc_id is required (integer)']);
  if (data.stat !== null && data.stat !== undefined && !VALID_STAT_NAMES.includes(data.stat)) return output('set-npc-trainer-stat', false, [`stat must be null or one of: ${VALID_STAT_NAMES.join(', ')}`]);

  const token = await authenticate();
  const res = await apiPut(`/api/npcs/${data.npc_id}/trainer-stat`, { stat: data.stat ?? null }, token);
  if (res.status === 200) {
    output('set-npc-trainer-stat', true, res.data);
  } else {
    output('set-npc-trainer-stat', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function createSkillBookCmd(data) {
  const errors = validateSkillBook(data);
  if (errors.length) return output('create-skill-book', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/items', { ...data, category: 'skill_book' }, token);
  if (res.status === 201) {
    output('create-skill-book', true, res.data);
  } else {
    output('create-skill-book', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

async function setAbilityLevelsCmd(data) {
  const errors = validateAbilityLevels(data);
  if (errors.length) return output('set-ability-levels', false, errors);

  const token = await authenticate();
  const res = await apiPut(`/api/abilities/${data.ability_id}/levels`, { levels: data.levels }, token);
  if (res.status === 200) {
    output('set-ability-levels', true, res.data);
  } else {
    output('set-ability-levels', false, [res.data.error || `HTTP ${res.status}`]);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const HELP = `
Usage: node scripts/game-entities.js <command> '<json-data>'

Commands:
  create-item             Create an item definition
  create-monster          Create a monster
  create-monster-loot     Add a loot entry to a monster
  create-npc              Create an NPC (requires prior icon upload)
  upload-npc-icon         Upload a PNG icon for NPC use
  set-npc-crafter         Set/unset an NPC's crafter flag
  create-recipe           Create a crafting recipe with ingredients
  create-building-action  Create a building action (travel/explore/expedition/gather)
  assign-building-npc     Assign an NPC to a building
  create-ability          Create a combat ability
  set-encounter           Set a night random encounter entry for a zone
  create-quest            Create a quest with objectives, prereqs, rewards, NPC givers
  update-quest            Update an existing quest (pass id + fields to change)
  delete-quest            Delete a quest by id
  create-squire           Create a squire definition
  upload-squire-icon      Upload a PNG icon for a squire definition
  create-monster-squire-loot  Add a squire loot entry to a monster
  set-npc-dismisser       Set/unset an NPC's squire dismisser flag
  set-npc-trainer-stat    Set/clear an NPC's trainer_stat (which stat they train)
  create-stat-training-item  Map an item as a stat training consumable
  create-skill-book       Create a skill book item linked to an ability
  set-ability-levels      Set per-level stats for an ability
  create-fishing-loot     Add a fishing loot entry (min_rod_tier, item_def_id, drop_weight)
  update-fishing-loot     Update a fishing loot entry (id, min_rod_tier, drop_weight)
  delete-fishing-loot     Delete a fishing loot entry (id)
  create-rod-tier         Create a fishing rod tier definition
  update-rod-tier         Update a fishing rod tier (tier, upgrade_points_cost, max_durability, repair_crown_cost)
  delete-rod-tier         Delete a fishing rod tier (tier)

Environment:
  ADMIN_API_URL    Admin API base URL (default: http://localhost:4001)
  ADMIN_USERNAME   Admin username (default: admin)
  ADMIN_PASSWORD   Admin password (default: admin)

Examples:
  node scripts/game-entities.js create-item '{"name":"Iron Ore","category":"resource","stack_size":20}'
  node scripts/game-entities.js create-monster '{"name":"Goblin","attack":5,"defense":2,"hp":30,"xp_reward":15,"min_crowns":1,"max_crowns":3}'
  node scripts/game-entities.js create-monster-loot '{"monster_id":1,"item_def_id":5,"drop_chance":30,"quantity":1}'
  node scripts/game-entities.js upload-npc-icon '{"file_path":"/absolute/path/to/icon.png"}'
  node scripts/game-entities.js create-npc '{"name":"Blacksmith","description":"Forges weapons","icon_filename":"abc.png"}'
  node scripts/game-entities.js set-npc-crafter '{"npc_id":1,"is_crafter":true}'
  node scripts/game-entities.js create-recipe '{"name":"Iron Sword","npc_id":1,"output_item_id":10,"output_quantity":1,"cost_crowns":50,"craft_time_seconds":30,"ingredients":[{"item_def_id":5,"quantity":3}]}'
  node scripts/game-entities.js create-building-action '{"zone_id":1,"building_id":2,"action_type":"explore","config":{"encounter_chance":40,"monsters":[{"monster_id":1,"weight":10}]}}'
  node scripts/game-entities.js create-building-action '{"zone_id":1,"building_id":3,"action_type":"gather","config":{"required_tool_type":"pickaxe","durability_per_second":2,"min_seconds":10,"max_seconds":60,"events":[{"type":"resource","weight":50,"item_def_id":5,"quantity":1},{"type":"gold","weight":20,"min_amount":1,"max_amount":5},{"type":"nothing","weight":20},{"type":"accident","weight":5,"hp_damage":3},{"type":"monster","weight":5,"monster_id":1}]}}'
  node scripts/game-entities.js assign-building-npc '{"zone_id":1,"building_id":2,"npc_id":1}'
  node scripts/game-entities.js create-ability '{"name":"Fireball","effect_type":"damage","mana_cost":10,"effect_value":25}'
  node scripts/game-entities.js set-encounter '{"zone_id":1,"monster_id":1,"weight":10}'
  node scripts/game-entities.js create-quest '{"name":"Goblin Slayer","description":"Kill goblins","quest_type":"daily","objectives":[{"objective_type":"kill_monster","target_id":1,"target_quantity":5}],"rewards":[{"reward_type":"xp","quantity":50},{"reward_type":"crowns","quantity":20}],"npc_ids":[1]}'
  node scripts/game-entities.js update-quest '{"id":1,"description":"Kill more goblins","objectives":[{"objective_type":"kill_monster","target_id":1,"target_quantity":10}]}'
  node scripts/game-entities.js delete-quest '{"id":1}'
  node scripts/game-entities.js create-squire '{"name":"Shadow Wolf","power_level":45}'
  node scripts/game-entities.js upload-squire-icon '{"squire_def_id":1,"file_path":"/absolute/path/to/icon.png"}'
  node scripts/game-entities.js create-monster-squire-loot '{"monster_id":1,"squire_def_id":1,"drop_chance":10,"squire_level":1}'
  node scripts/game-entities.js set-npc-dismisser '{"npc_id":1,"is_squire_dismisser":true}'
  node scripts/game-entities.js set-npc-trainer-stat '{"npc_id":1,"stat":"strength"}'
  node scripts/game-entities.js create-stat-training-item '{"item_def_id":99,"stat_name":"strength","tier":1,"base_chance":95,"decay_per_level":3.0,"npc_id":1}'
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(HELP);
    process.exit(0);
  }

  let data;
  const jsonStr = args.join(' ');
  if (!jsonStr) {
    console.error(`Error: JSON data argument is required.\nUsage: node scripts/game-entities.js ${cmd} '<json>'`);
    process.exit(1);
  }

  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`Error: Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  try {
    switch (cmd) {
      case 'create-item':           await createItem(data); break;
      case 'create-monster':        await createMonsterCmd(data); break;
      case 'create-monster-loot':   await createMonsterLootCmd(data); break;
      case 'create-npc':            await createNpcCmd(data); break;
      case 'upload-npc-icon':       await uploadNpcIconCmd(data); break;
      case 'set-npc-crafter':       await setNpcCrafterCmd(data); break;
      case 'create-recipe':         await createRecipeCmd(data); break;
      case 'create-building-action': await createBuildingActionCmd(data); break;
      case 'assign-building-npc':   await assignBuildingNpcCmd(data); break;
      case 'create-ability':        await createAbilityCmd(data); break;
      case 'set-encounter':         await setEncounterCmd(data); break;
      case 'create-quest':          await createQuestCmd(data); break;
      case 'update-quest':          await updateQuestCmd(data); break;
      case 'delete-quest':          await deleteQuestCmd(data); break;
      case 'create-squire':         await createSquireCmd(data); break;
      case 'upload-squire-icon':    await uploadSquireIconCmd(data); break;
      case 'create-monster-squire-loot': await createMonsterSquireLootCmd(data); break;
      case 'set-npc-dismisser':     await setNpcDismisserCmd(data); break;
      case 'set-npc-trainer-stat':  await setNpcTrainerStatCmd(data); break;
      case 'create-stat-training-item': await createStatTrainingItemCmd(data); break;
      case 'create-skill-book':     await createSkillBookCmd(data); break;
      case 'set-ability-levels':    await setAbilityLevelsCmd(data); break;
      case 'create-fishing-loot':   await createFishingLootCmd(data); break;
      case 'update-fishing-loot':   await updateFishingLootCmd(data); break;
      case 'delete-fishing-loot':   await deleteFishingLootCmd(data); break;
      case 'create-rod-tier':       await createRodTierCmd(data); break;
      case 'update-rod-tier':       await updateRodTierCmd(data); break;
      case 'delete-rod-tier':       await deleteRodTierCmd(data); break;
      case 'create-boss':           await createBossCmd(data); break;
      case 'create-boss-loot':      await createBossLootCmd(data); break;
      case 'assign-boss-ability':   await assignBossAbilityCmd(data); break;
      case 'upload-boss-icon':      await uploadBossIconCmd(data); break;
      case 'upload-boss-sprite':    await uploadBossSpriteCmd(data); break;
      default:
        console.error(`Unknown command: ${cmd}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    if (err.message.includes('ECONNREFUSED')) {
      console.error('Error: Could not connect to admin API. Is the admin backend running? (npm run dev in admin/backend)');
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

// ─── Fishing Loot Commands ────────────────────────────────────────────────────

async function createFishingLootCmd(data) {
  const errors = [];
  if (data.min_rod_tier == null || typeof data.min_rod_tier !== 'number' || data.min_rod_tier < 1 || data.min_rod_tier > 5) errors.push('min_rod_tier required (1-5)');
  if (data.item_def_id == null || typeof data.item_def_id !== 'number') errors.push('item_def_id required (number)');
  if (data.drop_weight == null || typeof data.drop_weight !== 'number' || data.drop_weight < 1) errors.push('drop_weight required (number >= 1)');
  if (errors.length) return output('create-fishing-loot', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/fishing-loot', data, token);
  output('create-fishing-loot', true, res);
}

async function updateFishingLootCmd(data) {
  const errors = [];
  if (data.id == null) errors.push('id required');
  if (data.min_rod_tier == null || typeof data.min_rod_tier !== 'number') errors.push('min_rod_tier required');
  if (data.drop_weight == null || typeof data.drop_weight !== 'number') errors.push('drop_weight required');
  if (errors.length) return output('update-fishing-loot', false, errors);

  const token = await authenticate();
  const res = await apiPut(`/api/fishing-loot/${data.id}`, { min_rod_tier: data.min_rod_tier, drop_weight: data.drop_weight }, token);
  output('update-fishing-loot', true, res);
}

async function deleteFishingLootCmd(data) {
  if (data.id == null) return output('delete-fishing-loot', false, ['id required']);
  const token = await authenticate();
  await apiDelete(`/api/fishing-loot/${data.id}`, token);
  output('delete-fishing-loot', true, { id: data.id });
}

// ─── Rod Tier Commands ───────────────────────────────────────────────────────

async function createRodTierCmd(data) {
  const errors = [];
  if (data.tier == null || typeof data.tier !== 'number' || data.tier < 1 || data.tier > 5) errors.push('tier required (1-5)');
  if (data.item_def_id == null || typeof data.item_def_id !== 'number') errors.push('item_def_id required (number)');
  if (data.upgrade_points_cost == null || typeof data.upgrade_points_cost !== 'number') errors.push('upgrade_points_cost required');
  if (data.max_durability == null || typeof data.max_durability !== 'number' || data.max_durability < 1) errors.push('max_durability required (> 0)');
  if (data.repair_crown_cost == null || typeof data.repair_crown_cost !== 'number') errors.push('repair_crown_cost required');
  if (errors.length) return output('create-rod-tier', false, errors);

  const token = await authenticate();
  const res = await apiPost('/api/fishing-rod-tiers', data, token);
  output('create-rod-tier', true, res);
}

async function updateRodTierCmd(data) {
  const errors = [];
  if (data.tier == null) errors.push('tier required');
  if (data.upgrade_points_cost == null) errors.push('upgrade_points_cost required');
  if (data.max_durability == null) errors.push('max_durability required');
  if (data.repair_crown_cost == null) errors.push('repair_crown_cost required');
  if (errors.length) return output('update-rod-tier', false, errors);

  const token = await authenticate();
  const res = await apiPut(`/api/fishing-rod-tiers/${data.tier}`, {
    upgrade_points_cost: data.upgrade_points_cost,
    max_durability: data.max_durability,
    repair_crown_cost: data.repair_crown_cost,
  }, token);
  output('update-rod-tier', true, res);
}

async function deleteRodTierCmd(data) {
  if (data.tier == null) return output('delete-rod-tier', false, ['tier required']);
  const token = await authenticate();
  await apiDelete(`/api/fishing-rod-tiers/${data.tier}`, token);
  output('delete-rod-tier', true, { tier: data.tier });
}

// ─── Boss Commands ──────────────────────────────────────────────────────────

async function createBossCmd(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string') errors.push('name required (string)');
  if (data.max_hp == null || typeof data.max_hp !== 'number' || data.max_hp < 1) errors.push('max_hp required (number > 0)');
  if (data.attack == null || typeof data.attack !== 'number' || data.attack < 0) errors.push('attack required (number >= 0)');
  if (data.defense == null || typeof data.defense !== 'number' || data.defense < 0) errors.push('defense required (number >= 0)');
  if (errors.length) return output('create-boss', false, errors);

  const token = await authenticate();
  const body = {
    name: data.name,
    description: data.description || null,
    max_hp: data.max_hp,
    attack: data.attack,
    defense: data.defense,
    xp_reward: data.xp_reward || 0,
    min_crowns: data.min_crowns || 0,
    max_crowns: data.max_crowns || 0,
    building_id: data.building_id || null,
    respawn_min_seconds: data.respawn_min_seconds || 3600,
    respawn_max_seconds: data.respawn_max_seconds || 7200,
    is_active: data.is_active !== false,
  };
  const res = await apiPost('/api/bosses', body, token);
  output('create-boss', true, res);
}

async function createBossLootCmd(data) {
  const errors = [];
  if (data.boss_id == null || typeof data.boss_id !== 'number') errors.push('boss_id required (number)');
  const hasItemId = data.item_def_id != null;
  const hasCategory = typeof data.item_category === 'string' && data.item_category.length > 0;
  if (hasItemId === hasCategory) errors.push('Provide exactly one of item_def_id or item_category');
  if (hasItemId && typeof data.item_def_id !== 'number') errors.push('item_def_id must be a number');
  if (data.drop_chance == null || typeof data.drop_chance !== 'number') errors.push('drop_chance required (number 0-100)');
  if (errors.length) return output('create-boss-loot', false, errors);

  const token = await authenticate();
  const payload = { drop_chance: data.drop_chance, quantity: data.quantity || 1 };
  if (hasItemId) payload.item_def_id = data.item_def_id;
  if (hasCategory) payload.item_category = data.item_category;
  const res = await apiPost(`/api/bosses/${data.boss_id}/loot`, payload, token);
  output('create-boss-loot', true, res);
}

async function assignBossAbilityCmd(data) {
  const errors = [];
  if (data.boss_id == null || typeof data.boss_id !== 'number') errors.push('boss_id required (number)');
  if (data.ability_id == null || typeof data.ability_id !== 'number') errors.push('ability_id required (number)');
  if (errors.length) return output('assign-boss-ability', false, errors);

  const token = await authenticate();
  const res = await apiPost(`/api/bosses/${data.boss_id}/abilities`, {
    ability_id: data.ability_id,
    priority: data.priority || 0,
  }, token);
  output('assign-boss-ability', true, res);
}

async function uploadBossIconCmd(data) {
  const errors = [];
  if (data.boss_id == null) errors.push('boss_id required');
  if (!data.file_path) errors.push('file_path required');
  if (errors.length) return output('upload-boss-icon', false, errors);

  const filePath = path.resolve(data.file_path);
  if (!fs.existsSync(filePath)) return output('upload-boss-icon', false, ['File not found: ' + filePath]);

  const token = await authenticate();
  const res = await uploadFile(`/api/bosses/${data.boss_id}/upload-icon`, filePath, 'icon', token);
  output('upload-boss-icon', true, res);
}

async function uploadBossSpriteCmd(data) {
  const errors = [];
  if (data.boss_id == null) errors.push('boss_id required');
  if (!data.file_path) errors.push('file_path required');
  if (errors.length) return output('upload-boss-sprite', false, errors);

  const filePath = path.resolve(data.file_path);
  if (!fs.existsSync(filePath)) return output('upload-boss-sprite', false, ['File not found: ' + filePath]);

  const token = await authenticate();
  const res = await uploadFile(`/api/bosses/${data.boss_id}/upload-sprite`, filePath, 'icon', token);
  output('upload-boss-sprite', true, res);
}

main();
