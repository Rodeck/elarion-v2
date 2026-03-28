import {
  listBosses,
  getBoss,
  createBossApi,
  updateBossApi,
  deleteBossApi,
  addBossAbilityApi,
  removeBossAbilityApi,
  addBossLootApi,
  removeBossLootApi,
  listBossInstances,
  forceRespawnBoss,
  uploadBossIcon,
  uploadBossSprite,
  listBossBuildings,
  listAbilities,
  getItems,
  type BossResponse,
  type BossAbilityEntry,
  type BossLootEntry,
  type BossInstanceEntry,
  type BuildingSummary,
  type AbilityResponse,
  type ItemDefinitionResponse,
} from '../editor/api';

export class BossManager {
  private container!: HTMLElement;
  private bosses: BossResponse[] = [];
  private buildings: BuildingSummary[] = [];
  private abilities: AbilityResponse[] = [];
  private items: ItemDefinitionResponse[] = [];
  private instances: BossInstanceEntry[] = [];
  private expandedBossId: number | null = null;
  private detailTab: 'abilities' | 'loot' = 'abilities';

  init(container: HTMLElement): void {
    this.container = container;
  }

  async load(): Promise<void> {
    try {
      [this.bosses, this.buildings, this.abilities, this.items, this.instances] = await Promise.all([
        listBosses(),
        listBossBuildings(),
        listAbilities(),
        getItems(),
        listBossInstances(),
      ]);
      this.renderAll();
    } catch (err) {
      this.container.innerHTML = `<p class="error">Failed to load: ${this.esc((err as Error).message)}</p>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main layout
  // ═══════════════════════════════════════════════════════════════════════════

  private renderAll(): void {
    this.container.innerHTML = '';
    this.container.style.padding = '1.5rem';

    // ── Row 1: Boss definitions ──────────────────────────────────────────
    const defsSection = this.el('div', { style: 'margin-bottom:1.5rem;' });
    const defsHeader = this.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;' });
    defsHeader.appendChild(this.el('h2', { style: 'margin:0;font-size:1.1rem;' }, 'Boss Definitions'));
    const addBtn = this.el('button', { class: 'btn btn--primary', style: 'font-size:0.8rem;' }, '+ Add Boss');
    addBtn.addEventListener('click', () => this.openFormModal(null));
    defsHeader.appendChild(addBtn);
    defsSection.appendChild(defsHeader);
    defsSection.appendChild(this.renderBossTable());
    this.container.appendChild(defsSection);

    // ── Row 2: Live instances ────────────────────────────────────────────
    const instSection = this.el('div');
    const instHeader = this.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;' });
    instHeader.appendChild(this.el('h2', { style: 'margin:0;font-size:1.1rem;' }, 'Live Instances'));
    const refreshBtn = this.el('button', { class: 'btn btn--secondary', style: 'font-size:0.8rem;' }, 'Refresh');
    refreshBtn.addEventListener('click', () => void this.refreshInstances());
    instHeader.appendChild(refreshBtn);
    instSection.appendChild(instHeader);
    instSection.appendChild(this.renderInstancesTable());
    this.container.appendChild(instSection);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Boss definitions table
  // ═══════════════════════════════════════════════════════════════════════════

  private renderBossTable(): HTMLElement {
    if (this.bosses.length === 0) {
      return this.el('p', { style: 'color:#3d4262;font-size:0.85rem;' }, 'No bosses yet. Click "+ Add Boss" to create one.');
    }

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.style.cssText = 'width:100%;font-size:0.8rem;border-collapse:collapse;';
    table.innerHTML = `<thead><tr style="background:#151828;text-align:left;">
      <th style="width:40px;padding:8px 6px;"></th>
      <th style="padding:8px 6px;">Name</th>
      <th style="padding:8px 6px;">HP</th>
      <th style="padding:8px 6px;">ATK</th>
      <th style="padding:8px 6px;">DEF</th>
      <th style="padding:8px 6px;">Building</th>
      <th style="padding:8px 6px;">Active</th>
      <th style="width:170px;padding:8px 6px;">Actions</th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    for (const b of this.bosses) {
      // Main row
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom:1px solid #1a1e2e;';
      const P = 'padding:6px 6px;';
      row.innerHTML = `
        <td style="${P}">${b.icon_url ? `<img src="${b.icon_url}" style="width:32px;height:32px;object-fit:contain;border-radius:3px;image-rendering:pixelated;border:1px solid #2a2e44;" />` : '<div style="width:32px;height:32px;background:#1a1e2e;border-radius:3px;"></div>'}</td>
        <td style="${P}"><strong>${this.esc(b.name)}</strong></td>
        <td style="${P}">${b.max_hp}</td>
        <td style="${P}">${b.attack}</td>
        <td style="${P}">${b.defense}</td>
        <td style="${P}">${b.building_name ? this.esc(b.building_name) : '—'}</td>
        <td style="${P}">${b.is_active ? '<span style="color:#4ade80">Yes</span>' : '<span style="color:#f87171">No</span>'}</td>
        <td style="${P}white-space:nowrap;"></td>`;

      const actionsCell = row.querySelector('td:last-child')!;
      const editBtn = this.el('button', { class: 'btn btn--sm btn--edit', style: 'margin-right:4px;' }, 'Edit');
      editBtn.addEventListener('click', async () => {
        // Fetch fresh data to ensure icon_url/sprite_url are current
        try { const fresh = await getBoss(b.id); this.openFormModal(fresh); } catch { this.openFormModal(b); }
      });
      const detailBtn = this.el('button', { class: 'btn btn--sm', style: 'margin-right:4px;' }, 'Details');
      detailBtn.addEventListener('click', () => void this.toggleDetail(b.id, detailRow));
      const delBtn = this.el('button', { class: 'btn btn--sm btn--danger' }, 'Del');
      delBtn.addEventListener('click', () => void this.handleDelete(b.id));
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(detailBtn);
      actionsCell.appendChild(delBtn);
      tbody.appendChild(row);

      // Detail row (hidden by default)
      const detailRow = document.createElement('tr');
      detailRow.style.display = 'none';
      detailRow.innerHTML = `<td colspan="8"><div class="boss-detail-panel" style="padding:0.75rem 0;"></div></td>`;
      tbody.appendChild(detailRow);
    }
    table.appendChild(tbody);
    return table;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Instances table
  // ═══════════════════════════════════════════════════════════════════════════

  private renderInstancesTable(): HTMLElement {
    const wrap = this.el('div', { id: 'bm-instances-wrap' });
    if (this.instances.length === 0) {
      wrap.appendChild(this.el('p', { style: 'color:#3d4262;font-size:0.85rem;' }, 'No live instances.'));
      return wrap;
    }

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.style.cssText = 'width:100%;font-size:0.8rem;border-collapse:collapse;';
    table.innerHTML = `<thead><tr style="background:#151828;text-align:left;">
      <th style="padding:8px 6px;">Boss</th><th style="padding:8px 6px;">HP</th><th style="padding:8px 6px;">Status</th><th style="padding:8px 6px;">Fighter</th><th style="padding:8px 6px;">Attempts</th><th style="padding:8px 6px;">Respawn</th><th style="padding:8px 6px;"></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const inst of this.instances) {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid #1a1e2e;';
      const P = 'padding:6px 6px;';
      const pct = inst.max_hp > 0 ? Math.round(inst.current_hp / inst.max_hp * 100) : 0;
      const statusColor = inst.status === 'alive' ? '#4ade80' : inst.status === 'in_combat' ? '#facc15' : '#f87171';
      const respawnText = inst.respawn_at ? new Date(inst.respawn_at).toLocaleString() : '—';
      tr.innerHTML = `
        <td style="${P}">${this.esc(inst.boss_name)}</td>
        <td style="${P}">${inst.current_hp}/${inst.max_hp} (${pct}%)</td>
        <td style="${P}color:${statusColor}">${inst.status}</td>
        <td style="${P}">${inst.fighting_character_name ? this.esc(inst.fighting_character_name) : '—'}</td>
        <td style="${P}">${inst.total_attempts}</td>
        <td style="${P}font-size:0.7rem;">${respawnText}</td>
        <td style="${P}"></td>`;
      const respawnBtn = this.el('button', { class: 'btn btn--sm', style: 'font-size:0.65rem;' }, 'Respawn');
      respawnBtn.addEventListener('click', () => void this.handleForceRespawn(inst.boss_id));
      tr.querySelector('td:last-child')!.appendChild(respawnBtn);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  private async refreshInstances(): Promise<void> {
    try {
      this.instances = await listBossInstances();
      this.renderAll();
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`);
    }
  }

