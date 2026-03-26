import {
  listSquireDefinitions,
  createSquireDefinition,
  updateSquireDefinition,
  deactivateSquireDefinition,
  uploadSquireIcon,
  type SquireDefinitionResponse,
} from '../editor/api';

export class SquireDefinitionManager {
  private container!: HTMLElement;
  private defs: SquireDefinitionResponse[] = [];
  private editingId: number | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      this.defs = await listSquireDefinitions();
      this.renderList();
    } catch (err) {
      this.showError(`Failed to load: ${(err as Error).message}`);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="monster-manager">
        <div class="monster-form-col">
          <h2>Squire Definitions</h2>
          <div class="monster-form-card">
            <h3 id="sd-form-title">Add New Squire</h3>
            <p id="sd-error" class="error" style="display:none"></p>
            <label for="sd-name">Name *</label>
            <input id="sd-name" type="text" maxlength="64" placeholder="e.g. Brand" />
            <label for="sd-power">Power Level (0-100)</label>
            <input id="sd-power" type="number" min="0" max="100" value="0" />
            <div class="form-actions">
              <button class="btn" id="sd-cancel-btn" style="display:none">Cancel</button>
              <button class="btn btn--primary" id="sd-save-btn">Add Squire</button>
            </div>
          </div>
        </div>
        <div class="monster-list-col">
          <div id="sd-list-wrap">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#sd-save-btn')!.addEventListener('click', () => {
      void this.handleSave();
    });
    this.container.querySelector('#sd-cancel-btn')!.addEventListener('click', () => {
      this.cancelEdit();
    });

    void this.load();
  }

  private renderList(): void {
    const wrap = this.container.querySelector('#sd-list-wrap')!;
    if (this.defs.length === 0) {
      wrap.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No squire definitions yet.</p>';
      return;
    }

    wrap.innerHTML = '';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    for (const def of this.defs) {
      wrap.appendChild(this.buildCard(def));
    }
  }

  private buildCard(def: SquireDefinitionResponse): HTMLElement {
    const card = document.createElement('div');
    card.className = 'monster-card';
    card.style.opacity = def.is_active ? '1' : '0.5';

    const iconHtml = def.icon_url
      ? `<img src="${def.icon_url}" style="width:40px;height:40px;border-radius:4px;image-rendering:pixelated;" />`
      : `<div style="width:40px;height:40px;background:#1e2232;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">⚔</div>`;

    card.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;">
        ${iconHtml}
        <div style="flex:1;">
          <strong>${def.name}</strong> <span style="font-size:0.7rem;color:#3d4262;">#${def.id}</span>
          <div style="font-size:0.75rem;color:#5a6280;">Power: ${def.power_level} | ${def.is_active ? 'Active' : 'Inactive'}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn--secondary sd-icon-btn" data-id="${def.id}" style="font-size:0.7rem;">Icon</button>
          <button class="btn btn--secondary sd-edit-btn" data-id="${def.id}" style="font-size:0.7rem;">Edit</button>
          ${def.is_active ? `<button class="btn btn--secondary sd-deactivate-btn" data-id="${def.id}" style="font-size:0.7rem;color:#c06050;">Deactivate</button>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.sd-edit-btn')?.addEventListener('click', () => this.startEdit(def));
    card.querySelector('.sd-deactivate-btn')?.addEventListener('click', () => void this.handleDeactivate(def.id));
    card.querySelector('.sd-icon-btn')?.addEventListener('click', () => this.promptIconUpload(def.id));

    return card;
  }

  private async handleSave(): Promise<void> {
    const nameInput = this.container.querySelector<HTMLInputElement>('#sd-name')!;
    const powerInput = this.container.querySelector<HTMLInputElement>('#sd-power')!;
    const name = nameInput.value.trim();
    const power_level = parseInt(powerInput.value, 10);

    if (!name) { this.showError('Name is required.'); return; }
    if (isNaN(power_level) || power_level < 0 || power_level > 100) { this.showError('Power level must be 0-100.'); return; }

    try {
      if (this.editingId) {
        await updateSquireDefinition(this.editingId, { name, power_level });
      } else {
        await createSquireDefinition({ name, power_level });
      }
      this.cancelEdit();
      await this.load();
    } catch (err) {
      this.showError((err as Error).message);
    }
  }

  private startEdit(def: SquireDefinitionResponse): void {
    this.editingId = def.id;
    (this.container.querySelector('#sd-name') as HTMLInputElement).value = def.name;
    (this.container.querySelector('#sd-power') as HTMLInputElement).value = String(def.power_level);
    this.container.querySelector<HTMLElement>('#sd-form-title')!.textContent = 'Edit Squire';
    this.container.querySelector<HTMLElement>('#sd-save-btn')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#sd-cancel-btn')!.style.display = '';
  }

  private cancelEdit(): void {
    this.editingId = null;
    (this.container.querySelector('#sd-name') as HTMLInputElement).value = '';
    (this.container.querySelector('#sd-power') as HTMLInputElement).value = '0';
    this.container.querySelector<HTMLElement>('#sd-form-title')!.textContent = 'Add New Squire';
    this.container.querySelector<HTMLElement>('#sd-save-btn')!.textContent = 'Add Squire';
    this.container.querySelector<HTMLElement>('#sd-cancel-btn')!.style.display = 'none';
    this.hideError();
  }

  private async handleDeactivate(id: number): Promise<void> {
    if (!confirm('Deactivate this squire definition? Players who own it will keep theirs, but no new drops will occur.')) return;
    try {
      await deactivateSquireDefinition(id);
      await this.load();
    } catch (err) {
      this.showError((err as Error).message);
    }
  }

  private promptIconUpload(defId: number): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await uploadSquireIcon(defId, file);
        await this.load();
      } catch (err) {
        this.showError((err as Error).message);
      }
    });
    input.click();
  }

  private showError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#sd-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private hideError(): void {
    const el = this.container.querySelector<HTMLElement>('#sd-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }
}
