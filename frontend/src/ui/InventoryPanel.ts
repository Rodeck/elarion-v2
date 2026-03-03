import type { InventorySlotDto } from '../../../shared/protocol/index';

export class InventoryPanel {
  private container: HTMLElement;
  private onDeleteItem: (slotId: number) => void;
  private slots: InventorySlotDto[] = [];
  private capacity: number = 20;
  private currentCategory: string = 'all';
  private activeSlotId: number | null = null;

  private gridEl!: HTMLElement;
  private filterBarEl!: HTMLElement;
  private detailEl!: HTMLElement;

  private readonly CATEGORIES = [
    { value: 'all',      label: 'All'  },
    { value: 'resource', label: 'Res'  },
    { value: 'food',     label: 'Food' },
    { value: 'heal',     label: 'Heal' },
    { value: 'weapon',   label: 'Wpn'  },
    { value: 'boots',    label: 'Boot' },
    { value: 'shield',   label: 'Shld' },
    { value: 'greaves',  label: 'Grv'  },
    { value: 'bracer',   label: 'Brc'  },
    { value: 'tool',     label: 'Tool' },
  ];

  constructor(container: HTMLElement, onDeleteItem: (slotId: number) => void) {
    this.container = container;
    this.onDeleteItem = onDeleteItem;
    this.build();
  }

