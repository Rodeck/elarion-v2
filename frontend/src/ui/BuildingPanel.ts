export class BuildingPanel {
  private container: HTMLElement;
  private overlay: HTMLElement | null = null;
  private handleEscape: ((e: KeyboardEvent) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = parent;
  }

  show(_buildingName: string): void {
    // Building interactions not yet implemented
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
