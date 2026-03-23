import type {
  CityMapBuilding,
  CityBuildingActionPayload,
  BuildingExploreResultPayload,
  ExpeditionStateDto,
  ExpeditionDispatchedPayload,
  ExpeditionCollectResultPayload,
  ExpeditionCompletedPayload,
  GatherBuildingActionDto,
  GatheringStartedPayload,
  GatheringTickPayload,
  GatheringEndedPayload,
  GatheringRejectedPayload,
  GatheringStartPayload,
} from '@elarion/protocol';
import { CombatModal } from './CombatModal';
import { CraftingModal } from './CraftingModal';
import { GatheringModal } from './GatheringModal';
import type { GatheringCombatLoot } from './GatheringModal';

type ActionCallback = (payload: CityBuildingActionPayload) => void;
type ExpeditionDispatchCallback = (buildingId: number, actionId: number, durationHours: 1 | 3 | 6) => void;
type ExpeditionCollectCallback = (expeditionId: number) => void;
type CraftingOpenCallback = (npcId: number) => void;
type GatheringStartCallback = (payload: GatheringStartPayload) => void;
type GatheringCancelCallback = () => void;
type InventorySlotsGetter = () => import('@elarion/protocol').InventorySlotDto[];

export class BuildingPanel {
  private panel: HTMLElement;
  private headerEl: HTMLElement;
  private bodyEl: HTMLElement;
  private onAction: ActionCallback | null = null;
  private onExpeditionDispatch: ExpeditionDispatchCallback | null = null;
  private onExpeditionCollect: ExpeditionCollectCallback | null = null;
  private combatModal: CombatModal;
  private craftingModal: CraftingModal;
  private onCraftingOpen: CraftingOpenCallback | null = null;
  private onGatheringStart: GatheringStartCallback | null = null;
  private onGatheringCancel: GatheringCancelCallback | null = null;
  private getInventorySlots: InventorySlotsGetter | null = null;
  private progressIntervals: number[] = [];
  private currentBuilding: CityMapBuilding | null = null;
  private currentExpeditionState: ExpeditionStateDto | undefined;
  private gatheringActive = false;
  private gatheringModal: GatheringModal;

  constructor(parent: HTMLElement, onAction: ActionCallback) {
    this.onAction = onAction;
    this.combatModal = new CombatModal(document.body);
    this.craftingModal = new CraftingModal(document.body);
    this.gatheringModal = new GatheringModal();

    this.panel = document.createElement('div');
    this.panel.id = 'building-panel';
    this.panel.style.cssText = [
      'width:100%',
      'height:100%',
      'background:rgba(15,13,10,0.92)',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'display:flex',
      'flex-direction:column',
      'box-sizing:border-box',
    ].join(';');

    this.headerEl = document.createElement('div');
    this.headerEl.style.cssText = 'padding:16px 16px 8px;border-bottom:1px solid #3a2e1a;flex-shrink:0;';

    this.bodyEl = document.createElement('div');
    this.bodyEl.style.cssText =
      'padding:12px 16px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;';

    this.panel.appendChild(this.headerEl);
    this.panel.appendChild(this.bodyEl);

    parent.appendChild(this.panel);

    this.renderEmpty();
  }

  setOnExpeditionDispatch(cb: ExpeditionDispatchCallback): void {
    this.onExpeditionDispatch = cb;
  }

  setOnExpeditionCollect(cb: ExpeditionCollectCallback): void {
    this.onExpeditionCollect = cb;
  }

  setOnCraftingOpen(cb: CraftingOpenCallback): void {
    this.onCraftingOpen = cb;
  }

  setOnGatheringStart(cb: GatheringStartCallback): void {
    this.onGatheringStart = cb;
  }

  setOnGatheringCancel(cb: GatheringCancelCallback): void {
    this.onGatheringCancel = cb;
  }

  setInventorySlotsGetter(getter: InventorySlotsGetter): void {
    this.getInventorySlots = getter;
  }

  getCraftingModal(): CraftingModal {
    return this.craftingModal;
  }

  show(building: CityMapBuilding, expeditionState?: ExpeditionStateDto): void {
    this.renderBuilding(building, expeditionState);
  }

  hide(): void {
    this.renderEmpty();
  }

