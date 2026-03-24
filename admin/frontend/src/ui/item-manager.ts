import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getCharacters,
  grantItem,
  type ItemDefinitionResponse,
} from '../editor/api';
import { ImageGenDialog } from './image-gen-dialog';
import { SpriteSheetDialog } from './sprite-sheet-dialog';

const VALID_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon',
  'helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'tool',
] as const;

const VALID_WEAPON_SUBTYPES = [
  'one_handed', 'two_handed', 'dagger', 'wand', 'staff', 'bow',
] as const;

const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food']);
const DEFENCE_CATEGORIES = new Set(['helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer']);

type ItemCategory = typeof VALID_CATEGORIES[number];

export class ItemManager {
  private container!: HTMLElement;
  private items: ItemDefinitionResponse[] = [];
  private currentCategory: string = 'all';
  private editingId: number | null = null;
  private acceptedBase64: string | null = null;
  private updateAiGenBtn: (() => void) | null = null;

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
      <div class="item-manager-layout">

        <!-- ── Left col: form ── -->
        <div class="item-form-col">
          <h2>Items</h2>
          <div class="item-form-card">
            <h3 id="item-form-title">Add New Item</h3>
            <p id="item-error" class="error" style="display:none"></p>
            <form id="item-form" autocomplete="off">
              <label for="item-name">Name *</label>
              <input id="item-name" name="name" type="text" maxlength="64" required placeholder="Item name" />

              <label for="item-desc">Description</label>
              <textarea id="item-desc" name="description" rows="2" placeholder="Optional description"></textarea>

              <label for="item-category">Category *</label>
              <select id="item-category" name="category" required>
                <option value="">— select —</option>
                ${VALID_CATEGORIES.map((c) => `<option value="${c}">${this.labelFor(c)}</option>`).join('')}
              </select>

              <div id="field-weapon_subtype" style="display:none">
                <label for="item-weapon-subtype">Weapon Subtype *</label>
                <select id="item-weapon-subtype" name="weapon_subtype">
                  <option value="">— select —</option>
                  ${VALID_WEAPON_SUBTYPES.map((s) => `<option value="${s}">${this.subtypeLabel(s)}</option>`).join('')}
                </select>
              </div>

              <div id="field-attack" style="display:none">
                <label for="item-attack">Attack</label>
                <input id="item-attack" name="attack" type="number" min="0" style="width:120px" />
              </div>

              <div id="field-defence" style="display:none">
                <label for="item-defence">Defence</label>
                <input id="item-defence" name="defence" type="number" min="0" style="width:120px" />
              </div>

              <div id="field-heal_power" style="display:none">
                <label for="item-heal">Heal Power</label>
                <input id="item-heal" name="heal_power" type="number" min="0" style="width:120px" />
              </div>

              <div id="field-food_power" style="display:none">
                <label for="item-food">Food Power</label>
                <input id="item-food" name="food_power" type="number" min="0" style="width:120px" />
              </div>

              <div id="field-stack_size" style="display:none">
                <label for="item-stack">Stack Size *</label>
                <input id="item-stack" name="stack_size" type="number" min="1" style="width:120px" />
              </div>

              <div id="field-tool_type" style="display:none">
                <label for="item-tool-type">Tool Type *</label>
                <select id="item-tool-type" name="tool_type">
                  <option value="">— select —</option>
                  <option value="pickaxe">Pickaxe</option>
                  <option value="axe">Axe</option>
                </select>
              </div>

              <div id="field-max_durability" style="display:none">
                <label for="item-max-durability">Max Durability *</label>
                <input id="item-max-durability" name="max_durability" type="number" min="1" style="width:120px" />
              </div>

              <div id="field-power" style="display:none">
                <label for="item-power">Power</label>
                <input id="item-power" name="power" type="number" min="1" style="width:120px" />
              </div>

              <label>Icon (PNG, max 2 MB)</label>
              <div class="file-upload-row">
                <button type="button" class="btn btn--secondary" id="choose-icon-btn">Choose File</button>
                <button type="button" class="btn btn--secondary" id="ai-gen-btn">Generate with AI</button>
                <span id="icon-filename" class="file-name-text">No file chosen</span>
                <input id="item-icon" name="icon" type="file" accept="image/png" style="display:none;" />
              </div>
              <div id="icon-preview" style="display:none;margin-top:10px;">
                <p style="font-size:0.7rem;color:#404666;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px;font-weight:600;">Icon Preview</p>
                <div class="inv-slot-preview-wrap">
                  <div class="inv-slot-cell">
                    <img id="current-icon-img" src="" alt="icon" />
                  </div>
                  <span style="font-size:0.75rem;color:#5a6280;line-height:1.5;">As it appears<br>in the inventory</span>
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn" id="item-form-cancel" style="display:none">Cancel</button>
                <button type="submit" class="btn btn--primary" id="item-form-submit">Add Item</button>
              </div>
            </form>
          </div>
        </div>

