// ---------------------------------------------------------------------------
// Elarion Map Editor — HTML5 Canvas 2D Rendering Engine
// ---------------------------------------------------------------------------

import type { BuildingItemsResponse, BuildingOverlayItem } from './api';

// ---------------------------------------------------------------------------
// Data Types
// ---------------------------------------------------------------------------

export interface EditorNode {
  id: number;
  x: number;
  y: number;
  is_spawn: boolean;
}

export interface EditorEdge {
  id: number;
  from_node_id: number;
  to_node_id: number;
}

export interface EditorBuilding {
  id: number;
  node_id: number;
  name: string;
  label_offset_x: number;
  label_offset_y: number;
  hotspot_type: string | null;
  hotspot_x: number | null;
  hotspot_y: number | null;
  hotspot_w: number | null;
  hotspot_h: number | null;
  hotspot_r: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const ZOOM_FACTOR = 0.001;

const NODE_RADIUS = 8;
const SPAWN_RADIUS = 10;
const NODE_HIT_RADIUS = 12;
const EDGE_HIT_DISTANCE = 8;

const NODE_FILL = '#4488ff';
const SPAWN_FILL = '#44ff44';
const BUILDING_FILL = '#ffaa00';
const EDGE_COLOR = '#888888';
const EDGE_WIDTH = 2;
const SELECTED_EDGE_COLOR = '#ffff00';
const SELECTED_EDGE_WIDTH = 4;
const SELECTED_STROKE = '#ffff00';
const SELECTED_STROKE_WIDTH = 3;

const HOTSPOT_FILL = 'rgba(100, 150, 255, 0.2)';
const HOTSPOT_STROKE = '#6496ff';

const LABEL_FONT = '14px sans-serif';
const LABEL_COLOR = '#ffffff';
const LABEL_SHADOW = '#000000';

const DIAMOND_SIZE = 10;

// Overlay
const OVERLAY_ICON_SIZE = 24;
const OVERLAY_ICON_GAP = 2;
const OVERLAY_ICONS_PER_ROW = 6;
const OVERLAY_BORDER_WIDTH = 2;
const OVERLAY_OFFSET_Y = 16; // offset below building diamond
const OVERLAY_COLORS: Record<string, string> = {
  loot: '#f87171',
  craft: '#60a5fa',
  found: '#4ade80',
  bought: '#a78bfa',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Squared distance between two points. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Minimum distance from point (px, py) to line segment (ax, ay)-(bx, by). */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt(dist2(px, py, ax, ay));
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.sqrt(dist2(px, py, projX, projY));
}

// ---------------------------------------------------------------------------
// MapCanvas
// ---------------------------------------------------------------------------

export class MapCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private backgroundImage: HTMLImageElement | null = null;

  // View transform (pan + zoom)
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;

  // Data
  private nodes: EditorNode[] = [];
  private edges: EditorEdge[] = [];
  private buildings: EditorBuilding[] = [];

  // Selection
  private selectedNodeId: number | null = null;
  private selectedEdgeId: number | null = null;
  private selectedBuildingId: number | null = null;

  // Callbacks
  private onCanvasClick: ((worldX: number, worldY: number) => void) | null =
    null;
  private onNodeClick: ((nodeId: number) => void) | null = null;
  private onEdgeClick: ((edgeId: number) => void) | null = null;
  private onBuildingDrag:
    | ((buildingId: number, labelX: number, labelY: number) => void)
    | null = null;

  // Pan state
  private isPanning = false;
  private lastPanX = 0;
  private lastPanY = 0;

  // Node drag state
  private isDraggingNode = false;
  private dragNodeId: number | null = null;
  private dragNodeX = 0;
  private dragNodeY = 0;

  // Label drag state
  private isDraggingLabel = false;
  private dragLabelBuildingId: number | null = null;
  private dragLabelStartX = 0;
  private dragLabelStartY = 0;
  private dragLabelOrigOffsetX = 0;
  private dragLabelOrigOffsetY = 0;

