export class StatsBar {
  private container: HTMLDivElement;
  private nameEl: HTMLSpanElement;
  private levelEl: HTMLSpanElement;
  private hpFillEl: HTMLDivElement;
  private hpTextEl: HTMLSpanElement;
  private xpFillEl: HTMLDivElement;
  private xpTextEl: HTMLSpanElement;
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
  ) {
    this.maxHp = maxHp;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 28px;
    `;

    // Vertical separator helper
    const sep = () => {
      const d = document.createElement('div');
      d.style.cssText = 'width: 1px; height: 48px; background: rgba(92,77,61,0.5); flex-shrink: 0;';
      return d;
    };

    // ── Name & Class ─────────────────────────────────────────────
    const nameSection = document.createElement('div');
    nameSection.style.cssText = 'flex-shrink: 0; min-width: 110px;';

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
      max-width: 160px;
    `;
    this.nameEl.textContent = name;

    const classEl = document.createElement('span');
    classEl.style.cssText = `
      display: block;
      font-family: var(--font-display);
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    `;
    classEl.textContent = className;

    nameSection.appendChild(this.nameEl);
    nameSection.appendChild(classEl);

    // ── Level Badge ───────────────────────────────────────────────
    const levelBadge = document.createElement('div');
    levelBadge.style.cssText = `
      flex-shrink: 0;
      width: 48px;
      height: 48px;
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
      font-size: 18px;
      font-weight: 600;
      color: var(--color-gold-bright);
      line-height: 1;
    `;
    this.levelEl.textContent = String(level);

    levelBadge.appendChild(lvLabel);
    levelBadge.appendChild(this.levelEl);

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

    // ── Assemble ──────────────────────────────────────────────────
    this.container.appendChild(nameSection);
    this.container.appendChild(sep());
    this.container.appendChild(levelBadge);
    this.container.appendChild(sep());
    this.container.appendChild(hpEl);
    this.container.appendChild(sep());
    this.container.appendChild(xpEl);

    mountEl.appendChild(this.container);

    this.setHp(hp, maxHp);
    this.setXp(xp, xpThreshold);
  }

  private createBarSection(
    label: string,
    fillColor: string,
    trackColor: string,
  ): { el: HTMLDivElement; fill: HTMLDivElement; valueText: HTMLSpanElement } {
    const el = document.createElement('div');
    el.style.cssText = 'flex: 1; min-width: 100px; max-width: 280px;';

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 5px;
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

  destroy(): void {
    this.container.remove();
  }
}
