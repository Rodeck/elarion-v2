import type { OwnedAbilityDto, AbilityLevelStatsDto } from '@elarion/protocol';

const EFFECT_TYPE_COLORS: Record<string, string> = {
  damage: '#c0392b',
  heal: '#27ae60',
  buff: '#d4a84b',
  debuff: '#8e44ad',
  dot: '#e67e22',
  reflect: '#2980b9',
  drain: '#1abc9c',
};

function effectColor(effectType: string): string {
  return EFFECT_TYPE_COLORS[effectType] ?? '#7f8c8d';
}

export class SkillDetailModal {
  private overlay: HTMLElement | null = null;

  constructor(private parent: HTMLElement) {}

  open(ability: OwnedAbilityDto): void {
    this.close();

    const maxLevel = 5;
    const mastered = ability.level >= maxLevel;
    const stats = ability.current_level_stats;
    const nextStats = ability.next_level_stats;
    const color = effectColor(ability.effect_type);

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center;';
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
      'min-width:380px',
      'max-width:480px',
      'color:#c9a55c',
      'font-family:"Crimson Text",serif',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7)',
      'position:relative',
    ].join(';');
    dialog.addEventListener('click', (e) => e.stopPropagation());

    // Close button (X)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText =
      'position:absolute;top:8px;right:12px;background:none;border:none;color:#7a6a4a;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;';
    closeBtn.addEventListener('click', () => this.close());
    dialog.appendChild(closeBtn);

    // ── Header row ──────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px;';

    // Icon or colored placeholder
    if (ability.icon_url) {
      const icon = document.createElement('img');
      icon.src = ability.icon_url;
      icon.style.cssText = 'width:44px;height:44px;image-rendering:pixelated;flex-shrink:0;border-radius:4px;';
      header.appendChild(icon);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText =
        `width:44px;height:44px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${color}33;`;
      const letter = document.createElement('span');
      letter.style.cssText = `color:${color};font-family:Cinzel,serif;font-size:20px;font-weight:700;`;
      letter.textContent = (ability.name[0] ?? '?').toUpperCase();
      placeholder.appendChild(letter);
      header.appendChild(placeholder);
    }

    const nameEl = document.createElement('span');
    nameEl.textContent = ability.name;
    nameEl.style.cssText = 'font-family:Cinzel,serif;font-size:20px;color:#d4a84b;flex:1;';
    header.appendChild(nameEl);

    const typeChip = document.createElement('span');
    typeChip.textContent = ability.effect_type;
    typeChip.style.cssText =
      `font-size:12px;padding:3px 8px;border-radius:3px;flex-shrink:0;background:${color};color:#1a1510;font-family:Rajdhani,sans-serif;font-weight:600;text-transform:uppercase;`;
    header.appendChild(typeChip);

    dialog.appendChild(header);

    // ── Description ─────────────────────────────────────────────────────────
    if (ability.description) {
      const desc = document.createElement('div');
      desc.textContent = ability.description;
      desc.style.cssText = 'font-size:15px;color:#8a7a5a;margin-bottom:14px;line-height:1.5;';
      dialog.appendChild(desc);
    }

    // ── Level display ───────────────────────────────────────────────────────
    const levelRow = document.createElement('div');
    levelRow.style.cssText = 'font-size:17px;margin-bottom:8px;';
    if (mastered) {
      levelRow.innerHTML =
        `<span style="color:#d4a84b;">Level ${ability.level} / ${maxLevel}</span>` +
        `<span style="color:#27ae60;margin-left:8px;font-weight:bold;">MASTERED</span>`;
    } else {
      levelRow.innerHTML = `<span style="color:#d4a84b;">Level ${ability.level} / ${maxLevel}</span>`;
    }
    dialog.appendChild(levelRow);

    // ── Progress bar ────────────────────────────────────────────────────────
    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'margin-bottom:14px;';

    const progressLabel = document.createElement('div');
    progressLabel.style.cssText = 'font-size:13px;color:#8a7a5a;margin-bottom:4px;font-family:Rajdhani,sans-serif;';
    if (mastered) {
      progressLabel.textContent = '100 / 100';
    } else {
      progressLabel.textContent = `${ability.points} / ${ability.points_to_next ?? 100}`;
    }
    progressWrap.appendChild(progressLabel);

    const barBg = document.createElement('div');
    barBg.style.cssText = 'width:100%;height:10px;background:#1a1814;border-radius:5px;overflow:hidden;';
    const barFill = document.createElement('div');
    const pct = mastered ? 100 : Math.min(100, Math.round((ability.points / (ability.points_to_next ?? 100)) * 100));
    const barColor = mastered ? '#27ae60' : '#d4a84b';
    barFill.style.cssText = `width:${pct}%;height:100%;background:${barColor};border-radius:4px;transition:width 0.3s;`;
    barBg.appendChild(barFill);
    progressWrap.appendChild(barBg);
    dialog.appendChild(progressWrap);

    // ── Current stats ───────────────────────────────────────────────────────
    const currentHeader = document.createElement('div');
    currentHeader.textContent = 'Current Stats';
    currentHeader.style.cssText =
      'font-size:13px;color:#5a4a2a;font-family:Cinzel,serif;letter-spacing:0.06em;margin-bottom:6px;text-transform:uppercase;';
    dialog.appendChild(currentHeader);

    const ev = stats?.effect_value ?? ability.effect_value;
    const mc = stats?.mana_cost ?? ability.mana_cost;
    const dt = stats?.duration_turns ?? ability.duration_turns;
    const ct = stats?.cooldown_turns ?? ability.cooldown_turns;

    dialog.appendChild(this.buildStatsTable(ev, mc, dt, ct, '#c9a55c'));

    // ── Next level stats ────────────────────────────────────────────────────
    if (!mastered && nextStats) {
      const nextHeader = document.createElement('div');
      nextHeader.textContent = 'Next Level';
      nextHeader.style.cssText =
        'font-size:11px;color:#5a4a2a;font-family:Cinzel,serif;letter-spacing:0.06em;margin-bottom:6px;margin-top:12px;text-transform:uppercase;';
      dialog.appendChild(nextHeader);
      dialog.appendChild(this.buildStatsTable(nextStats.effect_value, nextStats.mana_cost, nextStats.duration_turns, nextStats.cooldown_turns, '#a8c070'));
    }

    // ── Cooldown status ─────────────────────────────────────────────────────
    const cdRow = document.createElement('div');
    cdRow.style.cssText = 'margin-top:16px;font-size:15px;';
    if (ability.cooldown_until) {
      const until = new Date(ability.cooldown_until).getTime();
      const now = Date.now();
      const remaining = until - now;
      if (remaining > 0) {
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.ceil((remaining % 3600000) / 60000);
        cdRow.style.color = '#c06060';
        cdRow.textContent = `Can use skill book in: ${hours}h ${minutes}m`;
      } else {
        cdRow.style.color = '#27ae60';
        cdRow.textContent = 'Ready';
      }
    } else {
      cdRow.style.color = '#27ae60';
      cdRow.textContent = 'Ready';
    }
    dialog.appendChild(cdRow);

    // ── Close button (bottom) ───────────────────────────────────────────────
    const closeBtnBottom = document.createElement('button');
    closeBtnBottom.textContent = 'Close';
    closeBtnBottom.style.cssText = [
      'display:block',
      'margin:16px auto 0',
      'background:#3a2f1a',
      'border:1px solid #5a4a2a',
      'border-radius:4px',
      'color:#e8c870',
      'font-family:Cinzel,serif',
      'font-size:15px',
      'padding:6px 24px',
      'cursor:pointer',
    ].join(';');
    closeBtnBottom.addEventListener('click', () => this.close());
    dialog.appendChild(closeBtnBottom);

    this.overlay.appendChild(dialog);
    this.parent.appendChild(this.overlay);
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildStatsTable(
    effectValue: number,
    manaCost: number,
    durationTurns: number,
    cooldownTurns: number,
    valueColor: string,
  ): HTMLElement {
    const table = document.createElement('div');
    table.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:15px;margin-bottom:6px;';

    const rows: [string, string][] = [
      ['Effect Value', String(effectValue)],
      ['Mana Cost', String(manaCost)],
    ];
    if (durationTurns > 0) rows.push(['Duration', `${durationTurns} turns`]);
    if (cooldownTurns > 0) rows.push(['Cooldown', `${cooldownTurns} turns`]);

    for (const [label, value] of rows) {
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      labelEl.style.cssText = 'color:#8a7a5a;';
      table.appendChild(labelEl);

      const valEl = document.createElement('span');
      valEl.textContent = value;
      valEl.style.cssText = `color:${valueColor};font-family:Rajdhani,sans-serif;font-weight:600;`;
      table.appendChild(valEl);
    }
    return table;
  }
}
