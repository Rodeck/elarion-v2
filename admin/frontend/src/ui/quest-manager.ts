import {
  getQuests,
  createQuest,
  updateQuest,
  deleteQuest,
  getItems,
  listMonsters,
  listNpcs,
  type QuestResponse,
  type QuestObjectiveData,
  type QuestPrerequisiteData,
  type QuestRewardData,
  type ItemDefinitionResponse,
  type MonsterResponse,
  type NpcResponse,
} from '../editor/api';

// ── Objective type constants ────────────────────────────────────────────────

const OBJECTIVE_TYPES = [
  { value: 'kill_monster', label: 'Kill Monster' },
  { value: 'collect_item', label: 'Collect Item' },
  { value: 'craft_item', label: 'Craft Item' },
  { value: 'spend_crowns', label: 'Spend Crowns' },
  { value: 'gather_resource', label: 'Gather Resource' },
  { value: 'reach_level', label: 'Reach Level' },
  { value: 'visit_location', label: 'Visit Location' },
  { value: 'talk_to_npc', label: 'Talk to NPC' },
] as const;

const QUEST_TYPES = [
  { value: 'main', label: 'Main' },
  { value: 'side', label: 'Side' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'repeatable', label: 'Repeatable' },
] as const;

const PREREQ_TYPES = [
  { value: 'min_level', label: 'Min Level' },
  { value: 'has_item', label: 'Has Item' },
  { value: 'completed_quest', label: 'Completed Quest' },
  { value: 'class_required', label: 'Class Required' },
] as const;

const REWARD_TYPES = [
  { value: 'item', label: 'Item' },
  { value: 'xp', label: 'XP' },
  { value: 'crowns', label: 'Crowns' },
] as const;

// ── Row types ───────────────────────────────────────────────────────────────

interface ObjectiveRow {
  objective_type: string;
  target_id: number | null;
  target_quantity: number;
  target_duration: number | null;
  dialog_prompt: string | null;
  dialog_response: string | null;
}

interface PrereqRow {
  prereq_type: string;
  target_id: number | null;
  target_value: number;
}

interface RewardRow {
  reward_type: string;
  target_id: number | null;
  quantity: number;
}

// ── Inline style helpers ────────────────────────────────────────────────────

const INPUT_STYLE = 'background:#0c0e14;border:1px solid #252a3a;color:#c8d0e0;font-size:0.8rem;padding:4px 8px;border-radius:4px;width:100%;box-sizing:border-box;';
const SELECT_STYLE = INPUT_STYLE;
const LABEL_STYLE = 'font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:#8899aa;margin-bottom:2px;display:block;';
const SECTION_STYLE = 'margin-bottom:1rem;padding:0.75rem;border:1px solid #1a1e2e;border-radius:6px;background:#0a0c14;';

// ── Wizard constants ────────────────────────────────────────────────────────

const STEP_LABELS = ['Basic Info', 'Objectives', 'Prerequisites', 'Rewards', 'NPCs'];
const TOTAL_STEPS = STEP_LABELS.length;

export class QuestManager {
  private container!: HTMLElement;
  private quests: QuestResponse[] = [];
  private items: ItemDefinitionResponse[] = [];
  private monsters: MonsterResponse[] = [];
  private npcs: NpcResponse[] = [];
  private allQuests: QuestResponse[] = [];
  private editingId: number | null = null;

  private objectiveRows: ObjectiveRow[] = [];
  private prereqRows: PrereqRow[] = [];
  private rewardRows: RewardRow[] = [];
  private selectedNpcIds: Set<number> = new Set();

  private filterType = '';
  private filterName = '';

  private currentStep = 1;

