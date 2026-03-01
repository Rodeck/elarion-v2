const MAX_LINES = 50;

export class CombatLog {
  private panel: HTMLDivElement;
  private messageList: HTMLDivElement;
  private lines: string[] = [];
  private visible = false;

  constructor() {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 10px;
      width: 300px;
      max-height: 200px;
      background: rgba(0,0,0,0.75);
      border: 1px solid #446644;
      border-radius: 4px;
      display: none;
      flex-direction: column;
      font-family: monospace;
      font-size: 11px;
      color: #cccccc;
      z-index: 200;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 4px 8px;
      background: #1a2a1a;
      color: #e8d5a3;
      font-size: 12px;
      border-bottom: 1px solid #446644;
      cursor: pointer;
    `;
    header.textContent = 'Combat Log';
    header.addEventListener('click', () => this.toggle());

    this.messageList = document.createElement('div');
    this.messageList.style.cssText = `
      overflow-y: auto;
      padding: 6px;
      flex: 1;
    `;

    this.panel.appendChild(header);
    this.panel.appendChild(this.messageList);
    document.body.appendChild(this.panel);
  }

  show(): void {
    this.panel.style.display = 'flex';
    this.visible = true;
  }

  hide(): void {
    this.panel.style.display = 'none';
    this.visible = false;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  appendRound(
    roundNumber: number,
    attacker: string,
    action: string,
    damage: number,
    playerHpAfter: number,
    monsterHpAfter: number,
  ): void {
    const actionStr = action === 'miss' ? 'misses' : action === 'critical' ? `crits for ${damage}` : `hits for ${damage}`;
    const line = `Round ${roundNumber}: ${attacker} ${actionStr} dmg. HP ▸ Player: ${playerHpAfter} | Monster: ${monsterHpAfter}`;
    this.addLine(line, '#dddddd');
    this.show();
  }

  appendSummary(outcome: 'victory' | 'defeat', xpGained: number, items: { name: string; quantity: number }[]): void {
    const outcomeColor = outcome === 'victory' ? '#88ff88' : '#ff8888';
    const outcomeStr = outcome === 'victory' ? '⚔ VICTORY' : '💀 DEFEAT';
    this.addLine('─'.repeat(30), '#444444');
    this.addLine(`${outcomeStr} — XP: ${xpGained}`, outcomeColor);
    if (items.length > 0) {
      const itemStr = items.map((i) => `${i.name} ×${i.quantity}`).join(', ');
      this.addLine(`Items: ${itemStr}`, '#aaddff');
    }
  }

  private addLine(text: string, color: string): void {
    this.lines.push(text);
    if (this.lines.length > MAX_LINES) this.lines.shift();

    const el = document.createElement('div');
    el.style.color = color;
    el.textContent = text;
    this.messageList.appendChild(el);

    // Remove oldest visual entries if over limit
    while (this.messageList.children.length > MAX_LINES) {
      this.messageList.removeChild(this.messageList.firstChild!);
    }

    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  destroy(): void {
    this.panel.remove();
  }
}
