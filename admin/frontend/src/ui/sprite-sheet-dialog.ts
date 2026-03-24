import {
  getItems,
  listMonsters,
  batchUpdateIcons,
  batchUpdateMonsterIcons,
  type ItemDefinitionResponse,
  type MonsterResponse,
} from '../editor/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EntityMode = 'items' | 'monsters';

interface EntityEntry {
  id: number;
  name: string;
  category?: string; // items only
}

// A region can come from grid mode or free-cut mode
interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  key: string; // unique id: "row:col" for grid, "free:N" for free-cut
}

type CutMode = 'grid' | 'free';

// ─── Item categories (for item picker filter) ────────────────────────────────

const ITEM_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon',
  'helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'tool',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  resource: 'Resource', food: 'Food', heal: 'Heal', weapon: 'Weapon',
  helmet: 'Helmet', chestplate: 'Chestplate', boots: 'Boots', shield: 'Shield',
  greaves: 'Greaves', bracer: 'Bracer', tool: 'Tool',
};

// ─── Dialog ──────────────────────────────────────────────────────────────────

export class SpriteSheetDialog {
  private overlay: HTMLElement | null = null;
  private onDone: (() => void) | null = null;
  private entityMode: EntityMode;

  // Image state
  private image: HTMLImageElement | null = null;
  private sheetCanvas: HTMLCanvasElement | null = null;
  private gridCanvas: HTMLCanvasElement | null = null;

  // Cut mode
  private cutMode: CutMode = 'grid';

  // Grid state
  private cellWidth = 256;
  private cellHeight = 256;

  // Free-cut state
  private freeRegions: Region[] = [];
  private freeCounter = 0;
  private drawingRect = false;
  private drawStart: { x: number; y: number } | null = null;
  private drawCurrent: { x: number; y: number } | null = null;
  private forceSquare = true;

  // Assignment state
  private assignments = new Map<string, number>();   // region key → entity id
  private reverseMap = new Map<number, string>();     // entity id → region key
  private entityNames = new Map<number, string>();    // entity id → name

  // Entity picker state
  private allEntities: EntityEntry[] = [];
  private popover: HTMLElement | null = null;
  private popoverOutsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(entityMode: EntityMode, onDone?: () => void) {
    this.entityMode = entityMode;
    this.onDone = onDone ?? null;
  }

