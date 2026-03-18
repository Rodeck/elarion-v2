import { Router, Request, Response } from 'express';
import { query } from '../../../../backend/src/db/connection';

export const buildingItemsRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

interface OverlayItem {
  item_id: number;
  item_name: string;
  icon_filename: string;
  obtain_method: 'loot' | 'craft';
  source_name: string;
}

interface BuildingOverlay {
  building_id: number;
  building_name: string;
  items: OverlayItem[];
}

// ─── GET /:id/building-items — obtainable items per building for overlay ─────

buildingItemsRouter.get('/:id/building-items', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  if (isNaN(mapId)) {
    return res.status(400).json({ error: 'Invalid map id' });
  }

  try {
    // Get all buildings for this zone
    const buildingsResult = await query<{ id: number; name: string }>(
      'SELECT id, name FROM buildings WHERE zone_id = $1 ORDER BY id',
      [mapId],
    );

    // Loot items: building → building_actions (explore) → config.monsters → monster_loot → item_definitions
    const lootResult = await query<{
      building_id: number;
      item_id: number;
      item_name: string;
      icon_filename: string;
      source_name: string;
    }>(
      `SELECT DISTINCT ON (ba.building_id, id.id)
         ba.building_id,
         id.id AS item_id,
         id.name AS item_name,
         COALESCE(id.icon_filename, '') AS icon_filename,
         m.name AS source_name
       FROM building_actions ba
       JOIN buildings b ON b.id = ba.building_id AND b.zone_id = $1
       CROSS JOIN LATERAL jsonb_array_elements(ba.config->'monsters') AS me
       JOIN monsters m ON m.id = (me->>'monster_id')::int
       JOIN monster_loot ml ON ml.monster_id = m.id
       JOIN item_definitions id ON id.id = ml.item_def_id
       WHERE ba.action_type = 'explore'
       ORDER BY ba.building_id, id.id`,
      [mapId],
    );

    // Craft items: building → building_npcs → npcs (is_crafter) → crafting_recipes → item_definitions
    const craftResult = await query<{
      building_id: number;
      item_id: number;
      item_name: string;
      icon_filename: string;
      source_name: string;
    }>(
      `SELECT DISTINCT ON (bn.building_id, id.id)
         bn.building_id,
         id.id AS item_id,
         id.name AS item_name,
         COALESCE(id.icon_filename, '') AS icon_filename,
         n.name AS source_name
       FROM building_npcs bn
       JOIN buildings b ON b.id = bn.building_id AND b.zone_id = $1
       JOIN npcs n ON n.id = bn.npc_id AND n.is_crafter = true
       JOIN crafting_recipes cr ON cr.npc_id = n.id
       JOIN item_definitions id ON id.id = cr.output_item_id
       ORDER BY bn.building_id, id.id`,
      [mapId],
    );

    // Group by building
    const buildingMap = new Map<number, BuildingOverlay>();
    for (const row of buildingsResult.rows) {
      buildingMap.set(row.id, {
        building_id: row.id,
        building_name: row.name,
        items: [],
      });
    }

    for (const row of lootResult.rows) {
      const building = buildingMap.get(row.building_id);
      if (building) {
        building.items.push({
          item_id: row.item_id,
          item_name: row.item_name,
          icon_filename: row.icon_filename,
          obtain_method: 'loot',
          source_name: row.source_name,
        });
      }
    }

    for (const row of craftResult.rows) {
      const building = buildingMap.get(row.building_id);
      if (building) {
        building.items.push({
          item_id: row.item_id,
          item_name: row.item_name,
          icon_filename: row.icon_filename,
          obtain_method: 'craft',
          source_name: row.source_name,
        });
      }
    }

    const buildings = Array.from(buildingMap.values());

    log('info', 'Fetched building items overlay', {
      map_id: mapId,
      admin: req.username,
      building_count: buildings.length,
      total_items: buildings.reduce((sum, b) => sum + b.items.length, 0),
    });

    return res.json({ buildings });
  } catch (err) {
    log('error', 'Failed to fetch building items', { map_id: mapId, admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
