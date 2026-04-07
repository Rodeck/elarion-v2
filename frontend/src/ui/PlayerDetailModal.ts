import type { OwnedSpellDto } from '../../../shared/protocol/index';

export interface PlayerDetailData {
  id: string;
  name: string;
  level: number;
}

export class PlayerDetailModal {
  private parent: HTMLElement;
  private overlay: HTMLDivElement | null = null;
  private targetId: string | null = null;
  private targetName: string = '';
  private present = true;
  private noticeEl: HTMLDivElement | null = null;
  private detailsEl: HTMLDivElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;
  private spells: OwnedSpellDto[] = [];
  private onSpellCastOnPlayer: ((spellId: number, targetId: string) => void) | null = null;

  constructor(parent: HTMLElement = document.body) {
    this.parent = parent;
  }

  open(player: PlayerDetailData): void {
    this.close();
    this.targetId = player.id;
    this.targetName = player.name;
    this.present = true;

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:250;display:flex;align-items:center;justify-content:center;';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'padding:24px 28px',
      'min-width:280px',
      'max-width:360px',
      'color:#c9a55c',
      'font-family:"Crimson Text",serif',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7)',
      'position:relative',
      'text-align:center',
    ].join(';');

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = [
      'position:absolute', 'top:8px', 'right:12px',
      'background:none', 'border:none', 'color:#9a8a60',
      'font-size:22px', 'cursor:pointer', 'line-height:1',
      'padding:2px 6px',
    ].join(';');
    closeBtn.addEventListener('click', () => this.close());
    dialog.appendChild(closeBtn);

    // Details container
    this.detailsEl = document.createElement('div');

    // Placeholder icon (shield silhouette)
    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `
      width:64px; height:64px; margin:0 auto 12px;
      background:rgba(90,74,42,0.25); border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      border:2px solid #5a4a2a;
    `;
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '32');
    iconSvg.setAttribute('height', '32');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', '#9a8a60');
    iconSvg.setAttribute('stroke-width', '1.5');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2C8 4 4 4 4 4s0 6 0 8c0 6 8 10 8 10s8-4 8-10c0-2 0-8 0-8s-4 0-8-2z');
    iconSvg.appendChild(path);
    iconWrap.appendChild(iconSvg);
    this.detailsEl.appendChild(iconWrap);

    // Name
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      font-family: var(--font-display);
      font-size: 1.3em;
      color: var(--color-gold-bright);
      margin-bottom: 4px;
    `;
    nameEl.textContent = player.name;
    this.detailsEl.appendChild(nameEl);

    // Level
    const levelEl = document.createElement('div');
    levelEl.style.cssText = `
      color: var(--color-text-secondary);
      font-size: 0.95em;
      margin-bottom: 16px;
    `;
    levelEl.textContent = `Level ${player.level}`;
    this.detailsEl.appendChild(levelEl);

    dialog.appendChild(this.detailsEl);

    // "Player left" notice (hidden by default)
    this.noticeEl = document.createElement('div');
    this.noticeEl.style.cssText = `
      display:none;
      padding:12px;
      color:var(--color-text-secondary);
      font-style:italic;
      text-align:center;
    `;
    this.noticeEl.textContent = `${player.name} has left this location`;
    dialog.appendChild(this.noticeEl);

    // Spell casting section
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'player-modal-actions';
    if (this.spells.length > 0) {
      const spellHeader = document.createElement('div');
      spellHeader.style.cssText = 'font-family:var(--font-display);font-size:0.8em;color:var(--color-gold-primary);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;text-align:left;';
      spellHeader.textContent = 'Cast Spell';
      actionsContainer.appendChild(spellHeader);

      for (const spell of this.spells) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;margin-bottom:2px;';
        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(212,168,75,0.1)'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });

        const icon = document.createElement('div');
        icon.style.cssText = `width:24px;height:24px;border-radius:3px;background:rgba(0,0,0,0.3);flex-shrink:0;${spell.icon_url ? `background-image:url('${spell.icon_url}');background-size:contain;background-repeat:no-repeat;background-position:center;` : ''}`;
        row.appendChild(icon);

        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'flex:1;font-size:0.85em;color:#c9a55c;text-align:left;';
        nameSpan.textContent = `${spell.name} Lv.${spell.level}`;
        row.appendChild(nameSpan);

        const castBtn = document.createElement('button');
        castBtn.style.cssText = 'padding:3px 10px;border:1px solid var(--color-gold-primary);background:transparent;color:var(--color-gold-primary);border-radius:3px;cursor:pointer;font-size:0.75em;font-family:var(--font-display);';
        castBtn.textContent = 'Cast';
        castBtn.addEventListener('click', () => {
          if (this.targetId) {
            this.onSpellCastOnPlayer?.(spell.id, this.targetId);
            this.close();
          }
        });
        row.appendChild(castBtn);

        actionsContainer.appendChild(row);
      }
    }
    dialog.appendChild(actionsContainer);

    this.overlay.appendChild(dialog);
    this.parent.appendChild(this.overlay);

    // Escape key handler
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escHandler);
  }

  close(): void {
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.targetId = null;
    this.noticeEl = null;
    this.detailsEl = null;
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  getTargetId(): string | null {
    return this.targetId;
  }

  setSpells(spells: OwnedSpellDto[]): void {
    this.spells = spells;
  }

  setOnSpellCastOnPlayer(cb: (spellId: number, targetId: string) => void): void {
    this.onSpellCastOnPlayer = cb;
  }

  setPresence(present: boolean): void {
    if (this.present === present) return;
    this.present = present;

    if (!this.noticeEl || !this.detailsEl) return;

    if (present) {
      this.noticeEl.style.display = 'none';
      this.detailsEl.style.opacity = '1';
    } else {
      this.noticeEl.style.display = 'block';
      this.detailsEl.style.opacity = '0.4';
    }
  }
}
