import { Router, type Request, type Response } from 'express';
import { listAllTrainingItems, createTrainingItem, deleteTrainingItem } from '../../../../backend/src/db/queries/stat-training';

const VALID_STATS = ['constitution', 'strength', 'intelligence', 'dexterity', 'toughness'];

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

export const statTrainingRouter = Router();

// ── GET /api/stat-training ────────────────────────────────────────────────────

statTrainingRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await listAllTrainingItems();
    return res.json(items);
  } catch (err) {
    log('error', 'Failed to list stat training items', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/stat-training ───────────────────────────────────────────────────

statTrainingRouter.post('/', async (req: Request, res: Response) => {
  const { item_def_id, stat_name, tier, base_chance, decay_per_level, npc_id } = req.body as Record<string, unknown>;

  if (typeof item_def_id !== 'number' || !Number.isInteger(item_def_id) || item_def_id <= 0) {
    return res.status(400).json({ error: 'item_def_id must be a positive integer' });
  }
  if (typeof stat_name !== 'string' || !VALID_STATS.includes(stat_name)) {
    return res.status(400).json({ error: `stat_name must be one of: ${VALID_STATS.join(', ')}` });
  }
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > 3) {
    return res.status(400).json({ error: 'tier must be 1, 2, or 3' });
  }
  if (typeof base_chance !== 'number' || !Number.isInteger(base_chance) || base_chance < 1 || base_chance > 100) {
    return res.status(400).json({ error: 'base_chance must be an integer between 1 and 100' });
  }
  if (typeof decay_per_level !== 'number' || decay_per_level <= 0) {
    return res.status(400).json({ error: 'decay_per_level must be a positive number' });
  }
  if (typeof npc_id !== 'number' || !Number.isInteger(npc_id) || npc_id <= 0) {
    return res.status(400).json({ error: 'npc_id must be a positive integer' });
  }

  try {
    const created = await createTrainingItem({
      item_def_id: item_def_id as number,
      stat_name: stat_name as string,
      tier: tier as number,
      base_chance: base_chance as number,
      decay_per_level: decay_per_level as number,
      npc_id: npc_id as number,
    });
    log('info', 'Created stat training item', { id: created.id, item_def_id, stat_name, tier, admin: req.username });
    return res.status(201).json(created);
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'This item is already configured as a training item' });
    }
    log('error', 'Failed to create stat training item', { error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/stat-training/:id ─────────────────────────────────────────────

statTrainingRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const deleted = await deleteTrainingItem(id);
    if (!deleted) return res.status(404).json({ error: 'Stat training item not found' });

    log('info', 'Deleted stat training item', { id, admin: req.username });
    return res.json({ success: true });
  } catch (err) {
    log('error', 'Failed to delete stat training item', { id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
