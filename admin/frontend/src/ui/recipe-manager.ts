import {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getItems,
  listNpcs,
  type RecipeResponse,
  type ItemDefinitionResponse,
  type NpcResponse,
} from '../editor/api';

export class RecipeManager {
  private container!: HTMLElement;
  private recipes: RecipeResponse[] = [];
  private items: ItemDefinitionResponse[] = [];
  private npcs: NpcResponse[] = [];
  private editingId: number | null = null;
  private ingredientRows: { item_def_id: number; quantity: number }[] = [];

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      const [recipes, items, npcs] = await Promise.all([
        getRecipes(),
        getItems(),
        listNpcs(),
      ]);
      this.recipes = recipes;
      this.items = items;
      this.npcs = npcs;
      this.renderNpcDropdown();
      this.renderOutputItemDropdown();
      this.renderList();
    } catch (err) {
      this.showError(`Failed to load: ${(err as Error).message}`);
    }
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="item-manager-layout">

        <!-- ── Left col: form ── -->
        <div class="item-form-col">
          <h2>Crafting Recipes</h2>
          <div class="item-form-card">
            <h3 id="recipe-form-title">Add New Recipe</h3>
            <p id="recipe-error" class="error" style="display:none"></p>
            <form id="recipe-form" autocomplete="off">
              <label for="recipe-name">Name *</label>
              <input id="recipe-name" name="name" type="text" maxlength="128" required placeholder="Recipe name" />

              <label for="recipe-desc">Description</label>
              <textarea id="recipe-desc" name="description" rows="2" placeholder="Optional description"></textarea>

              <label for="recipe-npc">Crafting NPC *</label>
              <select id="recipe-npc" name="npc_id" required>
                <option value="">— select NPC —</option>
              </select>

              <label for="recipe-output-item">Output Item *</label>
              <select id="recipe-output-item" name="output_item_id" required>
                <option value="">— select item —</option>
              </select>

              <label for="recipe-output-qty">Output Quantity *</label>
              <input id="recipe-output-qty" name="output_quantity" type="number" min="1" value="1" required style="width:120px" />

              <label for="recipe-crowns">Cost (Crowns) *</label>
              <input id="recipe-crowns" name="cost_crowns" type="number" min="0" value="0" required style="width:120px" />

              <label for="recipe-time">Craft Time (seconds) *</label>
              <input id="recipe-time" name="craft_time_seconds" type="number" min="1" value="10" required style="width:120px" />

              <label for="recipe-sort">Sort Order</label>
              <input id="recipe-sort" name="sort_order" type="number" min="0" value="0" style="width:120px" />

              <label>Ingredients</label>
              <div id="recipe-ingredients" style="margin-bottom:0.5rem;"></div>
              <button type="button" class="btn btn--secondary" id="recipe-add-ingredient" style="margin-bottom:1rem;font-size:0.8rem;">+ Add Ingredient</button>

              <div class="form-actions">
                <button type="button" class="btn" id="recipe-form-cancel" style="display:none">Cancel</button>
                <button type="submit" class="btn btn--primary" id="recipe-form-submit">Add Recipe</button>
              </div>
            </form>
          </div>
        </div>

        <!-- ── Right col: list ── -->
        <div class="item-list-col">
          <div id="recipe-list-container">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>

      </div>
    `;

    this.attachFormListeners();
  }

  // ── Dropdowns ──────────────────────────────────────────────────────────

  private renderNpcDropdown(): void {
    const sel = this.container.querySelector<HTMLSelectElement>('#recipe-npc');
    if (!sel) return;
    sel.innerHTML = '<option value="">— select NPC —</option>' +
      this.npcs.map((n) => `<option value="${n.id}">${this.esc(n.name)}</option>`).join('');
  }

  private renderOutputItemDropdown(): void {
    const sel = this.container.querySelector<HTMLSelectElement>('#recipe-output-item');
    if (!sel) return;
    sel.innerHTML = '<option value="">— select item —</option>' +
      this.items.map((i) => `<option value="${i.id}">${this.esc(i.name)} (${i.category})</option>`).join('');
  }

  private buildItemOptions(selectedId?: number): string {
    return '<option value="">— select item —</option>' +
      this.items.map((i) =>
        `<option value="${i.id}"${i.id === selectedId ? ' selected' : ''}>${this.esc(i.name)} (${i.category})</option>`
      ).join('');
  }

  // ── Ingredient rows ────────────────────────────────────────────────────

  private renderIngredientRows(): void {
    const wrap = this.container.querySelector<HTMLElement>('#recipe-ingredients')!;
    wrap.innerHTML = '';

    this.ingredientRows.forEach((row, idx) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
      div.innerHTML = `
        <select data-ing-idx="${idx}" class="ing-item" style="flex:1;">
          ${this.buildItemOptions(row.item_def_id)}
        </select>
        <input type="number" data-ing-idx="${idx}" class="ing-qty" min="1" value="${row.quantity}" style="width:70px;" placeholder="Qty" />
        <button type="button" class="btn btn--sm btn--danger ing-remove" data-ing-idx="${idx}" style="padding:2px 8px;">X</button>
      `;

      div.querySelector<HTMLSelectElement>('.ing-item')!.addEventListener('change', (e) => {
        const row = this.ingredientRows[idx];
        if (row) row.item_def_id = parseInt((e.target as HTMLSelectElement).value, 10) || 0;
      });

      div.querySelector<HTMLInputElement>('.ing-qty')!.addEventListener('change', (e) => {
        const row = this.ingredientRows[idx];
        if (row) row.quantity = parseInt((e.target as HTMLInputElement).value, 10) || 1;
      });

      div.querySelector<HTMLButtonElement>('.ing-remove')!.addEventListener('click', () => {
        this.ingredientRows.splice(idx, 1);
        this.renderIngredientRows();
      });

      wrap.appendChild(div);
    });
  }

  // ── Form listeners ─────────────────────────────────────────────────────

  private attachFormListeners(): void {
    const form = this.container.querySelector<HTMLFormElement>('#recipe-form')!;

    this.container.querySelector<HTMLButtonElement>('#recipe-add-ingredient')!
      .addEventListener('click', () => {
        this.ingredientRows.push({ item_def_id: 0, quantity: 1 });
        this.renderIngredientRows();
      });

    this.container.querySelector<HTMLButtonElement>('#recipe-form-cancel')!
      .addEventListener('click', () => {
        this.resetForm();
      });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit(form);
    });
  }

  private async handleFormSubmit(form: HTMLFormElement): Promise<void> {
    const errEl = this.container.querySelector<HTMLElement>('#recipe-error')!;
    errEl.style.display = 'none';

    const name = (form.querySelector<HTMLInputElement>('[name="name"]')!).value.trim();
    const description = (form.querySelector<HTMLTextAreaElement>('[name="description"]')!).value.trim();
    const npcId = parseInt(form.querySelector<HTMLSelectElement>('[name="npc_id"]')!.value, 10);
    const outputItemId = parseInt(form.querySelector<HTMLSelectElement>('[name="output_item_id"]')!.value, 10);
    const outputQty = parseInt(form.querySelector<HTMLInputElement>('[name="output_quantity"]')!.value, 10);
    const costCrowns = parseInt(form.querySelector<HTMLInputElement>('[name="cost_crowns"]')!.value, 10);
    const craftTime = parseInt(form.querySelector<HTMLInputElement>('[name="craft_time_seconds"]')!.value, 10);
    const sortOrder = parseInt(form.querySelector<HTMLInputElement>('[name="sort_order"]')!.value, 10) || 0;

    if (!name) { this.showFormError('Name is required.'); return; }
    if (!npcId) { this.showFormError('Please select an NPC.'); return; }
    if (!outputItemId) { this.showFormError('Please select an output item.'); return; }

    const validIngredients = this.ingredientRows.filter((r) => r.item_def_id > 0 && r.quantity > 0);

    try {
      if (this.editingId !== null) {
        const updated = await updateRecipe(this.editingId, {
          name,
          description: description || undefined,
          output_item_id: outputItemId,
          output_quantity: outputQty,
          cost_crowns: costCrowns,
          craft_time_seconds: craftTime,
          sort_order: sortOrder,
          ingredients: validIngredients,
        });
        const idx = this.recipes.findIndex((r) => r.id === updated.id);
        if (idx >= 0) this.recipes[idx] = updated;
        else this.recipes.unshift(updated);
      } else {
        const created = await createRecipe({
          npc_id: npcId,
          name,
          description: description || undefined,
          output_item_id: outputItemId,
          output_quantity: outputQty,
          cost_crowns: costCrowns,
          craft_time_seconds: craftTime,
          sort_order: sortOrder,
          ingredients: validIngredients,
        });
        this.recipes.unshift(created);
      }
      this.resetForm();
      this.renderList();
    } catch (err) {
      this.showFormError((err as Error).message);
    }
  }

  private resetForm(): void {
    this.editingId = null;
    this.ingredientRows = [];
    const form = this.container.querySelector<HTMLFormElement>('#recipe-form')!;
    form.reset();
    this.container.querySelector<HTMLElement>('#recipe-form-title')!.textContent = 'Add New Recipe';
    this.container.querySelector<HTMLElement>('#recipe-form-submit')!.textContent = 'Add Recipe';
    this.container.querySelector<HTMLElement>('#recipe-form-cancel')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#recipe-error')!.style.display = 'none';
    this.renderIngredientRows();
  }

  private populateForm(recipe: RecipeResponse): void {
    this.editingId = recipe.id;

    const form = this.container.querySelector<HTMLFormElement>('#recipe-form')!;
    (form.querySelector<HTMLInputElement>('[name="name"]'))!.value = recipe.name;
    (form.querySelector<HTMLTextAreaElement>('[name="description"]'))!.value = recipe.description ?? '';
    (form.querySelector<HTMLSelectElement>('[name="npc_id"]'))!.value = String(recipe.npc_id);
    (form.querySelector<HTMLSelectElement>('[name="output_item_id"]'))!.value = String(recipe.output_item_id);
    (form.querySelector<HTMLInputElement>('[name="output_quantity"]'))!.value = String(recipe.output_quantity);
    (form.querySelector<HTMLInputElement>('[name="cost_crowns"]'))!.value = String(recipe.cost_crowns);
    (form.querySelector<HTMLInputElement>('[name="craft_time_seconds"]'))!.value = String(recipe.craft_time_seconds);
    (form.querySelector<HTMLInputElement>('[name="sort_order"]'))!.value = String(recipe.sort_order);

    this.ingredientRows = recipe.ingredients.map((ing) => ({
      item_def_id: ing.item_def_id,
      quantity: ing.quantity,
    }));
    this.renderIngredientRows();

    this.container.querySelector<HTMLElement>('#recipe-form-title')!.textContent = `Edit Recipe #${recipe.id}`;
    this.container.querySelector<HTMLElement>('#recipe-form-submit')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#recipe-form-cancel')!.style.display = '';
    this.container.querySelector<HTMLElement>('#recipe-error')!.style.display = 'none';
  }

  // ── List ────────────────────────────────────────────────────────────────

  private renderList(): void {
    const container = this.container.querySelector<HTMLElement>('#recipe-list-container')!;

    if (this.recipes.length === 0) {
      container.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No recipes yet. Create one using the form.</p>';
      return;
    }

    const npcMap = new Map(this.npcs.map((n) => [n.id, n.name]));
    const itemMap = new Map(this.items.map((i) => [i.id, i.name]));

    const table = document.createElement('table');
    table.className = 'item-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>NPC</th>
          <th>Output</th>
          <th>Crowns</th>
          <th>Time</th>
          <th>Ingredients</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody')!;

    for (const recipe of this.recipes) {
      const tr = document.createElement('tr');

      const npcName = npcMap.get(recipe.npc_id) ?? `NPC #${recipe.npc_id}`;
      const outputName = itemMap.get(recipe.output_item_id) ?? `Item #${recipe.output_item_id}`;
      const outputStr = recipe.output_quantity > 1
        ? `${this.esc(outputName)} x${recipe.output_quantity}`
        : this.esc(outputName);

      const ingredientPills = recipe.ingredients.map((ing) => {
        const iName = ing.item_name || itemMap.get(ing.item_def_id) || `Item #${ing.item_def_id}`;
        const label = ing.quantity > 1 ? `${iName} x${ing.quantity}` : iName;
        return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;letter-spacing:0.02em;background:#2a3048;color:#9ba8d0;white-space:nowrap;margin:1px 2px;">${this.esc(label)}</span>`;
      }).join('');

      tr.innerHTML = `
        <td>${this.esc(recipe.name)}</td>
        <td>${this.esc(npcName)}</td>
        <td>${outputStr}</td>
        <td>${recipe.cost_crowns}</td>
        <td>${recipe.craft_time_seconds}s</td>
        <td><div style="display:flex;flex-wrap:wrap;gap:2px;">${ingredientPills || '—'}</div></td>
        <td>
          <button class="btn btn--sm btn-edit" data-id="${recipe.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn-delete" data-id="${recipe.id}">Delete</button>
        </td>
      `;

      tr.querySelector('.btn-edit')!.addEventListener('click', () => {
        this.populateForm(recipe);
      });

      tr.querySelector('.btn-delete')!.addEventListener('click', async () => {
        if (!confirm(`Delete recipe "${recipe.name}"? This cannot be undone.`)) return;
        try {
          await deleteRecipe(recipe.id);
          this.recipes = this.recipes.filter((r) => r.id !== recipe.id);
          if (this.editingId === recipe.id) this.resetForm();
          this.renderList();
        } catch (err) {
          alert(`Failed to delete: ${(err as Error).message}`);
        }
      });

      tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#recipe-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showError(msg: string): void {
    const container = this.container.querySelector<HTMLElement>('#recipe-list-container');
    if (container) container.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
