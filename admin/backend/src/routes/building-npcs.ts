import { Router, Request, Response } from 'express';
import { query } from '../../../../backend/src/db/connection';

export const buildingNpcsRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

interface OverlayNpc {
  npc_id: number;
  npc_name: string;
  icon_filename: string;
  roles: string[];
}

interface BuildingNpcOverlay {
  building_id: number;
  building_name: string;
  npcs: OverlayNpc[];
}

// ─── GET /:id/building-npcs — NPCs per building for overlay ─────────────────

buildingNpcsRouter.get('/:id/building-npcs', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  if (isNaN(mapId)) {
    return res.status(400).json({ error: 'Invalid map id' });
  }

  try {
    const result = await query<{
      building_id: number;
      building_name: string;
      npc_id: number;
      npc_name: string;
      icon_filename: string;
      is_crafter: boolean;
      is_quest_giver: boolean;
      is_disassembler: boolean;
      is_trainer: boolean;
      trainer_stat: string | null;
    }>(
      `SELECT
         b.id AS building_id,
         b.name AS building_name,
         n.id AS npc_id,
         n.name AS npc_name,
         COALESCE(n.icon_filename, '') AS icon_filename,
         n.is_crafter,
         n.is_quest_giver,
         n.is_disassembler,
         n.is_trainer,
         n.trainer_stat
       FROM building_npcs bn
       JOIN buildings b ON b.id = bn.building_id AND b.zone_id = $1
       JOIN npcs n ON n.id = bn.npc_id
       ORDER BY b.id, bn.sort_order`,
      [mapId],
    );

    const buildingMap = new Map<number, BuildingNpcOverlay>();
    for (const row of result.rows) {
      if (!buildingMap.has(row.building_id)) {
        buildingMap.set(row.building_id, {
          building_id: row.building_id,
          building_name: row.building_name,
          npcs: [],
        });
      }
      const roles: string[] = [];
      if (row.is_crafter) roles.push('Crafter');
      if (row.is_quest_giver) roles.push('Quest Giver');
      if (row.is_disassembler) roles.push('Disassembler');
      if (row.is_trainer) roles.push(`Trainer (${row.trainer_stat})`);

      buildingMap.get(row.building_id)!.npcs.push({
        npc_id: row.npc_id,
        npc_name: row.npc_name,
        icon_filename: row.icon_filename,
        roles,
      });
    }

    const buildings = Array.from(buildingMap.values());

    log('info', 'Fetched building NPCs overlay', {
      map_id: mapId,
      admin: req.username,
      building_count: buildings.length,
      total_npcs: buildings.reduce((sum, b) => sum + b.npcs.length, 0),
    });

    return res.json({ buildings });
  } catch (err) {
    log('error', 'Failed to fetch building NPCs', { map_id: mapId, admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
