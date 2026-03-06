import type { InventorySlotDto } from '../../../shared/protocol/index';

// Maps each UI filter tab to the DB category values it covers.
// Old fine-grained DB categories (boots, shield, etc.) roll up into broader groups.
const CATEGORY_GROUPS: Record<string, string[]> = {
  weapon:      ['weapon'],
  armor:       ['armor', 'boots', 'shield', 'greaves', 'bracer', 'helmet', 'chestplate'],
  consumable:  ['consumable', 'food', 'heal', 'potion'],
  resource:    ['resource'],
  tool:        ['tool'],
};

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
    { value: 'all',        label: 'All'      },
    { value: 'weapon',     label: 'Weapons'  },
    { value: 'armor',      label: 'Armor'    },
    { value: 'consumable', label: 'Use'      },
    { value: 'resource',   label: 'Resources'},
    { value: 'tool',       label: 'Tools'    },
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
      'display:flex;flex-wrap:wrap;gap:3px;padding:6px;background:#1a1814;border-bottom:1px solid #3a2e1a;flex-shrink:0;';

    for (const cat of this.CATEGORIES) {
      const btn = document.createElement('button');
      btn.textContent = cat.label;
      btn.dataset['cat'] = cat.value;
      btn.style.cssText =
        'flex:1;font-size:12px;padding:3px 9px;background:#252119;border:1px solid #5a4a2a;' +
        'color:#a89880;cursor:pointer;border-radius:2px;font-family:Cinzel,serif;letter-spacing:0.03em;' +
        'text-align:center;transition:color 0.15s,border-color 0.15s;';
      if (cat.value === 'all') {
        btn.style.color = '#d4a84b';
        btn.style.borderColor = '#7a5a2a';
      }
      btn.addEventListener('click', () => this.setFilter(cat.value));
      this.filterBarEl.appendChild(btn);
    }

    // Grid — 5 columns, cells fill their column
    this.gridEl = document.createElement('div');
    this.gridEl.style.cssText =
      'display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:8px;flex:1;align-content:start;overflow-y:auto;';

    this.rebuildGrid();

    // Detail panel
    this.detailEl = document.createElement('div');
    this.detailEl.style.cssText =
      'background:#1a1814;border-top:1px solid #3a2e1a;padding:10px;display:none;flex-shrink:0;';

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
      const active = btn.dataset['cat'] === category;
      btn.style.color = active ? '#d4a84b' : '#a89880';
      btn.style.borderColor = active ? '#7a5a2a' : '#5a4a2a';
    });
    this.applyFilter();
  }

  private applyFilter(): void {
    const group = this.currentCategory === 'all'
      ? null
      : (CATEGORY_GROUPS[this.currentCategory] ?? [this.currentCategory]);

    this.gridEl.querySelectorAll<HTMLElement>('.inv-cell').forEach((cell) => {
      if (cell.classList.contains('inv-cell--empty')) return; // empty slots always visible
      const cat = cell.dataset['category'] ?? '';
      cell.style.display = (!group || group.includes(cat)) ? '' : 'none';
    });
  }

  // ---------------------------------------------------------------------------
  // Full grid rebuild
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
      this.slots.push(slot);
      const emptyCell = this.gridEl.querySelector<HTMLElement>('.inv-cell--empty');
      if (emptyCell) {
        emptyCell.replaceWith(this.buildFilledCell(slot));
      } else {
        this.gridEl.appendChild(this.buildFilledCell(slot));
      }
      if (this.currentCategory !== 'all' && !this.slotMatchesFilter(slot)) {
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
      'aspect-ratio:1;background:#1c1814;border:1px dashed #4a3820;border-radius:2px;' +
      'display:flex;align-items:center;justify-content:center;';

    // Subtle cross-hair icon so the slot reads as "empty" rather than blank space
    const ph = document.createElement('div');
    ph.style.cssText =
      'width:16px;height:16px;opacity:0.25;position:relative;';
    ph.innerHTML =
      '<div style="position:absolute;top:50%;left:0;width:100%;height:1px;background:#a89060;transform:translateY(-50%)"></div>' +
      '<div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#a89060;transform:translateX(-50%)"></div>';
    cell.appendChild(ph);
    return cell;
  }

  private buildFilledCell(slot: InventorySlotDto): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'inv-cell inv-cell--filled';
    cell.dataset['slotId'] = String(slot.slot_id);
    cell.dataset['category'] = slot.definition.category;
    cell.style.cssText =
      'position:relative;aspect-ratio:1;background:#252119;border:1px solid #5a4a2a;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:2px;' +
      'transition:border-color 0.15s,background 0.15s;';

    cell.addEventListener('mouseenter', () => {
      cell.style.borderColor = '#a07830';
      cell.style.background = '#2f2820';
    });
    cell.addEventListener('mouseleave', () => {
      cell.style.borderColor = '#5a4a2a';
      cell.style.background = '#252119';
    });

    if (slot.definition.icon_url) {
      const img = document.createElement('img');
      img.src = slot.definition.icon_url;
      img.alt = slot.definition.name;
      img.style.cssText = 'position:absolute;inset:12%;object-fit:contain;display:block;';
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
      'position:absolute;inset:12%;background:#2a2520;display:flex;align-items:center;' +
      'justify-content:center;color:#a89880;font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;border-radius:1px;';
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

    // Map raw DB category to display label
    const categoryLabel = this.resolveDisplayCategory(def.category);

    this.detailEl.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:15px;color:#d4a84b;margin-bottom:4px;">${this.escHtml(def.name)}</div>
      <div style="font-size:11px;color:#7a6a52;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${categoryLabel}</div>
      ${def.description ? `<div style="font-size:13px;color:#a89880;font-style:italic;margin-bottom:6px;font-family:'Crimson Text',serif;">${this.escHtml(def.description)}</div>` : ''}
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private slotMatchesFilter(slot: InventorySlotDto): boolean {
    if (this.currentCategory === 'all') return true;
    const group = CATEGORY_GROUPS[this.currentCategory] ?? [this.currentCategory];
    return group.includes(slot.definition.category);
  }

  private resolveDisplayCategory(dbCategory: string): string {
    for (const [display, values] of Object.entries(CATEGORY_GROUPS)) {
      if (values.includes(dbCategory)) {
        return display.charAt(0).toUpperCase() + display.slice(1);
      }
    }
    return dbCategory;
  }

  private escHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
