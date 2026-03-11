import {
  listNpcs,
  createNpc,
  updateNpc,
  deleteNpc,
  uploadNpcIcon,
  type NpcResponse,
} from '../editor/api';
import { ImageGenDialog } from './image-gen-dialog';

export class NpcManager {
  private container!: HTMLElement;
  private npcs: NpcResponse[] = [];
  private editingNpcId: number | null = null;
  private acceptedBase64: string | null = null;
  private pendingIconFilename: string | null = null;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      this.npcs = await listNpcs();
      this.renderList();
    } catch (err) {
      this.showListError(`Failed to load: ${(err as Error).message}`);
    }
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="monster-manager">
        <div class="monster-form-col">
          <h2>NPCs</h2>
          <div class="monster-form-card">
            <h3 id="nm-form-title">Add New NPC</h3>
            <p id="nm-error" class="error" style="display:none"></p>
            <label for="nm-name">Name *</label>
            <input id="nm-name" type="text" maxlength="128" placeholder="e.g. Village Elder" />
            <label for="nm-description">Description *</label>
            <textarea id="nm-description" rows="3" placeholder="e.g. A wise elder who guides travellers." style="width:100%;resize:vertical;"></textarea>
            <label>Icon (PNG, max 2 MB)</label>
            <div class="file-upload-row" style="margin-bottom:0.5rem;">
              <button type="button" class="btn btn--secondary" id="nm-choose-btn">Choose File</button>
              <button type="button" class="btn btn--secondary" id="nm-ai-gen-btn" disabled>Generate with AI</button>
              <span id="nm-icon-filename" class="file-name-text">No file chosen</span>
              <input id="nm-icon" type="file" accept="image/png" style="display:none;" />
            </div>
            <div id="nm-icon-preview" style="display:none;margin-top:6px;">
              <p style="font-size:0.75rem;color:#5a6280;margin:0 0 4px;">Current icon:</p>
              <img id="nm-icon-img" src="" alt="icon"
                style="height:48px;width:48px;object-fit:contain;border-radius:0.375rem;border:1px solid #1e2232;image-rendering:pixelated;" />
            </div>
            <div class="form-actions">
              <button class="btn" id="nm-cancel-btn" style="display:none">Cancel</button>
              <button class="btn btn--primary" id="nm-save-btn">Add NPC</button>
            </div>
          </div>
        </div>

        <div class="monster-list-col">
          <div id="nm-list-wrap">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#nm-save-btn')!.addEventListener('click', () => {
      void this.handleSave();
    });
    this.container.querySelector('#nm-cancel-btn')!.addEventListener('click', () => {
      this.cancelEdit();
    });

    const iconInput = this.container.querySelector<HTMLInputElement>('#nm-icon')!;
    this.container.querySelector('#nm-choose-btn')!.addEventListener('click', () => iconInput.click());
    iconInput.addEventListener('change', () => {
      const file = iconInput.files?.[0];
      const nameEl = this.container.querySelector<HTMLElement>('#nm-icon-filename')!;
      nameEl.textContent = file ? file.name : 'No file chosen';
      if (file) {
        const preview = this.container.querySelector<HTMLElement>('#nm-icon-preview')!;
        const img = this.container.querySelector<HTMLImageElement>('#nm-icon-img')!;
        img.src = URL.createObjectURL(file);
        preview.style.display = '';
        this.acceptedBase64 = null;
        this.pendingIconFilename = null;
      }
    });

    this.container.querySelector('#nm-ai-gen-btn')!.addEventListener('click', () => {
      void this.handleAiGen();
    });

    const nameInput = this.container.querySelector<HTMLInputElement>('#nm-name')!;
    nameInput.addEventListener('input', () => {
      const aiBtn = this.container.querySelector<HTMLButtonElement>('#nm-ai-gen-btn')!;
      aiBtn.disabled = !nameInput.value.trim();
    });
  }

  // ── List ──────────────────────────────────────────────────────────────────

  private renderList(): void {
    const wrap = this.container.querySelector<HTMLElement>('#nm-list-wrap')!;
    if (this.npcs.length === 0) {
      wrap.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No NPCs yet. Create one using the form.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'npc-grid';

    for (const n of this.npcs) {
      grid.appendChild(this.buildNpcCard(n));
    }

    wrap.innerHTML = '';
    wrap.appendChild(grid);
  }

  private buildNpcCard(n: NpcResponse): HTMLElement {
    const card = document.createElement('div');
    card.className = 'npc-card';
    card.dataset['id'] = String(n.id);

    card.innerHTML = `
      <div class="npc-card-icon">
        <img src="${n.icon_url}" alt="${this.esc(n.name)}" />
      </div>
      <div class="npc-card-name">${this.esc(n.name)}</div>
      <div class="npc-card-desc">${this.esc(n.description)}</div>
      <div class="monster-card-actions">
        <button class="btn btn--sm btn--edit" data-id="${n.id}">Edit</button>
        <button class="btn btn--sm btn--danger btn--delete" data-id="${n.id}">Delete</button>
      </div>
    `;

    card.querySelector<HTMLButtonElement>('.btn--edit')!.addEventListener('click', () => {
      this.startEdit(n);
    });

    card.querySelector<HTMLButtonElement>('.btn--delete')!.addEventListener('click', () => {
      void this.handleDelete(n.id);
    });

    return card;
  }

  // ── Save / Edit / Delete ──────────────────────────────────────────────────

  private async handleSave(): Promise<void> {
    const errEl = this.container.querySelector<HTMLElement>('#nm-error')!;
    errEl.style.display = 'none';

    const name = (this.container.querySelector<HTMLInputElement>('#nm-name')?.value ?? '').trim();
    const description = (this.container.querySelector<HTMLTextAreaElement>('#nm-description')?.value ?? '').trim();
    const iconFile = this.container.querySelector<HTMLInputElement>('#nm-icon')?.files?.[0];

    if (!name) { this.showFormError('Name is required.'); return; }
    if (!description) { this.showFormError('Description is required.'); return; }

    const saveBtn = this.container.querySelector<HTMLButtonElement>('#nm-save-btn')!;
    saveBtn.disabled = true;

    try {
      // Resolve icon_filename: file upload → AI base64 upload → existing filename on edit
      let iconFilename = this.pendingIconFilename;

      if (iconFile) {
        const uploaded = await uploadNpcIcon(iconFile);
        iconFilename = uploaded.icon_filename;
        const preview = this.container.querySelector<HTMLElement>('#nm-icon-preview')!;
        const img = this.container.querySelector<HTMLImageElement>('#nm-icon-img')!;
        img.src = uploaded.icon_url;
        preview.style.display = '';
      } else if (this.acceptedBase64) {
        // Upload AI-generated base64 as PNG via a synthetic File
        const binary = atob(this.acceptedBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/png' });
        const file = new File([blob], 'ai-generated.png', { type: 'image/png' });
        const uploaded = await uploadNpcIcon(file);
        iconFilename = uploaded.icon_filename;
      }

      if (this.editingNpcId !== null) {
        const data: Parameters<typeof updateNpc>[1] = { name, description };
        if (iconFilename) data.icon_filename = iconFilename;
        const updated = await updateNpc(this.editingNpcId, data);
        const idx = this.npcs.findIndex((n) => n.id === updated.id);
        if (idx >= 0) this.npcs[idx] = updated;
      } else {
        if (!iconFilename) { this.showFormError('Please choose or generate an icon.'); return; }
        const created = await createNpc({ name, description, icon_filename: iconFilename });
        this.npcs.unshift(created);
      }

      this.cancelEdit();
      this.renderList();
    } catch (err) {
      this.showFormError((err as Error).message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  private startEdit(n: NpcResponse): void {
    this.editingNpcId = n.id;
    this.pendingIconFilename = n.icon_filename;
    this.acceptedBase64 = null;

    this.container.querySelector<HTMLElement>('#nm-form-title')!.textContent = `Edit: ${n.name}`;
    this.container.querySelector<HTMLElement>('#nm-save-btn')!.textContent = 'Save Changes';
    this.container.querySelector<HTMLElement>('#nm-cancel-btn')!.style.display = '';
    this.container.querySelector<HTMLElement>('#nm-error')!.style.display = 'none';

    (this.container.querySelector<HTMLInputElement>('#nm-name'))!.value = n.name;
    (this.container.querySelector<HTMLTextAreaElement>('#nm-description'))!.value = n.description;
    (this.container.querySelector<HTMLInputElement>('#nm-icon'))!.value = '';
    this.container.querySelector<HTMLElement>('#nm-icon-filename')!.textContent = 'No file chosen';

    const aiBtn = this.container.querySelector<HTMLButtonElement>('#nm-ai-gen-btn')!;
    aiBtn.disabled = false;

    const preview = this.container.querySelector<HTMLElement>('#nm-icon-preview')!;
    const img = this.container.querySelector<HTMLImageElement>('#nm-icon-img')!;
    img.src = n.icon_url;
    preview.style.display = '';

    this.container.querySelector('.monster-form-col')!.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private cancelEdit(): void {
    this.editingNpcId = null;
    this.acceptedBase64 = null;
    this.pendingIconFilename = null;

    this.container.querySelector<HTMLElement>('#nm-form-title')!.textContent = 'Add New NPC';
    this.container.querySelector<HTMLElement>('#nm-save-btn')!.textContent = 'Add NPC';
    this.container.querySelector<HTMLElement>('#nm-cancel-btn')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#nm-error')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#nm-icon-preview')!.style.display = 'none';

    (this.container.querySelector<HTMLInputElement>('#nm-name'))!.value = '';
    (this.container.querySelector<HTMLTextAreaElement>('#nm-description'))!.value = '';
    (this.container.querySelector<HTMLInputElement>('#nm-icon'))!.value = '';
    this.container.querySelector<HTMLElement>('#nm-icon-filename')!.textContent = 'No file chosen';

    const aiBtn = this.container.querySelector<HTMLButtonElement>('#nm-ai-gen-btn')!;
    aiBtn.disabled = true;
  }

  private async handleDelete(id: number): Promise<void> {
    const n = this.npcs.find((x) => x.id === id);
    if (!confirm(`Delete "${n?.name}"? This cannot be undone.`)) return;
    try {
      await deleteNpc(id);
      this.npcs = this.npcs.filter((x) => x.id !== id);
      if (this.editingNpcId === id) this.cancelEdit();
      this.renderList();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  }

  private async handleAiGen(): Promise<void> {
    const name = (this.container.querySelector<HTMLInputElement>('#nm-name')?.value ?? '').trim();
    const description = (this.container.querySelector<HTMLTextAreaElement>('#nm-description')?.value ?? '').trim();
    if (!name) return;
    const dialog = new ImageGenDialog();
    await dialog.open(name, (base64) => {
      this.acceptedBase64 = base64;
      this.pendingIconFilename = null;
      const preview = this.container.querySelector<HTMLElement>('#nm-icon-preview')!;
      const img = this.container.querySelector<HTMLImageElement>('#nm-icon-img')!;
      img.src = `data:image/png;base64,${base64}`;
      preview.style.display = '';
      const iconInput = this.container.querySelector<HTMLInputElement>('#nm-icon')!;
      iconInput.value = '';
      const nameEl = this.container.querySelector<HTMLElement>('#nm-icon-filename');
      if (nameEl) nameEl.textContent = 'AI generated';
    }, description ? { NPC_DESCRIPTION: description } : undefined);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#nm-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showListError(msg: string): void {
    const wrap = this.container.querySelector<HTMLElement>('#nm-list-wrap');
    if (wrap) wrap.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
