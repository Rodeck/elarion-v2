import { getFatigueConfigs, updateFatigueConfig, uploadFatigueIcon } from '../editor/api';

const COMBAT_TYPES = [
  { key: 'monster', label: 'Monster Combat' },
  { key: 'boss', label: 'Boss Combat' },
  { key: 'pvp', label: 'PvP Arena' },
] as const;

export class FatigueConfigManager {
  private container!: HTMLElement;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      const configs = await getFatigueConfigs();
      for (const cfg of configs) {
        const prefix = `fatigue-${cfg.combat_type}`;
        const startInput = this.container.querySelector<HTMLInputElement>(`#${prefix}-start-round`);
        const baseInput = this.container.querySelector<HTMLInputElement>(`#${prefix}-base-damage`);
        const incrInput = this.container.querySelector<HTMLInputElement>(`#${prefix}-increment`);
        if (startInput) startInput.value = String(cfg.start_round);
        if (baseInput) baseInput.value = String(cfg.base_damage);
        if (incrInput) incrInput.value = String(cfg.damage_increment);
        this.updateStatusLabel(cfg.combat_type, cfg.start_round);
        this.updateIconPreview(cfg.combat_type, cfg.icon_url);
      }
    } catch (err) {
      this.showStatus(`Failed to load fatigue config: ${(err as Error).message}`, true);
    }
  }

  private render(): void {
    const sections = COMBAT_TYPES.map(({ key, label }) => `
      <div class="item-form-card" style="margin-top:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3>${label}</h3>
          <span id="fatigue-${key}-status-label" style="font-size:0.75rem;padding:2px 8px;border-radius:4px;"></span>
        </div>
        <form id="fatigue-${key}-form" autocomplete="off" style="margin-top:0.75rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">
            <div>
              <label for="fatigue-${key}-start-round">Start Round</label>
              <input type="number" id="fatigue-${key}-start-round" min="0" step="1" value="0" style="width:100%;" />
              <p style="font-size:0.65rem;color:#5a6280;margin-top:2px;">0 = disabled</p>
            </div>
            <div>
              <label for="fatigue-${key}-base-damage">Base Damage</label>
              <input type="number" id="fatigue-${key}-base-damage" min="0" step="1" value="5" style="width:100%;" />
              <p style="font-size:0.65rem;color:#5a6280;margin-top:2px;">First fatigue round</p>
            </div>
            <div>
              <label for="fatigue-${key}-increment">Increment</label>
              <input type="number" id="fatigue-${key}-increment" min="0" step="1" value="3" style="width:100%;" />
              <p style="font-size:0.65rem;color:#5a6280;margin-top:2px;">Added each round</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:1rem;margin-top:1rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <label style="margin:0;white-space:nowrap;">Fatigue Icon</label>
              <div id="fatigue-${key}-icon-preview" style="width:32px;height:32px;border:2px solid #3a2e1a;border-radius:4px;background:#1a1510;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                <span style="font-size:0.5rem;color:#5a4a2a;">None</span>
              </div>
              <input type="file" id="fatigue-${key}-icon-input" accept="image/png" style="display:none;" />
              <button type="button" id="fatigue-${key}-icon-btn" class="btn" style="font-size:0.7rem;padding:4px 10px;">Upload Icon</button>
            </div>
            <div style="flex:1;"></div>
            <button type="submit" class="btn btn--primary">Save ${label}</button>
          </div>
        </form>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div style="max-width:700px;margin:2rem auto;padding:0 1rem;">
        <h2>Fatigue Configuration</h2>
        <p style="font-size:0.8rem;color:#5a6280;margin-bottom:0.5rem;">
          Configure when fatigue activates and how much damage it deals per combat type.
          Fatigue deals escalating true damage to both combatants after the start round.
        </p>
        <p id="fatigue-status" style="display:none;margin-bottom:0.75rem;padding:0.5rem 0.75rem;border-radius:0.375rem;font-size:0.875rem;"></p>
        ${sections}
      </div>
    `;

    for (const { key } of COMBAT_TYPES) {
      this.container.querySelector<HTMLFormElement>(`#fatigue-${key}-form`)!
        .addEventListener('submit', (e) => {
          e.preventDefault();
          void this.handleSave(key);
        });

      const iconBtn = this.container.querySelector<HTMLButtonElement>(`#fatigue-${key}-icon-btn`)!;
      const iconInput = this.container.querySelector<HTMLInputElement>(`#fatigue-${key}-icon-input`)!;

      iconBtn.addEventListener('click', () => iconInput.click());
      iconInput.addEventListener('change', () => {
        const file = iconInput.files?.[0];
        if (file) void this.handleIconUpload(key, file);
        iconInput.value = '';
      });
    }
  }

  private async handleSave(combatType: string): Promise<void> {
    const prefix = `fatigue-${combatType}`;
    const startRound = parseInt(this.container.querySelector<HTMLInputElement>(`#${prefix}-start-round`)!.value, 10);
    const baseDamage = parseInt(this.container.querySelector<HTMLInputElement>(`#${prefix}-base-damage`)!.value, 10);
    const increment = parseInt(this.container.querySelector<HTMLInputElement>(`#${prefix}-increment`)!.value, 10);

    if (isNaN(startRound) || startRound < 0 || isNaN(baseDamage) || baseDamage < 0 || isNaN(increment) || increment < 0) {
      this.showStatus('All values must be non-negative integers.', true);
      return;
    }

    try {
      await updateFatigueConfig(combatType, {
        start_round: startRound,
        base_damage: baseDamage,
        damage_increment: increment,
      });
      this.updateStatusLabel(combatType, startRound);
      const label = COMBAT_TYPES.find((t) => t.key === combatType)?.label ?? combatType;
      this.showStatus(`${label} fatigue settings saved.`, false);
    } catch (err) {
      this.showStatus(`Failed to save: ${(err as Error).message}`, true);
    }
  }

  private async handleIconUpload(combatType: string, file: File): Promise<void> {
    try {
      const result = await uploadFatigueIcon(combatType, file);
      this.updateIconPreview(combatType, result.icon_url);
      const label = COMBAT_TYPES.find((t) => t.key === combatType)?.label ?? combatType;
      this.showStatus(`${label} fatigue icon uploaded.`, false);
    } catch (err) {
      this.showStatus(`Failed to upload icon: ${(err as Error).message}`, true);
    }
  }

  private updateIconPreview(combatType: string, iconUrl: string | null): void {
    const preview = this.container.querySelector<HTMLElement>(`#fatigue-${combatType}-icon-preview`);
    if (!preview) return;
    if (iconUrl) {
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = 'Fatigue icon';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      img.onerror = () => {
        img.remove();
        preview.innerHTML = '<span style="font-size:0.5rem;color:#5a4a2a;">Error</span>';
      };
      preview.appendChild(img);
    } else {
      preview.innerHTML = '<span style="font-size:0.5rem;color:#5a4a2a;">None</span>';
    }
  }

  private updateStatusLabel(combatType: string, startRound: number): void {
    const el = this.container.querySelector<HTMLElement>(`#fatigue-${combatType}-status-label`);
    if (!el) return;
    if (startRound === 0) {
      el.textContent = 'Disabled';
      el.style.background = '#2a1a1a';
      el.style.color = '#f87171';
    } else {
      el.textContent = `Active (round ${startRound})`;
      el.style.background = '#1a2a1a';
      el.style.color = '#4ade80';
    }
  }

  private showStatus(msg: string, isError: boolean): void {
    const el = this.container.querySelector<HTMLElement>('#fatigue-status')!;
    el.textContent = msg;
    el.style.display = '';
    el.style.background = isError ? '#2a1a1a' : '#1a2a1a';
    el.style.color = isError ? '#f87171' : '#4ade80';
    el.style.border = isError ? '1px solid #7f1d1d' : '1px solid #166534';
  }
}