  // Item overlay
  overlayEnabled = false;
  private overlayData: Map<number, BuildingOverlayItem[]> | null = null;
  private overlayIcons: Map<string, HTMLImageElement> = new Map();
  private tooltipEl: HTMLDivElement | null = null;
  private containerEl: HTMLElement | null = null;

  // Render loop
  private needsRedraw = true;
  private animFrameId = 0;
  private destroyed = false;

  // Bound handlers (for removeEventListener)
  private handleMouseDown: (e: MouseEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseUp: (e: MouseEvent) => void;
  private handleWheel: (e: WheelEvent) => void;
  private handleResize: () => void;
  private handleContextMenu: (e: MouseEvent) => void;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(container: HTMLElement) {
    this.containerEl = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain 2D canvas context');
    }
    this.ctx = ctx;

    this.sizeToContainer(container);

    // Bind event handlers
    this.handleMouseDown = this.onMouseDown.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseUp = this.onMouseUp.bind(this);
    this.handleWheel = this.onWheel.bind(this);
    this.handleResize = () => {
      this.sizeToContainer(container);
      this.needsRedraw = true;
    };
    this.handleContextMenu = (e: MouseEvent) => e.preventDefault();

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    this.canvas.addEventListener('mouseleave', () => {
      if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    });
    window.addEventListener('resize', this.handleResize);

    // Create tooltip element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'overlay-tooltip';
    this.tooltipEl.style.display = 'none';
    container.appendChild(this.tooltipEl);

    // Start render loop
    this.renderLoop();
  }

  // -------------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------------

