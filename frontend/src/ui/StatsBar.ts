export class StatsBar {
  private container: HTMLDivElement;
  private nameEl: HTMLSpanElement;
  private levelEl: HTMLSpanElement;
  private hpFillEl: HTMLDivElement;
  private hpTextEl: HTMLSpanElement;
  private xpFillEl: HTMLDivElement;
  private xpTextEl: HTMLSpanElement;
  private attackEl: HTMLSpanElement | null = null;
  private defenceEl: HTMLSpanElement | null = null;
  private crownsEl: HTMLSpanElement | null = null;
  private maxHp = 1;

  constructor(
    mountEl: HTMLElement,
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
    `;

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

    headerRow.appendChild(nameBlock);
    headerRow.appendChild(levelBadge);

    // ── HP Bar ────────────────────────────────────────────────────
    const { el: hpEl, fill: hpFill, valueText: hpText } = this.createBarSection(
      'HP',
      'var(--color-hp-high)',
      'var(--color-hp-bg)',
    );
    this.hpFillEl = hpFill;
    this.hpTextEl = hpText;

    // ── XP Bar ────────────────────────────────────────────────────
    const { el: xpEl, fill: xpFill, valueText: xpText } = this.createBarSection(
      'XP',
      'var(--color-xp-fill)',
      'var(--color-xp-bg)',
    );
    this.xpFillEl = xpFill;
    this.xpTextEl = xpText;

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

    // ── Assemble ──────────────────────────────────────────────────
    this.container.appendChild(headerRow);
    this.container.appendChild(hpEl);
    this.container.appendChild(xpEl);
    this.container.appendChild(statsRow);

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

  setXp(current: number, threshold: number): void {
    const ratio = threshold > 0 ? Math.max(0, Math.min(1, current / threshold)) : 0;
    this.xpFillEl.style.width = `${Math.round(ratio * 100)}%`;
    this.xpTextEl.textContent = `${current} / ${threshold}`;
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

  destroy(): void {
    this.container.remove();
  }
}
