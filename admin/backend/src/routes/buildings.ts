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
import type { ExpeditionActionConfig } from '../../../../backend/src/db/queries/squires';
import { getMonsterById } from '../../../../backend/src/db/queries/monsters';
import {
  getNpcsForBuilding,
  assignNpcToBuilding,
  removeNpcFromBuilding,
} from '../../../../backend/src/db/queries/npcs';
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
    description,
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
      description: typeof description === 'string' ? description : undefined,
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

  if (action_type !== 'travel' && action_type !== 'explore' && action_type !== 'expedition' && action_type !== 'gather' && action_type !== 'marketplace') {
    return res.status(400).json({ error: 'action_type must be "travel", "explore", "expedition", "gather", or "marketplace"' });
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
    } else if (action_type === 'explore') {
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
    } else if (action_type === 'gather') {
      const cfg = config as {
        required_tool_type?: unknown;
        durability_per_second?: unknown;
        min_seconds?: unknown;
        max_seconds?: unknown;
        events?: unknown[];
      };
      const toolType = String(cfg.required_tool_type ?? '');
      if (!['pickaxe', 'axe'].includes(toolType)) {
        return res.status(400).json({ error: 'required_tool_type must be "pickaxe" or "axe"' });
      }
      const durPerSec = Number(cfg.durability_per_second);
      if (!Number.isInteger(durPerSec) || durPerSec < 1) {
        return res.status(400).json({ error: 'durability_per_second must be a positive integer' });
      }
      const minSec = Number(cfg.min_seconds);
      const maxSec = Number(cfg.max_seconds);
      if (!Number.isInteger(minSec) || minSec < 1) {
        return res.status(400).json({ error: 'min_seconds must be a positive integer' });
      }
      if (!Number.isInteger(maxSec) || maxSec < minSec) {
        return res.status(400).json({ error: 'max_seconds must be >= min_seconds' });
      }
      const events = cfg.events ?? [];
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events must be a non-empty array' });
      }
      const validEventTypes = ['resource', 'gold', 'monster', 'accident', 'nothing', 'squire'];
      for (const ev of events) {
        const e = ev as Record<string, unknown>;
        if (!validEventTypes.includes(String(e['type']))) {
          return res.status(400).json({ error: `event type must be one of: ${validEventTypes.join(', ')}` });
        }
        if (!Number.isInteger(e['weight']) || (e['weight'] as number) < 1) {
          return res.status(400).json({ error: 'each event must have a positive integer weight' });
        }
        if (e['type'] === 'resource') {
          if (!Number.isInteger(e['item_def_id'])) return res.status(400).json({ error: 'resource event requires integer item_def_id' });
          if (!Number.isInteger(e['quantity']) || (e['quantity'] as number) < 1) return res.status(400).json({ error: 'resource event requires positive integer quantity' });
        }
        if (e['type'] === 'gold') {
          if (!Number.isInteger(e['min_amount']) || (e['min_amount'] as number) < 0) return res.status(400).json({ error: 'gold event requires non-negative integer min_amount' });
          if (!Number.isInteger(e['max_amount']) || (e['max_amount'] as number) < (e['min_amount'] as number)) return res.status(400).json({ error: 'gold event max_amount must be >= min_amount' });
        }
        if (e['type'] === 'monster') {
          if (!Number.isInteger(e['monster_id'])) return res.status(400).json({ error: 'monster event requires integer monster_id' });
        }
        if (e['type'] === 'accident') {
          if (!Number.isInteger(e['hp_damage']) || (e['hp_damage'] as number) < 1) return res.status(400).json({ error: 'accident event requires positive integer hp_damage' });
        }
        if (e['type'] === 'squire') {
          if (!Number.isInteger(e['squire_def_id']) || (e['squire_def_id'] as number) < 1) return res.status(400).json({ error: 'squire event requires positive integer squire_def_id' });
          const sqLevel = Number(e['squire_level'] ?? 1);
          if (!Number.isInteger(sqLevel) || sqLevel < 1 || sqLevel > 20) return res.status(400).json({ error: 'squire event squire_level must be 1–20' });
        }
      }
      const gatherConfig = {
        required_tool_type: toolType,
        durability_per_second: durPerSec,
        min_seconds: minSec,
        max_seconds: maxSec,
        events: events as Array<Record<string, unknown>>,
      };
      const action = await createBuildingAction(buildingId, 'gather' as 'travel', gatherConfig as unknown as TravelActionConfig, sort_order ?? 0);
      log('info', 'Created gather action', { building_id: buildingId, action_id: action.id, admin: req.username });
      return res.status(201).json({ action });
    } else if (action_type === 'marketplace') {
      const cfg = config as {
        listing_fee?: unknown;
        max_listings?: unknown;
        listing_duration_days?: unknown;
      };
      const listingFee = Number(cfg.listing_fee ?? 10);
      if (!Number.isInteger(listingFee) || listingFee < 0) {
        return res.status(400).json({ error: 'listing_fee must be a non-negative integer' });
      }
      const maxListings = Number(cfg.max_listings ?? 10);
      if (!Number.isInteger(maxListings) || maxListings < 1) {
        return res.status(400).json({ error: 'max_listings must be a positive integer' });
      }
      const durationDays = Number(cfg.listing_duration_days ?? 5);
      if (!Number.isInteger(durationDays) || durationDays < 1) {
        return res.status(400).json({ error: 'listing_duration_days must be a positive integer' });
      }
      const marketplaceConfig = {
        listing_fee: listingFee,
        max_listings: maxListings,
        listing_duration_days: durationDays,
      };
      const action = await createBuildingAction(buildingId, 'marketplace' as 'travel', marketplaceConfig as unknown as TravelActionConfig, sort_order ?? 0);
      log('info', 'Created marketplace action', { building_id: buildingId, action_id: action.id, admin: req.username });
      return res.status(201).json({ action });
    } else {
      // expedition
      const cfg = config as { base_gold?: unknown; base_exp?: unknown; items?: unknown[] };
      const baseGold = Number(cfg.base_gold);
      const baseExp = Number(cfg.base_exp);
      if (!Number.isInteger(baseGold) || baseGold < 0) {
        return res.status(400).json({ error: 'base_gold must be a non-negative integer' });
      }
      if (!Number.isInteger(baseExp) || baseExp < 0) {
        return res.status(400).json({ error: 'base_exp must be a non-negative integer' });
      }
      const items = cfg.items ?? [];
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'items must be an array' });
      }
      const validatedItems: { item_def_id: number; base_quantity: number }[] = [];
      for (const entry of items) {
        const e = entry as { item_def_id?: unknown; base_quantity?: unknown };
        if (!Number.isInteger(e.item_def_id)) {
          return res.status(400).json({ error: 'each item entry must have a valid item_def_id' });
        }
        if (!Number.isInteger(e.base_quantity) || (e.base_quantity as number) < 1) {
          return res.status(400).json({ error: 'each item entry base_quantity must be a positive integer' });
        }
        const itemRow = await query<{ id: number }>(
          'SELECT id FROM item_definitions WHERE id = $1',
          [e.item_def_id],
        );
        if (itemRow.rows.length === 0) {
          return res.status(400).json({ error: `item_def_id ${e.item_def_id} does not exist` });
        }
        validatedItems.push({ item_def_id: e.item_def_id as number, base_quantity: e.base_quantity as number });
      }

      const expeditionConfig: ExpeditionActionConfig = {
        base_gold: baseGold,
        base_exp: baseExp,
        items: validatedItems,
      };
      const action = await createBuildingAction(buildingId, 'expedition' as 'travel', expeditionConfig as unknown as TravelActionConfig, sort_order ?? 0);
      log('info', 'Created expedition action', {
        building_id: buildingId,
        action_id: action.id,
        base_gold: baseGold,
        base_exp: baseExp,
        item_count: validatedItems.length,
        admin: req.username,
      });
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
    config?: Record<string, unknown>;
  };

  try {
    // Fetch existing action to determine its type before validating config
    const existingRow = await query<{ action_type: string }>(
      'SELECT action_type FROM building_actions WHERE id = $1',
      [actionId],
    );
    if (existingRow.rows.length === 0) return res.status(404).json({ error: 'Action not found' });
    const actionType = existingRow.rows[0]!.action_type;

    let validatedConfig: TravelActionConfig | undefined;

    if (config !== undefined) {
      if (actionType === 'expedition') {
        const expConfig = config as { base_gold?: unknown; base_exp?: unknown; items?: unknown };
        if (typeof expConfig.base_gold !== 'number' || !Number.isInteger(expConfig.base_gold) || expConfig.base_gold < 0) {
          return res.status(400).json({ error: 'base_gold must be a non-negative integer' });
        }
        if (typeof expConfig.base_exp !== 'number' || !Number.isInteger(expConfig.base_exp) || expConfig.base_exp < 0) {
          return res.status(400).json({ error: 'base_exp must be a non-negative integer' });
        }
        if (!Array.isArray(expConfig.items)) {
          return res.status(400).json({ error: 'items must be an array' });
        }
        for (const item of expConfig.items as { item_def_id?: unknown; base_quantity?: unknown }[]) {
          if (typeof item.item_def_id !== 'number' || !Number.isInteger(item.item_def_id)) {
            return res.status(400).json({ error: 'Each item must have an integer item_def_id' });
          }
          if (typeof item.base_quantity !== 'number' || !Number.isInteger(item.base_quantity) || item.base_quantity < 1) {
            return res.status(400).json({ error: 'Each item must have base_quantity >= 1' });
          }
          const itemRow = await query<{ id: number }>('SELECT id FROM item_definitions WHERE id = $1', [item.item_def_id]);
          if (itemRow.rows.length === 0) {
            return res.status(400).json({ error: `item_def_id ${item.item_def_id} does not exist` });
          }
        }
        const expeditionConfig: ExpeditionActionConfig = {
          base_gold: expConfig.base_gold as number,
          base_exp: expConfig.base_exp as number,
          items: (expConfig.items as { item_def_id: number; base_quantity: number }[]).map(i => ({
            item_def_id: i.item_def_id,
            base_quantity: i.base_quantity,
          })),
        };
        validatedConfig = expeditionConfig as unknown as TravelActionConfig;
        log('info', 'expedition_action_updated', { building_id: buildingId, action_id: actionId, admin: req.username });
      } else if (actionType === 'explore') {
        const exploreConfig = config as { encounter_chance?: unknown; monsters?: unknown };
        if (typeof exploreConfig.encounter_chance !== 'number' || exploreConfig.encounter_chance < 1 || exploreConfig.encounter_chance > 100) {
          return res.status(400).json({ error: 'encounter_chance must be between 1 and 100' });
        }
        if (!Array.isArray(exploreConfig.monsters) || exploreConfig.monsters.length === 0) {
          return res.status(400).json({ error: 'monsters must be a non-empty array' });
        }
        for (const m of exploreConfig.monsters as { monster_id?: unknown; weight?: unknown }[]) {
          if (typeof m.monster_id !== 'number' || !Number.isInteger(m.monster_id)) {
            return res.status(400).json({ error: 'Each monster entry must have an integer monster_id' });
          }
          if (typeof m.weight !== 'number' || !Number.isInteger(m.weight) || m.weight < 1) {
            return res.status(400).json({ error: 'Each monster entry must have weight >= 1' });
          }
          const monsterRow = await query<{ id: number }>('SELECT id FROM monsters WHERE id = $1', [m.monster_id]);
          if (monsterRow.rows.length === 0) {
            return res.status(400).json({ error: `monster_id ${m.monster_id} does not exist` });
          }
        }
        validatedConfig = { encounter_chance: exploreConfig.encounter_chance, monsters: exploreConfig.monsters } as unknown as TravelActionConfig;
        log('info', 'explore_action_updated', { building_id: buildingId, action_id: actionId, admin: req.username });
      } else {
        const travelConfig = config as { target_zone_id?: number; target_node_id?: number };
        const targetZone = await getMapById(travelConfig.target_zone_id!);
        if (!targetZone) return res.status(400).json({ error: 'target_zone_id references a non-existent zone' });
        const nodeRow = await query<{ id: number }>(
          'SELECT id FROM path_nodes WHERE id = $1 AND zone_id = $2',
          [travelConfig.target_node_id, travelConfig.target_zone_id],
        );
        if (nodeRow.rows.length === 0) return res.status(400).json({ error: 'target_node_id does not exist in target_zone_id' });
        validatedConfig = { target_zone_id: travelConfig.target_zone_id!, target_node_id: travelConfig.target_node_id! };
      }
    }

    const action = await updateBuildingAction(actionId, { sort_order, config: validatedConfig });
    if (!action) return res.status(404).json({ error: 'Action not found' });
    log('info', 'Updated building action', { building_id: buildingId, action_id: actionId, admin: req.username });
    return res.json({ action });
  } catch (err) {
    log('error', 'Failed to update building action', { action_id: actionId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Building NPCs sub-resource ─────────────────────────────────────────────

// GET /:id/buildings/:buildingId/npcs
buildingsRouter.get('/:id/buildings/:buildingId/npcs', async (req: Request, res: Response) => {
  const buildingId = parseInt(req.params.buildingId!, 10);
  if (isNaN(buildingId)) return res.status(400).json({ error: 'Invalid building id' });

  try {
    const npcs = await getNpcsForBuilding(buildingId);
    return res.json({ npcs: npcs.map((n) => ({
      npc_id: n.npc_id,
      name: n.name,
      icon_url: `/npc-icons/${n.icon_filename}`,
      sort_order: n.sort_order,
    })) });
  } catch (err) {
    log('error', 'Failed to list building NPCs', { building_id: buildingId, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/buildings/:buildingId/npcs
buildingsRouter.post('/:id/buildings/:buildingId/npcs', async (req: Request, res: Response) => {
  const buildingId = parseInt(req.params.buildingId!, 10);
  if (isNaN(buildingId)) return res.status(400).json({ error: 'Invalid building id' });

  const { npc_id } = req.body as { npc_id?: unknown };
  if (!Number.isInteger(npc_id) || (npc_id as number) <= 0) {
    return res.status(400).json({ error: 'npc_id must be a positive integer' });
  }

  try {
    await assignNpcToBuilding(buildingId, npc_id as number);
    log('info', 'Assigned NPC to building', { building_id: buildingId, npc_id, admin: req.username });
    return res.status(201).json({ success: true });
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
      return res.status(409).json({ error: 'ALREADY_ASSIGNED' });
    }
    log('error', 'Failed to assign NPC to building', { building_id: buildingId, npc_id, error: msg });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/buildings/:buildingId/npcs/:npcId
buildingsRouter.delete('/:id/buildings/:buildingId/npcs/:npcId', async (req: Request, res: Response) => {
  const buildingId = parseInt(req.params.buildingId!, 10);
  const npcId = parseInt(req.params.npcId!, 10);
  if (isNaN(buildingId) || isNaN(npcId)) {
    return res.status(400).json({ error: 'Invalid building id or NPC id' });
  }

  try {
    await removeNpcFromBuilding(buildingId, npcId);
    log('info', 'Removed NPC from building', { building_id: buildingId, npc_id: npcId, admin: req.username });
    return res.status(204).send();
  } catch (err) {
    log('error', 'Failed to remove NPC from building', { building_id: buildingId, npc_id: npcId, error: String(err) });
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