  private sizeToContainer(container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // -------------------------------------------------------------------------
  // Coordinate Transforms
  // -------------------------------------------------------------------------

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.scale + this.offsetX,
      y: worldY * this.scale + this.offsetY,
    };
  }

  // -------------------------------------------------------------------------
  // Mouse Events
  // -------------------------------------------------------------------------

  private onMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse button — start panning
    if (e.button === 1) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      e.preventDefault();
      return;
    }

    // Left click
    if (e.button === 0) {
      const world = this.screenToWorld(sx, sy);

      // Check if clicking near a building label for drag
      const labelBuildingId = this.hitTestBuildingLabel(world.x, world.y);
      if (labelBuildingId !== null) {
        const building = this.buildings.find((b) => b.id === labelBuildingId);
        if (building) {
          this.isDraggingLabel = true;
          this.dragLabelBuildingId = labelBuildingId;
          this.dragLabelStartX = world.x;
          this.dragLabelStartY = world.y;
          this.dragLabelOrigOffsetX = building.label_offset_x;
          this.dragLabelOrigOffsetY = building.label_offset_y;
          return;
        }
      }

      // Check node hit — may start dragging if it is the selected node
      const nodeId = this.hitTestNode(world.x, world.y);
      if (nodeId !== null) {
        if (nodeId === this.selectedNodeId) {
          // Begin dragging the selected node
          this.isDraggingNode = true;
          this.dragNodeId = nodeId;
          const node = this.nodes.find((n) => n.id === nodeId)!;
          this.dragNodeX = node.x;
          this.dragNodeY = node.y;
        }
        if (this.onNodeClick) {
          this.onNodeClick(nodeId);
        }
        this.needsRedraw = true;
        return;
      }

      // Check edge hit
      const edgeId = this.hitTestEdge(world.x, world.y);
      if (edgeId !== null) {
        if (this.onEdgeClick) {
          this.onEdgeClick(edgeId);
        }
        this.needsRedraw = true;
        return;
      }

      // Nothing hit — canvas click
      if (this.onCanvasClick) {
        this.onCanvasClick(world.x, world.y);
      }
      this.needsRedraw = true;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    // Panning
    if (this.isPanning) {
      const dx = e.clientX - this.lastPanX;
      const dy = e.clientY - this.lastPanY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.needsRedraw = true;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.screenToWorld(sx, sy);

    // Node dragging
    if (this.isDraggingNode && this.dragNodeId !== null) {
      this.dragNodeX = world.x;
      this.dragNodeY = world.y;
      // Update the node position in data so it renders at the new position
      const node = this.nodes.find((n) => n.id === this.dragNodeId);
      if (node) {
        node.x = world.x;
        node.y = world.y;
      }
      this.needsRedraw = true;
      return;
    }

    // Label dragging
    if (this.isDraggingLabel && this.dragLabelBuildingId !== null) {
      const building = this.buildings.find(
        (b) => b.id === this.dragLabelBuildingId,
      );
      if (building) {
        const dx = world.x - this.dragLabelStartX;
        const dy = world.y - this.dragLabelStartY;
        building.label_offset_x = this.dragLabelOrigOffsetX + dx;
        building.label_offset_y = this.dragLabelOrigOffsetY + dy;
        this.needsRedraw = true;
      }
      return;
    }

    // Overlay tooltip
    if (this.tooltipEl && this.overlayEnabled && this.overlayData) {
      const hit = this.getOverlayItemAt(world.x, world.y);
      if (hit) {
        const label = hit.item.obtain_method === 'loot' ? 'Loot from' : 'Crafted by';
        this.tooltipEl.textContent = `${hit.item.item_name} — ${label} ${hit.item.source_name}`;
        this.tooltipEl.style.left = `${sx + 12}px`;
        this.tooltipEl.style.top = `${sy + 12}px`;
        this.tooltipEl.style.display = 'block';
      } else {
        this.tooltipEl.style.display = 'none';
      }
    }
  }

  private onMouseUp(e: MouseEvent): void {
    // End panning
    if (e.button === 1) {
      this.isPanning = false;
      return;
    }

    // End node drag
    if (this.isDraggingNode && this.dragNodeId !== null) {
      this.isDraggingNode = false;
      this.dragNodeId = null;
      this.needsRedraw = true;
      return;
    }

    // End label drag
    if (this.isDraggingLabel && this.dragLabelBuildingId !== null) {
      const building = this.buildings.find(
        (b) => b.id === this.dragLabelBuildingId,
      );
      if (building && this.onBuildingDrag) {
        this.onBuildingDrag(
          this.dragLabelBuildingId,
          building.label_offset_x,
          building.label_offset_y,
        );
      }
      this.isDraggingLabel = false;
      this.dragLabelBuildingId = null;
      this.needsRedraw = true;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const oldScale = this.scale;
    const delta = -e.deltaY * ZOOM_FACTOR;
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * (1 + delta)));

    // Zoom towards cursor position
    const ratio = this.scale / oldScale;
    this.offsetX = sx - (sx - this.offsetX) * ratio;
    this.offsetY = sy - (sy - this.offsetY) * ratio;

    this.needsRedraw = true;
  }

  // -------------------------------------------------------------------------
  // Hit Testing
  // -------------------------------------------------------------------------

  hitTestNode(worldX: number, worldY: number): number | null {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i]!;
      if (dist2(worldX, worldY, n.x, n.y) <= NODE_HIT_RADIUS * NODE_HIT_RADIUS) {
        return n.id;
      }
    }
    return null;
  }

  hitTestEdge(worldX: number, worldY: number): number | null {
    for (let i = this.edges.length - 1; i >= 0; i--) {
      const edge = this.edges[i]!;
      const fromNode = this.nodes.find((n) => n.id === edge.from_node_id);
      const toNode = this.nodes.find((n) => n.id === edge.to_node_id);
      if (!fromNode || !toNode) continue;

      const d = pointToSegmentDistance(
        worldX,
        worldY,
        fromNode.x,
        fromNode.y,
        toNode.x,
        toNode.y,
      );
      if (d <= EDGE_HIT_DISTANCE) {
        return edge.id;
      }
    }
    return null;
  }

  hitTestBuilding(worldX: number, worldY: number): number | null {
    for (const b of this.buildings) {
      if (b.hotspot_type === 'rect' && b.hotspot_x != null && b.hotspot_y != null && b.hotspot_w != null && b.hotspot_h != null) {
        if (
          worldX >= b.hotspot_x &&
          worldX <= b.hotspot_x + b.hotspot_w &&
          worldY >= b.hotspot_y &&
          worldY <= b.hotspot_y + b.hotspot_h
        ) {
          return b.id;
        }
      }
      if (b.hotspot_type === 'circle' && b.hotspot_x != null && b.hotspot_y != null && b.hotspot_r != null) {
        if (dist2(worldX, worldY, b.hotspot_x, b.hotspot_y) <= b.hotspot_r * b.hotspot_r) {
          return b.id;
        }
      }
    }
    return null;
  }

  /** Hit test specifically for building labels (for drag). */
  private hitTestBuildingLabel(worldX: number, worldY: number): number | null {
    this.ctx.save();
    this.ctx.font = LABEL_FONT;
    for (const b of this.buildings) {
      const node = this.nodes.find((n) => n.id === b.node_id);
      if (!node) continue;
      const lx = node.x + b.label_offset_x;
      const ly = node.y + b.label_offset_y;
      const textWidth = this.ctx.measureText(b.name).width;
      const textHeight = 14; // approximate font height
      if (
        worldX >= lx - 2 &&
        worldX <= lx + textWidth + 2 &&
        worldY >= ly - textHeight - 2 &&
        worldY <= ly + 2
      ) {
        this.ctx.restore();
        return b.id;
      }
    }
    this.ctx.restore();
    return null;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private renderLoop(): void {
    if (this.destroyed) return;

    if (this.needsRedraw) {
      this.render();
      this.needsRedraw = false;
    }

    this.animFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  private render(): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    // 1. Clear
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 2. Apply view transform
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 3. Background image
    if (this.backgroundImage && this.backgroundImage.complete) {
      ctx.drawImage(this.backgroundImage, 0, 0);
    }

    // 4. Edges
    this.renderEdges(ctx);

    // 5. Nodes
    this.renderNodes(ctx);

    // 6. Buildings
    this.renderBuildings(ctx);

    // 7. Item overlay (if enabled)
    if (this.overlayEnabled && this.overlayData) {
      this.renderItemOverlay(ctx);
    }

    ctx.restore();
  }

  private renderEdges(ctx: CanvasRenderingContext2D): void {
    for (const edge of this.edges) {
      const fromNode = this.nodes.find((n) => n.id === edge.from_node_id);
      const toNode = this.nodes.find((n) => n.id === edge.to_node_id);
      if (!fromNode || !toNode) continue;

      const isSelected = edge.id === this.selectedEdgeId;

      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.strokeStyle = isSelected ? SELECTED_EDGE_COLOR : EDGE_COLOR;
      ctx.lineWidth = isSelected ? SELECTED_EDGE_WIDTH : EDGE_WIDTH;
      ctx.stroke();
    }
  }

  private renderNodes(ctx: CanvasRenderingContext2D): void {
    // Build a set of node IDs that have buildings
    const buildingNodeIds = new Set(this.buildings.map((b) => b.node_id));

    for (const node of this.nodes) {
      // Skip nodes that are building nodes — they are drawn in renderBuildings
      if (buildingNodeIds.has(node.id)) continue;

      const isSelected = node.id === this.selectedNodeId;
      const isSpawn = node.is_spawn;
      const radius = isSpawn ? SPAWN_RADIUS : NODE_RADIUS;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSpawn ? SPAWN_FILL : NODE_FILL;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = SELECTED_STROKE;
        ctx.lineWidth = SELECTED_STROKE_WIDTH;
        ctx.stroke();
      }
    }
  }

  private renderBuildings(ctx: CanvasRenderingContext2D): void {
    for (const b of this.buildings) {
      const node = this.nodes.find((n) => n.id === b.node_id);
      if (!node) continue;

      const isSelected = b.id === this.selectedBuildingId;

      // Diamond shape for building node
      ctx.beginPath();
      ctx.moveTo(node.x, node.y - DIAMOND_SIZE);
      ctx.lineTo(node.x + DIAMOND_SIZE, node.y);
      ctx.lineTo(node.x, node.y + DIAMOND_SIZE);
      ctx.lineTo(node.x - DIAMOND_SIZE, node.y);
      ctx.closePath();
      ctx.fillStyle = BUILDING_FILL;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = SELECTED_STROKE;
        ctx.lineWidth = SELECTED_STROKE_WIDTH;
        ctx.stroke();
      }

      // Hotspot rectangle
      if (b.hotspot_type === 'rect' && b.hotspot_x != null && b.hotspot_y != null && b.hotspot_w != null && b.hotspot_h != null) {
        ctx.fillStyle = HOTSPOT_FILL;
        ctx.fillRect(b.hotspot_x, b.hotspot_y, b.hotspot_w, b.hotspot_h);
        ctx.strokeStyle = HOTSPOT_STROKE;
        ctx.lineWidth = 1;
        ctx.strokeRect(b.hotspot_x, b.hotspot_y, b.hotspot_w, b.hotspot_h);
      }

      // Hotspot circle
      if (b.hotspot_type === 'circle' && b.hotspot_x != null && b.hotspot_y != null && b.hotspot_r != null) {
        ctx.beginPath();
        ctx.arc(b.hotspot_x, b.hotspot_y, b.hotspot_r, 0, Math.PI * 2);
        ctx.fillStyle = HOTSPOT_FILL;
        ctx.fill();
        ctx.strokeStyle = HOTSPOT_STROKE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Name label
      const lx = node.x + b.label_offset_x;
      const ly = node.y + b.label_offset_y;
      ctx.font = LABEL_FONT;
      ctx.fillStyle = LABEL_SHADOW;
      ctx.fillText(b.name, lx + 1, ly + 1);
      ctx.fillStyle = LABEL_COLOR;
      ctx.fillText(b.name, lx, ly);
    }
  }

  // -------------------------------------------------------------------------
  // Public API — Data
  // -------------------------------------------------------------------------

  setData(
    nodes: EditorNode[],
    edges: EditorEdge[],
    buildings: EditorBuilding[],
  ): void {
    this.nodes = nodes;
    this.edges = edges;
    this.buildings = buildings;
    this.needsRedraw = true;
  }

  setBackgroundImage(url: string): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.backgroundImage = img;
      this.fitToView();
      this.needsRedraw = true;
    };
    img.src = url;
  }

  private fitToView(): void {
    if (!this.backgroundImage) return;
    const padding = 40;
    // Use CSS dimensions (not DPR-scaled canvas dimensions) so coordinates
    // stay consistent with mouse events which report CSS pixels.
    const rect = this.canvas.getBoundingClientRect();
    const canvasW = rect.width - padding * 2;
    const canvasH = rect.height - padding * 2;
    const imgW = this.backgroundImage.naturalWidth;
    const imgH = this.backgroundImage.naturalHeight;
    this.scale = Math.min(canvasW / imgW, canvasH / imgH, 1);
    this.offsetX = (rect.width - imgW * this.scale) / 2;
    this.offsetY = (rect.height - imgH * this.scale) / 2;
  }

  getNodes(): EditorNode[] {
    return this.nodes;
  }

  getEdges(): EditorEdge[] {
    return this.edges;
  }

  getBuildings(): EditorBuilding[] {
    return this.buildings;
  }

  // -------------------------------------------------------------------------
  // Public API — Selection
  // -------------------------------------------------------------------------

  setSelectedNode(id: number | null): void {
    this.selectedNodeId = id;
    this.needsRedraw = true;
  }

  setSelectedEdge(id: number | null): void {
    this.selectedEdgeId = id;
    this.needsRedraw = true;
  }

  setSelectedBuilding(id: number | null): void {
    this.selectedBuildingId = id;
    this.needsRedraw = true;
  }

  // -------------------------------------------------------------------------
  // Public API — Callbacks
  // -------------------------------------------------------------------------

  setOnCanvasClick(
    callback: ((worldX: number, worldY: number) => void) | null,
  ): void {
    this.onCanvasClick = callback;
  }

  setOnNodeClick(callback: ((nodeId: number) => void) | null): void {
    this.onNodeClick = callback;
  }

  setOnEdgeClick(callback: ((edgeId: number) => void) | null): void {
    this.onEdgeClick = callback;
  }

  setOnBuildingDrag(
    callback:
      | ((buildingId: number, labelX: number, labelY: number) => void)
      | null,
  ): void {
    this.onBuildingDrag = callback;
  }

  // -------------------------------------------------------------------------
  // Public API — Node CRUD
  // -------------------------------------------------------------------------

  addNode(node: EditorNode): void {
    this.nodes.push(node);
    this.needsRedraw = true;
  }

  removeNode(id: number): void {
    this.nodes = this.nodes.filter((n) => n.id !== id);
    // Also remove edges referencing this node
    this.edges = this.edges.filter(
      (e) => e.from_node_id !== id && e.to_node_id !== id,
    );
    // Also remove buildings on this node
    this.buildings = this.buildings.filter((b) => b.node_id !== id);
    if (this.selectedNodeId === id) this.selectedNodeId = null;
    this.needsRedraw = true;
  }

  updateNodePosition(id: number, x: number, y: number): void {
    const node = this.nodes.find((n) => n.id === id);
    if (node) {
      node.x = x;
      node.y = y;
      this.needsRedraw = true;
    }
  }

  // -------------------------------------------------------------------------
  // Public API — Edge CRUD
  // -------------------------------------------------------------------------

  addEdge(edge: EditorEdge): void {
    this.edges.push(edge);
    this.needsRedraw = true;
  }

  removeEdge(id: number): void {
    this.edges = this.edges.filter((e) => e.id !== id);
    if (this.selectedEdgeId === id) this.selectedEdgeId = null;
    this.needsRedraw = true;
  }

  // -------------------------------------------------------------------------
  // Public API — Building CRUD
  // -------------------------------------------------------------------------

  addBuilding(building: EditorBuilding): void {
    this.buildings.push(building);
    this.needsRedraw = true;
  }

  removeBuilding(id: number): void {
    this.buildings = this.buildings.filter((b) => b.id !== id);
    if (this.selectedBuildingId === id) this.selectedBuildingId = null;
    this.needsRedraw = true;
  }

  updateBuilding(id: number, partial: Partial<EditorBuilding>): void {
    const building = this.buildings.find((b) => b.id === id);
    if (building) {
      Object.assign(building, partial);
      this.needsRedraw = true;
    }
  }

  // -------------------------------------------------------------------------
  // Public API — Misc
  // -------------------------------------------------------------------------

  clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.selectedBuildingId = null;
    this.needsRedraw = true;
  }

  getSelectedNodeId(): number | null {
    return this.selectedNodeId;
  }

  setCursor(cursor: string): void {
    this.canvas.style.cursor = cursor;
  }

  // -------------------------------------------------------------------------
  // Public API — Item Overlay
  // -------------------------------------------------------------------------

  setOverlayData(data: BuildingItemsResponse): void {
    this.overlayData = new Map();
    const filenames = new Set<string>();

    for (const b of data.buildings) {
      if (b.items.length > 0) {
        this.overlayData.set(b.building_id, b.items);
        for (const item of b.items) {
          if (item.icon_filename) {
            filenames.add(item.icon_filename);
          }
        }
      }
    }

    // Preload icon images
    for (const filename of filenames) {
      if (!this.overlayIcons.has(filename)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.needsRedraw = true;
        };
        img.src = `/item-icons/${filename}`;
        this.overlayIcons.set(filename, img);
      }
    }

    this.needsRedraw = true;
  }

  clearOverlay(): void {
    this.overlayData = null;
    this.overlayEnabled = false;
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
    this.needsRedraw = true;
  }

  // -------------------------------------------------------------------------
  // Item Overlay — Rendering
  // -------------------------------------------------------------------------

  private renderItemOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.overlayData) return;

    for (const [buildingId, items] of this.overlayData) {
      const building = this.buildings.find((b) => b.id === buildingId);
      if (!building) continue;
      const node = this.nodes.find((n) => n.id === building.node_id);
      if (!node) continue;

      const cellSize = OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH * 2 + OVERLAY_ICON_GAP;
      const cols = Math.min(items.length, OVERLAY_ICONS_PER_ROW);
      const gridWidth = cols * cellSize - OVERLAY_ICON_GAP;
      const startX = node.x - gridWidth / 2;
      const startY = node.y + OVERLAY_OFFSET_Y;

      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        const col = i % OVERLAY_ICONS_PER_ROW;
        const row = Math.floor(i / OVERLAY_ICONS_PER_ROW);
        const x = startX + col * cellSize;
        const y = startY + row * cellSize;

        const borderColor = OVERLAY_COLORS[item.obtain_method] || '#888';

        // Background
        ctx.fillStyle = '#111520';
        ctx.fillRect(x, y, OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH * 2, OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH * 2);

        // Border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = OVERLAY_BORDER_WIDTH;
        ctx.strokeRect(
          x + OVERLAY_BORDER_WIDTH / 2,
          y + OVERLAY_BORDER_WIDTH / 2,
          OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH,
          OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH,
        );

        // Icon image
        if (item.icon_filename) {
          const img = this.overlayIcons.get(item.icon_filename);
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, x + OVERLAY_BORDER_WIDTH, y + OVERLAY_BORDER_WIDTH, OVERLAY_ICON_SIZE, OVERLAY_ICON_SIZE);
          }
        }
      }
    }
  }

  /** Get overlay item at world coordinates (for tooltip hit-testing). */
  getOverlayItemAt(worldX: number, worldY: number): { item: BuildingOverlayItem; screenX: number; screenY: number } | null {
    if (!this.overlayEnabled || !this.overlayData) return null;

    for (const [buildingId, items] of this.overlayData) {
      const building = this.buildings.find((b) => b.id === buildingId);
      if (!building) continue;
      const node = this.nodes.find((n) => n.id === building.node_id);
      if (!node) continue;

      const cellSize = OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH * 2 + OVERLAY_ICON_GAP;
      const cols = Math.min(items.length, OVERLAY_ICONS_PER_ROW);
      const gridWidth = cols * cellSize - OVERLAY_ICON_GAP;
      const startX = node.x - gridWidth / 2;
      const startY = node.y + OVERLAY_OFFSET_Y;

      for (let i = 0; i < items.length; i++) {
        const col = i % OVERLAY_ICONS_PER_ROW;
        const row = Math.floor(i / OVERLAY_ICONS_PER_ROW);
        const x = startX + col * cellSize;
        const y = startY + row * cellSize;
        const totalSize = OVERLAY_ICON_SIZE + OVERLAY_BORDER_WIDTH * 2;

        if (worldX >= x && worldX <= x + totalSize && worldY >= y && worldY <= y + totalSize) {
          const screen = this.worldToScreen(x, y);
          return { item: items[i]!, screenX: screen.x, screenY: screen.y };
        }
      }
    }
    return null;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animFrameId);

    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('resize', this.handleResize);

    if (this.tooltipEl && this.tooltipEl.parentElement) {
      this.tooltipEl.parentElement.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;

    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
