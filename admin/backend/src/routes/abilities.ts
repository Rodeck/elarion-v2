import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllAbilities,
  getAbilityById,
  createAbility,
  updateAbility,
  deleteAbility,
  type AbilityRow,
} from '../../../../backend/src/db/queries/abilities';
import { resizeUpload } from '../middleware/resize-upload';

export const abilitiesRouter = Router();

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/ability-icons');

const VALID_EFFECT_TYPES = ['damage', 'heal', 'buff', 'debuff', 'dot', 'reflect', 'drain'];
const VALID_SLOT_TYPES = ['auto', 'active', 'both'];

function buildIconUrl(filename: string | null): string | null {
  return filename ? `/ability-icons/${filename}` : null;
}

function abilityToResponse(a: AbilityRow) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    effect_type: a.effect_type,
    mana_cost: a.mana_cost,
    effect_value: a.effect_value,
    duration_turns: a.duration_turns,
    cooldown_turns: a.cooldown_turns,
    priority_default: a.priority_default,
    slot_type: a.slot_type,
    icon_url: buildIconUrl(a.icon_filename),
    created_at: a.created_at,
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

// ── GET /api/abilities ──────────────────────────────────────────────────────

abilitiesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const abilities = await getAllAbilities();
    return res.json(abilities.map(abilityToResponse));
  } catch (err) {
    log('error', 'Failed to list abilities', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/abilities/:id ──────────────────────────────────────────────────

abilitiesRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ability id' });

  try {
    const ability = await getAbilityById(id);
    if (!ability) return res.status(404).json({ error: 'Ability not found' });
    return res.json(abilityToResponse(ability));
  } catch (err) {
    log('error', 'Failed to get ability', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/abilities ─────────────────────────────────────────────────────

abilitiesRouter.post('/', upload.single('icon'), resizeUpload(), async (req: Request, res: Response) => {
  const { name, description, effect_type, mana_cost, effect_value, duration_turns, cooldown_turns, priority_default, slot_type } =
    req.body as Record<string, string>;

  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!effect_type || !VALID_EFFECT_TYPES.includes(effect_type)) {
    return res.status(400).json({ error: `effect_type must be one of: ${VALID_EFFECT_TYPES.join(', ')}` });
  }

  const manaCostNum = parseInt(mana_cost ?? '', 10);
  const effectValueNum = parseInt(effect_value ?? '', 10);
  const durationNum = parseInt(duration_turns ?? '0', 10);
  const cooldownNum = parseInt(cooldown_turns ?? '0', 10);
  const priorityNum = parseInt(priority_default ?? '1', 10);
  const slotTypeVal = slot_type ?? 'both';

  if (isNaN(manaCostNum) || manaCostNum < 0) return res.status(400).json({ error: 'mana_cost must be a non-negative integer' });
  if (isNaN(effectValueNum) || effectValueNum < 0) return res.status(400).json({ error: 'effect_value must be a non-negative integer' });
  if (isNaN(durationNum) || durationNum < 0) return res.status(400).json({ error: 'duration_turns must be a non-negative integer' });
  if (isNaN(cooldownNum) || cooldownNum < 0) return res.status(400).json({ error: 'cooldown_turns must be a non-negative integer' });
  if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 99) return res.status(400).json({ error: 'priority_default must be 1–99' });
  if (!VALID_SLOT_TYPES.includes(slotTypeVal)) return res.status(400).json({ error: `slot_type must be one of: ${VALID_SLOT_TYPES.join(', ')}` });

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
    const ability = await createAbility({
      name: name.trim(),
      icon_filename: iconFilename,
      description: description ?? '',
      effect_type,
      mana_cost: manaCostNum,
      effect_value: effectValueNum,
      duration_turns: durationNum,
      cooldown_turns: cooldownNum,
      priority_default: priorityNum,
      slot_type: slotTypeVal,
    });
    log('info', 'Created ability', { id: ability.id, name: ability.name, admin: req.username });
    return res.status(201).json(abilityToResponse(ability));
  } catch (err) {
    if (iconFilename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, iconFilename)); } catch { /* ignore */ }
    }
    log('error', 'Failed to create ability', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/abilities/:id ──────────────────────────────────────────────────

abilitiesRouter.put('/:id', upload.single('icon'), resizeUpload(), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ability id' });

  const existing = await getAbilityById(id);
  if (!existing) return res.status(404).json({ error: 'Ability not found' });

  const { name, description, mana_cost, effect_value, duration_turns, cooldown_turns, priority_default, slot_type } =
    req.body as Record<string, string>;

  const data: Parameters<typeof updateAbility>[1] = {};

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = name.trim();
  }
  if (description !== undefined) data.description = description;
  if (mana_cost !== undefined) {
    const v = parseInt(mana_cost, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'mana_cost must be a non-negative integer' });
    data.mana_cost = v;
  }
  if (effect_value !== undefined) {
    const v = parseInt(effect_value, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'effect_value must be a non-negative integer' });
    data.effect_value = v;
  }
  if (duration_turns !== undefined) {
    const v = parseInt(duration_turns, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'duration_turns must be a non-negative integer' });
    data.duration_turns = v;
  }
  if (cooldown_turns !== undefined) {
    const v = parseInt(cooldown_turns, 10);
    if (isNaN(v) || v < 0) return res.status(400).json({ error: 'cooldown_turns must be a non-negative integer' });
    data.cooldown_turns = v;
  }
  if (priority_default !== undefined) {
    const v = parseInt(priority_default, 10);
    if (isNaN(v) || v < 1 || v > 99) return res.status(400).json({ error: 'priority_default must be 1–99' });
    data.priority_default = v;
  }
  if (slot_type !== undefined) {
    if (!VALID_SLOT_TYPES.includes(slot_type)) return res.status(400).json({ error: `slot_type must be one of: ${VALID_SLOT_TYPES.join(', ')}` });
    data.slot_type = slot_type;
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
    const updated = await updateAbility(id, data);
    if (!updated) return res.status(404).json({ error: 'Ability not found' });

    if (newIconFilename && existing.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, existing.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Updated ability', { id, admin: req.username });
    return res.json(abilityToResponse(updated));
  } catch (err) {
    if (newIconFilename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, newIconFilename)); } catch { /* ignore */ }
    }
    log('error', 'Failed to update ability', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/abilities/:id ───────────────────────────────────────────────

abilitiesRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ability id' });

  try {
    const ability = await getAbilityById(id);
    if (!ability) return res.status(404).json({ error: 'Ability not found' });

    await deleteAbility(id);

    if (ability.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, ability.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Deleted ability', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete ability', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