  async open(): Promise<void> {
    this.reset();

    const title = this.entityMode === 'items' ? 'Sprite Sheet Tool — Items' : 'Sprite Sheet Tool — Monsters';

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;
      display:flex;align-items:center;justify-content:center;padding:1rem;
    `;

    this.overlay.innerHTML = `
      <div class="ss-dialog" style="
        background:#1a1e2e;border:1px solid #2d3347;border-radius:0.75rem;
        padding:1.5rem;max-width:90vw;width:960px;max-height:90vh;
        display:flex;flex-direction:column;overflow:hidden;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h3 style="margin:0;color:#c8cddf;font-size:1.1rem;">${title}</h3>
          <button class="btn btn--sm" id="ss-close-btn" style="font-size:1.2rem;line-height:1;">&times;</button>
        </div>

        <!-- Upload area -->
        <div id="ss-upload-area" style="
          border:2px dashed #2d3347;border-radius:0.5rem;padding:2rem;text-align:center;
          color:#5a6280;cursor:pointer;margin-bottom:1rem;
        ">
          <p style="margin:0 0 0.5rem;font-size:0.9rem;">Click or drag &amp; drop a PNG sprite sheet</p>
          <input id="ss-file-input" type="file" accept=".png,image/png" style="display:none;" />
          <button class="btn btn--primary btn--sm" id="ss-browse-btn">Browse Files</button>
        </div>

        <p id="ss-error" style="display:none;color:#f87171;font-size:0.8rem;margin-bottom:0.75rem;"></p>

        <!-- Controls -->
        <div id="ss-controls" style="display:none;margin-bottom:0.75rem;">
          <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <!-- Mode toggle -->
            <div style="display:flex;border:1px solid #2d3347;border-radius:0.375rem;overflow:hidden;">
              <button id="ss-mode-grid" class="btn btn--sm btn--active" style="border-radius:0;border:none;font-size:0.75rem;">Grid</button>
              <button id="ss-mode-free" class="btn btn--sm" style="border-radius:0;border:none;border-left:1px solid #2d3347;font-size:0.75rem;">Free Cut</button>
            </div>

            <!-- Grid controls -->
            <span id="ss-grid-controls" style="display:contents;">
              <span style="font-size:0.75rem;color:#5a6280;">Cell W:</span>
              <input id="ss-cell-w" type="number" min="16" value="256" style="width:70px;" />
              <span style="font-size:0.75rem;color:#5a6280;">Cell H:</span>
              <input id="ss-cell-h" type="number" min="16" value="256" style="width:70px;" />
            </span>

            <!-- Free-cut controls -->
            <label id="ss-free-controls" style="display:none;font-size:0.75rem;color:#9ba8d0;cursor:pointer;user-select:none;">
              <input id="ss-force-square" type="checkbox" checked style="margin-right:4px;vertical-align:middle;" />
              Force square
            </label>

            <span id="ss-grid-info" style="font-size:0.75rem;color:#5a6280;"></span>
            <span id="ss-assign-count" style="font-size:0.75rem;color:#9ba8d0;margin-left:auto;"></span>
          </div>
        </div>

        <!-- Canvas container -->
        <div id="ss-canvas-wrap" style="
          display:none;flex:1;overflow:auto;position:relative;
          border:1px solid #2d3347;border-radius:0.375rem;background:#0d1017;
          min-height:200px;
        "></div>

        <!-- Footer -->
        <div id="ss-footer" style="display:none;margin-top:0.75rem;display:flex;gap:0.5rem;justify-content:flex-end;">
          <button class="btn" id="ss-cancel-btn">Cancel</button>
          <button class="btn btn--primary" id="ss-cut-btn" disabled>Cut 0 icons</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.wireEvents();
  }

