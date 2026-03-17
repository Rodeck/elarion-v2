import { MapListView } from './ui/map-list';
import { ItemManager } from './ui/item-manager';
import { MonsterManager } from './ui/monster-manager';
import { AdminTools } from './ui/admin-tools';
import { ImagePromptManager } from './ui/image-prompt-manager';
import { AdminConfigManager } from './ui/admin-config-manager';
import { EncounterTableManager } from './ui/encounter-table-manager';
import { NpcManager } from './ui/npc-manager';
import { AbilityManager } from './ui/ability-manager';
import { RecipeManager } from './ui/recipe-manager';
import { Toolbar } from './ui/toolbar';
import { MapCanvas } from './editor/canvas';
import { EditorModeManager } from './editor/modes';
import { PropertiesPanel } from './ui/properties';
import {
  getMap,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  deleteEdge,
  uploadImage,
  validateMap,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  type MapFull,
  type PathNode,
  type PathEdge,
  type Building,
} from './editor/api';
import type { EditorNode, EditorEdge, EditorBuilding } from './editor/canvas';

const app = document.getElementById('app')!;

let mapListView: MapListView | null = null;
let itemManager: ItemManager | null = null;
let monsterManager: MonsterManager | null = null;
let adminTools: AdminTools | null = null;
let imagePromptManager: ImagePromptManager | null = null;
let adminConfigManager: AdminConfigManager | null = null;
let npcManager: NpcManager | null = null;
let abilityManager: AbilityManager | null = null;
let recipeManager: RecipeManager | null = null;
let toolbar: Toolbar | null = null;
let canvas: MapCanvas | null = null;
let modeManager: EditorModeManager | null = null;
let propertiesPanel: PropertiesPanel | null = null;
let currentMapId: number | null = null;
let currentMapData: MapFull | null = null;

// Track in-memory changes for save
let pendingNewBuildings: EditorBuilding[] = [];
let pendingDeletedBuildingIds: Set<number> = new Set();
let pendingModifiedBuildingIds: Set<number> = new Set();

function toEditorNodes(nodes: PathNode[]): EditorNode[] {
  return nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    is_spawn: n.is_spawn,
  }));
}

function toEditorEdges(edges: PathEdge[]): EditorEdge[] {
  return edges.map((e) => ({
    id: e.id,
    from_node_id: e.from_node_id,
    to_node_id: e.to_node_id,
  }));
}

function toEditorBuildings(buildings: Building[]): EditorBuilding[] {
  return buildings.map((b) => ({
    id: b.id,
    node_id: b.node_id,
    name: b.name,
    label_offset_x: b.label_offset_x ?? 0,
    label_offset_y: b.label_offset_y ?? -20,
    hotspot_type: b.hotspot_type,
    hotspot_x: b.hotspot_x,
    hotspot_y: b.hotspot_y,
    hotspot_w: b.hotspot_w,
    hotspot_h: b.hotspot_h,
    hotspot_r: b.hotspot_r,
  }));
}

function destroyEditor(): void {
  toolbar?.destroy();
  canvas?.destroy();
  modeManager = null;
  toolbar = null;
  canvas = null;
  currentMapId = null;
  currentMapData = null;
  pendingNewBuildings = [];
  pendingDeletedBuildingIds.clear();
  pendingModifiedBuildingIds.clear();
}

function destroyAll(): void {
  mapListView?.destroy();
  mapListView = null;
  itemManager = null;
  monsterManager = null;
  adminTools = null;
  imagePromptManager = null;
  adminConfigManager = null;
  npcManager = null;
  abilityManager = null;
  recipeManager = null;
  destroyEditor();
  app.innerHTML = '';
}

