import type { CharacterData, ActiveSpellBuffDto } from '../../../shared/protocol/index';
import { getRodUpgradePointsIconUrl } from './ui-icons';
import { BuffBar } from './BuffBar';

export class StatsBar {
  private container: HTMLDivElement;
  private collapsedEl: HTMLDivElement;
  private nameEl: HTMLSpanElement;
  private levelEl: HTMLSpanElement;
  private hpFillEl: HTMLDivElement;
  private hpTextEl: HTMLSpanElement;
  private xpFillEl: HTMLDivElement;
  private xpTextEl: HTMLSpanElement;
  private attackEl: HTMLSpanElement | null = null;
  private defenceEl: HTMLSpanElement | null = null;
  private crownsEl: HTMLSpanElement | null = null;
  private energyFillEl!: HTMLDivElement;
  private energyTextEl!: HTMLSpanElement;
  private buffBarEl!: HTMLDivElement;
  private buffBar: BuffBar | null = null;
  private xpRingSvg: SVGSVGElement | null = null;
  private xpRingCircle: SVGCircleElement | null = null;
  private xpTooltipEl: HTMLElement | null = null;
  private maxHp = 1;
  private currentXp = 0;

  // Expand/collapse state
  private expanded = false;
  private expandedPanel: HTMLDivElement | null = null;
  private expandBtn: HTMLButtonElement;
  private characterData: CharacterData | null = null;
  private xpThreshold = 9999;
  private effectiveAttack = 0;
  private effectiveDefence = 0;
  private unspentBadge: HTMLSpanElement | null = null;
  private badgeDismissed = false;
  private lastUnspentCount = 0;

