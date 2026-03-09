import { Router } from 'express';
import {
  getEncounterEntriesForAdmin,
  upsertEncounterEntry,
  deleteEncounterEntry,
} from '../../../../backend/src/db/queries/encounter-tables';

export const encounterTablesRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// GET /encounter-tables/:zoneId — list entries for a zone
encounterTablesRouter.get('/:zoneId', async (req, res) => {
  const zoneId = parseInt(req.params['zoneId'] ?? '', 10);
  if (isNaN(zoneId)) {
    res.status(400).json({ error: 'Invalid zone_id' });
    return;
  }
  try {
    const entries = await getEncounterEntriesForAdmin(zoneId);
    res.json(entries);
  } catch (err) {
    log('error', 'encounter-tables.list', { zoneId, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /encounter-tables/:zoneId — upsert an entry (zone_id + monster_id + weight)
encounterTablesRouter.put('/:zoneId', async (req, res) => {
  const zoneId = parseInt(req.params['zoneId'] ?? '', 10);
  const { monster_id, weight } = req.body as { monster_id: unknown; weight: unknown };

  if (isNaN(zoneId)) {
    res.status(400).json({ error: 'Invalid zone_id' });
    return;
  }
  const monsterId = parseInt(String(monster_id), 10);
  const weightNum = parseInt(String(weight), 10);
  if (isNaN(monsterId) || monsterId < 1) {
    res.status(400).json({ error: 'monster_id must be a positive integer' });
    return;
  }
  if (isNaN(weightNum) || weightNum < 1) {
    res.status(400).json({ error: 'weight must be a positive integer' });
    return;
  }

  try {
    const entry = await upsertEncounterEntry(zoneId, monsterId, weightNum);
    log('info', 'encounter-tables.upsert', { zoneId, monsterId, weight: weightNum });
    res.json(entry);
  } catch (err) {
    log('error', 'encounter-tables.upsert', { zoneId, monsterId, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /encounter-tables/entry/:entryId — delete a single entry
encounterTablesRouter.delete('/entry/:entryId', async (req, res) => {
  const entryId = parseInt(req.params['entryId'] ?? '', 10);
  if (isNaN(entryId)) {
    res.status(400).json({ error: 'Invalid entry_id' });
    return;
  }
  try {
    await deleteEncounterEntry(entryId);
    log('info', 'encounter-tables.delete', { entryId });
    res.status(204).send();
  } catch (err) {
    log('error', 'encounter-tables.delete', { entryId, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});
