import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  getItemDefinitions,
  getItemDefinitionById,
  createItemDefinition,
  updateItemDefinition,
  deleteItemDefinition,
  type ItemDefinition,
} from '../../../../backend/src/db/queries/inventory';

export const itemsRouter = Router();

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ICONS_DIR = path.resolve(__dirname, '../../../../backend/assets/items/icons');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, fieldSize: 4 * 1024 * 1024 }, // 2 MB file, 4 MB fields (for icon_base64)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(null, false);
  },
});

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

function isValidPng(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES);
}

const VALID_CATEGORIES = ['resource', 'food', 'heal', 'weapon', 'boots', 'shield', 'greaves', 'bracer', 'tool', 'helmet', 'chestplate'] as const;
const VALID_WEAPON_SUBTYPES = ['one_handed', 'two_handed', 'dagger', 'wand', 'staff', 'bow'] as const;
const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food']);
const DEFENCE_CATEGORIES = new Set(['boots', 'shield', 'greaves', 'bracer', 'helmet', 'chestplate']);

type ItemCategory = typeof VALID_CATEGORIES[number];

function buildIconUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `/item-icons/${filename}`;
}

function formatItem(item: ItemDefinition) {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    category: item.category,
    weapon_subtype: item.weapon_subtype ?? null,
    attack: item.attack ?? null,
    defence: item.defence ?? null,
    heal_power: item.heal_power ?? null,
    food_power: item.food_power ?? null,
    stack_size: item.stack_size ?? null,
    icon_url: buildIconUrl(item.icon_filename),
    created_at: item.created_at,
  };
}

function validateItemFields(body: Record<string, unknown>, isCreate: boolean): string | null {
  const category = body['category'] as string | undefined;

  if (isCreate) {
    if (!category) return 'category is required';
  }

  if (category !== undefined) {
    if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
      return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
    }

    const weaponSubtype = body['weapon_subtype'] as string | undefined | null;

    if (category === 'weapon') {
      if (!weaponSubtype) return 'weapon_subtype is required for category "weapon"';
      if (!(VALID_WEAPON_SUBTYPES as readonly string[]).includes(weaponSubtype)) {
        return `weapon_subtype must be one of: ${VALID_WEAPON_SUBTYPES.join(', ')}`;
      }
    } else {
      if (weaponSubtype) return 'weapon_subtype is only allowed for category "weapon"';
    }

    if (body['attack'] !== undefined && body['attack'] !== null && category !== 'weapon') {
      return 'attack is only allowed for category "weapon"';
    }
    if (body['defence'] !== undefined && body['defence'] !== null && !DEFENCE_CATEGORIES.has(category)) {
      return 'defence is only allowed for categories: boots, shield, greaves, bracer, helmet, chestplate';
    }
    if (body['heal_power'] !== undefined && body['heal_power'] !== null && category !== 'heal') {
      return 'heal_power is only allowed for category "heal"';
    }
    if (body['food_power'] !== undefined && body['food_power'] !== null && category !== 'food') {
      return 'food_power is only allowed for category "food"';
    }
    if (isCreate && STACKABLE_CATEGORIES.has(category) && (body['stack_size'] === undefined || body['stack_size'] === null)) {
      return `stack_size is required for category "${category}"`;
    }
    if (isCreate && !STACKABLE_CATEGORIES.has(category) && body['stack_size'] !== undefined && body['stack_size'] !== null) {
      return `stack_size is not allowed for category "${category}"`;
    }
  }

  const name = body['name'] as string | undefined;
  if (isCreate && (!name || typeof name !== 'string' || name.trim().length === 0)) {
    return 'name is required and must be a non-empty string';
  }
  if (name !== undefined && name.trim().length > 64) {
    return 'name must be 64 characters or fewer';
  }

  for (const field of ['attack', 'defence', 'heal_power', 'food_power'] as const) {
    const val = body[field];
    if (val !== undefined && val !== null) {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 0) return `${field} must be a non-negative integer`;
    }
  }
  const stackSize = body['stack_size'];
  if (stackSize !== undefined && stackSize !== null) {
    const n = Number(stackSize);
    if (!Number.isInteger(n) || n < 1) return 'stack_size must be a positive integer';
  }

  return null;
}

// ─── POST /api/items/batch-icons ─────────────────────────────────────────────

