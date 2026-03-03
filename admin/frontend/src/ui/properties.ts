import type { EditorBuilding } from '../editor/canvas';

export class PropertiesPanel {
  private container: HTMLElement;
  private currentBuildingId: number | null = null;

  private onBuildingUpdate: ((buildingId: number, data: Partial<EditorBuilding>) => void) | null = null;
  private onBuildingDelete: ((buildingId: number) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = parent;
  }

  setOnBuildingUpdate(cb: (buildingId: number, data: Partial<EditorBuilding>) => void): void {
    this.onBuildingUpdate = cb;
  }

  setOnBuildingDelete(cb: (buildingId: number) => void): void {
    this.onBuildingDelete = cb;
  }

  showBuilding(building: EditorBuilding): void {
    this.currentBuildingId = building.id;
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'properties';

    panel.innerHTML = `
      <h3>Building</h3>
      <label for="prop-name">Name</label>
      <input id="prop-name" type="text" value="${this.escapeAttr(building.name)}" />
      <label for="prop-label-x">Label Offset X</label>
      <input id="prop-label-x" type="number" value="${building.label_offset_x}" />
      <label for="prop-label-y">Label Offset Y</label>
      <input id="prop-label-y" type="number" value="${building.label_offset_y}" />
      <p class="prop-info">Hotspot: ${building.hotspot_type ?? 'none'}</p>
      <button class="btn btn--danger" id="prop-delete">Delete Building</button>
    `;

    const nameInput = panel.querySelector<HTMLInputElement>('#prop-name')!;
    const labelXInput = panel.querySelector<HTMLInputElement>('#prop-label-x')!;
    const labelYInput = panel.querySelector<HTMLInputElement>('#prop-label-y')!;

    const emitUpdate = () => {
      if (this.currentBuildingId === null) return;
      this.onBuildingUpdate?.(this.currentBuildingId, {
        name: nameInput.value.trim(),
        label_offset_x: parseInt(labelXInput.value, 10) || 0,
        label_offset_y: parseInt(labelYInput.value, 10) || 0,
      });
    };

    nameInput.addEventListener('change', emitUpdate);
    labelXInput.addEventListener('change', emitUpdate);
    labelYInput.addEventListener('change', emitUpdate);

    panel.querySelector('#prop-delete')!.addEventListener('click', () => {
      if (this.currentBuildingId === null) return;
      if (!confirm('Delete this building?')) return;
      this.onBuildingDelete?.(this.currentBuildingId);
      this.clear();
    });

    this.container.appendChild(panel);
  }

  clear(): void {
    this.currentBuildingId = null;
    this.container.innerHTML = '';
  }

  destroy(): void {
    this.clear();
    this.onBuildingUpdate = null;
    this.onBuildingDelete = null;
  }

  private escapeAttr(text: string): string {
    return text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
