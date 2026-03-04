import type { EditorBuilding } from '../editor/canvas';
import {
  updateBuilding,
  listBuildingActions,
  createBuildingAction,
  deleteBuildingAction,
  listMaps,
  listNodes,
  type BuildingAction,
  type MapSummary,
} from '../editor/api';

export class PropertiesPanel {
  private container: HTMLElement;
  private currentBuildingId: number | null = null;
  private currentMapId: number | null = null;

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

  showBuilding(building: EditorBuilding, mapId: number): void {
    this.currentBuildingId = building.id;
    this.currentMapId = mapId;
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'properties';

    // ── Header ──────────────────────────────────────────────────────
    const h3 = document.createElement('h3');
    h3.textContent = 'Building';
    panel.appendChild(h3);

    // ── Name ────────────────────────────────────────────────────────
    panel.appendChild(this.label('Name', 'prop-name'));
    const nameInput = document.createElement('input');
    nameInput.id = 'prop-name';
    nameInput.type = 'text';
    nameInput.value = building.name;
    panel.appendChild(nameInput);

    // ── Description ─────────────────────────────────────────────────
    panel.appendChild(this.label('Description', 'prop-desc'));
    const descArea = document.createElement('textarea');
    descArea.id = 'prop-desc';
    descArea.rows = 3;
    descArea.value = (building as unknown as { description?: string | null }).description ?? '';
    panel.appendChild(descArea);

    // ── Label offsets ───────────────────────────────────────────────
    panel.appendChild(this.label('Label Offset X', 'prop-label-x'));
    const labelXInput = document.createElement('input');
    labelXInput.id = 'prop-label-x';
    labelXInput.type = 'number';
    labelXInput.value = String(building.label_offset_x);
    panel.appendChild(labelXInput);

    panel.appendChild(this.label('Label Offset Y', 'prop-label-y'));
    const labelYInput = document.createElement('input');
    labelYInput.id = 'prop-label-y';
    labelYInput.type = 'number';
    labelYInput.value = String(building.label_offset_y);
    panel.appendChild(labelYInput);

    const hotspotInfo = document.createElement('p');
    hotspotInfo.className = 'prop-info';
    hotspotInfo.textContent = `Hotspot: ${(building as unknown as { hotspot_type?: string | null }).hotspot_type ?? 'none'}`;
    panel.appendChild(hotspotInfo);

    // ── Auto-save on blur ────────────────────────────────────────────
    const saveField = async (field: 'name' | 'description' | 'label_offset_x' | 'label_offset_y') => {
      if (this.currentBuildingId === null || this.currentMapId === null) return;
      const data: Partial<EditorBuilding & { description: string | null }> = {};

      if (field === 'name') {
        data.name = nameInput.value.trim();
      } else if (field === 'description') {
        data.description = descArea.value;
      } else if (field === 'label_offset_x') {
        data.label_offset_x = parseInt(labelXInput.value, 10) || 0;
      } else if (field === 'label_offset_y') {
        data.label_offset_y = parseInt(labelYInput.value, 10) || 0;
      }

      try {
        await updateBuilding(this.currentMapId, this.currentBuildingId, data);
        if (field === 'name' || field === 'label_offset_x' || field === 'label_offset_y') {
          this.onBuildingUpdate?.(this.currentBuildingId, data as Partial<EditorBuilding>);
        }
      } catch (err) {
        alert(`Failed to save: ${(err as Error).message}`);
      }
    };

    nameInput.addEventListener('blur', () => saveField('name'));
    descArea.addEventListener('blur', () => saveField('description'));
    labelXInput.addEventListener('blur', () => saveField('label_offset_x'));
    labelYInput.addEventListener('blur', () => saveField('label_offset_y'));

    // ── Actions section ─────────────────────────────────────────────
    const actionsSection = document.createElement('div');
    actionsSection.style.marginTop = '12px';

    const actionsHeader = document.createElement('label');
    actionsHeader.textContent = 'Travel Actions';
    actionsHeader.style.marginBottom = '4px';
    actionsSection.appendChild(actionsHeader);

    const actionsList = document.createElement('div');
    actionsList.id = 'actions-list';
    actionsSection.appendChild(actionsList);

    panel.appendChild(actionsSection);

    // Load and render existing actions
    void this.renderActions(actionsList, building.id, mapId);

    // ── Add Action button ───────────────────────────────────────────
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--secondary';
    addBtn.textContent = '+ Add Action';
    addBtn.style.width = '100%';
    addBtn.style.marginTop = '6px';

    const addForm = document.createElement('div');
    addForm.id = 'add-action-form';
    addForm.style.display = 'none';

    addBtn.addEventListener('click', () => {
      addBtn.style.display = 'none';
      addForm.style.display = 'block';
      void this.buildAddActionForm(addForm, actionsList, building.id, mapId, () => {
        addForm.style.display = 'none';
        addBtn.style.display = '';
      });
    });

    panel.appendChild(addBtn);
    panel.appendChild(addForm);

    // ── Delete button ────────────────────────────────────────────────
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--danger';
    deleteBtn.id = 'prop-delete';
    deleteBtn.textContent = 'Delete Building';
    deleteBtn.style.width = '100%';
    deleteBtn.style.marginTop = '12px';
    deleteBtn.addEventListener('click', () => {
      if (this.currentBuildingId === null) return;
      if (!confirm('Delete this building?')) return;
      this.onBuildingDelete?.(this.currentBuildingId);
      this.clear();
    });
    panel.appendChild(deleteBtn);

    this.container.appendChild(panel);
  }

