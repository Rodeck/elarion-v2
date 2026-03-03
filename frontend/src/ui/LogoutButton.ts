const LOGOUT_ICON_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true">
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
  <polyline points="16 17 21 12 16 7"/>
  <line x1="21" y1="12" x2="9" y2="12"/>
</svg>`.trim();

export class LogoutButton {
  private button: HTMLButtonElement;

  constructor(mountEl: HTMLElement, onLogout: () => void) {
    this.button = document.createElement('button');
    this.button.title = 'Log out';
    this.button.innerHTML = LOGOUT_ICON_SVG;
    this.button.style.cssText = `
      position: absolute;
      top: 12px;
      right: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      background: transparent;
      border: 1px solid var(--color-gold-dim);
      border-radius: 4px;
      color: var(--color-gold-primary);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      padding: 0;
      flex-shrink: 0;
    `;

    this.button.addEventListener('mouseenter', () => {
      this.button.style.borderColor = 'var(--color-gold-bright)';
      this.button.style.color = 'var(--color-gold-bright)';
      this.button.style.background = 'rgba(212,168,75,0.08)';
    });
    this.button.addEventListener('mouseleave', () => {
      this.button.style.borderColor = 'var(--color-gold-dim)';
      this.button.style.color = 'var(--color-gold-primary)';
      this.button.style.background = 'transparent';
    });

    this.button.addEventListener('click', onLogout);
    mountEl.appendChild(this.button);
  }

  destroy(): void {
    this.button.remove();
  }
}
