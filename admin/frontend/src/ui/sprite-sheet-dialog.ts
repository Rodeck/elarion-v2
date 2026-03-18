import {
  getItems,
  batchUpdateIcons,
  type ItemDefinitionResponse,
} from '../editor/api';

const VALID_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon',
  'helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'tool',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  resource: 'Resource', food: 'Food', heal: 'Heal', weapon: 'Weapon',
  helmet: 'Helmet', chestplate: 'Chestplate', boots: 'Boots', shield: 'Shield',
  greaves: 'Greaves', bracer: 'Bracer', tool: 'Tool',
};

export class SpriteSheetDialog {
  private overlay: HTMLElement | null = null;
  private onDone: (() => void) | null = null;

  // Image state
  private image: HTMLImageElement | null = null;
  private sheetCanvas: HTMLCanvasElement | null = null;
  private gridCanvas: HTMLCanvasElement | null = null;

  // Grid state
  private cellWidth = 256;
  private cellHeight = 256;

  // Assignment state
  private assignments = new Map<string, number>();      // "row:col" → item_id
  private reverseMap = new Map<number, string>();        // item_id → "row:col"
  private itemNames = new Map<number, string>();         // item_id → name (for labels)

  // Item picker state
  private allItems: ItemDefinitionResponse[] = [];
  private popover: HTMLElement | null = null;

  constructor(onDone?: () => void) {
    this.onDone = onDone ?? null;
  }

  async open(): Promise<void> {
    this.reset();

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;
      display:flex;align-items:center;justify-content:center;padding:1rem;
    `;

    this.overlay.innerHTML = `
      <div class="ss-dialog" style="
        background:#1a1e2e;border:1px solid #2d3347;border-radius:0.75rem;
        padding:1.5rem;max-width:90vw;width:900px;max-height:90vh;
        display:flex;flex-direction:column;overflow:hidden;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h3 style="margin:0;color:#c8cddf;font-size:1.1rem;">Sprite Sheet Tool</h3>
          <button class="btn btn--sm" id="ss-close-btn" style="font-size:1.2rem;line-height:1;">&times;</button>
        </div>

        <!-- Upload area (shown before image loaded) -->
        <div id="ss-upload-area" style="
          border:2px dashed #2d3347;border-radius:0.5rem;padding:2rem;text-align:center;
          color:#5a6280;cursor:pointer;margin-bottom:1rem;
        ">
          <p style="margin:0 0 0.5rem;font-size:0.9rem;">Click or drag &amp; drop a PNG sprite sheet</p>
          <input id="ss-file-input" type="file" accept=".png,image/png" style="display:none;" />
          <button class="btn btn--primary btn--sm" id="ss-browse-btn">Browse Files</button>
        </div>

        <p id="ss-error" style="display:none;color:#f87171;font-size:0.8rem;margin-bottom:0.75rem;"></p>

        <!-- Controls (shown after image loaded) -->
        <div id="ss-controls" style="display:none;margin-bottom:0.75rem;">
          <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
            <span style="font-size:0.75rem;color:#5a6280;">Cell W:</span>
            <input id="ss-cell-w" type="number" min="16" value="256" style="width:70px;" />
            <span style="font-size:0.75rem;color:#5a6280;">Cell H:</span>
            <input id="ss-cell-h" type="number" min="16" value="256" style="width:70px;" />
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
    this.assignments.clear();
    this.reverseMap.clear();
    this.itemNames.clear();
    this.allItems = [];
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

    // Cut button
    o.querySelector<HTMLButtonElement>('#ss-cut-btn')!.addEventListener('click', () => this.handleCut());
  }

  private showError(msg: string): void {
    const el = this.overlay?.querySelector<HTMLElement>('#ss-error');
    if (el) {
      el.textContent = msg;
      el.style.display = '';
    }
  }

  private clearError(): void {
    const el = this.overlay?.querySelector<HTMLElement>('#ss-error');
    if (el) el.style.display = 'none';
  }

  // ─── File Loading (T005) ─────────────────────────────────────────────────────

  private loadFile(file: File): void {
    this.clearError();

    if (file.type !== 'image/png') {
      this.showError('Only PNG files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.onImageLoaded();
      };
      img.onerror = () => this.showError('Failed to load image. Make sure it is a valid PNG.');
      img.src = reader.result as string;
    };
    reader.onerror = () => this.showError('Failed to read file.');
    reader.readAsDataURL(file);
  }

  // ─── Canvas Rendering (T006, T007) ──────────────────────────────────────────

