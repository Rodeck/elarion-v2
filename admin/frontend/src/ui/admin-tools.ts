import {
  getCharacters,
  getItems,
  grantItem,
  type CharacterSummary,
  type ItemDefinitionResponse,
} from '../editor/api';

export class AdminTools {
  private container!: HTMLElement;
  private characters: CharacterSummary[] = [];
  private items: ItemDefinitionResponse[] = [];

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    const [chars, items] = await Promise.all([getCharacters(), getItems()]);
    this.characters = chars;
    this.items = items;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'admin-tools-wrap';

    const heading = document.createElement('h2');
    heading.textContent = 'Admin Tools';
    wrap.appendChild(heading);

    wrap.appendChild(this.buildGrantItemTool());
    this.container.appendChild(wrap);
  }

  private buildGrantItemTool(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'admin-card';

    const title = document.createElement('h3');
    title.textContent = 'Grant Item to Player';
    card.appendChild(title);

    const form = document.createElement('form');
    form.className = 'admin-form';

    // Character select
    const charGroup = this.fieldGroup('Character');
    const charSelect = document.createElement('select');
    charSelect.required = true;
    charSelect.innerHTML = '<option value="">— select character —</option>';
    for (const c of this.characters) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name}  (${c.class_name} Lv${c.level})`;
      charSelect.appendChild(opt);
    }
    charGroup.appendChild(charSelect);
    form.appendChild(charGroup);

    // Item select
    const itemGroup = this.fieldGroup('Item');
    const itemSelect = document.createElement('select');
    itemSelect.required = true;
    itemSelect.innerHTML = '<option value="">— select item —</option>';
    for (const item of this.items) {
      const opt = document.createElement('option');
      opt.value = String(item.id);
      opt.textContent = `${item.name}  (${item.category})`;
      itemSelect.appendChild(opt);
    }
    itemGroup.appendChild(itemSelect);
    form.appendChild(itemGroup);

    // Quantity input
    const qtyGroup = this.fieldGroup('Quantity');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.max = '9999';
    qtyInput.value = '1';
    qtyInput.style.width = '100px';
    qtyGroup.appendChild(qtyInput);
    form.appendChild(qtyGroup);

    // Actions row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'admin-actions-row';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn--primary';
    submitBtn.textContent = 'Grant Item';

    const feedback = document.createElement('span');
    feedback.className = 'feedback-text';

    actionsRow.appendChild(submitBtn);
    actionsRow.appendChild(feedback);
    form.appendChild(actionsRow);

    // Reconnect note
    const note = document.createElement('p');
    note.className = 'admin-note';
    note.textContent = 'Changes are reflected immediately in the database. If the player is online they will see updated inventory on next reconnect.';
    form.appendChild(note);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const characterId = charSelect.value;
      const itemDefId = parseInt(itemSelect.value, 10);
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);

      if (!characterId || !itemDefId) return;

      submitBtn.disabled = true;
      feedback.style.color = '#8a94b0';
      feedback.textContent = 'Granting…';

      try {
        const result = await grantItem(characterId, itemDefId, qty);
        feedback.style.color = '#4ade80';
        feedback.textContent = result.message;
        qtyInput.value = '1';
      } catch (err) {
        feedback.style.color = '#f87171';
        feedback.textContent = (err as Error).message || 'Error';
      } finally {
        submitBtn.disabled = false;
      }
    });

    card.appendChild(form);
    return card;
  }

  private fieldGroup(labelText: string): HTMLDivElement {
    const group = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    group.appendChild(lbl);
    return group;
  }
}
