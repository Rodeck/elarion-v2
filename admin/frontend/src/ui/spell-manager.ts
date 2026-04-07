import {
  listSpells,
  createSpell,
  updateSpell,
  deleteSpellApi,
  getSpellLevels,
  updateSpellLevels,
  updateSpellCosts,
  getItems,
  type SpellResponse,
  type SpellLevelRow,
  type SpellCostRow,
  type ItemDefinitionResponse,
} from '../editor/api';
import { ImageGenDialog } from './image-gen-dialog';

const EFFECT_TYPES = [
  'attack_pct', 'defence_pct', 'crit_chance_pct', 'crit_damage_pct',
  'heal', 'movement_speed', 'energy',
];

const EFFECT_LABELS: Record<string, string> = {
  attack_pct: 'Attack %',
  defence_pct: 'Defence %',
  crit_chance_pct: 'Crit Chance %',
  crit_damage_pct: 'Crit Damage %',
  heal: 'Heal',
  movement_speed: 'Move Speed',
  energy: 'Energy',
};

const EFFECT_TYPE_COLORS: Record<string, string> = {
  attack_pct: '#c0392b',
  defence_pct: '#2980b9',
  crit_chance_pct: '#e67e22',
  crit_damage_pct: '#d35400',
  heal: '#27ae60',
  movement_speed: '#1abc9c',
  energy: '#3498db',
};

