import type { SquireRosterDto, CharacterSquireDto } from '@elarion/protocol';

/**
 * SquireRosterPanel — inline panel for the LeftPanel "Squires" tab.
 * Shows all 5 squire slots: filled, empty-unlocked, locked.
 * Squires on expedition show building name + progress bar.
 */
export class SquireRosterPanel {
  private container: HTMLElement;
  private roster: SquireRosterDto | null = null;
  private progressIntervals: number[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow-y:auto;padding:8px;gap:6px;';
    parent.appendChild(this.container);
  }

  update(roster: SquireRosterDto): void {
    this.roster = roster;
    this.render();
  }

  private clearIntervals(): void {
    for (const id of this.progressIntervals) clearInterval(id);
    this.progressIntervals = [];
  }

  private render(): void {
    this.clearIntervals();
    this.container.innerHTML = '';

    if (!this.roster) {
      const empty = document.createElement('p');
      empty.style.cssText = 'text-align:center;color:#5a4a2a;font-size:12px;padding:16px 0;';
      empty.textContent = 'No squire data yet.';
      this.container.appendChild(empty);
      return;
    }

    const { squires, slots_unlocked, slots_total } = this.roster;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:2px 0 6px;';
    header.innerHTML = `
      <span style="font-family:Cinzel,serif;font-size:12px;letter-spacing:0.06em;color:#c9a55c;">SQUIRES</span>
      <span style="font-size:11px;color:#5a4a2a;">${squires.length} / ${slots_unlocked}</span>
    `;
    this.container.appendChild(header);

    // Slots
    for (let i = 0; i < slots_total; i++) {
      if (i < squires.length) {
        this.container.appendChild(this.buildSquireCard(squires[i]!));
      } else if (i < slots_unlocked) {
        this.container.appendChild(this.buildEmptySlot());
      } else {
        this.container.appendChild(this.buildLockedSlot());
      }
    }
  }

  private buildSquireCard(squire: CharacterSquireDto): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;gap:8px;padding:6px;background:rgba(37,33,25,0.9);border:1px solid #3a3020;border-radius:4px;';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'flex-shrink:0;width:80px;height:80px;';
    if (squire.icon_url) {
      iconEl.innerHTML = `<img src="${squire.icon_url}" style="width:80px;height:80px;border-radius:3px;image-rendering:pixelated;" />`;
    } else {
      iconEl.innerHTML = `<div style="width:80px;height:80px;background:#2a2418;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#5a4a2a;">⚔</div>`;
    }
    card.appendChild(iconEl);

    // Details
    const details = document.createElement('div');
    details.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';

    // Name row
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight:bold;color:#f0c060;font-size:13px;font-family:"Crimson Text",serif;';
    nameEl.textContent = squire.name;
    nameRow.appendChild(nameEl);

    const statusEl = document.createElement('span');
    if (squire.status === 'idle') {
      statusEl.style.cssText = 'font-size:10px;color:#5a8a3a;font-weight:bold;letter-spacing:0.04em;';
      statusEl.textContent = 'IDLE';
    } else {
      statusEl.style.cssText = 'font-size:10px;color:#d4a84b;font-weight:bold;letter-spacing:0.04em;';
      statusEl.textContent = 'EXPEDITION';
    }
    nameRow.appendChild(statusEl);
    details.appendChild(nameRow);

    // Stats row
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'font-size:11px;color:#8a7a5a;';
    statsRow.textContent = `${squire.rank} · Power ${squire.power_level}`;
    details.appendChild(statsRow);

    // Expedition info
    if (squire.status === 'on_expedition' && squire.expedition) {
      const exp = squire.expedition;
      const expWrap = document.createElement('div');
      expWrap.style.cssText = 'margin-top:3px;';

      // Location
      const locEl = document.createElement('div');
      locEl.style.cssText = 'font-size:10px;color:#a89060;margin-bottom:3px;';
      locEl.textContent = `→ ${exp.building_name}`;
      expWrap.appendChild(locEl);

      // Progress bar
      const track = document.createElement('div');
      track.style.cssText = 'width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;background:#b8860b;border-radius:2px;transition:width 1s linear;';
      track.appendChild(fill);
      expWrap.appendChild(track);

      // Time remaining
      const timeEl = document.createElement('div');
      timeEl.style.cssText = 'font-size:10px;color:#5a4a2a;text-align:right;margin-top:2px;';
      expWrap.appendChild(timeEl);

      const startMs = new Date(exp.started_at).getTime();
      const endMs = new Date(exp.completes_at).getTime();

      const updateProgress = (): void => {
        const now = Date.now();
        const total = endMs - startMs;
        const elapsed = now - startMs;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        fill.style.width = `${pct}%`;

        const remaining = Math.max(0, endMs - now);
        const totalSec = Math.floor(remaining / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        timeEl.textContent = remaining <= 0
          ? 'Ready!'
          : h > 0
            ? `${h}h ${m}m left`
            : m > 0
              ? `${m}m ${s}s left`
              : `${s}s left`;

        if (remaining <= 0) {
          fill.style.background = '#5a8a3a';
        }
      };

      updateProgress();
      this.progressIntervals.push(window.setInterval(updateProgress, 1000));
      details.appendChild(expWrap);
    }

    card.appendChild(details);
    return card;
  }

  private buildEmptySlot(): HTMLElement {
    const slot = document.createElement('div');
    slot.style.cssText = 'padding:10px;border:1px dashed #3a3020;border-radius:4px;text-align:center;color:#3a3020;font-size:11px;font-family:"Crimson Text",serif;';
    slot.textContent = '— Empty Slot —';
    return slot;
  }

  private buildLockedSlot(): HTMLElement {
    const slot = document.createElement('div');
    slot.style.cssText = 'padding:10px;background:rgba(20,16,8,0.5);border:1px solid #2a2018;border-radius:4px;text-align:center;color:#2a2018;font-size:11px;font-family:"Crimson Text",serif;';
    slot.textContent = '🔒 Locked';
    return slot;
  }
}
