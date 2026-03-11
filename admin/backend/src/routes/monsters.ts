import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllMonsters,
  getMonsterById,
  createMonster,
  updateMonster,
  deleteMonster,
  type Monster,
} from '../../../../backend/src/db/queries/monsters';
import {
  getLootByMonsterId,
  addLootEntry,
  updateLootEntry,
  deleteLootEntry,
} from '../../../../backend/src/db/queries/monster-loot';
import { query } from '../../../../backend/src/db/connection';

export const monstersRouter = Router();

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/monsters/icons');

function buildIconUrl(filename: string | null): string | null {
  return filename ? `/monster-icons/${filename}` : null;
}

function monsterToResponse(m: Monster) {
  return {
    id: m.id,
    name: m.name,
    attack: m.attack,
    defense: m.defense,
    hp: m.hp,
    xp_reward: m.xp_reward,
    min_crowns: m.min_crowns,
    max_crowns: m.max_crowns,
    icon_url: buildIconUrl(m.icon_filename),
    created_at: m.created_at,
  };
}

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// Multer setup — memory storage, PNG only, max 2 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, fieldSize: 4 * 1024 * 1024 }, // 4 MB fields for icon_base64
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

// ── GET /api/monsters ──────────────────────────────────────────────────────

monstersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const monsters = await getAllMonsters();
    return res.json(monsters.map(monsterToResponse));
  } catch (err) {
    log('error', 'Failed to list monsters', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/monsters/:id ──────────────────────────────────────────────────

monstersRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid monster id' });

  try {
    const monster = await getMonsterById(id);
    if (!monster) return res.status(404).json({ error: 'Monster not found' });

    const loot = await getLootByMonsterId(id);
    return res.json({
      ...monsterToResponse(monster),
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
    log('error', 'Failed to get monster', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/monsters ─────────────────────────────────────────────────────

monstersRouter.post('/', upload.single('icon'), async (req: Request, res: Response) => {
  const { name, attack, defense, hp, xp_reward, min_crowns, max_crowns } = req.body as Record<string, string>;

  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const attackNum = parseInt(attack ?? '', 10);
  const defenseNum = parseInt(defense ?? '', 10);
  const hpNum = parseInt(hp ?? '', 10);
  const xpNum = parseInt(xp_reward ?? '', 10);
  const minCrownsNum = parseInt(min_crowns ?? '0', 10);
  const maxCrownsNum = parseInt(max_crowns ?? '0', 10);

  if (isNaN(attackNum) || attackNum < 0) return res.status(400).json({ error: 'attack must be a non-negative integer' });
  if (isNaN(defenseNum) || defenseNum < 0) return res.status(400).json({ error: 'defense must be a non-negative integer' });
  if (isNaN(hpNum) || hpNum < 1) return res.status(400).json({ error: 'hp must be a positive integer' });
  if (isNaN(xpNum) || xpNum < 0) return res.status(400).json({ error: 'xp_reward must be a non-negative integer' });
  if (isNaN(minCrownsNum) || minCrownsNum < 0) return res.status(400).json({ error: 'min_crowns must be a non-negative integer' });
  if (isNaN(maxCrownsNum) || maxCrownsNum < 0) return res.status(400).json({ error: 'max_crowns must be a non-negative integer' });
  if (minCrownsNum > maxCrownsNum) return res.status(400).json({ error: 'min_crowns must be <= max_crowns' });

  let iconFilename: string | null = null;
  if (req.file) {
    if (!validatePngMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
    }
    iconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, iconFilename), req.file.buffer);
  }

  if (!iconFilename && req.body.icon_base64 && typeof req.body.icon_base64 === 'string') {
    const buf = Buffer.from(req.body.icon_base64 as string, 'base64');
    if (!validatePngMagicBytes(buf)) {
      return res.status(400).json({ error: 'icon_base64 is not a valid PNG' });
    }
    iconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, iconFilename), buf);
  }

  try {
    const monster = await createMonster({
      name: name.trim(),
      icon_filename: iconFilename,
      attack: attackNum,
      defense: defenseNum,
      hp: hpNum,
      xp_reward: xpNum,
      min_crowns: minCrownsNum,
      max_crowns: maxCrownsNum,
    });
    const loot = await getLootByMonsterId(monster.id);
    log('info', 'Created monster', { id: monster.id, name: monster.name, admin: req.username });
    return res.status(201).json({ ...monsterToResponse(monster), loot });
  } catch (err) {
    // Clean up icon if DB write failed
    if (iconFilename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, iconFilename)); } catch { /* ignore */ }
    }
    log('error', 'Failed to create monster', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/monsters/:id ──────────────────────────────────────────────────

monstersRouter.put('/:id', upload.single('icon'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid monster id' });

  const existing = await getMonsterById(id);
  if (!existing) return res.status(404).json({ error: 'Monster not found' });

  const { name, attack, defense, hp, xp_reward, min_crowns, max_crowns } = req.body as Record<string, string>;

  const data: Parameters<typeof updateMonster>[1] = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = name.trim();
  }
  if (attack !== undefined) {
    const v = parseInt(attack, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'attack must be a non-negative integer' });
    data.attack = v;
  }
  if (defense !== undefined) {
    const v = parseInt(defense, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'defense must be a non-negative integer' });
    data.defense = v;
  }
  if (hp !== undefined) {
    const v = parseInt(hp, 10);
    if (isNaN(v) || v < 1) return res.status(400).json({ error: 'hp must be a positive integer' });
    data.hp = v;
  }
  if (xp_reward !== undefined) {
    const v = parseInt(xp_reward, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'xp_reward must be a non-negative integer' });
    data.xp_reward = v;
  }
  if (min_crowns !== undefined) {
    const v = parseInt(min_crowns, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'min_crowns must be a non-negative integer' });
    data.min_crowns = v;
  }
  if (max_crowns !== undefined) {
    const v = parseInt(max_crowns, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'max_crowns must be a non-negative integer' });
    data.max_crowns = v;
  }
  // Validate range consistency after both values are set
  const effectiveMin = data.min_crowns ?? existing.min_crowns;
  const effectiveMax = data.max_crowns ?? existing.max_crowns;
  if (effectiveMin > effectiveMax) {
    return res.status(400).json({ error: 'min_crowns must be <= max_crowns' });
  }

  let newIconFilename: string | undefined;
  if (req.file) {
    if (!validatePngMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
    }
    newIconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, newIconFilename), req.file.buffer);
    data.icon_filename = newIconFilename;
  }

  if (!newIconFilename && req.body.icon_base64 && typeof req.body.icon_base64 === 'string') {
    const buf = Buffer.from(req.body.icon_base64 as string, 'base64');
    if (!validatePngMagicBytes(buf)) {
      return res.status(400).json({ error: 'icon_base64 is not a valid PNG' });
    }
    newIconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, newIconFilename), buf);
    data.icon_filename = newIconFilename;
  }

  try {
    const updated = await updateMonster(id, data);
    if (!updated) return res.status(404).json({ error: 'Monster not found' });

    // Remove old icon if replaced
    if (newIconFilename && existing.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, existing.icon_filename)); } catch { /* ignore */ }
    }

    const loot = await getLootByMonsterId(id);
    log('info', 'Updated monster', { id, admin: req.username });
    return res.json({ ...monsterToResponse(updated), loot });
  } catch (err) {
    if (newIconFilename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, newIconFilename)); } catch { /* ignore */ }
    }
    log('error', 'Failed to update monster', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/monsters/:id ───────────────────────────────────────────────

monstersRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid monster id' });

  try {
    const monster = await getMonsterById(id);
    if (!monster) return res.status(404).json({ error: 'Monster not found' });

    await deleteMonster(id);

    if (monster.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, monster.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Deleted monster', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete monster', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/monsters/:id/loot ─────────────────────────────────────────────

monstersRouter.get('/:id/loot', async (req: Request, res: Response) => {
  const monsterId = parseInt(req.params.id!, 10);
  if (isNaN(monsterId)) return res.status(400).json({ error: 'Invalid monster id' });

  try {
    const loot = await getLootByMonsterId(monsterId);
    return res.json(loot.map((l) => ({
      id: l.id,
      item_def_id: l.item_def_id,
      item_name: l.item_name,
      drop_chance: l.drop_chance,
      quantity: l.quantity,
      icon_url: l.icon_filename ? `/item-icons/${l.icon_filename}` : null,
    })));
  } catch (err) {
    log('error', 'Failed to get monster loot', { monsterId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/monsters/:id/loot ────────────────────────────────────────────

monstersRouter.post('/:id/loot', async (req: Request, res: Response) => {
  const monsterId = parseInt(req.params.id!, 10);
  if (isNaN(monsterId)) return res.status(400).json({ error: 'Invalid monster id' });

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

  // Validate item_def_id exists
  const itemRow = await query<{ id: number }>('SELECT id FROM item_definitions WHERE id = $1', [item_def_id]);
  if (itemRow.rows.length === 0) {
    return res.status(400).json({ error: 'item_def_id references a non-existent item' });
  }

  try {
    const entry = await addLootEntry({
      monster_id: monsterId,
      item_def_id: item_def_id as number,
      drop_chance: dropChance,
      quantity: qty,
    });
    log('info', 'Added loot entry', { monsterId, item_def_id, admin: req.username });
    return res.status(201).json({
      id: entry.id,
      item_def_id: entry.item_def_id,
      item_name: entry.item_name,
      drop_chance: entry.drop_chance,
      quantity: entry.quantity,
      icon_url: entry.icon_filename ? `/item-icons/${entry.icon_filename}` : null,
    });
  } catch (err) {
    log('error', 'Failed to add loot entry', { monsterId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/monsters/:id/loot/:lootId ─────────────────────────────────────

monstersRouter.put('/:id/loot/:lootId', async (req: Request, res: Response) => {
  const lootId = parseInt(req.params.lootId!, 10);
  if (isNaN(lootId)) return res.status(400).json({ error: 'Invalid loot id' });

  const { drop_chance, quantity } = req.body as Record<string, unknown>;
  const data: { drop_chance?: number; quantity?: number } = {};

  if (drop_chance !== undefined) {
    const v = Number(drop_chance);
    if (!Number.isInteger(v) || v < 1 || v > 100) return res.status(400).json({ error: 'drop_chance must be 1–100' });
    data.drop_chance = v;
  }
  if (quantity !== undefined) {
    const v = Number(quantity);
    if (!Number.isInteger(v) || v < 1) return res.status(400).json({ error: 'quantity must be a positive integer' });
    data.quantity = v;
  }

  try {
    const entry = await updateLootEntry(lootId, data);
    if (!entry) return res.status(404).json({ error: 'Loot entry not found' });
    log('info', 'Updated loot entry', { lootId, admin: req.username });
    return res.json({
      id: entry.id,
      item_def_id: entry.item_def_id,
      item_name: entry.item_name,
      drop_chance: entry.drop_chance,
      quantity: entry.quantity,
      icon_url: entry.icon_filename ? `/item-icons/${entry.icon_filename}` : null,
    });
  } catch (err) {
    log('error', 'Failed to update loot entry', { lootId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/monsters/:id/loot/:lootId ──────────────────────────────────

monstersRouter.delete('/:id/loot/:lootId', async (req: Request, res: Response) => {
  const lootId = parseInt(req.params.lootId!, 10);
  if (isNaN(lootId)) return res.status(400).json({ error: 'Invalid loot id' });

  try {
    await deleteLootEntry(lootId);
    log('info', 'Deleted loot entry', { lootId, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete loot entry', { lootId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
