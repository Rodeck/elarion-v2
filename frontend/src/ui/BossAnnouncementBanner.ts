import type { BossAnnouncementPayload } from '../../../shared/protocol/index';

const DISPLAY_MS = 6000;
const FADE_MS = 600;

/**
 * Full-width announcement banner for boss events.
 * Slides down from the top, stays for a few seconds, then fades out.
 */
export class BossAnnouncementBanner {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'boss-announcement-container';
    this.container.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'right:0',
      'z-index:400', 'pointer-events:none',
      'display:flex', 'flex-direction:column', 'align-items:center',
    ].join(';');
    parent.appendChild(this.container);
  }

  show(payload: BossAnnouncementPayload): void {
    const banner = document.createElement('div');
    banner.style.cssText = [
      'pointer-events:auto',
      'margin-top:12px',
      'padding:16px 32px',
      'border-radius:6px',
      'font-family:Cinzel,serif',
      'text-align:center',
      'max-width:600px',
      'width:90%',
      'opacity:0',
      'transform:translateY(-20px)',
      'transition:opacity 0.4s ease, transform 0.4s ease',
    ].join(';');

    if (payload.type === 'defeated') {
      banner.style.background = 'linear-gradient(135deg, rgba(30,15,5,0.95), rgba(60,25,10,0.95))';
      banner.style.border = '1px solid #b8860b';
      banner.style.boxShadow = '0 4px 24px rgba(184,134,11,0.3), inset 0 0 30px rgba(184,134,11,0.05)';

      const icon = payload.boss_icon_url
        ? `<img src="${payload.boss_icon_url}" style="width:48px;height:48px;object-fit:contain;border-radius:4px;border:1px solid #5a4a2a;image-rendering:pixelated;margin-bottom:6px;" />`
        : `<div style="font-size:2rem;margin-bottom:4px;">\u2694\uFE0F</div>`;

      banner.innerHTML = `
        ${icon}
        <div style="font-size:0.7rem;letter-spacing:0.12em;color:#b8860b;text-transform:uppercase;margin-bottom:4px;">Guardian Defeated</div>
        <div style="font-size:1.2rem;color:#f0c060;font-weight:700;text-shadow:0 0 12px rgba(240,192,96,0.4);margin-bottom:6px;">${this.esc(payload.boss_name)}</div>
        <div style="font-size:0.9rem;color:#e8c870;">has been slain by</div>
        <div style="font-size:1.1rem;color:#ffffff;font-weight:700;margin-top:4px;text-shadow:0 0 8px rgba(255,255,255,0.3);">${this.esc(payload.defeated_by ?? 'Unknown')}</div>
        ${payload.total_attempts && payload.total_attempts > 1
          ? `<div style="font-size:0.7rem;color:#8a7a5a;margin-top:8px;">after ${payload.total_attempts} challenger${payload.total_attempts > 1 ? 's' : ''}</div>`
          : ''}
        <div style="font-size:0.7rem;color:#6a5a3a;margin-top:4px;">${payload.building_name ? `${this.esc(payload.building_name)} is now accessible` : ''}</div>
      `;
    } else {
      // respawned — smaller, compact banner
      banner.style.padding = '10px 24px';
      banner.style.background = 'linear-gradient(135deg, rgba(20,5,5,0.92), rgba(45,10,10,0.92))';
      banner.style.border = '1px solid #6b1010';
      banner.style.boxShadow = '0 3px 16px rgba(139,0,0,0.25)';
      banner.style.maxWidth = '480px';

      const icon = payload.boss_icon_url
        ? `<img src="${payload.boss_icon_url}" style="width:28px;height:28px;object-fit:contain;border-radius:3px;border:1px solid #5a2020;image-rendering:pixelated;" />`
        : `<span style="font-size:1.1rem;">\u2620</span>`;

      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;justify-content:center;">
          ${icon}
          <div>
            <div style="font-size:0.6rem;letter-spacing:0.1em;color:#993333;text-transform:uppercase;">A Guardian Returns</div>
            <div style="font-size:0.9rem;color:#ff6666;font-weight:700;">${this.esc(payload.boss_name)} <span style="font-size:0.75rem;color:#cc8888;font-weight:400;">guards ${payload.building_name ? this.esc(payload.building_name) : 'its domain'}</span></div>
          </div>
        </div>
      `;
    }

    this.container.appendChild(banner);

    // Trigger slide-in
    requestAnimationFrame(() => {
      banner.style.opacity = '1';
      banner.style.transform = 'translateY(0)';
    });

    // Auto-dismiss
    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-10px)';
      setTimeout(() => banner.remove(), FADE_MS);
    }, DISPLAY_MS);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