  private onImageLoaded(): void {
    if (!this.overlay || !this.image) return;

    // Hide upload area, show controls + canvas + footer
    this.overlay.querySelector<HTMLElement>('#ss-upload-area')!.style.display = 'none';
    this.overlay.querySelector<HTMLElement>('#ss-controls')!.style.display = '';
    const canvasWrap = this.overlay.querySelector<HTMLElement>('#ss-canvas-wrap')!;
    canvasWrap.style.display = '';
    this.overlay.querySelector<HTMLElement>('#ss-footer')!.style.display = 'flex';

    // Create canvases
    canvasWrap.innerHTML = '';

    const w = this.image.width;
    const h = this.image.height;

    // Sheet canvas (bottom layer)
    this.sheetCanvas = document.createElement('canvas');
    this.sheetCanvas.width = w;
    this.sheetCanvas.height = h;
    this.sheetCanvas.style.cssText = `display:block;image-rendering:pixelated;`;
    const sCtx = this.sheetCanvas.getContext('2d')!;
    sCtx.drawImage(this.image, 0, 0);

    // Grid overlay canvas (top layer)
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = w;
    this.gridCanvas.height = h;
    this.gridCanvas.style.cssText = `position:absolute;top:0;left:0;cursor:crosshair;`;

    // Wrapper for positioning
    const inner = document.createElement('div');
    inner.style.cssText = `position:relative;display:inline-block;`;
    inner.appendChild(this.sheetCanvas);
    inner.appendChild(this.gridCanvas);
    canvasWrap.appendChild(inner);

    // Grid click handler
    this.gridCanvas.addEventListener('click', (e) => this.onGridClick(e));

    // Draw grid
    this.drawGrid();
    this.updateInfo();

    // Prefetch items for picker
    this.fetchItems();
  }

