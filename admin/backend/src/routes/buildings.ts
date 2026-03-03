import { Router, Request, Response } from 'express';
import {
  getBuildingsForZone,
  getNodesForZone,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from '../../../../backend/src/db/queries/city-maps';

export const buildingsRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// ─── GET /:id/buildings — list buildings for a zone ─────────────────────────

buildingsRouter.get('/:id/buildings', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  if (isNaN(mapId)) {
    return res.status(400).json({ error: 'Invalid map id' });
  }

  try {
    const buildings = await getBuildingsForZone(mapId);
    log('info', 'Listed buildings for zone', { map_id: mapId, admin: req.username, count: buildings.length });
    return res.json({ buildings });
  } catch (err) {
    log('error', 'Failed to list buildings', { map_id: mapId, admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /:id/buildings — create a building ────────────────────────────────

buildingsRouter.post('/:id/buildings', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  if (isNaN(mapId)) {
    return res.status(400).json({ error: 'Invalid map id' });
  }

  const {
    node_id,
    name,
    label_offset_x,
    label_offset_y,
    hotspot_type,
    hotspot_x,
    hotspot_y,
    hotspot_w,
    hotspot_h,
    hotspot_r,
  } = req.body;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!Number.isInteger(node_id) || node_id <= 0) {
    return res.status(400).json({ error: 'node_id must be a positive integer' });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }

  // ── Validate hotspot fields ───────────────────────────────────────────────
  if (hotspot_type === 'rect') {
    if (
      typeof hotspot_x !== 'number' ||
      typeof hotspot_y !== 'number' ||
      typeof hotspot_w !== 'number' ||
      typeof hotspot_h !== 'number'
    ) {
      return res.status(400).json({
        error: 'hotspot_type "rect" requires hotspot_x, hotspot_y, hotspot_w, and hotspot_h as numbers',
      });
    }
  } else if (hotspot_type === 'circle') {
    if (
      typeof hotspot_x !== 'number' ||
      typeof hotspot_y !== 'number' ||
      typeof hotspot_r !== 'number'
    ) {
      return res.status(400).json({
        error: 'hotspot_type "circle" requires hotspot_x, hotspot_y, and hotspot_r as numbers',
      });
    }
  } else if (hotspot_type !== undefined && hotspot_type !== null) {
    return res.status(400).json({ error: 'hotspot_type must be "rect" or "circle"' });
  }

  try {
    // ── Validate node exists in the zone ──────────────────────────────────
    const nodes = await getNodesForZone(mapId);
    const nodeIds = new Set(nodes.map((n) => n.id));

    if (!nodeIds.has(node_id)) {
      log('warn', 'Building creation rejected: node not in zone', {
        map_id: mapId,
        node_id,
        admin: req.username,
      });
      return res.status(400).json({ error: 'node_id must reference an existing node in this zone' });
    }

    const building = await createBuilding(mapId, {
      node_id,
      name: name.trim(),
      label_offset_x,
      label_offset_y,
      hotspot_type,
      hotspot_x,
      hotspot_y,
      hotspot_w,
      hotspot_h,
      hotspot_r,
    });

    log('info', 'Created building', {
      map_id: mapId,
      building_id: building.id,
      node_id,
      name: name.trim(),
      admin: req.username,
    });
    return res.status(201).json({ building });
  } catch (err) {
    log('error', 'Failed to create building', { map_id: mapId, admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /:id/buildings/:buildingId — update a building ─────────────────────

buildingsRouter.put('/:id/buildings/:buildingId', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  const buildingId = parseInt(req.params.buildingId!, 10);
  if (isNaN(mapId) || isNaN(buildingId)) {
    return res.status(400).json({ error: 'Invalid map id or building id' });
  }

  const {
    name,
    node_id,
    label_offset_x,
    label_offset_y,
    hotspot_type,
    hotspot_x,
    hotspot_y,
    hotspot_w,
    hotspot_h,
    hotspot_r,
  } = req.body;

  try {
    const building = await updateBuilding(buildingId, {
      name,
      node_id,
      label_offset_x,
      label_offset_y,
      hotspot_type,
      hotspot_x,
      hotspot_y,
      hotspot_w,
      hotspot_h,
      hotspot_r,
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    log('info', 'Updated building', {
      map_id: mapId,
      building_id: buildingId,
      changes: req.body,
      admin: req.username,
    });
    return res.json({ building });
  } catch (err) {
    log('error', 'Failed to update building', {
      map_id: mapId,
      building_id: buildingId,
      admin: req.username,
      error: String(err),
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /:id/buildings/:buildingId — delete a building ──────────────────

buildingsRouter.delete('/:id/buildings/:buildingId', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  const buildingId = parseInt(req.params.buildingId!, 10);
  if (isNaN(mapId) || isNaN(buildingId)) {
    return res.status(400).json({ error: 'Invalid map id or building id' });
  }

  try {
    await deleteBuilding(buildingId);
    log('info', 'Deleted building', {
      map_id: mapId,
      building_id: buildingId,
      admin: req.username,
    });
    return res.json({ success: true });
  } catch (err) {
    log('error', 'Failed to delete building', {
      map_id: mapId,
      building_id: buildingId,
      admin: req.username,
      error: String(err),
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
