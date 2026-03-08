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
      </div>
    `;

    this.container.querySelector<HTMLFormElement>('#config-form')!
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSave();
      });
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
