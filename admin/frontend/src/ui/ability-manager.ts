import {
  listAbilities,
  createAbility,
  updateAbility,
  deleteAbility,
  getAbilityLevels,
  updateAbilityLevels,
  type AbilityResponse,
  type AbilityLevelRow,
} from '../editor/api';
import { ImageGenDialog } from './image-gen-dialog';

const EFFECT_TYPES = ['damage', 'heal', 'buff', 'debuff', 'dot', 'reflect', 'drain'];
const SLOT_TYPES = ['auto', 'active', 'both'];

const EFFECT_TYPE_COLORS: Record<string, string> = {
  damage: '#c0392b',
  heal: '#27ae60',
  buff: '#d4a84b',
  debuff: '#8e44ad',
  dot: '#e67e22',
  reflect: '#2980b9',
  drain: '#1abc9c',
};

export class AbilityManager {
  private container!: HTMLElement;
  private abilities: AbilityResponse[] = [];
  private editingAbilityId: number | null = null;
  private acceptedBase64: string | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      this.abilities = await listAbilities();
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
          <h2>Abilities</h2>
          <button class="btn btn--primary" id="am-add-btn">+ Add Ability</button>
        </div>
        <div id="am-list-wrap">
          <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
        </div>
      </div>
    `;

    this.container.querySelector('#am-add-btn')!.addEventListener('click', () => {
      this.openModal(null);
    });
  }

  // ── List ────────────────────────────────────────────────────────────────

  private renderList(): void {
    const wrap = this.container.querySelector<HTMLElement>('#am-list-wrap')!;
    if (this.abilities.length === 0) {
      wrap.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No abilities yet. Click "Add Ability" to create one.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'monster-grid';

    for (const a of this.abilities) {
      grid.appendChild(this.buildAbilityCard(a));
    }

    wrap.innerHTML = '';
    wrap.appendChild(grid);
  }

  private buildAbilityCard(a: AbilityResponse): HTMLElement {
    const card = document.createElement('div');
    card.className = 'monster-card';
    card.dataset['id'] = String(a.id);

    const iconContent = a.icon_url
      ? `<img src="${a.icon_url}" alt="${this.esc(a.name)}" />`
      : `<span class="monster-card-icon-placeholder">✨</span>`;

    const effectColor = EFFECT_TYPE_COLORS[a.effect_type] ?? '#7f8c8d';

    card.innerHTML = `
      <div class="monster-card-header">
        <div class="monster-card-icon">${iconContent}</div>
        <div class="monster-card-info">
          <div class="monster-card-name">${this.esc(a.name)}</div>
          <div class="monster-stats-row">
            <span class="stat-chip" style="background:${effectColor}22;color:${effectColor};border:1px solid ${effectColor}44;">${a.effect_type}</span>
            <span class="stat-chip stat-chip--atk">${a.slot_type}</span>
            <span class="stat-chip stat-chip--hp">${a.mana_cost} MP</span>
            <span class="stat-chip stat-chip--xp">val ${a.effect_value}</span>
            ${a.cooldown_turns > 0 ? `<span class="stat-chip stat-chip--def">cd ${a.cooldown_turns}</span>` : ''}
          </div>
          ${a.description ? `<div style="font-size:0.75rem;color:#5a6280;margin-top:2px;">${this.esc(a.description)}</div>` : ''}
        </div>
        <div class="monster-card-actions">
          <button class="btn btn--sm btn--edit" data-id="${a.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn--delete" data-id="${a.id}">Delete</button>
        </div>
      </div>
    `;

    card.querySelector<HTMLButtonElement>('.btn--edit')!.addEventListener('click', () => {
      this.openModal(a);
    });

    card.querySelector<HTMLButtonElement>('.btn--delete')!.addEventListener('click', () => {
      void this.handleDelete(a.id);
    });

    return card;
  }

  // ── Modal ──────────────────────────────────────────────────────────────

  private async openModal(ability: AbilityResponse | null): Promise<void> {
    this.editingAbilityId = ability?.id ?? null;
    this.acceptedBase64 = null;

    const isEdit = ability !== null;
    const title = isEdit ? `Edit: ${ability.name}` : 'Add New Ability';

    // Fetch level data if editing
    let levelData: AbilityLevelRow[] = [];
    if (isEdit) {
      try {
        levelData = await getAbilityLevels(ability.id);
      } catch {
        /* levels may not exist yet */
      }
    }

    const overlay = document.createElement('div');
    overlay.className = 'am-modal-overlay';
    overlay.innerHTML = `
      <div class="am-modal">
        <div class="am-modal-header">
          <h2>${this.esc(title)}</h2>
          <button class="am-modal-close" title="Close">&times;</button>
        </div>
        <div class="am-modal-body">
          <div class="am-modal-section">
            <h3>Details</h3>
            <p id="am-error" class="error" style="display:none"></p>

