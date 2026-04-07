import type { OwnedSpellDto, SpellStatePayload } from '../../../shared/protocol/index';
import { formatDuration } from '../../../shared/protocol/index';

const EFFECT_LABELS: Record<string, string> = {
  attack_pct: 'Attack %',
  defence_pct: 'Defence %',
  crit_chance_pct: 'Crit Chance %',
  crit_damage_pct: 'Crit Damage %',
  heal: 'Heal',
  movement_speed: 'Move Speed',
  energy: 'Energy',
};

export class SpellPanel {
  private container: HTMLElement;
  private spells: OwnedSpellDto[] = [];
  private listEl!: HTMLElement;
  private onSpellClick: ((spell: OwnedSpellDto) => void) | null = null;
  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
    this.startCooldownTimer();
  }

  setOnSpellClick(cb: (spell: OwnedSpellDto) => void): void {
    this.onSpellClick = cb;
  }

  private build(): void {
    this.container.innerHTML = '';
    this.container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'padding:6px 10px;font-family:var(--font-display);font-size:var(--type-sm);color:var(--color-gold-primary);text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(212,168,75,0.15);';
    header.textContent = 'Spells';
    this.container.appendChild(header);

    this.listEl = document.createElement('div');
    this.listEl.style.cssText = 'flex:1;overflow-y:auto;padding:4px;';
    this.container.appendChild(this.listEl);
  }

  updateSpells(payload: SpellStatePayload): void {
    this.spells = payload.spells;
    this.renderList();
  }

  private renderList(): void {
    this.listEl.innerHTML = '';

    if (this.spells.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:20px;text-align:center;color:rgba(255,255,255,0.4);font-size:var(--type-xs);';
      empty.textContent = 'No spells learned. Use Spell Books to learn spells.';
      this.listEl.appendChild(empty);
      return;
    }

    for (const spell of this.spells) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;transition:background 0.15s;margin-bottom:2px;';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(212,168,75,0.08)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });

      // Icon
      const icon = document.createElement('div');
      icon.style.cssText = `width:32px;height:32px;border-radius:4px;background:rgba(0,0,0,0.3);flex-shrink:0;${spell.icon_url ? `background-image:url('${spell.icon_url}');background-size:contain;background-repeat:no-repeat;background-position:center;` : ''}`;
      row.appendChild(icon);

      // Info
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';

      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'color:var(--color-gold-bright);font-size:var(--type-sm);font-family:var(--font-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      nameEl.textContent = spell.name;
      nameRow.appendChild(nameEl);

      const lvBadge = document.createElement('span');
      lvBadge.style.cssText = 'font-size:10px;background:rgba(212,168,75,0.2);color:var(--color-gold-primary);padding:1px 4px;border-radius:2px;font-weight:700;';
      lvBadge.textContent = `Lv.${spell.level}`;
      nameRow.appendChild(lvBadge);

      info.appendChild(nameRow);

      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:2px;';

      const effectChip = document.createElement('span');
      effectChip.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);';
      effectChip.textContent = EFFECT_LABELS[spell.effect_type] ?? spell.effect_type;
      metaRow.appendChild(effectChip);

      // Progress bar
      if (spell.level < 5 && spell.points_to_next !== null) {
        const MAX_PTS = 100;
        const ratio = spell.points / MAX_PTS;
        const bar = document.createElement('div');
        bar.style.cssText = `flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;`;
        const fill = document.createElement('div');
        fill.style.cssText = `height:100%;background:var(--color-gold-primary);width:${Math.round(ratio * 100)}%;border-radius:2px;`;
        bar.appendChild(fill);
        metaRow.appendChild(bar);

        const ptsLabel = document.createElement('span');
        ptsLabel.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.35);white-space:nowrap;';
        ptsLabel.textContent = `${spell.points}/100`;
        metaRow.appendChild(ptsLabel);
      } else {
        const mastered = document.createElement('span');
        mastered.style.cssText = 'font-size:10px;color:#90c090;font-weight:600;';
        mastered.textContent = 'MASTERED';
        metaRow.appendChild(mastered);
      }

      info.appendChild(metaRow);

      // Cooldown
      if (spell.cooldown_until) {
        const remaining = new Date(spell.cooldown_until).getTime() - Date.now();
        if (remaining > 0) {
          const cdEl = document.createElement('div');
          cdEl.className = 'spell-cooldown';
          cdEl.dataset.until = spell.cooldown_until;
          cdEl.style.cssText = 'font-size:9px;color:rgba(255,100,100,0.6);margin-top:1px;';
          cdEl.textContent = `Book cooldown: ${formatDuration(Math.ceil(remaining / 1000))}`;
          info.appendChild(cdEl);
        }
      }

      row.appendChild(info);

      row.addEventListener('click', () => {
        this.onSpellClick?.(spell);
      });

      this.listEl.appendChild(row);
    }
  }

  private startCooldownTimer(): void {
    this.cooldownInterval = setInterval(() => {
      const cdEls = this.listEl.querySelectorAll('.spell-cooldown') as NodeListOf<HTMLElement>;
      for (const el of cdEls) {
        const until = el.dataset.until;
        if (!until) continue;
        const remaining = new Date(until).getTime() - Date.now();
        if (remaining <= 0) {
          el.remove();
        } else {
          el.textContent = `Book cooldown: ${formatDuration(Math.ceil(remaining / 1000))}`;
        }
      }
    }, 1000);
  }

  destroy(): void {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }
}
