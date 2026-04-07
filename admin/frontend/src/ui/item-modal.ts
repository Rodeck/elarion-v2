import {
  createItem,
  updateItem,
  getDisassemblyRecipes,
  saveDisassemblyRecipes,
  type ItemDefinitionResponse,
  type DisassemblyRecipeEntry,
} from '../editor/api';
import { ImageGenDialog } from './image-gen-dialog';
import { openItemPicker, resolveItemName } from './item-picker';

const VALID_CATEGORIES = [
  'resource', 'food', 'heal', 'weapon',
  'helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'tool',
  'ring', 'amulet', 'skill_book', 'spell_book_spell',
] as const;

const VALID_WEAPON_SUBTYPES = [
  'one_handed', 'two_handed', 'dagger', 'wand', 'staff', 'bow',
] as const;

const STACKABLE_CATEGORIES = new Set(['resource', 'heal', 'food', 'skill_book', 'spell_book_spell']);
const DEFENCE_CATEGORIES = new Set(['helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'ring', 'amulet']);
const EQUIPPABLE_CATEGORIES = new Set(['weapon', 'helmet', 'chestplate', 'boots', 'shield', 'greaves', 'bracer', 'ring', 'amulet']);

type ItemCategory = typeof VALID_CATEGORIES[number];

interface RecipeEntryState {
  chance_percent: number;
  outputs: { output_item_def_id: number; quantity: number; name?: string }[];
}

export class ItemModal {
  private overlay: HTMLElement | null = null;
  private onSave: (item: ItemDefinitionResponse) => void;
  private acceptedBase64: string | null = null;
  private recipes: RecipeEntryState[] = [];
  private mode: 'create' | 'edit' = 'create';
  private editItem: ItemDefinitionResponse | null = null;

  constructor(onSave: (item: ItemDefinitionResponse) => void) {
    this.onSave = onSave;
  }

  async open(mode: 'create' | 'edit', item?: ItemDefinitionResponse): Promise<void> {
    this.mode = mode;
    this.editItem = item ?? null;
    this.acceptedBase64 = null;
    this.recipes = [];

    // Load existing recipes if editing
    if (mode === 'edit' && item) {
      try {
        const existing = await getDisassemblyRecipes(item.id);
        this.recipes = existing.map((r) => ({
          chance_percent: r.chance_percent,
          outputs: r.outputs.map((o) => ({ ...o, name: undefined as string | undefined })),
        }));
        // Resolve item names for display
        for (const recipe of this.recipes) {
          for (const output of recipe.outputs) {
            output.name = await resolveItemName(output.output_item_def_id);
          }
        }
      } catch {
        // ignore — start with empty
      }
    }

    this.buildUI();
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private buildUI(): void {
    // Remove existing
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'item-modal-overlay';
    this.overlay = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    document.addEventListener('keydown', this.handleEsc);

    const modal = document.createElement('div');
    modal.className = 'item-modal';
    overlay.appendChild(modal);

    // Header
    const header = document.createElement('div');
    header.className = 'item-modal-header';
    const h2 = document.createElement('h2');
    h2.textContent = this.mode === 'create' ? 'Add New Item' : `Edit Item #${this.editItem!.id}`;
    header.appendChild(h2);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn--small';
    closeBtn.type = 'button';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'item-modal-body';
    modal.appendChild(body);

    // LEFT: fields
    const fieldsCol = document.createElement('div');
    fieldsCol.className = 'item-modal-fields';
    body.appendChild(fieldsCol);

    // RIGHT: recipes
    const recipesCol = document.createElement('div');
    recipesCol.className = 'item-modal-recipes';
    body.appendChild(recipesCol);

    this.buildFields(fieldsCol);
    this.buildRecipeEditor(recipesCol);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'item-modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.close());
    footer.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary';
    saveBtn.type = 'button';
    saveBtn.textContent = this.mode === 'create' ? 'Add Item' : 'Save Changes';
    saveBtn.addEventListener('click', () => this.handleSave());
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    document.body.appendChild(overlay);
  }

  private handleEsc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
      document.removeEventListener('keydown', this.handleEsc);
    }
  };

  private buildFields(container: HTMLElement): void {
    const item = this.editItem;
    const cat = item?.category ?? '';

    container.innerHTML = `
      <p id="modal-error" class="error" style="display:none"></p>
      <label for="modal-name">Name *</label>
      <input id="modal-name" type="text" maxlength="64" required placeholder="Item name" value="${this.esc(item?.name ?? '')}" />

      <label for="modal-desc">Description</label>
      <textarea id="modal-desc" rows="2" placeholder="Optional description">${this.esc(item?.description ?? '')}</textarea>

      <label for="modal-category">Category *</label>
      <select id="modal-category" required>
        <option value="">\u2014 select \u2014</option>
        ${VALID_CATEGORIES.map((c) => `<option value="${c}" ${c === cat ? 'selected' : ''}>${this.labelFor(c)}</option>`).join('')}
      </select>

      <div id="modal-field-weapon_subtype" style="display:none">
        <label for="modal-weapon-subtype">Weapon Subtype *</label>
        <select id="modal-weapon-subtype">
          <option value="">\u2014 select \u2014</option>
          ${VALID_WEAPON_SUBTYPES.map((s) => `<option value="${s}" ${s === (item?.weapon_subtype ?? '') ? 'selected' : ''}>${this.subtypeLabel(s)}</option>`).join('')}
        </select>
      </div>

      <div id="modal-field-attack" style="display:none">
        <label for="modal-attack">Attack</label>
        <input id="modal-attack" type="number" min="0" style="width:120px" value="${item?.attack ?? ''}" />
      </div>

      <div id="modal-field-defence" style="display:none">
        <label for="modal-defence">Defence</label>
        <input id="modal-defence" type="number" min="0" style="width:120px" value="${item?.defence ?? ''}" />
      </div>

      <div id="modal-field-heal_power" style="display:none">
        <label for="modal-heal">Heal Power</label>
        <input id="modal-heal" type="number" min="0" style="width:120px" value="${item?.heal_power ?? ''}" />
      </div>

      <div id="modal-field-food_power" style="display:none">
        <label for="modal-food">Food Power</label>
        <input id="modal-food" type="number" min="0" style="width:120px" value="${item?.food_power ?? ''}" />
      </div>

      <div id="modal-field-stack_size" style="display:none">
        <label for="modal-stack">Stack Size *</label>
        <input id="modal-stack" type="number" min="1" style="width:120px" value="${item?.stack_size ?? ''}" />
      </div>

      <div id="modal-field-ability_id" style="display:none">
        <label for="modal-ability-id">Ability ID *</label>
        <input id="modal-ability-id" type="number" min="1" style="width:120px" placeholder="Ability ID" value="${item?.ability_id ?? ''}" />
      </div>

      <div id="modal-field-spell_id" style="display:none">
        <label for="modal-spell-id">Spell ID *</label>
        <input id="modal-spell-id" type="number" min="1" style="width:120px" placeholder="Spell ID" value="${(item as any)?.spell_id ?? ''}" />
      </div>

      <div id="modal-field-tool_type" style="display:none">
        <label for="modal-tool-type">Tool Type *</label>
        <select id="modal-tool-type">
          <option value="">\u2014 select \u2014</option>
          <option value="pickaxe" ${item?.tool_type === 'pickaxe' ? 'selected' : ''}>Pickaxe</option>
          <option value="axe" ${item?.tool_type === 'axe' ? 'selected' : ''}>Axe</option>
          <option value="fishing_rod" ${item?.tool_type === 'fishing_rod' ? 'selected' : ''}>Fishing Rod</option>
          <option value="kiln" ${item?.tool_type === 'kiln' ? 'selected' : ''}>Kiln</option>
        </select>
      </div>

      <div id="modal-field-max_durability" style="display:none">
        <label for="modal-max-durability">Max Durability *</label>
        <input id="modal-max-durability" type="number" min="1" style="width:120px" value="${item?.max_durability ?? ''}" />
      </div>

      <div id="modal-field-power" style="display:none">
        <label for="modal-power">Power</label>
        <input id="modal-power" type="number" min="1" style="width:120px" value="${item?.power ?? ''}" />
      </div>

      <div id="modal-field-crit_chance" style="display:none">
        <label for="modal-crit-chance">Crit Chance (%)</label>
        <input id="modal-crit-chance" type="number" min="0" max="100" style="width:120px" value="${item?.crit_chance ?? ''}" />
      </div>

      <div id="modal-field-armor_penetration" style="display:none">
        <label for="modal-armor-penetration">Armor Penetration (%)</label>
        <input id="modal-armor-penetration" type="number" min="0" max="100" style="width:120px" value="${item?.armor_penetration ?? ''}" />
      </div>

      <div id="modal-field-additional_attacks" style="display:none">
        <label for="modal-additional-attacks">Additional Attacks</label>
        <input id="modal-additional-attacks" type="number" min="0" max="10" style="width:120px" value="${item?.additional_attacks ?? ''}" />
      </div>

      <label for="modal-disassembly-cost">Disassembly Cost (crowns)</label>
      <input id="modal-disassembly-cost" type="number" min="0" style="width:120px" value="${item?.disassembly_cost ?? 0}" />

      <label>Icon (PNG, max 2 MB)</label>
      <div class="file-upload-row">
        <button type="button" class="btn btn--secondary" id="modal-choose-icon-btn">Choose File</button>
        <button type="button" class="btn btn--secondary" id="modal-ai-gen-btn">Generate with AI</button>
        <span id="modal-icon-filename" class="file-name-text">No file chosen</span>
        <input id="modal-icon-input" type="file" accept="image/png" style="display:none;" />
      </div>
      <div id="modal-icon-preview" style="${item?.icon_url ? '' : 'display:none;'}margin-top:10px;">
        <p style="font-size:0.7rem;color:#404666;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px;font-weight:600;">Icon Preview</p>
        <div class="inv-slot-preview-wrap">
          <div class="inv-slot-cell">
            <img id="modal-current-icon-img" src="${item?.icon_url ?? ''}" alt="icon" />
          </div>
          <span style="font-size:0.75rem;color:#5a6280;line-height:1.5;">As it appears<br>in the inventory</span>
        </div>
      </div>
    `;

    // Category change handler
    const categorySelect = container.querySelector<HTMLSelectElement>('#modal-category')!;
    categorySelect.addEventListener('change', () => {
      this.updateConditionalFields(container, categorySelect.value as ItemCategory | '');
    });
    this.updateConditionalFields(container, cat as ItemCategory | '');

    // Icon file input
    const iconInput = container.querySelector<HTMLInputElement>('#modal-icon-input')!;
    const chooseBtn = container.querySelector<HTMLButtonElement>('#modal-choose-icon-btn')!;
    chooseBtn.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = container.querySelector<HTMLElement>('#modal-icon-filename');
      if (nameEl) nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        const url = URL.createObjectURL(file);
        const preview = container.querySelector<HTMLElement>('#modal-icon-preview')!;
        const img = preview.querySelector<HTMLImageElement>('#modal-current-icon-img')!;
        img.src = url;
        preview.style.display = '';
      }
    });

    // AI gen
    const aiGenBtn = container.querySelector<HTMLButtonElement>('#modal-ai-gen-btn')!;
    const nameInput = container.querySelector<HTMLInputElement>('#modal-name')!;

    const updateAiBtn = () => { aiGenBtn.disabled = !nameInput.value.trim(); };
    nameInput.addEventListener('input', updateAiBtn);
    updateAiBtn();

    aiGenBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const dialog = new ImageGenDialog();
      await dialog.open(name, (base64) => {
        this.acceptedBase64 = base64;
        const preview = container.querySelector<HTMLElement>('#modal-icon-preview')!;
        const img = preview.querySelector<HTMLImageElement>('#modal-current-icon-img')!;
        img.src = `data:image/png;base64,${base64}`;
        preview.style.display = '';
        const nameEl = container.querySelector<HTMLElement>('#modal-icon-filename');
        if (nameEl) nameEl.textContent = 'AI generated';
        iconInput.value = '';
      });
    });
  }

  private updateConditionalFields(container: HTMLElement, category: ItemCategory | ''): void {
    const show = (id: string, visible: boolean) => {
      const el = container.querySelector<HTMLElement>(`#modal-field-${id}`);
      if (el) el.style.display = visible ? '' : 'none';
    };

    show('weapon_subtype', category === 'weapon');
    show('attack', category === 'weapon');
    show('defence', category !== '' && DEFENCE_CATEGORIES.has(category));
    show('heal_power', category === 'heal');
    show('food_power', category === 'food');
    show('stack_size', category !== '' && STACKABLE_CATEGORIES.has(category));
    show('ability_id', category === 'skill_book');
    show('spell_id', category === 'spell_book_spell');
    show('tool_type', category === 'tool');
    show('max_durability', category === 'tool');
    show('power', category === 'tool');
    const isEquippable = category !== '' && EQUIPPABLE_CATEGORIES.has(category);
    show('crit_chance', isEquippable);
    show('armor_penetration', isEquippable);
    show('additional_attacks', isEquippable);
  }

  private buildRecipeEditor(container: HTMLElement): void {
    container.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Disassembly Recipes';
    heading.style.cssText = 'margin:0 0 0.5rem;font-size:0.9rem;color:#c8cad6;';
    container.appendChild(heading);

    // Disassembly cost is in the left column already
    // Add Chance Entry button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--secondary';
    addBtn.type = 'button';
    addBtn.textContent = '+ Add Chance Entry';
    addBtn.style.marginBottom = '0.5rem';
    addBtn.addEventListener('click', () => {
      this.recipes.push({ chance_percent: 0, outputs: [] });
      this.renderRecipeEntries(container, addBtn, totalEl);
    });
    container.appendChild(addBtn);

    // Total display
    const totalEl = document.createElement('div');
    totalEl.className = 'recipe-total';
    container.appendChild(totalEl);

    this.renderRecipeEntries(container, addBtn, totalEl);
  }

  private renderRecipeEntries(container: HTMLElement, addBtn: HTMLElement, totalEl: HTMLElement): void {
    // Remove old entries
    container.querySelectorAll('.recipe-entry').forEach((el) => el.remove());

    // Insert entries before the total element
    for (let i = 0; i < this.recipes.length; i++) {
      const entry = this.recipes[i];
      const entryEl = document.createElement('div');
      entryEl.className = 'recipe-entry';

      // Header row
      const headerRow = document.createElement('div');
      headerRow.className = 'recipe-entry-header';

      const chanceLabel = document.createElement('span');
      chanceLabel.textContent = 'Chance %:';
      chanceLabel.style.cssText = 'font-size:0.8rem;color:#9ba8d0;';
      headerRow.appendChild(chanceLabel);

      const chanceInput = document.createElement('input');
      chanceInput.type = 'number';
      chanceInput.min = '1';
      chanceInput.max = '100';
      chanceInput.value = String(entry.chance_percent || '');
      chanceInput.style.cssText = 'width:70px;';
      chanceInput.addEventListener('input', () => {
        entry.chance_percent = parseInt(chanceInput.value, 10) || 0;
        this.updateTotal(totalEl);
      });
      headerRow.appendChild(chanceInput);

      const addOutputBtn = document.createElement('button');
      addOutputBtn.className = 'btn btn--sm btn--secondary';
      addOutputBtn.type = 'button';
      addOutputBtn.textContent = '+ Output';
      addOutputBtn.addEventListener('click', () => {
        openItemPicker((selected) => {
          entry.outputs.push({ output_item_def_id: selected.id, quantity: 1, name: selected.name });
          this.renderRecipeEntries(container, addBtn, totalEl);
        });
      });
      headerRow.appendChild(addOutputBtn);

      const removeEntryBtn = document.createElement('button');
      removeEntryBtn.className = 'btn btn--sm btn--danger';
      removeEntryBtn.type = 'button';
      removeEntryBtn.textContent = '\u2715';
      removeEntryBtn.style.marginLeft = 'auto';
      removeEntryBtn.addEventListener('click', () => {
        this.recipes.splice(i, 1);
        this.renderRecipeEntries(container, addBtn, totalEl);
      });
      headerRow.appendChild(removeEntryBtn);

      entryEl.appendChild(headerRow);

      // Output rows
      for (let j = 0; j < entry.outputs.length; j++) {
        const output = entry.outputs[j];
        const outputRow = document.createElement('div');
        outputRow.className = 'recipe-output-row';

        const itemBtn = document.createElement('button');
        itemBtn.className = 'item-select-trigger';
        itemBtn.type = 'button';
        itemBtn.style.cssText = 'max-width:180px;';
        const displayName = output.name ?? `#${output.output_item_def_id}`;
        itemBtn.innerHTML = `<span class="item-select-trigger-name">${this.esc(displayName)}</span>`;
        itemBtn.addEventListener('click', () => {
          openItemPicker((selected) => {
            output.output_item_def_id = selected.id;
            output.name = selected.name;
            this.renderRecipeEntries(container, addBtn, totalEl);
          });
        });
        outputRow.appendChild(itemBtn);

        const qtyLabel = document.createElement('span');
        qtyLabel.textContent = 'x';
        qtyLabel.style.cssText = 'font-size:0.8rem;color:#6a748a;';
        outputRow.appendChild(qtyLabel);

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.value = String(output.quantity);
        qtyInput.style.cssText = 'width:50px;';
        qtyInput.addEventListener('input', () => {
          output.quantity = parseInt(qtyInput.value, 10) || 1;
        });
        outputRow.appendChild(qtyInput);

        const removeOutputBtn = document.createElement('button');
        removeOutputBtn.className = 'btn btn--sm btn--danger';
        removeOutputBtn.type = 'button';
        removeOutputBtn.textContent = '\u2715';
        removeOutputBtn.addEventListener('click', () => {
          entry.outputs.splice(j, 1);
          this.renderRecipeEntries(container, addBtn, totalEl);
        });
        outputRow.appendChild(removeOutputBtn);

        entryEl.appendChild(outputRow);
      }

      container.insertBefore(entryEl, totalEl);
    }

    this.updateTotal(totalEl);
  }

  private updateTotal(totalEl: HTMLElement): void {
    if (this.recipes.length === 0) {
      totalEl.textContent = 'No recipe entries';
      totalEl.className = 'recipe-total valid';
      return;
    }
    const sum = this.recipes.reduce((s, r) => s + r.chance_percent, 0);
    totalEl.textContent = `Total: ${sum}%`;
    totalEl.className = sum === 100 ? 'recipe-total valid' : 'recipe-total invalid';
  }

  private async handleSave(): Promise<void> {
    const overlay = this.overlay;
    if (!overlay) return;

    const errorEl = overlay.querySelector<HTMLElement>('#modal-error')!;
    errorEl.style.display = 'none';

    // Validate recipes
    if (this.recipes.length > 0) {
      const sum = this.recipes.reduce((s, r) => s + r.chance_percent, 0);
      if (sum !== 100) {
        errorEl.textContent = `Recipe chances must total 100% (currently ${sum}%)`;
        errorEl.style.display = '';
        return;
      }
      for (const r of this.recipes) {
        if (r.outputs.length === 0) {
          errorEl.textContent = 'Each recipe entry must have at least one output';
          errorEl.style.display = '';
          return;
        }
      }
    }

    // Build FormData from fields
    const formData = new FormData();

    const name = overlay.querySelector<HTMLInputElement>('#modal-name')!.value;
    const desc = overlay.querySelector<HTMLTextAreaElement>('#modal-desc')!.value;
    const category = overlay.querySelector<HTMLSelectElement>('#modal-category')!.value;

    formData.append('name', name);
    if (desc) formData.append('description', desc);
    formData.append('category', category);

    const weaponSubtype = overlay.querySelector<HTMLSelectElement>('#modal-weapon-subtype')?.value;
    if (category === 'weapon' && weaponSubtype) formData.append('weapon_subtype', weaponSubtype);

    const appendNum = (id: string, key: string) => {
      const val = overlay.querySelector<HTMLInputElement>(id)?.value;
      if (val !== undefined && val !== '') formData.append(key, val);
    };

    appendNum('#modal-attack', 'attack');
    appendNum('#modal-defence', 'defence');
    appendNum('#modal-heal', 'heal_power');
    appendNum('#modal-food', 'food_power');
    appendNum('#modal-stack', 'stack_size');
    appendNum('#modal-max-durability', 'max_durability');
    appendNum('#modal-power', 'power');
    appendNum('#modal-crit-chance', 'crit_chance');
    appendNum('#modal-armor-penetration', 'armor_penetration');
    appendNum('#modal-additional-attacks', 'additional_attacks');

    const toolType = overlay.querySelector<HTMLSelectElement>('#modal-tool-type')?.value;
    if (category === 'tool' && toolType) formData.append('tool_type', toolType);

    if (category === 'skill_book') {
      appendNum('#modal-ability-id', 'ability_id');
    }

    if (category === 'spell_book_spell') {
      appendNum('#modal-spell-id', 'spell_id');
    }

    const disassemblyCost = overlay.querySelector<HTMLInputElement>('#modal-disassembly-cost')?.value;
    formData.append('disassembly_cost', disassemblyCost || '0');

    // Icon
    const iconInput = overlay.querySelector<HTMLInputElement>('#modal-icon-input')!;
    const iconFile = iconInput.files?.[0];
    if (iconFile && iconFile.size > 0) {
      formData.append('icon', iconFile);
    } else if (this.acceptedBase64) {
      formData.append('icon_base64', this.acceptedBase64);
    }

    try {
      let result: ItemDefinitionResponse;
      if (this.mode === 'edit' && this.editItem) {
        result = await updateItem(this.editItem.id, formData);
      } else {
        result = await createItem(formData);
      }

      // Save recipes
      if (this.recipes.length > 0 || (this.mode === 'edit')) {
        const recipeData = this.recipes.map((r) => ({
          chance_percent: r.chance_percent,
          outputs: r.outputs.map((o) => ({
            output_item_def_id: o.output_item_def_id,
            quantity: o.quantity,
          })),
        }));
        await saveDisassemblyRecipes(result.id, recipeData);
      }

      this.onSave(result);
      this.close();
      document.removeEventListener('keydown', this.handleEsc);
    } catch (err) {
      errorEl.textContent = (err as Error).message;
      errorEl.style.display = '';
    }
  }

  private labelFor(category: string): string {
    const labels: Record<string, string> = {
      resource: 'Resource', food: 'Food', heal: 'Heal', weapon: 'Weapon',
      helmet: 'Helmet', chestplate: 'Chestplate', boots: 'Boots', shield: 'Shield',
      greaves: 'Greaves', bracer: 'Bracer', tool: 'Tool', ring: 'Ring', amulet: 'Amulet',
      skill_book: 'Skill Book', spell_book_spell: 'Spell Tome',
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

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