  close(): void {
    this.closePopover();
    this.overlay?.remove();
    this.overlay = null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private reset(): void {
    this.image = null;
    this.sheetCanvas = null;
    this.gridCanvas = null;
    this.cellWidth = 256;
    this.cellHeight = 256;
    this.cutMode = 'grid';
    this.freeRegions = [];
    this.freeCounter = 0;
    this.drawingRect = false;
    this.drawStart = null;
    this.drawCurrent = null;
    this.forceSquare = true;
    this.assignments.clear();
    this.reverseMap.clear();
    this.entityNames.clear();
    this.allEntities = [];
    this.popover = null;
  }

  private wireEvents(): void {
    const o = this.overlay!;

    // Close
    o.querySelector<HTMLButtonElement>('#ss-close-btn')!.addEventListener('click', () => this.close());
    o.querySelector<HTMLButtonElement>('#ss-cancel-btn')!.addEventListener('click', () => this.close());
    o.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

    // File upload
    const fileInput = o.querySelector<HTMLInputElement>('#ss-file-input')!;
    o.querySelector<HTMLButtonElement>('#ss-browse-btn')!.addEventListener('click', () => fileInput.click());
    const uploadArea = o.querySelector<HTMLElement>('#ss-upload-area')!;
    uploadArea.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id !== 'ss-browse-btn') fileInput.click();
    });
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#6a7aaf'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#2d3347'; });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#2d3347';
      const file = e.dataTransfer?.files[0];
      if (file) this.loadFile(file);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) this.loadFile(file);
    });

    // Cell size inputs
    const cellWInput = o.querySelector<HTMLInputElement>('#ss-cell-w')!;
    const cellHInput = o.querySelector<HTMLInputElement>('#ss-cell-h')!;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleCellSizeChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.onCellSizeChange(), 300);
    };
    cellWInput.addEventListener('input', handleCellSizeChange);
    cellHInput.addEventListener('input', handleCellSizeChange);

    // Mode toggle
    o.querySelector<HTMLButtonElement>('#ss-mode-grid')!.addEventListener('click', () => this.setMode('grid'));
    o.querySelector<HTMLButtonElement>('#ss-mode-free')!.addEventListener('click', () => this.setMode('free'));

    // Force square checkbox
    o.querySelector<HTMLInputElement>('#ss-force-square')!.addEventListener('change', (e) => {
      this.forceSquare = (e.target as HTMLInputElement).checked;
    });

    // Cut button
    o.querySelector<HTMLButtonElement>('#ss-cut-btn')!.addEventListener('click', () => this.handleCut());
  }

  private setMode(mode: CutMode): void {
    if (mode === this.cutMode) return;

    // Warn about clearing assignments
    if (this.assignments.size > 0) {
      if (!confirm(`Switching mode will clear all ${this.assignments.size} assignment(s). Continue?`)) return;
    }

    this.cutMode = mode;
    this.assignments.clear();
    this.reverseMap.clear();
    this.freeRegions = [];
    this.freeCounter = 0;

    const o = this.overlay!;
    o.querySelector('#ss-mode-grid')!.classList.toggle('btn--active', mode === 'grid');
    o.querySelector('#ss-mode-free')!.classList.toggle('btn--active', mode === 'free');

    const gridControls = o.querySelector<HTMLElement>('#ss-grid-controls')!;
    gridControls.style.display = mode === 'grid' ? 'contents' : 'none';

    const freeControls = o.querySelector<HTMLElement>('#ss-free-controls')!;
    freeControls.style.display = mode === 'free' ? '' : 'none';

    // Rebind canvas events
    if (this.gridCanvas) {
      const newCanvas = this.gridCanvas.cloneNode(true) as HTMLCanvasElement;
      this.gridCanvas.parentNode!.replaceChild(newCanvas, this.gridCanvas);
      this.gridCanvas = newCanvas;

      if (mode === 'grid') {
        this.gridCanvas.style.cursor = 'crosshair';
        this.gridCanvas.addEventListener('click', (e) => this.onGridClick(e));
      } else {
        this.gridCanvas.style.cursor = 'crosshair';
        this.gridCanvas.addEventListener('mousedown', (e) => this.onFreeMouseDown(e));
        this.gridCanvas.addEventListener('mousemove', (e) => this.onFreeMouseMove(e));
        this.gridCanvas.addEventListener('mouseup', (e) => this.onFreeMouseUp(e));
        this.gridCanvas.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.onFreeRightClick(e);
        });
      }
    }

    this.drawOverlay();
    this.updateInfo();
  }

  private showError(msg: string): void {
    const el = this.overlay?.querySelector<HTMLElement>('#ss-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  private clearError(): void {
    const el = this.overlay?.querySelector<HTMLElement>('#ss-error');
    if (el) el.style.display = 'none';
  }

  // ─── File Loading ──────────────────────────────────────────────────────────

  private loadFile(file: File): void {
    this.clearError();
    if (file.type !== 'image/png') {
      this.showError('Only PNG files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { this.image = img; this.onImageLoaded(); };
      img.onerror = () => this.showError('Failed to load image.');
      img.src = reader.result as string;
    };
    reader.onerror = () => this.showError('Failed to read file.');
    reader.readAsDataURL(file);
  }

  // ─── Canvas Setup ──────────────────────────────────────────────────────────

  private onImageLoaded(): void {
    if (!this.overlay || !this.image) return;

    this.overlay.querySelector<HTMLElement>('#ss-upload-area')!.style.display = 'none';
    this.overlay.querySelector<HTMLElement>('#ss-controls')!.style.display = '';
    const canvasWrap = this.overlay.querySelector<HTMLElement>('#ss-canvas-wrap')!;
    canvasWrap.style.display = '';
    this.overlay.querySelector<HTMLElement>('#ss-footer')!.style.display = 'flex';

    canvasWrap.innerHTML = '';
    const w = this.image.width;
    const h = this.image.height;

    this.sheetCanvas = document.createElement('canvas');
    this.sheetCanvas.width = w;
    this.sheetCanvas.height = h;
    this.sheetCanvas.style.cssText = 'display:block;image-rendering:pixelated;';
    this.sheetCanvas.getContext('2d')!.drawImage(this.image, 0, 0);

    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = w;
    this.gridCanvas.height = h;
    this.gridCanvas.style.cssText = 'position:absolute;top:0;left:0;cursor:crosshair;';

    const inner = document.createElement('div');
    inner.style.cssText = 'position:relative;display:inline-block;';
    inner.appendChild(this.sheetCanvas);
    inner.appendChild(this.gridCanvas);
    canvasWrap.appendChild(inner);

    // Bind click for grid mode (default)
    this.gridCanvas.addEventListener('click', (e) => {
      if (this.cutMode === 'grid') this.onGridClick(e);
    });

    this.drawOverlay();
    this.updateInfo();
    this.fetchEntities();
  }

  // ─── Overlay Drawing ───────────────────────────────────────────────────────

  private drawOverlay(): void {
    if (!this.gridCanvas || !this.image) return;
    const ctx = this.gridCanvas.getContext('2d')!;
    const w = this.image.width;
    const h = this.image.height;
    ctx.clearRect(0, 0, w, h);

    if (this.cutMode === 'grid') {
      this.drawGridOverlay(ctx, w, h);
    } else {
      this.drawFreeOverlay(ctx, w, h);
    }
  }

  private drawGridOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const cw = this.cellWidth;
    const ch = this.cellHeight;
    const cols = Math.ceil(w / cw);
    const rows = Math.ceil(h / ch);

    // Assigned cell backgrounds + labels
    for (const [key, entityId] of this.assignments) {
      const [r, c] = key.split(':').map(Number) as [number, number];
      const x = c * cw;
      const y = r * ch;
      const cellW = Math.min(cw, w - x);
      const cellH = Math.min(ch, h - y);

      ctx.fillStyle = 'rgba(42, 100, 180, 0.35)';
      ctx.fillRect(x, y, cellW, cellH);

      this.drawLabel(ctx, entityId, x, y, cellW, cellH);
    }

    // Grid lines
    for (let c = 0; c <= cols; c++) {
      const x = c * cw;
      if (x > w) break;
      ctx.strokeStyle = x + cw > w && c < cols ? 'rgba(255,100,100,0.4)' : 'rgba(200,210,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * ch;
      if (y > h) break;
      ctx.strokeStyle = y + ch > h && r < rows ? 'rgba(255,100,100,0.4)' : 'rgba(200,210,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
  }

  private drawFreeOverlay(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    // Draw defined regions
    for (const region of this.freeRegions) {
      const entityId = this.assignments.get(region.key);
      const isAssigned = entityId != null;

      // Region background
      ctx.fillStyle = isAssigned ? 'rgba(42, 100, 180, 0.35)' : 'rgba(100, 100, 180, 0.15)';
      ctx.fillRect(region.x, region.y, region.w, region.h);

      // Region border
      ctx.strokeStyle = isAssigned ? 'rgba(80, 150, 255, 0.8)' : 'rgba(200, 210, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x + 0.5, region.y + 0.5, region.w - 1, region.h - 1);

      if (isAssigned) {
        this.drawLabel(ctx, entityId!, region.x, region.y, region.w, region.h);
      } else {
        // Show region index
        ctx.font = `bold ${Math.min(14, region.h / 3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(200,210,255,0.5)';
        ctx.fillText(`${region.w}×${region.h}`, region.x + region.w / 2, region.y + region.h / 2, region.w - 8);
      }
    }

    // Draw in-progress rectangle
    if (this.drawingRect && this.drawStart && this.drawCurrent) {
      const r = this.normalizeRect(this.drawStart, this.drawCurrent);
      ctx.strokeStyle = 'rgba(80, 255, 150, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.setLineDash([]);

      // Dimensions label
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(80, 255, 150, 0.9)';
      ctx.fillText(`${r.w}×${r.h}`, r.x + r.w / 2, r.y - 4);
    }
  }

  private drawLabel(ctx: CanvasRenderingContext2D, entityId: number, x: number, y: number, w: number, h: number): void {
    const name = this.entityNames.get(entityId) ?? `#${entityId}`;
    const truncated = name.length > 18 ? name.slice(0, 16) + '…' : name;
    ctx.font = `bold ${Math.min(14, h / 4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillText(truncated, x + w / 2 + 1, y + h / 2 + 1, w - 8);
    ctx.fillStyle = '#e0e8ff';
    ctx.fillText(truncated, x + w / 2, y + h / 2, w - 8);
  }

  // ─── Info / Count ──────────────────────────────────────────────────────────

  private updateInfo(): void {
    if (!this.overlay || !this.image) return;

    const infoEl = this.overlay.querySelector<HTMLElement>('#ss-grid-info');
    if (infoEl) {
      if (this.cutMode === 'grid') {
        const cols = Math.ceil(this.image.width / this.cellWidth);
        const rows = Math.ceil(this.image.height / this.cellHeight);
        infoEl.textContent = `${cols}×${rows} cells (${this.image.width}×${this.image.height} px)`;
      } else {
        infoEl.textContent = `${this.freeRegions.length} region${this.freeRegions.length === 1 ? '' : 's'} (${this.image.width}×${this.image.height} px)`;
      }
    }

    this.updateAssignCount();
  }

  private updateAssignCount(): void {
    if (!this.overlay) return;
    const count = this.assignments.size;
    const label = this.entityMode === 'items' ? 'item' : 'monster';
    const countEl = this.overlay.querySelector<HTMLElement>('#ss-assign-count');
    if (countEl) countEl.textContent = count > 0 ? `${count} ${label}${count === 1 ? '' : 's'} assigned` : '';

    const cutBtn = this.overlay.querySelector<HTMLButtonElement>('#ss-cut-btn');
    if (cutBtn) {
      cutBtn.disabled = count === 0;
      cutBtn.textContent = `Cut ${count} icon${count === 1 ? '' : 's'}`;
    }
  }

  // ─── Entity Picker ─────────────────────────────────────────────────────────

  private async fetchEntities(): Promise<void> {
    try {
      if (this.entityMode === 'items') {
        const items = await getItems();
        this.allEntities = items.map(i => ({ id: i.id, name: i.name, category: i.category }));
      } else {
        const monsters = await listMonsters();
        this.allEntities = monsters.map(m => ({ id: m.id, name: m.name }));
      }
    } catch { /* will retry when picker opens */ }
  }

  private openPopover(regionKey: string, anchorX: number, anchorY: number): void {
    this.closePopover();

    const currentEntityId = this.assignments.get(regionKey);
    const isItem = this.entityMode === 'items';

    this.popover = document.createElement('div');
    this.popover.style.cssText = `
      position:fixed;z-index:1100;background:#1a1e2e;border:1px solid #2d3347;
      border-radius:0.5rem;padding:0.75rem;width:280px;max-height:350px;
      display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);
    `;

    const x = Math.min(anchorX + 10, window.innerWidth - 300);
    const y = Math.min(anchorY - 20, window.innerHeight - 370);
    this.popover.style.left = `${x}px`;
    this.popover.style.top = `${y}px`;

    const regionLabel = regionKey.startsWith('free:') ? `Region ${regionKey.slice(5)}` : `Cell [${regionKey}]`;

    this.popover.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <span style="font-size:0.8rem;color:#9ba8d0;font-weight:600;">${regionLabel}</span>
        ${currentEntityId != null ? `<button class="btn btn--sm btn--danger" id="ss-pop-clear" style="font-size:0.7rem;">Clear</button>` : ''}
        <button class="btn btn--sm" id="ss-pop-close" style="font-size:1rem;line-height:1;padding:0 4px;">&times;</button>
      </div>
      ${isItem ? `
        <select id="ss-pop-cat" style="margin-bottom:0.375rem;font-size:0.8rem;">
          <option value="all">All categories</option>
          ${ITEM_CATEGORIES.map(c => `<option value="${c}">${CATEGORY_LABELS[c] ?? c}</option>`).join('')}
        </select>
      ` : ''}
      <input id="ss-pop-search" type="text" placeholder="Search ${isItem ? 'items' : 'monsters'}..." style="margin-bottom:0.375rem;font-size:0.8rem;" />
      <div id="ss-pop-list" style="flex:1;overflow-y:auto;min-height:80px;"></div>
    `;

    document.body.appendChild(this.popover);

    this.popover.querySelector<HTMLButtonElement>('#ss-pop-close')!.addEventListener('click', () => this.closePopover());

    const clearBtn = this.popover.querySelector<HTMLButtonElement>('#ss-pop-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAssignment(regionKey);
        this.closePopover();
        this.drawOverlay();
        this.updateAssignCount();
      });
    }

    const catSelect = this.popover.querySelector<HTMLSelectElement>('#ss-pop-cat');
    const searchInput = this.popover.querySelector<HTMLInputElement>('#ss-pop-search')!;
    const listDiv = this.popover.querySelector<HTMLElement>('#ss-pop-list')!;

    const renderList = () => {
      const cat = catSelect?.value ?? 'all';
      const search = searchInput.value.trim().toLowerCase();

      let filtered = this.allEntities;
      if (cat !== 'all') filtered = filtered.filter(e => e.category === cat);
      if (search) filtered = filtered.filter(e => e.name.toLowerCase().includes(search));

      if (filtered.length === 0) {
        listDiv.innerHTML = `<p style="font-size:0.75rem;color:#3d4262;margin:0.5rem 0;">No ${isItem ? 'items' : 'monsters'} found.</p>`;
        return;
      }

      listDiv.innerHTML = '';
      for (const entity of filtered) {
        const row = document.createElement('div');
        const isAssigned = this.reverseMap.has(entity.id);
        row.style.cssText = `
          padding:4px 8px;font-size:0.8rem;cursor:pointer;border-radius:4px;
          color:${isAssigned ? '#5a6280' : '#c8cddf'};
          ${isAssigned ? 'font-style:italic;' : ''}
        `;
        row.textContent = entity.name + (isAssigned ? ' (assigned)' : '');
        row.addEventListener('mouseenter', () => { row.style.background = '#252a3e'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });
        row.addEventListener('click', () => {
          this.assignEntity(regionKey, entity.id, entity.name);
          this.closePopover();
          this.drawOverlay();
          this.updateAssignCount();
        });
        listDiv.appendChild(row);
      }
    };

    catSelect?.addEventListener('change', renderList);
    searchInput.addEventListener('input', renderList);
    renderList();
    searchInput.focus();

    requestAnimationFrame(() => {
      this.popoverOutsideClickHandler = (e: MouseEvent) => {
        if (this.popover && !this.popover.contains(e.target as Node)) {
          this.closePopover();
        }
      };
      document.addEventListener('mousedown', this.popoverOutsideClickHandler);
    });
  }

  private closePopover(): void {
    if (this.popoverOutsideClickHandler) {
      document.removeEventListener('mousedown', this.popoverOutsideClickHandler);
      this.popoverOutsideClickHandler = null;
    }
    this.popover?.remove();
    this.popover = null;
  }

  private assignEntity(key: string, entityId: number, entityName: string): void {
    const existingKey = this.reverseMap.get(entityId);
    if (existingKey && existingKey !== key) {
      this.assignments.delete(existingKey);
    }
    const prevEntity = this.assignments.get(key);
    if (prevEntity != null && prevEntity !== entityId) {
      this.reverseMap.delete(prevEntity);
    }
    this.assignments.set(key, entityId);
    this.reverseMap.set(entityId, key);
    this.entityNames.set(entityId, entityName);
  }

  private clearAssignment(key: string): void {
    const entityId = this.assignments.get(key);
    if (entityId != null) this.reverseMap.delete(entityId);
    this.assignments.delete(key);
  }

  // ─── Grid Mode Handlers ────────────────────────────────────────────────────

  private onGridClick(e: MouseEvent): void {
    if (!this.gridCanvas || !this.image || this.cutMode !== 'grid') return;

    const rect = this.gridCanvas.getBoundingClientRect();
    const scaleX = this.image.width / rect.width;
    const scaleY = this.image.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(px / this.cellWidth);
    const row = Math.floor(py / this.cellHeight);

    const maxCols = Math.ceil(this.image.width / this.cellWidth);
    const maxRows = Math.ceil(this.image.height / this.cellHeight);
    if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) return;

    this.openPopover(`${row}:${col}`, e.clientX, e.clientY);
  }

  private onCellSizeChange(): void {
    if (!this.overlay || !this.image || this.cutMode !== 'grid') return;

    const wInput = this.overlay.querySelector<HTMLInputElement>('#ss-cell-w')!;
    const hInput = this.overlay.querySelector<HTMLInputElement>('#ss-cell-h')!;
    const newW = parseInt(wInput.value, 10);
    const newH = parseInt(hInput.value, 10);

    if (isNaN(newW) || isNaN(newH) || newW < 16 || newH < 16) {
      this.showError('Cell size must be at least 16 pixels.');
      return;
    }
    if (newW > this.image.width || newH > this.image.height) {
      this.showError('Cell size cannot exceed image dimensions.');
      return;
    }
    this.clearError();

    if (this.assignments.size > 0) {
      if (!confirm(`Changing cell size will clear all ${this.assignments.size} assignment(s). Continue?`)) {
        wInput.value = String(this.cellWidth);
        hInput.value = String(this.cellHeight);
        return;
      }
    }

    this.cellWidth = newW;
    this.cellHeight = newH;
    this.assignments.clear();
    this.reverseMap.clear();
    this.drawOverlay();
    this.updateInfo();
  }

  // ─── Free-Cut Mode Handlers ────────────────────────────────────────────────

  private canvasToImageCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.gridCanvas!.getBoundingClientRect();
    const scaleX = this.image!.width / rect.width;
    const scaleY = this.image!.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  private onFreeMouseDown(e: MouseEvent): void {
    if (!this.gridCanvas || !this.image || this.cutMode !== 'free') return;
    if (e.button !== 0) return; // left click only

    // Check if clicking on existing region → open popover
    const pt = this.canvasToImageCoords(e);
    const hitRegion = this.findRegionAt(pt.x, pt.y);
    if (hitRegion) {
      this.openPopover(hitRegion.key, e.clientX, e.clientY);
      return;
    }

    // Start drawing new rectangle
    this.drawingRect = true;
    this.drawStart = pt;
    this.drawCurrent = pt;
  }

  private applySquareConstraint(start: { x: number; y: number }, current: { x: number; y: number }): { x: number; y: number } {
    if (!this.forceSquare) return current;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + size * Math.sign(dx || 1),
      y: start.y + size * Math.sign(dy || 1),
    };
  }

  private onFreeMouseMove(e: MouseEvent): void {
    if (!this.drawingRect || !this.gridCanvas || !this.image) return;
    let current = this.canvasToImageCoords(e);
    // Clamp to image bounds
    current.x = Math.max(0, Math.min(this.image.width, current.x));
    current.y = Math.max(0, Math.min(this.image.height, current.y));
    this.drawCurrent = this.applySquareConstraint(this.drawStart!, current);
    // Re-clamp after square constraint
    this.drawCurrent.x = Math.max(0, Math.min(this.image.width, this.drawCurrent.x));
    this.drawCurrent.y = Math.max(0, Math.min(this.image.height, this.drawCurrent.y));
    this.drawOverlay();
  }

  private onFreeMouseUp(e: MouseEvent): void {
    if (!this.drawingRect || !this.drawStart || !this.image) return;
    this.drawingRect = false;

    let end = this.canvasToImageCoords(e);
    end.x = Math.max(0, Math.min(this.image.width, end.x));
    end.y = Math.max(0, Math.min(this.image.height, end.y));
    end = this.applySquareConstraint(this.drawStart, end);
    end.x = Math.max(0, Math.min(this.image.width, end.x));
    end.y = Math.max(0, Math.min(this.image.height, end.y));

    const r = this.normalizeRect(this.drawStart, end);
    this.drawStart = null;
    this.drawCurrent = null;

    // Minimum size 8x8
    if (r.w < 8 || r.h < 8) {
      this.drawOverlay();
      return;
    }

    const key = `free:${++this.freeCounter}`;
    this.freeRegions.push({ x: r.x, y: r.y, w: r.w, h: r.h, key });

    this.drawOverlay();
    this.updateInfo();
  }

  private onFreeRightClick(e: MouseEvent): void {
    if (this.cutMode !== 'free' || !this.gridCanvas || !this.image) return;

    const pt = this.canvasToImageCoords(e);
    const hitRegion = this.findRegionAt(pt.x, pt.y);
    if (!hitRegion) return;

    // Delete the region
    this.clearAssignment(hitRegion.key);
    this.freeRegions = this.freeRegions.filter(r => r.key !== hitRegion.key);
    this.drawOverlay();
    this.updateInfo();
  }

  private findRegionAt(px: number, py: number): Region | null {
    // Search in reverse so topmost (latest) region wins
    for (let i = this.freeRegions.length - 1; i >= 0; i--) {
      const r = this.freeRegions[i]!;
      if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r;
    }
    return null;
  }

  private normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  // ─── Cut & Save ────────────────────────────────────────────────────────────

  private getRegionForKey(key: string): { x: number; y: number; w: number; h: number } | null {
    if (this.cutMode === 'grid') {
      const [row, col] = key.split(':').map(Number) as [number, number];
      const x = col * this.cellWidth;
      const y = row * this.cellHeight;
      return {
        x, y,
        w: Math.min(this.cellWidth, this.image!.width - x),
        h: Math.min(this.cellHeight, this.image!.height - y),
      };
    } else {
      return this.freeRegions.find(r => r.key === key) ?? null;
    }
  }

  private async handleCut(): Promise<void> {
    if (!this.image || this.assignments.size === 0) return;

    const cutBtn = this.overlay?.querySelector<HTMLButtonElement>('#ss-cut-btn');
    if (cutBtn) { cutBtn.disabled = true; cutBtn.textContent = 'Cutting…'; }

    try {
      const icons: Array<{ entity_id: number; icon_base64: string }> = [];

      for (const [key, entityId] of this.assignments) {
        const region = this.getRegionForKey(key);
        if (!region) continue;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = region.w;
        tempCanvas.height = region.h;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(this.image, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);

        const dataUrl = tempCanvas.toDataURL('image/png');
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        icons.push({ entity_id: entityId, icon_base64: base64 });
      }

      let okCount = 0;
      let failCount = 0;
      let failedLines: string[] = [];

      if (this.entityMode === 'items') {
        const result = await batchUpdateIcons(icons.map(i => ({ item_id: i.entity_id, icon_base64: i.icon_base64 })));
        okCount = result.results.filter(r => r.status === 'ok').length;
        failCount = result.results.filter(r => r.status === 'error').length;
        failedLines = result.results.filter(r => r.status === 'error').map(r => `Item #${r.item_id}: ${r.error ?? 'unknown error'}`);
      } else {
        const result = await batchUpdateMonsterIcons(icons.map(i => ({ monster_id: i.entity_id, icon_base64: i.icon_base64 })));
        okCount = result.results.filter(r => r.status === 'ok').length;
        failCount = result.results.filter(r => r.status === 'error').length;
        failedLines = result.results.filter(r => r.status === 'error').map(r => `Monster #${r.monster_id}: ${r.error ?? 'unknown error'}`);
      }

      if (failCount === 0) {
        alert(`Successfully updated ${okCount} icon${okCount === 1 ? '' : 's'}.`);
      } else {
        alert(`Updated ${okCount}, failed ${failCount}:\n${failedLines.join('\n')}`);
      }

      this.close();
      this.onDone?.();
    } catch (err) {
      this.showError(`Cut failed: ${(err as Error).message}`);
      if (cutBtn) {
        cutBtn.disabled = false;
        cutBtn.textContent = `Cut ${this.assignments.size} icons`;
      }
    }
  }
}