  init(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  async load(): Promise<void> {
    try {
      const [quests, items, monsters, npcs] = await Promise.all([
        getQuests(),
        getItems(),
        listMonsters(),
        listNpcs(),
      ]);
      this.quests = quests;
      this.allQuests = quests;
      this.items = items;
      this.monsters = monsters;
      this.npcs = npcs;
      this.renderNpcCheckboxes();
      this.renderList();
    } catch (err) {
      this.showError(`Failed to load: ${(err as Error).message}`);
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────

  private render(): void {
    const stepIndicatorHTML = STEP_LABELS.map((label, i) => {
      const stepNum = i + 1;
      const connector = i < TOTAL_STEPS - 1
        ? `<div class="wizard-connector" data-before-step="${stepNum}" style="flex:1;height:2px;background:#1a1e2e;align-self:center;"></div>`
        : '';
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <button type="button" class="wizard-step-btn" data-step="${stepNum}"
            style="width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;
                   font-size:0.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;
                   background:#1a1e2e;color:#4a506a;transition:all 0.15s ease;">
            ${stepNum}
          </button>
          <span class="wizard-step-label" data-step="${stepNum}"
            style="font-size:10px;color:#4a506a;white-space:nowrap;">
            ${label}
          </span>
        </div>
        ${connector}`;
    }).join('');

    this.container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1.5rem;">

        <!-- ── Top row: Wizard / Editor ── -->
        <div style="background:#0e1018;border:1px solid #1e2232;border-radius:6px;padding:1.5rem;">
          <h3 id="quest-form-title" style="margin:0 0 1rem 0;color:#c8d0e0;">Create New Quest</h3>
          <p id="quest-error" class="error" style="display:none"></p>

          <!-- Step indicator -->
          <div id="wizard-indicator" style="display:flex;align-items:flex-start;gap:0;margin-bottom:1.5rem;padding:0 2rem;">
            ${stepIndicatorHTML}
          </div>

          <form id="quest-form" autocomplete="off">

            <!-- Step 1: Basic Info -->
            <div data-step="1" style="min-height:200px;">
              <div style="${SECTION_STYLE}">
                <label style="${LABEL_STYLE}">Basic Info</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                  <div style="grid-column:1/-1;">
                    <label style="${LABEL_STYLE}" for="quest-name">Name *</label>
                    <input id="quest-name" name="name" type="text" maxlength="128" required placeholder="Quest name" style="${INPUT_STYLE}" />
                  </div>
                  <div style="grid-column:1/-1;">
                    <label style="${LABEL_STYLE}" for="quest-desc">Description *</label>
                    <textarea id="quest-desc" name="description" rows="3" required placeholder="Quest description" style="${INPUT_STYLE}resize:vertical;"></textarea>
                  </div>
                  <div>
                    <label style="${LABEL_STYLE}" for="quest-type">Type *</label>
                    <select id="quest-type" name="quest_type" required style="${SELECT_STYLE}">
                      ${QUEST_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label style="${LABEL_STYLE}" for="quest-chain-id">Chain ID</label>
                    <input id="quest-chain-id" name="chain_id" type="text" maxlength="64" placeholder="Optional chain ID" style="${INPUT_STYLE}" />
                  </div>
                  <div>
                    <label style="${LABEL_STYLE}" for="quest-chain-step">Chain Step</label>
                    <input id="quest-chain-step" name="chain_step" type="number" min="0" placeholder="Step #" style="${INPUT_STYLE}" />
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;padding-top:1rem;">
                    <input id="quest-active" name="is_active" type="checkbox" checked />
                    <label for="quest-active" style="${LABEL_STYLE}margin-bottom:0;">Active</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Objectives -->
            <div data-step="2" style="display:none;min-height:200px;">
              <div style="${SECTION_STYLE}">
                <label style="${LABEL_STYLE}">Objectives</label>
                <div id="quest-objectives"></div>
                <button type="button" class="btn btn--secondary" id="quest-add-objective" style="font-size:0.8rem;margin-top:0.25rem;">+ Add Objective</button>
              </div>
            </div>

            <!-- Step 3: Prerequisites -->
            <div data-step="3" style="display:none;min-height:200px;">
              <div style="${SECTION_STYLE}">
                <label style="${LABEL_STYLE}">Prerequisites</label>
                <div id="quest-prerequisites"></div>
                <button type="button" class="btn btn--secondary" id="quest-add-prereq" style="font-size:0.8rem;margin-top:0.25rem;">+ Add Prerequisite</button>
              </div>
            </div>

            <!-- Step 4: Rewards -->
            <div data-step="4" style="display:none;min-height:200px;">
              <div style="${SECTION_STYLE}">
                <label style="${LABEL_STYLE}">Rewards</label>
                <div id="quest-rewards"></div>
                <button type="button" class="btn btn--secondary" id="quest-add-reward" style="font-size:0.8rem;margin-top:0.25rem;">+ Add Reward</button>
              </div>
            </div>

            <!-- Step 5: NPC Assignment -->
            <div data-step="5" style="display:none;min-height:200px;">
              <div style="${SECTION_STYLE}">
                <label style="${LABEL_STYLE}">NPC Assignment</label>
                <div id="quest-npc-checkboxes" style="display:flex;flex-wrap:wrap;gap:8px;max-height:150px;overflow-y:auto;"></div>
              </div>
            </div>

            <!-- Navigation buttons -->
            <div style="display:flex;justify-content:space-between;margin-top:1rem;padding-top:1rem;border-top:1px solid #1e2232;">
              <div style="display:flex;gap:0.5rem;">
                <button type="button" class="btn" id="wizard-back" style="display:none;">Back</button>
                <button type="button" class="btn" id="quest-form-cancel" style="display:none;">Cancel Edit</button>
              </div>
              <div style="display:flex;gap:0.5rem;">
                <button type="button" class="btn btn--primary" id="wizard-next">Next</button>
                <button type="submit" class="btn btn--primary" id="quest-form-submit" style="display:none;">Create Quest</button>
              </div>
            </div>
          </form>
        </div>

        <!-- ── Bottom row: Quest list ── -->
        <div style="background:#0e1018;border:1px solid #1e2232;border-radius:6px;padding:1.5rem;">
          <h3 style="margin:0 0 1rem 0;color:#c8d0e0;">Quest List</h3>
          <div id="quest-filters" style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
            <select id="quest-filter-type" style="${SELECT_STYLE}width:auto;">
              <option value="">All Types</option>
              ${QUEST_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
            <input id="quest-filter-name" type="text" placeholder="Search name..." style="${INPUT_STYLE}width:auto;flex:1;" />
          </div>
          <div id="quest-list-container">
            <p style="color:#3d4262;font-size:0.875rem;">Loading...</p>
          </div>
        </div>

      </div>
    `;

    this.attachFormListeners();
    this.attachFilterListeners();
    this.showStep(1);
  }

  // ── Wizard step navigation ──────────────────────────────────────────────

  private showStep(step: number): void {
    if (step < 1 || step > TOTAL_STEPS) return;
    this.currentStep = step;

    // Show/hide step content divs (only target form children, not step indicator buttons/labels)
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const div = this.container.querySelector<HTMLElement>(`#quest-form > [data-step="${i}"]`);
      if (div) {
        div.style.display = i === step ? '' : 'none';
      }
    }

    // Update step indicator buttons and labels
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const btn = this.container.querySelector<HTMLElement>(`.wizard-step-btn[data-step="${i}"]`);
      const label = this.container.querySelector<HTMLElement>(`.wizard-step-label[data-step="${i}"]`);
      if (!btn || !label) continue;

      if (i === step) {
        // Active step
        btn.style.background = '#d4a84b';
        btn.style.color = '#1a1510';
        label.style.color = '#d4a84b';
      } else if (i < step) {
        // Completed step
        btn.style.background = '#2d6a2e';
        btn.style.color = '#b8e870';
        label.style.color = '#b8e870';
      } else {
        // Future step
        btn.style.background = '#1a1e2e';
        btn.style.color = '#4a506a';
        label.style.color = '#4a506a';
      }
    }

    // Update connector lines
    this.container.querySelectorAll<HTMLElement>('.wizard-connector').forEach((conn) => {
      const beforeStep = parseInt(conn.dataset.beforeStep!, 10);
      conn.style.background = beforeStep < step ? '#2d6a2e' : '#1a1e2e';
    });

    // Show/hide navigation buttons
    const backBtn = this.container.querySelector<HTMLElement>('#wizard-back')!;
    const nextBtn = this.container.querySelector<HTMLElement>('#wizard-next')!;
    const submitBtn = this.container.querySelector<HTMLElement>('#quest-form-submit')!;

    backBtn.style.display = step > 1 ? '' : 'none';

    if (step === TOTAL_STEPS) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = '';
    } else {
      nextBtn.style.display = '';
      submitBtn.style.display = 'none';
    }
  }

  // ── NPC checkboxes ────────────────────────────────────────────────────────

  private renderNpcCheckboxes(): void {
    const wrap = this.container.querySelector<HTMLElement>('#quest-npc-checkboxes');
    if (!wrap) return;
    wrap.innerHTML = this.npcs.map((npc) => {
      const checked = this.selectedNpcIds.has(npc.id) ? ' checked' : '';
      return `<label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;color:#c8d0e0;cursor:pointer;">
        <input type="checkbox" class="npc-cb" data-npc-id="${npc.id}"${checked} />
        ${this.esc(npc.name)}
      </label>`;
    }).join('');

    wrap.querySelectorAll<HTMLInputElement>('.npc-cb').forEach((cb) => {
      cb.addEventListener('change', () => {
        const npcId = parseInt(cb.dataset.npcId!, 10);
        if (cb.checked) this.selectedNpcIds.add(npcId);
        else this.selectedNpcIds.delete(npcId);
      });
    });
  }

  // ── Option builders ───────────────────────────────────────────────────────

  private buildMonsterOptions(selectedId?: number | null): string {
    return '<option value="">— select monster —</option>' +
      this.monsters.map((m) =>
        `<option value="${m.id}"${m.id === selectedId ? ' selected' : ''}>${this.esc(m.name)}</option>`
      ).join('');
  }

  private buildItemOptions(selectedId?: number | null): string {
    return '<option value="">— select item —</option>' +
      this.items.map((i) =>
        `<option value="${i.id}"${i.id === selectedId ? ' selected' : ''}>${this.esc(i.name)} (${i.category})</option>`
      ).join('');
  }

  private buildNpcOptions(selectedId?: number | null): string {
    return '<option value="">— select NPC —</option>' +
      this.npcs.map((n) =>
        `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${this.esc(n.name)}</option>`
      ).join('');
  }

  private buildQuestOptions(selectedId?: number | null): string {
    return '<option value="">— select quest —</option>' +
      this.allQuests
        .filter((q) => q.id !== this.editingId)
        .map((q) =>
          `<option value="${q.id}"${q.id === selectedId ? ' selected' : ''}>${this.esc(q.name)}</option>`
        ).join('');
  }

  // ── Objective rows ────────────────────────────────────────────────────────

  private renderObjectiveRows(): void {
    const wrap = this.container.querySelector<HTMLElement>('#quest-objectives')!;
    wrap.innerHTML = '';

    this.objectiveRows.forEach((row, idx) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;margin-bottom:8px;padding:6px;border:1px solid #1a1e2e;border-radius:4px;background:#0e1018;';

      const typeSelect = `<select class="obj-type" data-idx="${idx}" style="${SELECT_STYLE}width:auto;min-width:130px;">
        ${OBJECTIVE_TYPES.map((t) => `<option value="${t.value}"${t.value === row.objective_type ? ' selected' : ''}>${t.label}</option>`).join('')}
      </select>`;

      const specificFields = this.buildObjectiveSpecificFields(row, idx);

      div.innerHTML = `
        ${typeSelect}
        <div class="obj-specific" data-idx="${idx}" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">${specificFields}</div>
        <button type="button" class="btn btn--sm btn--danger obj-remove" data-idx="${idx}" style="padding:2px 8px;align-self:center;">X</button>
      `;

      // Type change handler
      div.querySelector<HTMLSelectElement>('.obj-type')!.addEventListener('change', (e) => {
        row.objective_type = (e.target as HTMLSelectElement).value;
        row.target_id = null;
        row.target_quantity = 1;
        row.target_duration = null;
        this.renderObjectiveRows();
      });

      // Attach specific field listeners after adding to DOM
      this.attachObjectiveFieldListeners(div, row, idx);

      // Remove handler
      div.querySelector<HTMLButtonElement>('.obj-remove')!.addEventListener('click', () => {
        this.objectiveRows.splice(idx, 1);
        this.renderObjectiveRows();
      });

      wrap.appendChild(div);
    });
  }

  private buildObjectiveSpecificFields(row: ObjectiveRow, _idx: number): string {
    switch (row.objective_type) {
      case 'kill_monster':
        return `<select class="obj-target" style="${SELECT_STYLE}width:auto;min-width:130px;">${this.buildMonsterOptions(row.target_id)}</select>
                <input type="number" class="obj-qty" min="1" value="${row.target_quantity}" placeholder="Qty" style="${INPUT_STYLE}width:70px;" />`;
      case 'collect_item':
      case 'craft_item':
        return `<select class="obj-target" style="${SELECT_STYLE}width:auto;min-width:130px;">${this.buildItemOptions(row.target_id)}</select>
                <input type="number" class="obj-qty" min="1" value="${row.target_quantity}" placeholder="Qty" style="${INPUT_STYLE}width:70px;" />`;
      case 'spend_crowns':
        return `<input type="number" class="obj-qty" min="1" value="${row.target_quantity}" placeholder="Crowns" style="${INPUT_STYLE}width:100px;" />`;
      case 'gather_resource':
        return `<input type="number" class="obj-target-num" min="0" value="${row.target_id ?? ''}" placeholder="Zone/Building ID" style="${INPUT_STYLE}width:120px;" />
                <input type="number" class="obj-qty" min="1" value="${row.target_quantity}" placeholder="Qty" style="${INPUT_STYLE}width:70px;" />
                <input type="number" class="obj-dur" min="0" value="${row.target_duration ?? ''}" placeholder="Duration (s)" style="${INPUT_STYLE}width:100px;" />`;
      case 'reach_level':
        return `<input type="number" class="obj-qty" min="1" value="${row.target_quantity}" placeholder="Level" style="${INPUT_STYLE}width:80px;" />`;
      case 'visit_location':
        return `<input type="number" class="obj-target-num" min="0" value="${row.target_id ?? ''}" placeholder="Zone ID" style="${INPUT_STYLE}width:100px;" />`;
      case 'talk_to_npc':
        return `<select class="obj-target" style="${SELECT_STYLE}width:auto;min-width:130px;">${this.buildNpcOptions(row.target_id)}</select>
                <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;width:100%;">
                  <input type="text" class="obj-dialog-prompt" maxlength="200" value="${this.esc(row.dialog_prompt ?? '')}" placeholder="Dialog option text (e.g. 'Borin sent me')" style="${INPUT_STYLE}width:100%;" />
                  <input type="text" class="obj-dialog-response" maxlength="500" value="${this.esc(row.dialog_response ?? '')}" placeholder="NPC response (e.g. 'Ah yes, tell him I said hello')" style="${INPUT_STYLE}width:100%;" />
                </div>`;
      default:
        return '';
    }
  }

  private attachObjectiveFieldListeners(div: HTMLElement, row: ObjectiveRow, _idx: number): void {
    const targetSelect = div.querySelector<HTMLSelectElement>('.obj-specific .obj-target');
    if (targetSelect) {
      targetSelect.addEventListener('change', () => {
        row.target_id = parseInt(targetSelect.value, 10) || null;
      });
    }

    const targetNum = div.querySelector<HTMLInputElement>('.obj-specific .obj-target-num');
    if (targetNum) {
      targetNum.addEventListener('change', () => {
        row.target_id = parseInt(targetNum.value, 10) || null;
      });
    }

    const qtyInput = div.querySelector<HTMLInputElement>('.obj-specific .obj-qty');
    if (qtyInput) {
      qtyInput.addEventListener('change', () => {
        row.target_quantity = parseInt(qtyInput.value, 10) || 1;
      });
    }

    const durInput = div.querySelector<HTMLInputElement>('.obj-specific .obj-dur');
    if (durInput) {
      durInput.addEventListener('change', () => {
        row.target_duration = parseInt(durInput.value, 10) || null;
      });
    }

    const dialogPrompt = div.querySelector<HTMLInputElement>('.obj-specific .obj-dialog-prompt');
    if (dialogPrompt) {
      dialogPrompt.addEventListener('input', () => {
        row.dialog_prompt = dialogPrompt.value.trim() || null;
      });
    }

    const dialogResponse = div.querySelector<HTMLInputElement>('.obj-specific .obj-dialog-response');
    if (dialogResponse) {
      dialogResponse.addEventListener('input', () => {
        row.dialog_response = dialogResponse.value.trim() || null;
      });
    }
  }

  // ── Prerequisite rows ─────────────────────────────────────────────────────

  private renderPrereqRows(): void {
    const wrap = this.container.querySelector<HTMLElement>('#quest-prerequisites')!;
    wrap.innerHTML = '';

    this.prereqRows.forEach((row, idx) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;';

      const typeSelect = `<select class="prereq-type" data-idx="${idx}" style="${SELECT_STYLE}width:auto;min-width:130px;">
        ${PREREQ_TYPES.map((t) => `<option value="${t.value}"${t.value === row.prereq_type ? ' selected' : ''}>${t.label}</option>`).join('')}
      </select>`;

      const specificFields = this.buildPrereqSpecificFields(row);

      div.innerHTML = `
        ${typeSelect}
        <div class="prereq-specific" style="display:flex;gap:6px;align-items:center;">${specificFields}</div>
        <button type="button" class="btn btn--sm btn--danger prereq-remove" data-idx="${idx}" style="padding:2px 8px;">X</button>
      `;

      div.querySelector<HTMLSelectElement>('.prereq-type')!.addEventListener('change', (e) => {
        row.prereq_type = (e.target as HTMLSelectElement).value;
        row.target_id = null;
        row.target_value = 1;
        this.renderPrereqRows();
      });

      this.attachPrereqFieldListeners(div, row);

      div.querySelector<HTMLButtonElement>('.prereq-remove')!.addEventListener('click', () => {
        this.prereqRows.splice(idx, 1);
        this.renderPrereqRows();
      });

      wrap.appendChild(div);
    });
  }

