import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllSpells,
  getSpellById,
  createSpell,
  updateSpell,
  deleteSpell,
  getSpellLevels,
  upsertSpellLevels,
  getAllSpellCosts,
  upsertSpellCosts,
  type SpellRow,
} from '../../../../backend/src/db/queries/spells';
import { resizeUpload } from '../middleware/resize-upload';

export const spellsRouter = Router();

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/spells/icons');

const VALID_EFFECT_TYPES = [
  'attack_pct', 'defence_pct', 'crit_chance_pct', 'crit_damage_pct',
  'heal', 'movement_speed', 'energy',
];

function buildIconUrl(filename: string | null): string | null {
  return filename ? `/spell-icons/${filename}` : null;
}

function spellToResponse(s: SpellRow) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    effect_type: s.effect_type,
    effect_value: s.effect_value,
    duration_seconds: s.duration_seconds,
    icon_url: buildIconUrl(s.icon_filename),
    created_at: s.created_at,
  };
}

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
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

// ── GET /api/spells ──────────────────────────────────────────────────────

spellsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const spells = await getAllSpells();
    return res.json(spells.map(spellToResponse));
  } catch (err) {
    log('error', 'Failed to list spells', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/spells/:id ──────────────────────────────────────────────────

spellsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid spell id' });

  try {
    const spell = await getSpellById(id);
    if (!spell) return res.status(404).json({ error: 'Spell not found' });
    return res.json(spellToResponse(spell));
  } catch (err) {
    log('error', 'Failed to get spell', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/spells ─────────────────────────────────────────────────────

spellsRouter.post('/', upload.single('icon'), resizeUpload(), async (req: Request, res: Response) => {
  const { name, description, effect_type, effect_value, duration_seconds } =
    req.body as Record<string, string>;

  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!effect_type || !VALID_EFFECT_TYPES.includes(effect_type)) {
    return res.status(400).json({ error: `effect_type must be one of: ${VALID_EFFECT_TYPES.join(', ')}` });
  }

  const effectValueNum = parseInt(effect_value ?? '0', 10);
  const durationNum = parseInt(duration_seconds ?? '0', 10);

  if (isNaN(effectValueNum) || effectValueNum < 0) return res.status(400).json({ error: 'effect_value must be a non-negative integer' });
  if (isNaN(durationNum) || durationNum < 0) return res.status(400).json({ error: 'duration_seconds must be a non-negative integer' });

  let iconFilename: string | null = null;
  if (req.file) {
    if (!validatePngMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
    }
    iconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, iconFilename), req.file.buffer);
  } else if (req.body['icon_base64'] && typeof req.body['icon_base64'] === 'string') {
    const buf = Buffer.from(req.body['icon_base64'] as string, 'base64');
    if (!validatePngMagicBytes(buf)) {
      return res.status(400).json({ error: 'icon_base64 is not a valid PNG' });
    }
    iconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, iconFilename), buf);
  }

  try {
    const spell = await createSpell({
      name: name.trim(),
      icon_filename: iconFilename,
      description: description ?? '',
      effect_type,
      effect_value: effectValueNum,
      duration_seconds: durationNum,
    });
    log('info', 'Created spell', { id: spell.id, name: spell.name, admin: req.username });
    return res.status(201).json(spellToResponse(spell));
  } catch (err) {
    if (iconFilename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, iconFilename)); } catch { /* ignore */ }
    }
    log('error', 'Failed to create spell', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/spells/:id ──────────────────────────────────────────────────

spellsRouter.put('/:id', upload.single('icon'), resizeUpload(), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid spell id' });

  const existing = await getSpellById(id);
  if (!existing) return res.status(404).json({ error: 'Spell not found' });

  const { name, description, effect_type, effect_value, duration_seconds } =
    req.body as Record<string, string>;

  const data: Parameters<typeof updateSpell>[1] = {};

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = name.trim();
  }
  if (description !== undefined) data.description = description;
  if (effect_type !== undefined) {
    if (!VALID_EFFECT_TYPES.includes(effect_type)) {
      return res.status(400).json({ error: `effect_type must be one of: ${VALID_EFFECT_TYPES.join(', ')}` });
    }
    data.effect_type = effect_type;
  }
  if (effect_value !== undefined) {
    const v = parseInt(effect_value, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'effect_value must be a non-negative integer' });
    data.effect_value = v;
  }
  if (duration_seconds !== undefined) {
    const v = parseInt(duration_seconds, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'duration_seconds must be a non-negative integer' });
    data.duration_seconds = v;
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
  } else if (req.body['icon_base64'] && typeof req.body['icon_base64'] === 'string') {
    const buf = Buffer.from(req.body['icon_base64'] as string, 'base64');
    if (!validatePngMagicBytes(buf)) {
      return res.status(400).json({ error: 'icon_base64 is not a valid PNG' });
    }
    newIconFilename = `${randomUUID()}.png`;
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ICONS_DIR, newIconFilename), buf);
    data.icon_filename = newIconFilename;
  }

  try {
    const updated = await updateSpell(id, data);
    if (!updated) return res.status(404).json({ error: 'Spell not found' });

    if (newIconFilename && existing.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, existing.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Updated spell', { id, admin: req.username });
    return res.json(spellToResponse(updated));
  } catch (err) {
    if (newIconFilename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, newIconFilename)); } catch { /* ignore */ }
    }
    log('error', 'Failed to update spell', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/spells/:id/levels ──────────────────────────────────────────

spellsRouter.get('/:id/levels', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid spell id' });

  try {
    const spell = await getSpellById(id);
    if (!spell) return res.status(404).json({ error: 'Spell not found' });

    const levels = await getSpellLevels(id);
    const costs = await getAllSpellCosts(id);
    return res.json({ levels, costs });
  } catch (err) {
    log('error', 'Failed to get spell levels', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/spells/:id/levels ──────────────────────────────────────────

spellsRouter.put('/:id/levels', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid spell id' });

  try {
    const spell = await getSpellById(id);
    if (!spell) return res.status(404).json({ error: 'Spell not found' });

    const { levels } = req.body as { levels?: unknown[] };
    if (!Array.isArray(levels)) {
      return res.status(400).json({ error: 'levels must be an array' });
    }

    for (const l of levels) {
      const row = l as Record<string, unknown>;
      const level = Number(row.level);
      const effectValue = Number(row.effect_value);
      const durationSeconds = Number(row.duration_seconds);
      const goldCost = Number(row.gold_cost);

      if (!Number.isInteger(level) || level < 1 || level > 5) {
        return res.status(400).json({ error: 'Each level must be an integer 1–5' });
      }
      if (!Number.isInteger(effectValue) || effectValue < 0) {
        return res.status(400).json({ error: 'effect_value must be a non-negative integer' });
      }
      if (!Number.isInteger(durationSeconds) || durationSeconds < 0) {
        return res.status(400).json({ error: 'duration_seconds must be a non-negative integer' });
      }
      if (!Number.isInteger(goldCost) || goldCost < 0) {
        return res.status(400).json({ error: 'gold_cost must be a non-negative integer' });
      }
    }

    const saved = await upsertSpellLevels(
      id,
      levels.map((l) => {
        const row = l as Record<string, unknown>;
        return {
          level: Number(row.level),
          effect_value: Number(row.effect_value),
          duration_seconds: Number(row.duration_seconds),
          gold_cost: Number(row.gold_cost),
        };
      }),
    );

    log('info', 'Updated spell levels', { id, count: saved.length, admin: req.username });
    return res.json(saved);
  } catch (err) {
    log('error', 'Failed to update spell levels', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/spells/:id/costs ──────────────────────────────────────────

spellsRouter.put('/:id/costs', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid spell id' });

  try {
    const spell = await getSpellById(id);
    if (!spell) return res.status(404).json({ error: 'Spell not found' });

    const { level, costs } = req.body as { level?: number; costs?: unknown[] };
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 5) {
      return res.status(400).json({ error: 'level must be an integer 1–5' });
    }
    if (!Array.isArray(costs)) {
      return res.status(400).json({ error: 'costs must be an array' });
    }

    for (const c of costs) {
      const row = c as Record<string, unknown>;
      const itemDefId = Number(row.item_def_id);
      const quantity = Number(row.quantity);
      if (!Number.isInteger(itemDefId) || itemDefId < 1) {
        return res.status(400).json({ error: 'item_def_id must be a positive integer' });
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'quantity must be a positive integer' });
      }
    }

    await upsertSpellCosts(
      id,
      level,
      costs.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          item_def_id: Number(row.item_def_id),
          quantity: Number(row.quantity),
        };
      }),
    );

    log('info', 'Updated spell costs', { id, level, count: costs.length, admin: req.username });
    const allCosts = await getAllSpellCosts(id);
    return res.json(allCosts);
  } catch (err) {
    log('error', 'Failed to update spell costs', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/spells/:id ──────────────────────────────────────────────

spellsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid spell id' });

  try {
    const spell = await getSpellById(id);
    if (!spell) return res.status(404).json({ error: 'Spell not found' });

    await deleteSpell(id);

    if (spell.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, spell.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Deleted spell', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete spell', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
