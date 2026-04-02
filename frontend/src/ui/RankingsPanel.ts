import type { RankingsDataPayload, LeaderboardEntryDto, MapPopulationDto } from '@elarion/protocol';

type SendFn = (type: string, payload: unknown) => void;

type TabId = 'level' | 'fighters' | 'crafters' | 'questers' | 'arena' | 'maps';

const TABS: { id: TabId; label: string }[] = [
  { id: 'level', label: 'Level' },
  { id: 'fighters', label: 'Fighters' },
  { id: 'crafters', label: 'Crafters' },
  { id: 'questers', label: 'Questers' },
  { id: 'arena', label: 'Arena' },
  { id: 'maps', label: 'Maps' },
];

const VALUE_LABELS: Record<TabId, string> = {
  level: 'Lv',
  fighters: 'Wins',
  crafters: 'Crafts',
  questers: 'Quests',
  arena: 'PvP Wins',
  maps: '',
};

export class RankingsPanel {
  private container: HTMLElement;
  private contentEl: HTMLElement;
  private playerCountEl: HTMLElement;
  private updatedAtEl: HTMLElement;
  private tabBtns: HTMLButtonElement[] = [];
  private sendFn: SendFn | null = null;
  private visible = false;
  private activeTab: TabId = 'level';
  private data: RankingsDataPayload | null = null;
  private myCharacterId: string | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:600px',
      'max-width:90%',
      'height:75vh',
      'overflow:hidden',
      'background:rgba(20,16,8,0.96)',
      'border:1px solid #3a2e1a',
      'box-sizing:border-box',
      'display:none',
      'flex-direction:column',
      'z-index:150',
      'font-family:Cinzel,serif',
      'color:#c9a55c',
      'border-radius:4px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText =
      'padding:12px 14px 6px;border-bottom:1px solid #3a2e1a;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';

    const title = document.createElement('h2');
    title.textContent = 'Rankings';
    title.style.cssText = 'margin:0;font-size:16px;color:#e8c870;letter-spacing:0.08em;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText =
      'background:none;border:none;color:#8a7a5a;font-size:16px;cursor:pointer;padding:2px 6px;';
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#e8c870'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#8a7a5a'; });
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    this.container.appendChild(header);

