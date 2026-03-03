import { Router, Request, Response } from 'express';
import {
  getEdgesForZone,
  getNodesForZone,
  createEdge,
  deleteEdge,
} from '../../../../backend/src/db/queries/city-maps';

export const edgesRouter = Router();

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

// GET /:id/edges — list edges for a zone
edgesRouter.get('/:id/edges', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  try {
    const edges = await getEdgesForZone(mapId);
    log('info', 'Listed edges for zone', { map_id: mapId, admin: req.username, count: edges.length });
    res.json({ edges });
  } catch (err) {
    log('error', 'Failed to list edges', { map_id: mapId, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/edges — create an edge between two nodes
edgesRouter.post('/:id/edges', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  const { from_node_id, to_node_id } = req.body;

  if (!Number.isInteger(from_node_id) || from_node_id <= 0) {
    return res.status(400).json({ error: 'from_node_id must be a positive integer' });
  }
  if (!Number.isInteger(to_node_id) || to_node_id <= 0) {
    return res.status(400).json({ error: 'to_node_id must be a positive integer' });
  }

  try {
    // Validate both nodes exist in the zone
    const nodes = await getNodesForZone(mapId);
    const nodeIds = new Set(nodes.map((n) => n.id));

    if (!nodeIds.has(from_node_id) || !nodeIds.has(to_node_id)) {
      log('warn', 'Edge creation rejected: node not in zone', {
        map_id: mapId,
        from_node_id,
        to_node_id,
        admin: req.username,
      });
      return res.status(400).json({ error: 'Both nodes must exist in the same zone' });
    }

    const edge = await createEdge(mapId, from_node_id, to_node_id);
    log('info', 'Created edge', {
      map_id: mapId,
      edge_id: edge.id,
      from_node_id,
      to_node_id,
      admin: req.username,
    });
    res.status(201).json({ edge });
  } catch (err: unknown) {
    // Unique constraint violation (duplicate edge)
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      log('warn', 'Duplicate edge rejected', {
        map_id: mapId,
        from_node_id,
        to_node_id,
        admin: req.username,
      });
      return res.status(409).json({ error: 'Edge already exists between these nodes' });
    }

    log('error', 'Failed to create edge', { map_id: mapId, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/edges/:edgeId — delete an edge
edgesRouter.delete('/:id/edges/:edgeId', async (req: Request, res: Response) => {
  const edgeId = parseInt(req.params.edgeId!, 10);
  try {
    await deleteEdge(edgeId);
    log('info', 'Deleted edge', { edge_id: edgeId, map_id: parseInt(req.params.id!, 10), admin: req.username });
    res.json({ success: true });
  } catch (err) {
    log('error', 'Failed to delete edge', { edge_id: edgeId, admin: req.username, error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});
