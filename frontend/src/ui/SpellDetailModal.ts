import type { OwnedSpellDto } from '../../../shared/protocol/index';
import { formatDuration } from '../../../shared/protocol/index';

const EFFECT_LABELS: Record<string, string> = {
  attack_pct: 'Attack',
  defence_pct: 'Defence',
  crit_chance_pct: 'Crit Chance',
  crit_damage_pct: 'Crit Damage',
  heal: 'Heal',
  movement_speed: 'Move Speed',
  energy: 'Energy',
};

function effectDescription(type: string, value: number): string {
  const label = EFFECT_LABELS[type] ?? type;
  if (type.endsWith('_pct')) return `+${value}% ${label}`;
  return `+${value} ${label}`;
}

export class SpellDetailModal {
  private overlay: HTMLElement | null = null;
  private onCast: ((spellId: number) => void) | null = null;
  private onClose: (() => void) | null = null;

  setOnCast(cb: (spellId: number) => void): void {
    this.onCast = cb;
  }

  setOnClose(cb: () => void): void {
    this.onClose = cb;
  }

  open(spell: OwnedSpellDto, canCast: boolean, castDisabledReason?: string): void {
    this.close();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
    this.overlay = overlay;

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--color-bg-panel,#252119);border:1px solid rgba(212,168,75,0.3);border-radius:8px;padding:20px;max-width:400px;width:90%;color:#fff;font-family:var(--font-body);';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;';

    const icon = document.createElement('div');
    icon.style.cssText = `width:48px;height:48px;border-radius:6px;background:rgba(0,0,0,0.4);flex-shrink:0;${spell.icon_url ? `background-image:url('${spell.icon_url}');background-size:contain;background-repeat:no-repeat;background-position:center;` : ''}`;
    header.appendChild(icon);

    const titleInfo = document.createElement('div');
    titleInfo.innerHTML = `
      <div style="font-family:var(--font-display);font-size:var(--type-lg);color:var(--color-gold-bright);">${spell.name}</div>
      <div style="font-size:var(--type-xs);color:rgba(255,255,255,0.5);">Level ${spell.level} &middot; ${EFFECT_LABELS[spell.effect_type] ?? spell.effect_type}</div>
    `;
    header.appendChild(titleInfo);
    modal.appendChild(header);

    // Description
    if (spell.description) {
      const desc = document.createElement('p');
      desc.style.cssText = 'font-size:var(--type-sm);color:rgba(255,255,255,0.65);margin:0 0 12px;font-style:italic;';
      desc.textContent = spell.description;
      modal.appendChild(desc);
    }

    // Current level stats
    const stats = spell.current_level_stats;
    if (stats) {
      const section = document.createElement('div');
      section.style.cssText = 'background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;margin-bottom:12px;';
      section.innerHTML = `
        <div style="font-size:var(--type-xs);color:var(--color-gold-primary);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Current (Lv.${stats.level})</div>
        <div style="display:flex;gap:16px;font-size:var(--type-sm);">
          <div><span style="color:rgba(255,255,255,0.5);">Effect:</span> <span style="color:#fff;">${effectDescription(spell.effect_type, stats.effect_value)}</span></div>
          <div><span style="color:rgba(255,255,255,0.5);">Duration:</span> <span style="color:#fff;">${formatDuration(stats.duration_seconds)}</span></div>
        </div>
      `;

      // Cost display
      if (stats.gold_cost > 0 || stats.item_costs.length > 0) {
        const costEl = document.createElement('div');
        costEl.style.cssText = 'margin-top:8px;font-size:var(--type-xs);';
        const costLabel = document.createElement('span');
        costLabel.style.cssText = 'color:rgba(255,255,255,0.5);';
        costLabel.textContent = 'Cost: ';
        costEl.appendChild(costLabel);

        const costItems = document.createElement('span');
        costItems.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;';
        for (const ic of stats.item_costs) {
          const itemSpan = document.createElement('span');
          itemSpan.style.cssText = 'display:inline-flex;align-items:center;gap:3px;color:var(--color-gold-primary);';
          if (ic.item_icon_url) {
            const img = document.createElement('img');
            img.src = ic.item_icon_url;
            img.style.cssText = 'width:16px;height:16px;image-rendering:pixelated;vertical-align:middle;';
            itemSpan.appendChild(img);
          }
          const text = document.createElement('span');
          text.textContent = `${ic.quantity}x ${ic.item_name}`;
          itemSpan.appendChild(text);
          costItems.appendChild(itemSpan);
        }
        if (stats.gold_cost > 0) {
          const goldSpan = document.createElement('span');
          goldSpan.style.cssText = 'color:var(--color-gold-primary);';
          goldSpan.textContent = `${stats.gold_cost} gold`;
          costItems.appendChild(goldSpan);
        }
        costEl.appendChild(costItems);
        section.appendChild(costEl);
      }

      modal.appendChild(section);
    }

    // Next level preview
    const next = spell.next_level_stats;
    if (next) {
      const section = document.createElement('div');
      section.style.cssText = 'background:rgba(0,0,0,0.15);border-radius:6px;padding:10px;margin-bottom:12px;border:1px solid rgba(212,168,75,0.1);';
      section.innerHTML = `
        <div style="font-size:var(--type-xs);color:rgba(212,168,75,0.7);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Next Level (Lv.${next.level})</div>
        <div style="display:flex;gap:16px;font-size:var(--type-sm);color:rgba(255,255,255,0.6);">
          <div>Effect: ${effectDescription(spell.effect_type, next.effect_value)}</div>
          <div>Duration: ${formatDuration(next.duration_seconds)}</div>
        </div>
      `;
      modal.appendChild(section);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'padding:8px 16px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#fff;border-radius:4px;cursor:pointer;font-family:var(--font-display);';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.close());
    btnRow.appendChild(closeBtn);

    const castBtn = document.createElement('button');
    castBtn.style.cssText = `padding:8px 20px;border:none;background:${canCast ? 'var(--color-gold-primary,#d4a84b)' : 'rgba(255,255,255,0.1)'};color:${canCast ? '#000' : 'rgba(255,255,255,0.3)'};border-radius:4px;cursor:${canCast ? 'pointer' : 'not-allowed'};font-family:var(--font-display);font-weight:700;`;
    castBtn.textContent = 'Cast';
    if (!canCast && castDisabledReason) {
      castBtn.title = castDisabledReason;
    }
    if (canCast) {
      castBtn.addEventListener('click', () => {
        this.onCast?.(spell.id);
        this.close();
      });
    }
    btnRow.appendChild(castBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on backdrop click or Escape
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.onClose?.();
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }
}
