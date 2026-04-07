import type { ActiveSpellBuffDto } from '../../../shared/protocol/index';
import { formatDuration } from '../../../shared/protocol/index';

export class BuffBar {
  private container: HTMLElement;
  private buffs: ActiveSpellBuffDto[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.cssText = 'display:flex;gap:4px;align-items:center;min-height:20px;overflow-x:auto;padding:2px 0;';
    this.startTick();
  }

  updateBuffs(buffs: ActiveSpellBuffDto[]): void {
    this.buffs = buffs;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';

    for (const buff of this.buffs) {
      const expiresAt = new Date(buff.expires_at).getTime();
      const remaining = Math.max(0, expiresAt - Date.now());
      if (remaining <= 0) continue;

      const wrapper = document.createElement('div');
      wrapper.className = 'buff-icon-wrap';
      wrapper.dataset.spellId = String(buff.spell_id);
      wrapper.dataset.expiresAt = buff.expires_at;
      wrapper.dataset.durationSeconds = String(buff.duration_seconds);
      wrapper.style.cssText = 'position:relative;width:24px;flex-shrink:0;cursor:pointer;';

      // Icon
      const icon = document.createElement('div');
      icon.style.cssText = `width:24px;height:24px;border-radius:3px;background:rgba(0,0,0,0.3);border:1px solid rgba(212,168,75,0.3);${buff.icon_url ? `background-image:url('${buff.icon_url}');background-size:contain;background-repeat:no-repeat;background-position:center;` : ''}`;
      wrapper.appendChild(icon);

      // Mini progress bar
      const bar = document.createElement('div');
      bar.className = 'buff-progress';
      bar.style.cssText = 'width:100%;height:3px;background:rgba(255,255,255,0.1);border-radius:1px;margin-top:1px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.className = 'buff-progress-fill';
      fill.style.cssText = 'height:100%;background:var(--color-gold-primary,#d4a84b);border-radius:1px;transition:width 1s linear;';
      bar.appendChild(fill);
      wrapper.appendChild(bar);

      // Tooltip on hover
      const tooltip = document.createElement('div');
      tooltip.className = 'buff-tooltip';
      tooltip.style.cssText = 'display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--color-bg-panel,#252119);border:1px solid rgba(212,168,75,0.4);border-radius:4px;padding:6px 8px;white-space:nowrap;z-index:100;font-size:10px;color:#fff;pointer-events:none;';

      wrapper.addEventListener('mouseenter', () => {
        const rem = Math.max(0, Math.ceil((new Date(buff.expires_at).getTime() - Date.now()) / 1000));
        tooltip.innerHTML = `<div style="color:var(--color-gold-bright);font-weight:600;">${buff.spell_name} Lv.${buff.level}</div><div style="color:rgba(255,255,255,0.6);">${this.effectLabel(buff)}</div><div style="color:rgba(255,255,255,0.4);">${formatDuration(rem)} remaining</div><div style="color:rgba(255,255,255,0.3);font-style:italic;">by ${buff.caster_name}</div>`;
        tooltip.style.display = 'block';
      });
      wrapper.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
      wrapper.appendChild(tooltip);

      this.container.appendChild(wrapper);
    }

    this.updateProgressBars();
  }

  private effectLabel(buff: ActiveSpellBuffDto): string {
    const labels: Record<string, string> = {
      attack_pct: 'Attack', defence_pct: 'Defence', crit_chance_pct: 'Crit Chance',
      crit_damage_pct: 'Crit Damage', heal: 'Heal', movement_speed: 'Move Speed', energy: 'Energy',
    };
    const label = labels[buff.effect_type] ?? buff.effect_type;
    return buff.effect_type.endsWith('_pct') ? `+${buff.effect_value}% ${label}` : `+${buff.effect_value} ${label}`;
  }

  private updateProgressBars(): void {
    const wraps = this.container.querySelectorAll('.buff-icon-wrap') as NodeListOf<HTMLElement>;
    for (const wrap of wraps) {
      const expiresAt = new Date(wrap.dataset.expiresAt ?? '').getTime();
      const totalSeconds = parseInt(wrap.dataset.durationSeconds ?? '0', 10);
      const now = Date.now();
      const remainingMs = Math.max(0, expiresAt - now);
      const totalMs = totalSeconds * 1000;
      const fill = wrap.querySelector('.buff-progress-fill') as HTMLElement;
      if (fill && totalMs > 0) {
        const ratio = Math.min(1, remainingMs / totalMs);
        fill.style.width = `${Math.round(ratio * 100)}%`;
      }
    }
  }

  private startTick(): void {
    this.tickInterval = setInterval(() => {
      this.updateProgressBars();
      // Remove expired buffs visually
      const wraps = this.container.querySelectorAll('.buff-icon-wrap') as NodeListOf<HTMLElement>;
      for (const wrap of wraps) {
        const expiresAt = new Date(wrap.dataset.expiresAt ?? '').getTime();
        if (Date.now() >= expiresAt) {
          wrap.remove();
        }
      }
    }, 1000);
  }

  destroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }
}
