import type { EditorBuilding } from '../editor/canvas';
import {
  updateBuilding,
  listBuildingActions,
  createBuildingAction,
  updateBuildingAction,
  deleteBuildingAction,
  listMaps,
  listNodes,
  listMonsters,
  listNpcs,
  listBuildingNpcs,
  assignNpcToBuilding,
  removeNpcFromBuilding,
  type BuildingAction,
  type MapSummary,
  type MonsterResponse,
  type NpcResponse,
  type BuildingNpcEntry,
  type TravelActionConfig,
  type ExploreActionConfig,
  type ExploreMonsterEntry,
  type ExpeditionActionConfig,
  type ExpeditionItemEntry,
  type ItemDefinitionResponse,
} from '../editor/api';
import { openItemPicker, resolveItemName } from './item-picker';

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
        await updateBuilding(this.currentMapId, this.currentBuildingId, data as Parameters<typeof updateBuilding>[2]);
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
    actionsHeader.textContent = 'Actions';
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

    // ── NPCs section ─────────────────────────────────────────────────
    const npcsSection = document.createElement('div');
    npcsSection.style.marginTop = '12px';

    const npcsHeader = document.createElement('label');
    npcsHeader.textContent = 'NPCs';
    npcsHeader.style.marginBottom = '4px';
    npcsSection.appendChild(npcsHeader);

    const npcsList = document.createElement('div');
    npcsList.id = 'building-npcs-list';
    npcsSection.appendChild(npcsList);

    const npcAssignRow = document.createElement('div');
    npcAssignRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

    const npcSelect = document.createElement('select');
    npcSelect.id = 'npc-assign-select';
    npcSelect.style.flex = '1';
    const npcDefaultOpt = document.createElement('option');
    npcDefaultOpt.value = '';
    npcDefaultOpt.textContent = '— select NPC —';
    npcSelect.appendChild(npcDefaultOpt);

    const npcAssignBtn = document.createElement('button');
    npcAssignBtn.className = 'btn btn--secondary';
    npcAssignBtn.textContent = 'Assign';
    npcAssignBtn.style.flexShrink = '0';

    npcAssignRow.appendChild(npcSelect);
    npcAssignRow.appendChild(npcAssignBtn);
    npcsSection.appendChild(npcAssignRow);

    panel.appendChild(npcsSection);

    void this.renderNpcsSection(npcsList, npcSelect, npcAssignBtn, building.id, mapId);

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
    if (action.action_type === 'travel') {
      const cfg = action.config as TravelActionConfig;
      labelEl.textContent = `Travel → Zone ${cfg.target_zone_id} Node ${cfg.target_node_id}`;
    } else if (action.action_type === 'expedition') {
      const cfg = action.config as ExpeditionActionConfig;
      const expName = (cfg as any).name || 'Expedition';
      labelEl.textContent = `${expName} (gold:${cfg.base_gold} exp:${cfg.base_exp} items:${cfg.items.length})`;
    } else if (action.action_type === 'gather') {
      const cfg = action.config as Record<string, unknown>;
      const evts = Array.isArray(cfg['events']) ? cfg['events'].length : 0;
      labelEl.textContent = `Gather (${cfg['required_tool_type']}, ${cfg['min_seconds']}–${cfg['max_seconds']}s, ${evts} event${evts !== 1 ? 's' : ''})`;
    } else if (action.action_type === 'marketplace') {
      const cfg = action.config as Record<string, unknown>;
      labelEl.textContent = `Marketplace (fee:${cfg['listing_fee']}, max:${cfg['max_listings']}, ${cfg['listing_duration_days']}d)`;
    } else if (action.action_type === 'fishing') {
      const cfg = action.config as Record<string, unknown>;
      const minTier = cfg['min_rod_tier'] ? `T${cfg['min_rod_tier']}+` : 'any rod';
      labelEl.textContent = `Fishing (${minTier})`;
    } else {
      const cfg = action.config as ExploreActionConfig;
      labelEl.textContent = `Explore (${cfg.encounter_chance}% chance, ${cfg.monsters.length} monster${cfg.monsters.length !== 1 ? 's' : ''})`;
    }

    const del = document.createElement('button');
    del.className = 'btn btn--danger btn--small';
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this action?')) return;
      try {
        await deleteBuildingAction(mapId, buildingId, action.id);
        const idx = allActions.indexOf(action);
        if (idx !== -1) allActions.splice(idx, 1);
        wrapper.remove();
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

    const wrapper = document.createElement('div');
    wrapper.appendChild(row);

    if (action.action_type === 'explore' || action.action_type === 'expedition') {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn--secondary btn--small';
      editBtn.textContent = '✎';
      editBtn.title = `Edit ${action.action_type} config`;

      const editForm = document.createElement('div');
      editForm.style.display = 'none';

      editBtn.addEventListener('click', () => {
        const isOpen = editForm.style.display !== 'none';
        if (isOpen) {
          editForm.style.display = 'none';
        } else if (action.action_type === 'explore') {
          editForm.innerHTML = '<em style="font-size:11px;color:#404666;">Loading...</em>';
          editForm.style.display = '';
          void listMonsters().then((monsters) => {
            editForm.innerHTML = '';
            this.renderEditExploreForm(editForm, action, monsters, mapId, buildingId, labelEl, () => {
              editForm.style.display = 'none';
            });
          }).catch(() => {
            editForm.innerHTML = '<em style="font-size:11px;color:#f87171;">Failed to load monsters.</em>';
          });
        } else {
          editForm.innerHTML = '';
          editForm.style.display = '';
          this.renderEditExpeditionForm(editForm, action, mapId, buildingId, labelEl, () => {
            editForm.style.display = 'none';
          });
        }
      });

      row.appendChild(editBtn);
      wrapper.appendChild(editForm);
    }

    return wrapper;
  }

  private renderEditExploreForm(
    container: HTMLElement,
    action: BuildingAction,
    monsters: MonsterResponse[],
    mapId: number,
    buildingId: number,
    labelEl: HTMLElement,
    onClose: () => void,
  ): void {
    const cfg = action.config as ExploreActionConfig;
    container.style.cssText = 'border:1px solid #1e2232;border-radius:6px;padding:8px;margin-top:4px;margin-bottom:4px;background:#0c0e14;';

    container.appendChild(this.label('Encounter Chance (1–100%)', `edit-chance-${action.id}`));
    const chanceInput = document.createElement('input');
    chanceInput.id = `edit-chance-${action.id}`;
    chanceInput.type = 'number';
    chanceInput.min = '1';
    chanceInput.max = '100';
    chanceInput.value = String(cfg.encounter_chance);
    container.appendChild(chanceInput);

    container.appendChild(this.label('Monster Table', `edit-monsters-${action.id}`));
    const monsterEntriesEl = document.createElement('div');
    monsterEntriesEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:4px;';
    container.appendChild(monsterEntriesEl);

    const monsterEntries: ExploreMonsterEntry[] = cfg.monsters.map((m) => ({ ...m }));

    const buildMonsterRow = (entry: ExploreMonsterEntry): HTMLElement => {
      const entryRow = document.createElement('div');
      entryRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const mSel = document.createElement('select');
      mSel.style.flex = '1';
      monsters.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = String(m.id);
        opt.textContent = m.name;
        opt.selected = m.id === entry.monster_id;
        mSel.appendChild(opt);
      });
      mSel.addEventListener('change', () => { entry.monster_id = parseInt(mSel.value, 10); });

      const wInput = document.createElement('input');
      wInput.type = 'number';
      wInput.min = '1';
      wInput.value = String(entry.weight);
      wInput.style.width = '52px';
      wInput.title = 'Weight';
      wInput.placeholder = 'Wt';
      wInput.addEventListener('input', () => { entry.weight = parseInt(wInput.value, 10) || 1; });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--danger btn--small';
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        const idx = monsterEntries.indexOf(entry);
        if (idx !== -1) monsterEntries.splice(idx, 1);
        entryRow.remove();
      });

      entryRow.appendChild(mSel);
      entryRow.appendChild(wInput);
      entryRow.appendChild(removeBtn);
      return entryRow;
    };

    for (const entry of monsterEntries) {
      monsterEntriesEl.appendChild(buildMonsterRow(entry));
    }

    const addMonsterBtn = document.createElement('button');
    addMonsterBtn.className = 'btn btn--secondary';
    addMonsterBtn.type = 'button';
    addMonsterBtn.textContent = '+ Add Monster';
    addMonsterBtn.style.cssText = 'width:100%;font-size:11px;margin-bottom:4px;';
    addMonsterBtn.addEventListener('click', () => {
      if (monsters.length === 0) { alert('No monsters defined yet. Create monsters first.'); return; }
      const entry: ExploreMonsterEntry = { monster_id: monsters[0]!.id, weight: 1 };
      monsterEntries.push(entry);
      monsterEntriesEl.appendChild(buildMonsterRow(entry));
    });
    container.appendChild(addMonsterBtn);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Save';
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      const encounterChance = parseInt(chanceInput.value, 10);
      if (isNaN(encounterChance) || encounterChance < 1 || encounterChance > 100) {
        alert('Encounter chance must be between 1 and 100.');
        saveBtn.disabled = false;
        return;
      }
      if (monsterEntries.length === 0) {
        alert('Add at least one monster to the table.');
        saveBtn.disabled = false;
        return;
      }
      try {
        const updated = await updateBuildingAction(mapId, buildingId, action.id, {
          config: { encounter_chance: encounterChance, monsters: monsterEntries } as ExploreActionConfig,
        });
        action.config = updated.config;
        const n = monsterEntries.length;
        labelEl.textContent = `Explore (${encounterChance}% chance, ${n} monster${n !== 1 ? 's' : ''})`;
        onClose();
      } catch (err) {
        alert(`Failed to save: ${(err as Error).message}`);
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

  private renderEditExpeditionForm(
    container: HTMLElement,
    action: BuildingAction,
    mapId: number,
    buildingId: number,
    labelEl: HTMLElement,
    onClose: () => void,
  ): void {
    const cfg = action.config as ExpeditionActionConfig;
    container.style.cssText = 'border:1px solid #1e2232;border-radius:6px;padding:8px;margin-top:4px;margin-bottom:4px;background:#0c0e14;';

    container.appendChild(this.label('Expedition Name', `edit-exp-name-${action.id}`));
    const nameInput = document.createElement('input');
    nameInput.id = `edit-exp-name-${action.id}`;
    nameInput.type = 'text';
    nameInput.maxLength = 64;
    nameInput.placeholder = 'e.g. Forest Patrol';
    nameInput.value = (cfg as any).name ?? '';
    container.appendChild(nameInput);

    container.appendChild(this.label('Base Gold (1h)', `edit-base-gold-${action.id}`));
    const baseGoldInput = document.createElement('input');
    baseGoldInput.id = `edit-base-gold-${action.id}`;
    baseGoldInput.type = 'number';
    baseGoldInput.min = '0';
    baseGoldInput.value = String(cfg.base_gold);
    container.appendChild(baseGoldInput);

    container.appendChild(this.label('Base Exp (1h)', `edit-base-exp-${action.id}`));
    const baseExpInput = document.createElement('input');
    baseExpInput.id = `edit-base-exp-${action.id}`;
    baseExpInput.type = 'number';
    baseExpInput.min = '0';
    baseExpInput.value = String(cfg.base_exp);
    container.appendChild(baseExpInput);

    container.appendChild(this.label('Item Rewards', `edit-items-${action.id}`));
    const itemEntriesEl = document.createElement('div');
    itemEntriesEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:4px;';
    container.appendChild(itemEntriesEl);

    const expeditionItems: ExpeditionItemEntry[] = cfg.items.map((i) => ({ ...i }));

    const buildItemRow = (entry: ExpeditionItemEntry, initialName?: string): HTMLElement => {
      const entryRow = document.createElement('div');
      entryRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:2px;';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'item-select-trigger';

      const triggerIcon = document.createElement('div');
      triggerIcon.className = 'item-select-trigger-icon';

      const triggerName = document.createElement('span');
      triggerName.className = 'item-select-trigger-name';

      const updateTrigger = (item: ItemDefinitionResponse): void => {
        triggerIcon.innerHTML = '';
        if (item.icon_url) {
          const img = document.createElement('img');
          img.src = item.icon_url;
          img.alt = '';
          triggerIcon.appendChild(img);
        } else {
          triggerIcon.textContent = (item.name[0] ?? '?').toUpperCase();
        }
        triggerName.textContent = item.name;
        triggerName.classList.remove('item-select-trigger-name--placeholder');
      };

      if (initialName) {
        triggerIcon.textContent = initialName[0]?.toUpperCase() ?? '?';
        triggerName.textContent = initialName;
      } else {
        triggerIcon.textContent = '?';
        triggerName.textContent = `#${entry.item_def_id}`;
        triggerName.classList.add('item-select-trigger-name--placeholder');
      }

      trigger.appendChild(triggerIcon);
      trigger.appendChild(triggerName);

      trigger.addEventListener('click', () => {
        void openItemPicker((item) => {
          entry.item_def_id = item.id;
          updateTrigger(item);
        });
      });

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = String(entry.base_quantity);
      qtyInput.style.cssText = 'width:56px;flex-shrink:0;';
      qtyInput.title = 'Quantity';
      qtyInput.placeholder = 'Qty';
      qtyInput.addEventListener('input', () => {
        entry.base_quantity = parseInt(qtyInput.value, 10) || 1;
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--danger btn--small';
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        const idx = expeditionItems.indexOf(entry);
        if (idx !== -1) expeditionItems.splice(idx, 1);
        entryRow.remove();
      });

      entryRow.appendChild(trigger);
      entryRow.appendChild(qtyInput);
      entryRow.appendChild(removeBtn);
      return entryRow;
    };

    // Render existing items — resolve names async so they show properly
    for (const item of expeditionItems) {
      const row = buildItemRow(item);
      itemEntriesEl.appendChild(row);
      void resolveItemName(item.item_def_id).then((name) => {
        const nameEl = row.querySelector<HTMLElement>('.item-select-trigger-name');
        const iconEl = row.querySelector<HTMLElement>('.item-select-trigger-icon');
        if (nameEl) {
          nameEl.textContent = name;
          nameEl.classList.remove('item-select-trigger-name--placeholder');
        }
        if (iconEl) iconEl.textContent = name[0]?.toUpperCase() ?? '?';
      });
    }

    const addItemBtn = document.createElement('button');
    addItemBtn.className = 'btn btn--secondary';
    addItemBtn.type = 'button';
    addItemBtn.textContent = '+ Add Item';
    addItemBtn.style.cssText = 'width:100%;font-size:11px;margin-bottom:4px;';
    addItemBtn.addEventListener('click', () => {
      const entry: ExpeditionItemEntry = { item_def_id: 0, base_quantity: 1 };
      expeditionItems.push(entry);
      itemEntriesEl.appendChild(buildItemRow(entry));
    });
    container.appendChild(addItemBtn);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Save';
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      const baseGold = parseInt(baseGoldInput.value, 10);
      const baseExp = parseInt(baseExpInput.value, 10);
      if (isNaN(baseGold) || baseGold < 0) {
        alert('Base gold must be a non-negative integer.');
        saveBtn.disabled = false;
        return;
      }
      if (isNaN(baseExp) || baseExp < 0) {
        alert('Base exp must be a non-negative integer.');
        saveBtn.disabled = false;
        return;
      }
      if (expeditionItems.some((i) => i.item_def_id <= 0)) {
        alert('All item rows must have an item selected.');
        saveBtn.disabled = false;
        return;
      }
      try {
        const updated = await updateBuildingAction(mapId, buildingId, action.id, {
          config: { name: nameInput.value.trim() || undefined, base_gold: baseGold, base_exp: baseExp, items: expeditionItems } as ExpeditionActionConfig,
        });
        action.config = updated.config;
        const expName = nameInput.value.trim();
        labelEl.textContent = `${expName || 'Expedition'} (gold:${baseGold} exp:${baseExp} items:${expeditionItems.length})`;
        onClose();
      } catch (err) {
        alert(`Failed to save: ${(err as Error).message}`);
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

  private async buildAddActionForm(
    container: HTMLElement,
    actionsList: HTMLElement,
    buildingId: number,
    mapId: number,
    onClose: () => void,
  ): Promise<void> {
    container.innerHTML = '<em style="font-size:11px;color:#404666;">Loading...</em>';

    let maps: MapSummary[] = [];
    let monsters: MonsterResponse[] = [];
    try {
      [maps, monsters] = await Promise.all([listMaps(), listMonsters()]);
    } catch {
      container.innerHTML = '<em style="font-size:11px;color:#f87171;">Failed to load data.</em>';
      return;
    }

    container.innerHTML = '';
    container.style.cssText = 'border:1px solid #1e2232;border-radius:6px;padding:8px;margin-top:6px;background:#0c0e14;';

    // ── Action type selector ─────────────────────────────────────────
    const typeLabel = this.label('Action Type', 'action-type-select');
    container.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.id = 'action-type-select';
    const actionTypes: [string, string][] = [['travel', 'Travel'], ['explore', 'Explore'], ['expedition', 'Expedition'], ['gather', 'Gather'], ['marketplace', 'Marketplace'], ['fishing', 'Fishing']];
    for (const [val, text] of actionTypes) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      typeSelect.appendChild(opt);
    }
    container.appendChild(typeSelect);

    // ── Travel fields ────────────────────────────────────────────────
    const travelFields = document.createElement('div');
    travelFields.id = 'travel-fields';

    const mapLabel = this.label('Destination Map', 'action-map-select');
    travelFields.appendChild(mapLabel);

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
    travelFields.appendChild(mapSelect);

    const nodeLabel = this.label('Destination Node', 'action-node-select');
    travelFields.appendChild(nodeLabel);

    const nodeSelect = document.createElement('select');
    nodeSelect.id = 'action-node-select';
    nodeSelect.disabled = true;
    const nodeDefaultOpt = document.createElement('option');
    nodeDefaultOpt.value = '';
    nodeDefaultOpt.textContent = '— select node —';
    nodeSelect.appendChild(nodeDefaultOpt);
    travelFields.appendChild(nodeSelect);

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

    container.appendChild(travelFields);

    // ── Explore fields ───────────────────────────────────────────────
    const exploreFields = document.createElement('div');
    exploreFields.id = 'explore-fields';
    exploreFields.style.display = 'none';

    const chanceLabel = this.label('Encounter Chance (1–100%)', 'action-encounter-chance');
    exploreFields.appendChild(chanceLabel);

    const chanceInput = document.createElement('input');
    chanceInput.id = 'action-encounter-chance';
    chanceInput.type = 'number';
    chanceInput.min = '1';
    chanceInput.max = '100';
    chanceInput.value = '15';
    exploreFields.appendChild(chanceInput);

    const monstersLabel = this.label('Monster Table', 'explore-monsters-table');
    exploreFields.appendChild(monstersLabel);

    // Monster entries list
    const monsterEntriesEl = document.createElement('div');
    monsterEntriesEl.id = 'explore-monsters-table';
    monsterEntriesEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:4px;';
    exploreFields.appendChild(monsterEntriesEl);

    const monsterEntries: ExploreMonsterEntry[] = [];

    const buildMonsterRow = (entry: ExploreMonsterEntry): HTMLElement => {
      const entryRow = document.createElement('div');
      entryRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const mSel = document.createElement('select');
      mSel.style.flex = '1';
      monsters.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = String(m.id);
        opt.textContent = m.name;
        opt.selected = m.id === entry.monster_id;
        mSel.appendChild(opt);
      });
      mSel.addEventListener('change', () => {
        entry.monster_id = parseInt(mSel.value, 10);
      });

      const wInput = document.createElement('input');
      wInput.type = 'number';
      wInput.min = '1';
      wInput.value = String(entry.weight);
      wInput.style.width = '52px';
      wInput.title = 'Weight';
      wInput.placeholder = 'Wt';
      wInput.addEventListener('input', () => {
        entry.weight = parseInt(wInput.value, 10) || 1;
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--danger btn--small';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        const idx = monsterEntries.indexOf(entry);
        if (idx !== -1) monsterEntries.splice(idx, 1);
        entryRow.remove();
      });

      entryRow.appendChild(mSel);
      entryRow.appendChild(wInput);
      entryRow.appendChild(removeBtn);
      return entryRow;
    };

    const addMonsterBtn = document.createElement('button');
    addMonsterBtn.className = 'btn btn--secondary';
    addMonsterBtn.textContent = '+ Add Monster';
    addMonsterBtn.style.cssText = 'width:100%;font-size:11px;margin-bottom:4px;';
    addMonsterBtn.addEventListener('click', () => {
      if (monsters.length === 0) { alert('No monsters defined yet. Create monsters first.'); return; }
      const entry: ExploreMonsterEntry = { monster_id: monsters[0]!.id, weight: 1 };
      monsterEntries.push(entry);
      monsterEntriesEl.appendChild(buildMonsterRow(entry));
    });
    exploreFields.appendChild(addMonsterBtn);
    container.appendChild(exploreFields);

    // ── Expedition fields ────────────────────────────────────────────
    const expeditionFields = document.createElement('div');
    expeditionFields.id = 'expedition-fields';
    expeditionFields.style.display = 'none';

    expeditionFields.appendChild(this.label('Base Gold (1h)', 'action-base-gold'));
    const baseGoldInput = document.createElement('input');
    baseGoldInput.id = 'action-base-gold';
    baseGoldInput.type = 'number';
    baseGoldInput.min = '0';
    baseGoldInput.value = '10';
    expeditionFields.appendChild(baseGoldInput);

    expeditionFields.appendChild(this.label('Base Exp (1h)', 'action-base-exp'));
    const baseExpInput = document.createElement('input');
    baseExpInput.id = 'action-base-exp';
    baseExpInput.type = 'number';
    baseExpInput.min = '0';
    baseExpInput.value = '20';
    expeditionFields.appendChild(baseExpInput);

    const itemsLabel = this.label('Item Rewards', 'expedition-items-list');
    expeditionFields.appendChild(itemsLabel);

    const itemEntriesEl = document.createElement('div');
    itemEntriesEl.id = 'expedition-items-list';
    itemEntriesEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:4px;';
    expeditionFields.appendChild(itemEntriesEl);

    const expeditionItems: ExpeditionItemEntry[] = [];

    const buildItemRow = (entry: ExpeditionItemEntry, initialItem?: ItemDefinitionResponse): HTMLElement => {
      const entryRow = document.createElement('div');
      entryRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:2px;';

      // Item selector trigger
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'item-select-trigger';

      const triggerIcon = document.createElement('div');
      triggerIcon.className = 'item-select-trigger-icon';

      const triggerName = document.createElement('span');
      triggerName.className = 'item-select-trigger-name item-select-trigger-name--placeholder';

      const updateTrigger = (item: ItemDefinitionResponse): void => {
        triggerIcon.innerHTML = '';
        if (item.icon_url) {
          const img = document.createElement('img');
          img.src = item.icon_url;
          img.alt = '';
          triggerIcon.appendChild(img);
        } else {
          triggerIcon.textContent = (item.name[0] ?? '?').toUpperCase();
        }
        triggerName.textContent = item.name;
        triggerName.classList.remove('item-select-trigger-name--placeholder');
      };

      if (initialItem) {
        updateTrigger(initialItem);
      } else {
        triggerIcon.textContent = '?';
        triggerName.textContent = 'Select item…';
      }

      trigger.appendChild(triggerIcon);
      trigger.appendChild(triggerName);

      trigger.addEventListener('click', () => {
        void openItemPicker((item) => {
          entry.item_def_id = item.id;
          updateTrigger(item);
        });
      });

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = String(entry.base_quantity);
      qtyInput.style.cssText = 'width:56px;flex-shrink:0;';
      qtyInput.title = 'Quantity';
      qtyInput.placeholder = 'Qty';
      qtyInput.addEventListener('input', () => {
        entry.base_quantity = parseInt(qtyInput.value, 10) || 1;
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--danger btn--small';
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        const idx = expeditionItems.indexOf(entry);
        if (idx !== -1) expeditionItems.splice(idx, 1);
        entryRow.remove();
      });

      entryRow.appendChild(trigger);
      entryRow.appendChild(qtyInput);
      entryRow.appendChild(removeBtn);
      return entryRow;
    };

    const addItemBtn = document.createElement('button');
    addItemBtn.className = 'btn btn--secondary';
    addItemBtn.type = 'button';
    addItemBtn.textContent = '+ Add Item';
    addItemBtn.style.cssText = 'width:100%;font-size:11px;margin-bottom:4px;';
    addItemBtn.addEventListener('click', () => {
      const entry: ExpeditionItemEntry = { item_def_id: 0, base_quantity: 1 };
      expeditionItems.push(entry);
      itemEntriesEl.appendChild(buildItemRow(entry));
    });
    expeditionFields.appendChild(addItemBtn);
    container.appendChild(expeditionFields);

    // ── Gather fields ───────────────────────────────────────────────
    const gatherFields = document.createElement('div');
    gatherFields.id = 'gather-fields';
    gatherFields.style.display = 'none';

    gatherFields.appendChild(this.label('Required Tool Type', 'gather-tool-type'));
    const toolTypeSelect = document.createElement('select');
    toolTypeSelect.id = 'gather-tool-type';
    for (const [val, txt] of [['pickaxe', 'Pickaxe'], ['axe', 'Axe'], ['fishing_rod', 'Fishing Rod']] as const) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = txt;
      toolTypeSelect.appendChild(opt);
    }
    gatherFields.appendChild(toolTypeSelect);

    gatherFields.appendChild(this.label('Durability per Second', 'gather-dur-per-sec'));
    const durPerSecInput = document.createElement('input');
    durPerSecInput.id = 'gather-dur-per-sec';
    durPerSecInput.type = 'number';
    durPerSecInput.min = '1';
    durPerSecInput.value = '5';
    gatherFields.appendChild(durPerSecInput);

    const durRow = document.createElement('div');
    durRow.style.cssText = 'display:flex;gap:8px;';

    const minSecDiv = document.createElement('div');
    minSecDiv.style.flex = '1';
    minSecDiv.appendChild(this.label('Min Seconds', 'gather-min-sec'));
    const minSecInput = document.createElement('input');
    minSecInput.id = 'gather-min-sec';
    minSecInput.type = 'number';
    minSecInput.min = '1';
    minSecInput.value = '30';
    minSecDiv.appendChild(minSecInput);
    durRow.appendChild(minSecDiv);

    const maxSecDiv = document.createElement('div');
    maxSecDiv.style.flex = '1';
    maxSecDiv.appendChild(this.label('Max Seconds', 'gather-max-sec'));
    const maxSecInput = document.createElement('input');
    maxSecInput.id = 'gather-max-sec';
    maxSecInput.type = 'number';
    maxSecInput.min = '1';
    maxSecInput.value = '120';
    maxSecDiv.appendChild(maxSecInput);
    durRow.appendChild(maxSecDiv);

    gatherFields.appendChild(durRow);

    gatherFields.appendChild(this.label('Events', 'gather-events-list'));

    const gatherEventsEl = document.createElement('div');
    gatherEventsEl.id = 'gather-events-list';
    gatherEventsEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:4px;';
    gatherFields.appendChild(gatherEventsEl);

    interface GatherEventEntry {
      type: string;
      weight: number;
      item_def_id?: number;
      quantity?: number;
      min_amount?: number;
      max_amount?: number;
      monster_id?: number;
      hp_damage?: number;
      message?: string;
    }
    const gatherEvents: GatherEventEntry[] = [];

    const buildGatherEventRow = (entry: GatherEventEntry): HTMLElement => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px;background:#12141e;border:1px solid #1e2232;border-radius:4px;display:flex;flex-direction:column;gap:4px;';

      // Top line: type + weight + remove
      const topLine = document.createElement('div');
      topLine.style.cssText = 'display:flex;gap:4px;align-items:center;';

      const typeSel = document.createElement('select');
      typeSel.style.flex = '1';
      for (const t of ['nothing', 'resource', 'gold', 'monster', 'accident']) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        opt.selected = t === entry.type;
        typeSel.appendChild(opt);
      }

      const weightLabel = document.createElement('span');
      weightLabel.style.cssText = 'font-size:0.65rem;color:#606888;';
      weightLabel.textContent = 'Weight:';

      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.min = '1';
      weightInput.value = String(entry.weight);
      weightInput.style.width = '52px';
      weightInput.title = 'Relative probability weight (higher = more likely)';
      weightInput.addEventListener('input', () => { entry.weight = parseInt(weightInput.value, 10) || 1; });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn--danger btn--small';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        const idx = gatherEvents.indexOf(entry);
        if (idx !== -1) gatherEvents.splice(idx, 1);
        row.remove();
      });

      topLine.appendChild(typeSel);
      topLine.appendChild(weightLabel);
      topLine.appendChild(weightInput);
      topLine.appendChild(removeBtn);
      row.appendChild(topLine);

      // Extra fields container
      const extraFields = document.createElement('div');
      extraFields.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:2px;';

      const tinyLabel = (text: string): HTMLElement => {
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:0.65rem;color:#606888;text-transform:uppercase;letter-spacing:0.04em;';
        lbl.textContent = text;
        return lbl;
      };

      const renderExtra = () => {
        extraFields.innerHTML = '';
        const t = typeSel.value;
        entry.type = t;

        if (t === 'resource') {
          if (entry.quantity == null) entry.quantity = 1;
          // Item picker (same pattern as expedition items)
          const itemRow = document.createElement('div');
          itemRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

          const trigger = document.createElement('button');
          trigger.type = 'button';
          trigger.className = 'item-select-trigger';

          const triggerIcon = document.createElement('div');
          triggerIcon.className = 'item-select-trigger-icon';
          triggerIcon.textContent = '?';

          const triggerName = document.createElement('span');
          triggerName.className = 'item-select-trigger-name item-select-trigger-name--placeholder';
          triggerName.textContent = 'Select item\u2026';

          // If entry already has an item, resolve name
          if (entry.item_def_id) {
            void resolveItemName(entry.item_def_id).then((name) => {
              triggerName.textContent = name;
              triggerName.classList.remove('item-select-trigger-name--placeholder');
              triggerIcon.textContent = name[0]?.toUpperCase() ?? '?';
            });
          }

          trigger.appendChild(triggerIcon);
          trigger.appendChild(triggerName);
          trigger.addEventListener('click', () => {
            void openItemPicker((item) => {
              entry.item_def_id = item.id;
              triggerName.textContent = item.name;
              triggerName.classList.remove('item-select-trigger-name--placeholder');
              if (item.icon_url) {
                triggerIcon.innerHTML = '';
                const img = document.createElement('img');
                img.src = item.icon_url;
                img.alt = '';
                triggerIcon.appendChild(img);
              } else {
                triggerIcon.textContent = (item.name[0] ?? '?').toUpperCase();
              }
            });
          });
          itemRow.appendChild(trigger);
          extraFields.appendChild(itemRow);

          // Quantity
          const qtyRow = document.createElement('div');
          qtyRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
          qtyRow.appendChild(tinyLabel('Quantity'));
          const qtyInput = document.createElement('input');
          qtyInput.type = 'number';
          qtyInput.min = '1';
          qtyInput.value = entry.quantity ? String(entry.quantity) : '1';
          qtyInput.style.width = '60px';
          qtyInput.addEventListener('input', () => { entry.quantity = parseInt(qtyInput.value, 10) || 1; });
          qtyRow.appendChild(qtyInput);
          extraFields.appendChild(qtyRow);

          // Message
          const msgInput = document.createElement('input');
          msgInput.type = 'text';
          msgInput.placeholder = 'Message shown to player (e.g. "You found iron ore!")';
          msgInput.value = entry.message ?? '';
          msgInput.style.width = '100%';
          msgInput.addEventListener('input', () => { entry.message = msgInput.value || undefined; });
          extraFields.appendChild(msgInput);

        } else if (t === 'gold') {
          // Initialize defaults if not set
          if (entry.min_amount == null) entry.min_amount = 1;
          if (entry.max_amount == null) entry.max_amount = 10;

          const goldRow = document.createElement('div');
          goldRow.style.cssText = 'display:flex;align-items:center;gap:6px;';

          goldRow.appendChild(tinyLabel('Min crowns'));
          const minInput = document.createElement('input');
          minInput.type = 'number';
          minInput.min = '0';
          minInput.value = String(entry.min_amount);
          minInput.style.width = '60px';
          minInput.addEventListener('input', () => { entry.min_amount = parseInt(minInput.value, 10) || 0; });
          goldRow.appendChild(minInput);

          goldRow.appendChild(tinyLabel('Max crowns'));
          const maxInput = document.createElement('input');
          maxInput.type = 'number';
          maxInput.min = '0';
          maxInput.value = String(entry.max_amount);
          maxInput.style.width = '60px';
          maxInput.addEventListener('input', () => { entry.max_amount = parseInt(maxInput.value, 10) || 0; });
          goldRow.appendChild(maxInput);

          extraFields.appendChild(goldRow);

          const msgInput = document.createElement('input');
          msgInput.type = 'text';
          msgInput.placeholder = 'Message shown to player (e.g. "You found a gold vein!")';
          msgInput.value = entry.message ?? '';
          msgInput.style.width = '100%';
          msgInput.addEventListener('input', () => { entry.message = msgInput.value || undefined; });
          extraFields.appendChild(msgInput);

        } else if (t === 'monster') {
          const monsterRow = document.createElement('div');
          monsterRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
          monsterRow.appendChild(tinyLabel('Monster'));
          const mSel = document.createElement('select');
          mSel.style.flex = '1';
          if (monsters.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No monsters defined';
            mSel.appendChild(opt);
          } else {
            for (const m of monsters) {
              const opt = document.createElement('option');
              opt.value = String(m.id);
              opt.textContent = m.name;
              opt.selected = m.id === entry.monster_id;
              mSel.appendChild(opt);
            }
            if (!entry.monster_id && monsters.length > 0) entry.monster_id = monsters[0]!.id;
          }
          mSel.addEventListener('change', () => { entry.monster_id = parseInt(mSel.value, 10) || undefined; });
          monsterRow.appendChild(mSel);
          extraFields.appendChild(monsterRow);

        } else if (t === 'accident') {
          if (entry.hp_damage == null) entry.hp_damage = 5;

          const accRow = document.createElement('div');
          accRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
          accRow.appendChild(tinyLabel('HP damage'));
          const dmgInput = document.createElement('input');
          dmgInput.type = 'number';
          dmgInput.min = '1';
          dmgInput.value = entry.hp_damage ? String(entry.hp_damage) : '5';
          dmgInput.style.width = '60px';
          dmgInput.addEventListener('input', () => { entry.hp_damage = parseInt(dmgInput.value, 10) || 1; });
          accRow.appendChild(dmgInput);
          extraFields.appendChild(accRow);

          const msgInput = document.createElement('input');
          msgInput.type = 'text';
          msgInput.placeholder = 'Message shown to player (e.g. "A rock falls on your head!")';
          msgInput.value = entry.message ?? '';
          msgInput.style.width = '100%';
          msgInput.addEventListener('input', () => { entry.message = msgInput.value || undefined; });
          extraFields.appendChild(msgInput);
        }
        // 'nothing' has no extra fields
      };

      typeSel.addEventListener('change', renderExtra);
      renderExtra();

      row.appendChild(extraFields);
      return row;
    };

    const addEventBtn = document.createElement('button');
    addEventBtn.className = 'btn btn--secondary';
    addEventBtn.type = 'button';
    addEventBtn.textContent = '+ Add Event';
    addEventBtn.style.cssText = 'width:100%;font-size:11px;margin-bottom:4px;';
    addEventBtn.addEventListener('click', () => {
      const entry: GatherEventEntry = { type: 'nothing', weight: 10 };
      gatherEvents.push(entry);
      gatherEventsEl.appendChild(buildGatherEventRow(entry));
    });
    gatherFields.appendChild(addEventBtn);
    container.appendChild(gatherFields);

    // ── Marketplace fields ───────────────────────────────────────────
    const marketplaceFields = document.createElement('div');
    marketplaceFields.id = 'marketplace-fields';
    marketplaceFields.style.display = 'none';

    const feeLabel = this.label('Listing Fee (crowns)', 'mkt-fee');
    marketplaceFields.appendChild(feeLabel);
    const feeInput = document.createElement('input');
    feeInput.id = 'mkt-fee';
    feeInput.type = 'number';
    feeInput.min = '0';
    feeInput.value = '10';
    feeInput.style.width = '80px';
    marketplaceFields.appendChild(feeInput);

    const maxListLabel = this.label('Max Listings per Player', 'mkt-max-listings');
    marketplaceFields.appendChild(maxListLabel);
    const maxListInput = document.createElement('input');
    maxListInput.id = 'mkt-max-listings';
    maxListInput.type = 'number';
    maxListInput.min = '1';
    maxListInput.value = '10';
    maxListInput.style.width = '80px';
    marketplaceFields.appendChild(maxListInput);

    const durLabel = this.label('Listing Duration (days)', 'mkt-duration');
    marketplaceFields.appendChild(durLabel);
    const durInput = document.createElement('input');
    durInput.id = 'mkt-duration';
    durInput.type = 'number';
    durInput.min = '1';
    durInput.value = '5';
    durInput.style.width = '80px';
    marketplaceFields.appendChild(durInput);

    container.appendChild(marketplaceFields);

    // ── Fishing fields ────────────────────────────────────────────────
    const fishingFields = document.createElement('div');
    fishingFields.id = 'fishing-fields';
    fishingFields.style.display = 'none';

    fishingFields.appendChild(this.label('Min Rod Tier (optional)', 'fishing-min-tier'));
    const fishingTierInput = document.createElement('input');
    fishingTierInput.id = 'fishing-min-tier';
    fishingTierInput.type = 'number';
    fishingTierInput.min = '1';
    fishingTierInput.max = '5';
    fishingTierInput.value = '1';
    fishingTierInput.placeholder = '1 (any rod)';
    fishingFields.appendChild(fishingTierInput);

    container.appendChild(fishingFields);

    // ── Show/hide on type change ─────────────────────────────────────
    typeSelect.addEventListener('change', () => {
      travelFields.style.display = typeSelect.value === 'travel' ? '' : 'none';
      exploreFields.style.display = typeSelect.value === 'explore' ? '' : 'none';
      expeditionFields.style.display = typeSelect.value === 'expedition' ? '' : 'none';
      gatherFields.style.display = typeSelect.value === 'gather' ? '' : 'none';
      marketplaceFields.style.display = typeSelect.value === 'marketplace' ? '' : 'none';
      fishingFields.style.display = typeSelect.value === 'fishing' ? '' : 'none';
    });

    // ── Buttons ──────────────────────────────────────────────────────
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Save';
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        if (typeSelect.value === 'travel') {
          const targetZoneId = parseInt(mapSelect.value, 10);
          const targetNodeId = parseInt(nodeSelect.value, 10);
          if (isNaN(targetZoneId) || isNaN(targetNodeId)) {
            alert('Please select both a destination map and node.');
            saveBtn.disabled = false;
            return;
          }
          await createBuildingAction(mapId, buildingId, {
            action_type: 'travel',
            config: { target_zone_id: targetZoneId, target_node_id: targetNodeId },
          });
        } else if (typeSelect.value === 'explore') {
          const encounterChance = parseInt(chanceInput.value, 10);
          if (isNaN(encounterChance) || encounterChance < 1 || encounterChance > 100) {
            alert('Encounter chance must be between 1 and 100.');
            saveBtn.disabled = false;
            return;
          }
          if (monsterEntries.length === 0) {
            alert('Add at least one monster to the table.');
            saveBtn.disabled = false;
            return;
          }
          await createBuildingAction(mapId, buildingId, {
            action_type: 'explore',
            config: { encounter_chance: encounterChance, monsters: monsterEntries } as ExploreActionConfig,
          });
        } else if (typeSelect.value === 'gather') {
          const reqToolType = toolTypeSelect.value;
          const durPerSec = parseInt(durPerSecInput.value, 10);
          const minSec = parseInt(minSecInput.value, 10);
          const maxSec = parseInt(maxSecInput.value, 10);
          if (!reqToolType) { alert('Select a tool type.'); saveBtn.disabled = false; return; }
          if (isNaN(durPerSec) || durPerSec < 1) { alert('Durability per second must be a positive integer.'); saveBtn.disabled = false; return; }
          if (isNaN(minSec) || minSec < 1) { alert('Min seconds must be a positive integer.'); saveBtn.disabled = false; return; }
          if (isNaN(maxSec) || maxSec < minSec) { alert('Max seconds must be >= min seconds.'); saveBtn.disabled = false; return; }
          if (gatherEvents.length === 0) { alert('Add at least one event.'); saveBtn.disabled = false; return; }
          for (const ev of gatherEvents) {
            if (ev.type === 'resource' && (!ev.item_def_id || ev.item_def_id < 1)) { alert('Resource events need a valid Item Def ID.'); saveBtn.disabled = false; return; }
            if (ev.type === 'monster' && (!ev.monster_id || ev.monster_id < 1)) { alert('Monster events need a selected monster.'); saveBtn.disabled = false; return; }
            if (ev.type === 'accident' && (!ev.hp_damage || ev.hp_damage < 1)) { alert('Accident events need HP damage > 0.'); saveBtn.disabled = false; return; }
            if (ev.type === 'gold' && (ev.min_amount == null || ev.max_amount == null)) { alert('Gold events need min and max amounts.'); saveBtn.disabled = false; return; }
          }
          await createBuildingAction(mapId, buildingId, {
            action_type: 'gather' as const,
            config: {
              required_tool_type: reqToolType,
              durability_per_second: durPerSec,
              min_seconds: minSec,
              max_seconds: maxSec,
              events: gatherEvents,
            },
          });
        } else if (typeSelect.value === 'marketplace') {
          const listingFee = parseInt(feeInput.value, 10);
          const maxListings = parseInt(maxListInput.value, 10);
          const durationDays = parseInt(durInput.value, 10);
          if (isNaN(listingFee) || listingFee < 0) { alert('Listing fee must be a non-negative integer.'); saveBtn.disabled = false; return; }
          if (isNaN(maxListings) || maxListings < 1) { alert('Max listings must be a positive integer.'); saveBtn.disabled = false; return; }
          if (isNaN(durationDays) || durationDays < 1) { alert('Duration must be a positive integer.'); saveBtn.disabled = false; return; }
          await createBuildingAction(mapId, buildingId, {
            action_type: 'marketplace',
            config: { listing_fee: listingFee, max_listings: maxListings, listing_duration_days: durationDays },
          });
        } else if (typeSelect.value === 'fishing') {
          const minTier = parseInt(fishingTierInput.value, 10);
          const config: Record<string, unknown> = {};
          if (!isNaN(minTier) && minTier >= 1 && minTier <= 5) {
            config.min_rod_tier = minTier;
          }
          await createBuildingAction(mapId, buildingId, {
            action_type: 'fishing',
            config,
          });
        } else {
          const baseGold = parseInt(baseGoldInput.value, 10);
          const baseExp = parseInt(baseExpInput.value, 10);
          if (isNaN(baseGold) || baseGold < 0) {
            alert('Base gold must be a non-negative integer.');
            saveBtn.disabled = false;
            return;
          }
          if (isNaN(baseExp) || baseExp < 0) {
            alert('Base exp must be a non-negative integer.');
            saveBtn.disabled = false;
            return;
          }
          if (expeditionItems.some((i) => i.item_def_id <= 0)) {
            alert('All item rows must have an item selected.');
            saveBtn.disabled = false;
            return;
          }
          await createBuildingAction(mapId, buildingId, {
            action_type: 'expedition',
            config: { base_gold: baseGold, base_exp: baseExp, items: expeditionItems } as ExpeditionActionConfig,
          });
        }
        await this.renderActions(actionsList, buildingId, mapId);
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

  private async renderNpcsSection(
    listEl: HTMLElement,
    npcSelect: HTMLSelectElement,
    assignBtn: HTMLButtonElement,
    buildingId: number,
    mapId: number,
  ): Promise<void> {
    listEl.innerHTML = '<em style="font-size:11px;color:#404666;">Loading...</em>';

    let allNpcs: NpcResponse[] = [];
    let assignedNpcs: BuildingNpcEntry[] = [];

    try {
      [allNpcs, assignedNpcs] = await Promise.all([
        listNpcs(),
        listBuildingNpcs(mapId, buildingId),
      ]);
    } catch {
      listEl.innerHTML = '<em style="font-size:11px;color:#f87171;">Failed to load NPCs.</em>';
      return;
    }

    // Populate dropdown with all NPCs (assigned ones are still selectable to re-add — server will 409)
    npcSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— select NPC —';
    npcSelect.appendChild(defaultOpt);
    for (const n of allNpcs) {
      const opt = document.createElement('option');
      opt.value = String(n.id);
      opt.textContent = n.name;
      npcSelect.appendChild(opt);
    }

    // Render assigned list
    listEl.innerHTML = '';
    if (assignedNpcs.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'font-size:11px;color:#3a4060;font-style:italic;margin:0;';
      empty.textContent = 'No NPCs assigned.';
      listEl.appendChild(empty);
    } else {
      for (const n of assignedNpcs) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;';

        const icon = document.createElement('img');
        icon.src = n.icon_url;
        icon.alt = '';
        icon.style.cssText = 'width:20px;height:20px;object-fit:contain;image-rendering:pixelated;border-radius:3px;';

        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'flex:1;font-size:11px;color:#8a94b0;';
        nameEl.textContent = n.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn--danger btn--small';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', async () => {
          try {
            await removeNpcFromBuilding(mapId, buildingId, n.npc_id);
            row.remove();
            if (listEl.children.length === 0) {
              const empty = document.createElement('p');
              empty.style.cssText = 'font-size:11px;color:#3a4060;font-style:italic;margin:0;';
              empty.textContent = 'No NPCs assigned.';
              listEl.appendChild(empty);
            }
          } catch (err) {
            alert(`Failed to remove NPC: ${(err as Error).message}`);
          }
        });

        row.appendChild(icon);
        row.appendChild(nameEl);
        row.appendChild(removeBtn);
        listEl.appendChild(row);
      }
    }

    // Assign button handler
    assignBtn.onclick = async () => {
      const npcId = parseInt(npcSelect.value, 10);
      if (isNaN(npcId) || npcId <= 0) { alert('Please select an NPC.'); return; }
      try {
        await assignNpcToBuilding(mapId, buildingId, npcId);
        // Reload the section to show updated state
        await this.renderNpcsSection(listEl, npcSelect, assignBtn, buildingId, mapId);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('ALREADY_ASSIGNED')) {
          alert('This NPC is already assigned to this building.');
        } else {
          alert(`Failed to assign NPC: ${msg}`);
        }
      }
    };
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
