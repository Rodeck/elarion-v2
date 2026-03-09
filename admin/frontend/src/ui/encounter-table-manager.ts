import {
  getEncounterTable,
  upsertEncounterEntry,
  deleteEncounterEntry,
  listMonsters,
  type EncounterEntry,
  type MonsterResponse,
} from '../editor/api';

export class EncounterTableManager {
  private container!: HTMLElement;
  private zoneId: number | null = null;
  private entries: EncounterEntry[] = [];
  private monsters: MonsterResponse[] = [];

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async initForZone(container: HTMLElement, zoneId: number): Promise<void> {
    this.container = container;
    this.zoneId = zoneId;
    this.renderEmbedded();
    try {
      const [monsters, entries] = await Promise.all([
        listMonsters(),
        getEncounterTable(zoneId).catch(() => [] as EncounterEntry[]),
      ]);
      this.monsters = monsters;
      this.entries = entries;
      this.populateMonsterSelect();
      this.renderEntries();
    } catch (err) {
      const list = this.container.querySelector<HTMLElement>('#et-entry-list');
      if (list) list.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
    }
  }

  async load(): Promise<void> {
    try {
      this.monsters = await listMonsters();
      this.renderSkeleton();
    } catch (err) {
      this.container.innerHTML = `<p class="error">Failed to load monsters: ${(err as Error).message}</p>`;
    }
  }

  // ── Zone selection ────────────────────────────────────────────────────────

  async loadZone(zoneId: number): Promise<void> {
    this.zoneId = zoneId;
    try {
      this.entries = await getEncounterTable(zoneId);
    } catch {
      this.entries = [];
    }
    this.renderEntries();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="encounter-table-manager">
        <h2>Random Encounter Tables</h2>
        <p style="color:#888;font-size:0.9rem;margin-bottom:1rem;">
          Configure which monsters appear during night movement per zone.
          Weights are relative (e.g. weight 1 = 10% and weight 9 = 90% in a two-entry table).
        </p>
        <div style="margin-bottom:1rem;">
          <label for="et-zone-id">Zone ID</label>
          <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem;">
            <input id="et-zone-id" type="number" min="1" placeholder="Enter zone ID" style="width:120px;" />
            <button id="et-load-btn">Load</button>
          </div>
        </div>
        <div id="et-zone-section" style="display:none;">
          <h3 id="et-zone-title">Zone — Encounter Table</h3>
          <div id="et-entry-list"></div>
          <div class="encounter-table-manager__add-form" style="margin-top:1rem;padding:0.75rem;background:rgba(255,255,255,0.04);border:1px solid #333;">
            <h4 style="margin:0 0 0.5rem;">Add / Update Entry</h4>
            <p id="et-form-error" class="error" style="display:none;"></p>
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.5rem;align-items:end;">
              <div>
                <label for="et-monster-select">Monster</label>
                <select id="et-monster-select"></select>
              </div>
              <div>
                <label for="et-weight">Weight</label>
                <input id="et-weight" type="number" min="1" value="1" />
              </div>
              <button id="et-add-btn">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const loadBtn = this.container.querySelector<HTMLButtonElement>('#et-load-btn')!;
    loadBtn.addEventListener('click', () => {
      const input = this.container.querySelector<HTMLInputElement>('#et-zone-id')!;
      const id = parseInt(input.value, 10);
      if (!isNaN(id) && id > 0) {
        void this.loadZone(id);
      }
    });

    const addBtn = this.container.querySelector<HTMLButtonElement>('#et-add-btn')!;
    addBtn.addEventListener('click', () => void this.handleAdd());

    this.populateMonsterSelect();
  }

