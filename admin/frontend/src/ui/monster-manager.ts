import {
  listMonsters,
  getMonster,
  createMonster,
  updateMonster,
  deleteMonster,
  addMonsterLoot,
  deleteMonsterLoot,
  getItems,
  type MonsterResponse,
  type MonsterLootEntry,
  type ItemDefinitionResponse,
} from '../editor/api';
import { ImageGenDialog } from './image-gen-dialog';

export class MonsterManager {
  private container!: HTMLElement;
  private monsters: MonsterResponse[] = [];
  private items: ItemDefinitionResponse[] = [];
  private editingMonsterId: number | null = null;
  private expandedMonsterId: number | null = null;
  private acceptedBase64: string | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      [this.monsters, this.items] = await Promise.all([listMonsters(), getItems()]);
      this.renderList();
    } catch (err) {
      this.showListError(`Failed to load: ${(err as Error).message}`);
    }
  }

  // ── Skeleton ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="monster-manager">
        <div class="monster-form-col">
          <h2>Monsters</h2>
          <div class="monster-form-card">
            <h3 id="mm-form-title">Add New Monster</h3>
            <p id="mm-error" class="error" style="display:none"></p>
            <label for="mm-name">Name *</label>
            <input id="mm-name" type="text" maxlength="64" placeholder="e.g. Cave Rat" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
              <div>
                <label for="mm-attack">Attack</label>
                <input id="mm-attack" type="number" min="0" value="5" />
              </div>
              <div>
                <label for="mm-defense">Defense</label>
                <input id="mm-defense" type="number" min="0" value="2" />
              </div>
              <div>
                <label for="mm-hp">HP</label>
                <input id="mm-hp" type="number" min="1" value="20" />
              </div>
              <div>
                <label for="mm-xp">XP Reward</label>
                <input id="mm-xp" type="number" min="0" value="10" />
              </div>
              <div>
                <label for="mm-min-crowns">Min Crowns</label>
                <input id="mm-min-crowns" type="number" min="0" value="0" />
              </div>
              <div>
                <label for="mm-max-crowns">Max Crowns</label>
                <input id="mm-max-crowns" type="number" min="0" value="0" />
              </div>
            </div>
            <label>Icon (PNG, max 2 MB)</label>
            <div class="file-upload-row" style="margin-bottom:0.5rem;">
              <button type="button" class="btn btn--secondary" id="mm-choose-btn">Choose File</button>
              <button type="button" class="btn btn--secondary" id="mm-ai-gen-btn" disabled>Generate with AI</button>
              <span id="mm-icon-filename" class="file-name-text">No file chosen</span>
              <input id="mm-icon" type="file" accept="image/png" style="display:none;" />
            </div>
            <div id="mm-icon-preview" style="display:none;margin-top:6px;">
              <p style="font-size:0.75rem;color:#5a6280;margin:0 0 4px;">Current icon:</p>
              <img id="mm-icon-img" src="" alt="icon"
                style="height:48px;width:48px;object-fit:contain;border-radius:0.375rem;border:1px solid #1e2232;image-rendering:pixelated;" />
            </div>
            <div id="mm-loot-section" style="display:none;margin-top:1rem;padding-top:1rem;border-top:1px solid #1a1e2e;">
              <p style="font-size:0.7rem;font-weight:700;color:#404666;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 0.625rem;">Loot Table</p>
              <p id="mm-loot-error" class="error" style="display:none"></p>
              <div id="mm-loot-list"></div>
              <div class="loot-add-row" id="mm-loot-add-row">
                <div class="loot-field loot-field--item">
                  <label>Item</label>
                  <select id="mm-loot-item">
                    <option value="">— select item —</option>
                  </select>
                </div>
                <div class="loot-field loot-field--num">
                  <label>Chance %</label>
                  <input id="mm-loot-chance" type="number" min="1" max="100" value="25" />
                </div>
                <div class="loot-field loot-field--num">
                  <label>Qty</label>
                  <input id="mm-loot-qty" type="number" min="1" value="1" />
                </div>
                <button class="btn btn--secondary" id="mm-loot-add-btn" style="flex-shrink:0;white-space:nowrap;">Add</button>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn" id="mm-cancel-btn" style="display:none">Cancel</button>
              <button class="btn btn--primary" id="mm-save-btn">Add Monster</button>
            </div>
          </div>
        </div>

        <div class="monster-list-col">
          <div id="mm-list-wrap">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#mm-save-btn')!.addEventListener('click', () => {
      void this.handleSave();
    });
    this.container.querySelector('#mm-cancel-btn')!.addEventListener('click', () => {
      this.cancelEdit();
    });
    this.container.querySelector('#mm-loot-add-btn')!.addEventListener('click', () => {
      void this.handleAddLoot();
    });
    const iconInput = this.container.querySelector<HTMLInputElement>('#mm-icon')!;
    this.container.querySelector('#mm-choose-btn')!.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = this.container.querySelector<HTMLElement>('#mm-icon-filename')!;
      nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        const preview = this.container.querySelector<HTMLElement>('#mm-icon-preview')!;
        const img = this.container.querySelector<HTMLImageElement>('#mm-icon-img')!;
        img.src = URL.createObjectURL(file);
        preview.style.display = '';
        this.acceptedBase64 = null;
      }
    });

    this.container.querySelector('#mm-ai-gen-btn')!.addEventListener('click', () => {
      void this.handleAiGen();
    });
    const nameInput = this.container.querySelector<HTMLInputElement>('#mm-name')!;
    nameInput.addEventListener('input', () => {
      const aiBtn = this.container.querySelector<HTMLButtonElement>('#mm-ai-gen-btn')!;
      aiBtn.disabled = !nameInput.value.trim();
    });
  }

  // ── List ────────────────────────────────────────────────────────────────

  private renderList(): void {
    const wrap = this.container.querySelector<HTMLElement>('#mm-list-wrap')!;
    if (this.monsters.length === 0) {
      wrap.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No monsters yet. Create one using the form.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'monster-grid';

    for (const m of this.monsters) {
      grid.appendChild(this.buildMonsterCard(m));
    }

    wrap.innerHTML = '';
    wrap.appendChild(grid);
  }

  private buildMonsterCard(m: MonsterResponse): HTMLElement {
    const card = document.createElement('div');
    card.className = `monster-card${m.id === this.expandedMonsterId ? ' monster-card--active' : ''}`;
    card.dataset['id'] = String(m.id);

    const iconContent = m.icon_url
      ? `<img src="${m.icon_url}" alt="${this.esc(m.name)}" />`
      : `<span class="monster-card-icon-placeholder">⚔</span>`;

    card.innerHTML = `
      <div class="monster-card-header">
        <div class="monster-card-icon">${iconContent}</div>
        <div class="monster-card-info">
          <div class="monster-card-name">${this.esc(m.name)}</div>
          <div class="monster-stats-row">
            <span class="stat-chip stat-chip--atk">ATK ${m.attack}</span>
            <span class="stat-chip stat-chip--def">DEF ${m.defense}</span>
            <span class="stat-chip stat-chip--hp">HP ${m.hp}</span>
            <span class="stat-chip stat-chip--xp">XP ${m.xp_reward}</span>
            <span class="stat-chip stat-chip--cr">CR ${m.min_crowns}–${m.max_crowns}</span>
          </div>
        </div>
        <div class="monster-card-actions">
          <button class="btn btn--sm btn--edit" data-id="${m.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn--delete" data-id="${m.id}">Delete</button>
        </div>
      </div>
      <div class="monster-loot-section" id="loot-section-${m.id}" style="display:none"></div>
    `;

    card.querySelector<HTMLElement>('.monster-card-header')!.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      void this.toggleLoot(m.id, card);
    });

    card.querySelector<HTMLButtonElement>('.btn--edit')!.addEventListener('click', () => {
      void this.startEdit(m);
    });

    card.querySelector<HTMLButtonElement>('.btn--delete')!.addEventListener('click', () => {
      void this.handleDelete(m.id);
    });

    return card;
  }

  // ── Loot expand (in card) ────────────────────────────────────────────────

  private async toggleLoot(monsterId: number, card: HTMLElement): Promise<void> {
    const section = card.querySelector<HTMLElement>(`#loot-section-${monsterId}`)!;
    const isOpen = section.style.display !== 'none';

    // Collapse any other open card
    if (this.expandedMonsterId !== null && this.expandedMonsterId !== monsterId) {
      const prev = this.container.querySelector<HTMLElement>(`[data-id="${this.expandedMonsterId}"] .monster-loot-section`);
      if (prev) prev.style.display = 'none';
      this.container.querySelector<HTMLElement>(`[data-id="${this.expandedMonsterId}"]`)?.classList.remove('monster-card--active');
    }

    if (isOpen) {
      section.style.display = 'none';
      card.classList.remove('monster-card--active');
      this.expandedMonsterId = null;
      return;
    }

    this.expandedMonsterId = monsterId;
    card.classList.add('monster-card--active');
    section.style.display = '';
    section.innerHTML = '<p style="color:#3d4262;font-size:0.8rem;padding:0.25rem 0;">Loading loot...</p>';

    try {
      const full = await getMonster(monsterId);
      this.renderLootInCard(section, full.loot ?? [], monsterId);
    } catch {
      section.innerHTML = '<p class="error" style="padding:0.25rem 0;">Failed to load loot.</p>';
    }
  }

  private renderLootInCard(section: HTMLElement, loot: MonsterLootEntry[], monsterId: number): void {
    section.innerHTML = '<h4>Loot Table</h4>';

    if (loot.length === 0) {
      section.insertAdjacentHTML('beforeend', '<p style="color:#3d4262;font-size:0.8rem;margin-bottom:0.5rem;">No loot entries.</p>');
    } else {
      for (const l of loot) {
        const row = document.createElement('div');
        row.className = 'loot-entry-row';
        row.innerHTML = `
          <div class="loot-entry-icon">
            ${l.icon_url ? `<img src="${l.icon_url}" alt="" />` : ''}
          </div>
          <span class="loot-entry-name">${this.esc(l.item_name)}</span>
          <span class="loot-entry-meta">${l.drop_chance}% × ${l.quantity}</span>
          <button class="btn btn--sm btn--danger" data-loot-id="${l.id}" style="padding:0.15rem 0.45rem;">✕</button>
        `;
        row.querySelector('button')!.addEventListener('click', async () => {
          if (!confirm(`Remove "${l.item_name}" from loot?`)) return;
          try {
            await deleteMonsterLoot(monsterId, l.id);
            const full = await getMonster(monsterId);
            this.renderLootInCard(section, full.loot ?? [], monsterId);
          } catch (err) {
            alert(`Failed to remove loot: ${(err as Error).message}`);
          }
        });
        section.appendChild(row);
      }
    }

    // Add loot entry (card-level inline form)
    const addArea = document.createElement('div');
    addArea.className = 'loot-add-row';
    const itemOptions = this.items.map((i) => `<option value="${i.id}">${this.esc(i.name)}</option>`).join('');
    addArea.innerHTML = `
      <div class="loot-field loot-field--item">
        <label>Item</label>
        <select class="card-loot-item">
          <option value="">— select —</option>
          ${itemOptions}
        </select>
      </div>
      <div class="loot-field loot-field--num">
        <label>Chance %</label>
        <input class="card-loot-chance" type="number" min="1" max="100" value="25" />
      </div>
      <div class="loot-field loot-field--num">
        <label>Qty</label>
        <input class="card-loot-qty" type="number" min="1" value="1" />
      </div>
      <button class="btn btn--secondary card-loot-add-btn" style="flex-shrink:0;white-space:nowrap;">Add</button>
    `;
    addArea.querySelector<HTMLButtonElement>('.card-loot-add-btn')!.addEventListener('click', async () => {
      const itemSel = addArea.querySelector<HTMLSelectElement>('.card-loot-item')!;
      const chanceEl = addArea.querySelector<HTMLInputElement>('.card-loot-chance')!;
      const qtyEl = addArea.querySelector<HTMLInputElement>('.card-loot-qty')!;
      const itemDefId = parseInt(itemSel.value, 10);
      const dropChance = parseInt(chanceEl.value, 10);
      const quantity = parseInt(qtyEl.value, 10);
      if (isNaN(itemDefId) || itemDefId <= 0) { alert('Please select an item.'); return; }
      if (isNaN(dropChance) || dropChance < 1 || dropChance > 100) { alert('Drop chance must be 1–100.'); return; }
      if (isNaN(quantity) || quantity < 1) { alert('Quantity must be ≥ 1.'); return; }
      try {
        await addMonsterLoot(monsterId, { item_def_id: itemDefId, drop_chance: dropChance, quantity });
        const full = await getMonster(monsterId);
        this.renderLootInCard(section, full.loot ?? [], monsterId);
      } catch (err) {
        alert(`Failed to add loot: ${(err as Error).message}`);
      }
    });
    section.appendChild(addArea);
  }

  // ── Save / Edit / Delete ─────────────────────────────────────────────────

  private async handleSave(): Promise<void> {
    const errEl = this.container.querySelector<HTMLElement>('#mm-error')!;
    errEl.style.display = 'none';

    const name = (this.container.querySelector<HTMLInputElement>('#mm-name')?.value ?? '').trim();
    const attack = parseInt(this.container.querySelector<HTMLInputElement>('#mm-attack')?.value ?? '', 10);
    const defense = parseInt(this.container.querySelector<HTMLInputElement>('#mm-defense')?.value ?? '', 10);
    const hp = parseInt(this.container.querySelector<HTMLInputElement>('#mm-hp')?.value ?? '', 10);
    const xpReward = parseInt(this.container.querySelector<HTMLInputElement>('#mm-xp')?.value ?? '', 10);
    const minCrowns = parseInt(this.container.querySelector<HTMLInputElement>('#mm-min-crowns')?.value ?? '0', 10);
    const maxCrowns = parseInt(this.container.querySelector<HTMLInputElement>('#mm-max-crowns')?.value ?? '0', 10);
    const iconFile = this.container.querySelector<HTMLInputElement>('#mm-icon')?.files?.[0];

    if (!name) { this.showFormError('Name is required.'); return; }
    if (isNaN(attack) || attack < 0) { this.showFormError('Attack must be ≥ 0.'); return; }
    if (isNaN(defense) || defense < 0) { this.showFormError('Defense must be ≥ 0.'); return; }
    if (isNaN(hp) || hp < 1) { this.showFormError('HP must be ≥ 1.'); return; }
    if (isNaN(xpReward) || xpReward < 0) { this.showFormError('XP Reward must be ≥ 0.'); return; }
    if (isNaN(minCrowns) || minCrowns < 0) { this.showFormError('Min Crowns must be ≥ 0.'); return; }
    if (isNaN(maxCrowns) || maxCrowns < 0) { this.showFormError('Max Crowns must be ≥ 0.'); return; }
    if (minCrowns > maxCrowns) { this.showFormError('Min Crowns must be ≤ Max Crowns.'); return; }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('attack', String(attack));
    fd.append('defense', String(defense));
    fd.append('hp', String(hp));
    fd.append('xp_reward', String(xpReward));
    fd.append('min_crowns', String(minCrowns));
    fd.append('max_crowns', String(maxCrowns));
    if (iconFile) fd.append('icon', iconFile);
    if (!iconFile && this.acceptedBase64) {
      fd.append('icon_base64', this.acceptedBase64);
    }

    const saveBtn = this.container.querySelector<HTMLButtonElement>('#mm-save-btn')!;
    saveBtn.disabled = true;
    try {
      if (this.editingMonsterId !== null) {
        const updated = await updateMonster(this.editingMonsterId, fd);
        const idx = this.monsters.findIndex((m) => m.id === updated.id);
        if (idx >= 0) this.monsters[idx] = updated;
      } else {
        const created = await createMonster(fd);
        this.monsters.unshift(created);
      }
      this.cancelEdit();
      this.renderList();
    } catch (err) {
      this.showFormError((err as Error).message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  private async startEdit(m: MonsterResponse): Promise<void> {
    this.editingMonsterId = m.id;

    this.container.querySelector<HTMLElement>('#mm-form-title')!.textContent = `Edit: ${m.name}`;
    this.container.querySelector<HTMLElement>('#mm-save-btn')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#mm-cancel-btn')!.style.display = '';
    this.container.querySelector<HTMLElement>('#mm-error')!.style.display = 'none';

    (this.container.querySelector<HTMLInputElement>('#mm-name'))!.value = m.name;
    (this.container.querySelector<HTMLInputElement>('#mm-attack'))!.value = String(m.attack);
    (this.container.querySelector<HTMLInputElement>('#mm-defense'))!.value = String(m.defense);
    (this.container.querySelector<HTMLInputElement>('#mm-hp'))!.value = String(m.hp);
    (this.container.querySelector<HTMLInputElement>('#mm-xp'))!.value = String(m.xp_reward);
    (this.container.querySelector<HTMLInputElement>('#mm-min-crowns'))!.value = String(m.min_crowns ?? 0);
    (this.container.querySelector<HTMLInputElement>('#mm-max-crowns'))!.value = String(m.max_crowns ?? 0);
    (this.container.querySelector<HTMLInputElement>('#mm-icon'))!.value = '';

    const preview = this.container.querySelector<HTMLElement>('#mm-icon-preview')!;
    const img = this.container.querySelector<HTMLImageElement>('#mm-icon-img')!;
    if (m.icon_url) {
      img.src = m.icon_url;
      preview.style.display = '';
    } else {
      preview.style.display = 'none';
    }

    // Show loot section
    const lootSection = this.container.querySelector<HTMLElement>('#mm-loot-section')!;
    lootSection.style.display = '';
    this.renderFormLootSection(m.id);

    // Scroll form into view
    this.container.querySelector('.monster-form-col')!.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async renderFormLootSection(monsterId: number): Promise<void> {
    const lootList = this.container.querySelector<HTMLElement>('#mm-loot-list')!;
    const itemSel = this.container.querySelector<HTMLSelectElement>('#mm-loot-item')!;

    // Populate item dropdown if empty
    if (itemSel.options.length <= 1) {
      this.items.forEach((i) => {
        const opt = document.createElement('option');
        opt.value = String(i.id);
        opt.textContent = i.name;
        itemSel.appendChild(opt);
      });
    }

    lootList.innerHTML = '<p style="color:#3d4262;font-size:0.8rem;">Loading...</p>';
    try {
      const full = await getMonster(monsterId);
      const loot = full.loot ?? [];
      if (loot.length === 0) {
        lootList.innerHTML = '<p style="color:#3d4262;font-size:0.8rem;margin-bottom:0.5rem;">No loot entries yet.</p>';
      } else {
        lootList.innerHTML = '';
        for (const l of loot) {
          const row = document.createElement('div');
          row.className = 'loot-entry-row';
          row.innerHTML = `
            <div class="loot-entry-icon">
              ${l.icon_url ? `<img src="${l.icon_url}" alt="" />` : ''}
            </div>
            <span class="loot-entry-name">${this.esc(l.item_name)}</span>
            <span class="loot-entry-meta">${l.drop_chance}% × ${l.quantity}</span>
            <button class="btn btn--sm btn--danger" data-loot-id="${l.id}" style="padding:0.15rem 0.45rem;">✕</button>
          `;
          row.querySelector('button')!.addEventListener('click', async () => {
            if (!confirm(`Remove "${l.item_name}" from loot?`)) return;
            try {
              await deleteMonsterLoot(monsterId, l.id);
              this.renderFormLootSection(monsterId);
              this.refreshCardLoot(monsterId);
            } catch (err) {
              this.showLootError((err as Error).message);
            }
          });
          lootList.appendChild(row);
        }
      }
    } catch {
      lootList.innerHTML = '<p class="error" style="font-size:0.8rem;">Failed to load loot.</p>';
    }
  }

  private async handleAddLoot(): Promise<void> {
    if (this.editingMonsterId === null) return;
    const lootErrEl = this.container.querySelector<HTMLElement>('#mm-loot-error')!;
    lootErrEl.style.display = 'none';

    const itemSel = this.container.querySelector<HTMLSelectElement>('#mm-loot-item')!;
    const chanceEl = this.container.querySelector<HTMLInputElement>('#mm-loot-chance')!;
    const qtyEl = this.container.querySelector<HTMLInputElement>('#mm-loot-qty')!;

    const itemDefId = parseInt(itemSel.value, 10);
    const dropChance = parseInt(chanceEl.value, 10);
    const quantity = parseInt(qtyEl.value, 10);

    if (isNaN(itemDefId) || itemDefId <= 0) { this.showLootError('Please select an item.'); return; }
    if (isNaN(dropChance) || dropChance < 1 || dropChance > 100) { this.showLootError('Drop chance must be 1–100.'); return; }
    if (isNaN(quantity) || quantity < 1) { this.showLootError('Quantity must be ≥ 1.'); return; }

    try {
      await addMonsterLoot(this.editingMonsterId, { item_def_id: itemDefId, drop_chance: dropChance, quantity });
      itemSel.value = '';
      chanceEl.value = '25';
      qtyEl.value = '1';
      this.renderFormLootSection(this.editingMonsterId);
      this.refreshCardLoot(this.editingMonsterId);
    } catch (err) {
      this.showLootError((err as Error).message);
    }
  }

  private async handleAiGen(): Promise<void> {
    const name = (this.container.querySelector<HTMLInputElement>('#mm-name')?.value ?? '').trim();
    if (!name) return;
    const dialog = new ImageGenDialog();
    await dialog.open(name, (base64) => {
      this.acceptedBase64 = base64;
      const preview = this.container.querySelector<HTMLElement>('#mm-icon-preview')!;
      const img = this.container.querySelector<HTMLImageElement>('#mm-icon-img')!;
      img.src = `data:image/png;base64,${base64}`;
      preview.style.display = '';
      // Clear file input
      const iconInput = this.container.querySelector<HTMLInputElement>('#mm-icon')!;
      iconInput.value = '';
      const nameEl = this.container.querySelector<HTMLElement>('#mm-icon-filename');
      if (nameEl) nameEl.textContent = 'AI generated';
    });
  }

  private refreshCardLoot(monsterId: number): void {
    if (this.expandedMonsterId !== monsterId) return;
    const card = this.container.querySelector<HTMLElement>(`[data-id="${monsterId}"]`);
    const section = card?.querySelector<HTMLElement>(`#loot-section-${monsterId}`);
    if (!section || section.style.display === 'none') return;
    void getMonster(monsterId).then((full) => {
      this.renderLootInCard(section, full.loot ?? [], monsterId);
    });
  }

  private cancelEdit(): void {
    this.editingMonsterId = null;
    this.acceptedBase64 = null;

    this.container.querySelector<HTMLElement>('#mm-form-title')!.textContent = 'Add New Monster';
    this.container.querySelector<HTMLElement>('#mm-save-btn')!.textContent = 'Add Monster';
    this.container.querySelector<HTMLElement>('#mm-cancel-btn')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#mm-error')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#mm-icon-preview')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#mm-loot-section')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#mm-loot-list')!.innerHTML = '';
    this.container.querySelector<HTMLElement>('#mm-loot-error')!.style.display = 'none';

    (this.container.querySelector<HTMLInputElement>('#mm-name'))!.value = '';
    (this.container.querySelector<HTMLInputElement>('#mm-attack'))!.value = '5';
    (this.container.querySelector<HTMLInputElement>('#mm-defense'))!.value = '2';
    (this.container.querySelector<HTMLInputElement>('#mm-hp'))!.value = '20';
    (this.container.querySelector<HTMLInputElement>('#mm-xp'))!.value = '10';
    (this.container.querySelector<HTMLInputElement>('#mm-min-crowns'))!.value = '0';
    (this.container.querySelector<HTMLInputElement>('#mm-max-crowns'))!.value = '0';
    (this.container.querySelector<HTMLInputElement>('#mm-icon'))!.value = '';
    const nameEl = this.container.querySelector<HTMLElement>('#mm-icon-filename');
    if (nameEl) nameEl.textContent = 'No file chosen';
  }

  private async handleDelete(id: number): Promise<void> {
    const m = this.monsters.find((x) => x.id === id);
    if (!confirm(`Delete "${m?.name}"? This cannot be undone.`)) return;
    try {
      await deleteMonster(id);
      this.monsters = this.monsters.filter((x) => x.id !== id);
      if (this.editingMonsterId === id) this.cancelEdit();
      if (this.expandedMonsterId === id) this.expandedMonsterId = null;
      this.renderList();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#mm-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showLootError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#mm-loot-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showListError(msg: string): void {
    const wrap = this.container.querySelector<HTMLElement>('#mm-list-wrap');
    if (wrap) wrap.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
