export interface NearbyPlayerEntry {
  id: string;
  name: string;
  level: number;
}

export class NearbyPlayersPanel {
  private panel: HTMLDivElement;
  private playerList: HTMLDivElement;
  private emptyState: HTMLDivElement;
  private onPlayerClick: ((playerId: string) => void) | null = null;

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
      flex-shrink: 0;
    `;
    header.textContent = 'Nearby Players';

    this.playerList = document.createElement('div');
    this.playerList.style.cssText = `
      overflow-y: auto;
      padding: 6px 8px;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--color-gold-subtle) transparent;
    `;

    this.emptyState = document.createElement('div');
    this.emptyState.style.cssText = `
      color: var(--color-text-secondary);
      font-style: italic;
      padding: 12px 4px;
      text-align: center;
    `;
    this.emptyState.textContent = 'No other players here';

    this.panel.appendChild(header);
    this.panel.appendChild(this.playerList);
    container.appendChild(this.panel);
  }

  setOnPlayerClick(callback: (playerId: string) => void): void {
    this.onPlayerClick = callback;
  }

  update(players: NearbyPlayerEntry[]): void {
    this.playerList.innerHTML = '';

    if (players.length === 0) {
      this.playerList.appendChild(this.emptyState);
      return;
    }

    for (const player of players) {
      const entry = document.createElement('div');
      entry.style.cssText = `
        padding: 4px 6px;
        margin-bottom: 2px;
        cursor: pointer;
        border-radius: 3px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.15s;
      `;
      entry.addEventListener('mouseenter', () => {
        entry.style.background = 'rgba(90,74,42,0.3)';
      });
      entry.addEventListener('mouseleave', () => {
        entry.style.background = 'transparent';
      });
      entry.addEventListener('click', () => {
        this.onPlayerClick?.(player.id);
      });

      const nameEl = document.createElement('span');
      nameEl.style.cssText = `
        color: var(--color-gold-bright);
        font-family: var(--font-body);
      `;
      nameEl.textContent = player.name;

      const levelEl = document.createElement('span');
      levelEl.style.cssText = `
        color: var(--color-text-secondary);
        font-size: 0.85em;
        margin-left: 8px;
      `;
      levelEl.textContent = `Lv. ${player.level}`;

      entry.appendChild(nameEl);
      entry.appendChild(levelEl);
      this.playerList.appendChild(entry);
    }
  }

  destroy(): void {
    this.panel.remove();
  }
}
