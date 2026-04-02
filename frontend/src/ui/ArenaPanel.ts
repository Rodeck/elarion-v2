import type {
  ArenaEnteredPayload,
  ArenaParticipantDto,
  MonsterCombatDto,
} from '@elarion/protocol';

type SendMessageFn = (type: string, payload: Record<string, unknown>) => void;

const CLASS_NAMES: Record<number, string> = { 1: 'Warrior', 2: 'Mage', 3: 'Ranger' };
const CLASS_COLORS: Record<number, string> = { 1: '#c0392b', 2: '#8e44ad', 3: '#27ae60' };

export class ArenaPanel {
  private container: HTMLElement | null = null;
  private parent: HTMLElement;
  private sendMessage: SendMessageFn;

  // Callbacks
  private onChallengePlayer: ((targetId: string) => void) | null = null;
  private onChallengeNpc: ((monsterId: number) => void) | null = null;
  private onLeave: ((arenaId: number) => void) | null = null;

  // State
  private arenaId = 0;
  private myCharacterId = '';
  private participants = new Map<string, ArenaParticipantDto>();
  private monsters: MonsterCombatDto[] = [];
  private canLeaveAt: Date | null = null;
  private countdownInterval: number | null = null;
  private currentHp = 0;
  private maxHp = 0;
  private tokenCount = 0;
  private activeTab: 'pvp' | 'pve' = 'pvp';

  // DOM refs
  private participantListEl: HTMLElement | null = null;
  private fighterListEl: HTMLElement | null = null;
  private hpTextEl: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;
  private leaveBtn: HTMLButtonElement | null = null;
  private confirmOverlay: HTMLElement | null = null;
  private pvpTabBtn: HTMLButtonElement | null = null;
  private pveTabBtn: HTMLButtonElement | null = null;
  private pvpContent: HTMLElement | null = null;
  private pveContent: HTMLElement | null = null;
  private tokenCountEl: HTMLElement | null = null;

