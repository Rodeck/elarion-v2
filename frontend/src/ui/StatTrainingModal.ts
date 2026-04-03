import type {
  StatTrainingStatePayload,
  StatTrainingResultPayload,
  StatTrainingItemDto,
} from '@elarion/protocol';

type SendFn = <T>(type: string, payload: T) => void;

const STAT_LABELS: Record<string, string> = {
  constitution: 'Constitution',
  strength: 'Strength',
  intelligence: 'Intelligence',
  dexterity: 'Dexterity',
  toughness: 'Toughness',
};

const TIER_LABELS: Record<number, string> = { 1: 'T1', 2: 'T2', 3: 'T3' };
const TIER_COLORS: Record<number, string> = { 1: '#8a8a8a', 2: '#4a9adf', 3: '#c060f0' };

export class StatTrainingModal {
  private overlay: HTMLElement | null = null;
  private parent: HTMLElement;
  private sendFn: SendFn | null = null;
  private npcId = 0;
  private feedbackEl: HTMLElement | null = null;
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  // State from server
  private statName = '';
  private currentValue = 0;
  private perStatCap = 0;
  private level = 0;
  private items: StatTrainingItemDto[] = [];

  constructor(parent: HTMLElement) {
    this.parent = parent;
  }

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  open(npcId: number): void {
    this.npcId = npcId;
    this.close();
    this.buildOverlay();
    this.renderLoading();
  }

  close(): void {
    if (this.feedbackTimeout) { clearTimeout(this.feedbackTimeout); this.feedbackTimeout = null; }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  handleState(payload: StatTrainingStatePayload): void {
    this.statName = payload.stat_name;
    this.currentValue = payload.current_value;
    this.perStatCap = payload.per_stat_cap;
    this.level = payload.level;
    this.items = payload.items;
    if (this.overlay) this.renderContent();
  }

  handleResult(payload: StatTrainingResultPayload): void {
    this.currentValue = payload.new_value;
    this.showFeedback(payload.message, payload.success);
    // State will be refreshed by the subsequent stat-training.state message
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
    const label = STAT_LABELS[this.statName] ?? this.statName;
    const atCap = this.currentValue >= this.perStatCap;

    let html = `<div style="background:#1a1510;border:1px solid #5a4a2a;border-radius:8px;max-width:520px;width:95%;max-height:90vh;overflow-y:auto;padding:0;display:flex;flex-direction:column;">`;

    // Header
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #3a2f1a;">`;
    html += `<span style="color:#d4a84b;font-family:'Cinzel',serif;font-size:1.4rem;">Train ${label}</span>`;
    html += `<button class="st-close" style="background:none;border:none;color:#7a6a4a;font-size:1.6rem;cursor:pointer;padding:0 6px;">&times;</button>`;
    html += `</div>`;

    // Current stat display
    html += `<div style="padding:14px 22px;border-bottom:1px solid #3a2f1a;display:flex;align-items:center;justify-content:space-between;">`;
    html += `<span style="color:#c0b080;font-family:'Crimson Text',serif;font-size:1.1rem;">Current ${label}</span>`;
    html += `<span style="color:#f0c060;font-family:'Rajdhani',sans-serif;font-size:1.3rem;font-weight:bold;">${this.currentValue} / ${this.perStatCap}</span>`;
    html += `</div>`;

    // Feedback area
    html += `<div class="st-feedback" style="min-height:0;overflow:hidden;transition:min-height 0.3s;"></div>`;

    // Items list or messages
    html += `<div style="padding:14px 22px;flex:1;">`;

    if (this.perStatCap === 0) {
      html += `<div style="color:#8a7a5a;text-align:center;padding:24px 0;font-family:'Crimson Text',serif;">Training is available from level 2.</div>`;
    } else if (atCap) {
      html += `<div style="color:#8a7a5a;text-align:center;padding:24px 0;font-family:'Crimson Text',serif;">Your ${label.toLowerCase()} has reached its maximum for your level.</div>`;
    } else if (this.items.length === 0) {
      html += `<div style="color:#8a7a5a;text-align:center;padding:24px 0;font-family:'Crimson Text',serif;">You don't have any items suitable for ${label.toLowerCase()} training. Craft training items and return.</div>`;
    } else {
      for (const item of this.items) {
        const chanceColor = item.success_chance > 70 ? '#7ac060' : item.success_chance >= 30 ? '#d4a84b' : '#c05050';
        const tierColor = TIER_COLORS[item.tier] ?? '#8a8a8a';
        const tierLabel = TIER_LABELS[item.tier] ?? `T${item.tier}`;

        html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:12px;background:#252119;border-radius:6px;border:1px solid #3a2f1a;">`;

        // Icon
        if (item.icon_url) {
          html += `<img src="${item.icon_url}" style="width:36px;height:36px;border-radius:4px;object-fit:contain;" alt="" />`;
        } else {
          html += `<div style="width:36px;height:36px;border-radius:4px;background:#3a2f1a;"></div>`;
        }

        // Item info
        html += `<div style="flex:1;min-width:0;">`;
        html += `<div style="color:#e8c870;font-family:'Crimson Text',serif;font-size:1.05rem;">${item.name} <span style="color:${tierColor};font-size:0.8rem;font-weight:bold;margin-left:4px;">${tierLabel}</span></div>`;
        html += `<div style="color:#8a7a5a;font-size:0.85rem;margin-top:2px;">Owned: ${item.owned_quantity} &middot; <span style="color:${chanceColor};font-weight:bold;">${item.success_chance}% chance</span></div>`;
        html += `</div>`;

        // Use button
        html += `<button class="st-use" data-item="${item.item_def_id}" style="background:#3a2f1a;border:1px solid #5a4a2a;color:#e8c870;padding:8px 16px;border-radius:4px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:1rem;white-space:nowrap;transition:background 0.15s;"`;
        html += ` onmouseover="this.style.background='#4a3f2a'" onmouseout="this.style.background='#3a2f1a'">Use</button>`;
        html += `</div>`;
      }
    }

    html += `</div>`;
    html += `</div>`;

    this.overlay.innerHTML = html;

    // Wire event listeners
    this.overlay.querySelector('.st-close')?.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.feedbackEl = this.overlay.querySelector('.st-feedback');

    for (const btn of this.overlay.querySelectorAll('.st-use')) {
      btn.addEventListener('click', () => {
        const itemDefId = parseInt((btn as HTMLElement).dataset.item!, 10);
        if (!isNaN(itemDefId)) {
          this.sendFn?.('stat-training.attempt', { npc_id: this.npcId, item_def_id: itemDefId });
        }
      });
    }
  }

  private showFeedback(message: string, success: boolean): void {
    if (this.feedbackTimeout) { clearTimeout(this.feedbackTimeout); this.feedbackTimeout = null; }
    if (!this.feedbackEl) return;

    const color = success ? '#7ac060' : '#c05050';
    const bg = success ? 'rgba(122,192,96,0.12)' : 'rgba(192,80,80,0.12)';
    this.feedbackEl.style.minHeight = '44px';
    this.feedbackEl.innerHTML = `<div style="padding:10px 22px;color:${color};background:${bg};font-family:'Crimson Text',serif;font-size:1rem;text-align:center;">${message}</div>`;

    this.feedbackTimeout = setTimeout(() => {
      if (this.feedbackEl) {
        this.feedbackEl.style.minHeight = '0';
        this.feedbackEl.innerHTML = '';
      }
    }, 4000);
  }
}