            <label for="am-name">Name *</label>
            <input id="am-name" type="text" maxlength="64" placeholder="e.g. Fireball" value="${isEdit ? this.esc(ability.name) : ''}" />

            <label for="am-description">Description</label>
            <textarea id="am-description" rows="2" class="am-textarea" placeholder="What this ability does...">${isEdit ? this.esc(ability.description ?? '') : ''}</textarea>

            <div class="am-grid-2">
              <div>
                <label for="am-mana-cost">Mana Cost</label>
                <input id="am-mana-cost" type="number" min="0" value="${isEdit ? ability.mana_cost : 10}" />
              </div>
              <div>
                <label for="am-effect-value">Effect Value</label>
                <input id="am-effect-value" type="number" min="0" value="${isEdit ? ability.effect_value : 20}" />
              </div>
              <div>
                <label for="am-duration">Duration (turns)</label>
                <input id="am-duration" type="number" min="0" value="${isEdit ? ability.duration_turns : 0}" />
              </div>
              <div>
                <label for="am-cooldown">Cooldown (turns)</label>
                <input id="am-cooldown" type="number" min="0" value="${isEdit ? ability.cooldown_turns : 0}" />
              </div>
              <div>
                <label for="am-priority">Priority Default</label>
                <input id="am-priority" type="number" min="1" max="99" value="${isEdit ? ability.priority_default : 1}" />
              </div>
            </div>

