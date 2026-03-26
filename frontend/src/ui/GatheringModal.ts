import type {
  GatheringTickPayload,
  GatheringEndedPayload,
} from '@elarion/protocol';
import { getXpIconUrl, getCrownsIconUrl } from './ui-icons';

export interface GatheringCombatLoot {
  outcome: 'win' | 'loss';
  xp_gained: number;
  crowns_gained: number;
  items_dropped: { name: string; quantity: number; icon_url?: string | null }[];
}

const SCROLLBAR_STYLE_ID = 'gathering-modal-scrollbar-style';
const MODAL_WIDTH = '840px';

export class GatheringModal {
  private overlay: HTMLElement | null = null;
  private eventLogEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;
  private progressBarEl: HTMLElement | null = null;
  private footerEl: HTMLElement | null = null;
  private countdownInterval: number | null = null;
  private secondsLeft = 0;
  private totalTicks = 0;
  private paused = false;
  private ended = false;
  private onCancel: (() => void) | null = null;
  private lastMonsterEvent: GatheringTickPayload['event'] | null = null;
  private logZoneEl: HTMLElement | null = null;
  private combatContainerEl: HTMLElement | null = null;
  private modalEl: HTMLElement | null = null;
  /** Current combat event group — loot gets appended here */
  private activeCombatGroup: HTMLElement | null = null;

