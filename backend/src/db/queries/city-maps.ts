import { query } from '../connection';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MapZone {
  id: number;
  name: string;
  map_type: string;
  image_filename: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
}

export interface MapZoneWithCounts extends MapZone {
  node_count: number;
  building_count: number;
}

export interface PathNode {
  id: number;
  zone_id: number;
  x: number;
  y: number;
  is_spawn: boolean;
  created_at: Date;
}

export interface PathEdge {
  id: number;
  zone_id: number;
  from_node_id: number;
  to_node_id: number;
  created_at: Date;
}

export interface Building {
  id: number;
  zone_id: number;
  node_id: number;
  name: string;
  description: string | null;
  label_offset_x: number | null;
  label_offset_y: number | null;
  hotspot_type: string | null;
  hotspot_x: number | null;
  hotspot_y: number | null;
  hotspot_w: number | null;
  hotspot_h: number | null;
  hotspot_r: number | null;
}

export interface TravelActionConfig {
  target_zone_id: number;
  target_node_id: number;
}

export interface ExploreActionConfig {
  encounter_chance: number;
  monsters: { monster_id: number; weight: number }[];
}

export type BuildingActionConfig = TravelActionConfig | ExploreActionConfig;

export interface BuildingAction {
  id: number;
  building_id: number;
  action_type: 'travel' | 'explore';
  sort_order: number;
  config: BuildingActionConfig;
  created_at: string;
}

export interface CreateBuildingData {
  node_id: number;
  name: string;
  description?: string | null;
  label_offset_x?: number;
  label_offset_y?: number;
  hotspot_type?: string | null;
  hotspot_x?: number | null;
  hotspot_y?: number | null;
  hotspot_w?: number | null;
  hotspot_h?: number | null;
  hotspot_r?: number | null;
}

// ─── Maps ────────────────────────────────────────────────────────────────────

export async function getMapsByType(mapType: string): Promise<MapZoneWithCounts[]> {
  const result = await query<MapZoneWithCounts>(
    `SELECT
       mz.*,
       (SELECT COUNT(*) FROM path_nodes pn WHERE pn.zone_id = mz.id)::int AS node_count,
       (SELECT COUNT(*) FROM buildings b WHERE b.zone_id = mz.id)::int AS building_count
     FROM map_zones mz
     WHERE mz.map_type = $1
     ORDER BY mz.id`,
    [mapType],
  );
  return result.rows;
}

export async function getMapById(zoneId: number): Promise<MapZone | null> {
  const result = await query<MapZone>(
    `SELECT * FROM map_zones WHERE id = $1`,
    [zoneId],
  );
  return result.rows[0] ?? null;
}

export async function createMap(
  name: string,
  imageWidthPx: number,
  imageHeightPx: number,
): Promise<MapZone> {
  const result = await query<MapZone>(
    `INSERT INTO map_zones (id, name, tmx_filename, width_tiles, height_tiles, spawn_x, spawn_y, map_type, image_width_px, image_height_px)
     VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM map_zones), $1, '', 0, 0, 0, 0, 'city', $2, $3)
     RETURNING *`,
    [name, imageWidthPx, imageHeightPx],
  );
  return result.rows[0]!;
}

export async function updateMap(
  zoneId: number,
  data: { name?: string; imageWidthPx?: number; imageHeightPx?: number },
): Promise<MapZone | null> {
  const fieldMap: Record<string, string> = {
    name: 'name',
    imageWidthPx: 'image_width_px',
    imageHeightPx: 'image_height_px',
  };

  const keys = (Object.keys(data) as (keyof typeof data)[]).filter((k) => data[k] !== undefined);
  if (keys.length === 0) return getMapById(zoneId);

  const setClauses = keys.map((k, i) => `${fieldMap[k]} = $${i + 2}`).join(', ');
  const values = keys.map((k) => data[k]);

  const result = await query<MapZone>(
    `UPDATE map_zones SET ${setClauses} WHERE id = $1 RETURNING *`,
    [zoneId, ...values],
  );
  return result.rows[0] ?? null;
}

export async function deleteMap(zoneId: number): Promise<void> {
  await query(
    `DELETE FROM map_zones WHERE id = $1`,
    [zoneId],
  );
}