  private buildPrereqSpecificFields(row: PrereqRow): string {
    switch (row.prereq_type) {
      case 'min_level':
        return `<input type="number" class="prereq-val" min="1" value="${row.target_value}" placeholder="Level" style="${INPUT_STYLE}width:80px;" />`;
      case 'has_item':
        return `<select class="prereq-target" style="${SELECT_STYLE}width:auto;min-width:130px;">${this.buildItemOptions(row.target_id)}</select>
                <input type="number" class="prereq-val" min="1" value="${row.target_value}" placeholder="Qty" style="${INPUT_STYLE}width:70px;" />`;
      case 'completed_quest':
        return `<select class="prereq-target" style="${SELECT_STYLE}width:auto;min-width:130px;">${this.buildQuestOptions(row.target_id)}</select>`;
      case 'class_required':
        return `<input type="number" class="prereq-val" min="0" value="${row.target_value}" placeholder="Class ID" style="${INPUT_STYLE}width:80px;" />`;
      default:
        return '';
    }
  }

  private attachPrereqFieldListeners(div: HTMLElement, row: PrereqRow): void {
    const targetSelect = div.querySelector<HTMLSelectElement>('.prereq-specific .prereq-target');
    if (targetSelect) {
      targetSelect.addEventListener('change', () => {
        row.target_id = parseInt(targetSelect.value, 10) || null;
      });
    }

    const valInput = div.querySelector<HTMLInputElement>('.prereq-specific .prereq-val');
    if (valInput) {
      valInput.addEventListener('change', () => {
        row.target_value = parseInt(valInput.value, 10) || 1;
      });
    }
  }

