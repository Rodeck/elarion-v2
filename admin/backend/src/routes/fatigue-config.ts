import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllFatigueConfigs,
  upsertFatigueConfig,
  updateFatigueIconFilename,
} from '../../../../backend/src/db/queries/fatigue-config';
import { resizeUpload } from '../middleware/resize-upload';

export const fatigueConfigRouter = Router();

const VALID_COMBAT_TYPES = new Set(['monster', 'boss', 'pvp']);

const FATIGUE_ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/fatigue-icons');

// Ensure fatigue icons directory exists
if (!fs.existsSync(FATIGUE_ICONS_DIR)) {
  fs.mkdirSync(FATIGUE_ICONS_DIR, { recursive: true });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

// GET /api/fatigue-config
fatigueConfigRouter.get('/', async (req: Request, res: Response) => {
  try {
    const configs = await getAllFatigueConfigs();
    const result = configs.map((c) => ({
      ...c,
      icon_url: c.icon_filename ? `/fatigue-icons/${c.icon_filename}` : null,
    }));
    return res.json(result);
  } catch (err) {
    log('error', 'fatigue_config_fetch_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/fatigue-config/:combat_type
fatigueConfigRouter.put('/:combat_type', async (req: Request, res: Response) => {
  const combatType = req.params['combat_type']!;
  if (!VALID_COMBAT_TYPES.has(combatType)) {
    return res.status(400).json({ error: `combat_type must be one of: monster, boss, pvp` });
  }

  const { start_round, base_damage, damage_increment } = req.body as Record<string, unknown>;

  const startRound = Number(start_round);
  const baseDamage = Number(base_damage);
  const dmgIncrement = Number(damage_increment);

  if (!Number.isInteger(startRound) || startRound < 0) {
    return res.status(400).json({ error: 'start_round must be a non-negative integer' });
  }
  if (!Number.isInteger(baseDamage) || baseDamage < 0) {
    return res.status(400).json({ error: 'base_damage must be a non-negative integer' });
  }
  if (!Number.isInteger(dmgIncrement) || dmgIncrement < 0) {
    return res.status(400).json({ error: 'damage_increment must be a non-negative integer' });
  }

  try {
    const updated = await upsertFatigueConfig(combatType, startRound, baseDamage, dmgIncrement);
    log('info', 'fatigue_config_updated', {
      admin: req.username,
      combat_type: combatType,
      start_round: startRound,
      base_damage: baseDamage,
      damage_increment: dmgIncrement,
    });
    return res.json({
      ...updated,
      icon_url: updated.icon_filename ? `/fatigue-icons/${updated.icon_filename}` : null,
    });
  } catch (err) {
    log('error', 'fatigue_config_update_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/fatigue-config/:combat_type/icon
fatigueConfigRouter.post(
  '/:combat_type/icon',
  upload.single('icon'),
  resizeUpload(64),
  async (req: Request, res: Response) => {
    const combatType = req.params['combat_type']!;
    if (!VALID_COMBAT_TYPES.has(combatType)) {
      return res.status(400).json({ error: `combat_type must be one of: monster, boss, pvp` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No icon file uploaded' });
    }

    const filename = `${randomUUID()}.png`;
    const filePath = path.join(FATIGUE_ICONS_DIR, filename);

    try {
      fs.writeFileSync(filePath, req.file.buffer);
      const updated = await updateFatigueIconFilename(combatType, filename);
      log('info', 'fatigue_icon_uploaded', { admin: req.username, combat_type: combatType, filename });
      return res.json({
        ...updated,
        icon_url: `/fatigue-icons/${updated.icon_filename}`,
      });
    } catch (err) {
      log('error', 'fatigue_icon_upload_failed', { admin: req.username, error: String(err) });
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);