  private async renderActions(
    container: HTMLElement,
    buildingId: number,
    mapId: number,
  ): Promise<void> {
    container.innerHTML = '<em style="font-size:11px;color:#404666;">Loading...</em>';
    try {
      const actions = await listBuildingActions(mapId, buildingId);
      container.innerHTML = '';

      if (actions.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'font-size:11px;color:#3a4060;font-style:italic;margin:0;';
        empty.textContent = 'No actions configured.';
        container.appendChild(empty);
        return;
      }

      for (const action of actions) {
        container.appendChild(this.actionRow(action, buildingId, mapId, container, actions));
      }
    } catch {
      container.innerHTML = '<em style="font-size:11px;color:#f87171;">Failed to load actions.</em>';
    }
  }

  private actionRow(
    action: BuildingAction,
    buildingId: number,
    mapId: number,
    container: HTMLElement,
    allActions: BuildingAction[],
  ): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;';

    const labelEl = document.createElement('span');
    labelEl.style.cssText = 'flex:1;font-size:11px;color:#8a94b0;';
    labelEl.textContent = `Travel → Zone ${action.config.target_zone_id} Node ${action.config.target_node_id}`;

    const del = document.createElement('button');
    del.className = 'btn btn--danger btn--small';
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this action?')) return;
      try {
        await deleteBuildingAction(mapId, buildingId, action.id);
        const idx = allActions.indexOf(action);
        if (idx !== -1) allActions.splice(idx, 1);
        row.remove();
        if (container.children.length === 0) {
          const empty = document.createElement('p');
          empty.style.cssText = 'font-size:11px;color:#3a4060;font-style:italic;margin:0;';
          empty.textContent = 'No actions configured.';
          container.appendChild(empty);
        }
      } catch (err) {
        alert(`Failed to delete action: ${(err as Error).message}`);
      }
    });

    row.appendChild(labelEl);
    row.appendChild(del);
    return row;
  }

  private async buildAddActionForm(
    container: HTMLElement,
    actionsList: HTMLElement,
    buildingId: number,
    mapId: number,
    onClose: () => void,
  ): Promise<void> {
    container.innerHTML = '<em style="font-size:11px;color:#404666;">Loading maps...</em>';

    let maps: MapSummary[] = [];
    try {
      maps = await listMaps();
    } catch {
      container.innerHTML = '<em style="font-size:11px;color:#f87171;">Failed to load maps.</em>';
      return;
    }

    container.innerHTML = '';
    container.style.cssText = 'border:1px solid #1e2232;border-radius:6px;padding:8px;margin-top:6px;background:#0c0e14;';

    // Map selector
    const mapLabel = this.label('Destination Map', 'action-map-select');
    container.appendChild(mapLabel);

    const mapSelect = document.createElement('select');
    mapSelect.id = 'action-map-select';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— select map —';
    mapSelect.appendChild(defaultOpt);
    for (const m of maps) {
      const opt = document.createElement('option');
      opt.value = String(m.id);
      opt.textContent = m.name;
      mapSelect.appendChild(opt);
    }
    container.appendChild(mapSelect);

    // Node selector
    const nodeLabel = this.label('Destination Node', 'action-node-select');
    container.appendChild(nodeLabel);

    const nodeSelect = document.createElement('select');
    nodeSelect.id = 'action-node-select';
    nodeSelect.disabled = true;
    const nodeDefaultOpt = document.createElement('option');
    nodeDefaultOpt.value = '';
    nodeDefaultOpt.textContent = '— select node —';
    nodeSelect.appendChild(nodeDefaultOpt);
    container.appendChild(nodeSelect);

    // Populate nodes when map changes
    mapSelect.addEventListener('change', async () => {
      const selectedMapId = parseInt(mapSelect.value, 10);
      nodeSelect.innerHTML = '';
      const nd = document.createElement('option');
      nd.value = '';
      nd.textContent = '— loading... —';
      nodeSelect.appendChild(nd);
      nodeSelect.disabled = true;

      if (isNaN(selectedMapId)) return;

      try {
        const nodes = await listNodes(selectedMapId);
        nodeSelect.innerHTML = '';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— select node —';
        nodeSelect.appendChild(emptyOpt);
        for (const n of nodes) {
          const opt = document.createElement('option');
          opt.value = String(n.id);
          opt.textContent = `Node ${n.id} (${n.x}, ${n.y})${n.is_spawn ? ' [spawn]' : ''}`;
          nodeSelect.appendChild(opt);
        }
        nodeSelect.disabled = false;
      } catch {
        nodeSelect.innerHTML = '<option value="">Failed to load nodes</option>';
      }
    });

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Save';
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', async () => {
      const targetZoneId = parseInt(mapSelect.value, 10);
      const targetNodeId = parseInt(nodeSelect.value, 10);
      if (isNaN(targetZoneId) || isNaN(targetNodeId)) {
        alert('Please select both a destination map and node.');
        return;
      }
      saveBtn.disabled = true;
      try {
        const action = await createBuildingAction(mapId, buildingId, {
          action_type: 'travel',
          config: { target_zone_id: targetZoneId, target_node_id: targetNodeId },
        });
        await this.renderActions(actionsList, buildingId, mapId);
        void action;
        onClose();
      } catch (err) {
        alert(`Failed to save action: ${(err as Error).message}`);
        saveBtn.disabled = false;
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.flex = '1';
    cancelBtn.addEventListener('click', onClose);

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    container.appendChild(btnRow);
  }

  clear(): void {
    this.currentBuildingId = null;
    this.currentMapId = null;
    this.container.innerHTML = '';
  }

  destroy(): void {
    this.clear();
    this.onBuildingUpdate = null;
    this.onBuildingDelete = null;
  }

  private label(text: string, forId: string): HTMLElement {
    const lbl = document.createElement('label');
    lbl.setAttribute('for', forId);
    lbl.textContent = text;
    return lbl;
  }
}