export async function updateMapImage(zoneId: number, imageFilename: string): Promise<MapZone | null> {
  const result = await query<MapZone>(
    `UPDATE map_zones SET image_filename = $2 WHERE id = $1 RETURNING *`,
    [zoneId, imageFilename],
  );
  return result.rows[0] ?? null;
}

// ─── Nodes ───────────────────────────────────────────────────────────────────

export async function getNodesForZone(zoneId: number): Promise<PathNode[]> {
  const result = await query<PathNode>(
    `SELECT * FROM path_nodes WHERE zone_id = $1 ORDER BY id`,
    [zoneId],
  );
  return result.rows;
}

export async function createNode(
  zoneId: number,
  x: number,
  y: number,
  isSpawn: boolean = false,
): Promise<PathNode> {
  const result = await query<PathNode>(
    `INSERT INTO path_nodes (zone_id, x, y, is_spawn)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [zoneId, x, y, isSpawn],
  );
  return result.rows[0]!;
}

export async function updateNode(
  nodeId: number,
  data: { x?: number; y?: number; isSpawn?: boolean },
): Promise<PathNode | null> {
  const fieldMap: Record<string, string> = {
    x: 'x',
    y: 'y',
    isSpawn: 'is_spawn',
  };

  const keys = (Object.keys(data) as (keyof typeof data)[]).filter((k) => data[k] !== undefined);
  if (keys.length === 0) {
    const result = await query<PathNode>(`SELECT * FROM path_nodes WHERE id = $1`, [nodeId]);
    return result.rows[0] ?? null;
  }

  const setClauses = keys.map((k, i) => `${fieldMap[k]} = $${i + 2}`).join(', ');
  const values = keys.map((k) => data[k]);

  const result = await query<PathNode>(
    `UPDATE path_nodes SET ${setClauses} WHERE id = $1 RETURNING *`,
    [nodeId, ...values],
  );
  return result.rows[0] ?? null;
}

export async function deleteNode(nodeId: number): Promise<void> {
  await query(
    `DELETE FROM path_nodes WHERE id = $1`,
    [nodeId],
  );
}

export async function getSpawnNodeForZone(zoneId: number): Promise<PathNode | null> {
  const result = await query<PathNode>(
    `SELECT * FROM path_nodes WHERE zone_id = $1 AND is_spawn = true`,
    [zoneId],
  );
  return result.rows[0] ?? null;
}

// ─── Edges ───────────────────────────────────────────────────────────────────

export async function getEdgesForZone(zoneId: number): Promise<PathEdge[]> {
  const result = await query<PathEdge>(
    `SELECT * FROM path_edges WHERE zone_id = $1`,
    [zoneId],
  );
  return result.rows;
}

export async function createEdge(
  zoneId: number,
  fromNodeId: number,
  toNodeId: number,
): Promise<PathEdge> {
  // Enforce from < to ordering to prevent duplicate undirected edges
  const normalizedFrom = Math.min(fromNodeId, toNodeId);
  const normalizedTo = Math.max(fromNodeId, toNodeId);

  const result = await query<PathEdge>(
    `INSERT INTO path_edges (zone_id, from_node_id, to_node_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [zoneId, normalizedFrom, normalizedTo],
  );
  return result.rows[0]!;
}

export async function deleteEdge(edgeId: number): Promise<void> {
  await query(
    `DELETE FROM path_edges WHERE id = $1`,
    [edgeId],
  );
}

// ─── Buildings ───────────────────────────────────────────────────────────────

export async function getBuildingsForZone(zoneId: number): Promise<Building[]> {
  const result = await query<Building>(
    `SELECT * FROM buildings WHERE zone_id = $1`,
    [zoneId],
  );
  return result.rows;
}

export async function createBuilding(
  zoneId: number,
  data: CreateBuildingData,
): Promise<Building> {
  const result = await query<Building>(
    `INSERT INTO buildings
       (zone_id, node_id, name, label_offset_x, label_offset_y,
        hotspot_type, hotspot_x, hotspot_y, hotspot_w, hotspot_h, hotspot_r)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      zoneId,
      data.node_id,
      data.name,
      data.label_offset_x ?? null,
      data.label_offset_y ?? null,
      data.hotspot_type ?? null,
      data.hotspot_x ?? null,
      data.hotspot_y ?? null,
      data.hotspot_w ?? null,
      data.hotspot_h ?? null,
      data.hotspot_r ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function updateBuilding(
  buildingId: number,
  data: Partial<CreateBuildingData>,
): Promise<Building | null> {
  const fieldMap: Record<string, string> = {
    node_id: 'node_id',
    name: 'name',
    description: 'description',
    label_offset_x: 'label_offset_x',
    label_offset_y: 'label_offset_y',
    hotspot_type: 'hotspot_type',
    hotspot_x: 'hotspot_x',
    hotspot_y: 'hotspot_y',
    hotspot_w: 'hotspot_w',
    hotspot_h: 'hotspot_h',
    hotspot_r: 'hotspot_r',
  };

  const keys = (Object.keys(data) as (keyof typeof data)[]).filter((k) => data[k] !== undefined);
  if (keys.length === 0) {
    const result = await query<Building>(`SELECT * FROM buildings WHERE id = $1`, [buildingId]);
    return result.rows[0] ?? null;
  }

  const setClauses = keys.map((k, i) => `${fieldMap[k]} = $${i + 2}`).join(', ');
  const values = keys.map((k) => data[k] ?? null);

  const result = await query<Building>(
    `UPDATE buildings SET ${setClauses} WHERE id = $1 RETURNING *`,
    [buildingId, ...values],
  );
  return result.rows[0] ?? null;
}

export async function deleteBuilding(buildingId: number): Promise<void> {
  await query(
    `DELETE FROM buildings WHERE id = $1`,
    [buildingId],
  );
}

export async function getBuildingById(buildingId: number): Promise<Building | null> {
  const result = await query<Building>(
    `SELECT * FROM buildings WHERE id = $1`,
    [buildingId],
  );
  return result.rows[0] ?? null;
}

// ─── Building Actions ─────────────────────────────────────────────────────────

export async function getBuildingActions(buildingId: number): Promise<BuildingAction[]> {
  const result = await query<BuildingAction>(
    `SELECT * FROM building_actions WHERE building_id = $1 ORDER BY sort_order, id`,
    [buildingId],
  );
  return result.rows;
}

export async function getBuildingActionsForZone(zoneId: number): Promise<BuildingAction[]> {
  const result = await query<BuildingAction>(
    `SELECT ba.*
     FROM building_actions ba
     JOIN buildings b ON b.id = ba.building_id
     WHERE b.zone_id = $1
     ORDER BY ba.sort_order, ba.id`,
    [zoneId],
  );
  return result.rows;
}

export async function createBuildingAction(
  buildingId: number,
  actionType: 'travel' | 'explore',
  config: BuildingActionConfig,
  sortOrder: number = 0,
): Promise<BuildingAction> {
  const result = await query<BuildingAction>(
    `INSERT INTO building_actions (building_id, action_type, config, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [buildingId, actionType, JSON.stringify(config), sortOrder],
  );
  return result.rows[0]!;
}

export async function updateBuildingAction(
  actionId: number,
  data: { sort_order?: number; config?: TravelActionConfig },
): Promise<BuildingAction | null> {
  const fieldMap: Record<string, string> = {
    sort_order: 'sort_order',
    config: 'config',
  };

  const keys = (Object.keys(data) as (keyof typeof data)[]).filter((k) => data[k] !== undefined);
  if (keys.length === 0) {
    const result = await query<BuildingAction>(`SELECT * FROM building_actions WHERE id = $1`, [actionId]);
    return result.rows[0] ?? null;
  }

  const setClauses = keys.map((k, i) => {
    const col = fieldMap[k];
    return k === 'config' ? `${col} = $${i + 2}::jsonb` : `${col} = $${i + 2}`;
  }).join(', ');
  const values = keys.map((k) => k === 'config' ? JSON.stringify(data[k]) : data[k]);

  const result = await query<BuildingAction>(
    `UPDATE building_actions SET ${setClauses} WHERE id = $1 RETURNING *`,
    [actionId, ...values],
  );
  return result.rows[0] ?? null;
}

export async function deleteBuildingAction(actionId: number): Promise<void> {
  await query(
    `DELETE FROM building_actions WHERE id = $1`,
    [actionId],
  );
}
