import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  type ItemDefinitionResponse,
} from '../editor/api';

const VALID_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon',
  'boots', 'shield', 'greaves', 'bracer', 'tool',
] as const;

const VALID_WEAPON_SUBTYPES = [
  'one_handed', 'two_handed', 'dagger', 'wand', 'staff', 'bow',
] as const;

const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food']);
const DEFENCE_CATEGORIES = new Set(['boots', 'shield', 'greaves', 'bracer']);

type ItemCategory = typeof VALID_CATEGORIES[number];

export class ItemManager {
  private container!: HTMLElement;
  private items: ItemDefinitionResponse[] = [];
  private currentCategory: string = 'all';
  private editingId: number | null = null;

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

              <label>Icon (PNG, max 2 MB)</label>
              <div class="file-upload-row">
                <button type="button" class="btn btn--secondary" id="choose-icon-btn">Choose File</button>
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
      bar.querySelectorAll('.btn').forEach((b) => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      await this.load();
    });
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
  }

  private async handleFormSubmit(form: HTMLFormElement): Promise<void> {
    const errorEl = this.container.querySelector<HTMLElement>('#item-error')!;
    errorEl.style.display = 'none';

    const formData = new FormData(form);

    // Prune empty optional fields so they don't overwrite existing values on edit
    for (const key of ['weapon_subtype', 'attack', 'defence', 'heal_power', 'food_power', 'stack_size']) {
      const val = formData.get(key);
      if (val === '' || val === null) formData.delete(key);
    }
    const iconFile = formData.get('icon') as File;
    if (!iconFile || iconFile.size === 0) formData.delete('icon');

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
        <td>${iconHtml}</td>
        <td>${this.escHtml(item.name)}</td>
        <td>${this.labelFor(item.category)}</td>
        <td>${stats}</td>
        <td>
          <button class="btn btn--sm btn-edit" data-id="${item.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn-delete" data-id="${item.id}">Delete</button>
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

      tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
  }

  private formatStats(item: ItemDefinitionResponse): string {
    const parts: string[] = [];
    if (item.weapon_subtype) parts.push(`Subtype: ${this.subtypeLabel(item.weapon_subtype)}`);
    if (item.attack != null) parts.push(`ATK: ${item.attack}`);
    if (item.defence != null) parts.push(`DEF: ${item.defence}`);
    if (item.heal_power != null) parts.push(`Heal: ${item.heal_power}`);
    if (item.food_power != null) parts.push(`Food: ${item.food_power}`);
    if (item.stack_size != null) parts.push(`Stack: ${item.stack_size}`);
    return parts.join(', ') || '—';
  }

  private labelFor(category: string): string {
    const labels: Record<string, string> = {
      resource: 'Resource', food: 'Food', heal: 'Heal', weapon: 'Weapon',
      boots: 'Boots', shield: 'Shield', greaves: 'Greaves', bracer: 'Bracer', tool: 'Tool',
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