async function showMapList(activeTab: 'maps' | 'items' | 'monsters' | 'admin-tools' | 'image-prompts' | 'config' | 'npcs' | 'abilities' | 'recipes' = 'maps'): Promise<void> {
  destroyAll();

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'admin-tab-bar';
  tabBar.innerHTML = `
    <button class="btn ${activeTab === 'maps' ? 'btn--active' : ''}" id="tab-maps">Map Editor</button>
    <button class="btn ${activeTab === 'items' ? 'btn--active' : ''}" id="tab-items">Items</button>
    <button class="btn ${activeTab === 'monsters' ? 'btn--active' : ''}" id="tab-monsters">Monsters</button>
    <button class="btn ${activeTab === 'admin-tools' ? 'btn--active' : ''}" id="tab-admin-tools">Admin Tools</button>
    <button class="btn ${activeTab === 'image-prompts' ? 'btn--active' : ''}" id="tab-image-prompts">Image Prompts</button>
    <button class="btn ${activeTab === 'config' ? 'btn--active' : ''}" id="tab-config">Config</button>
    <button class="btn ${activeTab === 'npcs' ? 'btn--active' : ''}" id="tab-npcs">NPCs</button>
    <button class="btn ${activeTab === 'abilities' ? 'btn--active' : ''}" id="tab-abilities">Abilities</button>
    <button class="btn ${activeTab === 'recipes' ? 'btn--active' : ''}" id="tab-recipes">Recipes</button>
    <div style="flex:1"></div>
    <span style="font-size:0.75rem;color:#2d3347;align-self:center;padding-right:0.5rem;letter-spacing:0.05em;font-weight:600;">ELARION ADMIN</span>
  `;
  app.appendChild(tabBar);

  // Panels
  const mapEditorPanel = document.createElement('div');
  mapEditorPanel.id = 'map-editor';
  mapEditorPanel.style.display = activeTab === 'maps' ? '' : 'none';
  app.appendChild(mapEditorPanel);

  const itemManagerPanel = document.createElement('div');
  itemManagerPanel.id = 'item-manager';
  itemManagerPanel.style.display = activeTab === 'items' ? '' : 'none';
  app.appendChild(itemManagerPanel);

  const monsterManagerPanel = document.createElement('div');
  monsterManagerPanel.id = 'monster-manager';
  monsterManagerPanel.style.display = activeTab === 'monsters' ? '' : 'none';
  app.appendChild(monsterManagerPanel);

  const adminToolsPanel = document.createElement('div');
  adminToolsPanel.id = 'admin-tools';
  adminToolsPanel.style.display = activeTab === 'admin-tools' ? '' : 'none';
  app.appendChild(adminToolsPanel);

  const imagePromptsPanel = document.createElement('div');
  imagePromptsPanel.id = 'image-prompts-manager';
  imagePromptsPanel.style.display = activeTab === 'image-prompts' ? '' : 'none';
  app.appendChild(imagePromptsPanel);

  const adminConfigPanel = document.createElement('div');
  adminConfigPanel.id = 'admin-config';
  adminConfigPanel.style.display = activeTab === 'config' ? '' : 'none';
  app.appendChild(adminConfigPanel);

  const npcManagerPanel = document.createElement('div');
  npcManagerPanel.id = 'npc-manager';
  npcManagerPanel.style.display = activeTab === 'npcs' ? '' : 'none';
  app.appendChild(npcManagerPanel);

  const abilityManagerPanel = document.createElement('div');
  abilityManagerPanel.id = 'ability-manager';
  abilityManagerPanel.style.display = activeTab === 'abilities' ? '' : 'none';
  app.appendChild(abilityManagerPanel);

  const recipeManagerPanel = document.createElement('div');
  recipeManagerPanel.id = 'recipe-manager';
  recipeManagerPanel.style.display = activeTab === 'recipes' ? '' : 'none';
  app.appendChild(recipeManagerPanel);

  function setActiveTab(tab: 'maps' | 'items' | 'monsters' | 'admin-tools' | 'image-prompts' | 'config' | 'npcs' | 'abilities' | 'recipes'): void {
    mapEditorPanel.style.display = tab === 'maps' ? '' : 'none';
    itemManagerPanel.style.display = tab === 'items' ? '' : 'none';
    monsterManagerPanel.style.display = tab === 'monsters' ? '' : 'none';
    adminToolsPanel.style.display = tab === 'admin-tools' ? '' : 'none';
    imagePromptsPanel.style.display = tab === 'image-prompts' ? '' : 'none';
    adminConfigPanel.style.display = tab === 'config' ? '' : 'none';
    npcManagerPanel.style.display = tab === 'npcs' ? '' : 'none';
    abilityManagerPanel.style.display = tab === 'abilities' ? '' : 'none';
    recipeManagerPanel.style.display = tab === 'recipes' ? '' : 'none';
    tabBar.querySelector('#tab-maps')!.classList.toggle('btn--active', tab === 'maps');
    tabBar.querySelector('#tab-items')!.classList.toggle('btn--active', tab === 'items');
    tabBar.querySelector('#tab-monsters')!.classList.toggle('btn--active', tab === 'monsters');
    tabBar.querySelector('#tab-admin-tools')!.classList.toggle('btn--active', tab === 'admin-tools');
    tabBar.querySelector('#tab-image-prompts')!.classList.toggle('btn--active', tab === 'image-prompts');
    tabBar.querySelector('#tab-config')!.classList.toggle('btn--active', tab === 'config');
    tabBar.querySelector('#tab-npcs')!.classList.toggle('btn--active', tab === 'npcs');
    tabBar.querySelector('#tab-abilities')!.classList.toggle('btn--active', tab === 'abilities');
    tabBar.querySelector('#tab-recipes')!.classList.toggle('btn--active', tab === 'recipes');
  }

  tabBar.querySelector('#tab-maps')!.addEventListener('click', () => setActiveTab('maps'));

  tabBar.querySelector('#tab-items')!.addEventListener('click', async () => {
    setActiveTab('items');
    if (!itemManager) {
      itemManager = new ItemManager();
      itemManager.init(itemManagerPanel);
      await itemManager.load();
    }
  });

  tabBar.querySelector('#tab-monsters')!.addEventListener('click', async () => {
    setActiveTab('monsters');
    if (!monsterManager) {
      monsterManager = new MonsterManager();
      monsterManager.init(monsterManagerPanel);
      await monsterManager.load();
    }
  });

  tabBar.querySelector('#tab-admin-tools')!.addEventListener('click', async () => {
    setActiveTab('admin-tools');
    if (!adminTools) {
      adminTools = new AdminTools();
      adminTools.init(adminToolsPanel);
      await adminTools.load();
    }
  });

  tabBar.querySelector('#tab-image-prompts')!.addEventListener('click', async () => {
    setActiveTab('image-prompts');
    if (!imagePromptManager) {
      imagePromptManager = new ImagePromptManager();
      imagePromptManager.init(imagePromptsPanel);
      await imagePromptManager.load();
    }
  });

  tabBar.querySelector('#tab-config')!.addEventListener('click', async () => {
    setActiveTab('config');
    if (!adminConfigManager) {
      adminConfigManager = new AdminConfigManager();
      adminConfigManager.init(adminConfigPanel);
      await adminConfigManager.load();
    }
  });

  tabBar.querySelector('#tab-npcs')!.addEventListener('click', async () => {
    setActiveTab('npcs');
    if (!npcManager) {
      npcManager = new NpcManager();
      npcManager.init(npcManagerPanel);
      await npcManager.load();
    }
  });

  tabBar.querySelector('#tab-abilities')!.addEventListener('click', async () => {
    setActiveTab('abilities');
    if (!abilityManager) {
      abilityManager = new AbilityManager();
      abilityManager.init(abilityManagerPanel);
      await abilityManager.load();
    }
  });

  tabBar.querySelector('#tab-recipes')!.addEventListener('click', async () => {
    setActiveTab('recipes');
    if (!recipeManager) {
      recipeManager = new RecipeManager();
      recipeManager.init(recipeManagerPanel);
      await recipeManager.load();
    }
  });

  // Initialize map list
  mapListView = new MapListView(mapEditorPanel);
  mapListView.setOnEditMap((mapId) => {
    window.location.hash = `#/edit/${mapId}`;
  });
  await mapListView.render();

  // Eagerly initialize whichever tab is active on load
  if (activeTab === 'items') {
    itemManager = new ItemManager();
    itemManager.init(itemManagerPanel);
    await itemManager.load();
  } else if (activeTab === 'monsters') {
    monsterManager = new MonsterManager();
    monsterManager.init(monsterManagerPanel);
    await monsterManager.load();
  } else if (activeTab === 'admin-tools') {
    adminTools = new AdminTools();
    adminTools.init(adminToolsPanel);
    await adminTools.load();
  } else if (activeTab === 'image-prompts') {
    imagePromptManager = new ImagePromptManager();
    imagePromptManager.init(imagePromptsPanel);
    await imagePromptManager.load();
  } else if (activeTab === 'config') {
    adminConfigManager = new AdminConfigManager();
    adminConfigManager.init(adminConfigPanel);
    await adminConfigManager.load();
  } else if (activeTab === 'npcs') {
    npcManager = new NpcManager();
    npcManager.init(npcManagerPanel);
    await npcManager.load();
  } else if (activeTab === 'abilities') {
    abilityManager = new AbilityManager();
    abilityManager.init(abilityManagerPanel);
    await abilityManager.load();
  } else if (activeTab === 'recipes') {
    recipeManager = new RecipeManager();
    recipeManager.init(recipeManagerPanel);
    await recipeManager.load();
  }
}

