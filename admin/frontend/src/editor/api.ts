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

export interface ExploreMonsterEntry {
  monster_id: number;
  weight: number;
}

export interface ExploreActionConfig {
  encounter_chance: number;
  monsters: ExploreMonsterEntry[];
}

export interface ExpeditionItemEntry {
  item_def_id: number;
  base_quantity: number;
}

export interface ExpeditionActionConfig {
  base_gold: number;
  base_exp: number;
  items: ExpeditionItemEntry[];
}

export type BuildingActionConfig = TravelActionConfig | ExploreActionConfig | ExpeditionActionConfig;

export interface BuildingAction {
  id: number;
  building_id: number;
  action_type: 'travel' | 'explore' | 'expedition';
  sort_order: number;
  config: BuildingActionConfig;
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
  data: {
    action_type: 'travel' | 'explore' | 'expedition';
    sort_order?: number;
    config: BuildingActionConfig;
  },
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
  data: { sort_order?: number; config?: BuildingActionConfig },
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

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const ITEMS_BASE = '/api/items';

export interface ItemDefinitionResponse {
  id: number;
  name: string;
  description: string | null;
  category: string;
  weapon_subtype: string | null;
  attack: number | null;
  defence: number | null;
  heal_power: number | null;
  food_power: number | null;
  stack_size: number | null;
  icon_url: string | null;
  created_at: string;
}

export async function getItems(category?: string): Promise<ItemDefinitionResponse[]> {
  const url = category ? `${ITEMS_BASE}?category=${encodeURIComponent(category)}` : ITEMS_BASE;
  return request<ItemDefinitionResponse[]>(url);
}

export async function getItem(id: number): Promise<ItemDefinitionResponse> {
  return request<ItemDefinitionResponse>(`${ITEMS_BASE}/${id}`);
}

export async function createItem(formData: FormData): Promise<ItemDefinitionResponse> {
  return request<ItemDefinitionResponse>(ITEMS_BASE, {
    method: 'POST',
    body: formData,
  });
}

export async function updateItem(id: number, formData: FormData): Promise<ItemDefinitionResponse> {
  return request<ItemDefinitionResponse>(`${ITEMS_BASE}/${id}`, {
    method: 'PUT',
    body: formData,
  });
}

export async function deleteItem(id: number): Promise<void> {
  return request<void>(`${ITEMS_BASE}/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

const MONSTERS_BASE = '/api/monsters';

export interface MonsterLootEntry {
  id: number;
  item_def_id: number;
  item_name: string;
  drop_chance: number;
  quantity: number;
  icon_url: string | null;
}

export interface MonsterResponse {
  id: number;
  name: string;
  attack: number;
  defense: number;
  hp: number;
  xp_reward: number;
  min_crowns: number;
  max_crowns: number;
  icon_url: string | null;
  created_at: string;
  loot?: MonsterLootEntry[];
}

export async function listMonsters(): Promise<MonsterResponse[]> {
  return request<MonsterResponse[]>(MONSTERS_BASE);
}

export async function getMonster(id: number): Promise<MonsterResponse> {
  return request<MonsterResponse>(`${MONSTERS_BASE}/${id}`);
}

export async function createMonster(formData: FormData): Promise<MonsterResponse> {
  return request<MonsterResponse>(MONSTERS_BASE, { method: 'POST', body: formData });
}

export async function updateMonster(id: number, formData: FormData): Promise<MonsterResponse> {
  return request<MonsterResponse>(`${MONSTERS_BASE}/${id}`, { method: 'PUT', body: formData });
}

export async function deleteMonster(id: number): Promise<void> {
  return request<void>(`${MONSTERS_BASE}/${id}`, { method: 'DELETE' });
}

export async function addMonsterLoot(
  monsterId: number,
  data: { item_def_id: number; drop_chance: number; quantity: number },
): Promise<MonsterLootEntry> {
  return request<MonsterLootEntry>(`${MONSTERS_BASE}/${monsterId}/loot`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMonsterLoot(
  monsterId: number,
  lootId: number,
  data: { drop_chance?: number; quantity?: number },
): Promise<MonsterLootEntry> {
  return request<MonsterLootEntry>(`${MONSTERS_BASE}/${monsterId}/loot/${lootId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteMonsterLoot(monsterId: number, lootId: number): Promise<void> {
  return request<void>(`${MONSTERS_BASE}/${monsterId}/loot/${lootId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Admin Tools
// ---------------------------------------------------------------------------

const ADMIN_TOOLS_BASE = '/api/admin-tools';

export interface CharacterSummary {
  id: string;
  name: string;
  level: number;
  class_name: string;
}

export async function getCharacters(): Promise<CharacterSummary[]> {
  return request<CharacterSummary[]>(`${ADMIN_TOOLS_BASE}/characters`);
}

export async function grantItem(
  characterId: string,
  itemDefId: number,
  quantity: number,
): Promise<{ success: true; message: string }> {
  return request<{ success: true; message: string }>(`${ADMIN_TOOLS_BASE}/grant-item`, {
    method: 'POST',
    body: JSON.stringify({ character_id: characterId, item_def_id: itemDefId, quantity }),
  });
}

// ---------------------------------------------------------------------------
// Image Prompt Templates
// ---------------------------------------------------------------------------

const IMAGE_PROMPTS_BASE = '/api/image-prompts';

export interface ImagePromptTemplate {
  id: number;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export async function getImagePrompts(): Promise<ImagePromptTemplate[]> {
  return request<ImagePromptTemplate[]>(IMAGE_PROMPTS_BASE);
}

export async function getImagePromptById(id: number): Promise<ImagePromptTemplate> {
  return request<ImagePromptTemplate>(`${IMAGE_PROMPTS_BASE}/${id}`);
}

export async function createImagePrompt(data: { name: string; body: string }): Promise<ImagePromptTemplate> {
  return request<ImagePromptTemplate>(IMAGE_PROMPTS_BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateImagePrompt(
  id: number,
  data: { name?: string; body?: string },
): Promise<ImagePromptTemplate> {
  return request<ImagePromptTemplate>(`${IMAGE_PROMPTS_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteImagePrompt(id: number): Promise<void> {
  return request<void>(`${IMAGE_PROMPTS_BASE}/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Admin Config
// ---------------------------------------------------------------------------

const ADMIN_CONFIG_BASE = '/api/admin-config';

export const VALID_IMAGE_GEN_MODELS = [
  'google/gemini-2.5-flash-image',
  'google/gemini-2.5-flash-image-preview',
  'google/gemini-3-pro-image-preview',
  'google/gemini-3.1-flash-image-preview',
  'openai/gpt-5-image-mini',
  'openai/gpt-5-image',
] as const;

export async function getAdminConfig(): Promise<Record<string, string>> {
  return request<Record<string, string>>(ADMIN_CONFIG_BASE);
}

export async function updateAdminConfig(data: Record<string, string>): Promise<Record<string, string>> {
  return request<Record<string, string>>(ADMIN_CONFIG_BASE, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// AI Image Generation
// ---------------------------------------------------------------------------

const AI_BASE = '/api/ai';

export interface GenerateImageResult {
  base64: string;
  resolved_prompt: string;
  model_used: string;
}

export async function generateImageFromPrompt(
  promptId: number,
  variables: Record<string, string>,
): Promise<GenerateImageResult> {
  return request<GenerateImageResult>(`${AI_BASE}/generate-image`, {
    method: 'POST',
    body: JSON.stringify({ prompt_id: promptId, variables }),
  });
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

const NPCS_BASE = '/api/npcs';

export interface NpcResponse {
  id: number;
  name: string;
  description: string;
  icon_filename: string;
  icon_url: string;
  created_at: string;
}

export interface NpcUploadResult {
  icon_filename: string;
  icon_url: string;
}

export interface BuildingNpcEntry {
  npc_id: number;
  name: string;
  icon_url: string;
  sort_order: number;
}

export async function listNpcs(): Promise<NpcResponse[]> {
  return request<NpcResponse[]>(NPCS_BASE);
}

export async function createNpc(data: {
  name: string;
  description: string;
  icon_filename: string;
}): Promise<NpcResponse> {
  return request<NpcResponse>(NPCS_BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNpc(id: number, data: {
  name?: string;
  description?: string;
  icon_filename?: string;
}): Promise<NpcResponse> {
  return request<NpcResponse>(`${NPCS_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteNpc(id: number): Promise<void> {
  return request<void>(`${NPCS_BASE}/${id}`, { method: 'DELETE' });
}

export async function uploadNpcIcon(file: File): Promise<NpcUploadResult> {
  const form = new FormData();
  form.append('icon', file);
  return request<NpcUploadResult>(`${NPCS_BASE}/upload`, { method: 'POST', body: form });
}

export async function listBuildingNpcs(mapId: number, buildingId: number): Promise<BuildingNpcEntry[]> {
  const res = await request<{ npcs: BuildingNpcEntry[] }>(
    `${BASE}/${mapId}/buildings/${buildingId}/npcs`,
  );
  return res.npcs;
}

export async function assignNpcToBuilding(mapId: number, buildingId: number, npcId: number): Promise<void> {
  return request<void>(`${BASE}/${mapId}/buildings/${buildingId}/npcs`, {
    method: 'POST',
    body: JSON.stringify({ npc_id: npcId }),
  });
}

export async function removeNpcFromBuilding(mapId: number, buildingId: number, npcId: number): Promise<void> {
  return request<void>(`${BASE}/${mapId}/buildings/${buildingId}/npcs/${npcId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

const ABILITIES_BASE = '/api/abilities';

export interface AbilityResponse {
  id: number;
  name: string;
  description: string;
  effect_type: string;
  mana_cost: number;
  effect_value: number;
  duration_turns: number;
  cooldown_turns: number;
  priority_default: number;
  slot_type: string;
  icon_url: string | null;
  created_at: string;
}

export async function listAbilities(): Promise<AbilityResponse[]> {
  return request<AbilityResponse[]>(ABILITIES_BASE);
}

export async function getAbility(id: number): Promise<AbilityResponse> {
  return request<AbilityResponse>(`${ABILITIES_BASE}/${id}`);
}

export async function createAbility(formData: FormData): Promise<AbilityResponse> {
  return request<AbilityResponse>(ABILITIES_BASE, { method: 'POST', body: formData });
}

export async function updateAbility(id: number, formData: FormData): Promise<AbilityResponse> {
  return request<AbilityResponse>(`${ABILITIES_BASE}/${id}`, { method: 'PUT', body: formData });
}

export async function deleteAbility(id: number): Promise<void> {
  return request<void>(`${ABILITIES_BASE}/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Encounter tables
// ---------------------------------------------------------------------------

export interface EncounterEntry {
  id: number;
  zone_id: number;
  monster_id: number;
  monster_name: string;
  weight: number;
}

const ENCOUNTER_BASE = '/api/encounter-tables';

export async function getEncounterTable(zoneId: number): Promise<EncounterEntry[]> {
  return request<EncounterEntry[]>(`${ENCOUNTER_BASE}/${zoneId}`);
}

export async function upsertEncounterEntry(zoneId: number, monsterId: number, weight: number): Promise<EncounterEntry> {
  return request<EncounterEntry>(`${ENCOUNTER_BASE}/${zoneId}`, {
    method: 'PUT',
    body: JSON.stringify({ monster_id: monsterId, weight }),
  });
}

export async function deleteEncounterEntry(entryId: number): Promise<void> {
  await request<void>(`${ENCOUNTER_BASE}/entry/${entryId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Crafting Recipes
// ---------------------------------------------------------------------------

const RECIPES_BASE = '/api/recipes';

export interface RecipeIngredient {
  id: number;
  item_def_id: number;
  item_name: string;
  quantity: number;
}

export interface RecipeResponse {
  id: number;
  npc_id: number;
  name: string;
  description: string | null;
  output_item_id: number;
  output_quantity: number;
  cost_crowns: number;
  craft_time_seconds: number;
  sort_order: number;
  ingredients: RecipeIngredient[];
}

export async function getRecipes(npcId?: number): Promise<RecipeResponse[]> {
  const qs = npcId ? `?npc_id=${npcId}` : '';
  return request<RecipeResponse[]>(`${RECIPES_BASE}${qs}`);
}

export async function getRecipeById(id: number): Promise<RecipeResponse> {
  return request<RecipeResponse>(`${RECIPES_BASE}/${id}`);
}

export async function createRecipe(data: {
  npc_id: number;
  name: string;
  description?: string;
  output_item_id: number;
  output_quantity: number;
  cost_crowns: number;
  craft_time_seconds: number;
  sort_order?: number;
  ingredients: { item_def_id: number; quantity: number }[];
}): Promise<RecipeResponse> {
  return request<RecipeResponse>(RECIPES_BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecipe(id: number, data: {
  name?: string;
  description?: string;
  output_item_id?: number;
  output_quantity?: number;
  cost_crowns?: number;
  craft_time_seconds?: number;
  sort_order?: number;
  ingredients?: { item_def_id: number; quantity: number }[];
}): Promise<RecipeResponse> {
  return request<RecipeResponse>(`${RECIPES_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  return request<void>(`${RECIPES_BASE}/${id}`, { method: 'DELETE' });
}

export async function toggleNpcCrafter(npcId: number, isCrafter: boolean): Promise<void> {
  return request<void>(`${NPCS_BASE}/${npcId}/crafter`, {
    method: 'PUT',
    body: JSON.stringify({ is_crafter: isCrafter }),
  });
}
