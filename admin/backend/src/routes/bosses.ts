import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllBosses,
  getBossById,
  createBoss,
  updateBoss,
  deleteBoss,
  getBossAbilities,
  addBossAbility,
  removeBossAbility,
  getBossLoot,
  addBossLoot,
  removeBossLoot,
  getAllBossInstances,
  getBossInstance,
  deleteBossInstance,
  createBossInstance,
  type Boss,
} from '../../../../backend/src/db/queries/bosses';
import { query } from '../../../../backend/src/db/connection';
import { resizeUpload } from '../middleware/resize-upload';

export const bossesRouter = Router();

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/bosses/icons');
const SPRITES_DIR = path.resolve(__dirname, '../../../../backend/assets/bosses/sprites');

function buildIconUrl(filename: string | null): string | null {
  return filename ? `/boss-icons/${filename}` : null;
}

function buildSpriteUrl(filename: string | null): string | null {
  return filename ? `/boss-sprites/${filename}` : null;
}

function bossToResponse(b: Boss & { building_name?: string }) {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon_url: buildIconUrl(b.icon_filename),
    sprite_url: buildSpriteUrl(b.sprite_filename),
    icon_filename: b.icon_filename,
    sprite_filename: b.sprite_filename,
    max_hp: b.max_hp,
    min_hp: b.min_hp,
    attack: b.attack,
    min_attack: b.min_attack,
    defense: b.defense,
    min_defense: b.min_defense,
    xp_reward: b.xp_reward,
    min_crowns: b.min_crowns,
    max_crowns: b.max_crowns,
    building_id: b.building_id,
    building_name: (b as Boss & { building_name?: string }).building_name ?? null,
    respawn_min_seconds: b.respawn_min_seconds,
    respawn_max_seconds: b.respawn_max_seconds,
    is_active: b.is_active,
    created_at: b.created_at,
  };
}

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// Multer setup — memory storage, PNG only, max 2 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are allowed'));
    }
  },
});

function validatePngMagicBytes(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  );
}

// ── GET /api/bosses/buildings ──────────────────────────────────────────────
// Helper: list all buildings for the building_id dropdown (before /:id routes)