async function showEditor(mapId: number): Promise<void> {
  destroyAll();

  currentMapId = mapId;

  // Create layout
  const layout = document.createElement('div');
  layout.className = 'editor-layout';

  const toolbarContainer = document.createElement('div');
  toolbarContainer.className = 'editor-sidebar editor-sidebar--left';

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'editor-canvas-container';

  const propertiesContainer = document.createElement('div');
  propertiesContainer.className = 'editor-sidebar editor-sidebar--right';
  propertiesContainer.id = 'properties-panel';

  layout.appendChild(toolbarContainer);
  layout.appendChild(canvasContainer);
  layout.appendChild(propertiesContainer);
  app.appendChild(layout);

  // Load map data
  try {
    currentMapData = await getMap(mapId);
  } catch (err) {
    app.innerHTML = `<p class="error">Failed to load map: ${(err as Error).message}</p>`;
    return;
  }

  // Encounter table manager — lazy, loaded into right panel on first Configuration open
  let encounterTableManager: EncounterTableManager | null = null;
  let configOpen = false;

  // Initialize canvas
  canvas = new MapCanvas(canvasContainer);
  canvas.setData(
    toEditorNodes(currentMapData.nodes),
    toEditorEdges(currentMapData.edges),
    toEditorBuildings(currentMapData.buildings),
  );

  if (currentMapData.image_filename) {
    canvas.setBackgroundImage(`/images/${currentMapData.image_filename}`);
  }

  // Initialize mode manager
  modeManager = new EditorModeManager(canvas);

  // Node placement
  modeManager.setOnNodePlace(async (x, y) => {
    if (!currentMapId) return;
    try {
      const node = await createNode(currentMapId, Math.round(x), Math.round(y));
      canvas!.addNode({
        id: node.id,
        x: node.x,
        y: node.y,
        is_spawn: node.is_spawn,
      });
    } catch (err) {
      alert(`Failed to create node: ${(err as Error).message}`);
    }
  });

  // Node selection
  modeManager.setOnNodeSelect((nodeId) => {
    canvas!.setSelectedNode(nodeId);
    showNodeProperties(nodeId);
  });

  // Edge creation
  modeManager.setOnEdgeCreate(async (fromId, toId) => {
    if (!currentMapId) return;
    try {
      const edge = await createEdge(currentMapId, fromId, toId);
      canvas!.addEdge({
        id: edge.id,
        from_node_id: edge.from_node_id,
        to_node_id: edge.to_node_id,
      });
    } catch (err) {
      alert(`Failed to create edge: ${(err as Error).message}`);
    }
  });

  // Node deletion
  modeManager.setOnNodeDelete(async (nodeId) => {
    if (!currentMapId || !canvas) return;
    const nodes = canvas.getNodes();
    const edges = canvas.getEdges();
    const buildings = canvas.getBuildings();
    const node = nodes.find((n) => n.id === nodeId);

    if (node?.is_spawn) {
      alert('Cannot delete spawn node. Set another node as spawn first.');
      return;
    }

    const connectedEdges = edges.filter(e => e.from_node_id === nodeId || e.to_node_id === nodeId);
    const nodeBuilding = buildings.find(b => b.node_id === nodeId);

    let msg = 'Delete this node?';
    const warnings: string[] = [];
    if (connectedEdges.length > 0) warnings.push(`${connectedEdges.length} connected edge(s) will be removed`);
    if (nodeBuilding) warnings.push(`Building "${nodeBuilding.name}" will be deleted`);
    if (warnings.length > 0) msg += '\n\nWarning:\n- ' + warnings.join('\n- ');

    if (!confirm(msg)) return;

    try {
      await deleteNode(currentMapId, nodeId);
      canvas.removeNode(nodeId);
    } catch (err) {
      alert(`Failed to delete node: ${(err as Error).message}`);
    }
  });

  // Edge deletion
  modeManager.setOnEdgeDelete(async (edgeId) => {
    if (!currentMapId) return;
    if (!confirm('Delete this edge?')) return;
    try {
      await deleteEdge(currentMapId, edgeId);
      canvas!.removeEdge(edgeId);
    } catch (err) {
      alert(`Failed to delete edge: ${(err as Error).message}`);
    }
  });

  // Building selection (from building mode — mark a node as building or edit existing)
  modeManager.setOnBuildingSelect((nodeId) => {
    if (!currentMapId || !canvas) return;
    const existingBuilding = canvas.getBuildings().find((b) => b.node_id === nodeId);
    if (existingBuilding) {
      // Show properties panel for existing building
      const propertiesPanelEl = document.getElementById('properties-panel');
      if (propertiesPanelEl) {
        if (!propertiesPanel) {
          propertiesPanel = new PropertiesPanel(propertiesPanelEl);
          propertiesPanel.setOnBuildingUpdate((buildingId, data) => {
            canvas!.updateBuilding(buildingId, data);
            pendingModifiedBuildingIds.add(buildingId);
          });
          propertiesPanel.setOnBuildingDelete((buildingId) => {
            pendingDeletedBuildingIds.add(buildingId);
            canvas!.removeBuilding(buildingId);
          });
        }
        propertiesPanel.showBuilding(existingBuilding, currentMapId);
      }
    } else {
      showBuildingCreateForm(nodeId);
    }
  });

  // Initialize toolbar
  toolbar = new Toolbar(toolbarContainer);

  toolbar.setOnModeSelect((mode) => {
    modeManager!.setMode(mode);
  });

  toolbar.setOnUploadImage(async (file) => {
    if (!currentMapId) return;
    try {
      const imageUrl = await uploadImage(currentMapId, file);
      canvas!.setBackgroundImage(imageUrl);
    } catch (err) {
      alert(`Failed to upload image: ${(err as Error).message}`);
    }
  });

  toolbar.setOnSetSpawn(async () => {
    if (!currentMapId || !canvas) return;
    const selectedNodeId = canvas.getSelectedNodeId();
    if (selectedNodeId === null) {
      alert('Select a node first');
      return;
    }
    try {
      await updateNode(currentMapId, selectedNodeId, { is_spawn: true });
      // Update local state: clear old spawn, set new
      const nodes = canvas.getNodes();
      for (const n of nodes) {
        if (n.is_spawn && n.id !== selectedNodeId) {
          n.is_spawn = false;
          canvas.updateNodePosition(n.id, n.x, n.y);
        }
      }
      const targetNode = nodes.find((n) => n.id === selectedNodeId);
      if (targetNode) {
        targetNode.is_spawn = true;
        canvas.updateNodePosition(targetNode.id, targetNode.x, targetNode.y);
      }
    } catch (err) {
      alert(`Failed to set spawn: ${(err as Error).message}`);
    }
  });

  toolbar.setOnConfiguration(() => {
    configOpen = !configOpen;
    toolbar!.setConfigurationActive(configOpen);
    if (configOpen) {
      propertiesContainer.innerHTML = `<div class="properties"><h3>Map Configuration</h3></div>`;
      const body = propertiesContainer.querySelector<HTMLElement>('.properties')!;
      encounterTableManager = new EncounterTableManager();
      void encounterTableManager.initForZone(body, mapId);
    } else {
      propertiesContainer.innerHTML = '';
      encounterTableManager = null;
    }
  });

  toolbar.setOnSave(async () => {
    await saveMap();
  });

  toolbar.setOnBack(() => {
    window.location.hash = '#/';
  });

  // Label drag handler
  canvas.setOnBuildingDrag((buildingId, labelX, labelY) => {
    const buildings = canvas!.getBuildings();
    const b = buildings.find((bld) => bld.id === buildingId);
    if (b) {
      b.label_offset_x = labelX;
      b.label_offset_y = labelY;
      pendingModifiedBuildingIds.add(buildingId);
    }
  });
}

