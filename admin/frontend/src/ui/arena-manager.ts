import {
  listArenas,
  getArena,
  createArenaApi,
  updateArenaApi,
  deleteArenaApi,
  addArenaMonsterApi,
  removeArenaMonsterApi,
  kickArenaParticipant,
  listArenaBuildings,
  listArenaMonsters,
  type ArenaResponse,
  type ArenaMonsterEntry,
  type ArenaParticipantEntry,
  type BuildingSummary,
  type MonsterSummary,
} from '../editor/api';

export class ArenaManager {
  private container!: HTMLElement;
  private arenas: ArenaResponse[] = [];
  private buildings: BuildingSummary[] = [];
  private monsters: MonsterSummary[] = [];
  private expandedArenaId: number | null = null;
  private detailTab: 'monsters' | 'participants' = 'monsters';

  init(container: HTMLElement): void {
    this.container = container;
  }

  async load(): Promise<void> {
    try {
      [this.arenas, this.buildings, this.monsters] = await Promise.all([
        listArenas(),
        listArenaBuildings(),
        listArenaMonsters(),
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

    const defsSection = this.el('div', { style: 'margin-bottom:1.5rem;' });
    const defsHeader = this.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;' });
    defsHeader.appendChild(this.el('h2', { style: 'margin:0;font-size:1.1rem;' }, 'Arena Definitions'));
    const addBtn = this.el('button', { class: 'btn btn--primary', style: 'font-size:0.8rem;' }, '+ Add Arena');
    addBtn.addEventListener('click', () => this.openFormModal(null));
    defsHeader.appendChild(addBtn);
    defsSection.appendChild(defsHeader);
    defsSection.appendChild(this.renderArenaTable());
    this.container.appendChild(defsSection);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Arena table
  // ═══════════════════════════════════════════════════════════════════════════

  private renderArenaTable(): HTMLElement {
    if (this.arenas.length === 0) {
      return this.el('p', { style: 'color:#3d4262;font-size:0.85rem;' }, 'No arenas yet. Click "+ Add Arena" to create one.');
    }

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.style.cssText = 'width:100%;font-size:0.8rem;border-collapse:collapse;';
    table.innerHTML = `<thead><tr style="background:#151828;text-align:left;">
      <th style="padding:8px 6px;">Name</th>
      <th style="padding:8px 6px;">Building</th>
      <th style="padding:8px 6px;">Min Stay</th>
      <th style="padding:8px 6px;">Cooldown</th>
      <th style="padding:8px 6px;">W XP</th>
      <th style="padding:8px 6px;">L XP</th>
      <th style="padding:8px 6px;">W Crowns</th>
      <th style="padding:8px 6px;">L Crowns</th>
      <th style="padding:8px 6px;">Bracket</th>
      <th style="padding:8px 6px;">Active</th>
      <th style="width:170px;padding:8px 6px;">Actions</th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    for (const a of this.arenas) {
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom:1px solid #1a1e2e;';
      const P = 'padding:6px 6px;';
      row.innerHTML = `
        <td style="${P}"><strong>${this.esc(a.name)}</strong></td>
        <td style="${P}">${a.building_name ? this.esc(a.building_name) : '\u2014'}</td>
        <td style="${P}">${this.formatSeconds(a.min_stay_seconds)}</td>
        <td style="${P}">${this.formatSeconds(a.reentry_cooldown_seconds)}</td>
        <td style="${P}">${a.winner_xp}</td>
        <td style="${P}">${a.loser_xp}</td>
        <td style="${P}">${a.winner_crowns}</td>
        <td style="${P}">${a.loser_crowns}</td>
        <td style="${P}">${a.level_bracket}</td>
        <td style="${P}">${a.is_active ? '<span style="color:#4ade80">Yes</span>' : '<span style="color:#f87171">No</span>'}</td>
        <td style="${P}white-space:nowrap;"></td>`;

      const actionsCell = row.querySelector('td:last-child')!;
      const editBtn = this.el('button', { class: 'btn btn--sm btn--edit', style: 'margin-right:4px;' }, 'Edit');
      editBtn.addEventListener('click', async () => {
        try { const fresh = await getArena(a.id); this.openFormModal(fresh); } catch { this.openFormModal(a); }
      });
      const detailBtn = this.el('button', { class: 'btn btn--sm', style: 'margin-right:4px;' }, 'Details');
      detailBtn.addEventListener('click', () => void this.toggleDetail(a.id, detailRow));
      const delBtn = this.el('button', { class: 'btn btn--sm btn--danger' }, 'Del');
      delBtn.addEventListener('click', () => void this.handleDelete(a.id));
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(detailBtn);
      actionsCell.appendChild(delBtn);
      tbody.appendChild(row);

      // Detail row (hidden by default)
      const detailRow = document.createElement('tr');
      detailRow.style.display = 'none';
      detailRow.innerHTML = `<td colspan="11"><div class="arena-detail-panel" style="padding:0.75rem 0;"></div></td>`;
      tbody.appendChild(detailRow);
    }
    table.appendChild(tbody);
    return table;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Detail panel (tabbed: Monsters / Participants)
  // ═══════════════════════════════════════════════════════════════════════════

  private async toggleDetail(arenaId: number, detailRow: HTMLTableRowElement): Promise<void> {
    if (this.expandedArenaId === arenaId) {
      detailRow.style.display = 'none';
      this.expandedArenaId = null;
      return;
    }

    if (this.expandedArenaId !== null) {
      const prev = this.container.querySelector<HTMLElement>(`[data-arena-detail="${this.expandedArenaId}"]`);
      if (prev) prev.closest('tr')!.style.display = 'none';
    }

    this.expandedArenaId = arenaId;
    this.detailTab = 'monsters';
    detailRow.style.display = '';
    const panel = detailRow.querySelector<HTMLElement>('.arena-detail-panel')!;
    panel.innerHTML = '<p style="color:#3d4262;font-size:0.8rem;">Loading...</p>';

    try {
      const arena = await getArena(arenaId);
      this.renderDetailPanel(panel, arena);
    } catch (err) {
      panel.innerHTML = `<p class="error">${this.esc((err as Error).message)}</p>`;
    }
  }

  private renderDetailPanel(panel: HTMLElement, arena: ArenaResponse): void {
    panel.innerHTML = '';
    panel.setAttribute('data-arena-detail', String(arena.id));

    // Tabs
    const tabBar = this.el('div', { style: 'display:flex;gap:0;margin-bottom:0.75rem;border-bottom:1px solid #2a2e44;' });
    const monstersTab = this.el('button', {
      style: `padding:6px 16px;font-size:0.75rem;border:none;border-bottom:2px solid ${this.detailTab === 'monsters' ? '#6c8cff' : 'transparent'};background:none;color:${this.detailTab === 'monsters' ? '#9bb0ff' : '#5a6280'};cursor:pointer;font-family:inherit;`,
    }, 'Monsters');
    const participantsTab = this.el('button', {
      style: `padding:6px 16px;font-size:0.75rem;border:none;border-bottom:2px solid ${this.detailTab === 'participants' ? '#6c8cff' : 'transparent'};background:none;color:${this.detailTab === 'participants' ? '#9bb0ff' : '#5a6280'};cursor:pointer;font-family:inherit;`,
    }, 'Participants');
    monstersTab.addEventListener('click', () => { this.detailTab = 'monsters'; this.renderDetailPanel(panel, arena); });
    participantsTab.addEventListener('click', async () => {
      this.detailTab = 'participants';
      // Refresh arena data to get current participants
      try {
        const fresh = await getArena(arena.id);
        this.renderDetailPanel(panel, fresh);
      } catch {
        this.renderDetailPanel(panel, arena);
      }
    });
    tabBar.appendChild(monstersTab);
    tabBar.appendChild(participantsTab);
    panel.appendChild(tabBar);

    if (this.detailTab === 'monsters') {
      panel.appendChild(this.renderMonstersTab(arena));
    } else {
      panel.appendChild(this.renderParticipantsTab(arena));
    }
  }

  // ── Monsters tab ──────────────────────────────────────────────────────────

  private renderMonstersTab(arena: ArenaResponse): HTMLElement {
    const wrap = this.el('div');
    const monsters = arena.monsters ?? [];

    if (monsters.length === 0) {
      wrap.appendChild(this.el('p', { style: 'color:#3d4262;font-size:0.8rem;margin:0 0 0.5rem;' }, 'No monsters assigned.'));
    } else {
      for (const m of monsters) {
        const row = this.el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.8rem;' });
        if (m.icon_url) {
          row.innerHTML += `<img src="${m.icon_url}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;border:1px solid #2a2e44;image-rendering:pixelated;" />`;
        } else {
          row.innerHTML += `<div style="width:24px;height:24px;background:#1a1e2e;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#3d4262;font-size:0.55rem;">?</div>`;
        }
        row.innerHTML += `<span style="color:#7a8ab0;">[#${m.sort_order}]</span> <span>${this.esc(m.name)}</span> <span style="color:#5a6280;font-size:0.7rem;">(HP:${m.hp} ATK:${m.attack} DEF:${m.defense})</span>`;
        const rmBtn = this.el('button', { class: 'btn btn--sm btn--danger', style: 'margin-left:auto;padding:1px 6px;font-size:0.65rem;' }, 'X');
        rmBtn.addEventListener('click', () => void this.handleRemoveMonster(arena.id, m.monster_id, panel));
        row.appendChild(rmBtn);
        wrap.appendChild(row);
      }
    }

    // Add form
    const addRow = this.el('div', { style: 'display:flex;gap:6px;margin-top:0.5rem;align-items:end;' });
    const selectWrap = this.el('div', { style: 'flex:1;' });
    selectWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">Monster</label>`;
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;font-size:0.75rem;';
    select.innerHTML = `<option value="">-- select --</option>` +
      this.monsters.map(m =>
        `<option value="${m.id}">${this.esc(m.name)} (HP:${m.hp} ATK:${m.attack})</option>`
      ).join('');
    selectWrap.appendChild(select);

    const sortWrap = this.el('div', { style: 'width:60px;' });
    sortWrap.innerHTML = `<label style="font-size:0.65rem;color:#5a6280;">Sort</label><input id="am-add-sort" type="number" min="0" value="0" style="width:100%;font-size:0.75rem;" />`;

    const addBtn = this.el('button', { class: 'btn btn--sm btn--primary', style: 'font-size:0.7rem;height:28px;' }, 'Add');
    addBtn.addEventListener('click', async () => {
      const monsterId = parseInt(select.value, 10);
      if (!monsterId) return;
      const sortOrder = parseInt((wrap.closest('.arena-detail-panel')?.querySelector('#am-add-sort') as HTMLInputElement)?.value ?? '0', 10) || 0;
      addBtn.textContent = '...';
      try {
        await addArenaMonsterApi(arena.id, { monster_id: monsterId, sort_order: sortOrder });
        const panel = wrap.closest('.arena-detail-panel') as HTMLElement;
        await this.refreshDetail(panel, arena.id);
      } catch (err) {
        alert(`Failed: ${(err as Error).message}`);
      }
      addBtn.textContent = 'Add';
    });

    addRow.appendChild(selectWrap);
    addRow.appendChild(sortWrap);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);

    // Capture panel reference for the remove handler
    const panel = wrap;
    return wrap;
  }

  // ── Participants tab ──────────────────────────────────────────────────────

  private renderParticipantsTab(arena: ArenaResponse): HTMLElement {
    const wrap = this.el('div');
    const participants = arena.participants ?? [];

    if (participants.length === 0) {
      wrap.appendChild(this.el('p', { style: 'color:#3d4262;font-size:0.8rem;margin:0;' }, 'No participants currently in this arena.'));
      return wrap;
    }

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;font-size:0.8rem;border-collapse:collapse;';
    table.innerHTML = `<thead><tr style="background:#151828;text-align:left;">
      <th style="padding:6px;">Name</th>
      <th style="padding:6px;">Level</th>
      <th style="padding:6px;">HP</th>
      <th style="padding:6px;">Entered</th>
      <th style="padding:6px;">In Combat</th>
      <th style="padding:6px;">Can Leave</th>
      <th style="padding:6px;width:80px;">Actions</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const p of participants) {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid #1a1e2e;';
      const PP = 'padding:4px 6px;';
      const enteredAt = new Date(p.entered_at).toLocaleString();
      const canLeaveAt = new Date(p.can_leave_at).toLocaleString();
      const combatColor = p.in_combat ? '#facc15' : '#5a6280';
      tr.innerHTML = `
        <td style="${PP}">${this.esc(p.name)}</td>
        <td style="${PP}">${p.level}</td>
        <td style="${PP}">${p.current_hp}</td>
        <td style="${PP}font-size:0.7rem;">${enteredAt}</td>
        <td style="${PP}color:${combatColor}">${p.in_combat ? 'Yes' : 'No'}</td>
        <td style="${PP}font-size:0.7rem;">${canLeaveAt}</td>
        <td style="${PP}"></td>`;
      const kickBtn = this.el('button', { class: 'btn btn--sm btn--danger', style: 'font-size:0.65rem;' }, 'Kick');
      kickBtn.addEventListener('click', () => void this.handleKick(arena.id, p.character_id, p.name, wrap));
      tr.querySelector('td:last-child')!.appendChild(kickBtn);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event handlers
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleDelete(id: number): Promise<void> {
    const a = this.arenas.find(x => x.id === id);
    if (!confirm(`Delete "${a?.name}"? All monster assignments and participants will be removed.`)) return;
    try {
      await deleteArenaApi(id);
      await this.load();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  }

  private async handleRemoveMonster(arenaId: number, monsterId: number, _parentEl: HTMLElement): Promise<void> {
    try {
      await removeArenaMonsterApi(arenaId, monsterId);
      const panel = this.container.querySelector<HTMLElement>(`[data-arena-detail="${arenaId}"]`);
      if (panel) await this.refreshDetail(panel, arenaId);
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`);
    }
  }