bossesRouter.get('/buildings', async (_req: Request, res: Response) => {
  try {
    const result = await query<{ id: number; name: string; zone_id: number }>(
      'SELECT id, name, zone_id FROM buildings ORDER BY name',
    );
    return res.json(result.rows);
  } catch (err) {
    log('error', 'Failed to list buildings', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/bosses/instances ─────────────────────────────────────────────
// Must be before /:id routes to avoid "instances" being treated as an id

bossesRouter.get('/instances', async (_req: Request, res: Response) => {
  try {
    const instances = await getAllBossInstances();
    return res.json(instances.map((i) => ({
      id: i.id,
      boss_id: i.boss_id,
      boss_name: i.boss_name,
      building_id: i.building_id,
      max_hp: i.max_hp,
      current_hp: i.current_hp,
      status: i.status,
      fighting_character_id: i.fighting_character_id,
      fighting_character_name: i.fighting_character_name,
      total_attempts: i.total_attempts,
      spawned_at: i.spawned_at,
      defeated_at: i.defeated_at,
      respawn_at: i.respawn_at,
    })));
  } catch (err) {
    log('error', 'Failed to list boss instances', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/bosses ───────────────────────────────────────────────────────

bossesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const bosses = await getAllBosses();
    // Join with buildings for building_name
    const enriched = [];
    for (const b of bosses) {
      let buildingName: string | null = null;
      if (b.building_id) {
        const bldg = await query<{ name: string }>('SELECT name FROM buildings WHERE id = $1', [b.building_id]);
        if (bldg.rows.length > 0) buildingName = bldg.rows[0]!.name;
      }
      enriched.push(bossToResponse({ ...b, building_name: buildingName ?? undefined }));
    }
    return res.json(enriched);
  } catch (err) {
    log('error', 'Failed to list bosses', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/bosses/:id ──────────────────────────────────────────────────

bossesRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid boss id' });

  try {
    const boss = await getBossById(id);
    if (!boss) return res.status(404).json({ error: 'Boss not found' });

    let buildingName: string | null = null;
    if (boss.building_id) {
      const bldg = await query<{ name: string }>('SELECT name FROM buildings WHERE id = $1', [boss.building_id]);
      if (bldg.rows.length > 0) buildingName = bldg.rows[0]!.name;
    }

    const abilities = await getBossAbilities(id);
    const loot = await getBossLoot(id);
    return res.json({
      ...bossToResponse({ ...boss, building_name: buildingName ?? undefined }),
      abilities: abilities.map((a) => ({
        id: a.id,
        ability_id: a.ability_id,
        priority: a.priority,
        name: a.name,
        effect_type: a.effect_type,
        mana_cost: a.mana_cost,
        effect_value: a.effect_value,
        icon_url: a.icon_filename ? `/ability-icons/${a.icon_filename}` : null,
      })),
      loot: loot.map((l) => ({
        id: l.id,
        item_def_id: l.item_def_id,
        item_name: l.item_name,
        drop_chance: l.drop_chance,
        quantity: l.quantity,
        icon_url: l.icon_filename ? `/item-icons/${l.icon_filename}` : null,
      })),
    });
  } catch (err) {
    log('error', 'Failed to get boss', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/bosses ─────────────────────────────────────────────────────

bossesRouter.post('/', async (req: Request, res: Response) => {
  const {
    name, description, max_hp, min_hp, attack, min_attack, defense, min_defense,
    xp_reward, min_crowns, max_crowns, building_id,
    respawn_min_seconds, respawn_max_seconds, is_active,
  } = req.body as Record<string, unknown>;

  if (!name || !(name as string).trim()) return res.status(400).json({ error: 'name is required' });

  const maxHp = Number(max_hp);
  const minHp = Number(min_hp ?? max_hp);
  const atk = Number(attack);
  const minAtk = Number(min_attack ?? attack);
  const def = Number(defense);
  const minDef = Number(min_defense ?? defense);
  if (isNaN(maxHp) || maxHp < 1) return res.status(400).json({ error: 'max_hp must be a positive integer' });
  if (isNaN(minHp) || minHp < 1 || minHp > maxHp) return res.status(400).json({ error: 'min_hp must be 1..max_hp' });
  if (isNaN(atk) || atk < 1) return res.status(400).json({ error: 'attack must be a positive integer' });
  if (isNaN(minAtk) || minAtk < 0 || minAtk > atk) return res.status(400).json({ error: 'min_attack must be 0..attack' });
  if (isNaN(def) || def < 0) return res.status(400).json({ error: 'defense must be a non-negative integer' });
  if (isNaN(minDef) || minDef < 0 || minDef > def) return res.status(400).json({ error: 'min_defense must be 0..defense' });

  const xp = Number(xp_reward ?? 0);
  if (isNaN(xp) || xp < 0) return res.status(400).json({ error: 'xp_reward must be a non-negative integer' });

  const minC = Number(min_crowns ?? 0);
  const maxC = Number(max_crowns ?? 0);
  if (isNaN(minC) || minC < 0) return res.status(400).json({ error: 'min_crowns must be a non-negative integer' });
  if (isNaN(maxC) || maxC < 0) return res.status(400).json({ error: 'max_crowns must be a non-negative integer' });
  if (minC > maxC) return res.status(400).json({ error: 'min_crowns must be <= max_crowns' });

  const respawnMin = Number(respawn_min_seconds ?? 3600);
  const respawnMax = Number(respawn_max_seconds ?? 7200);
  if (isNaN(respawnMin) || respawnMin < 0) return res.status(400).json({ error: 'respawn_min_seconds must be a non-negative integer' });
  if (isNaN(respawnMax) || respawnMax < 0) return res.status(400).json({ error: 'respawn_max_seconds must be a non-negative integer' });
  if (respawnMin > respawnMax) return res.status(400).json({ error: 'respawn_min_seconds must be <= respawn_max_seconds' });

  let buildingIdNum: number | null = null;
  if (building_id !== undefined && building_id !== null && building_id !== '') {
    buildingIdNum = Number(building_id);
    if (isNaN(buildingIdNum) || buildingIdNum < 1) return res.status(400).json({ error: 'building_id must be a positive integer' });
    // Verify building exists
    const bldg = await query<{ id: number }>('SELECT id FROM buildings WHERE id = $1', [buildingIdNum]);
    if (bldg.rows.length === 0) return res.status(400).json({ error: 'building_id references a non-existent building' });
  }

  try {
    const boss = await createBoss({
      name: (name as string).trim(),
      description: description ? (description as string).trim() : null,
      max_hp: maxHp,
      min_hp: minHp,
      attack: atk,
      min_attack: minAtk,
      defense: def,
      min_defense: minDef,
      xp_reward: xp,
      min_crowns: minC,
      max_crowns: maxC,
      building_id: buildingIdNum,
      respawn_min_seconds: respawnMin,
      respawn_max_seconds: respawnMax,
      is_active: is_active === true || is_active === 'true',
    });
    log('info', 'Created boss', { id: boss.id, name: boss.name, admin: req.username });
    return res.status(201).json(bossToResponse(boss));
  } catch (err) {
    log('error', 'Failed to create boss', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/bosses/:id ──────────────────────────────────────────────────

bossesRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid boss id' });

  const existing = await getBossById(id);
  if (!existing) return res.status(404).json({ error: 'Boss not found' });

  const {
    name, description, max_hp, attack, defense, xp_reward,
    min_crowns, max_crowns, building_id,
    respawn_min_seconds, respawn_max_seconds, is_active,
  } = req.body as Record<string, unknown>;

  const data: Partial<Omit<Boss, 'id' | 'created_at'>> = {};

  if (name !== undefined) {
    if (!(name as string).trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = (name as string).trim();
  }
  if (description !== undefined) {
    data.description = description ? (description as string).trim() : null;
  }
  if (max_hp !== undefined) {
    const v = Number(max_hp);
    if (isNaN(v) || v < 1) return res.status(400).json({ error: 'max_hp must be a positive integer' });
    data.max_hp = v;
  }
  if (attack !== undefined) {
    const v = Number(attack);
    if (isNaN(v) || v < 1) return res.status(400).json({ error: 'attack must be a positive integer' });
    data.attack = v;
  }
  if (defense !== undefined) {
    const v = Number(defense);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'defense must be a non-negative integer' });
    data.defense = v;
  }
  if (xp_reward !== undefined) {
    const v = Number(xp_reward);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'xp_reward must be a non-negative integer' });
    data.xp_reward = v;
  }
  if (min_crowns !== undefined) {
    const v = Number(min_crowns);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'min_crowns must be a non-negative integer' });
    data.min_crowns = v;
  }
  if (max_crowns !== undefined) {
    const v = Number(max_crowns);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'max_crowns must be a non-negative integer' });
    data.max_crowns = v;
  }
  // Validate crowns range
  const effectiveMin = data.min_crowns ?? existing.min_crowns;
  const effectiveMax = data.max_crowns ?? existing.max_crowns;
  if (effectiveMin > effectiveMax) return res.status(400).json({ error: 'min_crowns must be <= max_crowns' });

  if (respawn_min_seconds !== undefined) {
    const v = Number(respawn_min_seconds);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'respawn_min_seconds must be a non-negative integer' });
    data.respawn_min_seconds = v;
  }
  if (respawn_max_seconds !== undefined) {
    const v = Number(respawn_max_seconds);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'respawn_max_seconds must be a non-negative integer' });
    data.respawn_max_seconds = v;
  }
  const effectiveRespawnMin = data.respawn_min_seconds ?? existing.respawn_min_seconds;
  const effectiveRespawnMax = data.respawn_max_seconds ?? existing.respawn_max_seconds;
  if (effectiveRespawnMin > effectiveRespawnMax) return res.status(400).json({ error: 'respawn_min_seconds must be <= respawn_max_seconds' });

  if (building_id !== undefined) {
    if (building_id === null || building_id === '') {
      data.building_id = null;
    } else {
      const v = Number(building_id);
      if (isNaN(v) || v < 1) return res.status(400).json({ error: 'building_id must be a positive integer' });
      const bldg = await query<{ id: number }>('SELECT id FROM buildings WHERE id = $1', [v]);
      if (bldg.rows.length === 0) return res.status(400).json({ error: 'building_id references a non-existent building' });
      data.building_id = v;
    }
  }
  if (is_active !== undefined) {
    data.is_active = is_active === true || is_active === 'true';
  }

  try {
    const updated = await updateBoss(id, data);
    if (!updated) return res.status(404).json({ error: 'Boss not found' });
    log('info', 'Updated boss', { id, admin: req.username });
    return res.json(bossToResponse(updated));
  } catch (err) {
    log('error', 'Failed to update boss', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/bosses/:id ───────────────────────────────────────────────

bossesRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid boss id' });

  try {
    const boss = await getBossById(id);
    if (!boss) return res.status(404).json({ error: 'Boss not found' });

    await deleteBoss(id);

    // Clean up asset files
    if (boss.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, boss.icon_filename)); } catch { /* ignore */ }
    }
    if (boss.sprite_filename) {
      try { fs.unlinkSync(path.join(SPRITES_DIR, boss.sprite_filename)); } catch { /* ignore */ }
    }

    log('info', 'Deleted boss', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete boss', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/bosses/:id/abilities ─────────────────────────────────────────

bossesRouter.get('/:id/abilities', async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  try {
    const abilities = await getBossAbilities(bossId);
    return res.json(abilities.map((a) => ({
      id: a.id,
      ability_id: a.ability_id,
      priority: a.priority,
      name: a.name,
      effect_type: a.effect_type,
      mana_cost: a.mana_cost,
      effect_value: a.effect_value,
      icon_url: a.icon_filename ? `/ability-icons/${a.icon_filename}` : null,
    })));
  } catch (err) {
    log('error', 'Failed to get boss abilities', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/bosses/:id/abilities ────────────────────────────────────────

bossesRouter.post('/:id/abilities', async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  const { ability_id, priority } = req.body as Record<string, unknown>;

  if (!Number.isInteger(ability_id) || (ability_id as number) <= 0) {
    return res.status(400).json({ error: 'ability_id must be a positive integer' });
  }
  const prio = Number(priority ?? 1);
  if (!Number.isInteger(prio) || prio < 0) {
    return res.status(400).json({ error: 'priority must be a non-negative integer' });
  }

  // Validate ability exists
  const abilityRow = await query<{ id: number }>('SELECT id FROM abilities WHERE id = $1', [ability_id]);
  if (abilityRow.rows.length === 0) {
    return res.status(400).json({ error: 'ability_id references a non-existent ability' });
  }

  // Validate boss exists
  const boss = await getBossById(bossId);
  if (!boss) return res.status(404).json({ error: 'Boss not found' });

  try {
    const entry = await addBossAbility(bossId, ability_id as number, prio);
    // Re-fetch with join data
    const abilities = await getBossAbilities(bossId);
    const added = abilities.find((a) => a.ability_id === (ability_id as number));
    log('info', 'Added boss ability', { bossId, ability_id, admin: req.username });
    return res.status(201).json(added ? {
      id: added.id,
      ability_id: added.ability_id,
      priority: added.priority,
      name: added.name,
      effect_type: added.effect_type,
      mana_cost: added.mana_cost,
      effect_value: added.effect_value,
      icon_url: added.icon_filename ? `/ability-icons/${added.icon_filename}` : null,
    } : entry);
  } catch (err) {
    log('error', 'Failed to add boss ability', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/bosses/:id/abilities/:abilityId ───────────────────────────

bossesRouter.delete('/:id/abilities/:abilityId', async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  const abilityId = parseInt(req.params.abilityId!, 10);
  if (isNaN(bossId) || isNaN(abilityId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await removeBossAbility(bossId, abilityId);
    log('info', 'Removed boss ability', { bossId, abilityId, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to remove boss ability', { bossId, abilityId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/bosses/:id/loot ──────────────────────────────────────────────

bossesRouter.get('/:id/loot', async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  try {
    const loot = await getBossLoot(bossId);
    return res.json(loot.map((l) => ({
      id: l.id,
      item_def_id: l.item_def_id,
      item_name: l.item_name,
      drop_chance: l.drop_chance,
      quantity: l.quantity,
      icon_url: l.icon_filename ? `/item-icons/${l.icon_filename}` : null,
    })));
  } catch (err) {
    log('error', 'Failed to get boss loot', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/bosses/:id/loot ─────────────────────────────────────────────

bossesRouter.post('/:id/loot', async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  const { item_def_id, drop_chance, quantity } = req.body as Record<string, unknown>;

  if (!Number.isInteger(item_def_id) || (item_def_id as number) <= 0) {
    return res.status(400).json({ error: 'item_def_id must be a positive integer' });
  }
  const dropChance = Number(drop_chance);
  if (!Number.isInteger(dropChance) || dropChance < 1 || dropChance > 100) {
    return res.status(400).json({ error: 'drop_chance must be an integer between 1 and 100' });
  }
  const qty = Number(quantity ?? 1);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  // Validate item exists
  const itemRow = await query<{ id: number }>('SELECT id FROM item_definitions WHERE id = $1', [item_def_id]);
  if (itemRow.rows.length === 0) {
    return res.status(400).json({ error: 'item_def_id references a non-existent item' });
  }

  // Validate boss exists
  const boss = await getBossById(bossId);
  if (!boss) return res.status(404).json({ error: 'Boss not found' });

  try {
    await addBossLoot(bossId, item_def_id as number, dropChance, qty);
    // Re-fetch with join data
    const loot = await getBossLoot(bossId);
    const added = loot.find((l) => l.item_def_id === (item_def_id as number));
    log('info', 'Added boss loot', { bossId, item_def_id, admin: req.username });
    return res.status(201).json(added ? {
      id: added.id,
      item_def_id: added.item_def_id,
      item_name: added.item_name,
      drop_chance: added.drop_chance,
      quantity: added.quantity,
      icon_url: added.icon_filename ? `/item-icons/${added.icon_filename}` : null,
    } : { item_def_id, drop_chance: dropChance, quantity: qty });
  } catch (err) {
    log('error', 'Failed to add boss loot', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/bosses/:id/loot/:lootId ───────────────────────────────────

bossesRouter.delete('/:id/loot/:lootId', async (req: Request, res: Response) => {
  const lootId = parseInt(req.params.lootId!, 10);
  if (isNaN(lootId)) return res.status(400).json({ error: 'Invalid loot id' });

  try {
    await removeBossLoot(lootId);
    log('info', 'Deleted boss loot entry', { lootId, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete boss loot', { lootId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/bosses/:id/respawn ──────────────────────────────────────────

bossesRouter.post('/:id/respawn', async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  try {
    const boss = await getBossById(bossId);
    if (!boss) return res.status(404).json({ error: 'Boss not found' });

    // Delete current instance(s) and create a fresh one at full HP
    await deleteBossInstance(bossId);
    const instance = await createBossInstance(bossId, boss.max_hp);

    log('info', 'Force respawned boss', { bossId, instanceId: instance.id, admin: req.username });
    return res.json({
      id: instance.id,
      boss_id: instance.boss_id,
      current_hp: instance.current_hp,
      status: instance.status,
      spawned_at: instance.spawned_at,
    });
  } catch (err) {
    log('error', 'Failed to force respawn boss', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/bosses/:id/upload-icon ──────────────────────────────────────

bossesRouter.post('/:id/upload-icon', upload.single('icon'), resizeUpload(), async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  if (!req.file) return res.status(400).json({ error: 'icon file is required' });
  if (!validatePngMagicBytes(req.file.buffer)) {
    return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
  }

  const boss = await getBossById(bossId);
  if (!boss) return res.status(404).json({ error: 'Boss not found' });

  const iconFilename = `${randomUUID()}.png`;
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICONS_DIR, iconFilename), req.file.buffer);

  // Remove old icon
  if (boss.icon_filename) {
    try { fs.unlinkSync(path.join(ICONS_DIR, boss.icon_filename)); } catch { /* ignore */ }
  }

  try {
    await updateBoss(bossId, { icon_filename: iconFilename });
    log('info', 'Uploaded boss icon', { bossId, iconFilename, admin: req.username });
    return res.json({
      icon_filename: iconFilename,
      icon_url: buildIconUrl(iconFilename),
    });
  } catch (err) {
    try { fs.unlinkSync(path.join(ICONS_DIR, iconFilename)); } catch { /* ignore */ }
    log('error', 'Failed to upload boss icon', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/bosses/:id/upload-sprite ────────────────────────────────────

bossesRouter.post('/:id/upload-sprite', upload.single('sprite'), resizeUpload(), async (req: Request, res: Response) => {
  const bossId = parseInt(req.params.id!, 10);
  if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss id' });

  if (!req.file) return res.status(400).json({ error: 'sprite file is required' });
  if (!validatePngMagicBytes(req.file.buffer)) {
    return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
  }

  const boss = await getBossById(bossId);
  if (!boss) return res.status(404).json({ error: 'Boss not found' });

  const spriteFilename = `${randomUUID()}.png`;
  fs.mkdirSync(SPRITES_DIR, { recursive: true });
  fs.writeFileSync(path.join(SPRITES_DIR, spriteFilename), req.file.buffer);

  // Remove old sprite
  if (boss.sprite_filename) {
    try { fs.unlinkSync(path.join(SPRITES_DIR, boss.sprite_filename)); } catch { /* ignore */ }
  }

  try {
    await updateBoss(bossId, { sprite_filename: spriteFilename });
    log('info', 'Uploaded boss sprite', { bossId, spriteFilename, admin: req.username });
    return res.json({
      sprite_filename: spriteFilename,
      sprite_url: buildSpriteUrl(spriteFilename),
    });
  } catch (err) {
    try { fs.unlinkSync(path.join(SPRITES_DIR, spriteFilename)); } catch { /* ignore */ }
    log('error', 'Failed to upload boss sprite', { bossId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