            <div id="am-effect-type-row" style="margin-top:0.75rem;">
              <label for="am-effect-type">Effect Type *</label>
              <select id="am-effect-type" ${isEdit ? 'disabled' : ''}>
                ${EFFECT_TYPES.map((t) => `<option value="${t}" ${isEdit && ability.effect_type === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
              ${isEdit ? '<p class="am-note">Effect type cannot be changed after creation.</p>' : ''}
            </div>

            <div style="margin-top:0.75rem;">
              <label for="am-slot-type">Slot Type</label>
              <select id="am-slot-type">
                ${SLOT_TYPES.map((t) => `<option value="${t}" ${(isEdit ? ability.slot_type : 'both') === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>

            <label style="margin-top:0.75rem;display:block;">Icon (PNG, max 2 MB)</label>
            <div class="file-upload-row" style="margin-bottom:0.5rem;">
              <button type="button" class="btn btn--secondary" id="am-choose-btn">Choose File</button>
              <button type="button" class="btn btn--secondary" id="am-ai-gen-btn" ${!isEdit ? 'disabled' : ''}>Generate with AI</button>
              <span id="am-icon-filename" class="file-name-text">No file chosen</span>
              <input id="am-icon" type="file" accept="image/png" style="display:none;" />
            </div>
            <div id="am-icon-preview" style="${isEdit && ability.icon_url ? '' : 'display:none;'}margin-top:6px;">
              <p style="font-size:0.75rem;color:#5a6280;margin:0 0 4px;">Current icon:</p>
              <img id="am-icon-img" src="${isEdit && ability.icon_url ? ability.icon_url : ''}" alt="icon"
                style="height:48px;width:48px;object-fit:contain;border-radius:0.375rem;border:1px solid #1e2232;image-rendering:pixelated;" />
            </div>
          </div>

          <div class="am-modal-section">
            <h3>Level Stats</h3>
            <p class="am-note">Configure how stats scale at each ability level (1-5).</p>
            <table class="am-level-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Effect Value</th>
                  <th>Mana Cost</th>
                  <th>Duration</th>
                  <th>Cooldown</th>
                </tr>
              </thead>
              <tbody>
                ${this.buildLevelRows(ability, levelData)}
              </tbody>
            </table>
          </div>
        </div>
        <div class="am-modal-footer">
          <button class="btn" id="am-cancel-btn">Cancel</button>
          <button class="btn btn--primary" id="am-save-btn">${isEdit ? 'Save Changes' : 'Add Ability'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire level input cascade (typing in level N updates untouched levels N+1..5)
    this.wireLevelCascade(overlay);

    // Wire events
    overlay.querySelector('.am-modal-close')!.addEventListener('click', () => this.closeModal(overlay));
    overlay.querySelector('#am-cancel-btn')!.addEventListener('click', () => this.closeModal(overlay));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal(overlay);
    });

    overlay.querySelector('#am-save-btn')!.addEventListener('click', () => {
      void this.handleModalSave(overlay);
    });

    // Icon file chooser
    const iconInput = overlay.querySelector<HTMLInputElement>('#am-icon')!;
    overlay.querySelector('#am-choose-btn')!.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = overlay.querySelector<HTMLElement>('#am-icon-filename')!;
      nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        this.acceptedBase64 = null;
        const preview = overlay.querySelector<HTMLElement>('#am-icon-preview')!;
        const img = overlay.querySelector<HTMLImageElement>('#am-icon-img')!;
        img.src = URL.createObjectURL(file);
        preview.style.display = '';
      }
    });

    // AI gen button
    const aiGenBtn = overlay.querySelector<HTMLButtonElement>('#am-ai-gen-btn')!;
    const nameInput = overlay.querySelector<HTMLInputElement>('#am-name')!;
    const updateAiBtn = () => { aiGenBtn.disabled = !nameInput.value.trim(); };
    nameInput.addEventListener('input', updateAiBtn);
    updateAiBtn();

    aiGenBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const dialog = new ImageGenDialog();
      await dialog.open(name, (base64) => {
        this.acceptedBase64 = base64;
        const preview = overlay.querySelector<HTMLElement>('#am-icon-preview')!;
        const img = overlay.querySelector<HTMLImageElement>('#am-icon-img')!;
        img.src = `data:image/png;base64,${base64}`;
        preview.style.display = '';
        const fnEl = overlay.querySelector<HTMLElement>('#am-icon-filename');
        if (fnEl) fnEl.textContent = 'AI generated';
        iconInput.value = '';
      });
    });
  }

  private buildLevelRows(ability: AbilityResponse | null, levelData: AbilityLevelRow[]): string {
    const rows: string[] = [];
    const definedLevels = new Set(levelData.map((l) => l.level));
    let prevEv = 0, prevMc = 0, prevDur = 0, prevCd = 0;

    // Seed previous values from base ability stats (used for level 1 fallback)
    if (ability) {
      prevEv = ability.effect_value;
      prevMc = ability.mana_cost;
      prevDur = ability.duration_turns;
      prevCd = ability.cooldown_turns;
    }

    for (let lvl = 1; lvl <= 5; lvl++) {
      const existing = levelData.find((l) => l.level === lvl);
      const ev = existing?.effect_value ?? prevEv;
      const mc = existing?.mana_cost ?? prevMc;
      const dur = existing?.duration_turns ?? prevDur;
      const cd = existing?.cooldown_turns ?? prevCd;
      // "touched" means explicitly defined in DB or level 1 (always treated as defined)
      const touched = definedLevels.has(lvl) || lvl === 1 ? 'true' : 'false';

      prevEv = ev;
      prevMc = mc;
      prevDur = dur;
      prevCd = cd;

      rows.push(`
        <tr>
          <td class="am-level-num">${lvl}</td>
          <td><input type="number" min="0" class="am-lvl-input" data-lvl="${lvl}" data-field="effect_value" data-touched="${touched}" value="${ev}" /></td>
          <td><input type="number" min="0" class="am-lvl-input" data-lvl="${lvl}" data-field="mana_cost" data-touched="${touched}" value="${mc}" /></td>
          <td><input type="number" min="0" class="am-lvl-input" data-lvl="${lvl}" data-field="duration_turns" data-touched="${touched}" value="${dur}" /></td>
          <td><input type="number" min="0" class="am-lvl-input" data-lvl="${lvl}" data-field="cooldown_turns" data-touched="${touched}" value="${cd}" /></td>
        </tr>
      `);
    }
    return rows.join('');
  }

  /** When a level input changes, cascade the new value to all subsequent untouched levels for that field. */
  private wireLevelCascade(overlay: HTMLElement): void {
    overlay.querySelectorAll<HTMLInputElement>('.am-lvl-input').forEach((input) => {
      input.addEventListener('input', () => {
        // Mark this input as touched
        input.dataset['touched'] = 'true';
        const changedLvl = parseInt(input.dataset['lvl']!, 10);
        const field = input.dataset['field']!;
        const newVal = input.value;

        // Cascade forward to untouched levels
        for (let nextLvl = changedLvl + 1; nextLvl <= 5; nextLvl++) {
          const target = overlay.querySelector<HTMLInputElement>(
            `.am-lvl-input[data-lvl="${nextLvl}"][data-field="${field}"]`,
          );
          if (!target) continue;
          if (target.dataset['touched'] === 'true') break; // stop at first touched level
          target.value = newVal;
        }
      });
    });
  }

  private closeModal(overlay: HTMLElement): void {
    this.editingAbilityId = null;
    this.acceptedBase64 = null;
    overlay.remove();
  }

  // ── Modal Save ──────────────────────────────────────────────────────────

  private async handleModalSave(overlay: HTMLElement): Promise<void> {
    const errEl = overlay.querySelector<HTMLElement>('#am-error')!;
    errEl.style.display = 'none';

    const showError = (msg: string) => {
      errEl.textContent = msg;
      errEl.style.display = '';
    };

    const name = (overlay.querySelector<HTMLInputElement>('#am-name')?.value ?? '').trim();
    const description = (overlay.querySelector<HTMLTextAreaElement>('#am-description')?.value ?? '').trim();
    const effectType = overlay.querySelector<HTMLSelectElement>('#am-effect-type')?.value ?? '';
    const slotType = overlay.querySelector<HTMLSelectElement>('#am-slot-type')?.value ?? 'both';
    const manaCost = parseInt(overlay.querySelector<HTMLInputElement>('#am-mana-cost')?.value ?? '', 10);
    const effectValue = parseInt(overlay.querySelector<HTMLInputElement>('#am-effect-value')?.value ?? '', 10);
    const durationTurns = parseInt(overlay.querySelector<HTMLInputElement>('#am-duration')?.value ?? '0', 10);
    const cooldownTurns = parseInt(overlay.querySelector<HTMLInputElement>('#am-cooldown')?.value ?? '0', 10);
    const priorityDefault = parseInt(overlay.querySelector<HTMLInputElement>('#am-priority')?.value ?? '1', 10);
    const iconFile = overlay.querySelector<HTMLInputElement>('#am-icon')?.files?.[0];

    if (!name) { showError('Name is required.'); return; }
    if (isNaN(manaCost) || manaCost < 0) { showError('Mana cost must be >= 0.'); return; }
    if (isNaN(effectValue) || effectValue < 0) { showError('Effect value must be >= 0.'); return; }
    if (isNaN(durationTurns) || durationTurns < 0) { showError('Duration must be >= 0.'); return; }
    if (isNaN(cooldownTurns) || cooldownTurns < 0) { showError('Cooldown must be >= 0.'); return; }
    if (isNaN(priorityDefault) || priorityDefault < 1 || priorityDefault > 99) { showError('Priority must be 1-99.'); return; }

    // Gather level stats
    const levels: AbilityLevelRow[] = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
      const ev = parseInt(overlay.querySelector<HTMLInputElement>(`.am-lvl-input[data-lvl="${lvl}"][data-field="effect_value"]`)?.value ?? '0', 10);
      const mc = parseInt(overlay.querySelector<HTMLInputElement>(`.am-lvl-input[data-lvl="${lvl}"][data-field="mana_cost"]`)?.value ?? '0', 10);
      const dur = parseInt(overlay.querySelector<HTMLInputElement>(`.am-lvl-input[data-lvl="${lvl}"][data-field="duration_turns"]`)?.value ?? '0', 10);
      const cd = parseInt(overlay.querySelector<HTMLInputElement>(`.am-lvl-input[data-lvl="${lvl}"][data-field="cooldown_turns"]`)?.value ?? '0', 10);

      if (isNaN(ev) || ev < 0 || isNaN(mc) || mc < 0 || isNaN(dur) || dur < 0 || isNaN(cd) || cd < 0) {
        showError(`Level ${lvl} stats must be non-negative integers.`);
        return;
      }

      levels.push({ level: lvl, effect_value: ev, mana_cost: mc, duration_turns: dur, cooldown_turns: cd });
    }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description);
    fd.append('effect_type', effectType);
    fd.append('slot_type', slotType);
    fd.append('mana_cost', String(manaCost));
    fd.append('effect_value', String(effectValue));
    fd.append('duration_turns', String(durationTurns));
    fd.append('cooldown_turns', String(cooldownTurns));
    fd.append('priority_default', String(priorityDefault));
    if (iconFile) {
      fd.append('icon', iconFile);
    } else if (this.acceptedBase64) {
      fd.append('icon_base64', this.acceptedBase64);
    }

    const saveBtn = overlay.querySelector<HTMLButtonElement>('#am-save-btn')!;
    saveBtn.disabled = true;
    try {
      let savedAbility: AbilityResponse;
      if (this.editingAbilityId !== null) {
        savedAbility = await updateAbility(this.editingAbilityId, fd);
        const idx = this.abilities.findIndex((a) => a.id === savedAbility.id);
        if (idx >= 0) this.abilities[idx] = savedAbility;
      } else {
        savedAbility = await createAbility(fd);
        this.abilities.unshift(savedAbility);
      }

      // Save level stats
      await updateAbilityLevels(savedAbility.id, levels);

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
    const a = this.abilities.find((x) => x.id === id);
    if (!confirm(`Delete "${a?.name}"? This cannot be undone.`)) return;
    try {
      await deleteAbility(id);
      this.abilities = this.abilities.filter((x) => x.id !== id);
      this.renderList();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private showListError(msg: string): void {
    const wrap = this.container.querySelector<HTMLElement>('#am-list-wrap');
    if (wrap) wrap.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
