import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllNpcs,
  getNpcById,
  createNpc,
  updateNpc,
  deleteNpc,
  type Npc,
} from '../../../../backend/src/db/queries/npcs';

export const npcsRouter = Router();

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/npcs/icons');

function buildIconUrl(filename: string): string {
  return `/npc-icons/${filename}`;
}

function npcToResponse(n: Npc) {
  return {
    id: n.id,
    name: n.name,
    description: n.description,
    icon_filename: n.icon_filename,
    icon_url: buildIconUrl(n.icon_filename),
    is_crafter: n.is_crafter,
    created_at: n.created_at,
  };
}

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
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

// ── POST /api/npcs/upload ───────────────────────────────────────────────────
// Must be defined before /:id routes to avoid "upload" being treated as an id

npcsRouter.post('/upload', upload.single('icon'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'icon file is required' });
  }
  if (!validatePngMagicBytes(req.file.buffer)) {
    return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
  }

  const iconFilename = `${randomUUID()}.png`;
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICONS_DIR, iconFilename), req.file.buffer);

  log('info', 'Uploaded NPC icon', { iconFilename, admin: req.username });
  return res.json({
    icon_filename: iconFilename,
    icon_url: buildIconUrl(iconFilename),
  });
});

// ── GET /api/npcs ───────────────────────────────────────────────────────────

npcsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const npcs = await getAllNpcs();
    return res.json(npcs.map(npcToResponse));
  } catch (err) {
    log('error', 'Failed to list NPCs', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/npcs ──────────────────────────────────────────────────────────

npcsRouter.post('/', async (req: Request, res: Response) => {
  const { name, description, icon_filename } = req.body as Record<string, string>;

  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!description || !description.trim()) return res.status(400).json({ error: 'description is required' });
  if (!icon_filename || !icon_filename.trim()) return res.status(400).json({ error: 'icon_filename is required' });

  try {
    const npc = await createNpc({
      name: name.trim(),
      description: description.trim(),
      icon_filename: icon_filename.trim(),
    });
    log('info', 'Created NPC', { id: npc.id, name: npc.name, admin: req.username });
    return res.status(201).json(npcToResponse(npc));
  } catch (err) {
    log('error', 'Failed to create NPC', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/npcs/:id ───────────────────────────────────────────────────────

npcsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NPC id' });

  const existing = await getNpcById(id);
  if (!existing) return res.status(404).json({ error: 'NPC not found' });

  const { name, description, icon_filename } = req.body as Record<string, string>;
  const data: Parameters<typeof updateNpc>[1] = {};

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    data.name = name.trim();
  }
  if (description !== undefined) {
    if (!description.trim()) return res.status(400).json({ error: 'description cannot be empty' });
    data.description = description.trim();
  }
  if (icon_filename !== undefined) {
    if (!icon_filename.trim()) return res.status(400).json({ error: 'icon_filename cannot be empty' });
    data.icon_filename = icon_filename.trim();
  }

  try {
    const updated = await updateNpc(id, data);
    if (!updated) return res.status(404).json({ error: 'NPC not found' });

    // Remove old icon file if replaced
    if (data.icon_filename && existing.icon_filename && data.icon_filename !== existing.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, existing.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Updated NPC', { id, admin: req.username });
    return res.json(npcToResponse(updated));
  } catch (err) {
    log('error', 'Failed to update NPC', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/npcs/:id/crafter ──────────────────────────────────────────────

npcsRouter.put('/:id/crafter', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NPC id' });

  const { is_crafter } = req.body as Record<string, unknown>;
  if (typeof is_crafter !== 'boolean') {
    return res.status(400).json({ error: 'is_crafter must be a boolean' });
  }

  try {
    const existing = await getNpcById(id);
    if (!existing) return res.status(404).json({ error: 'NPC not found' });

    const { query } = await import('../../../../backend/src/db/connection');
    await query('UPDATE npcs SET is_crafter = $1 WHERE id = $2', [is_crafter, id]);

    const updated = await getNpcById(id);
    log('info', 'Updated NPC crafter status', { id, is_crafter, admin: req.username });
    return res.json(npcToResponse(updated!));
  } catch (err) {
    log('error', 'Failed to update NPC crafter status', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/npcs/:id/squire-dismisser ───────────────────────────────────

npcsRouter.put('/:id/squire-dismisser', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NPC id' });

  const { is_squire_dismisser } = req.body as Record<string, unknown>;
  if (typeof is_squire_dismisser !== 'boolean') {
    return res.status(400).json({ error: 'is_squire_dismisser must be a boolean' });
  }

  try {
    const existing = await getNpcById(id);
    if (!existing) return res.status(404).json({ error: 'NPC not found' });

    const { query } = await import('../../../../backend/src/db/connection');
    await query('UPDATE npcs SET is_squire_dismisser = $1 WHERE id = $2', [is_squire_dismisser, id]);

    const updated = await getNpcById(id);
    log('info', 'Updated NPC squire dismisser status', { id, is_squire_dismisser, admin: req.username });
    return res.json(npcToResponse(updated!));
  } catch (err) {
    log('error', 'Failed to update NPC squire dismisser status', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/npcs/:id ────────────────────────────────────────────────────

npcsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid NPC id' });

  try {
    const npc = await getNpcById(id);
    if (!npc) return res.status(404).json({ error: 'NPC not found' });

    await deleteNpc(id);

    try { fs.unlinkSync(path.join(ICONS_DIR, npc.icon_filename)); } catch { /* ignore */ }

    log('info', 'Deleted NPC', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete NPC', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
