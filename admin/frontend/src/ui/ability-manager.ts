import {
  listAbilities,
  createAbility,
  updateAbility,
  deleteAbility,
  type AbilityResponse,
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
      <div class="monster-manager">
        <div class="monster-form-col">
          <h2>Abilities</h2>
          <div class="monster-form-card">
            <h3 id="am-form-title">Add New Ability</h3>
            <p id="am-error" class="error" style="display:none"></p>

            <label for="am-name">Name *</label>
            <input id="am-name" type="text" maxlength="64" placeholder="e.g. Fireball" />

            <label for="am-description">Description</label>
            <textarea id="am-description" rows="2" style="width:100%;resize:vertical;background:#0d1117;border:1px solid #1e2232;color:#9da3c8;padding:0.375rem 0.5rem;border-radius:0.25rem;font-size:0.875rem;" placeholder="What this ability does..."></textarea>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.5rem;">
              <div>
                <label for="am-mana-cost">Mana Cost</label>
                <input id="am-mana-cost" type="number" min="0" value="10" />
              </div>
              <div>
                <label for="am-effect-value">Effect Value</label>
                <input id="am-effect-value" type="number" min="0" value="20" />
              </div>
              <div>
                <label for="am-duration">Duration (turns)</label>
                <input id="am-duration" type="number" min="0" value="0" />
              </div>
              <div>
                <label for="am-cooldown">Cooldown (turns)</label>
                <input id="am-cooldown" type="number" min="0" value="0" />
              </div>
              <div>
                <label for="am-priority">Priority Default</label>
                <input id="am-priority" type="number" min="1" max="99" value="1" />
              </div>
            </div>

            <div id="am-effect-type-row" style="margin-top:0.75rem;">
              <label for="am-effect-type">Effect Type *</label>
              <select id="am-effect-type">
                ${EFFECT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>

            <div style="margin-top:0.75rem;">
              <label for="am-slot-type">Slot Type</label>
              <select id="am-slot-type">
                ${SLOT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>

            <label style="margin-top:0.75rem;display:block;">Icon (PNG, max 2 MB)</label>
            <div class="file-upload-row" style="margin-bottom:0.5rem;">
              <button type="button" class="btn btn--secondary" id="am-choose-btn">Choose File</button>
              <button type="button" class="btn btn--secondary" id="am-ai-gen-btn" disabled>Generate with AI</button>
              <span id="am-icon-filename" class="file-name-text">No file chosen</span>
              <input id="am-icon" type="file" accept="image/png" style="display:none;" />
            </div>
            <div id="am-icon-preview" style="display:none;margin-top:6px;">
              <p style="font-size:0.75rem;color:#5a6280;margin:0 0 4px;">Current icon:</p>
              <img id="am-icon-img" src="" alt="icon"
                style="height:48px;width:48px;object-fit:contain;border-radius:0.375rem;border:1px solid #1e2232;image-rendering:pixelated;" />
            </div>

            <div class="form-actions">
              <button class="btn" id="am-cancel-btn" style="display:none">Cancel</button>
              <button class="btn btn--primary" id="am-save-btn">Add Ability</button>
            </div>
          </div>
        </div>

        <div class="monster-list-col">
          <div id="am-list-wrap">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#am-save-btn')!.addEventListener('click', () => {
      void this.handleSave();
    });
    this.container.querySelector('#am-cancel-btn')!.addEventListener('click', () => {
      this.cancelEdit();
    });

    const iconInput = this.container.querySelector<HTMLInputElement>('#am-icon')!;
    this.container.querySelector('#am-choose-btn')!.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = this.container.querySelector<HTMLElement>('#am-icon-filename')!;
      nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        this.acceptedBase64 = null;
        const preview = this.container.querySelector<HTMLElement>('#am-icon-preview')!;
        const img = this.container.querySelector<HTMLImageElement>('#am-icon-img')!;
        img.src = URL.createObjectURL(file);
        preview.style.display = '';
      }
    });

    const aiGenBtn = this.container.querySelector<HTMLButtonElement>('#am-ai-gen-btn')!;
    const nameInput = this.container.querySelector<HTMLInputElement>('#am-name')!;

    const updateAiBtn = () => { aiGenBtn.disabled = !nameInput.value.trim(); };
    nameInput.addEventListener('input', updateAiBtn);
    updateAiBtn();

    aiGenBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const dialog = new ImageGenDialog();
      await dialog.open(name, (base64) => {
        this.acceptedBase64 = base64;
        const preview = this.container.querySelector<HTMLElement>('#am-icon-preview')!;
        const img = this.container.querySelector<HTMLImageElement>('#am-icon-img')!;
        img.src = `data:image/png;base64,${base64}`;
        preview.style.display = '';
        const nameEl = this.container.querySelector<HTMLElement>('#am-icon-filename');
        if (nameEl) nameEl.textContent = 'AI generated';
        iconInput.value = '';
      });
    });
  }

  // ── List ────────────────────────────────────────────────────────────────

  private renderList(): void {
    const wrap = this.container.querySelector<HTMLElement>('#am-list-wrap')!;
    if (this.abilities.length === 0) {
      wrap.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No abilities yet. Create one using the form.</p>';
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
      this.startEdit(a);
    });

    card.querySelector<HTMLButtonElement>('.btn--delete')!.addEventListener('click', () => {
      void this.handleDelete(a.id);
    });

    return card;
  }

  // ── Save / Edit / Delete ─────────────────────────────────────────────────

  private async handleSave(): Promise<void> {
    const errEl = this.container.querySelector<HTMLElement>('#am-error')!;
    errEl.style.display = 'none';

    const name = (this.container.querySelector<HTMLInputElement>('#am-name')?.value ?? '').trim();
    const description = (this.container.querySelector<HTMLTextAreaElement>('#am-description')?.value ?? '').trim();
    const effectType = this.container.querySelector<HTMLSelectElement>('#am-effect-type')?.value ?? '';
    const slotType = this.container.querySelector<HTMLSelectElement>('#am-slot-type')?.value ?? 'both';
    const manaCost = parseInt(this.container.querySelector<HTMLInputElement>('#am-mana-cost')?.value ?? '', 10);
    const effectValue = parseInt(this.container.querySelector<HTMLInputElement>('#am-effect-value')?.value ?? '', 10);
    const durationTurns = parseInt(this.container.querySelector<HTMLInputElement>('#am-duration')?.value ?? '0', 10);
    const cooldownTurns = parseInt(this.container.querySelector<HTMLInputElement>('#am-cooldown')?.value ?? '0', 10);
    const priorityDefault = parseInt(this.container.querySelector<HTMLInputElement>('#am-priority')?.value ?? '1', 10);
    const iconFile = this.container.querySelector<HTMLInputElement>('#am-icon')?.files?.[0];

    if (!name) { this.showFormError('Name is required.'); return; }
    if (isNaN(manaCost) || manaCost < 0) { this.showFormError('Mana cost must be ≥ 0.'); return; }
    if (isNaN(effectValue) || effectValue < 0) { this.showFormError('Effect value must be ≥ 0.'); return; }
    if (isNaN(durationTurns) || durationTurns < 0) { this.showFormError('Duration must be ≥ 0.'); return; }
    if (isNaN(cooldownTurns) || cooldownTurns < 0) { this.showFormError('Cooldown must be ≥ 0.'); return; }
    if (isNaN(priorityDefault) || priorityDefault < 1 || priorityDefault > 99) { this.showFormError('Priority must be 1–99.'); return; }

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

    const saveBtn = this.container.querySelector<HTMLButtonElement>('#am-save-btn')!;
    saveBtn.disabled = true;
    try {
      if (this.editingAbilityId !== null) {
        const updated = await updateAbility(this.editingAbilityId, fd);
        const idx = this.abilities.findIndex((a) => a.id === updated.id);
        if (idx >= 0) this.abilities[idx] = updated;
      } else {
        const created = await createAbility(fd);
        this.abilities.unshift(created);
      }
      this.cancelEdit();
      this.renderList();
    } catch (err) {
      this.showFormError((err as Error).message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  private startEdit(a: AbilityResponse): void {
    this.editingAbilityId = a.id;

    this.container.querySelector<HTMLElement>('#am-form-title')!.textContent = `Edit: ${a.name}`;
    this.container.querySelector<HTMLElement>('#am-save-btn')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#am-cancel-btn')!.style.display = '';
    this.container.querySelector<HTMLElement>('#am-error')!.style.display = 'none';

    (this.container.querySelector<HTMLInputElement>('#am-name'))!.value = a.name;
    const aiBtn = this.container.querySelector<HTMLButtonElement>('#am-ai-gen-btn');
    if (aiBtn) aiBtn.disabled = false;
    (this.container.querySelector<HTMLTextAreaElement>('#am-description'))!.value = a.description ?? '';
    (this.container.querySelector<HTMLInputElement>('#am-mana-cost'))!.value = String(a.mana_cost);
    (this.container.querySelector<HTMLInputElement>('#am-effect-value'))!.value = String(a.effect_value);
    (this.container.querySelector<HTMLInputElement>('#am-duration'))!.value = String(a.duration_turns);
    (this.container.querySelector<HTMLInputElement>('#am-cooldown'))!.value = String(a.cooldown_turns);
    (this.container.querySelector<HTMLInputElement>('#am-priority'))!.value = String(a.priority_default);
    (this.container.querySelector<HTMLSelectElement>('#am-slot-type'))!.value = a.slot_type;

    // effect_type is read-only when editing — show it as disabled
    const effectTypeEl = this.container.querySelector<HTMLSelectElement>('#am-effect-type')!;
    effectTypeEl.value = a.effect_type;
    effectTypeEl.disabled = true;
    const effectTypeRow = this.container.querySelector<HTMLElement>('#am-effect-type-row')!;
    let readonlyNote = effectTypeRow.querySelector<HTMLElement>('.effect-type-note');
    if (!readonlyNote) {
      readonlyNote = document.createElement('p');
      readonlyNote.className = 'effect-type-note';
      readonlyNote.style.cssText = 'font-size:0.7rem;color:#5a6280;margin:2px 0 0;';
      readonlyNote.textContent = 'Effect type cannot be changed after creation.';
      effectTypeRow.appendChild(readonlyNote);
    }
    readonlyNote.style.display = '';

    const preview = this.container.querySelector<HTMLElement>('#am-icon-preview')!;
    const img = this.container.querySelector<HTMLImageElement>('#am-icon-img')!;
    if (a.icon_url) {
      img.src = a.icon_url;
      preview.style.display = '';
    } else {
      preview.style.display = 'none';
    }

    this.container.querySelector('.monster-form-col')!.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private cancelEdit(): void {
    this.editingAbilityId = null;

    this.container.querySelector<HTMLElement>('#am-form-title')!.textContent = 'Add New Ability';
    this.container.querySelector<HTMLElement>('#am-save-btn')!.textContent = 'Add Ability';
    this.container.querySelector<HTMLElement>('#am-cancel-btn')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#am-error')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#am-icon-preview')!.style.display = 'none';

    // Re-enable effect_type select and hide note
    const effectTypeEl = this.container.querySelector<HTMLSelectElement>('#am-effect-type')!;
    effectTypeEl.disabled = false;
    const readonlyNote = this.container.querySelector<HTMLElement>('.effect-type-note');
    if (readonlyNote) readonlyNote.style.display = 'none';

    (this.container.querySelector<HTMLInputElement>('#am-name'))!.value = '';
    (this.container.querySelector<HTMLTextAreaElement>('#am-description'))!.value = '';
    (this.container.querySelector<HTMLInputElement>('#am-mana-cost'))!.value = '10';
    (this.container.querySelector<HTMLInputElement>('#am-effect-value'))!.value = '20';
    (this.container.querySelector<HTMLInputElement>('#am-duration'))!.value = '0';
    (this.container.querySelector<HTMLInputElement>('#am-cooldown'))!.value = '0';
    (this.container.querySelector<HTMLInputElement>('#am-priority'))!.value = '1';
    this.acceptedBase64 = null;
    (this.container.querySelector<HTMLInputElement>('#am-icon'))!.value = '';
    const nameEl = this.container.querySelector<HTMLElement>('#am-icon-filename');
    if (nameEl) nameEl.textContent = 'No file chosen';
    const aiBtn = this.container.querySelector<HTMLButtonElement>('#am-ai-gen-btn');
    if (aiBtn) aiBtn.disabled = true;
  }

  private async handleDelete(id: number): Promise<void> {
    const a = this.abilities.find((x) => x.id === id);
    if (!confirm(`Delete "${a?.name}"? This cannot be undone.`)) return;
    try {
      await deleteAbility(id);
      this.abilities = this.abilities.filter((x) => x.id !== id);
      if (this.editingAbilityId === id) this.cancelEdit();
      this.renderList();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#am-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showListError(msg: string): void {
    const wrap = this.container.querySelector<HTMLElement>('#am-list-wrap');
    if (wrap) wrap.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