  setOnCancel(cb: () => void): void {
    this.onCancel = cb;
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  open(durationSeconds: number): void {
    this.close();
    this.secondsLeft = durationSeconds;
    this.totalTicks = Math.ceil(durationSeconds / 2);
    this.paused = false;
    this.ended = false;
    this.lastMonsterEvent = null;
    this.activeCombatGroup = null;
    this.ensureScrollbarStyles();
    this.buildOverlay();
    this.startCountdown();
  }

  close(): void {
    this.stopCountdown();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.eventLogEl = null;
    this.timerEl = null;
    this.progressBarEl = null;
    this.footerEl = null;
    this.logZoneEl = null;
    this.combatContainerEl = null;
    this.modalEl = null;
    this.activeCombatGroup = null;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  handleTick(payload: GatheringTickPayload): void {
    if (!this.overlay) return;

    if (this.progressBarEl) {
      const pct = Math.min(100, (payload.tick / payload.total_ticks) * 100);
      this.progressBarEl.style.width = `${pct}%`;
    }

    this.totalTicks = payload.total_ticks;
    this.secondsLeft = (payload.total_ticks - payload.tick) * 2;
    if (this.timerEl) {
      this.timerEl.textContent = `${this.secondsLeft}s`;
    }

    if (payload.event.type === 'monster') {
      this.lastMonsterEvent = payload.event;
      return;
    }

    if (payload.event.type !== 'nothing') {
      this.appendEvent(payload.event);
    }
  }

  handleCombatPause(_monsterName: string, iconUrlFromPayload: string | null = null): void {
    this.paused = true;
    this.stopCountdown();

    // Prefer icon URL from combat_pause payload; fall back to stashed tick event
    const ev = this.lastMonsterEvent;
    const name = ev?.monster_name ?? _monsterName;
    const iconUrl = iconUrlFromPayload ?? ev?.monster_icon_url ?? null;
    this.lastMonsterEvent = null;

    // Create a combat event group with flash animation
    const group = this.createEventGroup('#3a2810', 'g-anim-combat');
    this.activeCombatGroup = group;

    // Monster header inside group
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:4px 0;';

    const icon = this.buildIcon(iconUrl, '#e8a040', 64);
    header.appendChild(icon);

    const label = document.createElement('span');
    label.style.cssText = 'font-size:0.95rem;font-family:Cinzel,serif;color:#e8a040;font-weight:700;letter-spacing:0.03em;';
    label.textContent = `A ${name} attacks!`;
    header.appendChild(label);

    group.appendChild(header);
    this.scrollToBottom();
  }

  handleCombatResume(): void {
    this.paused = false;
    this.startCountdown();
    this.exitCombatMode();
  }

  addCombatLoot(loot: GatheringCombatLoot): void {
    const target = this.activeCombatGroup ?? this.eventLogEl;
    if (!target) return;

    // Result label
    const resultEl = document.createElement('div');
    if (loot.outcome === 'win') {
      resultEl.style.cssText = 'font-size:0.8rem;font-family:"Crimson Text",serif;color:#b8e870;font-weight:700;padding:4px 0 2px;';
      resultEl.textContent = 'Victory!';
    } else {
      resultEl.style.cssText = 'font-size:0.8rem;font-family:"Crimson Text",serif;color:#c06050;font-weight:700;padding:4px 0 2px;';
      resultEl.textContent = 'Defeated!';
    }
    target.appendChild(resultEl);

    // Rewards grid (only on win with actual rewards)
    if (loot.outcome === 'win') {
      const hasRewards = loot.xp_gained > 0 || loot.crowns_gained > 0 || loot.items_dropped.length > 0;
      if (hasRewards) {
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
        this.lootTileIndex = 0;

        if (loot.xp_gained > 0) {
          grid.appendChild(this.buildLootTile(getXpIconUrl(), '✦', '#a78bfa', loot.xp_gained, `+${loot.xp_gained} XP`));
        }
        if (loot.crowns_gained > 0) {
          grid.appendChild(this.buildLootTile(getCrownsIconUrl(), '♛', '#f0c060', loot.crowns_gained, `+${loot.crowns_gained} Crowns`));
        }
        for (const item of loot.items_dropped) {
          grid.appendChild(this.buildLootTile(item.icon_url ?? null, '◆', '#c9a55c', item.quantity, item.name));
        }
        target.appendChild(grid);
      } else {
        const noDrops = document.createElement('div');
        noDrops.style.cssText = 'font-size:0.72rem;font-family:"Crimson Text",serif;color:#5a4a2a;padding:2px 0;';
        noDrops.textContent = 'No drops this time.';
        target.appendChild(noDrops);
      }
    }

    this.activeCombatGroup = null;
    this.scrollToBottom();
  }

  /** Hide events, show combat container, widen modal. */
  enterCombatMode(): HTMLElement {
    if (this.logZoneEl) this.logZoneEl.style.display = 'none';
    if (this.footerEl) this.footerEl.style.display = 'none';

    if (this.modalEl) {
      this.modalEl.style.maxHeight = '90vh';
    }

    if (!this.combatContainerEl) {
      this.combatContainerEl = document.createElement('div');
      this.combatContainerEl.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;';
      if (this.modalEl) {
        this.modalEl.appendChild(this.combatContainerEl);
      }
    }
    this.combatContainerEl.style.display = 'flex';
    return this.combatContainerEl;
  }

  private exitCombatMode(): void {
    if (this.combatContainerEl) {
      this.combatContainerEl.style.display = 'none';
    }
    if (this.logZoneEl) this.logZoneEl.style.display = '';
    if (this.footerEl) this.footerEl.style.display = '';
    if (this.modalEl) {
      this.modalEl.style.maxHeight = '80vh';
    }
  }

  handleEnded(payload: GatheringEndedPayload): void {
    this.ended = true;
    this.stopCountdown();

    if (this.timerEl) this.timerEl.textContent = '0s';
    if (this.progressBarEl) this.progressBarEl.style.width = '100%';

    // Summary group
    const s = payload.summary;
    const reasonLabel = payload.reason === 'completed' ? 'Gathering Complete'
      : payload.reason === 'death' ? 'You Have Fallen'
        : 'Gathering Cancelled';
    const reasonColor = payload.reason === 'completed' ? '#b8e870'
      : payload.reason === 'death' ? '#c06050'
        : '#c8b88a';
    const borderColor = payload.reason === 'completed' ? '#3a4a2a' : '#4a2a2a';

    const group = this.createEventGroup(borderColor, 'g-anim-summary');

    const header = document.createElement('div');
    header.style.cssText = `font-size:0.95rem;font-family:Cinzel,serif;color:${reasonColor};font-weight:700;letter-spacing:0.04em;padding-bottom:4px;`;
    header.textContent = reasonLabel;
    group.appendChild(header);

    if (payload.reason !== 'completed') {
      const lost = document.createElement('div');
      lost.style.cssText = 'font-size:0.78rem;font-family:"Crimson Text",serif;color:#8a6050;';
      lost.textContent = 'All gathered resources have been lost.';
      group.appendChild(lost);
    } else if (s.resources_gained.length > 0 || s.crowns_gained > 0) {
      const grid = document.createElement('div');
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
      this.lootTileIndex = 0;
      for (const r of s.resources_gained) {
        grid.appendChild(this.buildLootTile(null, '◆', '#8a9a6a', r.quantity, `+${r.quantity} ${r.item_name}`));
      }
      if (s.crowns_gained > 0) {
        grid.appendChild(this.buildLootTile(getCrownsIconUrl(), '♛', '#f0c060', s.crowns_gained, `+${s.crowns_gained} crowns`));
      }
      group.appendChild(grid);
    }

    // Stats line
    const stats: string[] = [];
    if (s.combats_fought > 0) stats.push(`Combats: ${s.combats_won}/${s.combats_fought} won`);
    if (s.accidents > 0) stats.push(`Accidents: ${s.accidents} (-${s.total_hp_lost} HP)`);
    if (payload.tool_destroyed) stats.push('Tool destroyed!');
    else if (payload.tool_remaining_durability != null) stats.push(`Tool durability: ${payload.tool_remaining_durability}`);

    if (stats.length > 0) {
      const statsEl = document.createElement('div');
      statsEl.style.cssText = 'font-size:0.72rem;font-family:"Crimson Text",serif;color:#8a7a5a;padding-top:4px;border-top:1px solid #2a2010;margin-top:4px;';
      statsEl.textContent = stats.join('  ·  ');
      group.appendChild(statsEl);
    }

    this.scrollToBottom();

    // Replace cancel with close
    if (this.footerEl) {
      this.footerEl.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = [
        'width:100%', 'padding:8px 36px', 'font-family:Cinzel,serif',
        'font-size:13px', 'font-weight:600', 'color:#1a1510',
        'background:#d4a84b', 'border:1px solid #b8922e', 'cursor:pointer',
        'border-radius:3px', 'letter-spacing:0.05em', 'transition:background 0.15s',
      ].join(';');
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#e8c060'; });
      closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#d4a84b'; });
      closeBtn.addEventListener('click', () => this.close());
      this.footerEl.appendChild(closeBtn);
    }
  }

  // ---------------------------------------------------------------------------
  // Build overlay
  // ---------------------------------------------------------------------------

  private buildOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:250',
      'background:rgba(0,0,0,0.6)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:Cinzel,serif', 'color:#c9a55c',
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      `width:${MODAL_WIDTH}`, 'max-width:95vw',
      'max-height:80vh',
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'box-shadow:0 8px 40px rgba(0,0,0,0.9)',
      'display:flex', 'flex-direction:column',
      'overflow:hidden',
      'transition:width 0.3s',
    ].join(';');
    this.modalEl = modal;

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = [
      'padding:14px 20px',
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'border-bottom:1px solid #3a2e1a',
      'background:#111008',
      'flex-shrink:0',
    ].join(';');

    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;color:#e8c870;letter-spacing:0.06em;';
    title.textContent = 'Gathering...';
    header.appendChild(title);

    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText = 'font-size:20px;color:#c8b88a;font-family:Rajdhani,sans-serif;font-weight:600;';
    this.timerEl.textContent = `${this.secondsLeft}s`;
    header.appendChild(this.timerEl);
    modal.appendChild(header);

    // ── Progress bar ──
    const barWrap = document.createElement('div');
    barWrap.style.cssText = 'padding:10px 20px 8px;flex-shrink:0;';

    const barOuter = document.createElement('div');
    barOuter.style.cssText = 'width:100%;height:10px;background:#1a1814;border:1px solid #3a2e1a;border-radius:5px;overflow:hidden;';

    this.progressBarEl = document.createElement('div');
    this.progressBarEl.className = 'g-progress-glow';
    this.progressBarEl.style.cssText = 'height:100%;background:linear-gradient(90deg,#5a4a2a,#8a7a4a);width:0%;transition:width 0.4s;border-radius:5px;';
    barOuter.appendChild(this.progressBarEl);
    barWrap.appendChild(barOuter);
    modal.appendChild(barWrap);

    // ── Event log ──
    const logZone = document.createElement('div');
    logZone.style.cssText = [
      'display:flex', 'flex-direction:column',
      'flex:1', 'min-height:0',
      'margin:0 16px',
      'border:1px solid #2a2010',
      'border-radius:3px',
      'background:#0a0806',
      'overflow:hidden',
    ].join(';');
    this.logZoneEl = logZone;

    const logHeader = document.createElement('div');
    logHeader.style.cssText = 'font-size:0.65rem;color:#5a4a2a;padding:3px 12px;border-bottom:1px solid #1e1a10;flex-shrink:0;letter-spacing:0.06em;';
    logHeader.textContent = 'EVENTS';
    logZone.appendChild(logHeader);

    this.eventLogEl = document.createElement('div');
    this.eventLogEl.className = 'gathering-event-log';
    this.eventLogEl.style.cssText = [
      'flex:1', 'overflow-y:auto', 'padding:8px 12px',
      'min-height:120px', 'max-height:400px',
      'display:flex', 'flex-direction:column', 'gap:6px',
    ].join(';');
    logZone.appendChild(this.eventLogEl);
    modal.appendChild(logZone);

    // ── Footer ──
    this.footerEl = document.createElement('div');
    this.footerEl.style.cssText = 'padding:10px 16px 14px;flex-shrink:0;';

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = [
      'width:100%', 'padding:8px', 'background:rgba(160,60,50,0.3)', 'border:1px solid #804030',
      'color:#c08060', 'font-family:Cinzel,serif', 'font-size:12px', 'cursor:pointer',
      'transition:background 0.15s',
    ].join(';');
    cancelBtn.textContent = 'End Gathering';
    cancelBtn.addEventListener('mouseenter', () => { if (!cancelBtn.disabled) cancelBtn.style.background = 'rgba(160,60,50,0.5)'; });
    cancelBtn.addEventListener('mouseleave', () => { if (!cancelBtn.disabled) cancelBtn.style.background = 'rgba(160,60,50,0.3)'; });
    cancelBtn.addEventListener('click', () => {
      cancelBtn.disabled = true;
      cancelBtn.style.opacity = '0.5';
      this.onCancel?.();
    });
    this.footerEl.appendChild(cancelBtn);
    modal.appendChild(this.footerEl);

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);
  }

  // ---------------------------------------------------------------------------
  // Event log rendering
  // ---------------------------------------------------------------------------

  private appendEvent(event: GatheringTickPayload['event']): void {
    switch (event.type) {
      case 'resource': {
        const group = this.createEventGroup('#1a2a1a', 'g-anim-pop');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;';
        row.appendChild(this.buildIcon(event.item_icon_url ?? null, '#8a9a6a', 32));
        const label = document.createElement('span');
        label.style.cssText = 'font-size:0.85rem;font-family:"Crimson Text",serif;color:#8a9a6a;font-weight:600;';
        label.textContent = `${event.item_name ?? 'Resource'} x${event.quantity ?? 1}`;
        row.appendChild(label);
        group.appendChild(row);
        break;
      }
      case 'gold': {
        const group = this.createEventGroup('#2a2a10', 'g-anim-gold');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;';
        row.appendChild(getCrownsIconUrl() ? this.buildIcon(getCrownsIconUrl(), '#f0c060', 32) : this.buildSymbolIcon('♛', '#f0c060', 32));
        const label = document.createElement('span');
        label.style.cssText = 'font-size:0.85rem;font-family:"Crimson Text",serif;color:#d4a84b;font-weight:600;';
        label.textContent = `+${event.crowns ?? 0} crowns`;
        row.appendChild(label);
        group.appendChild(row);
        break;
      }
      case 'accident': {
        const group = this.createEventGroup('#2a1414', 'g-anim-damage');
        const msg = event.message ?? 'An accident occurred';
        const dmg = event.hp_damage ? ` (-${event.hp_damage} HP)` : '';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;';
        row.appendChild(this.buildSymbolIcon('!', '#c06050', 32));
        const label = document.createElement('span');
        label.style.cssText = 'font-size:0.85rem;font-family:"Crimson Text",serif;color:#c06050;font-weight:600;';
        label.textContent = `${msg}${dmg}`;
        row.appendChild(label);
        group.appendChild(row);
        break;
      }
      case 'squire': {
        const group = this.createEventGroup('#2a2010', 'g-anim-pop');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const ev = event as any;
        row.appendChild(this.buildIcon(ev.squire_icon_url ?? null, '#d4a84b', 32));
        const label = document.createElement('span');
        label.style.cssText = 'font-size:0.85rem;font-family:"Crimson Text",serif;color:#d4a84b;font-weight:600;';
        label.textContent = `Squire found: ${ev.squire_name ?? 'Unknown'} (${ev.squire_rank ?? ''})`;
        row.appendChild(label);
        group.appendChild(row);
        break;
      }
    }
    this.scrollToBottom();
  }

  // ---------------------------------------------------------------------------
  // Shared building blocks
  // ---------------------------------------------------------------------------

  /** Create a visually grouped event card and append to event log */
  private createEventGroup(borderColor: string, animClass?: string): HTMLElement {
    if (!this.eventLogEl) {
      return document.createElement('div');
    }
    const group = document.createElement('div');
    if (animClass) group.className = animClass;
    group.style.cssText = [
      'padding:8px 10px',
      `background:${borderColor}`,
      'border:1px solid #2a2010',
      'border-radius:4px',
      'display:flex',
      'flex-direction:column',
      'gap:4px',
    ].join(';');
    this.eventLogEl.appendChild(group);
    return group;
  }

  /** Build an image icon element */
  private buildIcon(iconUrl: string | null, fallbackColor: string, size: number): HTMLElement {
    const icon = document.createElement('div');
    icon.style.cssText = [
      `width:${size}px`, `height:${size}px`, 'flex-shrink:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
      'overflow:hidden',
    ].join(';');
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      img.onerror = () => { img.remove(); icon.textContent = '◆'; icon.style.color = fallbackColor; icon.style.fontSize = `${size * 0.4}px`; };
      icon.appendChild(img);
    } else {
      icon.textContent = '◆';
      icon.style.color = fallbackColor;
      icon.style.fontSize = `${size * 0.4}px`;
    }
    return icon;
  }

  /** Build a text-symbol icon element */
  private buildSymbolIcon(symbol: string, color: string, size: number): HTMLElement {
    const icon = document.createElement('div');
    icon.style.cssText = [
      `width:${size}px`, `height:${size}px`, 'flex-shrink:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      `font-size:${size * 0.55}px`, `color:${color}`,
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
    ].join(';');
    icon.textContent = symbol;
    return icon;
  }

  private lootTileIndex = 0;

  /** Loot tile: icon-only with quantity badge in corner, name on hover */
  private buildLootTile(
    iconUrl: string | null,
    fallbackSymbol: string,
    color: string,
    quantity: number,
    tooltipText: string,
  ): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'g-anim-loot';
    tile.style.cssText = [
      'position:relative',
      'width:48px', 'height:48px',
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'overflow:visible', 'cursor:default', 'flex-shrink:0',
      `animation-delay:${this.lootTileIndex * 80}ms`,
    ].join(';');
    this.lootTileIndex++;
    tile.title = tooltipText;

    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      img.onerror = () => { img.remove(); tile.textContent = fallbackSymbol; tile.style.color = color; tile.style.fontSize = '1.4rem'; };
      tile.appendChild(img);
    } else {
      tile.textContent = fallbackSymbol;
      tile.style.color = color;
      tile.style.fontSize = '1.4rem';
    }

    // Quantity badge
    if (quantity > 1) {
      const badge = document.createElement('div');
      badge.style.cssText = [
        'position:absolute', 'bottom:-2px', 'right:-2px',
        'min-width:16px', 'height:16px', 'padding:0 3px',
        'background:#0d0b08', 'border:1px solid #5a4a2a', 'border-radius:3px',
        'font-size:0.6rem', 'font-family:Rajdhani,sans-serif', 'font-weight:700',
        'color:#e8c870', 'text-align:center', 'line-height:16px',
      ].join(';');
      badge.textContent = String(quantity);
      tile.appendChild(badge);
    }

    return tile;
  }

  private scrollToBottom(): void {
    if (this.eventLogEl) {
      this.eventLogEl.scrollTop = this.eventLogEl.scrollHeight;
    }
  }

  // ---------------------------------------------------------------------------
  // Scrollbar styles
  // ---------------------------------------------------------------------------

  private ensureScrollbarStyles(): void {
    if (document.getElementById(SCROLLBAR_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SCROLLBAR_STYLE_ID;
    style.textContent = `
      .gathering-event-log::-webkit-scrollbar { width: 8px; }
      .gathering-event-log::-webkit-scrollbar-track { background: #1a1510; border-left: 1px solid #2a2010; }
      .gathering-event-log::-webkit-scrollbar-thumb { background: #5a4a2a; border-radius: 4px; border: 1px solid #3a2e1a; }
      .gathering-event-log::-webkit-scrollbar-thumb:hover { background: #8a7050; }
      .gathering-event-log { scrollbar-width: thin; scrollbar-color: #5a4a2a #1a1510; }

      /* ── Gathering event animations ── */
      @keyframes g-slide-in {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes g-pop {
        0%   { opacity: 0; transform: scale(0.7); }
        60%  { transform: scale(1.08); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes g-combat-flash {
        0%   { opacity: 0; transform: scale(0.9); box-shadow: 0 0 0 rgba(232,160,64,0); }
        40%  { opacity: 1; transform: scale(1.02); box-shadow: 0 0 20px rgba(232,160,64,0.5); }
        100% { transform: scale(1); box-shadow: 0 0 0 rgba(232,160,64,0); }
      }
      @keyframes g-gold-shimmer {
        0%   { opacity: 0; transform: translateY(8px); }
        50%  { opacity: 1; text-shadow: 0 0 8px rgba(240,192,96,0.6); }
        100% { transform: translateY(0); text-shadow: none; }
      }
      @keyframes g-damage-shake {
        0%, 100% { transform: translateX(0); }
        15% { transform: translateX(-4px); }
        30% { transform: translateX(4px); }
        45% { transform: translateX(-3px); }
        60% { transform: translateX(3px); }
        75% { transform: translateX(-1px); }
      }
      @keyframes g-loot-pop {
        0%   { opacity: 0; transform: scale(0.5); }
        70%  { transform: scale(1.12); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes g-summary-reveal {
        from { opacity: 0; transform: translateY(16px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes g-progress-glow {
        0%, 100% { box-shadow: 0 0 4px rgba(138,122,74,0.3); }
        50%      { box-shadow: 0 0 10px rgba(212,168,75,0.5); }
      }
      .g-anim-slide    { animation: g-slide-in 0.35s ease-out both; }
      .g-anim-pop      { animation: g-pop 0.4s ease-out both; }
      .g-anim-combat   { animation: g-combat-flash 0.5s ease-out both; }
      .g-anim-gold     { animation: g-gold-shimmer 0.45s ease-out both; }
      .g-anim-damage   { animation: g-damage-shake 0.4s ease-out both; }
      .g-anim-loot     { animation: g-loot-pop 0.35s ease-out both; }
      .g-anim-summary  { animation: g-summary-reveal 0.5s ease-out both; }
      .g-progress-glow { animation: g-progress-glow 2s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------------------------

  private startCountdown(): void {
    this.stopCountdown();
    this.countdownInterval = window.setInterval(() => {
      if (this.paused || this.ended) return;
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
      if (this.timerEl) {
        this.timerEl.textContent = `${this.secondsLeft}s`;
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval != null) {
      window.clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