  constructor(parent: HTMLElement, sendMessage: SendMessageFn) {
    // Mount inside #canvas-area so we only cover the map, not the inventory panel
    const canvasArea = parent.querySelector('#canvas-area') as HTMLElement | null;
    this.parent = canvasArea ?? parent;
    this.sendMessage = sendMessage;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  show(data: ArenaEnteredPayload, myCharacterId: string): void {
    this.hide();

    this.arenaId = data.arena.id;
    this.myCharacterId = myCharacterId;
    this.currentHp = data.current_hp;
    this.maxHp = data.max_hp;
    this.canLeaveAt = new Date(data.can_leave_at);
    this.monsters = data.monsters ?? [];
    this.participants.clear();
    for (const p of data.participants) {
      this.participants.set(p.character_id, p);
    }

    this.render(data.arena.name);
    this.startCountdown();
  }

  hide(): void {
    this.stopCountdown();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.participantListEl = null;
    this.fighterListEl = null;
    this.hpTextEl = null;
    this.countdownEl = null;
    this.leaveBtn = null;
    this.confirmOverlay = null;
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  addParticipant(participant: ArenaParticipantDto): void {
    this.participants.set(participant.character_id, participant);
    this.refreshParticipantList();
  }

  removeParticipant(characterId: string): void {
    this.participants.delete(characterId);
    this.refreshParticipantList();
  }

  updateParticipant(characterId: string, inCombat: boolean, currentStreak?: number, arenaPvpWins?: number): void {
    const p = this.participants.get(characterId);
    if (p) {
      p.in_combat = inCombat;
      if (currentStreak !== undefined) p.current_streak = currentStreak;
      if (arenaPvpWins !== undefined) p.arena_pvp_wins = arenaPvpWins;
      this.refreshParticipantList();
    }
  }

  updateHp(currentHp: number, maxHp: number): void {
    this.currentHp = currentHp;
    this.maxHp = maxHp;
    if (this.hpTextEl) {
      this.hpTextEl.textContent = `${currentHp} / ${maxHp}`;
    }
  }

  resetLeaveTimer(canLeaveAt: Date): void {
    this.canLeaveAt = canLeaveAt;
    this.updateCountdown();
  }

  updateTokenCount(count: number): void {
    this.tokenCount = count;
    if (this.tokenCountEl) {
      this.tokenCountEl.textContent = `${count}`;
    }
    // Re-render fighter list to update button states
    if (this.activeTab === 'pve') this.refreshFighterList();
  }

  setOnChallengePlayer(cb: (targetId: string) => void): void {
    this.onChallengePlayer = cb;
  }

  setOnChallengeNpc(cb: (monsterId: number) => void): void {
    this.onChallengeNpc = cb;
  }

  setOnLeave(cb: (arenaId: number) => void): void {
    this.onLeave = cb;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(arenaName: string): void {
    const el = document.createElement('div');
    el.id = 'arena-panel';
    el.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:50',
      'display:flex',
      'flex-direction:column',
      'background:var(--color-bg-deepest, #0f0d0a)',
      'color:var(--color-text-primary, #f5e6c8)',
      'font-family:var(--font-body, "Crimson Text", Georgia, serif)',
      'overflow:hidden',
    ].join(';');

    // --- Header ---
    const header = document.createElement('div');
    header.style.cssText = [
      'padding:20px 24px 14px',
      'border-bottom:1px solid var(--color-gold-subtle, #5c4d3d)',
      'flex-shrink:0',
      'text-align:center',
    ].join(';');

    const title = document.createElement('h2');
    title.textContent = arenaName;
    title.style.cssText = [
      'margin:0',
      'font-family:var(--font-display, "Cinzel", serif)',
      'font-size:var(--type-heading, 22px)',
      'color:var(--color-gold-bright, #f0c060)',
      'letter-spacing:1px',
    ].join(';');
    header.appendChild(title);

    // HP display
    const hpRow = document.createElement('div');
    hpRow.style.cssText = 'margin-top:8px;font-size:var(--type-label, 14px);color:var(--color-text-secondary, #c8b89a);';
    hpRow.innerHTML = `<span style="color:var(--color-hp-high, #c0392b);">&#9829;</span> HP: `;
    this.hpTextEl = document.createElement('span');
    this.hpTextEl.style.cssText = 'font-family:var(--font-number, "Rajdhani", sans-serif);color:var(--color-text-primary, #f5e6c8);';
    this.hpTextEl.textContent = `${this.currentHp} / ${this.maxHp}`;
    hpRow.appendChild(this.hpTextEl);
    header.appendChild(hpRow);

    el.appendChild(header);

    // --- Tab bar ---
    const tabBar = document.createElement('div');
    tabBar.style.cssText = [
      'display:flex',
      'border-bottom:1px solid var(--color-gold-subtle, #5c4d3d)',
      'flex-shrink:0',
    ].join(';');

    const tabStyle = (active: boolean) => [
      'flex:1', 'padding:8px 0', 'border:none', 'cursor:pointer',
      'font-family:var(--font-display, "Cinzel", serif)',
      'font-size:12px', 'letter-spacing:0.5px', 'text-transform:uppercase',
      'transition:background 0.15s, color 0.15s',
      active
        ? 'background:var(--color-bg-panel, #252119);color:var(--color-gold-bright, #f0c060);border-bottom:2px solid var(--color-gold-primary, #d4a84b);'
        : 'background:transparent;color:var(--color-text-muted, #9b8b72);border-bottom:2px solid transparent;',
    ].join(';');

    this.pvpTabBtn = document.createElement('button');
    this.pvpTabBtn.textContent = '\u2694\uFE0F PvP Challengers';
    this.pvpTabBtn.style.cssText = tabStyle(true);
    this.pvpTabBtn.addEventListener('click', () => this.switchTab('pvp'));
    tabBar.appendChild(this.pvpTabBtn);

    this.pveTabBtn = document.createElement('button');
    this.pveTabBtn.textContent = '\uD83D\uDDE1\uFE0F Arena Fighters';
    this.pveTabBtn.style.cssText = tabStyle(false);
    this.pveTabBtn.addEventListener('click', () => this.switchTab('pve'));
    tabBar.appendChild(this.pveTabBtn);

    el.appendChild(tabBar);

    // --- PvP content (participants grid) ---
    this.pvpContent = document.createElement('div');
    this.pvpContent.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;';
    this.participantListEl = document.createElement('div');
    this.participantListEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;';
    this.pvpContent.appendChild(this.participantListEl);
    el.appendChild(this.pvpContent);

    // --- PvE content (fighter cards) ---
    this.pveContent = document.createElement('div');
    this.pveContent.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;display:none;';

    // Token info bar
    const tokenBar = document.createElement('div');
    tokenBar.style.cssText = [
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'padding:8px 12px', 'margin-bottom:12px',
      'background:var(--color-bg-panel, #252119)',
      'border:1px solid var(--color-gold-subtle, #5c4d3d)',
      'border-radius:4px',
      'font-size:12px',
    ].join(';');
    const tokenLabel = document.createElement('span');
    tokenLabel.style.cssText = 'color:var(--color-text-secondary, #c8b89a);';
    tokenLabel.textContent = 'Arena Challenge Tokens: ';
    this.tokenCountEl = document.createElement('span');
    this.tokenCountEl.style.cssText = 'color:var(--color-gold-bright, #f0c060);font-family:var(--font-number, "Rajdhani", sans-serif);font-weight:bold;font-size:14px;';
    this.tokenCountEl.textContent = `${this.tokenCount}`;
    tokenLabel.appendChild(this.tokenCountEl);
    tokenBar.appendChild(tokenLabel);
    const tokenHint = document.createElement('span');
    tokenHint.style.cssText = 'color:var(--color-text-muted, #9b8b72);font-style:italic;font-size:11px;';
    tokenHint.textContent = '1 token consumed per challenge';
    tokenBar.appendChild(tokenHint);
    this.pveContent.appendChild(tokenBar);

    this.fighterListEl = document.createElement('div');
    this.fighterListEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;';
    this.pveContent.appendChild(this.fighterListEl);
    el.appendChild(this.pveContent);

    // --- Footer ---
    const footer = document.createElement('div');
    footer.style.cssText = [
      'padding:12px 20px 16px',
      'border-top:1px solid var(--color-gold-subtle, #5c4d3d)',
      'flex-shrink:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:10px',
    ].join(';');

    // Countdown
    this.countdownEl = document.createElement('div');
    this.countdownEl.style.cssText = [
      'font-size:var(--type-label, 14px)',
      'color:var(--color-text-muted, #9b8b72)',
      'font-family:var(--font-number, "Rajdhani", sans-serif)',
    ].join(';');
    footer.appendChild(this.countdownEl);

    // Leave button
    this.leaveBtn = document.createElement('button');
    this.leaveBtn.textContent = 'Leave Arena';
    this.leaveBtn.disabled = true;
    this.applyButtonStyle(this.leaveBtn, true);
    this.leaveBtn.addEventListener('click', () => this.showLeaveConfirmation());
    footer.appendChild(this.leaveBtn);

    el.appendChild(footer);

    this.container = el;
    this.parent.appendChild(el);

    // Populate lists
    this.refreshParticipantList();
    this.refreshFighterList();
  }

  private createSection(titleText: string): HTMLElement {
    const section = document.createElement('div');

    const heading = document.createElement('h3');
    heading.textContent = titleText;
    heading.style.cssText = [
      'margin:0 0 8px',
      'font-family:var(--font-display, "Cinzel", serif)',
      'font-size:var(--type-label, 14px)',
      'color:var(--color-gold-primary, #d4a84b)',
      'text-transform:uppercase',
      'letter-spacing:0.5px',
    ].join(';');
    section.appendChild(heading);

    return section;
  }

  // ---------------------------------------------------------------------------
  // Participant list
  // ---------------------------------------------------------------------------

  private refreshParticipantList(): void {
    if (!this.participantListEl) return;
    this.participantListEl.innerHTML = '';

    // Render all participants (including self)
    for (const p of this.participants.values()) {
      const isSelf = p.character_id === this.myCharacterId;

      const card = document.createElement('div');
      const borderColor = isSelf
        ? 'var(--color-gold-primary, #d4a84b)'
        : p.in_combat
          ? '#8a3a3a'
          : 'var(--color-gold-subtle, #5c4d3d)';
      card.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'padding:14px 10px',
        `background:${isSelf ? 'rgba(90,74,42,0.25)' : 'var(--color-bg-panel, #252119)'}`,
        `border:1px solid ${borderColor}`,
        'border-radius:6px',
        'position:relative',
        'gap:6px',
        'transition:border-color 0.15s',
      ].join(';');

      // Combat overlay
      if (p.in_combat) {
        const overlay = document.createElement('div');
        overlay.style.cssText = [
          'position:absolute', 'inset:0', 'background:rgba(0,0,0,0.7)',
          'border-radius:6px', 'display:flex', 'flex-direction:column',
          'align-items:center', 'justify-content:center', 'gap:4px',
          'z-index:2',
        ].join(';');
        const combatIcon = document.createElement('span');
        combatIcon.textContent = '\u2694\uFE0F';
        combatIcon.style.cssText = 'font-size:24px;';
        overlay.appendChild(combatIcon);
        const combatLabel = document.createElement('span');
        combatLabel.textContent = 'IN COMBAT';
        combatLabel.style.cssText = [
          'color:#fff', 'font-size:10px', 'font-weight:bold',
          'font-family:var(--font-display, "Cinzel", serif)',
          'letter-spacing:1px',
          'background:rgba(192,57,43,0.8)', 'padding:2px 8px', 'border-radius:3px',
        ].join(';');
        overlay.appendChild(combatLabel);
        card.appendChild(overlay);
      }

      // Avatar image
      const avatarWrap = document.createElement('div');
      avatarWrap.style.cssText = [
        'width:68px', 'height:68px', 'border-radius:50%', 'overflow:hidden',
        'border:2px solid ' + (CLASS_COLORS[p.class_id] ?? '#5c4d3d'),
        'background:var(--color-bg-deepest, #0f0d0a)',
        'flex-shrink:0',
      ].join(';');
      const avatarImg = document.createElement('img');
      avatarImg.src = '/assets/player_icons/player_1.png';
      avatarImg.alt = p.name;
      avatarImg.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      avatarImg.onerror = () => {
        avatarImg.remove();
        avatarWrap.style.display = 'flex';
        avatarWrap.style.alignItems = 'center';
        avatarWrap.style.justifyContent = 'center';
        avatarWrap.style.fontSize = '24px';
        avatarWrap.textContent = '\u{1F9D9}';
      };
      avatarWrap.appendChild(avatarImg);
      card.appendChild(avatarWrap);

      // Name
      const nameEl = document.createElement('div');
      nameEl.textContent = p.name;
      nameEl.style.cssText = [
        'color:var(--color-text-primary, #f5e6c8)',
        'font-size:var(--type-body, 13px)',
        'font-weight:bold',
        'text-align:center',
        'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
        'max-width:100%',
      ].join(';');
      card.appendChild(nameEl);

      // Class + Level row
      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const classBadge = document.createElement('span');
      const className = CLASS_NAMES[p.class_id] ?? 'Unknown';
      const classColor = CLASS_COLORS[p.class_id] ?? '#9b8b72';
      classBadge.textContent = className;
      classBadge.style.cssText = [
        'font-size:10px', 'padding:1px 6px', 'border-radius:3px',
        `background:${classColor}`, 'color:#fff',
        'font-family:var(--font-display, "Cinzel", serif)',
      ].join(';');
      metaRow.appendChild(classBadge);

      const levelEl = document.createElement('span');
      levelEl.textContent = `Lv.${p.level}`;
      levelEl.style.cssText = 'color:var(--color-text-muted, #9b8b72);font-size:var(--type-small, 11px);font-family:var(--font-number, "Rajdhani", sans-serif);';
      metaRow.appendChild(levelEl);

      card.appendChild(metaRow);

      // Stats row: streak + total wins
      const statsRow = document.createElement('div');
      statsRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:10px;font-family:var(--font-number, "Rajdhani", sans-serif);';

      if (p.current_streak > 0) {
        const streakEl = document.createElement('span');
        streakEl.textContent = `\uD83D\uDD25 ${p.current_streak}`;
        streakEl.title = `Current win streak: ${p.current_streak}`;
        streakEl.style.cssText = 'color:#e8a030;';
        statsRow.appendChild(streakEl);
      }

      const winsEl = document.createElement('span');
      winsEl.textContent = `\u2694\uFE0F ${p.arena_pvp_wins}`;
      winsEl.title = `Total arena PvP wins: ${p.arena_pvp_wins}`;
      winsEl.style.cssText = 'color:var(--color-text-muted, #9b8b72);';
      statsRow.appendChild(winsEl);

      card.appendChild(statsRow);

      // "You" label for self, Challenge button for others
      if (isSelf) {
        const youLabel = document.createElement('div');
        youLabel.textContent = 'You';
        youLabel.style.cssText = [
          'font-size:10px', 'color:var(--color-gold-primary, #d4a84b)',
          'font-family:var(--font-display, "Cinzel", serif)',
          'text-transform:uppercase', 'letter-spacing:1px',
        ].join(';');
        card.appendChild(youLabel);
      } else if (!p.in_combat) {
        const challengeBtn = document.createElement('button');
        challengeBtn.textContent = 'Challenge';
        challengeBtn.style.cssText = [
          'padding:4px 12px', 'font-size:11px', 'cursor:pointer',
          'background:rgba(120,30,30,0.4)', 'border:1px solid #8a3a3a',
          'border-radius:3px', 'color:#e06060',
          'font-family:var(--font-display, "Cinzel", serif)',
          'transition:background 0.15s',
        ].join(';');
        challengeBtn.addEventListener('mouseenter', () => { challengeBtn.style.background = 'rgba(120,30,30,0.7)'; });
        challengeBtn.addEventListener('mouseleave', () => { challengeBtn.style.background = 'rgba(120,30,30,0.4)'; });
        challengeBtn.addEventListener('click', () => {
          this.onChallengePlayer?.(p.character_id);
        });
        card.appendChild(challengeBtn);
      }

      this.participantListEl.appendChild(card);
    }

    // Show hint when alone
    const otherCount = Array.from(this.participants.values()).filter(p => p.character_id !== this.myCharacterId).length;
    if (otherCount === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'color:var(--color-text-muted, #9b8b72);font-style:italic;font-size:var(--type-body, 13px);grid-column:1/-1;text-align:center;padding:4px 0;';
      hint.textContent = 'Waiting for challengers\u2026';
      this.participantListEl.appendChild(hint);
    }
  }

  // ---------------------------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------------------------

  private switchTab(tab: 'pvp' | 'pve'): void {
    this.activeTab = tab;

    const activeStyle = [
      'flex:1', 'padding:8px 0', 'border:none', 'cursor:pointer',
      'font-family:var(--font-display, "Cinzel", serif)',
      'font-size:12px', 'letter-spacing:0.5px', 'text-transform:uppercase',
      'background:var(--color-bg-panel, #252119)', 'color:var(--color-gold-bright, #f0c060)',
      'border-bottom:2px solid var(--color-gold-primary, #d4a84b)',
    ].join(';');
    const inactiveStyle = [
      'flex:1', 'padding:8px 0', 'border:none', 'cursor:pointer',
      'font-family:var(--font-display, "Cinzel", serif)',
      'font-size:12px', 'letter-spacing:0.5px', 'text-transform:uppercase',
      'background:transparent', 'color:var(--color-text-muted, #9b8b72)',
      'border-bottom:2px solid transparent',
    ].join(';');

    if (this.pvpTabBtn) this.pvpTabBtn.style.cssText = tab === 'pvp' ? activeStyle : inactiveStyle;
    if (this.pveTabBtn) this.pveTabBtn.style.cssText = tab === 'pve' ? activeStyle : inactiveStyle;
    if (this.pvpContent) this.pvpContent.style.display = tab === 'pvp' ? 'block' : 'none';
    if (this.pveContent) this.pveContent.style.display = tab === 'pve' ? 'block' : 'none';

    if (tab === 'pve') this.refreshFighterList();
  }

  // ---------------------------------------------------------------------------
  // NPC Fighter list (card layout)
  // ---------------------------------------------------------------------------

  private refreshFighterList(): void {
    if (!this.fighterListEl) return;
    this.fighterListEl.innerHTML = '';

    if (this.monsters.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--color-text-muted, #9b8b72);font-style:italic;font-size:var(--type-body, 13px);grid-column:1/-1;text-align:center;';
      empty.textContent = 'No arena fighters available.';
      this.fighterListEl.appendChild(empty);
      return;
    }

    const hasTokens = this.tokenCount > 0;

    for (const m of this.monsters) {
      const card = document.createElement('div');
      card.style.cssText = [
        'display:flex', 'flex-direction:column', 'align-items:center',
        'background:var(--color-bg-panel, #252119)',
        'border:1px solid var(--color-gold-subtle, #5c4d3d)',
        'border-radius:6px', 'overflow:hidden',
        hasTokens ? '' : 'opacity:0.5;',
      ].join(';');

      // Fighter image (large rectangle)
      const imgWrap = document.createElement('div');
      imgWrap.style.cssText = [
        'width:100%', 'aspect-ratio:1', 'background:var(--color-bg-deepest, #0f0d0a)',
        'display:flex', 'align-items:center', 'justify-content:center', 'overflow:hidden',
      ].join(';');
      if (m.icon_url) {
        const img = document.createElement('img');
        img.src = m.icon_url;
        img.alt = m.name;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        img.onerror = () => { img.remove(); imgWrap.textContent = '\uD83D\uDDE1\uFE0F'; imgWrap.style.fontSize = '48px'; };
        imgWrap.appendChild(img);
      } else {
        imgWrap.textContent = '\uD83D\uDDE1\uFE0F';
        imgWrap.style.fontSize = '48px';
        imgWrap.style.color = 'var(--color-text-muted, #9b8b72)';
      }
      card.appendChild(imgWrap);

      // Info section
      const info = document.createElement('div');
      info.style.cssText = 'padding:8px 10px;width:100%;box-sizing:border-box;text-align:center;';

      // Name
      const nameEl = document.createElement('div');
      nameEl.textContent = m.name;
      nameEl.style.cssText = [
        'font-weight:bold', 'color:var(--color-text-primary, #f5e6c8)',
        'font-size:13px', 'margin-bottom:4px',
      ].join(';');
      info.appendChild(nameEl);

      // Stats row
      const statsEl = document.createElement('div');
      statsEl.style.cssText = [
        'display:flex', 'justify-content:center', 'gap:10px',
        'font-family:var(--font-number, "Rajdhani", sans-serif)',
        'font-size:11px', 'color:var(--color-text-muted, #9b8b72)',
        'margin-bottom:8px',
      ].join(';');
      statsEl.innerHTML = [
        `<span title="HP" style="color:#c0392b;">\u2764 ${m.max_hp}</span>`,
        `<span title="Attack" style="color:#e8a030;">\u2694 ${m.attack}</span>`,
        `<span title="Defence" style="color:#5b9bd5;">\uD83D\uDEE1 ${m.defence}</span>`,
      ].join('');
      info.appendChild(statsEl);

      // Challenge button
      const challengeBtn = document.createElement('button');
      challengeBtn.textContent = hasTokens ? 'Challenge' : 'No Tokens';
      challengeBtn.disabled = !hasTokens;
      challengeBtn.style.cssText = [
        'width:100%', 'padding:6px 0', 'border-radius:3px', 'cursor:pointer',
        'font-family:var(--font-display, "Cinzel", serif)', 'font-size:11px',
        'transition:background 0.15s',
        'border:1px solid',
        hasTokens
          ? 'background:rgba(120,30,30,0.4);border-color:#8a3a3a;color:#e06060;'
          : 'background:var(--color-bg-inset, #1a1612);border-color:var(--color-gold-dim, #5a4a2a);color:var(--color-text-disabled, #5a5040);cursor:default;',
      ].join(';');
      if (hasTokens) {
        challengeBtn.addEventListener('mouseenter', () => { challengeBtn.style.background = 'rgba(120,30,30,0.7)'; });
        challengeBtn.addEventListener('mouseleave', () => { challengeBtn.style.background = 'rgba(120,30,30,0.4)'; });
        challengeBtn.addEventListener('click', () => { this.onChallengeNpc?.(m.id); });
      }
      info.appendChild(challengeBtn);

      card.appendChild(info);
      this.fighterListEl.appendChild(card);
    }
  }

  // ---------------------------------------------------------------------------
  // Countdown timer
  // ---------------------------------------------------------------------------

  private startCountdown(): void {
    this.stopCountdown();
    this.updateCountdown();
    this.countdownInterval = window.setInterval(() => this.updateCountdown(), 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private updateCountdown(): void {
    if (!this.canLeaveAt || !this.countdownEl || !this.leaveBtn) return;

    const remaining = Math.max(0, this.canLeaveAt.getTime() - Date.now());
    if (remaining <= 0) {
      this.countdownEl.textContent = 'You may leave at any time.';
      this.countdownEl.style.color = 'var(--color-gold-primary, #d4a84b)';
      this.leaveBtn.disabled = false;
      this.applyButtonStyle(this.leaveBtn, false);
      this.stopCountdown();
      return;
    }

    const totalSec = Math.ceil(remaining / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const padSec = sec.toString().padStart(2, '0');
    this.countdownEl.textContent = `You may leave in: ${min}:${padSec}`;
  }

  // ---------------------------------------------------------------------------
  // Leave confirmation dialog
  // ---------------------------------------------------------------------------

  private showLeaveConfirmation(): void {
    if (this.confirmOverlay || !this.container) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:210',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(10,8,5,0.85)',
    ].join(';');

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'background:var(--color-bg-panel, #252119)',
      'border:2px solid var(--color-gold-primary, #d4a84b)',
      'border-radius:6px',
      'padding:24px 32px',
      'text-align:center',
      'max-width:320px',
    ].join(';');

    const msg = document.createElement('p');
    msg.style.cssText = 'margin:0 0 16px;font-size:var(--type-body, 13px);color:var(--color-text-primary, #f5e6c8);';
    msg.textContent = 'Are you sure you want to leave the arena? A cooldown will apply before you can re-enter.';
    dialog.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Leave';
    this.applyButtonStyle(confirmBtn, false);
    confirmBtn.style.background = 'var(--color-hp-high, #c0392b)';
    confirmBtn.addEventListener('click', () => {
      this.hideLeaveConfirmation();
      this.onLeave?.(this.arenaId);
    });
    btnRow.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Stay';
    this.applyButtonStyle(cancelBtn, false);
    cancelBtn.addEventListener('click', () => this.hideLeaveConfirmation());
    btnRow.appendChild(cancelBtn);

    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    this.container.appendChild(overlay);
    this.confirmOverlay = overlay;
  }

  private hideLeaveConfirmation(): void {
    if (this.confirmOverlay) {
      this.confirmOverlay.remove();
      this.confirmOverlay = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Shared button styling
  // ---------------------------------------------------------------------------

  private applyButtonStyle(btn: HTMLButtonElement, disabled: boolean): void {
    btn.style.cssText = [
      'padding:4px 12px',
      'border:1px solid var(--color-gold-dim, #8b7355)',
      'border-radius:3px',
      'font-family:var(--font-display, "Cinzel", serif)',
      'font-size:var(--type-small, 11px)',
      'cursor:pointer',
      'transition:background 0.15s, color 0.15s',
      disabled
        ? 'background:var(--color-bg-inset, #1a1612);color:var(--color-text-disabled, #5a5040);cursor:default;'
        : 'background:var(--color-bg-panel-alt, #2f2a21);color:var(--color-gold-bright, #f0c060);',
    ].join(';');
  }
}
