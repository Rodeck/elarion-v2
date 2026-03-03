import { Router, Request, Response } from 'express';
import {
  getNodesForZone,
  createNode,
  updateNode,
  deleteNode,
} from '../../../../backend/src/db/queries/city-maps';

export const nodesRouter = Router();

// ─── GET /:id/nodes — list nodes for a zone ─────────────────────────────────

nodesRouter.get('/:id/nodes', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  if (isNaN(mapId)) {
    return res.status(400).json({ error: 'Invalid map id' });
  }

  try {
    const nodes = await getNodesForZone(mapId);
    console.log(JSON.stringify({
      level: 'info',
      msg: 'Listed nodes for zone',
      mapId,
      count: nodes.length,
      timestamp: new Date().toISOString(),
    }));
    return res.json({ nodes });
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Failed to list nodes',
      mapId,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /:id/nodes — create a node ────────────────────────────────────────

nodesRouter.post('/:id/nodes', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  if (isNaN(mapId)) {
    return res.status(400).json({ error: 'Invalid map id' });
  }

  const { x, y, is_spawn } = req.body;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'x and y must be numbers' });
  }

  try {
    const node = await createNode(mapId, x, y, is_spawn ?? false);
    console.log(JSON.stringify({
      level: 'info',
      msg: 'Created node',
      mapId,
      nodeId: node.id,
      x,
      y,
      isSpawn: is_spawn ?? false,
      timestamp: new Date().toISOString(),
    }));
    return res.status(201).json({ node });
  } catch (err) {
    const pgError = err as { code?: string; message?: string };

    if (pgError.code === '23505') {
      console.warn(JSON.stringify({
        level: 'warn',
        msg: 'Spawn node conflict',
        mapId,
        timestamp: new Date().toISOString(),
      }));
      return res.status(409).json({ error: 'A spawn node already exists for this zone' });
    }

    console.error(JSON.stringify({
      level: 'error',
      msg: 'Failed to create node',
      mapId,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /:id/nodes/:nodeId — update node position or spawn status ──────────

nodesRouter.put('/:id/nodes/:nodeId', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  const nodeId = parseInt(req.params.nodeId!, 10);
  if (isNaN(mapId) || isNaN(nodeId)) {
    return res.status(400).json({ error: 'Invalid map id or node id' });
  }

  const { x, y, is_spawn } = req.body;

  try {
    const node = await updateNode(nodeId, { x, y, isSpawn: is_spawn });

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    console.log(JSON.stringify({
      level: 'info',
      msg: 'Updated node',
      mapId,
      nodeId,
      changes: { x, y, is_spawn },
      timestamp: new Date().toISOString(),
    }));
    return res.json({ node });
  } catch (err) {
    const pgError = err as { code?: string; message?: string };

    if (pgError.code === '23505') {
      console.warn(JSON.stringify({
        level: 'warn',
        msg: 'Spawn node conflict on update',
        mapId,
        nodeId,
        timestamp: new Date().toISOString(),
      }));
      return res.status(409).json({ error: 'A spawn node already exists for this zone' });
    }

    console.error(JSON.stringify({
      level: 'error',
      msg: 'Failed to update node',
      mapId,
      nodeId,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /:id/nodes/:nodeId — delete a node ──────────────────────────────

nodesRouter.delete('/:id/nodes/:nodeId', async (req: Request, res: Response) => {
  const mapId = parseInt(req.params.id!, 10);
  const nodeId = parseInt(req.params.nodeId!, 10);
  if (isNaN(mapId) || isNaN(nodeId)) {
    return res.status(400).json({ error: 'Invalid map id or node id' });
  }

  try {
    // Check if the target node is a spawn node before deleting
    const nodes = await getNodesForZone(mapId);
    const targetNode = nodes.find((n) => n.id === nodeId);

    if (!targetNode) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (targetNode.is_spawn) {
      return res.status(400).json({ error: 'Cannot delete spawn node. Set another node as spawn first.' });
    }

    await deleteNode(nodeId);
    console.log(JSON.stringify({
      level: 'info',
      msg: 'Deleted node',
      mapId,
      nodeId,
      timestamp: new Date().toISOString(),
    }));
    return res.json({ success: true });
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Failed to delete node',
      mapId,
      nodeId,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
});