        <!-- ── Right col: filter + list ── -->
        <div class="item-list-col">
          <div class="item-filter-bar" id="item-filter-bar">
            <button class="btn btn--active" data-cat="all">All</button>
            ${VALID_CATEGORIES.map((c) => `<button class="btn" data-cat="${c}">${this.labelFor(c)}</button>`).join('')}
            <button class="btn btn--secondary" id="sprite-sheet-btn" title="Cut icons from a sprite sheet" style="margin-left:auto;">&#x2702; Sprite Sheet</button>
            <button class="btn" id="item-refresh-btn" title="Refresh items list">&#x21bb; Refresh</button>
          </div>
          <div id="item-list-container">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>

      </div>
    `;

    this.attachFilterListeners();
    this.attachFormListeners();
  }

  private attachFilterListeners(): void {
    const bar = this.container.querySelector<HTMLElement>('#item-filter-bar');
    if (!bar) return;
    bar.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cat]');
      if (!btn) return;
      this.currentCategory = btn.dataset['cat'] ?? 'all';
      bar.querySelectorAll('[data-cat]').forEach((b) => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      await this.load();
    });

    const refreshBtn = this.container.querySelector<HTMLButtonElement>('#item-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '↻ Refreshing...';
        await this.load();
        refreshBtn.disabled = false;
        refreshBtn.textContent = '↻ Refresh';
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

  private attachFormListeners(): void {
    const form = this.container.querySelector<HTMLFormElement>('#item-form');
    if (!form) return;

    const categorySelect = form.querySelector<HTMLSelectElement>('[name="category"]')!;
    categorySelect.addEventListener('change', () => {
      this.updateConditionalFields(form, categorySelect.value as ItemCategory | '');
    });

    const cancelBtn = this.container.querySelector<HTMLButtonElement>('#item-form-cancel')!;
    cancelBtn.addEventListener('click', () => {
      this.resetForm();
    });

    const iconInput = form.querySelector<HTMLInputElement>('[name="icon"]')!;
    const chooseBtn = this.container.querySelector<HTMLButtonElement>('#choose-icon-btn')!;
    chooseBtn.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = this.container.querySelector<HTMLElement>('#icon-filename');
      if (nameEl) nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        const url = URL.createObjectURL(file);
        const preview = this.container.querySelector<HTMLElement>('#icon-preview')!;
        const img = preview.querySelector<HTMLImageElement>('#current-icon-img')!;
        img.src = url;
        preview.style.display = '';
      }
    });

    const aiGenBtn = this.container.querySelector<HTMLButtonElement>('#ai-gen-btn')!;
    const itemNameInput = this.container.querySelector<HTMLInputElement>('#item-name')!;

    // Disable AI gen button when name is empty
    this.updateAiGenBtn = () => {
      aiGenBtn.disabled = !itemNameInput.value.trim();
    };
    itemNameInput.addEventListener('input', this.updateAiGenBtn);
    this.updateAiGenBtn();

    aiGenBtn.addEventListener('click', async () => {
      const name = itemNameInput.value.trim();
      if (!name) return;
      const dialog = new ImageGenDialog();
      await dialog.open(name, (base64) => {
        this.acceptedBase64 = base64;
        // Show preview from data URI
        const preview = this.container.querySelector<HTMLElement>('#icon-preview')!;
        const img = preview.querySelector<HTMLImageElement>('#current-icon-img')!;
        img.src = `data:image/png;base64,${base64}`;
        preview.style.display = '';
        const nameEl = this.container.querySelector<HTMLElement>('#icon-filename');
        if (nameEl) nameEl.textContent = 'AI generated';
        // Clear the file input so it doesn't override
        iconInput.value = '';
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit(form);
    });
  }

  private updateConditionalFields(form: HTMLFormElement, category: ItemCategory | ''): void {
    const show = (id: string, visible: boolean) => {
      const el = this.container.querySelector<HTMLElement>(`#field-${id}`);
      if (el) el.style.display = visible ? '' : 'none';
    };

    show('weapon_subtype', category === 'weapon');
    show('attack', category === 'weapon');
    show('defence', category !== '' && DEFENCE_CATEGORIES.has(category));
    show('heal_power', category === 'heal');
    show('food_power', category === 'food');
    show('stack_size', category !== '' && STACKABLE_CATEGORIES.has(category));
    show('tool_type', category === 'tool');
    show('max_durability', category === 'tool');
    show('power', category === 'tool');
  }

  private async handleFormSubmit(form: HTMLFormElement): Promise<void> {
    const errorEl = this.container.querySelector<HTMLElement>('#item-error')!;
    errorEl.style.display = 'none';

    const formData = new FormData(form);

    // Prune empty optional fields so they don't overwrite existing values on edit
    for (const key of ['weapon_subtype', 'attack', 'defence', 'heal_power', 'food_power', 'stack_size', 'tool_type', 'max_durability', 'power']) {
      const val = formData.get(key);
      if (val === '' || val === null) formData.delete(key);
    }
    const iconFile = formData.get('icon') as File;
    if (!iconFile || iconFile.size === 0) formData.delete('icon');

    // If AI-generated image was accepted and no file selected, append base64
    const iconFile2 = formData.get('icon') as File;
    if ((!iconFile2 || iconFile2.size === 0) && this.acceptedBase64) {
      formData.delete('icon');
      formData.append('icon_base64', this.acceptedBase64);
    }

    try {
      if (this.editingId !== null) {
        const updated = await updateItem(this.editingId, formData);
        const idx = this.items.findIndex((i) => i.id === updated.id);
        if (idx >= 0) this.items[idx] = updated;
        else this.items.unshift(updated);
        this.resetForm();
        this.renderList();
      } else {
        const created = await createItem(formData);
        this.items.unshift(created);
        this.resetForm();
        this.renderList();
      }
    } catch (err) {
      errorEl.textContent = (err as Error).message;
      errorEl.style.display = '';
    }
  }

  private resetForm(): void {
    this.editingId = null;
    this.acceptedBase64 = null;
    const form = this.container.querySelector<HTMLFormElement>('#item-form')!;
    form.reset();
    this.container.querySelector<HTMLElement>('#item-form-title')!.textContent = 'Add New Item';
    this.container.querySelector<HTMLElement>('#item-form-submit')!.textContent = 'Add Item';
    this.container.querySelector<HTMLElement>('#item-form-cancel')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#item-error')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#icon-preview')!.style.display = 'none';
    const nameEl = this.container.querySelector<HTMLElement>('#icon-filename');
    if (nameEl) nameEl.textContent = 'No file chosen';
    this.updateConditionalFields(form, '');
    this.updateAiGenBtn?.();
  }

  private populateForm(item: ItemDefinitionResponse): void {
    this.editingId = item.id;
    const form = this.container.querySelector<HTMLFormElement>('#item-form')!;

    (form.querySelector<HTMLInputElement>('[name="name"]'))!.value = item.name;
    (form.querySelector<HTMLTextAreaElement>('[name="description"]'))!.value = item.description ?? '';
    const categorySelect = form.querySelector<HTMLSelectElement>('[name="category"]')!;
    categorySelect.value = item.category;
    this.updateConditionalFields(form, item.category as ItemCategory);

    if (item.weapon_subtype) {
      (form.querySelector<HTMLSelectElement>('[name="weapon_subtype"]'))!.value = item.weapon_subtype;
    }
    const setNum = (name: string, val: number | null) => {
      const el = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (el) el.value = val != null ? String(val) : '';
    };
    setNum('attack', item.attack);
    setNum('defence', item.defence);
    setNum('heal_power', item.heal_power);
    setNum('food_power', item.food_power);
    setNum('stack_size', item.stack_size);
    setNum('max_durability', item.max_durability);
    setNum('power', item.power);
    if (item.tool_type) {
      const toolTypeSelect = form.querySelector<HTMLSelectElement>('[name="tool_type"]');
      if (toolTypeSelect) toolTypeSelect.value = item.tool_type;
    }

    if (item.icon_url) {
      const preview = this.container.querySelector<HTMLElement>('#icon-preview')!;
      const img = preview.querySelector<HTMLImageElement>('#current-icon-img')!;
      img.src = item.icon_url;
      preview.style.display = '';
    }

    this.container.querySelector<HTMLElement>('#item-form-title')!.textContent = `Edit Item #${item.id}`;
    this.container.querySelector<HTMLElement>('#item-form-submit')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#item-form-cancel')!.style.display = '';
    this.container.querySelector<HTMLElement>('#item-error')!.style.display = 'none';
    this.updateAiGenBtn?.();
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
    for (const item of this.items) {
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
        this.populateForm(item);
      });

      tr.querySelector('.btn-delete')!.addEventListener('click', async () => {
        if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
        try {
          await deleteItem(item.id);
          this.items = this.items.filter((i) => i.id !== item.id);
          tr.remove();
          if (this.editingId === item.id) this.resetForm();
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
            giveSelect.innerHTML = '<option value="">— select player —</option>' +
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
    return pills.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">${pills.join('')}</div>`
      : '—';
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
      greaves: 'Greaves', bracer: 'Bracer', tool: 'Tool',
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