itemsRouter.post(
  '/batch-icons',
  express.json({ limit: '50mb' }),
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const icons = body['icons'];

    if (!Array.isArray(icons) || icons.length === 0) {
      return res.status(400).json({ error: 'icons must be a non-empty array' });
    }
    if (icons.length > 256) {
      return res.status(400).json({ error: 'icons array must not exceed 256 entries' });
    }

    // Check for duplicate item_ids
    const itemIds = icons.map((e: Record<string, unknown>) => e['item_id']);
    const idSet = new Set(itemIds);
    if (idSet.size !== itemIds.length) {
      return res.status(400).json({ error: 'Duplicate item_id values in request' });
    }

    const results: Array<{ item_id: number; icon_url?: string; error?: string; status: string }> = [];
    let updated = 0;
    let failed = 0;

    for (const entry of icons) {
      const itemId = Number((entry as Record<string, unknown>)['item_id']);
      const iconBase64 = (entry as Record<string, unknown>)['icon_base64'] as string | undefined;

      if (!Number.isInteger(itemId) || itemId <= 0) {
        results.push({ item_id: itemId, error: 'Invalid item_id', status: 'error' });
        failed++;
        continue;
      }
      if (!iconBase64 || typeof iconBase64 !== 'string') {
        results.push({ item_id: itemId, error: 'Missing icon_base64', status: 'error' });
        failed++;
        continue;
      }

      let buf: Buffer;
      try {
        buf = Buffer.from(iconBase64, 'base64');
      } catch {
        results.push({ item_id: itemId, error: 'Invalid base64 data', status: 'error' });
        failed++;
        continue;
      }

      if (!isValidPng(buf)) {
        results.push({ item_id: itemId, error: 'Data is not a valid PNG', status: 'error' });
        failed++;
        continue;
      }

      try {
        const existing = await getItemDefinitionById(itemId);
        if (!existing) {
          results.push({ item_id: itemId, error: 'Item not found', status: 'error' });
          failed++;
          continue;
        }

        // Delete old icon if present
        if (existing.icon_filename) {
          const oldPath = path.resolve(ICONS_DIR, existing.icon_filename);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        // Save new icon
        const newFilename = `${crypto.randomUUID()}.png`;
        const newPath = path.resolve(ICONS_DIR, newFilename);
        fs.mkdirSync(ICONS_DIR, { recursive: true });
        fs.writeFileSync(newPath, buf);

        // Update DB
        await updateItemDefinition(itemId, { icon_filename: newFilename } as Parameters<typeof updateItemDefinition>[1]);

        results.push({ item_id: itemId, icon_url: buildIconUrl(newFilename)!, status: 'ok' });
        updated++;
      } catch (err) {
        results.push({ item_id: itemId, error: String(err), status: 'error' });
        failed++;
      }
    }

    log('info', 'batch_icons_updated', {
      admin: req.username,
      total: icons.length,
      updated,
      failed,
    });

    const status = failed > 0 && updated > 0 ? 207 : failed > 0 ? 400 : 200;
    const responseBody: Record<string, unknown> = { updated, results };
    if (failed > 0) responseBody['failed'] = failed;
    return res.status(status).json(responseBody);
  },
);

// ─── GET /api/items ──────────────────────────────────────────────────────────