  private async handleKick(arenaId: number, characterId: string, name: string, _parentEl: HTMLElement): Promise<void> {
    if (!confirm(`Force-kick "${name}" from this arena? They will receive a reentry cooldown.`)) return;
    try {
      await kickArenaParticipant(arenaId, characterId);
      const panel = this.container.querySelector<HTMLElement>(`[data-arena-detail="${arenaId}"]`);
      if (panel) await this.refreshDetail(panel, arenaId);
    } catch (err) {
      alert(`Kick failed: ${(err as Error).message}`);
    }
  }

  private async refreshDetail(panel: HTMLElement, arenaId: number): Promise<void> {
    try {
      const arena = await getArena(arenaId);
      this.renderDetailPanel(panel, arena);
    } catch (err) {
      panel.innerHTML = `<p class="error">${this.esc((err as Error).message)}</p>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Create/Edit modal
  // ═══════════════════════════════════════════════════════════════════════════

  private openFormModal(arena: ArenaResponse | null): void {
    const isEdit = arena !== null;
    const backdrop = this.el('div', {
      style: 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;',
    });

    const modal = this.el('div', {
      style: 'background:#0e1020;border:1px solid #2a2e44;border-radius:6px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:1.5rem;',
    });

    const title = this.el('h3', { style: 'margin:0 0 1rem;font-size:1rem;' }, isEdit ? `Edit: ${arena!.name}` : 'Add New Arena');
    modal.appendChild(title);

    const errEl = this.el('p', { class: 'error', style: 'display:none;margin-bottom:0.75rem;' });
    modal.appendChild(errEl);

    const form = this.el('div');
    form.innerHTML = `
      <label style="font-size:0.75rem;">Name *</label>
      <input id="amf-name" type="text" maxlength="128" value="${this.esc(arena?.name ?? '')}" style="width:100%;margin-bottom:0.5rem;" />
      <label style="font-size:0.75rem;">Building *</label>
      <select id="amf-building" style="width:100%;margin-bottom:0.5rem;">
        <option value="">-- select building --</option>
        ${this.buildings.map(b => `<option value="${b.id}" ${arena?.building_id === b.id ? 'selected' : ''}>${this.esc(b.name)} (zone ${b.zone_id})</option>`).join('')}
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
        <div><label style="font-size:0.7rem;">Min Stay (seconds)</label><input id="amf-min-stay" type="number" min="0" value="${arena?.min_stay_seconds ?? 3600}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Reentry Cooldown (seconds)</label><input id="amf-cooldown" type="number" min="0" value="${arena?.reentry_cooldown_seconds ?? 1800}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Winner XP</label><input id="amf-wxp" type="number" min="0" value="${arena?.winner_xp ?? 50}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Loser XP</label><input id="amf-lxp" type="number" min="0" value="${arena?.loser_xp ?? 10}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Winner Crowns</label><input id="amf-wcrowns" type="number" min="0" value="${arena?.winner_crowns ?? 25}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Loser Crowns</label><input id="amf-lcrowns" type="number" min="0" value="${arena?.loser_crowns ?? 0}" style="width:100%;" /></div>
        <div><label style="font-size:0.7rem;">Level Bracket</label><input id="amf-bracket" type="number" min="1" value="${arena?.level_bracket ?? 5}" style="width:100%;" /></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.75rem;">
        <input id="amf-active" type="checkbox" ${(!arena || arena.is_active) ? 'checked' : ''} /> Active
      </label>
    `;
    modal.appendChild(form);

    // Buttons
    const actions = this.el('div', { style: 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;' });
    const cancelBtn = this.el('button', { class: 'btn' }, 'Cancel');
    cancelBtn.addEventListener('click', () => backdrop.remove());
    const saveBtn = this.el('button', { class: 'btn btn--primary' }, isEdit ? 'Save Changes' : 'Create Arena');
    saveBtn.addEventListener('click', async () => {
      const name = (modal.querySelector<HTMLInputElement>('#amf-name')!.value ?? '').trim();
      if (!name) { errEl.textContent = 'Name required.'; errEl.style.display = ''; return; }
      const buildingId = parseInt(modal.querySelector<HTMLSelectElement>('#amf-building')!.value, 10);
      if (!buildingId) { errEl.textContent = 'Building is required.'; errEl.style.display = ''; return; }
      const data: Record<string, unknown> = {
        name,
        building_id: buildingId,
        min_stay_seconds: parseInt(modal.querySelector<HTMLInputElement>('#amf-min-stay')!.value, 10) || 3600,
        reentry_cooldown_seconds: parseInt(modal.querySelector<HTMLInputElement>('#amf-cooldown')!.value, 10) || 1800,
        winner_xp: parseInt(modal.querySelector<HTMLInputElement>('#amf-wxp')!.value, 10) || 50,
        loser_xp: parseInt(modal.querySelector<HTMLInputElement>('#amf-lxp')!.value, 10) || 10,
        winner_crowns: parseInt(modal.querySelector<HTMLInputElement>('#amf-wcrowns')!.value, 10) || 25,
        loser_crowns: parseInt(modal.querySelector<HTMLInputElement>('#amf-lcrowns')!.value, 10) || 0,
        level_bracket: parseInt(modal.querySelector<HTMLInputElement>('#amf-bracket')!.value, 10) || 5,
        is_active: modal.querySelector<HTMLInputElement>('#amf-active')!.checked,
      };
      saveBtn.disabled = true;
      try {
        if (isEdit) {
          await updateArenaApi(arena!.id, data);
        } else {
          await createArenaApi(data as Parameters<typeof createArenaApi>[0]);
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
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private formatSeconds(s: number): string {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

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
