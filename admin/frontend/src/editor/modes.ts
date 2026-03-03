// ---------------------------------------------------------------------------
// Elarion Map Editor — Editor Mode State Machine
// ---------------------------------------------------------------------------

import type { MapCanvas } from './canvas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorMode = 'select' | 'node' | 'edge' | 'delete' | 'building';

const CURSOR_MAP: Record<EditorMode, string> = {
  select: 'default',
  node: 'crosshair',
  edge: 'pointer',
  delete: 'not-allowed',
  building: 'pointer',
};

// ---------------------------------------------------------------------------
// EditorModeManager
// ---------------------------------------------------------------------------

export class EditorModeManager {
  private currentMode: EditorMode = 'select';
  private canvas: MapCanvas;

  // Edge creation state
  private edgeStartNodeId: number | null = null;

  // Callbacks for mode actions
  private onNodePlace: ((x: number, y: number) => void) | null = null;
  private onNodeSelect: ((nodeId: number) => void) | null = null;
  private onEdgeCreate: ((fromId: number, toId: number) => void) | null = null;
  private onNodeDelete: ((nodeId: number) => void) | null = null;
  private onEdgeDelete: ((edgeId: number) => void) | null = null;
  private onBuildingSelect: ((nodeId: number) => void) | null = null;
  private onModeChange: ((mode: EditorMode) => void) | null = null;

  constructor(canvas: MapCanvas) {
    this.canvas = canvas;

    // Wire up canvas click handlers via setter methods
    this.canvas.setOnCanvasClick((worldX: number, worldY: number) => {
      this.handleCanvasClick(worldX, worldY);
    });

    this.canvas.setOnNodeClick((nodeId: number) => {
      this.handleNodeClick(nodeId);
    });

    this.canvas.setOnEdgeClick((edgeId: number) => {
      this.handleEdgeClick(edgeId);
    });

    // Set initial mode
    this.canvas.setCursor(CURSOR_MAP['select']);
  }

  // -------------------------------------------------------------------------
  // Mode management
  // -------------------------------------------------------------------------

  setMode(mode: EditorMode): void {
    this.currentMode = mode;

    // Reset edge creation state on any mode change
    this.edgeStartNodeId = null;

    // Update cursor
    this.canvas.setCursor(CURSOR_MAP[mode]);

    // Clear any existing selection
    this.canvas.clearSelection();

    // Notify listener
    this.onModeChange?.(mode);
  }

  getMode(): EditorMode {
    return this.currentMode;
  }

  // -------------------------------------------------------------------------
  // Click handlers
  // -------------------------------------------------------------------------

  private handleCanvasClick(worldX: number, worldY: number): void {
    switch (this.currentMode) {
      case 'select':
        // Deselect everything
        this.canvas.clearSelection();
        break;

      case 'node':
        // Place a new node at click position
        this.onNodePlace?.(worldX, worldY);
        break;

      case 'edge':
      case 'delete':
      case 'building':
        // These modes require clicking on specific elements, not empty space
        break;
    }
  }

  private handleNodeClick(nodeId: number): void {
    switch (this.currentMode) {
      case 'select':
        this.canvas.setSelectedNode(nodeId);
        this.onNodeSelect?.(nodeId);
        break;

      case 'node':
        // Don't create a new node on top of existing — just select it
        this.canvas.setSelectedNode(nodeId);
        this.onNodeSelect?.(nodeId);
        break;

      case 'edge':
        this.handleEdgeModeNodeClick(nodeId);
        break;

      case 'delete':
        this.onNodeDelete?.(nodeId);
        break;

      case 'building':
        this.onBuildingSelect?.(nodeId);
        break;
    }
  }

  private handleEdgeModeNodeClick(nodeId: number): void {
    if (this.edgeStartNodeId === null) {
      // First click — set start node and highlight it
      this.edgeStartNodeId = nodeId;
      this.canvas.setSelectedNode(nodeId);
    } else if (this.edgeStartNodeId !== nodeId) {
      // Second click on a different node — create the edge
      this.onEdgeCreate?.(this.edgeStartNodeId, nodeId);

      // Reset edge state and clear highlight
      this.edgeStartNodeId = null;
      this.canvas.clearSelection();
    }
    // Clicking the same node again does nothing
  }

  private handleEdgeClick(edgeId: number): void {
    switch (this.currentMode) {
      case 'select':
        this.canvas.setSelectedEdge(edgeId);
        break;

      case 'delete':
        this.onEdgeDelete?.(edgeId);
        break;

      default:
        // Other modes ignore edge clicks
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Callback setters
  // -------------------------------------------------------------------------

  setOnNodePlace(cb: ((x: number, y: number) => void) | null): void {
    this.onNodePlace = cb;
  }

  setOnNodeSelect(cb: ((nodeId: number) => void) | null): void {
    this.onNodeSelect = cb;
  }

  setOnEdgeCreate(cb: ((fromId: number, toId: number) => void) | null): void {
    this.onEdgeCreate = cb;
  }

  setOnNodeDelete(cb: ((nodeId: number) => void) | null): void {
    this.onNodeDelete = cb;
  }

  setOnEdgeDelete(cb: ((edgeId: number) => void) | null): void {
    this.onEdgeDelete = cb;
  }

  setOnBuildingSelect(cb: ((nodeId: number) => void) | null): void {
    this.onBuildingSelect = cb;
  }

  setOnModeChange(cb: ((mode: EditorMode) => void) | null): void {
    this.onModeChange = cb;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    this.onNodePlace = null;
    this.onNodeSelect = null;
    this.onEdgeCreate = null;
    this.onNodeDelete = null;
    this.onEdgeDelete = null;
    this.onBuildingSelect = null;
    this.onModeChange = null;

    this.canvas.setOnCanvasClick(null);
    this.canvas.setOnNodeClick(null);
    this.canvas.setOnEdgeClick(null);

    this.edgeStartNodeId = null;
  }
}
