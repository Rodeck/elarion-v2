import {
  getAdminConfig,
  updateAdminConfig,
  VALID_IMAGE_GEN_MODELS,
} from '../editor/api';

export class AdminConfigManager {
  private container!: HTMLElement;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      const config = await getAdminConfig();
      const select = this.container.querySelector<HTMLSelectElement>('#config-image-model')!;
      if (config['image_gen_model']) {
        select.value = config['image_gen_model'];
      }
      // Load icon previews
      if (config['xp_icon_filename']) {
        this.showIconPreview('xp', `/ui-icons/${config['xp_icon_filename']}`);
      }
      if (config['crowns_icon_filename']) {
        this.showIconPreview('crowns', `/ui-icons/${config['crowns_icon_filename']}`);
      }
      if (config['rod_upgrade_points_icon_filename']) {
        this.showIconPreview('rod_upgrade_points', `/ui-icons/${config['rod_upgrade_points_icon_filename']}`);
      }
    } catch (err) {
      this.showStatus(`Failed to load config: ${(err as Error).message}`, true);
    }
  }

  private render(): void {
    const modelOptions = VALID_IMAGE_GEN_MODELS
      .map((m) => `<option value="${m}">${m}</option>`)
      .join('');

    this.container.innerHTML = `
      <div style="max-width:600px;margin:2rem auto;padding:0 1rem;">
        <h2>Admin Configuration</h2>
        <div class="item-form-card" style="margin-top:1rem;">
          <h3>AI Image Generation</h3>
          <p id="config-status" style="display:none;margin-bottom:0.75rem;padding:0.5rem 0.75rem;border-radius:0.375rem;font-size:0.875rem;"></p>
          <form id="config-form" autocomplete="off">
            <label for="config-image-model">Image Generation Model</label>
            <select id="config-image-model" name="image_gen_model" style="width:100%;">
              ${modelOptions}
            </select>
            <p style="font-size:0.7rem;color:#5a6280;margin-top:0.25rem;">
              Model used when generating images via OpenRouter. Default: google/gemini-2.5-flash-image.
            </p>
            <div class="form-actions" style="margin-top:1.25rem;">
              <button type="submit" class="btn btn--primary">Save Settings</button>
            </div>
          </form>
        </div>

        <div class="item-form-card" style="margin-top:1.5rem;">
          <h3>UI Icons</h3>
          <p style="font-size:0.75rem;color:#5a6280;margin-bottom:1rem;">Upload PNG icons for XP and Crowns. These replace the default symbols in game UI.</p>

          <div style="display:flex;gap:2rem;">
            <div style="flex:1;">
              <label>XP Icon</label>
              <div id="xp-icon-preview" style="margin:6px 0;">
                <span style="font-size:2rem;color:#a78bfa;">✦</span>
              </div>
              <button type="button" class="btn btn--secondary" id="xp-icon-upload-btn" style="width:100%;">Upload XP Icon</button>
              <input type="file" id="xp-icon-input" accept="image/png" style="display:none;" />
            </div>

            <div style="flex:1;">
              <label>Crowns Icon</label>
              <div id="crowns-icon-preview" style="margin:6px 0;">
                <span style="font-size:2rem;color:#f0c060;">♛</span>
              </div>
              <button type="button" class="btn btn--secondary" id="crowns-icon-upload-btn" style="width:100%;">Upload Crowns Icon</button>
              <input type="file" id="crowns-icon-input" accept="image/png" style="display:none;" />
            </div>

            <div style="flex:1;">
              <label>Rod Upgrade Points Icon</label>
              <div id="rod_upgrade_points-icon-preview" style="margin:6px 0;">
                <span style="font-size:2rem;color:#4ba8d4;">🎣</span>
              </div>
              <button type="button" class="btn btn--secondary" id="rod_upgrade_points-icon-upload-btn" style="width:100%;">Upload Rod Pts Icon</button>
              <input type="file" id="rod_upgrade_points-icon-input" accept="image/png" style="display:none;" />
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector<HTMLFormElement>('#config-form')!
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSave();
      });

    // XP icon upload
    this.container.querySelector('#xp-icon-upload-btn')!.addEventListener('click', () => {
      (this.container.querySelector('#xp-icon-input') as HTMLInputElement).click();
    });
    this.container.querySelector('#xp-icon-input')!.addEventListener('change', () => {
      void this.handleIconUpload('xp');
    });

    // Crowns icon upload
    this.container.querySelector('#crowns-icon-upload-btn')!.addEventListener('click', () => {
      (this.container.querySelector('#crowns-icon-input') as HTMLInputElement).click();
    });
    this.container.querySelector('#crowns-icon-input')!.addEventListener('change', () => {
      void this.handleIconUpload('crowns');
    });

    // Rod Upgrade Points icon upload
    this.container.querySelector('#rod_upgrade_points-icon-upload-btn')!.addEventListener('click', () => {
      (this.container.querySelector('#rod_upgrade_points-icon-input') as HTMLInputElement).click();
    });
    this.container.querySelector('#rod_upgrade_points-icon-input')!.addEventListener('change', () => {
      void this.handleIconUpload('rod_upgrade_points');
    });
  }

  private async handleIconUpload(type: 'xp' | 'crowns' | 'rod_upgrade_points'): Promise<void> {
    const input = this.container.querySelector<HTMLInputElement>(`#${type}-icon-input`)!;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const token = localStorage.getItem('admin_token');
      const form = new FormData();
      form.append('icon', file);
      const res = await fetch(`/api/admin-config/icon/${type}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this.showIconPreview(type, data.icon_url);
      const typeLabels: Record<string, string> = { xp: 'XP', crowns: 'Crowns', rod_upgrade_points: 'Rod Upgrade Points' };
      this.showStatus(`${typeLabels[type]} icon uploaded.`, false);
    } catch (err) {
      this.showStatus(`Failed to upload: ${(err as Error).message}`, true);
    }
    input.value = '';
  }

  private showIconPreview(type: 'xp' | 'crowns' | 'rod_upgrade_points', url: string): void {
    const preview = this.container.querySelector<HTMLElement>(`#${type}-icon-preview`);
    if (preview) {
      preview.innerHTML = `<img src="${url}" style="width:48px;height:48px;image-rendering:pixelated;border-radius:4px;border:1px solid #1e2232;" />`;
    }
  }

  private async handleSave(): Promise<void> {
    const select = this.container.querySelector<HTMLSelectElement>('#config-image-model')!;
    const model = select.value;

    try {
      await updateAdminConfig({ image_gen_model: model });
      this.showStatus('Settings saved successfully.', false);
    } catch (err) {
      this.showStatus(`Failed to save: ${(err as Error).message}`, true);
    }
  }

  private showStatus(msg: string, isError: boolean): void {
    const el = this.container.querySelector<HTMLElement>('#config-status')!;
    el.textContent = msg;
    el.style.display = '';
    el.style.background = isError ? '#2a1a1a' : '#1a2a1a';
    el.style.color = isError ? '#f87171' : '#4ade80';
    el.style.border = isError ? '1px solid #7f1d1d' : '1px solid #166534';
  }
}
