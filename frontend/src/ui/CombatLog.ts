const MAX_LINES = 50;

export class CombatLog {
  private panel: HTMLDivElement;
  private messageList: HTMLDivElement;
  private lines: string[] = [];

  constructor(container: HTMLElement = document.body) {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      width: clamp(200px, 40%, 510px);
      height: 100%;
      flex-shrink: 0;
      background: rgba(20, 18, 14, 0.95);
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      font-size: var(--type-body);
      color: var(--color-text-primary);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 5px 10px;
      background: linear-gradient(to bottom, rgba(60,50,30,0.95), rgba(37,33,25,0.95));
      color: var(--color-gold-primary);
      font-family: var(--font-display);
      font-size: var(--type-small);
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid var(--color-gold-subtle);
      cursor: pointer;
      flex-shrink: 0;
    `;
    header.textContent = 'Combat Log';

    this.messageList = document.createElement('div');
    this.messageList.style.cssText = `
      overflow-y: auto;
      padding: 6px 8px;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--color-gold-subtle) transparent;
    `;

    this.panel.appendChild(header);
    this.panel.appendChild(this.messageList);
    container.appendChild(this.panel);
  }

  appendRound(
    roundNumber: number,
    attacker: string,
    action: string,
    damage: number,
    playerHpAfter: number,
    monsterHpAfter: number,
  ): void {
    let color: string;
    let actionStr: string;
    if (action === 'miss') {
      actionStr = 'misses';
      color = 'var(--color-combat-miss)';
    } else if (action === 'critical') {
      actionStr = `crits for ${damage}`;
      color = 'var(--color-combat-crit)';
    } else {
      actionStr = `hits for ${damage}`;
      color = attacker === 'player' ? 'var(--color-combat-dmg)' : 'var(--color-text-secondary)';
    }
    const line = `Round ${roundNumber}: ${attacker} ${actionStr} dmg. HP ▸ Player: ${playerHpAfter} | Monster: ${monsterHpAfter}`;
    this.addLine(line, color);
  }

  appendSummary(outcome: 'victory' | 'defeat', xpGained: number, items: { name: string; quantity: number }[]): void {
    this.addLine('─'.repeat(28), 'var(--color-gold-subtle)');
    const outcomeColor = outcome === 'victory' ? 'var(--color-combat-heal)' : 'var(--color-combat-dmg)';
    const outcomeStr   = outcome === 'victory' ? '⚔ VICTORY' : '✦ DEFEAT';
    this.addLine(`${outcomeStr} — XP: ${xpGained}`, outcomeColor);
    if (items.length > 0) {
      const itemStr = items.map((i) => `${i.name} ×${i.quantity}`).join(', ');
      this.addLine(`Items: ${itemStr}`, 'var(--color-chat-global)');
    }
  }

  appendError(message: string): void {
    this.addLine(`⚠ ${message}`, 'var(--color-combat-dmg)');
  }

  private addLine(text: string, color: string): void {
    this.lines.push(text);
    if (this.lines.length > MAX_LINES) this.lines.shift();

    const el = document.createElement('div');
    el.style.cssText = `color: ${color}; font-style: italic; margin-bottom: 2px; line-height: 1.35;`;
    el.textContent = text;
    this.messageList.appendChild(el);

    while (this.messageList.children.length > MAX_LINES) {
      this.messageList.removeChild(this.messageList.firstChild!);
    }

    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  destroy(): void {
    this.panel.remove();
  }
}