  getCurrentBuilding(): CityMapBuilding | null {
    return this.currentBuilding;
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  private clearProgressIntervals(): void {
    for (const id of this.progressIntervals) window.clearInterval(id);
    this.progressIntervals = [];
  }

  private renderEmpty(): void {
    this.clearProgressIntervals();
    this.currentBuilding = null;
    this.currentExpeditionState = undefined;
    this.headerEl.innerHTML = '';
    const title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:13px;letter-spacing:0.08em;color:#4a3a22;';
    title.textContent = 'No Building Selected';
    this.headerEl.appendChild(title);

    this.bodyEl.innerHTML = '';
    const placeholder = document.createElement('p');
    placeholder.style.cssText =
      'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#3a2e1a;font-style:italic;';
    placeholder.textContent = 'Approach a building to interact.';
    this.bodyEl.appendChild(placeholder);
  }

  private renderBuilding(building: CityMapBuilding, expeditionState?: ExpeditionStateDto): void {
    this.clearProgressIntervals();
    this.currentBuilding = building;
    this.currentExpeditionState = expeditionState;
    // Header
    this.headerEl.innerHTML = '';
    const title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:15px;letter-spacing:0.08em;color:#e8c870;';
    title.textContent = building.name;
    this.headerEl.appendChild(title);

    // Body
    this.bodyEl.innerHTML = '';

    if (building.description) {
      const desc = document.createElement('p');
      desc.style.cssText =
        'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#a89060;line-height:1.5;';
      desc.textContent = building.description;
      this.bodyEl.appendChild(desc);
    }

    // ── NPCs section ─────────────────────────────────────────────────
    if (building.npcs && building.npcs.length > 0) {
      const npcsSection = document.createElement('div');
      npcsSection.style.cssText = 'border-top:1px solid #3a2e1a;padding-top:10px;';

      const npcsTitle = document.createElement('p');
      npcsTitle.style.cssText = 'margin:0 0 8px;font-family:Cinzel,serif;font-size:11px;letter-spacing:0.08em;color:#c9a55c;';
      npcsTitle.textContent = 'You can find here:';
      npcsSection.appendChild(npcsTitle);

      for (const npc of building.npcs) {
        const npcRow = document.createElement('div');
        npcRow.style.cssText = [
          'display:flex',
          'align-items:center',
          'gap:8px',
          'padding:6px 8px',
          'cursor:pointer',
          'border:1px solid transparent',
          'border-radius:3px',
          'transition:background 0.15s,border-color 0.15s',
        ].join(';');

        npcRow.addEventListener('mouseenter', () => {
          npcRow.style.background = 'rgba(90,74,42,0.3)';
          npcRow.style.borderColor = '#5a4a2a';
        });
        npcRow.addEventListener('mouseleave', () => {
          npcRow.style.background = '';
          npcRow.style.borderColor = 'transparent';
        });
        npcRow.addEventListener('click', () => {
          this.renderNpcPanel(npc);
        });

        const icon = document.createElement('img');
        icon.src = npc.icon_url;
        icon.alt = npc.name;
        icon.style.cssText = 'width:56px;height:56px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;border-radius:6px;';

        const name = document.createElement('span');
        name.style.cssText = 'font-family:"Crimson Text",serif;font-size:14px;color:#e8c870;';
        name.textContent = npc.name;

        npcRow.appendChild(icon);
        npcRow.appendChild(name);
        npcsSection.appendChild(npcRow);
      }

      this.bodyEl.appendChild(npcsSection);
    }

    if (building.actions.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText =
        'margin:0;font-family:"Crimson Text",serif;font-size:12px;color:#6a5a3a;font-style:italic;';
      empty.textContent = 'Nothing to do here.';
      this.bodyEl.appendChild(empty);
    } else {
      const actionsSection = document.createElement('div');
      actionsSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:4px;';

      for (const action of building.actions) {
        if (action.action_type === 'expedition') {
          actionsSection.appendChild(
            this.renderExpeditionSection(building.id, action.id, expeditionState),
          );
          continue;
        }

        if (action.action_type === 'gather') {
          actionsSection.appendChild(
            this.renderGatherSection(building.id, action as GatherBuildingActionDto),
          );
          continue;
        }

        const btn = document.createElement('button');
        btn.dataset['actionId'] = String(action.id);
        btn.dataset['actionType'] = action.action_type;
        btn.style.cssText = [
          'width:100%',
          'padding:9px 12px',
          'background:rgba(90,74,42,0.4)',
          'border:1px solid #5a4a2a',
          'color:#e8c870',
          'font-family:Cinzel,serif',
          'font-size:12px',
          'letter-spacing:0.06em',
          'cursor:pointer',
          'text-align:left',
          'transition:background 0.15s',
        ].join(';');
        btn.textContent = action.label;

        btn.addEventListener('mouseenter', () => {
          if (!btn.disabled) btn.style.background = 'rgba(90,74,42,0.75)';
        });
        btn.addEventListener('mouseleave', () => {
          if (!btn.disabled) btn.style.background = 'rgba(90,74,42,0.4)';
        });

        btn.addEventListener('click', () => {
          this.disableButtons();
          this.onAction?.({
            building_id: building.id,
            action_id: action.id,
            action_type: action.action_type as 'travel' | 'explore',
          });
        });

        actionsSection.appendChild(btn);
      }

      this.bodyEl.appendChild(actionsSection);
    }

    // Error area
    const errorEl = document.createElement('p');
    errorEl.id = 'building-panel-error';
    errorEl.style.cssText =
      'margin:0;font-family:"Crimson Text",serif;font-size:12px;color:#c0504a;display:none;';
    this.bodyEl.appendChild(errorEl);
  }

  // ---------------------------------------------------------------------------
  // Gather section
  // ---------------------------------------------------------------------------

  private renderGatherSection(buildingId: number, action: GatherBuildingActionDto): HTMLElement {
    const cfg = action.config;
    const section = document.createElement('div');
    section.id = `gather-section-${action.id}`;
    section.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:8px;background:rgba(60,50,30,0.3);border:1px solid #3a2e1a;border-radius:4px;';

    // Title
    const label = document.createElement('div');
    label.style.cssText = 'font-size:13px;color:#e8c870;font-family:Cinzel,serif;';
    label.textContent = action.label;
    section.appendChild(label);

    // Find ALL matching tools
    const slots = this.getInventorySlots?.() ?? [];
    const toolSlots = slots.filter(
      (s) => s.definition.tool_type === cfg.required_tool_type && (s.current_durability ?? 0) > 0,
    );
    const totalDurability = toolSlots.reduce((sum, s) => sum + (s.current_durability ?? 0), 0);
    const totalMaxDur = toolSlots.reduce((sum, s) => sum + (s.definition.max_durability ?? 0), 0);
    const hasTools = toolSlots.length > 0;
    const toolName = toolSlots[0]?.definition.name;

    // Tool info
    const toolInfo = document.createElement('div');
    toolInfo.style.cssText = 'font-size:11px;font-family:"Crimson Text",serif;';
    if (hasTools) {
      toolInfo.style.color = '#a89060';
      const countLabel = toolSlots.length > 1 ? ` (×${toolSlots.length})` : '';
      toolInfo.innerHTML =
        `<span style="color:#c8b88a;">${this.esc(toolName ?? cfg.required_tool_type)}${countLabel}</span> ` +
        `<span style="color:${totalDurability > 100 ? '#8a9a6a' : '#c08060'};">${totalDurability} / ${totalMaxDur}</span> durability`;
    } else {
      toolInfo.style.color = '#c06050';
      toolInfo.textContent = `No ${cfg.required_tool_type} in inventory`;
    }
    section.appendChild(toolInfo);

    // Duration slider
    const sliderLabel = document.createElement('div');
    sliderLabel.style.cssText = 'font-size:10px;color:#6a5a3a;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;';
    sliderLabel.textContent = 'Gathering duration';
    section.appendChild(sliderLabel);

    const sliderRow = document.createElement('div');
    sliderRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(cfg.min_seconds);
    slider.max = String(cfg.max_seconds);
    slider.value = String(cfg.min_seconds);
    slider.style.cssText = 'flex:1;accent-color:#d4a84b;';

    const durLabel = document.createElement('span');
    durLabel.style.cssText = 'font-size:12px;color:#c8b88a;min-width:32px;text-align:right;';
    durLabel.textContent = `${slider.value}s`;

    sliderRow.appendChild(slider);
    sliderRow.appendChild(durLabel);
    section.appendChild(sliderRow);

    // Durability cost display
    const costInfo = document.createElement('div');
    costInfo.style.cssText = 'font-size:11px;font-family:"Crimson Text",serif;';
    const updateCost = () => {
      const dur = Number(slider.value);
      const cost = dur * cfg.durability_per_second;
      const canAfford = totalDurability >= cost;
      durLabel.textContent = `${dur}s`;
      costInfo.innerHTML =
        `<span style="color:#8a7a5a;">Durability cost:</span> ` +
        `<span style="color:${canAfford ? '#8a9a6a' : '#c06050'};font-weight:600;">${cost}</span>` +
        `<span style="color:#6a5a3a;"> (${cfg.durability_per_second}/s × ${dur}s)</span>`;
    };
    updateCost();
    slider.addEventListener('input', updateCost);
    section.appendChild(costInfo);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.style.cssText = [
      'width:100%', 'padding:8px', 'background:rgba(90,74,42,0.5)', 'border:1px solid #5a4a2a',
      'color:#e8c870', 'font-family:Cinzel,serif', 'font-size:12px', 'cursor:pointer',
      'letter-spacing:0.06em', 'transition:background 0.15s', 'margin-top:2px',
    ].join(';');
    startBtn.textContent = 'Start Gathering';

    if (!hasTools) {
      startBtn.disabled = true;
      startBtn.style.opacity = '0.4';
      startBtn.style.cursor = 'default';
    }

    startBtn.addEventListener('mouseenter', () => {
      if (!startBtn.disabled) startBtn.style.background = 'rgba(90,74,42,0.8)';
    });
    startBtn.addEventListener('mouseleave', () => {
      if (!startBtn.disabled) startBtn.style.background = 'rgba(90,74,42,0.5)';
    });

    startBtn.addEventListener('click', () => {
      if (!hasTools) return;
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      this.onGatheringStart?.({
        building_id: buildingId,
        action_id: action.id,
        duration: Number(slider.value),
      });
    });

    section.appendChild(startBtn);
    return section;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Gathering event handlers ───────────────────────────────────────────

  isGatheringActive(): boolean {
    return this.gatheringActive;
  }

  getGatheringModal(): GatheringModal {
    return this.gatheringModal;
  }

  handleGatheringStarted(payload: GatheringStartedPayload): void {
    this.gatheringActive = true;
    this.gatheringModal.setOnCancel(() => this.onGatheringCancel?.());
    this.gatheringModal.open(payload.duration);
  }

  handleGatheringTick(payload: GatheringTickPayload): void {
    this.gatheringModal.handleTick(payload);
  }

  handleGatheringEnded(payload: GatheringEndedPayload): void {
    this.gatheringActive = false;
    this.gatheringModal.handleEnded(payload);
  }

  handleGatheringRejected(payload: GatheringRejectedPayload): void {
    const errorEl = this.bodyEl.querySelector<HTMLElement>('#building-panel-error');
    if (errorEl) {
      errorEl.textContent = payload.message;
      errorEl.style.display = 'block';
    }
    this.enableButtons();
  }

  addGatheringCombatLoot(loot: GatheringCombatLoot): void {
    this.gatheringModal.addCombatLoot(loot);
  }

  handleGatheringCombatPause(monsterName: string, monsterIconUrl: string | null): void {
    this.gatheringModal.handleCombatPause(monsterName, monsterIconUrl);
  }

  handleGatheringCombatResume(): void {
    this.gatheringModal.handleCombatResume();
  }

  // ---------------------------------------------------------------------------
  // NPC panel
  // ---------------------------------------------------------------------------

  private renderNpcPanel(npc: { id: number; name: string; description: string; icon_url: string; is_crafter: boolean }): void {
    // Header: NPC name with back chevron
    this.headerEl.innerHTML = '';

    const backBtn = document.createElement('button');
    backBtn.style.cssText = [
      'background:none',
      'border:none',
      'padding:0 6px 0 0',
      'cursor:pointer',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'font-size:15px',
      'line-height:1',
      'vertical-align:middle',
    ].join(';');
    backBtn.textContent = '‹';
    backBtn.addEventListener('click', () => {
      if (this.currentBuilding) {
        this.renderBuilding(this.currentBuilding, this.currentExpeditionState);
      }
    });

    const title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:15px;letter-spacing:0.08em;color:#e8c870;display:flex;align-items:center;gap:4px;';
    title.appendChild(backBtn);
    title.appendChild(document.createTextNode(npc.name));
    this.headerEl.appendChild(title);

    // Body: image left + description right, then dialog options
    this.bodyEl.innerHTML = '';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;gap:14px;align-items:flex-start;';

    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = [
      'width:96px',
      'height:96px',
      'flex-shrink:0',
      'border-radius:6px',
      'background:rgba(20,16,8,0.8)',
      'border:1px solid #3a2e1a',
      'overflow:hidden',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    const img = document.createElement('img');
    img.src = npc.icon_url;
    img.alt = npc.name;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
    imgWrap.appendChild(img);

    const descEl = document.createElement('p');
    descEl.style.cssText = [
      'margin:0',
      'font-family:"Crimson Text",serif',
      'font-size:14px',
      'color:#a89060',
      'line-height:1.55',
      'flex:1',
      'white-space:pre-wrap',
    ].join(';');
    descEl.textContent = npc.description;

    topRow.appendChild(imgWrap);
    topRow.appendChild(descEl);
    this.bodyEl.appendChild(topRow);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'border-top:1px solid #3a2e1a;';
    this.bodyEl.appendChild(divider);

    // Dialog options label
    const dialogLabel = document.createElement('p');
    dialogLabel.style.cssText = 'margin:0;font-family:Cinzel,serif;font-size:11px;letter-spacing:0.08em;color:#c9a55c;';
    dialogLabel.textContent = 'What would you like to say?';
    this.bodyEl.appendChild(dialogLabel);

    // Dialog options
    const optionsEl = document.createElement('div');
    optionsEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    if (npc.is_crafter) {
      const craftOption = this.buildDialogOption('I want to craft some items', () => {
        this.onCraftingOpen?.(npc.id);
      });
      optionsEl.appendChild(craftOption);
    }

    const backOption = this.buildDialogOption('Leave', () => {
      if (this.currentBuilding) {
        this.renderBuilding(this.currentBuilding, this.currentExpeditionState);
      }
    });
    optionsEl.appendChild(backOption);

    this.bodyEl.appendChild(optionsEl);
  }

  private buildDialogOption(text: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.style.cssText = [
      'width:100%',
      'padding:9px 12px',
      'background:rgba(90,74,42,0.25)',
      'border:1px solid #5a4a2a',
      'color:#e8c870',
      'font-family:"Crimson Text",serif',
      'font-size:14px',
      'cursor:pointer',
      'text-align:left',
      'transition:background 0.15s',
      'border-radius:2px',
    ].join(';');
    btn.textContent = `› ${text}`;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(90,74,42,0.6)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(90,74,42,0.25)'; });
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Expedition UI
  // ---------------------------------------------------------------------------

  private renderExpeditionSection(
    buildingId: number,
    actionId: number,
    state: ExpeditionStateDto | undefined,
    rewardMessage?: string,
  ): HTMLElement {
    const section = document.createElement('div');
    section.dataset['expeditionSection'] = String(actionId);
    section.style.cssText =
      'border:1px solid #3a2e1a;border-radius:4px;padding:10px;background:rgba(20,16,8,0.7);';

    const title = document.createElement('p');
    title.style.cssText = 'margin:0 0 8px;font-size:12px;letter-spacing:0.06em;color:#c9a55c;';
    title.textContent = 'EXPEDITION';
    section.appendChild(title);

    if (!state || state.squire_status === 'idle') {
      if (rewardMessage) {
        const reward = document.createElement('p');
        reward.style.cssText = 'margin:0 0 8px;font-family:"Crimson Text",serif;font-size:12px;color:#b8e870;';
        reward.textContent = rewardMessage;
        section.appendChild(reward);
      }

      const squireLabel = document.createElement('p');
      squireLabel.style.cssText = 'margin:0 0 10px;font-family:"Crimson Text",serif;font-size:13px;color:#a89060;';
      squireLabel.textContent = state ? `${state.squire_name} is ready to depart.` : 'Your squire awaits.';
      section.appendChild(squireLabel);

      if (state?.duration_options) {
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;';

        for (const opt of state.duration_options) {
          const btn = document.createElement('button');
          btn.style.cssText = [
            'flex:1',
            'padding:8px 0',
            'background:rgba(90,74,42,0.5)',
            'border:1px solid #7a6a3a',
            'color:#e8c870',
            'font-family:Cinzel,serif',
            'font-size:12px',
            'cursor:pointer',
          ].join(';');
          btn.textContent = `${opt.duration_hours}h`;
          btn.addEventListener('click', () => {
            btn.disabled = true;
            this.onExpeditionDispatch?.(buildingId, actionId, opt.duration_hours);
          });
          btnRow.appendChild(btn);
        }

        section.appendChild(btnRow);
      }
    } else if (state.squire_status === 'exploring') {
      const info = document.createElement('p');
      info.style.cssText = 'margin:0 0 10px;font-family:"Crimson Text",serif;font-size:13px;color:#a89060;';
      info.textContent = `${state.squire_name} is on expedition.`;
      section.appendChild(info);

      if (state.started_at && state.completes_at) {
        const startMs = new Date(state.started_at).getTime();
        const endMs = new Date(state.completes_at).getTime();

        // Progress bar track
        const track = document.createElement('div');
        track.style.cssText = 'width:100%;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;margin-bottom:6px;';
        const fill = document.createElement('div');
        fill.style.cssText = 'height:100%;background:#b8860b;border-radius:3px;transition:width 1s linear;';
        track.appendChild(fill);
        section.appendChild(track);

        // Remaining time label
        const timeLabel = document.createElement('p');
        timeLabel.style.cssText = 'margin:0;font-family:"Crimson Text",serif;font-size:12px;color:#7a6a4a;text-align:right;';
        section.appendChild(timeLabel);

        const update = (): void => {
          const now = Date.now();
          const elapsed = now - startMs;
          const total = endMs - startMs;
          const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
          fill.style.width = `${pct}%`;

          const remaining = Math.max(0, endMs - now);
          const totalSec = Math.floor(remaining / 1000);
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          timeLabel.textContent = h > 0
            ? `${h}h ${m}m left`
            : m > 0
              ? `${m}m ${s}s left`
              : `${s}s left`;
        };

        update();
        const interval = window.setInterval(update, 1000);
        this.progressIntervals.push(interval);
      }
    } else {
      // ready
      const info = document.createElement('p');
      info.style.cssText = 'margin:0 0 8px;font-family:"Crimson Text",serif;font-size:13px;color:#a89060;';
      info.textContent = `${state.squire_name} has returned with rewards!`;
      section.appendChild(info);

      if (state.collectable_rewards) {
        const r = state.collectable_rewards;
        const rewardInfo = document.createElement('p');
        rewardInfo.style.cssText = 'margin:0 0 8px;font-family:"Crimson Text",serif;font-size:12px;color:#8a7a5a;';
        const itemSummary = r.items.length > 0
          ? ` + ${r.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`
          : '';
        rewardInfo.textContent = `${r.gold}g / ${r.exp}xp${itemSummary}`;
        section.appendChild(rewardInfo);
      }

      const collectBtn = document.createElement('button');
      collectBtn.style.cssText = [
        'width:100%',
        'padding:8px',
        'background:rgba(90,120,60,0.5)',
        'border:1px solid #5a8a3a',
        'color:#b8e870',
        'font-family:Cinzel,serif',
        'font-size:12px',
        'cursor:pointer',
      ].join(';');
      collectBtn.textContent = 'Collect Rewards';
      collectBtn.addEventListener('click', () => {
        collectBtn.disabled = true;
        if (state.expedition_id !== undefined) {
          this.onExpeditionCollect?.(state.expedition_id);
        }
      });
      section.appendChild(collectBtn);
    }

    return section;
  }

  showExpeditionDispatched(payload: ExpeditionDispatchedPayload): void {
    const completesAt = new Date(payload.completes_at).toLocaleTimeString();
    this.appendFeedback(
      `${payload.squire_name} departed for ${payload.building_name} (${payload.duration_hours}h). Returns at ${completesAt}.`,
      '#b8e870',
    );
  }

  handleExpeditionCompleted(payload: ExpeditionCompletedPayload): void {
    if (!this.currentExpeditionState) return;
    this.currentExpeditionState = {
      ...this.currentExpeditionState,
      squire_status: 'ready',
      expedition_id: payload.expedition_id,
      started_at: undefined,
      completes_at: undefined,
    };
    this.refreshExpeditionSection();
  }

  showExpeditionCollectResult(payload: ExpeditionCollectResultPayload): void {
    const r = payload.rewards;
    const itemSummary = r.items.length > 0
      ? ` + ${r.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`
      : '';
    const skipped = payload.items_skipped ? ' (some items skipped — inventory full)' : '';
    const rewardMsg = `${payload.squire_name} returned: ${r.gold}g / ${r.exp}xp${itemSummary}${skipped}`;

    if (this.currentExpeditionState) {
      this.currentExpeditionState = {
        ...this.currentExpeditionState,
        squire_status: 'idle',
        expedition_id: undefined,
        collectable_rewards: undefined,
        started_at: undefined,
        completes_at: undefined,
      };
      this.refreshExpeditionSection(rewardMsg);
    } else {
      this.appendFeedback(rewardMsg, '#b8e870');
    }
  }

  private refreshExpeditionSection(rewardMessage?: string): void {
    const section = this.bodyEl.querySelector<HTMLElement>('[data-expedition-section]');
    if (!section || !this.currentBuilding) return;
    const actionId = parseInt(section.dataset['expeditionSection'] ?? '0', 10);
    this.clearProgressIntervals();
    const newSection = this.renderExpeditionSection(
      this.currentBuilding.id, actionId, this.currentExpeditionState, rewardMessage,
    );
    section.replaceWith(newSection);
  }

  showExpeditionRejection(reason: string): void {
    const messages: Record<string, string> = {
      NO_SQUIRE_AVAILABLE: 'Your squire is already on an expedition.',
      INVALID_DURATION: 'Invalid expedition duration.',
      NOT_AT_BUILDING: 'You are no longer at this building.',
      NO_EXPEDITION_CONFIG: 'Expedition not available at this building.',
      IN_COMBAT: 'You cannot dispatch while in combat.',
      NOT_CITY_MAP: 'Expeditions are only available in city maps.',
    };
    this.appendFeedback(messages[reason] ?? 'Expedition failed. Please try again.', '#c0504a');
  }

  private appendFeedback(text: string, color: string): void {
    const el = document.createElement('p');
    el.style.cssText = `margin:4px 0 0;font-family:"Crimson Text",serif;font-size:12px;color:${color};`;
    el.textContent = text;
    this.bodyEl.appendChild(el);
  }

  // ---------------------------------------------------------------------------
  // Post-action feedback
  // ---------------------------------------------------------------------------

  showRejection(reason: string): void {
    this.enableButtons();
    const errorEl = this.bodyEl.querySelector<HTMLElement>('#building-panel-error');
    if (errorEl) {
      errorEl.textContent = this.rejectionMessage(reason);
      errorEl.style.display = 'block';
    }
  }

  showExploreResult(result: BuildingExploreResultPayload): void {
    this.enableButtons();
    void this.combatModal.show(result);
  }

  disableButtons(): void {
    this.bodyEl.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    });
  }

  enableButtons(): void {
    this.bodyEl.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    });
  }

  private rejectionMessage(reason: string): string {
    switch (reason) {
      case 'NOT_AT_BUILDING':      return 'You are no longer at this building.';
      case 'INVALID_ACTION':       return 'This action is no longer available.';
      case 'INVALID_DESTINATION':  return 'The destination no longer exists.';
      case 'IN_COMBAT':            return 'You cannot travel while in combat.';
      case 'NOT_CITY_MAP':         return 'Travel is only available in city maps.';
      case 'EXPLORE_FAILED':       return 'Exploration failed. Please try again.';
      default:                     return 'Action failed. Please try again.';
    }
  }

  destroy(): void {
    this.clearProgressIntervals();
    this.gatheringModal.close();
    this.panel.remove();
    this.combatModal.close();
    this.craftingModal.close();
  }
}
