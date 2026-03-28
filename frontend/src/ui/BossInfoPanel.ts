import type { BossDto } from '@elarion/protocol';

type ChallengeCallback = (bossId: number) => void;

/**
 * HTML panel showing boss information and challenge button.
 * Mounted as an absolute-positioned overlay on the game area.
 */
export class BossInfoPanel {
  private container: HTMLElement;
  private nameEl: HTMLElement;
  private descEl: HTMLElement;
  private statusEl: HTMLElement;
  private attemptsEl: HTMLElement;
  private tokenCountEl: HTMLElement;
  private challengeBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private visible = false;
  private currentBoss: BossDto | null = null;
  private respawnInterval: number | null = null;
  public onChallenge: ChallengeCallback | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:380px',
      'max-width:90%',
      'background:rgba(20,16,8,0.96)',
      'border:1px solid #3a2e1a',
      'box-sizing:border-box',
      'display:none',
      'flex-direction:column',
      'z-index:150',
      'font-family:Cinzel,serif',
      'color:var(--color-text-secondary, #c8b89a)',
      'border-radius:4px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      'padding:0',
    ].join(';');

    // Header with close button
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid #3a2e1a;';

    this.nameEl = document.createElement('div');
    this.nameEl.style.cssText = [
      'font-size:20px',
      'color:var(--color-gold-bright, #f0c060)',
      'font-family:Cinzel,serif',
      'font-weight:700',
      'text-shadow:0 1px 4px rgba(0,0,0,0.5)',
    ].join(';');

    this.closeBtn = document.createElement('button');
    this.closeBtn.textContent = '\u2715';
    this.closeBtn.style.cssText = [
      'background:none',
      'border:none',
      'color:var(--color-text-muted, #9b8b72)',
      'font-size:18px',
      'cursor:pointer',
      'padding:0 4px',
      'line-height:1',
    ].join(';');
    this.closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(this.nameEl);
    header.appendChild(this.closeBtn);
    this.container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding:12px 16px;display:flex;flex-direction:column;gap:10px;';

    this.descEl = document.createElement('div');
    this.descEl.style.cssText = [
      'font-family:Crimson Text,Georgia,serif',
      'font-size:14px',
      'color:var(--color-text-secondary, #c8b89a)',
      'line-height:1.4',
    ].join(';');

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'font-size:13px;font-weight:600;';

    this.attemptsEl = document.createElement('div');
    this.attemptsEl.style.cssText = [
      'font-size:12px',
      'color:var(--color-text-muted, #9b8b72)',
    ].join(';');

    this.tokenCountEl = document.createElement('div');
    this.tokenCountEl.style.cssText = [
      'font-size:12px',
      'color:var(--color-gold-primary, #d4a84b)',
      'padding:6px 0',
    ].join(';');

    this.challengeBtn = document.createElement('button');
    this.challengeBtn.textContent = 'Challenge Boss';
    this.challengeBtn.style.cssText = [
      'padding:10px 20px',
      'font-family:Cinzel,serif',
      'font-size:14px',
      'font-weight:700',
      'color:#f5e6c8',
      'background:linear-gradient(180deg,#5c3a1a 0%,#3a2210 100%)',
      'border:1px solid #8b6914',
      'border-radius:3px',
      'cursor:pointer',
      'text-transform:uppercase',
      'letter-spacing:1px',
      'transition:all 0.15s ease',
      'margin-top:4px',
    ].join(';');
    this.challengeBtn.addEventListener('mouseenter', () => {
      if (!this.challengeBtn.disabled) {
        this.challengeBtn.style.background = 'linear-gradient(180deg,#7a4e22 0%,#4a2c14 100%)';
        this.challengeBtn.style.borderColor = '#d4a84b';
      }
    });
    this.challengeBtn.addEventListener('mouseleave', () => {
      if (!this.challengeBtn.disabled) {
        this.challengeBtn.style.background = 'linear-gradient(180deg,#5c3a1a 0%,#3a2210 100%)';
        this.challengeBtn.style.borderColor = '#8b6914';
      }
    });
    this.challengeBtn.addEventListener('click', () => {
      if (this.currentBoss && this.onChallenge) {
        this.onChallenge(this.currentBoss.id);
      }
    });

    body.appendChild(this.descEl);
    body.appendChild(this.statusEl);
    body.appendChild(this.attemptsEl);
    body.appendChild(this.tokenCountEl);
    body.appendChild(this.challengeBtn);
    this.container.appendChild(body);

    parent.appendChild(this.container);
  }

  show(boss: BossDto, playerTokenCount: number): void {
    this.currentBoss = boss;
    this.nameEl.textContent = boss.name;
    this.descEl.textContent = boss.description ?? '';
    this.descEl.style.display = boss.description ? '' : 'none';
    this.attemptsEl.textContent = `Total attempts: ${boss.total_attempts}`;
    this.tokenCountEl.textContent = `Boss Challenge Tokens: ${playerTokenCount}`;

    this.renderStatus(boss);
    this.updateChallengeButton(boss, playerTokenCount);

    this.container.style.display = 'flex';
    this.visible = true;
  }

  hide(): void {
    this.container.style.display = 'none';
    this.visible = false;
    this.currentBoss = null;
    this.clearRespawnInterval();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getCurrentBossId(): number | null {
    return this.currentBoss?.id ?? null;
  }

  updateStatus(boss: BossDto, playerTokenCount?: number): void {
    this.currentBoss = boss;
    this.renderStatus(boss);
    this.attemptsEl.textContent = `Total attempts: ${boss.total_attempts}`;
    if (playerTokenCount !== undefined) {
      this.tokenCountEl.textContent = `Boss Challenge Tokens: ${playerTokenCount}`;
      this.updateChallengeButton(boss, playerTokenCount);
    } else {
      // Keep existing token text, update button based on status only
      this.updateChallengeButtonStatus(boss);
    }
  }

  private renderStatus(boss: BossDto): void {
    this.clearRespawnInterval();

    switch (boss.status) {
      case 'alive':
        this.statusEl.textContent = 'Guarding';
        this.statusEl.style.color = '#52b373';
        break;

      case 'in_combat':
        this.statusEl.textContent = `In Combat with ${boss.fighting_character_name ?? 'Unknown'}`;
        this.statusEl.style.color = '#e9a030';
        break;

      case 'defeated': {
        this.statusEl.style.color = '#e74c3c';
        if (boss.respawn_at) {
          this.startRespawnCountdown(boss.respawn_at);
        } else {
          this.statusEl.textContent = 'Defeated';
        }
        break;
      }

      case 'inactive':
        this.statusEl.textContent = 'Inactive';
        this.statusEl.style.color = 'var(--color-text-disabled, #5a5040)';
        break;
    }
  }

  private startRespawnCountdown(respawnAt: string): void {
    const updateText = () => {
      const now = Date.now();
      const target = new Date(respawnAt).getTime();
      const remaining = Math.max(0, target - now);

      if (remaining <= 0) {
        this.statusEl.textContent = 'Defeated \u2014 respawning...';
        this.clearRespawnInterval();
        return;
      }

      const totalSeconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      this.statusEl.textContent = `Defeated \u2014 respawns in ${timeStr}`;
    };

    updateText();
    this.respawnInterval = window.setInterval(updateText, 1000);
  }

  private clearRespawnInterval(): void {
    if (this.respawnInterval !== null) {
      clearInterval(this.respawnInterval);
      this.respawnInterval = null;
    }
  }

  private updateChallengeButton(boss: BossDto, tokenCount: number): void {
    const canChallenge = boss.status === 'alive' && tokenCount > 0;
    this.challengeBtn.disabled = !canChallenge;

    if (!canChallenge) {
      this.challengeBtn.style.opacity = '0.4';
      this.challengeBtn.style.cursor = 'not-allowed';
      if (tokenCount <= 0 && boss.status === 'alive') {
        this.challengeBtn.title = 'You need a Boss Challenge Token';
      } else if (boss.status === 'in_combat') {
        this.challengeBtn.title = 'Boss is already in combat';
      } else if (boss.status === 'defeated') {
        this.challengeBtn.title = 'Boss has been defeated — wait for respawn';
      } else {
        this.challengeBtn.title = '';
      }
    } else {
      this.challengeBtn.style.opacity = '1';
      this.challengeBtn.style.cursor = 'pointer';
      this.challengeBtn.title = '';
    }
  }

  private updateChallengeButtonStatus(boss: BossDto): void {
    // Disable if boss is not alive regardless of tokens
    if (boss.status !== 'alive') {
      this.challengeBtn.disabled = true;
      this.challengeBtn.style.opacity = '0.4';
      this.challengeBtn.style.cursor = 'not-allowed';
      if (boss.status === 'in_combat') {
        this.challengeBtn.title = 'Boss is already in combat';
      } else if (boss.status === 'defeated') {
        this.challengeBtn.title = 'Boss has been defeated — wait for respawn';
      }
    }
  }

  destroy(): void {
    this.clearRespawnInterval();
    this.container.remove();
  }
}
