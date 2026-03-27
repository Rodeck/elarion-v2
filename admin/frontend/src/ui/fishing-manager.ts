import {
  listFishingLoot,
  createFishingLoot,
  deleteFishingLoot,
  listFishingRodTiers,
  getItems,
  type FishingLootEntry,
  type FishingRodTierEntry,
  type ItemDefinitionResponse,
} from '../editor/api';

export class FishingManager {
  private container!: HTMLElement;
  private lootEntries: FishingLootEntry[] = [];
  private rodTiers: FishingRodTierEntry[] = [];
  private items: ItemDefinitionResponse[] = [];

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      [this.lootEntries, this.rodTiers, this.items] = await Promise.all([
        listFishingLoot(),
        listFishingRodTiers(),
        getItems(),
      ]);
      this.renderContent();
    } catch (err) {
      this.showListError(`Failed to load: ${(err as Error).message}`);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1rem;">
        <div class="item-form-card">
          <h3>Add Loot Entry</h3>
          <p id="fm-error" class="error" style="display:none"></p>

          <label for="fm-tier">Min Rod Tier</label>
          <select id="fm-tier">
            <option value="1">T1</option>
            <option value="2">T2</option>
            <option value="3">T3</option>
            <option value="4">T4</option>
            <option value="5">T5</option>
          </select>

          <label for="fm-item">Item</label>
          <select id="fm-item"></select>

          <label for="fm-weight">Drop Weight</label>
          <input id="fm-weight" type="number" min="1" value="10" />

          <button id="fm-add-btn" class="btn btn--primary" style="margin-top:0.75rem;width:100%;">Add Entry</button>
        </div>

        <div class="item-form-card">
          <h3>Rod Tiers</h3>
          <div id="fm-tiers-list"></div>
        </div>
      </div>

      <div style="margin-top:1rem;padding:0 1rem 1rem;">
        <p id="fm-list-error" class="error" style="display:none"></p>
        <div id="fm-loot-list"></div>
      </div>
    `;

    document.getElementById('fm-add-btn')?.addEventListener('click', () => this.handleAdd());
    void this.load();
  }

  private renderContent(): void {
    this.populateItemDropdown();
    this.renderLootList();
    this.renderTiersList();
  }

  private populateItemDropdown(): void {
    const sel = document.getElementById('fm-item') as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = this.items
      .map((i) => `<option value="${i.id}">${i.name} (${i.category})</option>`)
      .join('');
  }

  private renderLootList(): void {
    const el = document.getElementById('fm-loot-list');
    if (!el) return;

    if (this.lootEntries.length === 0) {
      el.innerHTML = '<p class="empty-state">No loot entries configured.</p>';
      return;
    }

    // Compute total weight per rod tier (cumulative — T5 includes T1–T5)
    const totalWeightByTier: Record<number, number> = {};
    for (let t = 1; t <= 5; t++) {
      totalWeightByTier[t] = this.lootEntries
        .filter((e) => e.min_rod_tier <= t)
        .reduce((sum, e) => sum + e.drop_weight, 0);
    }

    const sorted = [...this.lootEntries].sort((a, b) => a.min_rod_tier - b.min_rod_tier || b.drop_weight - a.drop_weight);

    let html = `<table class="item-table" style="table-layout:fixed;width:100%;"><thead><tr>
      <th style="width:22%;">Item</th>
      <th style="width:12%;">Category</th>
      <th style="width:8%;">Weight</th>
      <th style="width:8%;">T1 %</th>
      <th style="width:8%;">T2 %</th>
      <th style="width:8%;">T3 %</th>
      <th style="width:8%;">T4 %</th>
      <th style="width:8%;">T5 %</th>
      <th style="width:18%;"></th>
    </tr></thead><tbody>`;

    let lastTier = -1;
    for (const e of sorted) {
      if (e.min_rod_tier !== lastTier) {
        html += `<tr><td colspan="9" style="padding:0.75rem 0 0.25rem;font-weight:600;border:none;">Unlocked at T${e.min_rod_tier}</td></tr>`;
        lastTier = e.min_rod_tier;
      }

      // Compute % for each rod tier where this item is available
      let tierCells = '';
      for (let t = 1; t <= 5; t++) {
        if (t < e.min_rod_tier) {
          tierCells += '<td style="text-align:center;color:#4a5272;">—</td>';
        } else {
          const pct = (e.drop_weight / totalWeightByTier[t]! * 100).toFixed(1);
          tierCells += `<td style="text-align:center;">${pct}</td>`;
        }
      }

      html += `<tr data-id="${e.id}">
        <td>${e.item_name}</td>
        <td>${e.item_category}</td>
        <td>${e.drop_weight}</td>
        ${tierCells}
        <td style="text-align:right;">
          <button class="btn btn--sm btn--danger fm-del-btn" data-id="${e.id}">Delete</button>
        </td>
      </tr>`;
    }

    // Footer with total weights per tier
    html += `<tr style="font-weight:600;border-top:2px solid #1e2232;">
      <td>Total</td><td></td>
      <td style="text-align:center;">${Object.values(totalWeightByTier)[0]}</td>`;
    for (let t = 1; t <= 5; t++) {
      html += `<td style="text-align:center;">${totalWeightByTier[t]}</td>`;
    }
    html += '<td></td></tr>';

    html += '</tbody></table>';
    el.innerHTML = html;

    el.querySelectorAll('.fm-del-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt((btn as HTMLElement).dataset.id!, 10);
        void this.handleDelete(id);
      });
    });
  }

  private renderTiersList(): void {
    const el = document.getElementById('fm-tiers-list');
    if (!el) return;

    if (this.rodTiers.length === 0) {
      el.innerHTML = '<p class="empty-state">No rod tiers configured.</p>';
      return;
    }

    let html = `<table class="item-table" style="table-layout:fixed;width:100%;"><thead><tr>
      <th style="width:25%;">Tier</th>
      <th style="width:25%;">Durability</th>
      <th style="width:25%;">Upgrade Cost</th>
      <th style="width:25%;">Repair Cost</th>
    </tr></thead><tbody>`;
    for (const t of this.rodTiers) {
      html += `<tr>
        <td>T${t.tier}</td>
        <td>${t.max_durability}</td>
        <td>${t.upgrade_points_cost} pts</td>
        <td>${t.repair_crown_cost} crowns</td>
      </tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  private async handleAdd(): Promise<void> {
    const tier = parseInt((document.getElementById('fm-tier') as HTMLSelectElement).value, 10);
    const itemId = parseInt((document.getElementById('fm-item') as HTMLSelectElement).value, 10);
    const weight = parseInt((document.getElementById('fm-weight') as HTMLInputElement).value, 10);

    if (isNaN(tier) || isNaN(itemId) || isNaN(weight) || weight < 1) {
      this.showError('Invalid input');
      return;
    }

    try {
      await createFishingLoot({ min_rod_tier: tier, item_def_id: itemId, drop_weight: weight });
      this.lootEntries = await listFishingLoot();
      this.renderLootList();
    } catch (err) {
      this.showError((err as Error).message);
    }
  }

  private async handleDelete(id: number): Promise<void> {
    try {
      await deleteFishingLoot(id);
      this.lootEntries = this.lootEntries.filter((e) => e.id !== id);
      this.renderLootList();
    } catch (err) {
      this.showError((err as Error).message);
    }
  }

  private showError(msg: string): void {
    const el = document.getElementById('fm-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 3000);
    }
  }

  private showListError(msg: string): void {
    const el = document.getElementById('fm-list-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }
}
