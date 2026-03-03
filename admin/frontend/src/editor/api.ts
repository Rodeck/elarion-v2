// ---------------------------------------------------------------------------
// Elarion Map Editor — Typed REST API Client
// ---------------------------------------------------------------------------

const BASE = '/api/maps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapSummary {
  id: number;
  name: string;
  map_type: 'city';
  image_filename: string | null;
  image_width_px: number;
  image_height_px: number;
  node_count: number;
  building_count: number;
}

export interface PathNode {
  id: number;
  zone_id: number;
  x: number;
  y: number;
  is_spawn: boolean;
}

export interface PathEdge {
  id: number;
  zone_id: number;
  from_node_id: number;
  to_node_id: number;
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

export interface BuildingAction {
  id: number;
  building_id: number;
  action_type: 'travel';
  sort_order: number;
  config: TravelActionConfig;
  created_at: string;
}

export interface MapFull extends MapSummary {
  nodes: PathNode[];
  edges: PathEdge[];
  buildings: Building[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

function handleUnauthorized(): never {
  localStorage.removeItem('admin_token');
  window.location.hash = '#/';
  throw new Error('Unauthorized — redirecting to login');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for JSON bodies (not FormData)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    handleUnauthorized();
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body.error) {
        message = body.error;
      }
    } catch {
      // use statusText as fallback
    }
    throw new Error(message);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch { /* use statusText */ }
    throw new Error(message);
  }

  const { token } = await res.json() as { token: string };
  return token;
}

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

export async function listMaps(): Promise<MapSummary[]> {
  const res = await request<{ maps: MapSummary[] }>(BASE);
  return res.maps;
}

export async function getMap(id: number): Promise<MapFull> {
  const res = await request<{ map: MapFull }>(`${BASE}/${id}`);
  return res.map;
}

export async function createMap(
  name: string,
  width: number,
  height: number,
): Promise<MapFull> {
  const res = await request<{ map: MapFull }>(BASE, {
    method: 'POST',
    body: JSON.stringify({ name, image_width_px: width, image_height_px: height }),
  });
  return res.map;
}

export async function updateMap(
  id: number,
  data: { name?: string; image_width_px?: number; image_height_px?: number },
): Promise<MapFull> {
  const res = await request<{ map: MapFull }>(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.map;
}

export async function deleteMap(id: number): Promise<void> {
  return request<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function uploadImage(id: number, file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);

  const res = await request<{ image_url: string }>(
    `${BASE}/${id}/image`,
    { method: 'POST', body: form },
  );
  return res.image_url;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export async function listNodes(mapId: number): Promise<PathNode[]> {
  const res = await request<{ nodes: PathNode[] }>(`${BASE}/${mapId}/nodes`);
  return res.nodes;
}

export async function createNode(
  mapId: number,
  x: number,
  y: number,
  isSpawn?: boolean,
): Promise<PathNode> {
  const res = await request<{ node: PathNode }>(`${BASE}/${mapId}/nodes`, {
    method: 'POST',
    body: JSON.stringify({ x, y, is_spawn: isSpawn ?? false }),
  });
  return res.node;
}

export async function updateNode(
  mapId: number,
  nodeId: number,
  data: { x?: number; y?: number; is_spawn?: boolean },
): Promise<PathNode> {
  const res = await request<{ node: PathNode }>(`${BASE}/${mapId}/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.node;
}

export async function deleteNode(
  mapId: number,
  nodeId: number,
): Promise<void> {
  return request<void>(`${BASE}/${mapId}/nodes/${nodeId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export async function listEdges(mapId: number): Promise<PathEdge[]> {
  const res = await request<{ edges: PathEdge[] }>(`${BASE}/${mapId}/edges`);
  return res.edges;
}

export async function createEdge(
  mapId: number,
  fromNodeId: number,
  toNodeId: number,
): Promise<PathEdge> {
  const res = await request<{ edge: PathEdge }>(`${BASE}/${mapId}/edges`, {
    method: 'POST',
    body: JSON.stringify({ from_node_id: fromNodeId, to_node_id: toNodeId }),
  });
  return res.edge;
}

export async function deleteEdge(
  mapId: number,
  edgeId: number,
): Promise<void> {
  return request<void>(`${BASE}/${mapId}/edges/${edgeId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export async function listBuildings(mapId: number): Promise<Building[]> {
  const res = await request<{ buildings: Building[] }>(`${BASE}/${mapId}/buildings`);
  return res.buildings;
}

export async function createBuilding(
  mapId: number,
  data: {
    node_id: number;
    name: string;
    label_offset_x?: number;
    label_offset_y?: number;
    hotspot_type?: string;
    hotspot_x?: number;
    hotspot_y?: number;
    hotspot_w?: number;
    hotspot_h?: number;
    hotspot_r?: number;
  },
): Promise<Building> {
  const res = await request<{ building: Building }>(`${BASE}/${mapId}/buildings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.building;
}

export async function updateBuilding(
  mapId: number,
  buildingId: number,
  data: Partial<{
    node_id: number;
    name: string;
    description: string | null;
    label_offset_x: number;
    label_offset_y: number;
    hotspot_type: string;
    hotspot_x: number;
    hotspot_y: number;
    hotspot_w: number;
    hotspot_h: number;
    hotspot_r: number;
  }>,
): Promise<Building> {
  const res = await request<{ building: Building }>(`${BASE}/${mapId}/buildings/${buildingId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.building;
}

export async function deleteBuilding(
  mapId: number,
  buildingId: number,
): Promise<void> {
  return request<void>(`${BASE}/${mapId}/buildings/${buildingId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Building Actions
// ---------------------------------------------------------------------------

export async function listBuildingActions(mapId: number, buildingId: number): Promise<BuildingAction[]> {
  const res = await request<{ actions: BuildingAction[] }>(
    `${BASE}/${mapId}/buildings/${buildingId}/actions`,
  );
  return res.actions;
}

export async function createBuildingAction(
  mapId: number,
  buildingId: number,
  data: { action_type: 'travel'; sort_order?: number; config: TravelActionConfig },
): Promise<BuildingAction> {
  const res = await request<{ action: BuildingAction }>(
    `${BASE}/${mapId}/buildings/${buildingId}/actions`,
    { method: 'POST', body: JSON.stringify(data) },
  );
  return res.action;
}

export async function updateBuildingAction(
  mapId: number,
  buildingId: number,
  actionId: number,
  data: { sort_order?: number; config?: TravelActionConfig },
): Promise<BuildingAction> {
  const res = await request<{ action: BuildingAction }>(
    `${BASE}/${mapId}/buildings/${buildingId}/actions/${actionId}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
  return res.action;
}

export async function deleteBuildingAction(
  mapId: number,
  buildingId: number,
  actionId: number,
): Promise<void> {
  return request<void>(
    `${BASE}/${mapId}/buildings/${buildingId}/actions/${actionId}`,
    { method: 'DELETE' },
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function validateMap(
  id: number,
): Promise<{ valid: boolean; errors: string[] }> {
  return request<{ valid: boolean; errors: string[] }>(
    `${BASE}/${id}/validate`,
  );
}
