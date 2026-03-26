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
    heading.style.marginBottom = '0';
    wrap.appendChild(heading);

    wrap.appendChild(this.buildGrantItemTool());
    wrap.appendChild(this.buildCommandsReference());
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

  private buildCommandsReference(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'admin-card';

    const title = document.createElement('h3');
    title.textContent = 'In-Game Admin Commands';
    card.appendChild(title);

    const intro = document.createElement('p');
    intro.className = 'admin-note';
    intro.textContent = 'Type these commands in the in-game chat. Only accounts with is_admin = true can use them.';
    card.appendChild(intro);

    const commands = [
      {
        syntax: '/level_up <player> [count]',
        description: 'Increases the named player\'s level by 1 (or by count if specified). Stats (HP, attack, defence) scale accordingly.',
        examples: ['/level_up Roddeck', '/level_up Roddeck 5'],
      },
      {
        syntax: '/item <player> <item_id> <quantity>',
        description: 'Grants the specified quantity of an item (by numeric ID) to the named player\'s inventory. If the player is online the update is immediate.',
        examples: ['/item Roddeck 1 1', '/item Roddeck 3 50'],
      },
      {
        syntax: '/clear_inventory <player>',
        description: 'Removes all items from the named player\'s inventory, including equipped items. If the player is online their inventory panel refreshes immediately.',
        examples: ['/clear_inventory Roddeck'],
      },
      {
        syntax: '/day',
        description: 'Forces the day/night cycle to daytime immediately.',
        examples: ['/day'],
      },
      {
        syntax: '/night',
        description: 'Forces the day/night cycle to nighttime immediately.',
        examples: ['/night'],
      },
      {
        syntax: '/crown <player> <amount>',
        description: 'Grants the specified amount of crowns to the named player.',
        examples: ['/crown Roddeck 100'],
      },
      {
        syntax: '/skill_all <player>',
        description: 'Grants all available combat abilities to the named player.',
        examples: ['/skill_all Roddeck'],
      },
      {
        syntax: '/crafting_finish <player>',
        description: 'Instantly completes all active crafting sessions for the named player.',
        examples: ['/crafting_finish Roddeck'],
      },
      {
        syntax: '/heal <player> [hp]',
        description: 'Restores the named player\'s HP to full, or by the specified amount if provided.',
        examples: ['/heal Roddeck', '/heal Roddeck 50'],
      },
      {
        syntax: '/squire <player> <squire_def_id> [level]',
        description: 'Grants a squire to the named player by squire definition ID. Level defaults to 1 (range 1-20). Player must be online and have a free squire slot.',
        examples: ['/squire Roddeck 1', '/squire Roddeck 2 10'],
      },
      {
        syntax: '/expedition_finish <player>',
        description: 'Instantly completes all active expeditions for the named player. If the player is online they receive completion notifications.',
        examples: ['/expedition_finish Roddeck'],
      },
    ];

    const table = document.createElement('table');
    table.className = 'commands-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Syntax</th>
          <th>Description</th>
          <th>Examples</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    for (const cmd of commands) {
      const tr = document.createElement('tr');

      const tdSyntax = document.createElement('td');
      tdSyntax.innerHTML = `<code>${cmd.syntax}</code>`;

      const tdDesc = document.createElement('td');
      tdDesc.textContent = cmd.description;

      const tdExamples = document.createElement('td');
      tdExamples.innerHTML = cmd.examples.map((e) => `<code>${e}</code>`).join('<br>');

      tr.appendChild(tdSyntax);
      tr.appendChild(tdDesc);
      tr.appendChild(tdExamples);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    card.appendChild(table);

    const errorNote = document.createElement('p');
    errorNote.className = 'admin-note';
    errorNote.style.marginTop = '0.75rem';
    errorNote.innerHTML = '<strong>Responses:</strong> Commands reply only to you (not broadcast). Green <code>[Admin ✓]</code> = success. Red <code>[Admin ✗]</code> = error with reason.';
    card.appendChild(errorNote);

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