export class SpellManager {
  private container!: HTMLElement;
  private spells: SpellResponse[] = [];
  private editingSpellId: number | null = null;
  private acceptedBase64: string | null = null;
  private allItems: ItemDefinitionResponse[] = [];

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      this.spells = await listSpells();
      this.renderList();
    } catch (err) {
      this.showListError(`Failed to load: ${(err as Error).message}`);
    }
  }

  // ── Skeleton ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="am-fullwidth">
        <div class="am-toolbar">
          <h2>Spells</h2>
          <button class="btn btn--primary" id="sm-add-btn">+ Add Spell</button>
        </div>
        <div id="sm-list-wrap">
          <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
        </div>
      </div>
    `;

    this.container.querySelector('#sm-add-btn')!.addEventListener('click', () => {
      this.openModal(null);
    });
  }

  // ── List ────────────────────────────────────────────────────────────────

  private renderList(): void {
    const wrap = this.container.querySelector<HTMLElement>('#sm-list-wrap')!;
    if (this.spells.length === 0) {
      wrap.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No spells yet. Click "+ Add Spell" to create one.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'monster-grid';

    for (const s of this.spells) {
      grid.appendChild(this.buildSpellCard(s));
    }

    wrap.innerHTML = '';
    wrap.appendChild(grid);
  }

  private buildSpellCard(s: SpellResponse): HTMLElement {
    const card = document.createElement('div');
    card.className = 'monster-card';
    card.dataset['id'] = String(s.id);

    const iconContent = s.icon_url
      ? `<img src="${s.icon_url}" alt="${this.esc(s.name)}" />`
      : `<span class="monster-card-icon-placeholder">✨</span>`;

    const effectColor = EFFECT_TYPE_COLORS[s.effect_type] ?? '#7f8c8d';

    card.innerHTML = `
      <div class="monster-card-header">
        <div class="monster-card-icon">${iconContent}</div>
        <div class="monster-card-info">
          <div class="monster-card-name">${this.esc(s.name)}</div>
          <div class="monster-stats-row">
            <span class="stat-chip" style="background:${effectColor}22;color:${effectColor};border:1px solid ${effectColor}44;">${EFFECT_LABELS[s.effect_type] ?? s.effect_type}</span>
            <span class="stat-chip stat-chip--xp">val ${s.effect_value}</span>
            <span class="stat-chip stat-chip--hp">${s.duration_seconds}s</span>
          </div>
          ${s.description ? `<div style="font-size:0.75rem;color:#5a6280;margin-top:2px;">${this.esc(s.description)}</div>` : ''}
        </div>
        <div class="monster-card-actions">
          <button class="btn btn--sm btn--edit" data-id="${s.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn--delete" data-id="${s.id}">Delete</button>
        </div>
      </div>
    `;

    card.querySelector<HTMLButtonElement>('.btn--edit')!.addEventListener('click', () => {
      this.openModal(s);
    });

    card.querySelector<HTMLButtonElement>('.btn--delete')!.addEventListener('click', () => {
      void this.handleDelete(s.id);
    });

    return card;
  }

  // ── Modal ──────────────────────────────────────────────────────────────

  private async openModal(spell: SpellResponse | null): Promise<void> {
    this.editingSpellId = spell?.id ?? null;
    this.acceptedBase64 = null;

    const isEdit = spell !== null;
    const title = isEdit ? `Edit: ${spell.name}` : 'Add New Spell';

    // Fetch level data + items if editing
    let levelData: SpellLevelRow[] = [];
    let costData: SpellCostRow[] = [];
    if (isEdit) {
      try {
        const result = await getSpellLevels(spell.id);
        levelData = result.levels;
        costData = result.costs;
      } catch {
        /* levels may not exist yet */
      }
    }

    // Load all items for the cost dropdown
    if (this.allItems.length === 0) {
      try {
        this.allItems = await getItems('resource');
        // Also fetch other stackable categories
        const food = await getItems('food');
        const heal = await getItems('heal');
        this.allItems = [...this.allItems, ...food, ...heal].sort((a, b) => a.name.localeCompare(b.name));
      } catch {
        /* items may fail to load */
      }
    }

    const overlay = document.createElement('div');
    overlay.className = 'am-modal-overlay';
    overlay.innerHTML = `
      <div class="am-modal" style="max-width:1220px;">
        <div class="am-modal-header">
          <h2>${this.esc(title)}</h2>
          <button class="am-modal-close" title="Close">&times;</button>
        </div>
        <div class="am-modal-body">
          <div class="am-modal-section">
            <h3>Details</h3>
            <p id="sm-error" class="error" style="display:none"></p>

            <label for="sm-name">Name *</label>
            <input id="sm-name" type="text" maxlength="64" placeholder="e.g. Haste" value="${isEdit ? this.esc(spell.name) : ''}" />

            <label for="sm-description">Description</label>
            <textarea id="sm-description" rows="2" class="am-textarea" placeholder="What this spell does...">${isEdit ? this.esc(spell.description ?? '') : ''}</textarea>

            <div id="sm-effect-type-row" style="margin-top:0.75rem;">
              <label for="sm-effect-type">Effect Type *</label>
              <select id="sm-effect-type" ${isEdit ? 'disabled' : ''}>
                ${EFFECT_TYPES.map((t) => `<option value="${t}" ${isEdit && spell.effect_type === t ? 'selected' : ''}>${EFFECT_LABELS[t] ?? t}</option>`).join('')}
              </select>
              ${isEdit ? '<p class="am-note">Effect type cannot be changed after creation.</p>' : ''}
            </div>

            <label style="margin-top:0.75rem;display:block;">Icon (PNG, max 2 MB)</label>
            <div class="file-upload-row" style="margin-bottom:0.5rem;">
              <button type="button" class="btn btn--secondary" id="sm-choose-btn">Choose File</button>
              <button type="button" class="btn btn--secondary" id="sm-ai-gen-btn" ${!isEdit ? 'disabled' : ''}>Generate with AI</button>
              <span id="sm-icon-filename" class="file-name-text">No file chosen</span>
              <input id="sm-icon" type="file" accept="image/png" style="display:none;" />
            </div>
            <div id="sm-icon-preview" style="${isEdit && spell.icon_url ? '' : 'display:none;'}margin-top:6px;">
              <p style="font-size:0.75rem;color:#5a6280;margin:0 0 4px;">Current icon:</p>
              <img id="sm-icon-img" src="${isEdit && spell.icon_url ? spell.icon_url : ''}" alt="icon"
                style="height:48px;width:48px;object-fit:contain;border-radius:0.375rem;border:1px solid #1e2232;image-rendering:pixelated;" />
            </div>
          </div>

          <div class="am-modal-section">
            <h3>Level Stats</h3>
            <p class="am-note">Configure how stats scale at each spell level (1-5). Gold cost is deducted when casting.</p>
            <table class="am-level-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Effect Value</th>
                  <th>Duration (s)</th>
                  <th>Gold Cost</th>
                </tr>
              </thead>
              <tbody>
                ${this.buildLevelRows(spell, levelData)}
              </tbody>
            </table>
          </div>

          <div class="am-modal-section">
            <h3>Item Costs per Level</h3>
            <p class="am-note">Items consumed when casting at each level. Multiple items per level supported.</p>
            <div id="sm-costs-container">
              ${this.buildCostSections(costData)}
            </div>
          </div>
        </div>
        <div class="am-modal-footer">
          <button class="btn" id="sm-cancel-btn">Cancel</button>
          <button class="btn btn--primary" id="sm-save-btn">${isEdit ? 'Save Changes' : 'Add Spell'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire level input cascade
    this.wireLevelCascade(overlay);

    // Wire cost add/remove buttons
    this.wireCostButtons(overlay);

    // Wire events
    overlay.querySelector('.am-modal-close')!.addEventListener('click', () => this.closeModal(overlay));
    overlay.querySelector('#sm-cancel-btn')!.addEventListener('click', () => this.closeModal(overlay));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal(overlay);
    });

    overlay.querySelector('#sm-save-btn')!.addEventListener('click', () => {
      void this.handleModalSave(overlay);
    });

    // Icon file chooser
    const iconInput = overlay.querySelector<HTMLInputElement>('#sm-icon')!;
    overlay.querySelector('#sm-choose-btn')!.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = overlay.querySelector<HTMLElement>('#sm-icon-filename')!;
      nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        this.acceptedBase64 = null;
        const preview = overlay.querySelector<HTMLElement>('#sm-icon-preview')!;
        const img = overlay.querySelector<HTMLImageElement>('#sm-icon-img')!;
        img.src = URL.createObjectURL(file);
        preview.style.display = '';
      }
    });

    // AI gen button
    const aiGenBtn = overlay.querySelector<HTMLButtonElement>('#sm-ai-gen-btn')!;
    const nameInput = overlay.querySelector<HTMLInputElement>('#sm-name')!;
    const updateAiBtn = () => { aiGenBtn.disabled = !nameInput.value.trim(); };
    nameInput.addEventListener('input', updateAiBtn);
    updateAiBtn();

    aiGenBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const dialog = new ImageGenDialog();
      await dialog.open(name, (base64) => {
        this.acceptedBase64 = base64;
        const preview = overlay.querySelector<HTMLElement>('#sm-icon-preview')!;
        const img = overlay.querySelector<HTMLImageElement>('#sm-icon-img')!;
        img.src = `data:image/png;base64,${base64}`;
        preview.style.display = '';
        const fnEl = overlay.querySelector<HTMLElement>('#sm-icon-filename');
        if (fnEl) fnEl.textContent = 'AI generated';
        iconInput.value = '';
      });
    });
  }

  private buildLevelRows(spell: SpellResponse | null, levelData: SpellLevelRow[]): string {
    const rows: string[] = [];
    const definedLevels = new Set(levelData.map((l) => l.level));
    let prevEv = 0, prevDur = 0, prevGold = 0;

    if (spell) {
      prevEv = spell.effect_value;
      prevDur = spell.duration_seconds;
    }

    for (let lvl = 1; lvl <= 5; lvl++) {
      const existing = levelData.find((l) => l.level === lvl);
      const ev = existing?.effect_value ?? prevEv;
      const dur = existing?.duration_seconds ?? prevDur;
      const gold = existing?.gold_cost ?? prevGold;
      const touched = definedLevels.has(lvl) || lvl === 1 ? 'true' : 'false';

      prevEv = ev;
      prevDur = dur;
      prevGold = gold;

      rows.push(`
        <tr>
          <td class="am-level-num">${lvl}</td>
          <td><input type="number" min="0" class="sm-lvl-input" data-lvl="${lvl}" data-field="effect_value" data-touched="${touched}" value="${ev}" /></td>
          <td><input type="number" min="0" class="sm-lvl-input" data-lvl="${lvl}" data-field="duration_seconds" data-touched="${touched}" value="${dur}" /></td>
          <td><input type="number" min="0" class="sm-lvl-input" data-lvl="${lvl}" data-field="gold_cost" data-touched="${touched}" value="${gold}" /></td>
        </tr>
      `);
    }
    return rows.join('');
  }

  private wireLevelCascade(overlay: HTMLElement): void {
    overlay.querySelectorAll<HTMLInputElement>('.sm-lvl-input').forEach((input) => {
      input.addEventListener('input', () => {
        input.dataset['touched'] = 'true';
        const changedLvl = parseInt(input.dataset['lvl']!, 10);
        const field = input.dataset['field']!;
        const newVal = input.value;

        for (let nextLvl = changedLvl + 1; nextLvl <= 5; nextLvl++) {
          const target = overlay.querySelector<HTMLInputElement>(
            `.sm-lvl-input[data-lvl="${nextLvl}"][data-field="${field}"]`,
          );
          if (!target) continue;
          if (target.dataset['touched'] === 'true') break;
          target.value = newVal;
        }
      });
    });
  }

  private buildCostSections(costData: SpellCostRow[]): string {
    const sections: string[] = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
      const costsForLevel = costData.filter(c => c.level === lvl);
      sections.push(`
        <div class="sm-cost-level" data-level="${lvl}" style="margin-bottom:0.75rem;padding:0.5rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem;">
            <span style="font-size:0.8rem;font-weight:600;color:#8a93b8;">Level ${lvl}</span>
            <button type="button" class="btn btn--sm btn--secondary sm-add-cost-btn" data-level="${lvl}" style="font-size:0.7rem;padding:2px 8px;">+ Add Item</button>
          </div>
          <div class="sm-cost-rows" data-level="${lvl}">
            ${costsForLevel.map(c => this.buildCostRowHtml(lvl, c.item_def_id, c.quantity, c.item_name)).join('')}
            ${costsForLevel.length === 0 ? '<p class="sm-cost-empty" style="font-size:0.75rem;color:#4a5270;margin:0;">No item costs</p>' : ''}
          </div>
        </div>
      `);
    }
    return sections.join('');
  }

  private buildCostRowHtml(level: number, itemDefId?: number, quantity?: number, itemName?: string): string {
    const options = this.allItems.map(item =>
      `<option value="${item.id}" ${item.id === itemDefId ? 'selected' : ''}>${this.esc(item.name)}</option>`
    ).join('');

    return `
      <div class="sm-cost-row" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:4px;">
        <select class="sm-cost-item" data-level="${level}" style="flex:1;min-width:120px;">
          <option value="">-- Select Item --</option>
          ${options}
        </select>
        <input type="number" class="sm-cost-qty" data-level="${level}" min="1" value="${quantity ?? 1}" style="width:60px;" placeholder="Qty" />
        <button type="button" class="btn btn--sm btn--danger sm-remove-cost-btn" style="font-size:0.7rem;padding:2px 6px;">&times;</button>
      </div>
    `;
  }

  private wireCostButtons(overlay: HTMLElement): void {
    // Add item buttons
    overlay.querySelectorAll<HTMLButtonElement>('.sm-add-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const level = parseInt(btn.dataset['level']!, 10);
        this.addCostRow(overlay, level);
      });
    });

    // Remove item buttons (for pre-existing rows)
    overlay.querySelectorAll<HTMLButtonElement>('.sm-remove-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.sm-cost-row')!;
        const container = row.parentElement!;
        row.remove();
        if (container.querySelectorAll('.sm-cost-row').length === 0) {
          container.innerHTML = '<p class="sm-cost-empty" style="font-size:0.75rem;color:#4a5270;margin:0;">No item costs</p>';
        }
      });
    });

    // Wire change listeners on pre-existing cost rows for cascade
    overlay.querySelectorAll<HTMLElement>('.sm-cost-row').forEach(row => {
      this.wireCostRowCascade(overlay, row);
    });

    // Mark levels that already have costs as touched
    for (let lvl = 1; lvl <= 5; lvl++) {
      const container = overlay.querySelector<HTMLElement>(`.sm-cost-rows[data-level="${lvl}"]`);
      if (container && container.querySelectorAll('.sm-cost-row').length > 0) {
        container.dataset['touched'] = 'true';
      }
    }
  }

  private wireCostRowCascade(overlay: HTMLElement, row: HTMLElement): void {
    const itemSelect = row.querySelector<HTMLSelectElement>('.sm-cost-item');
    const qtyInput = row.querySelector<HTMLInputElement>('.sm-cost-qty');
    const onChange = () => {
      const level = parseInt(itemSelect?.dataset['level'] ?? '0', 10);
      if (level > 0) {
        const container = overlay.querySelector<HTMLElement>(`.sm-cost-rows[data-level="${level}"]`);
        if (container) container.dataset['touched'] = 'true';
        this.cascadeCosts(overlay, level);
      }
    };
    itemSelect?.addEventListener('change', onChange);
    qtyInput?.addEventListener('input', onChange);
  }

  /** Propagate costs from the given level to subsequent untouched levels. */
  private cascadeCosts(overlay: HTMLElement, fromLevel: number): void {
    const sourceCosts = this.getCostsForLevel(overlay, fromLevel);

    for (let nextLvl = fromLevel + 1; nextLvl <= 5; nextLvl++) {
      const container = overlay.querySelector<HTMLElement>(`.sm-cost-rows[data-level="${nextLvl}"]`);
      if (!container) continue;
      if (container.dataset['touched'] === 'true') break; // stop at first manually edited level

      // Clear and rebuild with source costs
      container.innerHTML = '';
      if (sourceCosts.length === 0) {
        container.innerHTML = '<p class="sm-cost-empty" style="font-size:0.75rem;color:#4a5270;margin:0;">No item costs</p>';
      } else {
        for (const cost of sourceCosts) {
          const temp = document.createElement('div');
          temp.innerHTML = this.buildCostRowHtml(nextLvl, cost.item_def_id, cost.quantity);
          const row = temp.firstElementChild as HTMLElement;
          this.wireRemoveCostBtn(overlay, row, container);
          this.wireCostRowCascade(overlay, row);
          container.appendChild(row);
        }
      }
    }
  }

  private getCostsForLevel(overlay: HTMLElement, level: number): Array<{ item_def_id: number; quantity: number }> {
    const items: Array<{ item_def_id: number; quantity: number }> = [];
    const rows = overlay.querySelectorAll<HTMLElement>(`.sm-cost-rows[data-level="${level}"] .sm-cost-row`);
    for (const row of rows) {
      const itemSelect = row.querySelector<HTMLSelectElement>('.sm-cost-item');
      const qtyInput = row.querySelector<HTMLInputElement>('.sm-cost-qty');
      const itemDefId = parseInt(itemSelect?.value ?? '0', 10);
      const qty = parseInt(qtyInput?.value ?? '0', 10);
      if (itemDefId > 0 && qty > 0) {
        items.push({ item_def_id: itemDefId, quantity: qty });
      }
    }
    return items;
  }

  private wireRemoveCostBtn(overlay: HTMLElement, row: HTMLElement, container: HTMLElement): void {
    row.querySelector<HTMLButtonElement>('.sm-remove-cost-btn')!.addEventListener('click', () => {
      const level = parseInt(row.querySelector<HTMLSelectElement>('.sm-cost-item')?.dataset['level'] ?? '0', 10);
      row.remove();
      if (container.querySelectorAll('.sm-cost-row').length === 0) {
        container.innerHTML = '<p class="sm-cost-empty" style="font-size:0.75rem;color:#4a5270;margin:0;">No item costs</p>';
      }
      container.dataset['touched'] = 'true';
      if (level > 0) this.cascadeCosts(overlay, level);
    });
  }

  private addCostRow(overlay: HTMLElement, level: number): void {
    const container = overlay.querySelector<HTMLElement>(`.sm-cost-rows[data-level="${level}"]`)!;
    const empty = container.querySelector('.sm-cost-empty');
    if (empty) empty.remove();

    const temp = document.createElement('div');
    temp.innerHTML = this.buildCostRowHtml(level);
    const row = temp.firstElementChild as HTMLElement;

    this.wireRemoveCostBtn(overlay, row, container);
    this.wireCostRowCascade(overlay, row);
    container.appendChild(row);

    // Mark this level as touched and cascade
    container.dataset['touched'] = 'true';
  }

  private gatherCosts(overlay: HTMLElement): Map<number, Array<{ item_def_id: number; quantity: number }>> {
    const costsByLevel = new Map<number, Array<{ item_def_id: number; quantity: number }>>();
    for (let lvl = 1; lvl <= 5; lvl++) {
      const rows = overlay.querySelectorAll<HTMLElement>(`.sm-cost-row`);
      const items: Array<{ item_def_id: number; quantity: number }> = [];
      for (const row of rows) {
        const itemSelect = row.querySelector<HTMLSelectElement>('.sm-cost-item');
        const qtyInput = row.querySelector<HTMLInputElement>('.sm-cost-qty');
        if (!itemSelect || !qtyInput) continue;
        const rowLevel = parseInt(itemSelect.dataset['level']!, 10);
        if (rowLevel !== lvl) continue;
        const itemDefId = parseInt(itemSelect.value, 10);
        const qty = parseInt(qtyInput.value, 10);
        if (itemDefId > 0 && qty > 0) {
          items.push({ item_def_id: itemDefId, quantity: qty });
        }
      }
      costsByLevel.set(lvl, items);
    }
    return costsByLevel;
  }

  private closeModal(overlay: HTMLElement): void {
    this.editingSpellId = null;
    this.acceptedBase64 = null;
    overlay.remove();
  }

  // ── Modal Save ──────────────────────────────────────────────────────────

  private async handleModalSave(overlay: HTMLElement): Promise<void> {
    const errEl = overlay.querySelector<HTMLElement>('#sm-error')!;
    errEl.style.display = 'none';

    const showError = (msg: string) => {
      errEl.textContent = msg;
      errEl.style.display = '';
    };

    const name = (overlay.querySelector<HTMLInputElement>('#sm-name')?.value ?? '').trim();
    const description = (overlay.querySelector<HTMLTextAreaElement>('#sm-description')?.value ?? '').trim();
    const effectType = overlay.querySelector<HTMLSelectElement>('#sm-effect-type')?.value ?? '';
    const iconFile = overlay.querySelector<HTMLInputElement>('#sm-icon')?.files?.[0];

    if (!name) { showError('Name is required.'); return; }

    // Gather level stats
    const levels: SpellLevelRow[] = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
      const ev = parseInt(overlay.querySelector<HTMLInputElement>(`.sm-lvl-input[data-lvl="${lvl}"][data-field="effect_value"]`)?.value ?? '0', 10);
      const dur = parseInt(overlay.querySelector<HTMLInputElement>(`.sm-lvl-input[data-lvl="${lvl}"][data-field="duration_seconds"]`)?.value ?? '0', 10);
      const gold = parseInt(overlay.querySelector<HTMLInputElement>(`.sm-lvl-input[data-lvl="${lvl}"][data-field="gold_cost"]`)?.value ?? '0', 10);

      if (isNaN(ev) || ev < 0 || isNaN(dur) || dur < 0 || isNaN(gold) || gold < 0) {
        showError(`Level ${lvl} stats must be non-negative integers.`);
        return;
      }

      levels.push({ level: lvl, effect_value: ev, duration_seconds: dur, gold_cost: gold });
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description);
    fd.append('effect_type', effectType);
    fd.append('effect_value', '0');
    fd.append('duration_seconds', '0');
    if (iconFile) {
      fd.append('icon', iconFile);
    } else if (this.acceptedBase64) {
      fd.append('icon_base64', this.acceptedBase64);
    }

    const saveBtn = overlay.querySelector<HTMLButtonElement>('#sm-save-btn')!;
    saveBtn.disabled = true;
    try {
      let savedSpell: SpellResponse;
      if (this.editingSpellId !== null) {
        savedSpell = await updateSpell(this.editingSpellId, fd);
        const idx = this.spells.findIndex((s) => s.id === savedSpell.id);
        if (idx >= 0) this.spells[idx] = savedSpell;
      } else {
        savedSpell = await createSpell(fd);
        this.spells.unshift(savedSpell);
      }

      // Save level stats
      await updateSpellLevels(savedSpell.id, levels);

      // Save item costs per level
      const costsByLevel = this.gatherCosts(overlay);
      for (const [lvl, items] of costsByLevel) {
        await updateSpellCosts(savedSpell.id, lvl, items);
      }

      this.closeModal(overlay);
      this.renderList();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  private async handleDelete(id: number): Promise<void> {
    const s = this.spells.find((x) => x.id === id);
    if (!confirm(`Delete "${s?.name}"? This cannot be undone.`)) return;
    try {
      await deleteSpellApi(id);
      this.spells = this.spells.filter((x) => x.id !== id);
      this.renderList();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private showListError(msg: string): void {
    const wrap = this.container.querySelector<HTMLElement>('#sm-list-wrap');
    if (wrap) wrap.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
