import { Router, Request, Response } from 'express';
import {
  getAllConfig,
  upsertConfigValue,
  isKnownKey,
  VALID_IMAGE_GEN_MODELS,
} from '../../../../backend/src/db/queries/admin-config';

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