    // Player count line
    this.playerCountEl = document.createElement('div');
    this.playerCountEl.style.cssText =
      'padding:4px 14px;font-size:11px;color:#8a7a5a;font-family:Crimson Text,serif;';
    this.container.appendChild(this.playerCountEl);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText =
      'display:flex;border-bottom:1px solid #3a2e1a;flex-shrink:0;padding:0 8px;';

    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.dataset['tabId'] = tab.id;
      btn.style.cssText = [
        'flex:1',
        'padding:6px 4px',
        'background:none',
        'border:none',
        'border-bottom:2px solid transparent',
        'color:#8a7a5a',
        'font-family:Cinzel,serif',
        'font-size:11px',
        'cursor:pointer',
        'letter-spacing:0.04em',
        'transition:color 0.15s,border-color 0.15s',
      ].join(';');
      btn.addEventListener('click', () => this.switchTab(tab.id));
      btn.addEventListener('mouseenter', () => {
        if (tab.id !== this.activeTab) btn.style.color = '#c9a55c';
      });
      btn.addEventListener('mouseleave', () => {
        if (tab.id !== this.activeTab) btn.style.color = '#8a7a5a';
      });
      tabBar.appendChild(btn);
      this.tabBtns.push(btn);
    }

    this.container.appendChild(tabBar);

    // Scrollable content area
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText =
      'flex:1;overflow-y:auto;padding:8px 14px 10px;font-family:Crimson Text,serif;';
    this.container.appendChild(this.contentEl);

    // Updated-at footer
    this.updatedAtEl = document.createElement('div');
    this.updatedAtEl.style.cssText =
      'padding:4px 14px 6px;font-size:10px;color:#6a5a3a;font-family:Crimson Text,serif;text-align:right;border-top:1px solid #2a2218;flex-shrink:0;';
    this.container.appendChild(this.updatedAtEl);

    parent.appendChild(this.container);
    this.updateTabStyles();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  setMyCharacterId(id: string): void {
    this.myCharacterId = id;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.renderLoading();
    this.sendFn?.('rankings.get', {});
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  handleRankingsData(payload: RankingsDataPayload): void {
    this.data = payload;
    this.playerCountEl.textContent = `${payload.total_players} player${payload.total_players !== 1 ? 's' : ''} on server`;
    this.updatedAtEl.textContent = `Updated ${this.formatRelativeTime(payload.updated_at)}`;
    this.renderTab();
  }

  // ---------------------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------------------

  private switchTab(tabId: TabId): void {
    this.activeTab = tabId;
    this.updateTabStyles();
    this.renderTab();
  }

  private updateTabStyles(): void {
    for (const btn of this.tabBtns) {
      const isActive = btn.dataset['tabId'] === this.activeTab;
      btn.style.color = isActive ? '#e8c870' : '#8a7a5a';
      btn.style.borderBottomColor = isActive ? '#d4a84b' : 'transparent';
      btn.style.fontWeight = isActive ? '700' : '400';
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderLoading(): void {
    this.contentEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.textContent = 'Loading rankings\u2026';
    msg.style.cssText = 'text-align:center;padding:24px 0;color:#8a7a5a;font-style:italic;';
    this.contentEl.appendChild(msg);
  }

  private renderTab(): void {
    if (!this.data) { this.renderLoading(); return; }

    this.contentEl.innerHTML = '';

    if (this.activeTab === 'maps') {
      this.renderMapPopulation(this.data.map_population);
      return;
    }

    const entries = this.getEntriesForTab(this.activeTab);
    const myRank = this.getMyRankForTab(this.activeTab);
    const valueLabel = VALUE_LABELS[this.activeTab];

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No rankings available yet.';
      empty.style.cssText = 'text-align:center;padding:24px 0;color:#8a7a5a;font-style:italic;';
      this.contentEl.appendChild(empty);
      return;
    }

    // Table header
    const headerRow = this.createRow('#', 'Class', 'Name', valueLabel, true);
    this.contentEl.appendChild(headerRow);

    // Leaderboard entries
    let playerInList = false;
    for (const entry of entries) {
      const isMe = entry.character_id === this.myCharacterId;
      if (isMe) playerInList = true;
      const row = this.createEntryRow(entry, isMe);
      this.contentEl.appendChild(row);
    }

    // Append player's own rank if not in top 20
    if (!playerInList && myRank && myRank.rank > 0) {
      const sep = document.createElement('div');
      sep.textContent = '\u22EE';
      sep.style.cssText = 'text-align:center;color:#5a4a2a;font-size:16px;padding:2px 0;';
      this.contentEl.appendChild(sep);

      const myEntry: LeaderboardEntryDto = {
        rank: myRank.rank,
        character_id: this.myCharacterId ?? '',
        character_name: 'You',
        class_id: 0,
        class_name: '',
        value: myRank.value,
      };
      const myRow = this.createEntryRow(myEntry, true);
      this.contentEl.appendChild(myRow);
    }
  }

  private getEntriesForTab(tab: TabId): LeaderboardEntryDto[] {
    if (!this.data) return [];
    switch (tab) {
      case 'level': return this.data.top_level;
      case 'fighters': return this.data.top_fighters;
      case 'crafters': return this.data.top_crafters;
      case 'questers': return this.data.top_questers;
      case 'arena': return this.data.top_arena;
      default: return [];
    }
  }

  private getMyRankForTab(tab: TabId): { rank: number; value: number } | null {
    if (!this.data) return null;
    switch (tab) {
      case 'level': return this.data.my_ranks.level;
      case 'fighters': return this.data.my_ranks.fighters;
      case 'crafters': return this.data.my_ranks.crafters;
      case 'questers': return this.data.my_ranks.questers;
      case 'arena': return this.data.my_ranks.arena;
      default: return null;
    }
  }

  private createRow(rank: string, cls: string, name: string, value: string, isHeader: boolean): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:grid',
      'grid-template-columns:32px 70px 1fr 50px',
      'gap:4px',
      'padding:4px 0',
      isHeader ? 'border-bottom:1px solid #2a2218' : '',
      'font-size:12px',
      'align-items:center',
    ].join(';');

    const cells = [rank, cls, name, value];
    const aligns = ['center', 'left', 'left', 'right'];
    const colors = isHeader ? ['#6a5a3a', '#6a5a3a', '#6a5a3a', '#6a5a3a'] : ['#8a7a5a', '#8a7a5a', '#c9a55c', '#c9a55c'];

    for (let i = 0; i < cells.length; i++) {
      const cell = document.createElement('span');
      cell.textContent = cells[i] ?? '';
      cell.style.cssText = `text-align:${aligns[i]};color:${colors[i]};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      if (isHeader) cell.style.fontWeight = '700';
      row.appendChild(cell);
    }
    return row;
  }

  private createEntryRow(entry: LeaderboardEntryDto, isMe: boolean): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:grid',
      'grid-template-columns:32px 70px 1fr 50px',
      'gap:4px',
      'padding:4px 2px',
      'font-size:12px',
      'align-items:center',
      'border-radius:2px',
      isMe ? 'background:rgba(212,168,75,0.12)' : '',
    ].join(';');

    // Rank
    const rankEl = document.createElement('span');
    rankEl.textContent = String(entry.rank);
    rankEl.style.cssText = `text-align:center;color:${isMe ? '#e8c870' : '#8a7a5a'};font-weight:${entry.rank <= 3 ? '700' : '400'};`;
    if (entry.rank === 1) rankEl.style.color = '#ffd700';
    else if (entry.rank === 2) rankEl.style.color = '#c0c0c0';
    else if (entry.rank === 3) rankEl.style.color = '#cd7f32';
    row.appendChild(rankEl);

    // Class name
    const classEl = document.createElement('span');
    classEl.textContent = entry.class_name || '\u2014';
    classEl.style.cssText = `color:#7a6a4a;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
    row.appendChild(classEl);

    // Character name
    const nameEl = document.createElement('span');
    nameEl.textContent = entry.character_name;
    nameEl.style.cssText = `color:${isMe ? '#e8c870' : '#c9a55c'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${isMe ? '700' : '400'};`;
    row.appendChild(nameEl);

    // Value
    const valueEl = document.createElement('span');
    valueEl.textContent = String(entry.value);
    valueEl.style.cssText = `text-align:right;color:${isMe ? '#e8c870' : '#c9a55c'};`;
    row.appendChild(valueEl);

    return row;
  }

  private renderMapPopulation(maps: MapPopulationDto[]): void {
    if (maps.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No map data available.';
      empty.style.cssText = 'text-align:center;padding:24px 0;color:#8a7a5a;font-style:italic;';
      this.contentEl.appendChild(empty);
      return;
    }

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText =
      'display:grid;grid-template-columns:1fr 60px;gap:4px;padding:4px 0;border-bottom:1px solid #2a2218;font-size:12px;';
    const nameH = document.createElement('span');
    nameH.textContent = 'Zone';
    nameH.style.cssText = 'color:#6a5a3a;font-weight:700;';
    const countH = document.createElement('span');
    countH.textContent = 'Players';
    countH.style.cssText = 'color:#6a5a3a;font-weight:700;text-align:right;';
    headerRow.appendChild(nameH);
    headerRow.appendChild(countH);
    this.contentEl.appendChild(headerRow);

    for (const m of maps) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:grid;grid-template-columns:1fr 60px;gap:4px;padding:4px 0;font-size:12px;';

      const zoneEl = document.createElement('span');
      zoneEl.textContent = m.zone_name;
      zoneEl.style.cssText = 'color:#c9a55c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

      const countEl = document.createElement('span');
      countEl.textContent = String(m.player_count);
      countEl.style.cssText = `text-align:right;color:${m.player_count > 0 ? '#c9a55c' : '#5a4a2a'};`;

      row.appendChild(zoneEl);
      row.appendChild(countEl);
      this.contentEl.appendChild(row);
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 30) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}
