export class BuildingPanel {
  private container: HTMLElement;
  private overlay: HTMLElement | null = null;
  private handleEscape: ((e: KeyboardEvent) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = parent;
  }

  show(buildingName: string): void {
    this.hide(); // Close any existing panel

    this.overlay = document.createElement('div');
    this.overlay.className = 'building-panel-overlay';
    this.overlay.innerHTML = `
      <div class="building-panel">
        <button class="building-panel__close">&times;</button>
        <h2 class="building-panel__title">${this.escapeHtml(buildingName)}</h2>
        <p class="building-panel__body">Building actions coming soon...</p>
      </div>
    `;

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Close button
    this.overlay.querySelector('.building-panel__close')!.addEventListener('click', () => {
      this.hide();
    });

    // Escape key
    this.handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.handleEscape);

    this.container.appendChild(this.overlay);
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.handleEscape) {
      document.removeEventListener('keydown', this.handleEscape);
      this.handleEscape = null;
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy(): void {
    this.hide();
  }
}
