import {
  getImagePrompts,
  createImagePrompt,
  updateImagePrompt,
  deleteImagePrompt,
  type ImagePromptTemplate,
} from '../editor/api';

export class ImagePromptManager {
  private container!: HTMLElement;
  private prompts: ImagePromptTemplate[] = [];
  private editingId: number | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      this.prompts = await getImagePrompts();
      this.renderList();
    } catch (err) {
      this.showListError(`Failed to load prompts: ${(err as Error).message}`);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="item-manager-layout">
        <div class="item-form-col">
          <h2>Image Prompts</h2>
          <div class="item-form-card">
            <h3 id="prompt-form-title">Add New Prompt</h3>
            <p id="prompt-error" class="error" style="display:none"></p>
            <form id="prompt-form" autocomplete="off">
              <label for="prompt-name">Name *</label>
              <input id="prompt-name" name="name" type="text" maxlength="128" required
                placeholder="e.g. Fantasy Item Icon" />

              <label for="prompt-body">Prompt Template *</label>
              <textarea id="prompt-body" name="body" rows="6" required
                placeholder="e.g. A fantasy RPG icon of a &lt;ITEM_NAME&gt;. Pixel art, transparent background."></textarea>
              <p style="font-size:0.7rem;color:#5a6280;margin-top:0.25rem;">
                Use <code>&lt;PLACEHOLDER&gt;</code> syntax for dynamic values,
                e.g. <code>&lt;ITEM_NAME&gt;</code>, <code>&lt;MONSTER_NAME&gt;</code>.
              </p>

              <div class="form-actions">
                <button type="button" class="btn" id="prompt-form-cancel" style="display:none">Cancel</button>
                <button type="submit" class="btn btn--primary" id="prompt-form-submit">Add Prompt</button>
              </div>
            </form>
          </div>
        </div>

        <div class="item-list-col">
          <div id="prompt-list-container">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>
      </div>
    `;

    this.attachFormListeners();
  }

  private attachFormListeners(): void {
    const form = this.container.querySelector<HTMLFormElement>('#prompt-form')!;
    const cancelBtn = this.container.querySelector<HTMLButtonElement>('#prompt-form-cancel')!;

    cancelBtn.addEventListener('click', () => this.resetForm());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    });
  }

  private async handleSubmit(form: HTMLFormElement): Promise<void> {
    const errorEl = this.container.querySelector<HTMLElement>('#prompt-error')!;
    errorEl.style.display = 'none';

    const name = (form.querySelector<HTMLInputElement>('[name="name"]')!).value.trim();
    const body = (form.querySelector<HTMLTextAreaElement>('[name="body"]')!).value.trim();

    if (!name) { this.showFormError('Name is required.'); return; }
    if (!body) { this.showFormError('Prompt body is required.'); return; }

    try {
      if (this.editingId !== null) {
        const updated = await updateImagePrompt(this.editingId, { name, body });
        const idx = this.prompts.findIndex((p) => p.id === updated.id);
        if (idx >= 0) this.prompts[idx] = updated;
        else this.prompts.unshift(updated);
      } else {
        const created = await createImagePrompt({ name, body });
        this.prompts.unshift(created);
      }
      this.resetForm();
      this.renderList();
    } catch (err) {
      this.showFormError((err as Error).message);
    }
  }

  private resetForm(): void {
    this.editingId = null;
    const form = this.container.querySelector<HTMLFormElement>('#prompt-form')!;
    form.reset();
    this.container.querySelector<HTMLElement>('#prompt-form-title')!.textContent = 'Add New Prompt';
    this.container.querySelector<HTMLElement>('#prompt-form-submit')!.textContent = 'Add Prompt';
    this.container.querySelector<HTMLElement>('#prompt-form-cancel')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#prompt-error')!.style.display = 'none';
  }

  private populateForm(prompt: ImagePromptTemplate): void {
    this.editingId = prompt.id;
    const form = this.container.querySelector<HTMLFormElement>('#prompt-form')!;
    form.querySelector<HTMLInputElement>('[name="name"]')!.value = prompt.name;
    form.querySelector<HTMLTextAreaElement>('[name="body"]')!.value = prompt.body;
    this.container.querySelector<HTMLElement>('#prompt-form-title')!.textContent = `Edit Prompt #${prompt.id}`;
    this.container.querySelector<HTMLElement>('#prompt-form-submit')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#prompt-form-cancel')!.style.display = '';
    this.container.querySelector<HTMLElement>('#prompt-error')!.style.display = 'none';
  }

  private renderList(): void {
    const container = this.container.querySelector<HTMLElement>('#prompt-list-container')!;

    if (this.prompts.length === 0) {
      container.innerHTML = '<p>No prompts yet. Create one using the form.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'item-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Template Preview</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody')!;
    for (const prompt of this.prompts) {
      const tr = document.createElement('tr');
      const bodyPreview = prompt.body.length > 80
        ? this.esc(prompt.body.slice(0, 80)) + '…'
        : this.esc(prompt.body);

      tr.innerHTML = `
        <td style="font-weight:600;">${this.esc(prompt.name)}</td>
        <td style="font-size:0.8rem;color:#5a6280;font-family:monospace;">${bodyPreview}</td>
        <td>
          <button class="btn btn--sm btn-edit" data-id="${prompt.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn-delete" data-id="${prompt.id}">Delete</button>
        </td>
      `;

      tr.querySelector('.btn-edit')!.addEventListener('click', () => {
        this.populateForm(prompt);
      });

      tr.querySelector('.btn-delete')!.addEventListener('click', async () => {
        if (!confirm(`Delete prompt "${prompt.name}"? This cannot be undone.`)) return;
        try {
          await deleteImagePrompt(prompt.id);
          this.prompts = this.prompts.filter((p) => p.id !== prompt.id);
          if (this.editingId === prompt.id) this.resetForm();
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

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#prompt-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showListError(msg: string): void {
    const container = this.container.querySelector<HTMLElement>('#prompt-list-container');
    if (container) container.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