  constructor(
    private mountEl: HTMLElement,
    name: string,
    className: string,
    level: number,
    hp: number,
    maxHp: number,
    xp: number,
    xpThreshold: number,
    attack?: number,
    defence?: number,
    crowns?: number,
  ) {
    this.maxHp = maxHp;
    this.xpThreshold = xpThreshold;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 10px 16px;
      gap: 8px;
      box-sizing: border-box;
      position: relative;
    `;

    // ── Expand toggle arrow (centered at top) ───────────────────
    this.expandBtn = document.createElement('button');
    this.expandBtn.style.cssText = `
      position: absolute;
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(37,33,25,0.9);
      border: 1px solid #5a4a2a;
      border-radius: 2px;
      color: #a89880;
      font-size: 10px;
      cursor: pointer;
      padding: 1px 14px;
      line-height: 1;
      z-index: 2;
      transition: color 0.15s, border-color 0.15s;
    `;
    this.expandBtn.textContent = '\u25B2'; // ▲
    this.expandBtn.title = 'Expand character stats';
    this.expandBtn.addEventListener('mouseenter', () => {
      this.expandBtn.style.color = '#d4a84b';
      this.expandBtn.style.borderColor = '#d4a84b';
    });
    this.expandBtn.addEventListener('mouseleave', () => {
      this.expandBtn.style.color = '#a89880';
      this.expandBtn.style.borderColor = '#5a4a2a';
    });
    this.expandBtn.addEventListener('click', () => this.toggle());
    this.container.appendChild(this.expandBtn);

    // ── Collapsed content wrapper ────────────────────────────────
    this.collapsedEl = document.createElement('div');
    this.collapsedEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    // ── Header row: name block (left) + level badge (right) ──────
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';

    const nameBlock = document.createElement('div');
    nameBlock.style.cssText = 'min-width: 0; flex: 1;';

    this.nameEl = document.createElement('span');
    this.nameEl.style.cssText = `
      display: block;
      font-family: var(--font-display);
      font-size: 14px;
      font-weight: bold;
      color: var(--color-gold-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    this.nameEl.textContent = name;

    const classEl = document.createElement('span');
    classEl.style.cssText = `
      display: block;
      font-family: var(--font-display);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;
    classEl.textContent = className;

    nameBlock.appendChild(this.nameEl);
    nameBlock.appendChild(classEl);

    const levelBadge = document.createElement('div');
    levelBadge.style.cssText = `
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      background: rgba(37,33,25,0.8);
      border: 1px solid var(--color-gold-dim);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    const lvLabel = document.createElement('span');
    lvLabel.style.cssText = `
      font-family: var(--font-display);
      font-size: 7px;
      color: var(--color-text-muted);
      letter-spacing: 1.5px;
      text-transform: uppercase;
    `;
    lvLabel.textContent = 'LVL';

    this.levelEl = document.createElement('span');
    this.levelEl.style.cssText = `
      font-family: var(--font-number);
      font-size: 16px;
      font-weight: 600;
      color: var(--color-gold-bright);
      line-height: 1;
    `;
    this.levelEl.textContent = String(level);

    levelBadge.appendChild(lvLabel);
    levelBadge.appendChild(this.levelEl);

    // XP ring SVG overlay around level badge
    const levelBadgeWrap = document.createElement('div');
    levelBadgeWrap.style.cssText = 'position:relative;flex-shrink:0;width:46px;height:46px;display:flex;align-items:center;justify-content:center;cursor:pointer;';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '46');
    svg.setAttribute('height', '46');
    svg.style.cssText = 'position:absolute;top:0;left:0;transform:rotate(-90deg);pointer-events:none;';

    const bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', '23');
    bgCircle.setAttribute('cy', '23');
    bgCircle.setAttribute('r', '21');
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    bgCircle.setAttribute('stroke-width', '2');
    svg.appendChild(bgCircle);

    const xpCircle = document.createElementNS(svgNS, 'circle');
    xpCircle.setAttribute('cx', '23');
    xpCircle.setAttribute('cy', '23');
    xpCircle.setAttribute('r', '21');
    xpCircle.setAttribute('fill', 'none');
    xpCircle.setAttribute('stroke', 'var(--color-xp-fill, #7ab8e0)');
    xpCircle.setAttribute('stroke-width', '2');
    xpCircle.setAttribute('stroke-linecap', 'round');
    const circumference = 2 * Math.PI * 21;
    xpCircle.setAttribute('stroke-dasharray', String(circumference));
    xpCircle.setAttribute('stroke-dashoffset', String(circumference));
    svg.appendChild(xpCircle);
    this.xpRingSvg = svg;
    this.xpRingCircle = xpCircle;

    levelBadgeWrap.appendChild(svg);
    levelBadgeWrap.appendChild(levelBadge);

    // XP tooltip on hover
    const xpTooltip = document.createElement('div');
    xpTooltip.style.cssText = 'display:none;position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:var(--color-bg-panel,#252119);border:1px solid rgba(212,168,75,0.4);border-radius:4px;padding:4px 8px;white-space:nowrap;z-index:100;font-size:10px;color:rgba(255,255,255,0.8);pointer-events:none;font-family:var(--font-number);';
    this.xpTooltipEl = xpTooltip;
    levelBadgeWrap.appendChild(xpTooltip);
    levelBadgeWrap.addEventListener('mouseenter', () => {
      xpTooltip.textContent = `${this.currentXp} / ${this.xpThreshold} XP`;
      xpTooltip.style.display = 'block';
    });
    levelBadgeWrap.addEventListener('mouseleave', () => { xpTooltip.style.display = 'none'; });

    headerRow.appendChild(nameBlock);
    headerRow.appendChild(levelBadgeWrap);

    // ── HP Bar ────────────────────────────────────────────────────
    const { el: hpEl, fill: hpFill, valueText: hpText } = this.createBarSection(
      'HP',
      'var(--color-hp-high)',
      'var(--color-hp-bg)',
    );
    this.hpFillEl = hpFill;
    this.hpTextEl = hpText;

    // ── Buff Bar (replaces XP bar) ──────────────────────────────
    this.buffBarEl = document.createElement('div');
    this.buffBarEl.style.cssText = 'min-height:20px;';
    this.buffBar = new BuffBar(this.buffBarEl);

    // ── Energy Bar ────────────────────────────────────────────────
    const { el: energyEl, fill: energyFill, valueText: energyText } = this.createBarSection(
      'Energy',
      '#4a9bc7',
      'rgba(30,50,70,0.4)',
    );
    this.energyFillEl = energyFill;
    this.energyTextEl = energyText;

    // ── Combat Stats Row ──────────────────────────────────────────
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:flex;gap:12px;';

    const attackBlock = document.createElement('div');
    attackBlock.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const atkLabel = document.createElement('span');
    atkLabel.style.cssText = 'font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px;';
    atkLabel.textContent = 'ATK';
    this.attackEl = document.createElement('span');
    this.attackEl.style.cssText = 'font-family:var(--font-number);font-size:12px;color:#e8c878;';
    this.attackEl.dataset['statsType'] = 'attack';
    attackBlock.appendChild(atkLabel);
    attackBlock.appendChild(this.attackEl);

    const defBlock = document.createElement('div');
    defBlock.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const defLabel = document.createElement('span');
    defLabel.style.cssText = 'font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px;';
    defLabel.textContent = 'DEF';
    this.defenceEl = document.createElement('span');
    this.defenceEl.style.cssText = 'font-family:var(--font-number);font-size:12px;color:#78a8e8;';
    this.defenceEl.dataset['statsType'] = 'defence';
    defBlock.appendChild(defLabel);
    defBlock.appendChild(this.defenceEl);

    const crBlock = document.createElement('div');
    crBlock.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const crLabel = document.createElement('span');
    crLabel.style.cssText = 'font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px;';
    crLabel.textContent = 'CR';
    this.crownsEl = document.createElement('span');
    this.crownsEl.style.cssText = 'font-family:var(--font-number);font-size:12px;color:#d4a84b;';
    this.crownsEl.dataset['statsType'] = 'crowns';
    crBlock.appendChild(crLabel);
    crBlock.appendChild(this.crownsEl);

    statsRow.appendChild(attackBlock);
    statsRow.appendChild(defBlock);
    statsRow.appendChild(crBlock);

    // Unspent stat points badge
    this.unspentBadge = document.createElement('span');
    this.unspentBadge.style.cssText = 'display:none;background:#d4a84b;color:#1a1510;font-family:var(--font-number);font-size:10px;font-weight:bold;padding:1px 5px;border-radius:9px;cursor:pointer;margin-left:4px;';
    this.unspentBadge.title = 'Unspent stat points — click to dismiss';
    this.unspentBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.badgeDismissed = true;
      if (this.unspentBadge) this.unspentBadge.style.display = 'none';
    });
    statsRow.appendChild(this.unspentBadge);

    // ── Assemble collapsed content ───────────────────────────────
    this.collapsedEl.appendChild(headerRow);
    this.collapsedEl.appendChild(hpEl);
    this.collapsedEl.appendChild(energyEl);
    this.collapsedEl.appendChild(this.buffBarEl);
    this.collapsedEl.appendChild(statsRow);
    this.container.appendChild(this.collapsedEl);

    mountEl.appendChild(this.container);

    this.setHp(hp, maxHp);
    this.setXp(xp, xpThreshold);
    if (attack !== undefined && defence !== undefined) {
      this.updateStats(attack, defence);
    }
    this.setCrowns(crowns ?? 0);
  }

  private createBarSection(
    label: string,
    fillColor: string,
    trackColor: string,
  ): { el: HTMLDivElement; fill: HTMLDivElement; valueText: HTMLSpanElement } {
    const el = document.createElement('div');
    el.style.cssText = 'width: 100%;';

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    `;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `
      font-family: var(--font-display);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 1px;
      text-transform: uppercase;
    `;
    labelEl.textContent = label;

    const valueText = document.createElement('span');
    valueText.style.cssText = `
      font-family: var(--font-number);
      font-size: 12px;
      color: var(--color-text-secondary);
    `;

    header.appendChild(labelEl);
    header.appendChild(valueText);

    const track = document.createElement('div');
    track.style.cssText = `
      background: ${trackColor};
      border: 1px solid rgba(92,77,61,0.5);
      border-radius: 2px;
      height: 10px;
      overflow: hidden;
    `;

    const fill = document.createElement('div');
    fill.style.cssText = `
      height: 100%;
      background: ${fillColor};
      width: 0%;
      transition: width 0.3s ease;
    `;
    track.appendChild(fill);

    el.appendChild(header);
    el.appendChild(track);

    return { el, fill, valueText };
  }

  // ---------------------------------------------------------------------------
  // Public update methods
  // ---------------------------------------------------------------------------

  setHp(current: number, max: number): void {
    this.maxHp = max;
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.hpFillEl.style.width = `${Math.round(ratio * 100)}%`;
    if (ratio > 0.6) {
      this.hpFillEl.style.background = 'var(--color-hp-high)';
    } else if (ratio > 0.3) {
      this.hpFillEl.style.background = 'var(--color-hp-mid)';
    } else {
      this.hpFillEl.style.background = 'var(--color-hp-low)';
    }
    this.hpTextEl.textContent = `${current} / ${max}`;
  }

  setEnergy(current: number, max: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.energyFillEl.style.width = `${Math.round(ratio * 100)}%`;
    this.energyTextEl.textContent = `${current} / ${max}`;
    if (current <= 0) {
      this.energyFillEl.style.background = '#8a4444';
    } else {
      this.energyFillEl.style.background = '#4a9bc7';
    }
  }

  setXp(current: number, threshold: number): void {
    this.currentXp = current;
    this.xpThreshold = threshold;
    const ratio = threshold > 0 ? Math.max(0, Math.min(1, current / threshold)) : 0;
    // Update XP ring around level badge
    if (this.xpRingCircle) {
      const circumference = 2 * Math.PI * 21;
      const offset = circumference * (1 - ratio);
      this.xpRingCircle.setAttribute('stroke-dashoffset', String(offset));
    }
  }

  updateBuffs(buffs: ActiveSpellBuffDto[]): void {
    this.buffBar?.updateBuffs(buffs);
  }

  setLevel(level: number): void {
    this.levelEl.textContent = String(level);
  }

  updateStats(attack: number, defence: number): void {
    if (this.attackEl) this.attackEl.textContent = String(attack);
    if (this.defenceEl) this.defenceEl.textContent = String(defence);
  }

  setCrowns(amount: number): void {
    if (this.crownsEl) this.crownsEl.textContent = String(amount);
  }

  setUnspentPoints(count: number): void {
    if (!this.unspentBadge) return;
    // If new points were earned (count increased), reset dismissal
    if (count > this.lastUnspentCount) {
      this.badgeDismissed = false;
    }
    this.lastUnspentCount = count;
    if (count > 0 && !this.badgeDismissed) {
      this.unspentBadge.textContent = `SP ${count}`;
      this.unspentBadge.style.display = 'inline';
    } else {
      this.unspentBadge.style.display = 'none';
    }
  }

  setCharacterData(data: CharacterData, xpThreshold: number): void {
    this.characterData = data;
    this.xpThreshold = xpThreshold;
    this.setEnergy(data.current_energy, data.max_energy);
    if (this.expanded && this.expandedPanel) {
      this.renderExpandedContent();
    }
  }

  setEffectiveStats(attack: number, defence: number): void {
    this.effectiveAttack = attack;
    this.effectiveDefence = defence;
    if (this.expanded && this.expandedPanel) {
      this.renderExpandedContent();
    }
  }

  // ---------------------------------------------------------------------------
  // Expand / collapse
  // ---------------------------------------------------------------------------

  isExpanded(): boolean {
    return this.expanded;
  }

  toggle(): void {
    if (this.expanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /** Target top position — just below the left-panel tabs. */
  private targetTop = 0;
  setExpandTarget(tabsBottom: number): void {
    this.targetTop = tabsBottom;
  }

  private expand(): void {
    if (this.expanded) return;
    this.expanded = true;

    // Hide collapsed content and the expand arrow on the stats-slot
    this.collapsedEl.style.display = 'none';
    this.expandBtn.style.display = 'none';

    // Compute geometry
    const statsSlotRect = this.mountEl.getBoundingClientRect();
    const targetBottom = statsSlotRect.bottom;
    const panelWidth = statsSlotRect.width;
    const panelLeft = statsSlotRect.left;
    const collapsedHeight = statsSlotRect.height;
    const expandedHeight = targetBottom - this.targetTop;

    // Create the expanded panel (fixed position, grows upward)
    if (!this.expandedPanel) {
      this.expandedPanel = document.createElement('div');
      this.expandedPanel.style.cssText = `
        position: fixed;
        overflow-y: auto;
        overflow-x: hidden;
        background: rgba(10, 9, 7, 0.97);
        border-right: 1px solid #5a4a2a;
        z-index: 50;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        transition: height 0.3s ease, opacity 0.25s ease;
      `;
      document.body.appendChild(this.expandedPanel);
    }

    // Position at collapsed size first (for animation start)
    this.expandedPanel.style.left = `${panelLeft}px`;
    this.expandedPanel.style.width = `${panelWidth}px`;
    this.expandedPanel.style.bottom = `${window.innerHeight - targetBottom}px`;
    this.expandedPanel.style.height = `${collapsedHeight}px`;
    this.expandedPanel.style.top = 'auto';
    this.expandedPanel.style.display = 'flex';
    this.expandedPanel.style.opacity = '0';

    this.renderExpandedContent();

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.expandedPanel) return;
        this.expandedPanel.style.height = `${expandedHeight}px`;
        this.expandedPanel.style.opacity = '1';
      });
    });
  }

  collapse(): void {
    if (!this.expanded) return;
    this.expanded = false;

    if (this.expandedPanel) {
      // Animate back to collapsed height
      const statsSlotRect = this.mountEl.getBoundingClientRect();
      this.expandedPanel.style.height = `${statsSlotRect.height}px`;
      this.expandedPanel.style.opacity = '0';

      // Restore collapsed content after animation finishes
      setTimeout(() => {
        this.collapsedEl.style.display = 'flex';
        this.expandBtn.style.display = '';
        this.expandBtn.textContent = '\u25B2';
        this.expandBtn.title = 'Expand character stats';
        this.expandedPanel!.style.display = 'none';
      }, 300);
    } else {
      // No panel — just restore immediately
      this.collapsedEl.style.display = 'flex';
      this.expandBtn.style.display = '';
      this.expandBtn.textContent = '\u25B2';
      this.expandBtn.title = 'Expand character stats';
    }
  }

  private renderExpandedContent(): void {
    if (!this.expandedPanel || !this.characterData) return;
    const c = this.characterData;
    const xpNeeded = Math.max(0, this.xpThreshold - c.experience);
    const hpRatio = c.max_hp > 0 ? Math.max(0, Math.min(1, c.current_hp / c.max_hp)) : 0;

    let hpColor = 'var(--color-hp-high)';
    if (hpRatio <= 0.3) hpColor = 'var(--color-hp-low)';
    else if (hpRatio <= 0.6) hpColor = 'var(--color-hp-mid)';

    const effAtk = this.effectiveAttack || c.attack_power;
    const effDef = this.effectiveDefence || c.defence;
    const gearAtk = effAtk - c.attack_power;
    const gearDef = effDef - c.defence;

    this.expandedPanel.innerHTML = '';

    // Collapse arrow at the very top
    const collapseRow = document.createElement('div');
    collapseRow.style.cssText = 'display:flex;justify-content:center;padding:6px 0 2px;flex-shrink:0;';
    const collapseBtn = document.createElement('button');
    collapseBtn.style.cssText = `
      background: rgba(37,33,25,0.9);
      border: 1px solid #5a4a2a;
      border-radius: 2px;
      color: #a89880;
      font-size: 10px;
      cursor: pointer;
      padding: 1px 14px;
      line-height: 1;
      transition: color 0.15s, border-color 0.15s;
    `;
    collapseBtn.textContent = '\u25BC'; // ▼
    collapseBtn.title = 'Collapse character stats';
    collapseBtn.addEventListener('mouseenter', () => {
      collapseBtn.style.color = '#d4a84b';
      collapseBtn.style.borderColor = '#d4a84b';
    });
    collapseBtn.addEventListener('mouseleave', () => {
      collapseBtn.style.color = '#a89880';
      collapseBtn.style.borderColor = '#5a4a2a';
    });
    collapseBtn.addEventListener('click', () => this.collapse());
    collapseRow.appendChild(collapseBtn);
    this.expandedPanel.appendChild(collapseRow);

    // Stats content below the arrow
    const statsContent = document.createElement('div');
    statsContent.style.cssText = 'display:flex;flex-direction:column;gap:14px;padding:0 20px 16px;overflow-y:auto;flex:1;';
    statsContent.innerHTML = `
      <div style="text-align:center;">
        <div style="font-family:var(--font-display);font-size:18px;font-weight:bold;color:var(--color-gold-bright);letter-spacing:0.06em;">
          ${this.esc(c.name)}
        </div>
        <div style="font-family:var(--font-display);font-size:11px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
          ${this.esc(c.class_name || 'Class ' + c.class_id)}
        </div>
      </div>

      <div style="display:flex;justify-content:center;">
        <div style="width:52px;height:52px;background:rgba(37,33,25,0.8);border:1px solid var(--color-gold-dim);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span style="font-family:var(--font-display);font-size:8px;color:var(--color-text-muted);letter-spacing:1.5px;text-transform:uppercase;">LVL</span>
          <span style="font-family:var(--font-number);font-size:20px;font-weight:600;color:var(--color-gold-bright);line-height:1;">${c.level}</span>
        </div>
      </div>

      ${this.renderBar('HP', c.current_hp, c.max_hp, hpColor, `${c.current_hp} / ${c.max_hp}`)}
      ${this.renderBar('Energy', c.current_energy, c.max_energy, c.current_energy > 0 ? '#4a9bc7' : '#8a4444', `${c.current_energy} / ${c.max_energy}`)}
      ${this.renderBar('XP', c.experience, this.xpThreshold, 'var(--color-xp-fill)', `${c.experience} / ${this.xpThreshold}`)}
      <div style="font-family:var(--font-body);font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:-8px;">
        ${xpNeeded > 0 ? `${xpNeeded} XP to next level` : 'Max level reached'}
      </div>

      <div style="border-top:1px solid #3a2e1a;margin:2px 0;"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;">
        ${this.renderStat('Attack', effAtk, '#e8c878')}
        ${this.renderStat('Defence', effDef, '#78a8e8')}
        ${this.renderStat('Max HP', c.max_hp, '#6dc86d')}
        ${this.renderStat('Crowns', c.crowns, '#d4a84b')}
      </div>

      ${this.renderRodUpgradePoints(c.rod_upgrade_points)}

      <div style="border-top:1px solid #3a2e1a;margin:2px 0;"></div>

      <div style="font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px;">Attributes</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">
        ${this.renderAttr('CON', c.attr_constitution, '+4 HP, +1 ATK')}
        ${this.renderAttr('STR', c.attr_strength, '+2 ATK, +0.3% CrD')}
        ${this.renderAttr('INT', c.attr_intelligence, '+8 Mana')}
        ${this.renderAttr('DEX', c.attr_dexterity, '+0.1% Cr, +0.1% Dg')}
        ${this.renderAttr('TOU', c.attr_toughness, '+1 DEF')}
      </div>
      ${c.stat_points_unspent > 0 ? `<div style="font-family:var(--font-number);font-size:11px;color:#f0c060;text-align:center;">${c.stat_points_unspent} unspent point${c.stat_points_unspent !== 1 ? 's' : ''}</div>` : ''}

      <div style="border-top:1px solid #3a2e1a;margin:2px 0;"></div>

      <div style="font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px;">Derived Stats</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">
        ${this.renderDerived('Max HP', c.max_hp, '#6dc86d')}
        ${this.renderDerived('Mana', 100 + c.attr_intelligence * 8, '#78a8e8')}
        ${this.renderDerived('Attack', effAtk, '#e8c878', c.attack_power, gearAtk)}
        ${this.renderDerived('Defence', effDef, '#78a8e8', c.defence, gearDef)}
        ${this.renderDerived('Crit %', parseFloat((c.attr_dexterity * 0.1 + (c.gear_crit_chance ?? 0)).toFixed(1)), '#e8a878', parseFloat((c.attr_dexterity * 0.1).toFixed(1)), c.gear_crit_chance ?? 0)}
        ${this.renderDerived('Dodge %', parseFloat((c.attr_dexterity * 0.1).toFixed(1)), '#a8e878')}
        ${this.renderDerived('Crit Dmg', parseFloat((150 + c.attr_strength * 0.3).toFixed(1)), '#e87878')}
        ${this.renderDerived('Armor Pen', (c.armor_penetration ?? 0), '#70d4d8')}
        ${(c.additional_attacks ?? 0) > 0 ? this.renderDerived('1st Strikes', c.additional_attacks ?? 0, '#d870d8') : ''}
        ${this.renderDerived('Move Spd', c.current_energy > 0 ? c.movement_speed : Math.floor(c.movement_speed * 0.5), c.current_energy > 0 ? '#4a9bc7' : '#8a4444')}
      </div>
    `;
    this.expandedPanel.appendChild(statsContent);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private renderBar(label: string, current: number, max: number, color: string, text: string): string {
    const pct = max > 0 ? Math.round((current / max) * 100) : 0;
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <span style="font-family:var(--font-display);font-size:11px;color:var(--color-text-muted);letter-spacing:1px;text-transform:uppercase;">${label}</span>
          <span style="font-family:var(--font-number);font-size:13px;color:var(--color-text-secondary);">${text}</span>
        </div>
        <div style="background:rgba(30,26,20,0.8);border:1px solid rgba(92,77,61,0.5);border-radius:2px;height:12px;overflow:hidden;">
          <div style="height:100%;background:${color};width:${pct}%;transition:width 0.3s ease;"></div>
        </div>
      </div>
    `;
  }

  private renderStat(label: string, value: number, color: string): string {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:var(--font-display);font-size:10px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px;">${label}</span>
        <span style="font-family:var(--font-number);font-size:14px;color:${color};font-weight:600;">${value}</span>
      </div>
    `;
  }

  private renderRodUpgradePoints(points: number): string {
    const iconUrl = getRodUpgradePointsIconUrl();
    const iconHtml = iconUrl
      ? `<img src="${this.esc(iconUrl)}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;image-rendering:pixelated;" />`
      : `<span style="font-size:14px;vertical-align:middle;">🎣</span>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px;">
        <div style="display:flex;align-items:center;gap:6px;">
          ${iconHtml}
          <span style="font-family:var(--font-display);font-size:10px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:1px;">Rod Points</span>
        </div>
        <span style="font-family:var(--font-number);font-size:14px;color:#5ec4d4;font-weight:600;">${points}</span>
      </div>
    `;
  }

  private renderInfo(label: string, value: string): string {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
        <span style="font-family:var(--font-number);font-size:12px;color:var(--color-text-secondary);">${value}</span>
      </div>
    `;
  }

  private renderAttr(label: string, value: number, desc: string): string {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1px 0;">
        <div style="display:flex;align-items:baseline;gap:4px;">
          <span style="font-family:var(--font-display);font-size:11px;color:#e8c870;font-weight:600;min-width:28px;">${label}</span>
          <span style="font-family:var(--font-body);font-size:8px;color:#5a5040;">${desc}</span>
        </div>
        <span style="font-family:var(--font-number);font-size:13px;color:var(--color-text-secondary);font-weight:600;">${value}</span>
      </div>
    `;
  }

  private renderDerived(label: string, total: number, color: string, base?: number, gear?: number): string {
    let breakdown = '';
    if (base !== undefined && gear !== undefined && gear > 0) {
      breakdown = `<span style="font-family:var(--font-number);font-size:9px;color:#5a5040;margin-left:4px;">(${base}+${gear})</span>`;
    }
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1px 0;">
        <span style="font-family:var(--font-display);font-size:9px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
        <span style="font-family:var(--font-number);font-size:13px;color:${color};font-weight:600;">${total}${breakdown}</span>
      </div>
    `;
  }

  private esc(s: string): string {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  destroy(): void {
    this.container.remove();
    this.expandedPanel?.remove();
  }
}