function showNodeProperties(nodeId: number): void {
  const panel = document.getElementById('properties-panel');
  if (!panel || !canvas) return;

  const nodes = canvas.getNodes();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    panel.innerHTML = '';
    return;
  }

  panel.innerHTML = `
    <div class="properties">
      <h3>Node #${node.id}</h3>
      <p>Position: (${Math.round(node.x)}, ${Math.round(node.y)})</p>
      <p>Spawn: <span style="color:${node.is_spawn ? '#4ade80' : '#5a6280'}">${node.is_spawn ? 'Yes' : 'No'}</span></p>
    </div>
  `;
}

function showBuildingCreateForm(nodeId: number): void {
  const panel = document.getElementById('properties-panel');
  if (!panel) return;

  panel.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'properties';
  form.innerHTML = `
    <h3>New Building</h3>
    <p>Node #${nodeId}</p>
    <label for="building-name">Name</label>
    <input id="building-name" type="text" placeholder="e.g. Tavern" required />
    <div class="form-actions">
      <button type="button" class="btn" id="cancel-building">Cancel</button>
      <button type="submit" class="btn btn--primary">Create</button>
    </div>
  `;

  form.querySelector('#cancel-building')!.addEventListener('click', () => {
    panel.innerHTML = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentMapId) return;
    const nameInput = form.querySelector<HTMLInputElement>('#building-name')!;
    const name = nameInput.value.trim();
    if (!name) return;

    try {
      const building = await createBuilding(currentMapId, {
        node_id: nodeId,
        name,
        label_offset_x: 0,
        label_offset_y: -20,
      });
      canvas!.addBuilding({
        id: building.id,
        node_id: building.node_id,
        name: building.name,
        label_offset_x: building.label_offset_x ?? 0,
        label_offset_y: building.label_offset_y ?? -20,
        hotspot_type: building.hotspot_type,
        hotspot_x: building.hotspot_x,
        hotspot_y: building.hotspot_y,
        hotspot_w: building.hotspot_w,
        hotspot_h: building.hotspot_h,
        hotspot_r: building.hotspot_r,
      });
      panel.innerHTML = '';
    } catch (err) {
      alert(`Failed to create building: ${(err as Error).message}`);
    }
  });

  panel.appendChild(form);
}

