import type { DayNightStateDto } from '@elarion/protocol';

export class DayNightBar {
  private container: HTMLDivElement;
  private fill: HTMLDivElement;
  private icon: HTMLSpanElement;
  private timeLabel: HTMLSpanElement;
  private overlay: HTMLDivElement;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private currentDto: DayNightStateDto | null = null;

  constructor(gameContainer: HTMLElement) {
    // ── Progress bar container ─────────────────────────────────────
    this.container = document.createElement('div');
    this.container.id = 'day-night-bar';
    Object.assign(this.container.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      width:         '100%',
      height:        '20px',
      zIndex:        '10',
      display:       'flex',
      alignItems:    'center',
      background:    'rgba(0,0,0,0.4)',
      overflow:      'hidden',
      pointerEvents: 'none',
    });

    this.fill = document.createElement('div');
    Object.assign(this.fill.style, {
      height:     '100%',
      width:      '0%',
      transition: 'width 0.5s linear',
      background: '#d4a84b',
    });

    this.icon = document.createElement('span');
    Object.assign(this.icon.style, {
      position:   'absolute',
      fontSize:   '13px',
      lineHeight: '20px',
      pointerEvents: 'none',
    });

    this.timeLabel = document.createElement('span');
    Object.assign(this.timeLabel.style, {
      position:   'absolute',
      right:      '6px',
      fontSize:   '11px',
      lineHeight: '20px',
      color:      '#ffffffcc',
      fontFamily: 'monospace',
      pointerEvents: 'none',
    });

    this.container.appendChild(this.fill);
    this.container.appendChild(this.icon);
    this.container.appendChild(this.timeLabel);
    gameContainer.appendChild(this.container);

    // ── Night overlay ──────────────────────────────────────────────
    this.overlay = document.createElement('div');
    this.overlay.id = 'night-overlay';
    Object.assign(this.overlay.style, {
      position:      'absolute',
      inset:         '0',
      background:    'rgba(0, 0, 30, 0.35)',
      pointerEvents: 'none',
      zIndex:        '5',
      display:       'none',
    });
    gameContainer.appendChild(this.overlay);
  }

  update(dto: DayNightStateDto): void {
    this.currentDto = dto;

    const isNight = dto.phase === 'night';

    this.overlay.style.display = isNight ? 'block' : 'none';

    // Restart ticker
    if (this.ticker !== null) {
      clearInterval(this.ticker);
    }
    this.tick();
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    if (!this.currentDto) return;

    const dto      = this.currentDto;
    const total    = dto.day_duration_ms + dto.night_duration_ms;
    const isNight  = dto.phase === 'night';
    const elapsed  = Date.now() - dto.phase_started_at;

    // Position within the full cycle: day fills 0→dayFrac, night fills dayFrac→1
    const dayFrac       = dto.day_duration_ms / total;
    const phaseElapsed  = Math.min(elapsed, isNight ? dto.night_duration_ms : dto.day_duration_ms);
    const cycleProgress = isNight
      ? dayFrac + (phaseElapsed / total)
      : phaseElapsed / total;

    // Bar fill width
    this.fill.style.width = `${(Math.min(cycleProgress, 1) * 100).toFixed(2)}%`;

    // Gradient: gold for day portion, blue for night portion
    this.fill.style.background = `linear-gradient(to right, #d4a84b ${(dayFrac * 100).toFixed(1)}%, #4a6fa5 ${(dayFrac * 100).toFixed(1)}%)`;

    // Icon follows the fill edge
    this.icon.textContent = isNight ? '☾' : '☀';
    const fillPct = Math.min(cycleProgress * 100, 96);
    this.icon.style.left = `calc(${fillPct}% - 10px)`;

    // Countdown to end of current phase (MM:SS)
    const phaseDuration = isNight ? dto.night_duration_ms : dto.day_duration_ms;
    const remaining     = Math.max(0, phaseDuration - elapsed);
    const totalSec      = Math.ceil(remaining / 1000);
    const mins          = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const secs          = (totalSec % 60).toString().padStart(2, '0');
    this.timeLabel.textContent = `${mins}:${secs}`;
  }

  destroy(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    this.container.remove();
    this.overlay.remove();
  }
}