  // ── Reward rows ───────────────────────────────────────────────────────────

  private renderRewardRows(): void {
    const wrap = this.container.querySelector<HTMLElement>('#quest-rewards')!;
    wrap.innerHTML = '';

    this.rewardRows.forEach((row, idx) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;';

      const typeSelect = `<select class="reward-type" data-idx="${idx}" style="${SELECT_STYLE}width:auto;min-width:100px;">
        ${REWARD_TYPES.map((t) => `<option value="${t.value}"${t.value === row.reward_type ? ' selected' : ''}>${t.label}</option>`).join('')}
      </select>`;

      const specificFields = this.buildRewardSpecificFields(row);

      div.innerHTML = `
        ${typeSelect}
        <div class="reward-specific" style="display:flex;gap:6px;align-items:center;">${specificFields}</div>
        <button type="button" class="btn btn--sm btn--danger reward-remove" data-idx="${idx}" style="padding:2px 8px;">X</button>
      `;

      div.querySelector<HTMLSelectElement>('.reward-type')!.addEventListener('change', (e) => {
        row.reward_type = (e.target as HTMLSelectElement).value;
        row.target_id = null;
        row.quantity = 1;
        this.renderRewardRows();
      });

      this.attachRewardFieldListeners(div, row);

      div.querySelector<HTMLButtonElement>('.reward-remove')!.addEventListener('click', () => {
        this.rewardRows.splice(idx, 1);
        this.renderRewardRows();
      });

      wrap.appendChild(div);
    });
  }

  private buildRewardSpecificFields(row: RewardRow): string {
    switch (row.reward_type) {
      case 'item':
        return `<select class="reward-target" style="${SELECT_STYLE}width:auto;min-width:130px;">${this.buildItemOptions(row.target_id)}</select>
                <input type="number" class="reward-qty" min="1" value="${row.quantity}" placeholder="Qty" style="${INPUT_STYLE}width:70px;" />`;
      case 'xp':
        return `<input type="number" class="reward-qty" min="1" value="${row.quantity}" placeholder="XP amount" style="${INPUT_STYLE}width:100px;" />`;
      case 'crowns':
        return `<input type="number" class="reward-qty" min="1" value="${row.quantity}" placeholder="Crowns" style="${INPUT_STYLE}width:100px;" />`;
      default:
        return '';
    }
  }

  private attachRewardFieldListeners(div: HTMLElement, row: RewardRow): void {
    const targetSelect = div.querySelector<HTMLSelectElement>('.reward-specific .reward-target');
    if (targetSelect) {
      targetSelect.addEventListener('change', () => {
        row.target_id = parseInt(targetSelect.value, 10) || null;
      });
    }

    const qtyInput = div.querySelector<HTMLInputElement>('.reward-specific .reward-qty');
    if (qtyInput) {
      qtyInput.addEventListener('change', () => {
        row.quantity = parseInt(qtyInput.value, 10) || 1;
      });
    }
  }

  // ── Form listeners ────────────────────────────────────────────────────────

  private attachFormListeners(): void {
    const form = this.container.querySelector<HTMLFormElement>('#quest-form')!;

    this.container.querySelector<HTMLButtonElement>('#quest-add-objective')!
      .addEventListener('click', () => {
        this.objectiveRows.push({ objective_type: 'kill_monster', target_id: null, target_quantity: 1, target_duration: null, dialog_prompt: null, dialog_response: null });
        this.renderObjectiveRows();
      });

    this.container.querySelector<HTMLButtonElement>('#quest-add-prereq')!
      .addEventListener('click', () => {
        this.prereqRows.push({ prereq_type: 'min_level', target_id: null, target_value: 1 });
        this.renderPrereqRows();
      });

    this.container.querySelector<HTMLButtonElement>('#quest-add-reward')!
      .addEventListener('click', () => {
        this.rewardRows.push({ reward_type: 'item', target_id: null, quantity: 1 });
        this.renderRewardRows();
      });

    this.container.querySelector<HTMLButtonElement>('#quest-form-cancel')!
      .addEventListener('click', () => {
        this.resetForm();
      });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit(form);
    });

    // Wizard navigation
    this.container.querySelector<HTMLButtonElement>('#wizard-back')!
      .addEventListener('click', () => {
        if (this.currentStep > 1) this.showStep(this.currentStep - 1);
      });

    this.container.querySelector<HTMLButtonElement>('#wizard-next')!
      .addEventListener('click', () => {
        if (this.currentStep < TOTAL_STEPS) this.showStep(this.currentStep + 1);
      });

    // Step indicator buttons — clickable to jump to any completed or current step
    this.container.querySelectorAll<HTMLButtonElement>('.wizard-step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step!, 10);
        // Allow jumping to any step that is completed (< current) or current
        if (step <= this.currentStep || step === this.currentStep + 1) {
          this.showStep(step);
        }
      });
    });
  }

  private attachFilterListeners(): void {
    this.container.querySelector<HTMLSelectElement>('#quest-filter-type')!
      .addEventListener('change', (e) => {
        this.filterType = (e.target as HTMLSelectElement).value;
        this.renderList();
      });

    this.container.querySelector<HTMLInputElement>('#quest-filter-name')!
      .addEventListener('input', (e) => {
        this.filterName = (e.target as HTMLInputElement).value.toLowerCase().trim();
        this.renderList();
      });
  }

  private async handleFormSubmit(form: HTMLFormElement): Promise<void> {
    const errEl = this.container.querySelector<HTMLElement>('#quest-error')!;
    errEl.style.display = 'none';

    const name = (form.querySelector<HTMLInputElement>('[name="name"]')!).value.trim();
    const description = (form.querySelector<HTMLTextAreaElement>('[name="description"]')!).value.trim();
    const quest_type = (form.querySelector<HTMLSelectElement>('[name="quest_type"]')!).value;
    const chain_id = (form.querySelector<HTMLInputElement>('[name="chain_id"]')!).value.trim() || null;
    const chainStepRaw = (form.querySelector<HTMLInputElement>('[name="chain_step"]')!).value;
    const chain_step = chainStepRaw ? parseInt(chainStepRaw, 10) : null;
    const is_active = (form.querySelector<HTMLInputElement>('[name="is_active"]')!).checked;

    if (!name) { this.showFormError('Name is required.'); return; }
    if (!description) { this.showFormError('Description is required.'); return; }

    const objectives: QuestObjectiveData[] = this.objectiveRows.map((row, i) => ({
      objective_type: row.objective_type,
      target_id: row.target_id,
      target_quantity: row.target_quantity,
      target_duration: row.target_duration,
      dialog_prompt: row.dialog_prompt,
      dialog_response: row.dialog_response,
      sort_order: i,
    }));

    const prerequisites: QuestPrerequisiteData[] = this.prereqRows.map((row) => ({
      prereq_type: row.prereq_type,
      target_id: row.target_id,
      target_value: row.target_value,
    }));

    const rewards: QuestRewardData[] = this.rewardRows.map((row) => ({
      reward_type: row.reward_type,
      target_id: row.target_id,
      quantity: row.quantity,
    }));

    const npc_ids = Array.from(this.selectedNpcIds);

    try {
      if (this.editingId !== null) {
        await updateQuest(this.editingId, {
          name,
          description,
          quest_type,
          is_active,
          chain_id,
          chain_step,
          objectives,
          prerequisites,
          rewards,
          npc_ids,
        });
      } else {
        await createQuest({
          name,
          description,
          quest_type,
          is_active,
          chain_id,
          chain_step,
          objectives,
          prerequisites,
          rewards,
          npc_ids,
        });
      }
      this.resetForm();
      await this.load();
    } catch (err) {
      this.showFormError((err as Error).message);
    }
  }

  private resetForm(): void {
    this.editingId = null;
    this.objectiveRows = [];
    this.prereqRows = [];
    this.rewardRows = [];
    this.selectedNpcIds = new Set();
    const form = this.container.querySelector<HTMLFormElement>('#quest-form')!;
    form.reset();
    // Re-check the is_active checkbox since form.reset() will uncheck it
    (form.querySelector<HTMLInputElement>('[name="is_active"]')!).checked = true;
    this.container.querySelector<HTMLElement>('#quest-form-title')!.textContent = 'Create New Quest';
    this.container.querySelector<HTMLElement>('#quest-form-submit')!.textContent = 'Create Quest';
    this.container.querySelector<HTMLElement>('#quest-form-cancel')!.style.display = 'none';
    this.container.querySelector<HTMLElement>('#quest-error')!.style.display = 'none';
    this.renderObjectiveRows();
    this.renderPrereqRows();
    this.renderRewardRows();
    this.renderNpcCheckboxes();
    this.showStep(1);
  }

  private populateForm(quest: QuestResponse): void {
    this.editingId = quest.id;

    const form = this.container.querySelector<HTMLFormElement>('#quest-form')!;
    (form.querySelector<HTMLInputElement>('[name="name"]'))!.value = quest.name;
    (form.querySelector<HTMLTextAreaElement>('[name="description"]'))!.value = quest.description ?? '';
    (form.querySelector<HTMLSelectElement>('[name="quest_type"]'))!.value = quest.quest_type;
    (form.querySelector<HTMLInputElement>('[name="chain_id"]'))!.value = quest.chain_id ?? '';
    (form.querySelector<HTMLInputElement>('[name="chain_step"]'))!.value = quest.chain_step != null ? String(quest.chain_step) : '';
    (form.querySelector<HTMLInputElement>('[name="is_active"]'))!.checked = quest.is_active;

    this.objectiveRows = quest.objectives.map((obj) => ({
      objective_type: obj.objective_type,
      target_id: obj.target_id ?? null,
      target_quantity: obj.target_quantity ?? 1,
      target_duration: obj.target_duration ?? null,
      dialog_prompt: obj.dialog_prompt ?? null,
      dialog_response: obj.dialog_response ?? null,
    }));
    this.renderObjectiveRows();

    this.prereqRows = quest.prerequisites.map((p) => ({
      prereq_type: p.prereq_type,
      target_id: p.target_id ?? null,
      target_value: p.target_value,
    }));
    this.renderPrereqRows();

    this.rewardRows = quest.rewards.map((r) => ({
      reward_type: r.reward_type,
      target_id: r.target_id ?? null,
      quantity: r.quantity,
    }));
    this.renderRewardRows();

    this.selectedNpcIds = new Set(quest.npc_ids ?? []);
    this.renderNpcCheckboxes();

    this.container.querySelector<HTMLElement>('#quest-form-title')!.textContent = `Edit Quest #${quest.id}`;
    this.container.querySelector<HTMLElement>('#quest-form-submit')!.textContent = 'Update Quest';
    this.container.querySelector<HTMLElement>('#quest-form-cancel')!.style.display = '';
    this.container.querySelector<HTMLElement>('#quest-error')!.style.display = 'none';
    this.showStep(1);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  private renderList(): void {
    const container = this.container.querySelector<HTMLElement>('#quest-list-container')!;

    let filtered = this.quests;
    if (this.filterType) {
      filtered = filtered.filter((q) => q.quest_type === this.filterType);
    }
    if (this.filterName) {
      filtered = filtered.filter((q) => q.name.toLowerCase().includes(this.filterName));
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p style="color:#3d4262;font-size:0.875rem;">No quests found. Create one using the form.</p>';
      return;
    }

    const npcMap = new Map(this.npcs.map((n) => [n.id, n.name]));

    const table = document.createElement('table');
    table.className = 'item-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Chain</th>
          <th>NPCs</th>
          <th>Objectives</th>
          <th>Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody')!;

    for (const quest of filtered) {
      const tr = document.createElement('tr');

      const npcNames = (quest.npc_ids ?? [])
        .map((id) => npcMap.get(id) ?? `NPC #${id}`)
        .join(', ');

      const chainStr = quest.chain_id
        ? `${this.esc(quest.chain_id)}${quest.chain_step != null ? ` #${quest.chain_step}` : ''}`
        : '—';

      const objectivePills = quest.objectives.map((obj) => {
        const label = this.formatObjectiveLabel(obj);
        return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;letter-spacing:0.02em;background:#2a3048;color:#9ba8d0;white-space:nowrap;margin:1px 2px;">${this.esc(label)}</span>`;
      }).join('');

      const activeStr = quest.is_active
        ? '<span style="color:#4ade80;">Yes</span>'
        : '<span style="color:#f87171;">No</span>';

      tr.innerHTML = `
        <td>${this.esc(quest.name)}</td>
        <td style="text-transform:capitalize;">${this.esc(quest.quest_type)}</td>
        <td>${chainStr}</td>
        <td style="font-size:0.75rem;">${npcNames ? this.esc(npcNames) : '—'}</td>
        <td><div style="display:flex;flex-wrap:wrap;gap:2px;">${objectivePills || '—'}</div></td>
        <td>${activeStr}</td>
        <td>
          <button class="btn btn--sm btn-edit" data-id="${quest.id}">Edit</button>
          <button class="btn btn--sm btn--danger btn-delete" data-id="${quest.id}">Delete</button>
        </td>
      `;

      tr.querySelector('.btn-edit')!.addEventListener('click', () => {
        this.populateForm(quest);
      });

      tr.querySelector('.btn-delete')!.addEventListener('click', async () => {
        if (!confirm(`Delete quest "${quest.name}"? This cannot be undone.`)) return;
        try {
          await deleteQuest(quest.id);
          if (this.editingId === quest.id) this.resetForm();
          await this.load();
        } catch (err) {
          alert(`Failed to delete: ${(err as Error).message}`);
        }
      });

      tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
  }

  private formatObjectiveLabel(obj: QuestObjectiveData & { id?: number }): string {
    switch (obj.objective_type) {
      case 'kill_monster': {
        const name = obj.target_id ? (this.monsters.find((m) => m.id === obj.target_id)?.name ?? `Monster #${obj.target_id}`) : '?';
        return `Kill ${name} x${obj.target_quantity}`;
      }
      case 'collect_item':
      case 'craft_item': {
        const name = obj.target_id ? (this.items.find((i) => i.id === obj.target_id)?.name ?? `Item #${obj.target_id}`) : '?';
        const verb = obj.objective_type === 'collect_item' ? 'Collect' : 'Craft';
        return `${verb} ${name} x${obj.target_quantity}`;
      }
      case 'spend_crowns':
        return `Spend ${obj.target_quantity} crowns`;
      case 'gather_resource':
        return `Gather x${obj.target_quantity}${obj.target_id ? ` @${obj.target_id}` : ''}`;
      case 'reach_level':
        return `Reach level ${obj.target_quantity}`;
      case 'visit_location':
        return `Visit zone ${obj.target_id ?? '?'}`;
      case 'talk_to_npc': {
        const name = obj.target_id ? (this.npcs.find((n) => n.id === obj.target_id)?.name ?? `NPC #${obj.target_id}`) : '?';
        return `Talk to ${name}`;
      }
      default:
        return obj.objective_type;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private showFormError(msg: string): void {
    const el = this.container.querySelector<HTMLElement>('#quest-error')!;
    el.textContent = msg;
    el.style.display = '';
  }

  private showError(msg: string): void {
    const container = this.container.querySelector<HTMLElement>('#quest-list-container');
    if (container) container.innerHTML = `<p class="error">${this.esc(msg)}</p>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