  private renderEmbedded(): void {
    this.container.innerHTML = `
      <div class="encounter-table-manager">
        <p style="color:#888;font-size:0.82rem;margin:0 0 0.75rem;">
          Weights are relative — e.g. weight 1 and 9 in a two-entry table = 10% / 90%.
        </p>
        <div id="et-zone-section">
          <div id="et-entry-list"></div>
          <div class="encounter-table-manager__add-form" style="margin-top:1rem;padding:0.75rem;background:rgba(255,255,255,0.04);border:1px solid #333;">
            <h4 style="margin:0 0 0.5rem;font-size:0.8rem;">Add / Update Entry</h4>
            <p id="et-form-error" class="error" style="display:none;"></p>
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.5rem;align-items:end;">
              <div>
                <label for="et-monster-select">Monster</label>
                <select id="et-monster-select"></select>
              </div>
              <div>
                <label for="et-weight">Weight</label>
                <input id="et-weight" type="number" min="1" value="1" />
              </div>
              <button id="et-add-btn">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector<HTMLButtonElement>('#et-add-btn')!
      .addEventListener('click', () => void this.handleAdd());
    this.populateMonsterSelect();
  }

  private renderSkeleton(): void {
    this.populateMonsterSelect();
  }

  private populateMonsterSelect(): void {
    const select = this.container.querySelector<HTMLSelectElement>('#et-monster-select');
    if (!select) return;
    select.innerHTML = this.monsters
      .map((m) => `<option value="${m.id}">${m.name} (id:${m.id})</option>`)
      .join('');
  }

  private renderEntries(): void {
    const section = this.container.querySelector<HTMLElement>('#et-zone-section')!;
    const title = this.container.querySelector<HTMLElement>('#et-zone-title');
    const list = this.container.querySelector<HTMLElement>('#et-entry-list')!;

    section.style.display = 'block';
    if (title) title.textContent = `Zone ${this.zoneId} — Encounter Table`;

    if (this.entries.length === 0) {
      list.innerHTML = '<p style="color:#888;font-style:italic;">No encounter entries for this zone.</p>';
      return;
    }

    const totalWeight = this.entries.reduce((acc, e) => acc + e.weight, 0);

    list.innerHTML = `
      <table class="et-table" style="width:100%;border-collapse:collapse;margin-bottom:0.5rem;">
        <thead>
          <tr style="border-bottom:1px solid #444;">
            <th style="text-align:left;padding:4px 8px;">Monster</th>
            <th style="text-align:right;padding:4px 8px;">Weight</th>
            <th style="text-align:right;padding:4px 8px;">Chance</th>
            <th style="padding:4px 8px;"></th>
          </tr>
        </thead>
        <tbody>
          ${this.entries.map((e) => `
            <tr style="border-bottom:1px solid #2a2a2a;" data-entry-id="${e.id}">
              <td style="padding:4px 8px;">${this.escHtml(e.monster_name)} <span style="color:#666;">(id:${e.monster_id})</span></td>
              <td style="text-align:right;padding:4px 8px;">${e.weight}</td>
              <td style="text-align:right;padding:4px 8px;color:#a0a0a0;">${((e.weight / totalWeight) * 100).toFixed(1)}%</td>
              <td style="padding:4px 8px;text-align:right;">
                <button class="et-delete-btn" data-id="${e.id}" style="font-size:0.8rem;padding:2px 8px;">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    list.querySelectorAll<HTMLButtonElement>('.et-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset['id'] ?? '', 10);
        if (!isNaN(id)) void this.handleDelete(id);
      });
    });
  }

  private async handleAdd(): Promise<void> {
    if (this.zoneId === null) return;
    const errorEl = this.container.querySelector<HTMLElement>('#et-form-error')!;
    errorEl.style.display = 'none';

    const select = this.container.querySelector<HTMLSelectElement>('#et-monster-select')!;
    const weightInput = this.container.querySelector<HTMLInputElement>('#et-weight')!;
    const monsterId = parseInt(select.value, 10);
    const weight = parseInt(weightInput.value, 10);

    if (isNaN(monsterId) || monsterId < 1) {
      this.showFormError('Select a valid monster.');
      return;
    }
    if (isNaN(weight) || weight < 1) {
      this.showFormError('Weight must be a positive integer.');
      return;
    }

    try {
      await upsertEncounterEntry(this.zoneId, monsterId, weight);
      await this.loadZone(this.zoneId);
    } catch (err) {
      this.showFormError(`Error: ${(err as Error).message}`);
    }
  }

  private async handleDelete(entryId: number): Promise<void> {
    if (this.zoneId === null) return;
    try {
      await deleteEncounterEntry(entryId);
      await this.loadZone(this.zoneId);
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  }

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#et-form-error')!;
    el.textContent = msg;
    el.style.display = 'block';
  }

  private escHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
