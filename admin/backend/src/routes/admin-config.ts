import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  getAllConfig,
  upsertConfigValue,
  getConfigValue,
  isKnownKey,
  VALID_IMAGE_GEN_MODELS,
} from '../../../../backend/src/db/queries/admin-config';

const UI_ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/ui-icons');
if (!fs.existsSync(UI_ICONS_DIR)) fs.mkdirSync(UI_ICONS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype === 'image/png');
  },
});

export const adminConfigRouter = Router();

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

// GET /api/admin-config
adminConfigRouter.get('/', async (req: Request, res: Response) => {
  try {
    const config = await getAllConfig();
    log('info', 'admin_config_fetched', { admin: req.username });
    return res.json(config);
  } catch (err) {
    log('error', 'admin_config_fetch_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin-config
adminConfigRouter.put('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  // Validate all keys
  for (const key of Object.keys(body)) {
    if (!isKnownKey(key)) {
      return res.status(400).json({ error: `Unknown config key: ${key}` });
    }
  }
  // Validate image_gen_model value
  if (body['image_gen_model'] !== undefined) {
    if (!(VALID_IMAGE_GEN_MODELS as readonly string[]).includes(body['image_gen_model'] as string)) {
      return res.status(400).json({ error: `image_gen_model must be one of: ${VALID_IMAGE_GEN_MODELS.join(', ')}` });
    }
  }
  try {
    for (const [key, value] of Object.entries(body)) {
      await upsertConfigValue(key, String(value));
    }
    const updated = await getAllConfig();
    log('info', 'admin_config_updated', { admin: req.username, keys: Object.keys(body) });
    return res.json(updated);
  } catch (err) {
    log('error', 'admin_config_update_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin-config/icon/:type  (type = 'xp' | 'crowns')
adminConfigRouter.post('/icon/:type', upload.single('icon'), async (req: Request, res: Response) => {
  const iconType = req.params['type'];
  if (iconType !== 'xp' && iconType !== 'crowns' && iconType !== 'rod_upgrade_points') {
    return res.status(400).json({ error: 'Icon type must be "xp", "crowns", or "rod_upgrade_points".' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No icon file uploaded.' });
  }

  const configKeyMap: Record<string, string> = {
    xp: 'xp_icon_filename',
    crowns: 'crowns_icon_filename',
    rod_upgrade_points: 'rod_upgrade_points_icon_filename',
  };
  const configKey = configKeyMap[iconType]!;

  try {
    // Remove old icon if exists
    const oldFilename = await getConfigValue(configKey);
    if (oldFilename) {
      const oldPath = path.join(UI_ICONS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Save new icon
    const filename = `${iconType}_${randomUUID()}.png`;
    fs.writeFileSync(path.join(UI_ICONS_DIR, filename), req.file.buffer);

    await upsertConfigValue(configKey, filename);

    log('info', 'ui_icon_uploaded', { admin: req.username, type: iconType, filename });
    return res.json({
      filename,
      icon_url: `/ui-icons/${filename}`,
    });
  } catch (err) {
    log('error', 'ui_icon_upload_failed', { admin: req.username, type: iconType, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin-config/ui-icons — public endpoint for game frontend to fetch icon URLs
adminConfigRouter.get('/ui-icons', async (_req: Request, res: Response) => {
  try {
    const xpFilename = await getConfigValue('xp_icon_filename');
    const crownsFilename = await getConfigValue('crowns_icon_filename');
    const rodPtsFilename = await getConfigValue('rod_upgrade_points_icon_filename');
    return res.json({
      xp_icon_url: xpFilename ? `/ui-icons/${xpFilename}` : null,
      crowns_icon_url: crownsFilename ? `/ui-icons/${crownsFilename}` : null,
      rod_upgrade_points_icon_url: rodPtsFilename ? `/ui-icons/${rodPtsFilename}` : null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
