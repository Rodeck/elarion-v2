import { Router, Request, Response } from 'express';
import {
  getBuildingsForZone,
  getNodesForZone,
  getMapById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  getBuildingActions,
  createBuildingAction,
  updateBuildingAction,
  deleteBuildingAction,
  type TravelActionConfig,
  type ExploreActionConfig,
} from '../../../../backend/src/db/queries/city-maps';
import { getMonsterById } from '../../../../backend/src/db/queries/monsters';
import { query } from '../../../../backend/src/db/connection';

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
    description,
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
      description,
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

// ─── Building Actions sub-resource ──────────────────────────────────────────

// GET /:id/buildings/:buildingId/actions
buildingsRouter.get('/:id/buildings/:buildingId/actions', async (req: Request, res: Response) => {
  const buildingId = parseInt(req.params.buildingId!, 10);
  if (isNaN(buildingId)) return res.status(400).json({ error: 'Invalid building id' });

  try {
    const actions = await getBuildingActions(buildingId);
    return res.json({ actions });
  } catch (err) {
    log('error', 'Failed to list building actions', { building_id: buildingId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/buildings/:buildingId/actions
buildingsRouter.post('/:id/buildings/:buildingId/actions', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  const buildingId = parseInt(req.params.buildingId!, 10);
  if (isNaN(mapId) || isNaN(buildingId)) {
    return res.status(400).json({ error: 'Invalid map id or building id' });
  }

  const { action_type, sort_order, config } = req.body as {
    action_type: string;
    sort_order?: number;
    config: Record<string, unknown>;
  };

  if (action_type !== 'travel' && action_type !== 'explore') {
    return res.status(400).json({ error: 'action_type must be "travel" or "explore"' });
  }

  try {
    if (action_type === 'travel') {
      const cfg = config as { target_zone_id?: unknown; target_node_id?: unknown };
      if (!Number.isInteger(cfg.target_zone_id) || !Number.isInteger(cfg.target_node_id)) {
        return res.status(400).json({ error: 'config must include target_zone_id and target_node_id as integers' });
      }
      const targetZone = await getMapById(cfg.target_zone_id as number);
      if (!targetZone) return res.status(400).json({ error: 'target_zone_id references a non-existent zone' });
      const nodeRow = await query<{ id: number }>(
        'SELECT id FROM path_nodes WHERE id = $1 AND zone_id = $2',
        [cfg.target_node_id, cfg.target_zone_id],
      );
      if (nodeRow.rows.length === 0) return res.status(400).json({ error: 'target_node_id does not exist in target_zone_id' });

      const travelConfig: TravelActionConfig = {
        target_zone_id: cfg.target_zone_id as number,
        target_node_id: cfg.target_node_id as number,
      };
      const action = await createBuildingAction(buildingId, 'travel', travelConfig, sort_order ?? 0);
      log('info', 'Created travel action', { building_id: buildingId, action_id: action.id, admin: req.username });
      return res.status(201).json({ action });
    } else {
      // explore
      const cfg = config as { encounter_chance?: unknown; monsters?: unknown[] };
      const encounterChance = Number(cfg.encounter_chance);
      if (!Number.isInteger(encounterChance) || encounterChance < 0 || encounterChance > 100) {
        return res.status(400).json({ error: 'encounter_chance must be an integer 0–100' });
      }
      const monsters = cfg.monsters ?? [];
      if (!Array.isArray(monsters)) {
        return res.status(400).json({ error: 'monsters must be an array' });
      }
      if (encounterChance > 0 && monsters.length === 0) {
        return res.status(400).json({ error: 'monsters array is required when encounter_chance > 0' });
      }
      for (const entry of monsters) {
        const e = entry as { monster_id?: unknown; weight?: unknown };
        if (!Number.isInteger(e.monster_id)) return res.status(400).json({ error: 'each monster entry must have a valid monster_id' });
        if (!Number.isInteger(e.weight) || (e.weight as number) <= 0) return res.status(400).json({ error: 'each monster entry weight must be a positive integer' });
        const m = await getMonsterById(e.monster_id as number);
        if (!m) return res.status(400).json({ error: `monster_id ${e.monster_id} does not exist` });
      }

      const exploreConfig: ExploreActionConfig = {
        encounter_chance: encounterChance,
        monsters: (monsters as Array<{ monster_id: number; weight: number }>).map((e) => ({
          monster_id: e.monster_id,
          weight: e.weight,
        })),
      };
      const action = await createBuildingAction(buildingId, 'explore', exploreConfig, sort_order ?? 0);
      log('info', 'Created explore action', { building_id: buildingId, action_id: action.id, admin: req.username });
      return res.status(201).json({ action });
    }
  } catch (err) {
    log('error', 'Failed to create building action', { building_id: buildingId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/buildings/:buildingId/actions/:actionId
buildingsRouter.put('/:id/buildings/:buildingId/actions/:actionId', async (req: Request, res: Response) => {
  const buildingId = parseInt(req.params.buildingId!, 10);
  const actionId = parseInt(req.params.actionId!, 10);
  if (isNaN(buildingId) || isNaN(actionId)) {
    return res.status(400).json({ error: 'Invalid building id or action id' });
  }

  const { sort_order, config } = req.body as {
    sort_order?: number;
    config?: { target_zone_id: number; target_node_id: number };
  };

  try {
    if (config) {
      const targetZone = await getMapById(config.target_zone_id);
      if (!targetZone) return res.status(400).json({ error: 'target_zone_id references a non-existent zone' });
      const nodeRow = await query<{ id: number }>(
        'SELECT id FROM path_nodes WHERE id = $1 AND zone_id = $2',
        [config.target_node_id, config.target_zone_id],
      );
      if (nodeRow.rows.length === 0) return res.status(400).json({ error: 'target_node_id does not exist in target_zone_id' });
    }

    const action = await updateBuildingAction(actionId, {
      sort_order,
      config: config ? { target_zone_id: config.target_zone_id, target_node_id: config.target_node_id } : undefined,
    });
    if (!action) return res.status(404).json({ error: 'Action not found' });
    log('info', 'Updated building action', { building_id: buildingId, action_id: actionId, admin: req.username });
    return res.json({ action });
  } catch (err) {
    log('error', 'Failed to update building action', { action_id: actionId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/buildings/:buildingId/actions/:actionId
buildingsRouter.delete('/:id/buildings/:buildingId/actions/:actionId', async (req: Request, res: Response) => {
  const buildingId = parseInt(req.params.buildingId!, 10);
  const actionId = parseInt(req.params.actionId!, 10);
  if (isNaN(buildingId) || isNaN(actionId)) {
    return res.status(400).json({ error: 'Invalid building id or action id' });
  }

  try {
    await deleteBuildingAction(actionId);
    log('info', 'Deleted building action', { building_id: buildingId, action_id: actionId, admin: req.username });
    return res.json({ success: true });
  } catch (err) {
    log('error', 'Failed to delete building action', { action_id: actionId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
