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
    wrap.style.cssText = 'padding:16px;';

    const heading = document.createElement('h2');
    heading.textContent = 'Admin Tools';
    heading.style.cssText =
      'color:#d4a84b;font-family:Cinzel,serif;margin:0 0 20px;font-size:18px;letter-spacing:1px;';
    wrap.appendChild(heading);

    wrap.appendChild(this.buildGrantItemTool());
    this.container.appendChild(wrap);
  }

  private buildGrantItemTool(): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText =
      'background:#1a1814;border:1px solid #5a4a2a;border-radius:4px;padding:20px;max-width:500px;';

    const title = document.createElement('h3');
    title.textContent = 'Grant Item to Player';
    title.style.cssText =
      'color:#d4a84b;font-family:Cinzel,serif;margin:0 0 16px;font-size:13px;letter-spacing:1px;text-transform:uppercase;';
    card.appendChild(title);

    const form = document.createElement('form');
    form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    // Character select
    const charGroup = this.fieldGroup('Character');
    const charSelect = document.createElement('select');
    charSelect.required = true;
    charSelect.style.cssText = this.selectStyle();
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
    itemSelect.style.cssText = this.selectStyle();
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
    qtyInput.style.cssText =
      'width:80px;background:#0f0d0a;color:#d4b870;border:1px solid #5a4a2a;' +
      'padding:6px 8px;border-radius:2px;font-size:13px;outline:none;';
    qtyGroup.appendChild(qtyInput);
    form.appendChild(qtyGroup);

    // Actions row
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:4px;';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Grant Item';
    submitBtn.style.cssText =
      'background:#3a2f1a;color:#d4a84b;border:1px solid #8a6a30;border-radius:2px;' +
      'padding:7px 16px;cursor:pointer;font-family:Cinzel,serif;font-size:12px;letter-spacing:1px;';

    const feedback = document.createElement('span');
    feedback.style.cssText = 'font-size:12px;font-family:Crimson Text,serif;';

    actionsRow.appendChild(submitBtn);
    actionsRow.appendChild(feedback);
    form.appendChild(actionsRow);

    // Reconnect note
    const note = document.createElement('p');
    note.textContent = 'Changes are reflected immediately in the database. If the player is online they will see updated inventory on next reconnect.';
    note.style.cssText = 'color:#605040;font-size:11px;margin:4px 0 0;line-height:1.4;';
    form.appendChild(note);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const characterId = charSelect.value;
      const itemDefId = parseInt(itemSelect.value, 10);
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);

      if (!characterId || !itemDefId) return;

      submitBtn.disabled = true;
      feedback.style.color = '#a89060';
      feedback.textContent = 'Granting…';

      try {
        const result = await grantItem(characterId, itemDefId, qty);
        feedback.style.color = '#60a860';
        feedback.textContent = result.message;
        qtyInput.value = '1';
      } catch (err) {
        feedback.style.color = '#c05050';
        feedback.textContent = (err as Error).message || 'Error';
      } finally {
        submitBtn.disabled = false;
      }
    });

    card.appendChild(form);
    return card;
  }

  private fieldGroup(label: string): HTMLDivElement {
    const group = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText =
      'display:block;color:#a89060;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;';
    group.appendChild(lbl);
    return group;
  }

  private selectStyle(): string {
    return (
      'width:100%;background:#0f0d0a;color:#d4b870;border:1px solid #5a4a2a;' +
      'padding:6px 8px;border-radius:2px;font-size:13px;outline:none;'
    );
  }
}
