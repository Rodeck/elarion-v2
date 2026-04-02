import type {
  TrainingStatePayload,
  TrainingResultPayload,
  TrainingAttributesDto,
  TrainingDescriptionsDto,
} from '@elarion/protocol';

type SendFn = <T>(type: string, payload: T) => void;

const ATTR_KEYS: (keyof TrainingAttributesDto)[] = ['constitution', 'strength', 'intelligence', 'dexterity', 'toughness'];

const ATTR_LABELS: Record<keyof TrainingAttributesDto, string> = {
  constitution: 'Constitution',
  strength: 'Strength',
  intelligence: 'Intelligence',
  dexterity: 'Dexterity',
  toughness: 'Toughness',
};

export class TrainingModal {
  private overlay: HTMLElement | null = null;
  private parent: HTMLElement;
  private sendFn: SendFn | null = null;
  private npcId = 0;
  private feedbackEl: HTMLElement | null = null;

  // State from server
  private attributes: TrainingAttributesDto = { constitution: 0, strength: 0, intelligence: 0, dexterity: 0, toughness: 0 };
  private unspentPoints = 0;
  private perStatCap = 0;
  private descriptions: TrainingDescriptionsDto = { constitution: '', strength: '', intelligence: '', dexterity: '', toughness: '' };
  private baseStats = { hp: 0, attack: 0, defence: 0 };
  private equipmentStats = { attack: 0, defence: 0, max_mana: 0, crit_chance: 0, crit_damage: 0, dodge_chance: 0 };

  // Pending increments
  private increments: TrainingAttributesDto = { constitution: 0, strength: 0, intelligence: 0, dexterity: 0, toughness: 0 };

