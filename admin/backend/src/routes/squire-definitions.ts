import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllSquireDefinitions,
  getSquireDefinitionById,
  createSquireDefinition,
  updateSquireDefinition,
  deactivateSquireDefinition,
  hasPlayersOwningDefinition,
  type SquireDefinition,
} from '../../../../backend/src/db/queries/squire-definitions';

export const squireDefinitionsRouter = Router();

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/squires/icons');

function buildIconUrl(filename: string | null): string | null {
  return filename ? `/squire-icons/${filename}` : null;
}

function definitionToResponse(d: SquireDefinition) {
  return {
    id: d.id,
    name: d.name,
    icon_filename: d.icon_filename,
    icon_url: buildIconUrl(d.icon_filename),
    power_level: d.power_level,
    is_active: d.is_active,
    created_at: d.created_at,
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

// ── GET /api/squire-definitions ───────────────────────────────────────────────

squireDefinitionsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const definitions = await getAllSquireDefinitions();
    return res.json(definitions.map(definitionToResponse));
  } catch (err) {
    log('error', 'Failed to list squire definitions', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/squire-definitions/:id ───────────────────────────────────────────

squireDefinitionsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid squire definition id' });

  try {
    const definition = await getSquireDefinitionById(id);
    if (!definition) return res.status(404).json({ error: 'Squire definition not found' });
    return res.json(definitionToResponse(definition));
  } catch (err) {
    log('error', 'Failed to get squire definition', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/squire-definitions ──────────────────────────────────────────────

squireDefinitionsRouter.post('/', async (req: Request, res: Response) => {
  const { name, power_level } = req.body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required and must be a non-empty string' });
  }

  const powerLevel = Number(power_level);
  if (power_level === undefined || power_level === null || !Number.isInteger(powerLevel) || powerLevel < 0 || powerLevel > 100) {
    return res.status(400).json({ error: 'power_level must be an integer between 0 and 100' });
  }

  try {
    const definition = await createSquireDefinition({
      name: (name as string).trim(),
      power_level: powerLevel,
    });
    log('info', 'Created squire definition', { id: definition.id, name: definition.name, admin: req.username });
    return res.status(201).json(definitionToResponse(definition));
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Squire definition name already exists' });
    }
    log('error', 'Failed to create squire definition', { error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/squire-definitions/:id ───────────────────────────────────────────

squireDefinitionsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid squire definition id' });

  const existing = await getSquireDefinitionById(id);
  if (!existing) return res.status(404).json({ error: 'Squire definition not found' });

  const { name, power_level, icon_filename } = req.body as Record<string, unknown>;
  const data: { name?: string; power_level?: number; icon_filename?: string } = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    data.name = (name as string).trim();
  }

  if (power_level !== undefined) {
    const v = Number(power_level);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return res.status(400).json({ error: 'power_level must be an integer between 0 and 100' });
    }
    data.power_level = v;
  }

  if (icon_filename !== undefined) {
    if (typeof icon_filename !== 'string' || !icon_filename.trim()) {
      return res.status(400).json({ error: 'icon_filename cannot be empty' });
    }
    data.icon_filename = (icon_filename as string).trim();
  }

  try {
    const updated = await updateSquireDefinition(id, data);
    if (!updated) return res.status(404).json({ error: 'Squire definition not found' });

    // Remove old icon file if replaced
    if (data.icon_filename && existing.icon_filename && data.icon_filename !== existing.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, existing.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Updated squire definition', { id, admin: req.username });
    return res.json(definitionToResponse(updated));
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Squire definition name already exists' });
    }
    log('error', 'Failed to update squire definition', { id, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/squire-definitions/:id/deactivate ───────────────────────────────

squireDefinitionsRouter.put('/:id/deactivate', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid squire definition id' });

  try {
    const existing = await getSquireDefinitionById(id);
    if (!existing) return res.status(404).json({ error: 'Squire definition not found' });

    if (!existing.is_active) {
      return res.status(400).json({ error: 'Squire definition is already deactivated' });
    }

    const hasPlayers = await hasPlayersOwningDefinition(id);

    const deactivated = await deactivateSquireDefinition(id);
    if (!deactivated) return res.status(404).json({ error: 'Squire definition not found' });

    log('info', 'Deactivated squire definition', { id, has_players_owning: hasPlayers, admin: req.username });
    return res.json({
      ...definitionToResponse(deactivated),
      warning: hasPlayers ? 'Players currently own squires of this definition' : undefined,
    });
  } catch (err) {
    log('error', 'Failed to deactivate squire definition', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/squire-definitions/:id/icon ────────────────────────────────────

squireDefinitionsRouter.post('/:id/icon', upload.single('icon'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid squire definition id' });

  const existing = await getSquireDefinitionById(id);
  if (!existing) return res.status(404).json({ error: 'Squire definition not found' });

  if (!req.file) {
    return res.status(400).json({ error: 'icon file is required' });
  }

  if (!validatePngMagicBytes(req.file.buffer)) {
    return res.status(400).json({ error: 'Uploaded file is not a valid PNG' });
  }

  const iconFilename = `${randomUUID()}.png`;
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICONS_DIR, iconFilename), req.file.buffer);

  try {
    const updated = await updateSquireDefinition(id, { icon_filename: iconFilename });
    if (!updated) {
      // Clean up uploaded file if DB update failed
      try { fs.unlinkSync(path.join(ICONS_DIR, iconFilename)); } catch { /* ignore */ }
      return res.status(404).json({ error: 'Squire definition not found' });
    }

    // Remove old icon file if replaced
    if (existing.icon_filename) {
      try { fs.unlinkSync(path.join(ICONS_DIR, existing.icon_filename)); } catch { /* ignore */ }
    }

    log('info', 'Uploaded squire definition icon', { id, iconFilename, admin: req.username });
    return res.json(definitionToResponse(updated));
  } catch (err) {
    // Clean up uploaded file on error
    try { fs.unlinkSync(path.join(ICONS_DIR, iconFilename)); } catch { /* ignore */ }
    log('error', 'Failed to upload squire definition icon', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
