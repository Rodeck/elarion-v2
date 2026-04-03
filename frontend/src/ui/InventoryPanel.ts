import type { InventorySlotDto } from '../../../shared/protocol/index';

// Maps each UI filter tab to the DB category values it covers.
// Old fine-grained DB categories (boots, shield, etc.) roll up into broader groups.
const CATEGORY_GROUPS: Record<string, string[]> = {
  weapon:      ['weapon'],
  armor:       ['armor', 'boots', 'shield', 'greaves', 'bracer', 'helmet', 'chestplate'],
  consumable:  ['consumable', 'food', 'heal', 'potion', 'skill_book'],
  resource:    ['resource'],
  tool:        ['tool'],
};

export class InventoryPanel {
  private container: HTMLElement;
  private onDeleteItem: (slotId: number) => void;
  private onUseSkillBook: ((slotId: number) => void) | null = null;
  private slots: InventorySlotDto[] = [];
  private capacity: number = 20;
  private currentCategory: string = 'all';
  private activeSlotId: number | null = null;

  private gridEl!: HTMLElement;
  private filterBarEl!: HTMLElement;
  private detailEl!: HTMLElement;
  private dragEnabled = false;

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
    if (cell) {
      cell.remove();
      this.gridEl.appendChild(this.buildEmptyCell());
    }
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

    let tip: HTMLElement | null = null;
    cell.addEventListener('mouseenter', () => {
      cell.style.borderColor = '#a07830';
      cell.style.background = '#2f2820';
      tip = document.createElement('div');
      tip.className = 'inv-tooltip';
      tip.textContent = slot.definition.name;
      tip.style.cssText =
        'position:fixed;z-index:999;pointer-events:none;' +
        'background:linear-gradient(180deg,#1e1a14 0%,#151210 100%);' +
        'border:1px solid #5a4a2a;border-radius:3px;' +
        'padding:3px 8px;' +
        "font-family:'Cinzel',serif;font-size:11px;color:#d4a84b;" +
        'white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.6);';
      document.body.appendChild(tip);
      const rect = cell.getBoundingClientRect();
      tip.style.left = `${rect.left + rect.width / 2 - tip.offsetWidth / 2}px`;
      tip.style.top = `${rect.top - tip.offsetHeight - 4}px`;
    });
    cell.addEventListener('mouseleave', () => {
      cell.style.borderColor = '#5a4a2a';
      cell.style.background = '#252119';
      tip?.remove();
      tip = null;
    });

    if (slot.definition.icon_url) {
      const img = document.createElement('img');
      img.src = slot.definition.icon_url;
      img.alt = slot.definition.name;
      img.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:76%;height:76%;object-fit:contain;';
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

    // Drag-and-drop support (enabled when marketplace modal is open)
    if (this.dragEnabled) {
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', JSON.stringify({
            slot_id: slot.slot_id,
            item_def_id: slot.definition.id,
          }));
          e.dataTransfer.effectAllowed = 'copy';
        }
        cell.style.opacity = '0.5';
      });
      cell.addEventListener('dragend', () => {
        cell.style.opacity = '1';
      });
    }

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
    if (def.max_mana > 0) stats.push(`Max Mana: +${def.max_mana}`);
    if (def.mana_on_hit > 0) stats.push(`Mana on Hit: +${def.mana_on_hit}`);
    if (def.mana_on_damage_taken > 0) stats.push(`Mana on Hit Taken: +${def.mana_on_damage_taken}`);
    if (def.mana_regen > 0) stats.push(`Mana Regen: +${def.mana_regen}`);
    if (def.dodge_chance > 0) stats.push(`Dodge: ${def.dodge_chance}%`);
    if (def.crit_chance > 0) stats.push(`Crit Chance: ${def.crit_chance}%`);
    if (def.crit_damage !== 150) stats.push(`Crit Dmg: ${def.crit_damage}%`);
    if (def.tool_type) stats.push(`Type: ${def.tool_type}`);
    if (def.power != null && def.power > 0) stats.push(`Power: ${def.power}`);
    if (slot.current_durability != null && def.max_durability != null) {
      stats.push(`Durability: ${slot.current_durability} / ${def.max_durability}`);
    }

    // Map raw DB category to display label
    const categoryLabel = this.resolveDisplayCategory(def.category);
    const displayName = slot.quantity > 1
      ? `${this.escHtml(def.name)} x${slot.quantity}`
      : this.escHtml(def.name);

    this.detailEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="font-family:'Cinzel',serif;font-size:15px;color:#d4a84b;">${displayName}</div>
        <button class="inv-delete-btn" data-slot="${slot.slot_id}" style="font-size:16px;background:none;border:none;color:#c06060;cursor:pointer;padding:2px 4px;line-height:1;opacity:0.7;" title="Delete item">&#128465;</button>
      </div>
      <div style="font-size:11px;color:#7a6a52;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${categoryLabel}</div>
      ${def.description ? `<div style="font-size:13px;color:#a89880;font-style:italic;margin-bottom:6px;font-family:'Crimson Text',serif;">${this.escHtml(def.description)}</div>` : ''}
      ${stats.length > 0 ? `<div style="font-size:13px;color:#c8b88a;margin-bottom:8px;">${stats.join(' · ')}</div>` : ''}
    `;

    const deleteBtn = this.detailEl.querySelector<HTMLButtonElement>('.inv-delete-btn')!;
    deleteBtn.addEventListener('click', () => {
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.3';
      this.onDeleteItem(slot.slot_id);
    });

    // "Use" button for skill books
    if (def.category === 'skill_book' && this.onUseSkillBook) {
      const useBtn = document.createElement('button');
      useBtn.textContent = 'Read';
      useBtn.style.cssText =
        'width:100%;padding:6px 0;margin-top:6px;font-family:Cinzel,serif;font-size:13px;' +
        'background:#2a2210;border:1px solid #d4a84b;color:#d4a84b;cursor:pointer;border-radius:2px;' +
        'letter-spacing:0.04em;transition:background 0.15s,color 0.15s;';
      useBtn.addEventListener('mouseenter', () => {
        useBtn.style.background = '#3a3218';
        useBtn.style.color = '#f0c060';
      });
      useBtn.addEventListener('mouseleave', () => {
        useBtn.style.background = '#2a2210';
        useBtn.style.color = '#d4a84b';
      });
      useBtn.addEventListener('click', () => {
        useBtn.disabled = true;
        useBtn.style.opacity = '0.5';
        this.onUseSkillBook!(slot.slot_id);
      });
      this.detailEl.appendChild(useBtn);
    }

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
      btn.style.opacity = '1';
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
    // Specific display labels for categories that have underscores or need custom names
    const customLabels: Record<string, string> = { skill_book: 'Skill Book' };
    if (customLabels[dbCategory]) return customLabels[dbCategory];
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

  setDragEnabled(enabled: boolean): void {
    this.dragEnabled = enabled;
    this.renderInventory(this.slots, this.capacity);
  }

  setOnUseSkillBook(cb: (slotId: number) => void): void {
    this.onUseSkillBook = cb;
  }

  getSlots(): InventorySlotDto[] {
    return this.slots;
  }
}
