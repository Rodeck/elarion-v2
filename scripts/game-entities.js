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
];
const VALID_WEAPON_SUBTYPES = ['one_handed', 'two_handed', 'dagger', 'wand', 'staff', 'bow'];
const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food']);
const DEFENCE_CATEGORIES = new Set(['boots', 'shield', 'greaves', 'bracer', 'helmet', 'chestplate']);
const VALID_EFFECT_TYPES = ['damage', 'heal', 'buff', 'debuff', 'dot', 'reflect', 'drain'];
const VALID_SLOT_TYPES = ['auto', 'active', 'both'];
const VALID_ACTION_TYPES = ['travel', 'explore', 'expedition', 'gather'];
const VALID_TOOL_TYPES = ['pickaxe', 'axe'];
const VALID_GATHER_EVENT_TYPES = ['resource', 'gold', 'monster', 'accident', 'nothing'];

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
  if (!data.item_def_id || !Number.isInteger(data.item_def_id) || data.item_def_id < 1) errors.push('item_def_id must be a positive integer');
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
        }
      }
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
  const res = await apiPost(`/api/monsters/${data.monster_id}/loot`, {
    item_def_id: data.item_def_id,
    drop_chance: data.drop_chance,
    quantity: data.quantity ?? 1,
  }, token);
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

// ─── Quest Commands ──────────────────────────────────────────────────────────

const VALID_QUEST_TYPES = ['main', 'side', 'daily', 'weekly', 'monthly', 'repeatable'];
const VALID_OBJECTIVE_TYPES = ['kill_monster', 'collect_item', 'craft_item', 'spend_crowns', 'gather_resource', 'reach_level', 'visit_location', 'talk_to_npc'];
const VALID_PREREQ_TYPES = ['min_level', 'has_item', 'completed_quest', 'class_required'];
const VALID_REWARD_TYPES = ['item', 'xp', 'crowns'];

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

main();