  private drawGrid(): void {
    if (!this.gridCanvas || !this.image) return;

    const ctx = this.gridCanvas.getContext('2d')!;
    const w = this.image.width;
    const h = this.image.height;
    ctx.clearRect(0, 0, w, h);

    const cw = this.cellWidth;
    const ch = this.cellHeight;
    const cols = Math.ceil(w / cw);
    const rows = Math.ceil(h / ch);

    // Draw assigned cell backgrounds
    for (const [key, itemId] of this.assignments) {
      const [r, c] = key.split(':').map(Number) as [number, number];
      const x = c * cw;
      const y = r * ch;
      const cellW = Math.min(cw, w - x);
      const cellH = Math.min(ch, h - y);

      ctx.fillStyle = 'rgba(42, 100, 180, 0.35)';
      ctx.fillRect(x, y, cellW, cellH);

      // Item name label
      const name = this.itemNames.get(itemId) ?? `#${itemId}`;
      const truncated = name.length > 18 ? name.slice(0, 16) + '…' : name;
      ctx.font = `bold ${Math.min(14, ch / 4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text shadow
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(truncated, x + cellW / 2 + 1, y + cellH / 2 + 1, cellW - 8);
      ctx.fillStyle = '#e0e8ff';
      ctx.fillText(truncated, x + cellW / 2, y + cellH / 2, cellW - 8);
    }

    // Draw grid lines
    for (let c = 0; c <= cols; c++) {
      const x = c * cw;
      const isPartial = x > w;
      if (isPartial) break;
      ctx.strokeStyle = x + cw > w && c < cols ? 'rgba(255,100,100,0.4)' : 'rgba(200,210,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * ch;
      if (y > h) break;
      ctx.strokeStyle = y + ch > h && r < rows ? 'rgba(255,100,100,0.4)' : 'rgba(200,210,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
  }

  private updateInfo(): void {
    if (!this.overlay || !this.image) return;

    const cols = Math.ceil(this.image.width / this.cellWidth);
    const rows = Math.ceil(this.image.height / this.cellHeight);
    const infoEl = this.overlay.querySelector<HTMLElement>('#ss-grid-info');
    if (infoEl) infoEl.textContent = `${cols}×${rows} cells (${this.image.width}×${this.image.height} px)`;

    this.updateAssignCount();
  }

  private updateAssignCount(): void {
    if (!this.overlay) return;
    const count = this.assignments.size;
    const countEl = this.overlay.querySelector<HTMLElement>('#ss-assign-count');
    if (countEl) countEl.textContent = count > 0 ? `${count} item${count === 1 ? '' : 's'} assigned` : '';

    const cutBtn = this.overlay.querySelector<HTMLButtonElement>('#ss-cut-btn');
    if (cutBtn) {
      cutBtn.disabled = count === 0;
      cutBtn.textContent = `Cut ${count} icon${count === 1 ? '' : 's'}`;
    }
  }

  // ─── Item Picker (T008–T012) ────────────────────────────────────────────────

  private async fetchItems(): Promise<void> {
    try {
      this.allItems = await getItems();
    } catch {
      // Silently fail — will try again when picker opens
    }
  }

  private onGridClick(e: MouseEvent): void {
    if (!this.gridCanvas || !this.image) return;

    const rect = this.gridCanvas.getBoundingClientRect();
    const scaleX = this.image.width / rect.width;
    const scaleY = this.image.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(px / this.cellWidth);
    const row = Math.floor(py / this.cellHeight);

    // Bounds check
    const maxCols = Math.ceil(this.image.width / this.cellWidth);
    const maxRows = Math.ceil(this.image.height / this.cellHeight);
    if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) return;

    this.openPopover(row, col, e.clientX, e.clientY);
  }

  private openPopover(row: number, col: number, anchorX: number, anchorY: number): void {
    this.closePopover();

    const key = `${row}:${col}`;
    const currentItemId = this.assignments.get(key);

    this.popover = document.createElement('div');
    this.popover.style.cssText = `
      position:fixed;z-index:1100;background:#1a1e2e;border:1px solid #2d3347;
      border-radius:0.5rem;padding:0.75rem;width:280px;max-height:350px;
      display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);
    `;

    // Position near click
    const x = Math.min(anchorX + 10, window.innerWidth - 300);
    const y = Math.min(anchorY - 20, window.innerHeight - 370);
    this.popover.style.left = `${x}px`;
    this.popover.style.top = `${y}px`;

    this.popover.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <span style="font-size:0.8rem;color:#9ba8d0;font-weight:600;">Cell [${row}, ${col}]</span>
        ${currentItemId != null ? `<button class="btn btn--sm btn--danger" id="ss-pop-clear" style="font-size:0.7rem;">Clear</button>` : ''}
        <button class="btn btn--sm" id="ss-pop-close" style="font-size:1rem;line-height:1;padding:0 4px;">&times;</button>
      </div>
      <select id="ss-pop-cat" style="margin-bottom:0.375rem;font-size:0.8rem;">
        <option value="all">All categories</option>
        ${VALID_CATEGORIES.map(c => `<option value="${c}">${CATEGORY_LABELS[c] ?? c}</option>`).join('')}
      </select>
      <input id="ss-pop-search" type="text" placeholder="Search items..." style="margin-bottom:0.375rem;font-size:0.8rem;" />
      <div id="ss-pop-list" style="flex:1;overflow-y:auto;min-height:80px;"></div>
    `;

    document.body.appendChild(this.popover);

    // Wire popover events
    this.popover.querySelector<HTMLButtonElement>('#ss-pop-close')!.addEventListener('click', () => this.closePopover());

    const clearBtn = this.popover.querySelector<HTMLButtonElement>('#ss-pop-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAssignment(key);
        this.closePopover();
        this.drawGrid();
        this.updateAssignCount();
      });
    }

    const catSelect = this.popover.querySelector<HTMLSelectElement>('#ss-pop-cat')!;
    const searchInput = this.popover.querySelector<HTMLInputElement>('#ss-pop-search')!;
    const listDiv = this.popover.querySelector<HTMLElement>('#ss-pop-list')!;

    const renderList = () => {
      const cat = catSelect.value;
      const search = searchInput.value.trim().toLowerCase();

      let filtered = this.allItems;
      if (cat !== 'all') filtered = filtered.filter(i => i.category === cat);
      if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search));

      if (filtered.length === 0) {
        listDiv.innerHTML = `<p style="font-size:0.75rem;color:#3d4262;margin:0.5rem 0;">No items found.</p>`;
        return;
      }

      listDiv.innerHTML = '';
      for (const item of filtered) {
        const row = document.createElement('div');
        const isAssigned = this.reverseMap.has(item.id);
        row.style.cssText = `
          padding:4px 8px;font-size:0.8rem;cursor:pointer;border-radius:4px;
          color:${isAssigned ? '#5a6280' : '#c8cddf'};
          ${isAssigned ? 'font-style:italic;' : ''}
        `;
        row.textContent = item.name + (isAssigned ? ' (assigned)' : '');
        row.addEventListener('mouseenter', () => { row.style.background = '#252a3e'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });
        row.addEventListener('click', () => {
          this.assignItem(key, item.id, item.name);
          this.closePopover();
          this.drawGrid();
          this.updateAssignCount();
        });
        listDiv.appendChild(row);
      }
    };

    catSelect.addEventListener('change', renderList);
    searchInput.addEventListener('input', renderList);

    renderList();
    searchInput.focus();

    // Close popover on outside click (after a tick to avoid the triggering click)
    requestAnimationFrame(() => {
      const closeOnOutside = (e: MouseEvent) => {
        if (this.popover && !this.popover.contains(e.target as Node)) {
          this.closePopover();
          document.removeEventListener('mousedown', closeOnOutside);
        }
      };
      document.addEventListener('mousedown', closeOnOutside);
    });
  }

  private closePopover(): void {
    this.popover?.remove();
    this.popover = null;
  }

  private assignItem(cellKey: string, itemId: number, itemName: string): void {
    // If item already assigned elsewhere, clear that cell
    const existingKey = this.reverseMap.get(itemId);
    if (existingKey && existingKey !== cellKey) {
      this.assignments.delete(existingKey);
    }

    // If this cell had a different item, clean up reverse map
    const prevItem = this.assignments.get(cellKey);
    if (prevItem != null && prevItem !== itemId) {
      this.reverseMap.delete(prevItem);
    }

    this.assignments.set(cellKey, itemId);
    this.reverseMap.set(itemId, cellKey);
    this.itemNames.set(itemId, itemName);
  }

  private clearAssignment(cellKey: string): void {
    const itemId = this.assignments.get(cellKey);
    if (itemId != null) {
      this.reverseMap.delete(itemId);
    }
    this.assignments.delete(cellKey);
  }

  // ─── Cell Size Change (T017, T018) ──────────────────────────────────────────

  private onCellSizeChange(): void {
    if (!this.overlay || !this.image) return;

    const wInput = this.overlay.querySelector<HTMLInputElement>('#ss-cell-w')!;
    const hInput = this.overlay.querySelector<HTMLInputElement>('#ss-cell-h')!;
    const newW = parseInt(wInput.value, 10);
    const newH = parseInt(hInput.value, 10);

    // Validate
    if (isNaN(newW) || isNaN(newH) || newW < 16 || newH < 16) {
      this.showError('Cell size must be at least 16 pixels.');
      return;
    }
    if (newW > this.image.width || newH > this.image.height) {
      this.showError('Cell size cannot exceed image dimensions.');
      return;
    }
    this.clearError();

    // Warn about clearing assignments
    if (this.assignments.size > 0) {
      if (!confirm(`Changing cell size will clear all ${this.assignments.size} item assignment(s). Continue?`)) {
        // Revert inputs
        wInput.value = String(this.cellWidth);
        hInput.value = String(this.cellHeight);
        return;
      }
    }

    this.cellWidth = newW;
    this.cellHeight = newH;
    this.assignments.clear();
    this.reverseMap.clear();
    this.drawGrid();
    this.updateInfo();
  }

  // ─── Cut & Save (T013–T016) ─────────────────────────────────────────────────

  private async handleCut(): Promise<void> {
    if (!this.image || this.assignments.size === 0) return;

    const cutBtn = this.overlay?.querySelector<HTMLButtonElement>('#ss-cut-btn');
    if (cutBtn) {
      cutBtn.disabled = true;
      cutBtn.textContent = 'Cutting…';
    }

    try {
      // Extract each assigned cell
      const icons: Array<{ item_id: number; icon_base64: string }> = [];

      for (const [key, itemId] of this.assignments) {
        const [row, col] = key.split(':').map(Number) as [number, number];
        const x = col * this.cellWidth;
        const y = row * this.cellHeight;
        const cellW = Math.min(this.cellWidth, this.image.width - x);
        const cellH = Math.min(this.cellHeight, this.image.height - y);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cellW;
        tempCanvas.height = cellH;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(this.image, x, y, cellW, cellH, 0, 0, cellW, cellH);

        const dataUrl = tempCanvas.toDataURL('image/png');
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        icons.push({ item_id: itemId, icon_base64: base64 });
      }

      // Send to server
      const result = await batchUpdateIcons(icons);

      // Show result
      const okCount = result.results.filter((r: { status: string }) => r.status === 'ok').length;
      const failCount = result.results.filter((r: { status: string }) => r.status === 'error').length;

      if (failCount === 0) {
        alert(`Successfully updated ${okCount} item icon${okCount === 1 ? '' : 's'}.`);
      } else {
        const failedNames = result.results
          .filter((r: { status: string }) => r.status === 'error')
          .map((r: { item_id: number; error?: string }) => `Item #${r.item_id}: ${r.error ?? 'unknown error'}`)
          .join('\n');
        alert(`Updated ${okCount}, failed ${failCount}:\n${failedNames}`);
      }

      // Close and refresh
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

  // ─── Helpers ────────────────────────────────────────────────────────────────
}