  private build(): void {
    this.container.innerHTML = '';

    // Filter bar
    this.filterBarEl = document.createElement('div');
    this.filterBarEl.style.cssText =
      'display:flex;flex-wrap:wrap;gap:2px;padding:4px;background:#1a1814;border-bottom:1px solid #3a2e1a;flex-shrink:0;';

    for (const cat of this.CATEGORIES) {
      const btn = document.createElement('button');
      btn.textContent = cat.label;
      btn.dataset['cat'] = cat.value;
      btn.style.cssText =
        'font-size:13px;padding:3px 7px;background:#252119;border:1px solid #5a4a2a;' +
        'color:#a89880;cursor:pointer;border-radius:2px;';
      if (cat.value === 'all') btn.style.color = '#d4a84b';
      btn.addEventListener('click', () => this.setFilter(cat.value));
      this.filterBarEl.appendChild(btn);
    }

    // Grid
    this.gridEl = document.createElement('div');
    this.gridEl.style.cssText =
      'display:grid;grid-template-columns:repeat(4,1fr);column-gap:3px;row-gap:8px;padding:6px 4px;flex:1;align-content:start;';

    // Seed with default empty grid (capacity will be set on first renderInventory)
    this.rebuildGrid();

    // Detail panel
    this.detailEl = document.createElement('div');
    this.detailEl.style.cssText =
      'background:#1a1814;border-top:1px solid #3a2e1a;padding:8px;display:none;flex-shrink:0;';

    this.container.appendChild(this.filterBarEl);
    this.container.appendChild(this.gridEl);
    this.container.appendChild(this.detailEl);
  }

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  private setFilter(category: string): void {
    this.currentCategory = category;
    this.filterBarEl.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.style.color = btn.dataset['cat'] === category ? '#d4a84b' : '#a89880';
    });
    this.applyFilter();
  }

  private applyFilter(): void {
    this.gridEl.querySelectorAll<HTMLElement>('.inv-cell').forEach((cell) => {
      if (cell.classList.contains('inv-cell--empty')) return; // empty slots always visible
      const cat = cell.dataset['category'] ?? '';
      cell.style.display =
        this.currentCategory === 'all' || cat === this.currentCategory ? '' : 'none';
    });
  }

  // ---------------------------------------------------------------------------
  // Full grid rebuild (called by renderInventory and internally)
  // ---------------------------------------------------------------------------

  private rebuildGrid(): void {
    this.gridEl.innerHTML = '';
    for (let i = 0; i < this.capacity; i++) {
      const slot = this.slots[i];
      this.gridEl.appendChild(slot ? this.buildFilledCell(slot) : this.buildEmptyCell());
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  renderInventory(slots: InventorySlotDto[], capacity: number): void {
    this.slots = slots;
    this.capacity = capacity;
    this.activeSlotId = null;
    this.detailEl.style.display = 'none';
    this.rebuildGrid();
    this.applyFilter();
  }

  addOrUpdateSlot(slot: InventorySlotDto): void {
    const existing = this.gridEl.querySelector<HTMLElement>(`[data-slot-id="${slot.slot_id}"]`);

    if (existing) {
      // Update icon and badge on existing filled cell
      const img = existing.querySelector<HTMLImageElement>('img');
      if (img && slot.definition.icon_url) img.src = slot.definition.icon_url;
      const badge = existing.querySelector<HTMLElement>('.inv-qty');
      if (badge) {
        badge.textContent = slot.quantity > 1 ? String(slot.quantity) : '';
        badge.style.display = slot.quantity > 1 ? '' : 'none';
      }
      const idx = this.slots.findIndex((s) => s.slot_id === slot.slot_id);
      if (idx >= 0) this.slots[idx] = slot;
    } else {
      // Convert the first empty cell to a filled cell
      this.slots.push(slot);
      const emptyCell = this.gridEl.querySelector<HTMLElement>('.inv-cell--empty');
      if (emptyCell) {
        emptyCell.replaceWith(this.buildFilledCell(slot));
      } else {
        this.gridEl.appendChild(this.buildFilledCell(slot));
      }
      if (this.currentCategory !== 'all' && slot.definition.category !== this.currentCategory) {
        const newCell = this.gridEl.querySelector<HTMLElement>(`[data-slot-id="${slot.slot_id}"]`);
        if (newCell) newCell.style.display = 'none';
      }
    }
  }

  removeSlot(slotId: number): void {
    const cell = this.gridEl.querySelector<HTMLElement>(`[data-slot-id="${slotId}"]`);
    if (cell) cell.replaceWith(this.buildEmptyCell());
    this.slots = this.slots.filter((s) => s.slot_id !== slotId);
    if (this.activeSlotId === slotId) this.hideDetailPanel();
  }

  // ---------------------------------------------------------------------------
  // Cell builders
  // ---------------------------------------------------------------------------

  private buildEmptyCell(): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'inv-cell inv-cell--empty';
    cell.style.cssText =
      'width:48px;height:48px;background:#120f0b;border:1px solid #1e1a14;' +
      'border-radius:1px;';
    return cell;
  }

  private buildFilledCell(slot: InventorySlotDto): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'inv-cell inv-cell--filled';
    cell.dataset['slotId'] = String(slot.slot_id);
    cell.dataset['category'] = slot.definition.category;
    cell.style.cssText =
      'position:relative;width:48px;height:48px;background:#252119;border:1px solid #3a2e1a;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:1px;';

    if (slot.definition.icon_url) {
      const img = document.createElement('img');
      img.src = slot.definition.icon_url;
      img.alt = slot.definition.name;
      img.style.cssText = 'width:40px;height:40px;object-fit:contain;';
      img.onerror = () => {
        img.style.display = 'none';
        cell.appendChild(this.buildIconPlaceholder(slot.definition.category));
      };
      cell.appendChild(img);
    } else {
      cell.appendChild(this.buildIconPlaceholder(slot.definition.category));
    }

    // Quantity badge
    const badge = document.createElement('span');
    badge.className = 'inv-qty';
    if (slot.quantity > 1) {
      badge.textContent = String(slot.quantity);
      badge.style.cssText =
        'position:absolute;bottom:2px;right:3px;font-size:13px;color:#f0c060;' +
        'font-family:Rajdhani,sans-serif;font-weight:700;line-height:1;pointer-events:none;';
    } else {
      badge.style.display = 'none';
    }
    cell.appendChild(badge);

    cell.addEventListener('click', () => this.showDetailPanel(slot));
    return cell;
  }

  private buildIconPlaceholder(category: string): HTMLElement {
    const ph = document.createElement('div');
    ph.style.cssText =
      'width:40px;height:40px;background:#2a2520;display:flex;align-items:center;' +
      'justify-content:center;color:#a89880;font-family:Rajdhani,sans-serif;font-size:16px;font-weight:700;';
    ph.textContent = (category[0] ?? '?').toUpperCase();
    return ph;
  }

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  showDetailPanel(slot: InventorySlotDto): void {
    this.activeSlotId = slot.slot_id;
    const def = slot.definition;

    const stats: string[] = [];
    if (def.weapon_subtype) stats.push(`Subtype: ${def.weapon_subtype.replace('_', '-')}`);
    if (def.attack != null) stats.push(`Attack: ${def.attack}`);
    if (def.defence != null) stats.push(`Defence: ${def.defence}`);
    if (def.heal_power != null) stats.push(`Heal: ${def.heal_power}`);
    if (def.food_power != null) stats.push(`Food: ${def.food_power}`);
    if (slot.quantity > 1) stats.push(`Qty: ${slot.quantity}`);

    this.detailEl.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:15px;color:#d4a84b;margin-bottom:5px;">${this.escHtml(def.name)}</div>
      <div style="font-size:13px;color:#7a6a52;text-transform:uppercase;margin-bottom:5px;">${def.category}</div>
      ${def.description ? `<div style="font-size:13px;color:#a89880;font-style:italic;margin-bottom:5px;">${this.escHtml(def.description)}</div>` : ''}
      ${stats.length > 0 ? `<div style="font-size:13px;color:#c8b88a;margin-bottom:8px;">${stats.join(' · ')}</div>` : ''}
      <button class="inv-delete-btn" data-slot="${slot.slot_id}" style="font-size:13px;background:#3a1a1a;border:1px solid #7a3a3a;color:#e87878;padding:3px 10px;cursor:pointer;border-radius:2px;">Delete</button>
    `;

    const deleteBtn = this.detailEl.querySelector<HTMLButtonElement>('.inv-delete-btn')!;
    deleteBtn.addEventListener('click', () => {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting…';
      this.onDeleteItem(slot.slot_id);
    });

    this.detailEl.style.display = '';
  }

  hideDetailPanel(): void {
    this.activeSlotId = null;
    this.detailEl.style.display = 'none';
  }

  showDeleteError(slotId: number): void {
    if (this.activeSlotId !== slotId) return;
    const btn = this.detailEl.querySelector<HTMLButtonElement>('.inv-delete-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Delete';
      btn.style.color = '#ff4444';
    }
  }

  private escHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