itemsRouter.get('/', async (req: Request, res: Response) => {
  const category = req.query['category'] as string | undefined;
  if (category && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return res.status(400).json({ error: `Invalid category: ${category}` });
  }
  try {
    const items = await getItemDefinitions(category);
    log('info', 'items_listed', { admin: req.username, category: category ?? 'all', count: items.length });
    return res.json(items.map(formatItem));
  } catch (err) {
    log('error', 'items_list_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/items/:id ──────────────────────────────────────────────────────

itemsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid item id' });
  try {
    const item = await getItemDefinitionById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    log('info', 'item_fetched', { admin: req.username, item_id: id });
    return res.json(formatItem(item));
  } catch (err) {
    log('error', 'item_fetch_failed', { admin: req.username, item_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/items ─────────────────────────────────────────────────────────

itemsRouter.post('/', upload.single('icon'), async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const validationError = validateItemFields(body, true);
  if (validationError) return res.status(400).json({ error: validationError });

  let iconFilename: string | null = null;
  let iconPath: string | null = null;

  if (req.file) {
    if (!isValidPng(req.file.buffer)) {
      log('warn', 'item_icon_rejected', { reason: 'invalid_png', admin: req.username });
      return res.status(400).json({ error: 'Icon file is not a valid PNG' });
    }
    iconFilename = `${crypto.randomUUID()}.png`;
    iconPath = path.resolve(ICONS_DIR, iconFilename);
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(iconPath, req.file.buffer);
  }

  if (!req.file && body['icon_base64'] && typeof body['icon_base64'] === 'string') {
    const buf = Buffer.from(body['icon_base64'] as string, 'base64');
    if (!isValidPng(buf)) {
      log('warn', 'item_icon_rejected', { reason: 'invalid_png_base64', admin: req.username });
      return res.status(400).json({ error: 'icon_base64 is not a valid PNG' });
    }
    iconFilename = `${crypto.randomUUID()}.png`;
    iconPath = path.resolve(ICONS_DIR, iconFilename);
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(iconPath, buf);
  }

  try {
    const item = await createItemDefinition({
      name: (body['name'] as string).trim(),
      description: body['description'] ? String(body['description']) : null,
      category: body['category'] as string,
      weapon_subtype: body['weapon_subtype'] ? String(body['weapon_subtype']) : null,
      attack: body['attack'] != null ? Number(body['attack']) : null,
      defence: body['defence'] != null ? Number(body['defence']) : null,
      heal_power: body['heal_power'] != null ? Number(body['heal_power']) : null,
      food_power: body['food_power'] != null ? Number(body['food_power']) : null,
      stack_size: body['stack_size'] != null ? Number(body['stack_size']) : null,
      icon_filename: iconFilename,
    });
    log('info', 'item_definition_created', { admin: req.username, item_id: item.id, name: item.name, category: item.category });
    return res.status(201).json(formatItem(item));
  } catch (err) {
    // Clean up uploaded icon if DB insert failed
    if (iconPath && fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Item name already exists' });
    }
    log('error', 'item_create_failed', { admin: req.username, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/items/:id ──────────────────────────────────────────────────────

itemsRouter.put('/:id', upload.single('icon'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid item id' });

  const existing = await getItemDefinitionById(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const body = req.body as Record<string, unknown>;

  // Validate fields with context of existing category when category not provided
  const effectiveBody = { ...body };
  if (!effectiveBody['category']) effectiveBody['category'] = existing.category;
  const validationError = validateItemFields(effectiveBody, false);
  if (validationError) return res.status(400).json({ error: validationError });

  let iconFilename: string | undefined = undefined;
  let newIconPath: string | null = null;

  if (req.file) {
    if (!isValidPng(req.file.buffer)) {
      log('warn', 'item_icon_rejected', { reason: 'invalid_png', admin: req.username, item_id: id });
      return res.status(400).json({ error: 'Icon file is not a valid PNG' });
    }
    // Delete old icon if any
    if (existing.icon_filename) {
      const oldPath = path.resolve(ICONS_DIR, existing.icon_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    iconFilename = `${crypto.randomUUID()}.png`;
    newIconPath = path.resolve(ICONS_DIR, iconFilename);
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(newIconPath, req.file.buffer);
  }

  if (!req.file && body['icon_base64'] && typeof body['icon_base64'] === 'string') {
    const buf = Buffer.from(body['icon_base64'] as string, 'base64');
    if (!isValidPng(buf)) {
      log('warn', 'item_icon_rejected', { reason: 'invalid_png_base64', admin: req.username, item_id: id });
      return res.status(400).json({ error: 'icon_base64 is not a valid PNG' });
    }
    if (existing.icon_filename) {
      const oldPath = path.resolve(ICONS_DIR, existing.icon_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    iconFilename = `${crypto.randomUUID()}.png`;
    newIconPath = path.resolve(ICONS_DIR, iconFilename);
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.writeFileSync(newIconPath, buf);
  }

  const updateData: Record<string, unknown> = {};
  if (body['name'] !== undefined)           updateData['name']           = (body['name'] as string).trim();
  if (body['description'] !== undefined)    updateData['description']    = body['description'] || null;
  if (body['category'] !== undefined)       updateData['category']       = body['category'];
  if (body['weapon_subtype'] !== undefined) updateData['weapon_subtype'] = body['weapon_subtype'] || null;
  if (body['attack'] !== undefined)         updateData['attack']         = body['attack'] != null ? Number(body['attack']) : null;
  if (body['defence'] !== undefined)        updateData['defence']        = body['defence'] != null ? Number(body['defence']) : null;
  if (body['heal_power'] !== undefined)     updateData['heal_power']     = body['heal_power'] != null ? Number(body['heal_power']) : null;
  if (body['food_power'] !== undefined)     updateData['food_power']     = body['food_power'] != null ? Number(body['food_power']) : null;
  if (body['stack_size'] !== undefined)     updateData['stack_size']     = body['stack_size'] != null ? Number(body['stack_size']) : null;
  if (iconFilename !== undefined)           updateData['icon_filename']  = iconFilename;

  try {
    const item = await updateItemDefinition(id, updateData as Parameters<typeof updateItemDefinition>[1]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    log('info', 'item_definition_updated', { admin: req.username, item_id: id, fields_changed: Object.keys(updateData) });
    return res.json(formatItem(item));
  } catch (err) {
    if (newIconPath && fs.existsSync(newIconPath)) fs.unlinkSync(newIconPath);
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Item name already exists' });
    }
    log('error', 'item_update_failed', { admin: req.username, item_id: id, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/items/:id ───────────────────────────────────────────────────

itemsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid item id' });

  try {
    const item = await getItemDefinitionById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const deleted = await deleteItemDefinition(id);
    if (!deleted) return res.status(404).json({ error: 'Item not found' });

    // Delete icon file if present
    if (item.icon_filename) {
      const iconPath = path.resolve(ICONS_DIR, item.icon_filename);
      if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
    }

    log('info', 'item_definition_deleted', { admin: req.username, item_id: id });
    return res.status(204).send();
  } catch (err) {
    log('error', 'item_delete_failed', { admin: req.username, item_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