  private async handleForceRespawn(bossId: number): Promise<void> {
    if (!confirm('Force respawn this boss?')) return;
    try {
      await forceRespawnBoss(bossId);
      await this.refreshInstances();
    } catch (err) {
      alert(`Respawn failed: ${(err as Error).message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Create/Edit modal
  // ═══════════════════════════════════════════════════════════════════════════

  private openFormModal(boss: BossResponse | null): void {
    const isEdit = boss !== null;
    const backdrop = this.el('div', {
      style: 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;',
    });

    const modal = this.el('div', {
      style: 'background:#0e1020;border:1px solid #2a2e44;border-radius:6px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:1.5rem;',
    });

    const title = this.el('h3', { style: 'margin:0 0 1rem;font-size:1rem;' }, isEdit ? `Edit: ${boss!.name}` : 'Add New Boss');
    modal.appendChild(title);

    const errEl = this.el('p', { class: 'error', style: 'display:none;margin-bottom:0.75rem;' });
    modal.appendChild(errEl);

    // Icon/Sprite preview (edit mode)
    if (isEdit) {
      const previewRow = this.el('div', { style: 'display:flex;gap:1rem;margin-bottom:1rem;' });
      const iconPreview = this.el('div', { style: 'text-align:center;' });
      iconPreview.innerHTML = `<div style="font-size:0.65rem;color:#5a6280;margin-bottom:4px;">Icon</div>`;
      if (boss!.icon_url) {
        iconPreview.innerHTML += `<img src="${boss!.icon_url}" style="width:48px;height:48px;object-fit:contain;border-radius:4px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
      } else {
        iconPreview.innerHTML += `<div style="width:48px;height:48px;background:#1a1e2e;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#3d4262;font-size:0.7rem;">None</div>`;
      }
      previewRow.appendChild(iconPreview);
      const spritePreview = this.el('div', { style: 'text-align:center;' });
      spritePreview.innerHTML = `<div style="font-size:0.65rem;color:#5a6280;margin-bottom:4px;">Sprite</div>`;
      if (boss!.sprite_url) {
        spritePreview.innerHTML += `<img src="${boss!.sprite_url}" style="width:48px;height:48px;object-fit:contain;border-radius:4px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
      } else {
        spritePreview.innerHTML += `<div style="width:48px;height:48px;background:#1a1e2e;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#3d4262;font-size:0.7rem;">None</div>`;
      }
      previewRow.appendChild(spritePreview);
      modal.appendChild(previewRow);
    }

    // Form fields
    const form = this.el('div');
    form.innerHTML = `
      <label style="font-size:0.75rem;">Name *</label>
      <input id="bmf-name" type="text" maxlength="128" value="${this.esc(boss?.name ?? '')}" style="width:100%;margin-bottom:0.5rem;" />
      <label style="font-size:0.75rem;">Description</label>
      <textarea id="bmf-desc" rows="2" style="width:100%;resize:vertical;margin-bottom:0.5rem;">${this.esc(boss?.description ?? '')}</textarea>
      <div style="font-size:0.7rem;color:#5a6280;margin-bottom:4px;">Stats (min–max range, randomized per instance)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
        <div><label style="font-size:0.7rem;">Min HP *</label><input id="bmf-min-hp" type="number" min="1" value="${(boss as any)?.min_hp ?? boss?.max_hp ?? 400}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Min ATK</label><input id="bmf-min-atk" type="number" min="0" value="${(boss as any)?.min_attack ?? boss?.attack ?? 40}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Min DEF</label><input id="bmf-min-def" type="number" min="0" value="${(boss as any)?.min_defense ?? boss?.defense ?? 15}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Max HP *</label><input id="bmf-hp" type="number" min="1" value="${boss?.max_hp ?? 500}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Max ATK *</label><input id="bmf-atk" type="number" min="1" value="${boss?.attack ?? 50}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Max DEF</label><input id="bmf-def" type="number" min="0" value="${boss?.defense ?? 20}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">XP Reward</label><input id="bmf-xp" type="number" min="0" value="${boss?.xp_reward ?? 100}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Min Crowns</label><input id="bmf-min-c" type="number" min="0" value="${boss?.min_crowns ?? 0}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Max Crowns</label><input id="bmf-max-c" type="number" min="0" value="${boss?.max_crowns ?? 0}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Respawn Min (s)</label><input id="bmf-rmin" type="number" min="0" value="${boss?.respawn_min_seconds ?? 3600}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Respawn Max (s)</label><input id="bmf-rmax" type="number" min="0" value="${boss?.respawn_max_seconds ?? 7200}" style="width:100%;" /></div>
      </div>
      <label style="font-size:0.75rem;">Building</label>
      <select id="bmf-building" style="width:100%;margin-bottom:0.5rem;">
        <option value="">— none —</option>
        ${this.buildings.map(b => `<option value="${b.id}" ${boss?.building_id === b.id ? 'selected' : ''}>${this.esc(b.name)} (zone ${b.zone_id})</option>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.75rem;">
        <input id="bmf-active" type="checkbox" ${(!boss || boss.is_active) ? 'checked' : ''} /> Active
      </label>
      ${isEdit ? `
      <div style="display:flex;gap:1rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #1a1e2e;">
        <div><label style="font-size:0.65rem;color:#5a6280;">Upload Icon (PNG)</label><input type="file" accept="image/png" id="bmf-icon-file" style="font-size:0.7rem;" /></div>
        <div><label style="font-size:0.65rem;color:#5a6280;">Upload Sprite (PNG)</label><input type="file" accept="image/png" id="bmf-sprite-file" style="font-size:0.7rem;" /></div>
      </div>` : ''}
    `;
    modal.appendChild(form);

    // Buttons
    const actions = this.el('div', { style: 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;' });
    const cancelBtn = this.el('button', { class: 'btn' }, 'Cancel');
    cancelBtn.addEventListener('click', () => backdrop.remove());
    const saveBtn = this.el('button', { class: 'btn btn--primary' }, isEdit ? 'Save Changes' : 'Create Boss');
    saveBtn.addEventListener('click', async () => {
      const name = (modal.querySelector<HTMLInputElement>('#bmf-name')!.value ?? '').trim();
      if (!name) { errEl.textContent = 'Name required.'; errEl.style.display = ''; return; }
      const maxHp = parseInt(modal.querySelector<HTMLInputElement>('#bmf-hp')!.value, 10) || 500;
      const maxAtk = parseInt(modal.querySelector<HTMLInputElement>('#bmf-atk')!.value, 10) || 50;
      const maxDef = parseInt(modal.querySelector<HTMLInputElement>('#bmf-def')!.value, 10) || 20;
      const data: Record<string, unknown> = {
        name,
        description: (modal.querySelector<HTMLTextAreaElement>('#bmf-desc')!.value ?? '').trim() || null,
        max_hp: maxHp,
        min_hp: parseInt(modal.querySelector<HTMLInputElement>('#bmf-min-hp')!.value, 10) || maxHp,
        attack: maxAtk,
        min_attack: parseInt(modal.querySelector<HTMLInputElement>('#bmf-min-atk')!.value, 10) || maxAtk,
        defense: maxDef,
        min_defense: parseInt(modal.querySelector<HTMLInputElement>('#bmf-min-def')!.value, 10) || maxDef,
        xp_reward: parseInt(modal.querySelector<HTMLInputElement>('#bmf-xp')!.value, 10) || 0,
        min_crowns: parseInt(modal.querySelector<HTMLInputElement>('#bmf-min-c')!.value, 10) || 0,
        max_crowns: parseInt(modal.querySelector<HTMLInputElement>('#bmf-max-c')!.value, 10) || 0,
        respawn_min_seconds: parseInt(modal.querySelector<HTMLInputElement>('#bmf-rmin')!.value, 10) || 3600,
        respawn_max_seconds: parseInt(modal.querySelector<HTMLInputElement>('#bmf-rmax')!.value, 10) || 7200,
        building_id: modal.querySelector<HTMLSelectElement>('#bmf-building')!.value ? parseInt(modal.querySelector<HTMLSelectElement>('#bmf-building')!.value, 10) : null,
        is_active: modal.querySelector<HTMLInputElement>('#bmf-active')!.checked,
      };
      saveBtn.disabled = true;
      try {
        if (isEdit) {
          // Upload files if selected
          const iconFile = modal.querySelector<HTMLInputElement>('#bmf-icon-file')?.files?.[0];
          const spriteFile = modal.querySelector<HTMLInputElement>('#bmf-sprite-file')?.files?.[0];
          if (iconFile) await uploadBossIcon(boss!.id, iconFile);
          if (spriteFile) await uploadBossSprite(boss!.id, spriteFile);
          await updateBossApi(boss!.id, data);
        } else {
          await createBossApi(data as Parameters<typeof createBossApi>[0]);
        }
        backdrop.remove();
        await this.load();
      } catch (err) {
        errEl.textContent = (err as Error).message;
        errEl.style.display = '';
        saveBtn.disabled = false;
      }
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Detail panel (tabbed: Abilities / Loot)
  // ═══════════════════════════════════════════════════════════════════════════

  private async toggleDetail(bossId: number, detailRow: HTMLTableRowElement): Promise<void> {
    if (this.expandedBossId === bossId) {
      detailRow.style.display = 'none';
      this.expandedBossId = null;
      return;
    }

    // Collapse previous
    if (this.expandedBossId !== null) {
      const prev = this.container.querySelector<HTMLElement>(`[data-boss-detail="${this.expandedBossId}"]`);
      if (prev) prev.closest('tr')!.style.display = 'none';
    }

    this.expandedBossId = bossId;
    this.detailTab = 'abilities';
    detailRow.style.display = '';
    const panel = detailRow.querySelector<HTMLElement>('.boss-detail-panel')!;
    panel.innerHTML = '<p style="color:#3d4262;font-size:0.8rem;">Loading...</p>';

    try {
      const boss = await getBoss(bossId);
      this.renderDetailPanel(panel, boss);
    } catch (err) {
      panel.innerHTML = `<p class="error">${this.esc((err as Error).message)}</p>`;
    }
  }

  private renderDetailPanel(panel: HTMLElement, boss: BossResponse): void {
    panel.innerHTML = '';
    panel.setAttribute('data-boss-detail', String(boss.id));

    // Upload section at top
    const uploadRow = this.el('div', { style: 'display:flex;gap:1.5rem;padding-bottom:0.75rem;margin-bottom:0.75rem;border-bottom:1px solid #1a1e2e;align-items:center;' });
    // Icon
    const iconDiv = this.el('div', { style: 'display:flex;align-items:center;gap:8px;' });
    iconDiv.innerHTML = `<span style="font-size:0.65rem;color:#5a6280;">Icon:</span>`;
    if (boss.icon_url) {
      iconDiv.innerHTML += `<img src="${boss.icon_url}" style="width:32px;height:32px;object-fit:contain;border-radius:3px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
    } else {
      iconDiv.innerHTML += `<span style="color:#3d4262;font-size:0.7rem;">None</span>`;
    }
    const iconInput = this.el('input', { type: 'file', accept: 'image/png', style: 'font-size:0.65rem;max-width:130px;' }) as HTMLInputElement;
    const iconUpBtn = this.el('button', { class: 'btn btn--sm', style: 'font-size:0.6rem;' }, 'Upload');
    iconUpBtn.addEventListener('click', async () => {
      if (!iconInput.files?.[0]) return;
      try { await uploadBossIcon(boss.id, iconInput.files[0]); await this.refreshDetail(panel, boss.id); } catch (e) { alert((e as Error).message); }
    });
    iconDiv.appendChild(iconInput);
    iconDiv.appendChild(iconUpBtn);
    uploadRow.appendChild(iconDiv);
    // Sprite
    const spriteDiv = this.el('div', { style: 'display:flex;align-items:center;gap:8px;' });
    spriteDiv.innerHTML = `<span style="font-size:0.65rem;color:#5a6280;">Sprite:</span>`;
    if (boss.sprite_url) {
      spriteDiv.innerHTML += `<img src="${boss.sprite_url}" style="width:32px;height:32px;object-fit:contain;border-radius:3px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
    } else {
      spriteDiv.innerHTML += `<span style="color:#3d4262;font-size:0.7rem;">None</span>`;
    }
    const spriteInput = this.el('input', { type: 'file', accept: 'image/png', style: 'font-size:0.65rem;max-width:130px;' }) as HTMLInputElement;
    const spriteUpBtn = this.el('button', { class: 'btn btn--sm', style: 'font-size:0.6rem;' }, 'Upload');
    spriteUpBtn.addEventListener('click', async () => {
      if (!spriteInput.files?.[0]) return;
      try { await uploadBossSprite(boss.id, spriteInput.files[0]); await this.refreshDetail(panel, boss.id); } catch (e) { alert((e as Error).message); }
    });
    spriteDiv.appendChild(spriteInput);
    spriteDiv.appendChild(spriteUpBtn);
    uploadRow.appendChild(spriteDiv);
    panel.appendChild(uploadRow);

    // Tabs
    const tabBar = this.el('div', { style: 'display:flex;gap:0;margin-bottom:0.75rem;border-bottom:1px solid #2a2e44;' });
    const abilitiesTab = this.el('button', {
      style: `padding:6px 16px;font-size:0.75rem;border:none;border-bottom:2px solid ${this.detailTab === 'abilities' ? '#6c8cff' : 'transparent'};background:none;color:${this.detailTab === 'abilities' ? '#9bb0ff' : '#5a6280'};cursor:pointer;font-family:inherit;`,
    }, 'Abilities');
    const lootTab = this.el('button', {
      style: `padding:6px 16px;font-size:0.75rem;border:none;border-bottom:2px solid ${this.detailTab === 'loot' ? '#6c8cff' : 'transparent'};background:none;color:${this.detailTab === 'loot' ? '#9bb0ff' : '#5a6280'};cursor:pointer;font-family:inherit;`,
    }, 'Loot Table');
    abilitiesTab.addEventListener('click', () => { this.detailTab = 'abilities'; this.renderDetailPanel(panel, boss); });
    lootTab.addEventListener('click', () => { this.detailTab = 'loot'; this.renderDetailPanel(panel, boss); });
    tabBar.appendChild(abilitiesTab);
    tabBar.appendChild(lootTab);
    panel.appendChild(tabBar);

    // Tab content
    if (this.detailTab === 'abilities') {
      panel.appendChild(this.renderAbilitiesTab(boss));
    } else {
      panel.appendChild(this.renderLootTab(boss));
    }
  }

  // ── Abilities tab ──────────────────────────────────────────────────────

  private renderAbilitiesTab(boss: BossResponse): HTMLElement {
    const wrap = this.el('div');
    const abilities = boss.abilities ?? [];

    if (abilities.length === 0) {
      wrap.appendChild(this.el('p', { style: 'color:#3d4262;font-size:0.8rem;margin:0 0 0.5rem;' }, 'No abilities assigned.'));
    } else {
      for (const a of abilities) {
        const row = this.el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.8rem;' });
        // Ability icon
        if (a.icon_url) {
          row.innerHTML += `<img src="${a.icon_url}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
        } else {
          row.innerHTML += `<div style="width:24px;height:24px;background:#1a1e2e;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#3d4262;font-size:0.55rem;">?</div>`;
        }
        row.innerHTML += `<span style="color:#7a8ab0;">[P${a.priority}]</span> <span>${this.esc(a.name)}</span> <span style="color:#5a6280;font-size:0.7rem;">(${a.effect_type}, ${a.effect_value})</span>`;
        const rmBtn = this.el('button', { class: 'btn btn--sm btn--danger', style: 'margin-left:auto;padding:1px 6px;font-size:0.65rem;' }, 'X');
        rmBtn.addEventListener('click', () => void this.handleRemoveAbility(boss.id, a.ability_id, wrap));
        row.appendChild(rmBtn);
        wrap.appendChild(row);
      }
    }

    // Add form
    const addRow = this.el('div', { style: 'display:flex;gap:6px;margin-top:0.5rem;align-items:end;' });
    const selectWrap = this.el('div', { style: 'flex:1;' });
    selectWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">Ability</label>`;
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;font-size:0.75rem;';
    select.innerHTML = `<option value="">-- select --</option>` +
      this.abilities.map(a =>
        `<option value="${a.id}" data-icon="${a.icon_url ?? ''}">${this.esc(a.name)} (${a.effect_type})</option>`
      ).join('');
    selectWrap.appendChild(select);

    // Icon preview next to select
    const iconPreview = this.el('div', { style: 'width:24px;height:24px;flex-shrink:0;' });
    select.addEventListener('change', () => {
      const opt = select.selectedOptions[0];
      const iconUrl = opt?.dataset['icon'];
      iconPreview.innerHTML = iconUrl
        ? `<img src="${iconUrl}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;image-rendering:pixelated;" />`
        : '';
    });

    const prioWrap = this.el('div', { style: 'width:60px;' });
    prioWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">Priority</label><input id="bm-add-prio" type="number" min="0" value="1" style="width:100%;font-size:0.75rem;" />`;

    const addBtn = this.el('button', { class: 'btn btn--sm btn--primary', style: 'padding:4px 10px;font-size:0.7rem;' }, 'Add');
    addBtn.addEventListener('click', async () => {
      const abilityId = parseInt(select.value, 10);
      const priority = parseInt((prioWrap.querySelector('input') as HTMLInputElement).value, 10);
      if (!abilityId) { alert('Select an ability.'); return; }
      try {
        await addBossAbilityApi(boss.id, { ability_id: abilityId, priority: isNaN(priority) ? 0 : priority });
        await this.refreshDetailFromPanel(wrap);
      } catch (err) { alert((err as Error).message); }
    });

    addRow.appendChild(selectWrap);
    addRow.appendChild(iconPreview);
    addRow.appendChild(prioWrap);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);
    return wrap;
  }

  private async handleRemoveAbility(bossId: number, abilityId: number, panelChild: HTMLElement): Promise<void> {
    try {
      await removeBossAbilityApi(bossId, abilityId);
      await this.refreshDetailFromPanel(panelChild);
    } catch (err) { alert((err as Error).message); }
  }

  // ── Loot tab ───────────────────────────────────────────────────────────

  private renderLootTab(boss: BossResponse): HTMLElement {
    const wrap = this.el('div');
    const loot = boss.loot ?? [];

    if (loot.length === 0) {
      wrap.appendChild(this.el('p', { style: 'color:#3d4262;font-size:0.8rem;margin:0 0 0.5rem;' }, 'No loot entries.'));
    } else {
      for (const l of loot) {
        const row = this.el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.8rem;' });
        if (l.icon_url) {
          row.innerHTML += `<img src="${l.icon_url}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
        } else {
          row.innerHTML += `<div style="width:24px;height:24px;background:#1a1e2e;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#3d4262;font-size:0.55rem;">?</div>`;
        }
        row.innerHTML += `<span>${this.esc(l.item_name ?? 'Unknown')}</span> <span style="color:#5a6280;font-size:0.7rem;">${l.drop_chance}% x${l.quantity}</span>`;
        const rmBtn = this.el('button', { class: 'btn btn--sm btn--danger', style: 'margin-left:auto;padding:1px 6px;font-size:0.65rem;' }, 'X');
        rmBtn.addEventListener('click', () => void this.handleRemoveLoot(boss.id, l.id, wrap));
        row.appendChild(rmBtn);
        wrap.appendChild(row);
      }
    }

    // Add form
    const addRow = this.el('div', { style: 'display:flex;gap:6px;margin-top:0.5rem;align-items:end;' });
    const selectWrap = this.el('div', { style: 'flex:1;' });
    selectWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">Item</label>`;
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;font-size:0.75rem;';
    select.innerHTML = `<option value="">-- select --</option>` +
      this.items.map(i =>
        `<option value="${i.id}" data-icon="${i.icon_url ?? ''}">${this.esc(i.name)} (${i.category})</option>`
      ).join('');
    selectWrap.appendChild(select);

    const iconPreview = this.el('div', { style: 'width:24px;height:24px;flex-shrink:0;' });
    select.addEventListener('change', () => {
      const opt = select.selectedOptions[0];
      const iconUrl = opt?.dataset['icon'];
      iconPreview.innerHTML = iconUrl
        ? `<img src="${iconUrl}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;image-rendering:pixelated;" />`
        : '';
    });

    const chanceWrap = this.el('div', { style: 'width:50px;' });
    chanceWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">%</label><input type="number" min="1" max="100" value="50" style="width:100%;font-size:0.75rem;" />`;
    const qtyWrap = this.el('div', { style: 'width:40px;' });
    qtyWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">Qty</label><input type="number" min="1" value="1" style="width:100%;font-size:0.75rem;" />`;

    const addBtn = this.el('button', { class: 'btn btn--sm btn--primary', style: 'padding:4px 10px;font-size:0.7rem;' }, 'Add');
    addBtn.addEventListener('click', async () => {
      const itemDefId = parseInt(select.value, 10);
      const dropChance = parseInt((chanceWrap.querySelector('input') as HTMLInputElement).value, 10);
      const quantity = parseInt((qtyWrap.querySelector('input') as HTMLInputElement).value, 10);
      if (!itemDefId) { alert('Select an item.'); return; }
      try {
        await addBossLootApi(boss.id, { item_def_id: itemDefId, drop_chance: isNaN(dropChance) ? 50 : dropChance, quantity: isNaN(quantity) ? 1 : quantity });
        await this.refreshDetailFromPanel(wrap);
      } catch (err) { alert((err as Error).message); }
    });

    addRow.appendChild(selectWrap);
    addRow.appendChild(iconPreview);
    addRow.appendChild(chanceWrap);
    addRow.appendChild(qtyWrap);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);
    return wrap;
  }

  private async handleRemoveLoot(bossId: number, lootId: number, panelChild: HTMLElement): Promise<void> {
    try {
      await removeBossLootApi(bossId, lootId);
      await this.refreshDetailFromPanel(panelChild);
    } catch (err) { alert((err as Error).message); }
  }

  // ── Refresh detail helper ──────────────────────────────────────────────

  private async refreshDetailFromPanel(child: HTMLElement): Promise<void> {
    const panel = child.closest('.boss-detail-panel') as HTMLElement;
    if (!panel || !this.expandedBossId) return;
    await this.refreshDetail(panel, this.expandedBossId);
  }

  private async refreshDetail(panel: HTMLElement, bossId: number): Promise<void> {
    try {
      const boss = await getBoss(bossId);
      // Update cached boss too
      const idx = this.bosses.findIndex(b => b.id === bossId);
      if (idx >= 0) this.bosses[idx] = boss;
      this.renderDetailPanel(panel, boss);
    } catch (err) {
      panel.innerHTML = `<p class="error">${this.esc((err as Error).message)}</p>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleDelete(id: number): Promise<void> {
    const b = this.bosses.find(x => x.id === id);
    if (!confirm(`Delete "${b?.name}"? All abilities, loot, and instances will be removed.`)) return;
    try {
      await deleteBossApi(id);
      await this.load();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private el(tag: string, attrs?: Record<string, string>, text?: string): HTMLElement {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    if (text) e.textContent = text;
    return e;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
