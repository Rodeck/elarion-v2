import {
  getItems,
  deleteItem,
  getCharacters,
  grantItem,
  type ItemDefinitionResponse,
} from '../editor/api';
import { ItemModal } from './item-modal';
import { SpriteSheetDialog } from './sprite-sheet-dialog';
import { invalidateItemPickerCache } from './item-picker';

const VALID_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon',
  'helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'tool',
  'ring', 'amulet',
] as const;

const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food']);

export class ItemManager {
  private container!: HTMLElement;
  private items: ItemDefinitionResponse[] = [];
  private currentCategory: string = 'all';
  private nameFilter: string = '';
  private modal: ItemModal;

  constructor() {
    this.modal = new ItemModal((item) => {
      // Refresh list after save
      const idx = this.items.findIndex((i) => i.id === item.id);
      if (idx >= 0) this.items[idx] = item;
      else this.items.unshift(item);
      invalidateItemPickerCache();
      this.renderList();
    });
  }

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      const category = this.currentCategory === 'all' ? undefined : this.currentCategory;
      this.items = await getItems(category);
      this.renderList();
    } catch (err) {
      this.showError(`Failed to load items: ${(err as Error).message}`);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="item-list-col" style="padding:1.5rem;">
        <div class="item-filter-bar" id="item-filter-bar">
          <button class="btn btn--primary" id="item-add-btn">+ Add Item</button>
          <button class="btn btn--active" data-cat="all">All</button>
          ${VALID_CATEGORIES.map((c) => `<button class="btn" data-cat="${c}">${this.labelFor(c)}</button>`).join('')}
          <input type="text" id="item-name-filter" placeholder="Search by name\u2026" style="margin-left:auto;padding:4px 8px;background:#1a1a2e;border:1px solid #2a2a40;border-radius:4px;color:#c0c0d0;font-size:0.85rem;width:180px;" />
          <button class="btn btn--secondary" id="sprite-sheet-btn" title="Cut icons from a sprite sheet">&#x2702; Sprite Sheet</button>
          <button class="btn" id="item-refresh-btn" title="Refresh items list">&#x21bb; Refresh</button>
        </div>
        <div id="item-list-container">
          <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
        </div>
      </div>
    `;

    this.attachFilterListeners();
  }

  private attachFilterListeners(): void {
    const bar = this.container.querySelector<HTMLElement>('#item-filter-bar');
    if (!bar) return;

    // Add Item button
    const addBtn = this.container.querySelector<HTMLButtonElement>('#item-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.modal.open('create');
      });
    }

    bar.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cat]');
      if (!btn) return;
      this.currentCategory = btn.dataset['cat'] ?? 'all';
      bar.querySelectorAll('[data-cat]').forEach((b) => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      await this.load();
    });

    const nameInput = this.container.querySelector<HTMLInputElement>('#item-name-filter');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        this.nameFilter = nameInput.value.toLowerCase();
        this.renderList();
      });
    }

    const refreshBtn = this.container.querySelector<HTMLButtonElement>('#item-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '\u21bb Refreshing...';
        await this.load();
        refreshBtn.disabled = false;
        refreshBtn.textContent = '\u21bb Refresh';
      });
    }

    const spriteSheetBtn = this.container.querySelector<HTMLButtonElement>('#sprite-sheet-btn');
    if (spriteSheetBtn) {
      spriteSheetBtn.addEventListener('click', async () => {
        const dialog = new SpriteSheetDialog('items', () => this.load());
        await dialog.open();
      });
    }
  }

  private renderList(): void {
    const container = this.container.querySelector<HTMLElement>('#item-list-container')!;

    if (this.items.length === 0) {
      container.innerHTML = '<p>No items found.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'item-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Icon</th>
          <th>Name</th>
          <th>Category</th>
          <th>Stats</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody')!;
    const filtered = this.nameFilter
      ? this.items.filter((i) => i.name.toLowerCase().includes(this.nameFilter))
      : this.items;

    if (filtered.length === 0) {
      container.innerHTML = `<p>No items matching "${this.escHtml(this.nameFilter)}".</p>`;
      return;
    }

    for (const item of filtered) {
      const tr = document.createElement('tr');
      tr.dataset['id'] = String(item.id);

      const iconHtml = item.icon_url
        ? `<img src="${item.icon_url}" alt="${item.name}" style="width:32px;height:32px;object-fit:contain;" onerror="this.replaceWith(this.nextElementSibling)" /><div class="icon-placeholder" style="display:none">${item.category[0]?.toUpperCase()}</div>`
        : `<div class="icon-placeholder">${item.category[0]?.toUpperCase()}</div>`;

      const stats = this.formatStats(item);

      tr.innerHTML = `
        <td style="color:#6a6a8a;font-size:0.75rem;">${item.id}</td>
        <td>${iconHtml}</td>
        <td>${this.escHtml(item.name)}</td>
        <td>${this.labelFor(item.category)}</td>
        <td>${stats}</td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
            <button class="btn btn--sm btn-edit" data-id="${item.id}">Edit</button>
            <button class="btn btn--sm btn--danger btn-delete" data-id="${item.id}">Delete</button>
            <button class="btn btn--sm btn-give" data-id="${item.id}" style="background:#1a3d2a;color:#70e89a;border-color:#2a5a3a;">Give</button>
          </div>
          <div class="give-panel" data-id="${item.id}" style="display:none;margin-top:6px;padding:6px;background:#151520;border:1px solid #2a2a40;border-radius:4px;">
            <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
              <select class="give-player" style="flex:1;min-width:120px;font-size:0.75rem;padding:3px;background:#1a1a2e;color:#c8c8e0;border:1px solid #3a3a5a;">
                <option value="">Loading...</option>
              </select>
              <input class="give-qty" type="number" min="1" value="1" style="width:50px;font-size:0.75rem;padding:3px;background:#1a1a2e;color:#c8c8e0;border:1px solid #3a3a5a;" />
              <button class="btn btn--sm btn-give-confirm" style="background:#0e3d22;color:#70e89a;border-color:#2a5a3a;font-size:0.7rem;">Send</button>
            </div>
            <div class="give-result" style="font-size:0.7rem;margin-top:4px;display:none;"></div>
          </div>
        </td>
      `;

      tr.querySelector('.btn-edit')!.addEventListener('click', () => {
        this.modal.open('edit', item);
      });

      tr.querySelector('.btn-delete')!.addEventListener('click', async () => {
        if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
        try {
          await deleteItem(item.id);
          this.items = this.items.filter((i) => i.id !== item.id);
          tr.remove();
          invalidateItemPickerCache();
          if (this.items.length === 0) {
            container.innerHTML = '<p>No items found.</p>';
          }
        } catch (err) {
          alert(`Failed to delete: ${(err as Error).message}`);
        }
      });

      // Give-to-player toggle
      const giveBtn = tr.querySelector<HTMLButtonElement>('.btn-give')!;
      const givePanel = tr.querySelector<HTMLElement>('.give-panel')!;
      const giveSelect = givePanel.querySelector<HTMLSelectElement>('.give-player')!;
      const giveQty = givePanel.querySelector<HTMLInputElement>('.give-qty')!;
      const giveConfirm = givePanel.querySelector<HTMLButtonElement>('.btn-give-confirm')!;
      const giveResult = givePanel.querySelector<HTMLElement>('.give-result')!;

      giveBtn.addEventListener('click', async () => {
        const isOpen = givePanel.style.display !== 'none';
        givePanel.style.display = isOpen ? 'none' : '';
        if (!isOpen && giveSelect.options.length <= 1 && giveSelect.options[0]?.text === 'Loading...') {
          try {
            const players = await getCharacters();
            giveSelect.innerHTML = '<option value="">\u2014 select player \u2014</option>' +
              players.map((p) => `<option value="${p.id}">${this.escHtml(p.name)} (Lv${p.level} ${this.escHtml(p.class_name)})</option>`).join('');
          } catch {
            giveSelect.innerHTML = '<option value="">Failed to load</option>';
          }
        }
      });

      giveConfirm.addEventListener('click', async () => {
        const charId = giveSelect.value;
        if (!charId) { giveResult.textContent = 'Select a player'; giveResult.style.color = '#ff6060'; giveResult.style.display = ''; return; }
        const qty = parseInt(giveQty.value, 10) || 1;
        giveConfirm.disabled = true;
        giveResult.style.display = 'none';
        try {
          const data = await grantItem(charId, item.id, qty);
          giveResult.textContent = data.message ?? 'Done';
          giveResult.style.color = data.success ? '#70e89a' : '#ff6060';
          giveResult.style.display = '';
        } catch (err) {
          giveResult.textContent = `Error: ${(err as Error).message}`;
          giveResult.style.color = '#ff6060';
          giveResult.style.display = '';
        }
        giveConfirm.disabled = false;
      });

      tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
  }

  private formatStats(item: ItemDefinitionResponse): string {
    const pills: string[] = [];
    if (item.stack_size != null)  pills.push(this.pill(`Stack: ${item.stack_size}`,  '#2a3048', '#9ba8d0'));
    if (item.weapon_subtype)      pills.push(this.subtypePill(item.weapon_subtype));
    if (item.attack != null)      pills.push(this.pill(`ATK: ${item.attack}`,        '#4a1a1a', '#ff9090'));
    if (item.defence != null)     pills.push(this.pill(`DEF: ${item.defence}`,       '#1a2e50', '#80aaff'));
    if (item.heal_power != null)  pills.push(this.pill(`Heal: ${item.heal_power}`,   '#0e3d22', '#70e89a'));
    if (item.food_power != null)  pills.push(this.pill(`Food: ${item.food_power}`,   '#3d2800', '#ffbe5c'));
    if (item.tool_type)           pills.push(this.pill(`${item.tool_type}`,           '#2a2a3d', '#8888cc'));
    if (item.max_durability != null) pills.push(this.pill(`Dur: ${item.max_durability}`, '#2a2a3d', '#8888cc'));
    if (item.power != null)       pills.push(this.pill(`Power: ${item.power}`,         '#2a2a3d', '#8888cc'));
    if (item.disassembly_cost > 0) pills.push(this.pill(`Disasm: ${item.disassembly_cost}`, '#3d2a00', '#d4a84b'));
    return pills.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">${pills.join('')}</div>`
      : '\u2014';
  }

  private pill(label: string, bg: string, fg: string): string {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;letter-spacing:0.02em;background:${bg};color:${fg};white-space:nowrap;">${this.escHtml(label)}</span>`;
  }

  private subtypePill(subtype: string): string {
    const cfg: Record<string, [string, string, string]> = {
      one_handed: ['One-Handed', '#4a3800', '#ffd050'],
      two_handed: ['Two-Handed', '#0e2448', '#6ea8fe'],
      dagger:     ['Dagger',     '#30124a', '#c084fc'],
      wand:       ['Wand',       '#003838', '#5eead4'],
      staff:      ['Staff',      '#0f3320', '#6ee7a0'],
      bow:        ['Bow',        '#3d1e00', '#fb923c'],
    };
    const [label, bg, fg] = cfg[subtype] ?? [this.subtypeLabel(subtype), '#2a2a3e', '#c8c8e0'];
    return this.pill(label, bg, fg);
  }

  private labelFor(category: string): string {
    const labels: Record<string, string> = {
      resource: 'Resource', food: 'Food', heal: 'Heal', weapon: 'Weapon',
      helmet: 'Helmet', chestplate: 'Chestplate', boots: 'Boots', shield: 'Shield',
      greaves: 'Greaves', bracer: 'Bracer', tool: 'Tool', ring: 'Ring', amulet: 'Amulet',
    };
    return labels[category] ?? category;
  }

  private subtypeLabel(subtype: string): string {
    const labels: Record<string, string> = {
      one_handed: 'One-Handed', two_handed: 'Two-Handed', dagger: 'Dagger',
      wand: 'Wand', staff: 'Staff', bow: 'Bow',
    };
    return labels[subtype] ?? subtype;
  }

  private showError(msg: string): void {
    const container = this.container.querySelector<HTMLElement>('#item-list-container');
    if (container) container.innerHTML = `<p class="error">${this.escHtml(msg)}</p>`;
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