async function saveMap(): Promise<void> {
  if (!currentMapId || !canvas || !currentMapData) return;

  // Run validation first
  try {
    const result = await validateMap(currentMapId);
    if (!result.valid) {
      const proceed = confirm(
        `Map has validation warnings:\n\n${result.errors.join('\n')}\n\nSave anyway?`,
      );
      if (!proceed) return;
    }
  } catch {
    // Validation endpoint may not exist yet, continue with save
  }

  try {
    // Save modified node positions
    const currentNodes = canvas.getNodes();
    for (const node of currentNodes) {
      const original = currentMapData.nodes.find(n => n.id === node.id);
      if (original && (original.x !== node.x || original.y !== node.y)) {
        await updateNode(currentMapId, node.id, { x: Math.round(node.x), y: Math.round(node.y) });
      }
    }

    // Save modified buildings
    for (const buildingId of pendingModifiedBuildingIds) {
      if (pendingDeletedBuildingIds.has(buildingId)) continue;
      const buildings = canvas.getBuildings();
      const b = buildings.find((bld) => bld.id === buildingId);
      if (b) {
        await updateBuilding(currentMapId, buildingId, {
          label_offset_x: b.label_offset_x,
          label_offset_y: b.label_offset_y,
        });
      }
    }

    // Save deleted buildings
    for (const buildingId of pendingDeletedBuildingIds) {
      await deleteBuilding(currentMapId, buildingId);
    }

    // Update local reference data
    currentMapData = await getMap(currentMapId);

    pendingModifiedBuildingIds.clear();
    pendingDeletedBuildingIds.clear();
    pendingNewBuildings = [];

    alert('Map saved successfully!');
  } catch (err) {
    alert(`Failed to save: ${(err as Error).message}`);
  }
}

// Hash routing
function route(): void {
  const hash = window.location.hash || '#/';
  const editMatch = hash.match(/^#\/edit\/(\d+)$/);

  if (editMatch) {
    const mapId = parseInt(editMatch[1]!, 10);
    showEditor(mapId);
  } else {
    showMapList();
  }
}

window.addEventListener('hashchange', route);
route();
