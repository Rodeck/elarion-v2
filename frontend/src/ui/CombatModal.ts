import type { BuildingExploreResultPayload, CombatRoundRecord } from '@elarion/protocol';

const ROUND_DELAY_MS = 800;

export class CombatModal {
  private overlay: HTMLElement | null = null;
  private parent: HTMLElement;

  constructor(parent: HTMLElement) {
    this.parent = parent;
  }

  /** Display the full explore result, streaming combat rounds with delays. */
  async show(result: BuildingExploreResultPayload): Promise<void> {
    this.close();
    this.buildOverlay();

    if (result.outcome === 'no_encounter') {
      this.renderNoEncounter();
      return;
    }

    // outcome === 'combat'
    this.renderMonsterHeader(result);
    await this.streamRounds(result.rounds ?? []);
    this.renderOutcome(result);
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.72)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:200',
    ].join(';');

    const modal = document.createElement('div');
    modal.id = 'combat-modal';
    modal.style.cssText = [
      'background:#1a1510',
      'border:1px solid #5a4a2a',
      'width:380px',
      'max-height:80vh',
      'display:flex',
      'flex-direction:column',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'box-sizing:border-box',
      'overflow:hidden',
    ].join(';');

    overlay.appendChild(modal);
    this.parent.appendChild(overlay);
    this.overlay = overlay;
  }

  private getModal(): HTMLElement {
    return this.overlay!.querySelector('#combat-modal') as HTMLElement;
  }

  private renderNoEncounter(): void {
    const modal = this.getModal();
    modal.innerHTML = '';

    const msg = document.createElement('div');
    msg.style.cssText = 'padding:32px 24px;text-align:center;';
    msg.innerHTML = [
      '<p style="margin:0 0 8px;font-size:14px;color:#a89060;font-family:Cinzel,serif;letter-spacing:0.06em;">You explore the area...</p>',
      '<p style="margin:0;font-family:Crimson Text,serif;font-size:13px;color:#6a5a3a;font-style:italic;">Nothing of interest found.</p>',
    ].join('');
    modal.appendChild(msg);

    this.appendCloseButton(modal);
  }

  private renderMonsterHeader(result: BuildingExploreResultPayload): void {
    const modal = this.getModal();
    modal.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px 12px;border-bottom:1px solid #3a2e1a;display:flex;align-items:center;gap:18px;';

    if (result.monster?.icon_url) {
      const icon = document.createElement('img');
      icon.src = result.monster.icon_url;
      icon.alt = result.monster.name;
      icon.style.cssText = 'width:120px;height:120px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;';
      header.appendChild(icon);
    }

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;';

    const name = document.createElement('h2');
    name.style.cssText = 'margin:0 0 6px;font-size:16px;letter-spacing:0.08em;color:#e8c870;';
    name.textContent = result.monster?.name ?? 'Unknown';
    info.appendChild(name);

    const stats = document.createElement('p');
    stats.style.cssText = 'margin:0;font-family:Crimson Text,serif;font-size:12px;color:#7a6040;';
    stats.textContent = `HP: ${result.monster?.max_hp ?? '?'}  ATK: ${result.monster?.attack ?? '?'}  DEF: ${result.monster?.defense ?? '?'}`;
    info.appendChild(stats);

    header.appendChild(info);
    modal.appendChild(header);

    // Rounds container
    const roundsEl = document.createElement('div');
    roundsEl.id = 'combat-rounds';
    roundsEl.style.cssText = 'padding:12px 20px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;min-height:60px;max-height:260px;';
    modal.appendChild(roundsEl);
  }

  private async streamRounds(rounds: CombatRoundRecord[]): Promise<void> {
    const roundsEl = this.overlay?.querySelector<HTMLElement>('#combat-rounds');
    if (!roundsEl) return;

    for (const round of rounds) {
      await this.delay(ROUND_DELAY_MS);
      if (!this.overlay) return; // modal was closed

      const row = document.createElement('div');
      row.style.cssText = 'font-family:Crimson Text,serif;font-size:12px;color:#a89060;line-height:1.5;';
      row.innerHTML = [
        `<span style="color:#7a6040;min-width:40px;display:inline-block;">R${round.round}</span>`,
        `<span style="color:#c8a060;">You dealt <b style="color:#e8c870;">${round.player_attack}</b></span>`,
        round.monster_hp_after > 0
          ? ` — <span style="color:#c05050;">Enemy dealt <b style="color:#e05050;">${round.monster_attack}</b> (HP: ${round.player_hp_after})</span>`
          : ` — <span style="color:#5a8a40;font-style:italic;">Enemy defeated!</span>`,
      ].join('');
      roundsEl.appendChild(row);
      roundsEl.scrollTop = roundsEl.scrollHeight;
    }
  }

  private renderOutcome(result: BuildingExploreResultPayload): void {
    if (!this.overlay) return;
    const modal = this.getModal();

    const won = result.combat_result === 'win';

    const outcomeEl = document.createElement('div');
    outcomeEl.style.cssText = [
      'padding:14px 20px',
      'border-top:1px solid #3a2e1a',
      'background:' + (won ? 'rgba(40,60,20,0.5)' : 'rgba(60,20,20,0.5)'),
      'display:flex',
      'flex-direction:column',
      'gap:6px',
    ].join(';');

    const resultLine = document.createElement('p');
    resultLine.style.cssText = 'margin:0;font-size:13px;letter-spacing:0.06em;color:' + (won ? '#80c040' : '#e05050') + ';';
    resultLine.textContent = won ? 'Victory!' : 'Defeated.';
    outcomeEl.appendChild(resultLine);

    if (won) {
      const xpLine = document.createElement('p');
      xpLine.style.cssText = 'margin:0;font-family:Crimson Text,serif;font-size:12px;color:#a89060;';
      xpLine.textContent = `+${result.xp_gained ?? 0} XP`;
      outcomeEl.appendChild(xpLine);

      if (result.crowns_gained && result.crowns_gained > 0) {
        const crownsLine = document.createElement('p');
        crownsLine.style.cssText = 'margin:0;font-family:Crimson Text,serif;font-size:12px;color:#d4a84b;';
        crownsLine.textContent = `+${result.crowns_gained} Crown${result.crowns_gained !== 1 ? 's' : ''}`;
        outcomeEl.appendChild(crownsLine);
      }

      if (result.items_dropped && result.items_dropped.length > 0) {
        const itemsLine = document.createElement('div');
        itemsLine.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;';

        for (const item of result.items_dropped) {
          const chip = document.createElement('span');
          chip.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:4px',
            'padding:3px 8px',
            'background:rgba(90,74,42,0.5)',
            'border:1px solid #5a4a2a',
            'font-family:Crimson Text,serif',
            'font-size:11px',
            'color:#e8c870',
          ].join(';');

          if (item.icon_url) {
            const icon = document.createElement('img');
            icon.src = item.icon_url;
            icon.alt = '';
            icon.style.cssText = 'width:14px;height:14px;object-fit:contain;image-rendering:pixelated;';
            chip.appendChild(icon);
          }

          chip.appendChild(document.createTextNode(`${item.name} ×${item.quantity}`));
          itemsLine.appendChild(chip);
        }

        outcomeEl.appendChild(itemsLine);
      }
    } else {
      const lossMsg = document.createElement('p');
      lossMsg.style.cssText = 'margin:0;font-family:Crimson Text,serif;font-size:12px;color:#7a5040;font-style:italic;';
      lossMsg.textContent = 'You managed to escape, but gained nothing.';
      outcomeEl.appendChild(lossMsg);
    }

    modal.appendChild(outcomeEl);
    this.appendCloseButton(modal);
  }

  private appendCloseButton(modal: HTMLElement): void {
    const btn = document.createElement('button');
    btn.style.cssText = [
      'margin:12px 20px 16px',
      'padding:9px 12px',
      'background:rgba(90,74,42,0.4)',
      'border:1px solid #5a4a2a',
      'color:#e8c870',
      'font-family:Cinzel,serif',
      'font-size:12px',
      'letter-spacing:0.06em',
      'cursor:pointer',
      'align-self:stretch',
    ].join(';');
    btn.textContent = 'Close';
    btn.addEventListener('click', () => this.close());
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(90,74,42,0.75)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(90,74,42,0.4)'; });
    modal.appendChild(btn);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
