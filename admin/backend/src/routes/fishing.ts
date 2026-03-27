import { Router, Request, Response } from 'express';
import {
  getAllFishingLoot,
  addFishingLootEntry,
  updateFishingLootEntry,
  deleteFishingLootEntry,
  getAllRodTiers,
  addRodTier,
  updateRodTier,
  deleteRodTier,
} from '../../../../backend/src/db/queries/fishing';

export const fishingRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// ── GET /api/fishing-loot ─────────────────────────────────────────────────────

fishingRouter.get('/fishing-loot', async (_req: Request, res: Response) => {
  try {
    const entries = await getAllFishingLoot();
    return res.json(entries);
  } catch (err) {
    log('error', 'Failed to list fishing loot', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/fishing-loot ────────────────────────────────────────────────────

fishingRouter.post('/fishing-loot', async (req: Request, res: Response) => {
  const { min_rod_tier, item_def_id, drop_weight } = req.body as Record<string, unknown>;

  if (min_rod_tier == null || typeof min_rod_tier !== 'number') {
    return res.status(400).json({ error: 'min_rod_tier is required (number)' });
  }
  if (item_def_id == null || typeof item_def_id !== 'number') {
    return res.status(400).json({ error: 'item_def_id is required (number)' });
  }
  if (drop_weight == null || typeof drop_weight !== 'number') {
    return res.status(400).json({ error: 'drop_weight is required (number)' });
  }

  try {
    const entry = await addFishingLootEntry(min_rod_tier, item_def_id, drop_weight);
    log('info', 'Created fishing loot entry', { id: entry.id, admin: req.username });
    return res.status(201).json(entry);
  } catch (err) {
    log('error', 'Failed to create fishing loot entry', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/fishing-loot/:id ─────────────────────────────────────────────────

fishingRouter.put('/fishing-loot/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid fishing loot id' });

  const { min_rod_tier, drop_weight } = req.body as Record<string, unknown>;

  if (min_rod_tier == null || typeof min_rod_tier !== 'number') {
    return res.status(400).json({ error: 'min_rod_tier is required (number)' });
  }
  if (drop_weight == null || typeof drop_weight !== 'number') {
    return res.status(400).json({ error: 'drop_weight is required (number)' });
  }

  try {
    await updateFishingLootEntry(id, min_rod_tier, drop_weight);
    log('info', 'Updated fishing loot entry', { id, admin: req.username });
    return res.json({ id, min_rod_tier, drop_weight });
  } catch (err) {
    log('error', 'Failed to update fishing loot entry', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/fishing-loot/:id ──────────────────────────────────────────────

fishingRouter.delete('/fishing-loot/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid fishing loot id' });

  try {
    await deleteFishingLootEntry(id);
    log('info', 'Deleted fishing loot entry', { id, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete fishing loot entry', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/fishing-rod-tiers ────────────────────────────────────────────────

fishingRouter.get('/fishing-rod-tiers', async (_req: Request, res: Response) => {
  try {
    const tiers = await getAllRodTiers();
    return res.json(tiers);
  } catch (err) {
    log('error', 'Failed to list fishing rod tiers', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/fishing-rod-tiers ───────────────────────────────────────────────

fishingRouter.post('/fishing-rod-tiers', async (req: Request, res: Response) => {
  const { tier, item_def_id, upgrade_points_cost, max_durability, repair_crown_cost } = req.body as Record<string, unknown>;

  if (tier == null || typeof tier !== 'number' || tier < 1 || tier > 5) {
    return res.status(400).json({ error: 'tier is required (number 1-5)' });
  }
  if (item_def_id == null || typeof item_def_id !== 'number') {
    return res.status(400).json({ error: 'item_def_id is required (number)' });
  }
  if (upgrade_points_cost == null || typeof upgrade_points_cost !== 'number') {
    return res.status(400).json({ error: 'upgrade_points_cost is required (number)' });
  }
  if (max_durability == null || typeof max_durability !== 'number' || max_durability < 1) {
    return res.status(400).json({ error: 'max_durability is required (number > 0)' });
  }
  if (repair_crown_cost == null || typeof repair_crown_cost !== 'number') {
    return res.status(400).json({ error: 'repair_crown_cost is required (number)' });
  }

  try {
    const entry = await addRodTier(tier, item_def_id, upgrade_points_cost, max_durability, repair_crown_cost);
    log('info', 'Created fishing rod tier', { tier, admin: req.username });
    return res.status(201).json(entry);
  } catch (err) {
    log('error', 'Failed to create fishing rod tier', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/fishing-rod-tiers/:tier ──────────────────────────────────────────

fishingRouter.put('/fishing-rod-tiers/:tier', async (req: Request, res: Response) => {
  const tier = parseInt(req.params.tier!, 10);
  if (isNaN(tier) || tier < 1 || tier > 5) return res.status(400).json({ error: 'Invalid tier (1-5)' });

  const { upgrade_points_cost, max_durability, repair_crown_cost } = req.body as Record<string, unknown>;

  if (upgrade_points_cost == null || typeof upgrade_points_cost !== 'number') {
    return res.status(400).json({ error: 'upgrade_points_cost is required (number)' });
  }
  if (max_durability == null || typeof max_durability !== 'number' || max_durability < 1) {
    return res.status(400).json({ error: 'max_durability is required (number > 0)' });
  }
  if (repair_crown_cost == null || typeof repair_crown_cost !== 'number') {
    return res.status(400).json({ error: 'repair_crown_cost is required (number)' });
  }

  try {
    await updateRodTier(tier, upgrade_points_cost, max_durability, repair_crown_cost);
    log('info', 'Updated fishing rod tier', { tier, admin: req.username });
    return res.json({ tier, upgrade_points_cost, max_durability, repair_crown_cost });
  } catch (err) {
    log('error', 'Failed to update fishing rod tier', { tier, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/fishing-rod-tiers/:tier ───────────────────────────────────────

fishingRouter.delete('/fishing-rod-tiers/:tier', async (req: Request, res: Response) => {
  const tier = parseInt(req.params.tier!, 10);
  if (isNaN(tier) || tier < 1 || tier > 5) return res.status(400).json({ error: 'Invalid tier (1-5)' });

  try {
    await deleteRodTier(tier);
    log('info', 'Deleted fishing rod tier', { tier, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to delete fishing rod tier', { tier, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