  constructor(parent: HTMLElement) {
    this.parent = parent;
  }

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  open(npcId: number): void {
    this.npcId = npcId;
    this.close();
    this.resetIncrements();
    this.buildOverlay();
    this.renderLoading();
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  handleState(payload: TrainingStatePayload): void {
    this.attributes = { ...payload.attributes };
    this.unspentPoints = payload.unspent_points;
    this.perStatCap = payload.per_stat_cap;
    this.descriptions = { ...payload.descriptions };
    this.baseStats = { ...payload.base_stats };
    this.equipmentStats = { ...payload.equipment_stats };
    this.resetIncrements();
    if (this.overlay) this.renderContent();
  }

  handleResult(payload: TrainingResultPayload): void {
    this.attributes = { ...payload.attributes };
    this.unspentPoints = payload.unspent_points;
    this.resetIncrements();
    this.showFeedback('Stats allocated successfully!', true);
    if (this.overlay) this.renderContent();
  }

  handleError(message: string): void {
    this.showFeedback(message, false);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private buildOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:200;display:flex;align-items:center;justify-content:center;';
    this.parent.appendChild(this.overlay);
  }

  private renderLoading(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = `<div style="color:#d4a84b;font-family:'Cinzel',serif;font-size:1.4rem;">Loading training data...</div>`;
  }

  private renderContent(): void {
    if (!this.overlay) return;

    const pendingSpend = this.totalPendingSpend();
    const remaining = this.unspentPoints - pendingSpend;

    let html = `<div style="background:#1a1510;border:1px solid #5a4a2a;border-radius:8px;max-width:680px;width:95%;max-height:90vh;overflow-y:auto;padding:0;display:flex;flex-direction:column;">`;

    // Header
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #3a2f1a;">`;
    html += `<span style="color:#d4a84b;font-family:'Cinzel',serif;font-size:1.4rem;">Stat Training</span>`;
    html += `<span style="color:#f0c060;font-family:'Rajdhani',sans-serif;font-size:1.2rem;">Unspent: <strong>${remaining}</strong></span>`;
    html += `<button class="training-close" style="background:none;border:none;color:#7a6a4a;font-size:1.6rem;cursor:pointer;padding:0 6px;">&times;</button>`;
    html += `</div>`;

    // Attribute rows
    html += `<div style="padding:16px 22px;flex:1;">`;
    for (const key of ATTR_KEYS) {
      const current = this.attributes[key];
      const inc = this.increments[key];
      const total = current + inc;
      const canAdd = remaining > 0 && total < this.perStatCap;
      const canSub = inc > 0;
      const desc = this.descriptions[key];

      html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:12px;background:#252119;border-radius:6px;">`;
      html += `<div style="flex:1;min-width:130px;">`;
      html += `<div style="color:#e8c870;font-family:'Cinzel',serif;font-size:1.1rem;">${ATTR_LABELS[key]}</div>`;
      html += `<div style="color:#8a7a5a;font-size:0.85rem;margin-top:3px;">${desc}</div>`;
      html += `</div>`;
      html += `<div style="display:flex;align-items:center;gap:8px;">`;
      html += `<button class="training-dec" data-attr="${key}" style="background:#3a2f1a;border:1px solid #5a4a2a;color:${canSub ? '#e8c870' : '#4a3f2a'};width:32px;height:32px;border-radius:4px;cursor:${canSub ? 'pointer' : 'default'};font-size:1.2rem;" ${canSub ? '' : 'disabled'}>−</button>`;
      html += `<span style="color:#f0c060;font-family:'Rajdhani',sans-serif;font-size:1.3rem;min-width:48px;text-align:center;">${total}`;
      if (inc > 0) html += `<span style="color:#b8e870;font-size:0.95rem;"> +${inc}</span>`;
      html += `</span>`;
      html += `<button class="training-inc" data-attr="${key}" style="background:#3a2f1a;border:1px solid #5a4a2a;color:${canAdd ? '#e8c870' : '#4a3f2a'};width:32px;height:32px;border-radius:4px;cursor:${canAdd ? 'pointer' : 'default'};font-size:1.2rem;" ${canAdd ? '' : 'disabled'}>+</button>`;
      html += `<span style="color:#5a4a2a;font-size:0.8rem;min-width:50px;text-align:right;">cap ${this.perStatCap}</span>`;
      html += `</div></div>`;
    }
    html += `</div>`;

    // Stat breakdown
    html += `<div style="padding:12px 22px;border-top:1px solid #3a2f1a;">`;
    html += `<div style="color:#8a7a5a;font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Derived Stats Preview</div>`;
    const preview = this.computePreview();
    const stats = [
      { label: 'HP', val: preview.maxHp, base: this.baseStats.hp, eq: 0 },
      { label: 'ATK', val: preview.attack, base: this.baseStats.attack, eq: this.equipmentStats.attack },
      { label: 'DEF', val: preview.defence, base: this.baseStats.defence, eq: this.equipmentStats.defence },
      { label: 'Mana', val: preview.maxMana, base: 100, eq: this.equipmentStats.max_mana },
      { label: 'Crit%', val: preview.critChance.toFixed(1), base: 0, eq: this.equipmentStats.crit_chance },
      { label: 'CritDmg%', val: preview.critDamage.toFixed(1), base: 150, eq: this.equipmentStats.crit_damage },
      { label: 'Dodge%', val: preview.dodgeChance.toFixed(1), base: 0, eq: this.equipmentStats.dodge_chance },
    ];
    html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px 12px;font-size:0.95rem;">`;
    for (const s of stats) {
      html += `<span style="color:#8a7a5a;">${s.label}</span>`;
      html += `<span style="color:#f0c060;text-align:right;">${s.val}</span>`;
      html += `<span style="color:#5a4a2a;font-size:0.8rem;">base ${s.base}</span>`;
      html += `<span style="color:#5a4a2a;font-size:0.8rem;">eq +${s.eq}</span>`;
    }
    html += `</div></div>`;

    // Feedback
    html += `<div class="training-feedback" style="display:none;padding:12px 22px;text-align:center;font-size:1rem;"></div>`;

    // Buttons
    html += `<div style="display:flex;gap:10px;padding:16px 22px;border-top:1px solid #3a2f1a;">`;
    const canConfirm = pendingSpend > 0;
    html += `<button class="training-confirm" style="flex:1;padding:12px;background:${canConfirm ? '#3a5a1a' : '#2a2a1a'};border:1px solid ${canConfirm ? '#5a8a2a' : '#3a3a2a'};color:${canConfirm ? '#b8e870' : '#5a5a3a'};border-radius:4px;cursor:${canConfirm ? 'pointer' : 'default'};font-family:'Cinzel',serif;font-size:1.1rem;" ${canConfirm ? '' : 'disabled'}>Confirm (${pendingSpend} pts)</button>`;
    html += `<button class="training-cancel" style="flex:1;padding:12px;background:#3a2f1a;border:1px solid #5a4a2a;color:#e8c870;border-radius:4px;cursor:pointer;font-family:'Cinzel',serif;font-size:1.1rem;">Cancel</button>`;
    html += `</div></div>`;

    this.overlay.innerHTML = html;
    this.feedbackEl = this.overlay.querySelector('.training-feedback');
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    this.overlay.querySelector('.training-close')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('.training-cancel')?.addEventListener('click', () => {
      this.resetIncrements();
      this.renderContent();
    });

    this.overlay.querySelector('.training-confirm')?.addEventListener('click', () => {
      if (this.totalPendingSpend() > 0 && this.sendFn) {
        this.sendFn('training.allocate', { npc_id: this.npcId, increments: { ...this.increments } });
      }
    });

    this.overlay.querySelectorAll<HTMLButtonElement>('.training-inc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset['attr'] as keyof TrainingAttributesDto;
        if (attr && this.canIncrement(attr)) {
          this.increments[attr]++;
          this.renderContent();
        }
      });
    });

    this.overlay.querySelectorAll<HTMLButtonElement>('.training-dec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset['attr'] as keyof TrainingAttributesDto;
        if (attr && this.increments[attr] > 0) {
          this.increments[attr]--;
          this.renderContent();
        }
      });
    });

    // Close on overlay background click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private resetIncrements(): void {
    this.increments = { constitution: 0, strength: 0, intelligence: 0, dexterity: 0, toughness: 0 };
  }

  private totalPendingSpend(): number {
    return ATTR_KEYS.reduce((sum, k) => sum + this.increments[k], 0);
  }

  private canIncrement(attr: keyof TrainingAttributesDto): boolean {
    const remaining = this.unspentPoints - this.totalPendingSpend();
    const total = this.attributes[attr] + this.increments[attr];
    return remaining > 0 && total < this.perStatCap;
  }

  private computePreview() {
    const c = ATTR_KEYS.reduce((acc, k) => {
      acc[k] = this.attributes[k] + this.increments[k];
      return acc;
    }, {} as Record<keyof TrainingAttributesDto, number>);

    return {
      maxHp: this.baseStats.hp + c.constitution * 4,
      attack: this.baseStats.attack + c.constitution * 1 + c.strength * 2 + this.equipmentStats.attack,
      defence: this.baseStats.defence + c.toughness * 1 + this.equipmentStats.defence,
      maxMana: 100 + c.intelligence * 8 + this.equipmentStats.max_mana,
      critChance: c.dexterity * 0.1 + this.equipmentStats.crit_chance,
      critDamage: 150 + c.strength * 0.3 + this.equipmentStats.crit_damage,
      dodgeChance: c.dexterity * 0.1 + this.equipmentStats.dodge_chance,
    };
  }

  private showFeedback(message: string, success: boolean): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.style.display = 'block';
    this.feedbackEl.style.color = success ? '#b8e870' : '#c0504a';
    this.feedbackEl.textContent = message;
    setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.style.display = 'none';
    }, 4000);
  }
}
