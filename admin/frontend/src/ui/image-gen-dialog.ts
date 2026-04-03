import {
  getImagePrompts,
  generateImageFromPrompt,
  generateImageFromRawPrompt,
  type ImagePromptTemplate,
} from '../editor/api';

export class ImageGenDialog {
  private overlay: HTMLElement | null = null;

  async open(entityName: string, onAccept: (base64: string) => void, extraVariables?: Record<string, string>): Promise<void> {
    // Load prompts
    let prompts: ImagePromptTemplate[] = [];
    try {
      prompts = await getImagePrompts();
    } catch (err) {
      alert(`Failed to load prompts: ${(err as Error).message}`);
      return;
    }

    if (prompts.length === 0) {
      alert('No image prompts found. Please create prompt templates first in the "Image Prompts" tab.');
      return;
    }

    // Build overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;
      display:flex;align-items:center;justify-content:center;padding:1rem;
    `;

    const promptOptions = prompts.map((p) => `<option value="${p.id}">${this.esc(p.name)}</option>`).join('');
    const hasTemplates = prompts.length > 0;
    const firstPromptBody = prompts[0]?.body ?? '';
    const resolved = firstPromptBody.replace(/<[A-Z_]+>/g, (m) => {
      const key = m.slice(1, -1);
      if (key.includes('NAME')) return entityName;
      if (extraVariables && key in extraVariables) return extraVariables[key]!;
      return m;
    });

    this.overlay.innerHTML = `
      <div style="
        background:#1a1e2e;border:1px solid #2d3347;border-radius:0.75rem;
        padding:1.5rem;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;
      ">
        <h3 style="margin:0 0 1rem;color:#c8cddf;font-size:1.1rem;">Generate Image with AI</h3>

        <label style="display:block;margin-bottom:0.25rem;font-size:0.7rem;color:#404666;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">
          Prompt Template
        </label>
        <select id="ai-prompt-select" style="width:100%;margin-bottom:0.75rem;">
          <option value="custom">Custom Prompt (paste your own)</option>
          ${promptOptions}
        </select>

        <div id="ai-custom-prompt-area" style="margin-bottom:0.75rem;">
          <label style="display:block;margin-bottom:0.25rem;font-size:0.7rem;color:#404666;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">
            Prompt Text
          </label>
          <textarea id="ai-custom-prompt" style="
            width:100%;min-height:6rem;background:#141726;border:1px solid #2d3347;border-radius:0.375rem;
            padding:0.625rem 0.75rem;font-size:0.8rem;color:#c8cddf;
            font-family:monospace;resize:vertical;
          " placeholder="Paste your full prompt here..."></textarea>
        </div>

        <div id="ai-template-preview-area" style="display:none;margin-bottom:0.75rem;">
          <label style="display:block;margin-bottom:0.25rem;font-size:0.7rem;color:#404666;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">
            Resolved Prompt Preview
          </label>
          <div id="ai-prompt-preview" style="
            background:#141726;border:1px solid #2d3347;border-radius:0.375rem;
            padding:0.625rem 0.75rem;font-size:0.8rem;color:#8a94b0;
            font-family:monospace;min-height:3rem;white-space:pre-wrap;
          ">${this.esc(resolved)}</div>
        </div>

        <p id="ai-error" style="display:none;color:#f87171;font-size:0.8rem;margin-bottom:0.75rem;"></p>

        <div id="ai-image-preview" style="display:none;margin-bottom:0.75rem;text-align:center;">
          <img id="ai-gen-img" src="" alt="Generated image"
            style="max-width:200px;max-height:200px;border-radius:0.375rem;border:1px solid #2d3347;image-rendering:pixelated;" />
        </div>

        <div style="display:flex;gap:0.5rem;justify-content:flex-end;flex-wrap:wrap;">
          <button class="btn" id="ai-cancel-btn">Cancel</button>
          <button class="btn btn--primary" id="ai-generate-btn">Generate</button>
          <button class="btn btn--primary" id="ai-accept-btn" style="display:none;">Accept Image</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const select = this.overlay.querySelector<HTMLSelectElement>('#ai-prompt-select')!;
    const previewDiv = this.overlay.querySelector<HTMLElement>('#ai-prompt-preview')!;
    const customArea = this.overlay.querySelector<HTMLElement>('#ai-custom-prompt-area')!;
    const templateArea = this.overlay.querySelector<HTMLElement>('#ai-template-preview-area')!;
    const customTextarea = this.overlay.querySelector<HTMLTextAreaElement>('#ai-custom-prompt')!;
    const generateBtn = this.overlay.querySelector<HTMLButtonElement>('#ai-generate-btn')!;
    const acceptBtn = this.overlay.querySelector<HTMLButtonElement>('#ai-accept-btn')!;
    const cancelBtn = this.overlay.querySelector<HTMLButtonElement>('#ai-cancel-btn')!;
    const errorEl = this.overlay.querySelector<HTMLElement>('#ai-error')!;
    const imagePreview = this.overlay.querySelector<HTMLElement>('#ai-image-preview')!;
    const genImg = this.overlay.querySelector<HTMLImageElement>('#ai-gen-img')!;

    let currentBase64 = '';

    const isCustom = () => select.value === 'custom';

    const updatePreview = () => {
      if (isCustom()) {
        customArea.style.display = '';
        templateArea.style.display = 'none';
      } else {
        customArea.style.display = 'none';
        templateArea.style.display = '';
        const selectedId = parseInt(select.value, 10);
        const prompt = prompts.find((p) => p.id === selectedId);
        if (prompt) {
          const res = prompt.body.replace(/<[A-Z_]+>/g, (m) => {
            const key = m.slice(1, -1);
            if (key.includes('NAME')) return entityName;
            if (extraVariables && key in extraVariables) return extraVariables[key]!;
            return m;
          });
          previewDiv.textContent = res;
        }
      }
    };

    // Set initial state: if no templates, default to custom
    if (!hasTemplates) {
      select.value = 'custom';
    }
    updatePreview();

    select.addEventListener('change', updatePreview);

    generateBtn.addEventListener('click', async () => {
      errorEl.style.display = 'none';
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating…';
      imagePreview.style.display = 'none';
      acceptBtn.style.display = 'none';
      currentBase64 = '';

      try {
        let result;
        if (isCustom()) {
          const rawPrompt = customTextarea.value.trim();
          if (!rawPrompt) {
            errorEl.textContent = 'Please enter a prompt.';
            errorEl.style.display = '';
            return;
          }
          result = await generateImageFromRawPrompt(rawPrompt);
        } else {
          const selectedId = parseInt(select.value, 10);
          const prompt = prompts.find((p) => p.id === selectedId);
          if (!prompt) return;

          const variables: Record<string, string> = {};
          const placeholders = prompt.body.match(/<[A-Z_]+>/g) ?? [];
          for (const ph of placeholders) {
            const key = ph.slice(1, -1);
            if (key.includes('NAME')) variables[key] = entityName;
            else if (extraVariables && key in extraVariables) variables[key] = extraVariables[key]!;
            else variables[key] = entityName;
          }
          result = await generateImageFromPrompt(selectedId, variables);
        }

        currentBase64 = result.base64;
        genImg.src = `data:image/png;base64,${result.base64}`;
        imagePreview.style.display = '';
        acceptBtn.style.display = '';
      } catch (err) {
        errorEl.textContent = `Generation failed: ${(err as Error).message}`;
        errorEl.style.display = '';
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
      }
    });

    acceptBtn.addEventListener('click', () => {
      if (currentBase64) {
        onAccept(currentBase64);
        this.close();
      }
    });

    cancelBtn.addEventListener('click', () => this.close());

    // Close on backdrop click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
