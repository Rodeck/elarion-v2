import { Router, Request, Response } from 'express';
import {
  getMapsByType,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  getNodesForZone,
  getEdgesForZone,
  getBuildingsForZone,
} from '../../../../backend/src/db/queries/city-maps';

export const mapsRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// GET / — list all city maps with node/building counts
mapsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const maps = await getMapsByType('city');
    log('info', 'Listed city maps', { admin: req.username, count: maps.length });
    res.json({ maps });
  } catch (err) {
    log('error', 'Failed to list city maps', { admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — get full map with nodes, edges, buildings
mapsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  try {
    const [mapData, nodes, edges, buildings] = await Promise.all([
      getMapById(id),
      getNodesForZone(id),
      getEdgesForZone(id),
      getBuildingsForZone(id),
    ]);

    if (!mapData) {
      log('warn', 'Map not found', { map_id: id, admin: req.username });
      return res.status(404).json({ error: 'Map not found' });
    }

    log('info', 'Fetched map details', { map_id: id, admin: req.username });
    res.json({ map: { ...mapData, nodes, edges, buildings } });
  } catch (err) {
    log('error', 'Failed to fetch map', { map_id: id, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create new city map
mapsRouter.post('/', async (req: Request, res: Response) => {
  const { name, image_width_px, image_height_px } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }
  if (!Number.isInteger(image_width_px) || image_width_px <= 0) {
    return res.status(400).json({ error: 'image_width_px must be a positive integer' });
  }
  if (!Number.isInteger(image_height_px) || image_height_px <= 0) {
    return res.status(400).json({ error: 'image_height_px must be a positive integer' });
  }

  try {
    const created = await createMap(name.trim(), image_width_px, image_height_px);
    log('info', 'Created city map', { map_id: created.id, admin: req.username, name: name.trim() });
    res.status(201).json({ map: { ...created, nodes: [], edges: [], buildings: [] } });
  } catch (err) {
    log('error', 'Failed to create map', { admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update map name/dimensions
mapsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  const { name, image_width_px, image_height_px } = req.body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (image_width_px !== undefined) data.image_width_px = image_width_px;
  if (image_height_px !== undefined) data.image_height_px = image_height_px;

  try {
    const updated = await updateMap(id, data);

    if (!updated) {
      log('warn', 'Map not found for update', { map_id: id, admin: req.username });
      return res.status(404).json({ error: 'Map not found' });
    }

    log('info', 'Updated city map', { map_id: id, admin: req.username });
    res.json({ map: updated });
  } catch (err) {
    log('error', 'Failed to update map', { map_id: id, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/validate — validate a map's integrity
mapsRouter.post('/:id/validate', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  try {
    const [nodes, edges, buildings] = await Promise.all([
      getNodesForZone(id),
      getEdgesForZone(id),
      getBuildingsForZone(id),
    ]);

    const errors: string[] = [];

    // 1. At least one node exists
    if (nodes.length === 0) {
      errors.push('Map has no nodes');
    }

    // 2. Exactly one spawn node
    const spawnNodes = nodes.filter((n) => n.is_spawn);
    if (spawnNodes.length === 0) {
      errors.push('No spawn node set');
    } else if (spawnNodes.length > 1) {
      errors.push('Multiple spawn nodes found');
    }

    // 3. Graph connectivity — BFS from spawn must reach all nodes
    if (spawnNodes.length === 1 && nodes.length > 0) {
      const adjacency = new Map<number, number[]>();
      for (const node of nodes) {
        adjacency.set(node.id, []);
      }
      for (const edge of edges) {
        adjacency.get(edge.from_node_id)?.push(edge.to_node_id);
        adjacency.get(edge.to_node_id)?.push(edge.from_node_id);
      }

      const visited = new Set<number>();
      const queue: number[] = [spawnNodes[0]!.id];
      visited.add(spawnNodes[0]!.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const disconnected = nodes.length - visited.size;
      if (disconnected > 0) {
        errors.push(`${disconnected} nodes are disconnected from the spawn node`);
      }
    }

    // 4. All buildings reference valid nodes in this zone
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const building of buildings) {
      if (!nodeIds.has(building.node_id)) {
        errors.push(`Building '${building.name}' references non-existent node`);
      }
    }

    const valid = errors.length === 0;
    log('info', 'Map validation completed', {
      map_id: id,
      admin: req.username,
      valid,
      error_count: errors.length,
      errors: valid ? undefined : errors,
    });
    res.json({ valid, errors });
  } catch (err) {
    log('error', 'Failed to validate map', { map_id: id, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — delete map (cascade deletes nodes/edges/buildings via DB)
mapsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  try {
    await deleteMap(id);
    log('info', 'Deleted city map', { map_id: id, admin: req.username });
    res.json({ success: true });
  } catch (err) {
    log('error', 'Failed to delete map', { map_id: id, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});
