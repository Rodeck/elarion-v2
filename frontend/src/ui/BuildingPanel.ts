import type {
  CityMapBuilding,
  CityBuildingActionPayload,
  BuildingExploreResultPayload,
  ExpeditionStateDto,
  SquireRosterDto,
  CharacterSquireDto,
  ExpeditionDispatchedPayload,
  ExpeditionCollectResultPayload,
  ExpeditionCompletedPayload,
  GatherBuildingActionDto,
  GatheringStartedPayload,
  GatheringTickPayload,
  GatheringEndedPayload,
  GatheringRejectedPayload,
  GatheringStartPayload,
  BossDto,
} from '@elarion/protocol';
import { CombatModal } from './CombatModal';
import { getXpIconUrl, getCrownsIconUrl } from './ui-icons';
import { CraftingModal } from './CraftingModal';
import { GatheringModal } from './GatheringModal';
import { MarketplaceModal } from './MarketplaceModal';
import type { MarketplaceBuildingActionDto, FishingBuildingActionDto, ArenaBuildingActionDto } from '@elarion/protocol';
import type { GatheringCombatLoot } from './GatheringModal';

type ActionCallback = (payload: CityBuildingActionPayload) => void;
type ExpeditionDispatchCallback = (buildingId: number, actionId: number, durationHours: 1 | 3 | 6, squireId: number) => void;
type ExpeditionCollectCallback = (expeditionId: number) => void;
type CraftingOpenCallback = (npcId: number) => void;
type QuestOpenCallback = (npcId: number) => void;
type NpcDialogsRequestCallback = (npcId: number) => void;
type QuestTalkCompleteCallback = (npcId: number, charQuestId: number, objectiveId: number) => void;

interface NpcQuestDialog {
  character_quest_id: number;
  quest_name: string;
  objective_id: number;
  dialog_prompt: string;
  dialog_response: string;
}
type SquireDismissListCallback = (npcId: number) => void;
type SquireDismissConfirmCallback = (squireId: number) => void;
type GatheringStartCallback = (payload: GatheringStartPayload) => void;
type GatheringCancelCallback = () => void;
type FishingCastCallback = (buildingId: number, actionId: number) => void;
type FishingUpgradeCallback = (npcId: number) => void;
type FishingRepairCallback = (npcId: number) => void;
type DisassemblyOpenCallback = (npcId: number) => void;
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
  private onQuestOpen: QuestOpenCallback | null = null;
  private onNpcDialogsRequest: NpcDialogsRequestCallback | null = null;
  private onQuestTalkComplete: QuestTalkCompleteCallback | null = null;
  private onSquireDismissList: SquireDismissListCallback | null = null;
  private onSquireDismissConfirm: SquireDismissConfirmCallback | null = null;
  private pendingNpcDialogs: NpcQuestDialog[] = [];
  private currentNpcForDialogs: number | null = null;
  private onGatheringStart: GatheringStartCallback | null = null;
  private onGatheringCancel: GatheringCancelCallback | null = null;
  private onFishingCast: FishingCastCallback | null = null;
  private onFishingUpgrade: FishingUpgradeCallback | null = null;
  private onFishingRepair: FishingRepairCallback | null = null;
  private onDisassemblyOpen: DisassemblyOpenCallback | null = null;
  private onTrainingOpen: ((npcId: number) => void) | null = null;
  private getInventorySlots: InventorySlotsGetter | null = null;
  private progressIntervals: number[] = [];
  private currentBuilding: CityMapBuilding | null = null;
  private expeditionStates = new Map<number, ExpeditionStateDto>(); // action_id → state
  private currentSquireRoster: SquireRosterDto | null = null;
  private gatheringActive = false;
  private gatheringModal: GatheringModal;
  private bossBlockers = new Map<number, BossDto>(); // buildingId → boss
  private onBossChallenge: ((boss: BossDto) => void) | null = null;
  private marketplaceModal: MarketplaceModal;

  constructor(parent: HTMLElement, onAction: ActionCallback) {
    this.onAction = onAction;
    this.combatModal = new CombatModal(document.body);
    this.craftingModal = new CraftingModal(document.body);
    this.gatheringModal = new GatheringModal();
    this.marketplaceModal = new MarketplaceModal(document.body);

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

  setOnQuestOpen(cb: QuestOpenCallback): void {
    this.onQuestOpen = cb;
  }

  setOnNpcDialogsRequest(cb: NpcDialogsRequestCallback): void {
    this.onNpcDialogsRequest = cb;
  }

  setOnQuestTalkComplete(cb: QuestTalkCompleteCallback): void {
    this.onQuestTalkComplete = cb;
  }

  updateSquireRoster(roster: SquireRosterDto): void {
    this.currentSquireRoster = roster;
    // Refresh all expedition sections so idle squire lists are up-to-date
    this.refreshAllExpeditionSections();
  }

  setOnSquireDismissList(cb: SquireDismissListCallback): void {
    this.onSquireDismissList = cb;
  }

  setOnSquireDismissConfirm(cb: SquireDismissConfirmCallback): void {
    this.onSquireDismissConfirm = cb;
  }

  /** Show the list of dismissable squires after server responds */
  showSquireDismissList(squires: import('@elarion/protocol').CharacterSquireDto[]): void {
    this.bodyEl.innerHTML = '';

    const header = document.createElement('p');
    header.style.cssText = 'margin:0 0 10px;font-family:"Crimson Text",serif;font-size:14px;color:#a89060;';
    header.textContent = squires.length === 0
      ? 'You have no squires available for dismissal.'
      : 'Select a squire to dismiss:';
    this.bodyEl.appendChild(header);

    for (const sq of squires) {
      const row = this.buildDialogOption(`${sq.name} — ${sq.rank} (Power: ${sq.power_level})`, () => {
        this.showSquireDismissConfirm(sq);
      });
      this.bodyEl.appendChild(row);
    }

    const backBtn = this.buildDialogOption('Cancel', () => {
      if (this.currentBuilding) {
        this.renderBuilding(this.currentBuilding);
      }
    });
    this.bodyEl.appendChild(backBtn);
  }

  private showSquireDismissConfirm(squire: import('@elarion/protocol').CharacterSquireDto): void {
    this.bodyEl.innerHTML = '';

    const confirm = document.createElement('p');
    confirm.style.cssText = 'margin:0 0 12px;font-family:"Crimson Text",serif;font-size:14px;color:#c06050;';
    confirm.textContent = `Are you sure you want to dismiss ${squire.name}? This is permanent.`;
    this.bodyEl.appendChild(confirm);

    const yesBtn = this.buildDialogOption('Yes, dismiss this squire', () => {
      this.onSquireDismissConfirm?.(squire.id);
    });
    this.bodyEl.appendChild(yesBtn);

    const noBtn = this.buildDialogOption('No, go back', () => {
      if (this.currentBuilding) {
        this.renderBuilding(this.currentBuilding);
      }
    });
    this.bodyEl.appendChild(noBtn);
  }

  /** Called when server responds with pending NPC dialogs */
  handleNpcDialogs(npcId: number, dialogs: NpcQuestDialog[]): void {
    if (this.currentNpcForDialogs !== npcId) return;
    this.pendingNpcDialogs = dialogs;
    // Re-render the dialog options area if we have a placeholder
    const placeholder = this.bodyEl.querySelector('[data-quest-dialogs]');
    if (placeholder && dialogs.length > 0) {
      for (const d of dialogs) {
        const option = this.buildDialogOption(`${d.dialog_prompt}`, () => {
          this.showNpcResponse(d);
        });
        option.style.borderColor = '#4a6a3a';
        option.style.color = '#b8e870';
        placeholder.before(option);
      }
      placeholder.remove();
    }
  }

  /** Called when server confirms talk objective completed — shows NPC response with typewriter animation */
  handleTalkCompleted(response: string): void {
    // Remove any existing response element to prevent duplicates
    const existing = this.bodyEl.querySelector('[data-npc-response]');
    if (existing) existing.remove();

    const responseEl = document.createElement('div');
    responseEl.setAttribute('data-npc-response', '');
    responseEl.style.cssText = [
      'padding:10px 12px',
      'background:rgba(60,80,40,0.2)',
      'border:1px solid #4a6a3a',
      'border-radius:4px',
      'font-family:"Crimson Text",serif',
      'font-size:14px',
      'color:#b8e870',
      'font-style:italic',
      'line-height:1.5',
      'min-height:1.5em',
    ].join(';');
    this.bodyEl.appendChild(responseEl);

    // Typewriter animation
    const fullText = `"${response}"`;
    let charIdx = 0;
    const typeSpeed = 25; // ms per character
    const type = () => {
      if (charIdx < fullText.length) {
        responseEl.textContent = fullText.slice(0, charIdx + 1);
        charIdx++;
        setTimeout(type, typeSpeed);
      }
    };
    type();
  }

  private showNpcResponse(dialog: NpcQuestDialog): void {
    // Send completion to server — server response will trigger handleTalkCompleted
    if (this.currentNpcForDialogs != null) {
      this.onQuestTalkComplete?.(this.currentNpcForDialogs, dialog.character_quest_id, dialog.objective_id);
    }
    // Remove this dialog option from pending
    this.pendingNpcDialogs = this.pendingNpcDialogs.filter(
      (d) => !(d.character_quest_id === dialog.character_quest_id && d.objective_id === dialog.objective_id),
    );
  }

  setOnGatheringStart(cb: GatheringStartCallback): void {
    this.onGatheringStart = cb;
  }

  setOnGatheringCancel(cb: GatheringCancelCallback): void {
    this.onGatheringCancel = cb;
  }

  setOnFishingCast(cb: FishingCastCallback): void {
    this.onFishingCast = cb;
  }

  setOnFishingUpgrade(cb: FishingUpgradeCallback): void {
    this.onFishingUpgrade = cb;
  }

  setOnFishingRepair(cb: FishingRepairCallback): void {
    this.onFishingRepair = cb;
  }

  setOnDisassemblyOpen(cb: DisassemblyOpenCallback): void {
    this.onDisassemblyOpen = cb;
  }

  setOnTrainingOpen(cb: (npcId: number) => void): void {
    this.onTrainingOpen = cb;
  }

  setInventorySlotsGetter(getter: InventorySlotsGetter): void {
    this.getInventorySlots = getter;
  }

  getCraftingModal(): CraftingModal {
    return this.craftingModal;
  }

  setOnBossChallenge(cb: (boss: BossDto) => void): void {
    this.onBossChallenge = cb;
  }

  setBossBlockers(bosses: BossDto[]): void {
    this.bossBlockers.clear();
    for (const b of bosses) {
      if (b.status === 'alive' || b.status === 'in_combat') {
        this.bossBlockers.set(b.building_id, b);
      }
    }
    // Re-render if currently showing a building that is now blocked/unblocked
    if (this.currentBuilding) {
      this.renderBuilding(this.currentBuilding);
    }
  }

  show(building: CityMapBuilding, expeditionState?: ExpeditionStateDto): void {
    if (expeditionState) {
      this.expeditionStates.set(expeditionState.action_id, expeditionState);
    }
    this.renderBuilding(building, expeditionState);
  }

  showWithStates(building: CityMapBuilding, states: ExpeditionStateDto[]): void {
    for (const s of states) {
      this.expeditionStates.set(s.action_id, s);
    }
    this.renderBuilding(building);
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
    this.expeditionStates.clear();
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
    if (expeditionState) {
      this.expeditionStates.set(expeditionState.action_id, expeditionState);
    }
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

    // ── Boss blocker check ───────────────────────────────────────────
    const blocker = this.bossBlockers.get(building.id);
    if (blocker) {
      const blockerDiv = document.createElement('div');
      blockerDiv.style.cssText =
        'border:1px solid #6b2020;background:rgba(80,20,20,0.3);border-radius:4px;padding:14px;text-align:center;margin-top:8px;';

      const icon = document.createElement('div');
      icon.style.cssText = 'font-size:28px;margin-bottom:8px;';
      icon.textContent = '\u2694\uFE0F'; // crossed swords
      blockerDiv.appendChild(icon);

      const msg = document.createElement('p');
      msg.style.cssText =
        'margin:0 0 6px;font-family:"Crimson Text",serif;font-size:14px;color:#e87070;line-height:1.5;';
      msg.innerHTML = `<strong>${blocker.name}</strong> blocks this building.`;
      blockerDiv.appendChild(msg);

      const hint = document.createElement('p');
      hint.style.cssText =
        'margin:0;font-family:"Crimson Text",serif;font-size:12px;color:#a89060;font-style:italic;';
      if (blocker.status === 'in_combat') {
        hint.textContent = blocker.fighting_character_name
          ? `${blocker.fighting_character_name} is fighting the guardian...`
          : 'Someone is fighting the guardian...';
      } else {
        hint.textContent = 'Defeat the guardian to gain access.';
      }
      blockerDiv.appendChild(hint);

      // Challenge button
      const challengeBtn = document.createElement('button');
      challengeBtn.style.cssText = [
        'margin-top:12px', 'padding:8px 20px',
        'font-family:Cinzel,serif', 'font-size:12px', 'letter-spacing:0.06em',
        'color:#e8c870', 'background:#3a1515', 'border:1px solid #6b2020',
        'border-radius:4px', 'cursor:pointer',
        'transition:background 0.15s,border-color 0.15s',
      ].join(';');
      challengeBtn.textContent = 'Challenge';
      challengeBtn.addEventListener('mouseenter', () => {
        challengeBtn.style.background = '#4a2020';
        challengeBtn.style.borderColor = '#8b3030';
      });
      challengeBtn.addEventListener('mouseleave', () => {
        challengeBtn.style.background = '#3a1515';
        challengeBtn.style.borderColor = '#6b2020';
      });
      challengeBtn.addEventListener('click', () => {
        if (this.onBossChallenge) this.onBossChallenge(blocker);
      });
      blockerDiv.appendChild(challengeBtn);

      this.bodyEl.appendChild(blockerDiv);
      return; // Don't render NPCs, actions, etc.
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
          const actionExpState = this.expeditionStates.get(action.id);
          actionsSection.appendChild(
            this.renderExpeditionSection(building.id, action.id, actionExpState, undefined, action.label),
          );
          continue;
        }

        if (action.action_type === 'gather') {
          actionsSection.appendChild(
            this.renderGatherSection(building.id, action as GatherBuildingActionDto),
          );
          continue;
        }

        if (action.action_type === 'marketplace') {
          const mAction = action as MarketplaceBuildingActionDto;
          const mBtn = document.createElement('button');
          mBtn.textContent = 'Browse Marketplace';
          mBtn.style.cssText = [
            'width:100%',
            'padding:8px',
            'margin:4px 0',
            'background:rgba(90,74,42,0.3)',
            'border:1px solid #5a4a2a',
            'border-radius:4px',
            'color:#e8c870',
            'font-family:Cinzel,serif',
            'font-size:13px',
            'cursor:pointer',
          ].join(';');
          mBtn.addEventListener('click', () => {
            this.marketplaceModal.open(building.id, mAction.config);
          });
          actionsSection.appendChild(mBtn);
          continue;
        }

        if (action.action_type === 'fishing') {
          const fAction = action as FishingBuildingActionDto;
          const fBtn = document.createElement('button');
          fBtn.textContent = `🐟 ${fAction.label}`;
          fBtn.style.cssText = [
            'width:100%',
            'padding:8px',
            'margin:4px 0',
            'background:rgba(40,60,80,0.3)',
            'border:1px solid #3a5a6a',
            'border-radius:4px',
            'color:#70b8d0',
            'font-family:Cinzel,serif',
            'font-size:13px',
            'cursor:pointer',
            'transition:background 0.15s',
          ].join(';');
          fBtn.addEventListener('mouseenter', () => {
            if (!fBtn.disabled) fBtn.style.background = 'rgba(40,60,80,0.6)';
          });
          fBtn.addEventListener('mouseleave', () => {
            if (!fBtn.disabled) fBtn.style.background = 'rgba(40,60,80,0.3)';
          });
          fBtn.addEventListener('click', () => {
            this.onFishingCast?.(building.id, fAction.id);
          });
          actionsSection.appendChild(fBtn);
          continue;
        }

        if (action.action_type === 'arena') {
          const aAction = action as ArenaBuildingActionDto;
          const aBtn = document.createElement('button');
          aBtn.textContent = `⚔️ Enter ${aAction.arena_name || 'Arena'}`;
          aBtn.style.cssText = [
            'width:100%',
            'padding:8px',
            'margin:4px 0',
            'background:rgba(120,30,30,0.3)',
            'border:1px solid #8a3a3a',
            'border-radius:4px',
            'color:#e06060',
            'font-family:Cinzel,serif',
            'font-size:13px',
            'cursor:pointer',
            'transition:background 0.15s',
          ].join(';');
          aBtn.addEventListener('mouseenter', () => {
            aBtn.style.background = 'rgba(120,30,30,0.6)';
          });
          aBtn.addEventListener('mouseleave', () => {
            aBtn.style.background = 'rgba(120,30,30,0.3)';
          });
          aBtn.addEventListener('click', () => {
            this.disableButtons();
            this.onAction?.({
              building_id: building.id,
              action_id: aAction.id,
              action_type: 'arena',
            });
          });
          actionsSection.appendChild(aBtn);
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

  getMarketplaceModal(): MarketplaceModal {
    return this.marketplaceModal;
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

  private renderNpcPanel(npc: { id: number; name: string; description: string; icon_url: string; is_crafter: boolean; is_quest_giver: boolean; is_squire_dismisser?: boolean; is_disassembler?: boolean }): void {
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
        this.renderBuilding(this.currentBuilding);
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

    if (npc.is_quest_giver) {
      const questOption = this.buildDialogOption('Do you have any tasks for me?', () => {
        this.onQuestOpen?.(npc.id);
      });
      optionsEl.appendChild(questOption);
    }

    if (npc.is_squire_dismisser) {
      const dismissOption = this.buildDialogOption('I want to dismiss a squire', () => {
        this.onSquireDismissList?.(npc.id);
      });
      optionsEl.appendChild(dismissOption);
    }

    if ((npc as { is_disassembler?: boolean }).is_disassembler) {
      const disassembleOption = this.buildDialogOption('I want to disassemble some items', () => {
        this.onDisassemblyOpen?.(npc.id);
      });
      optionsEl.appendChild(disassembleOption);
    }

    if ((npc as { is_trainer?: boolean }).is_trainer) {
      const trainOption = this.buildDialogOption('I want to train', () => {
        this.onTrainingOpen?.(npc.id);
      });
      optionsEl.appendChild(trainOption);
    }

    // Fishing rod upgrade/repair options — shown when the building has a fishing action
    const hasFishingAction = this.currentBuilding?.actions.some((a) => a.action_type === 'fishing');
    if (hasFishingAction) {
      const upgradeOption = this.buildDialogOption('Can you upgrade my fishing rod?', () => {
        this.onFishingUpgrade?.(npc.id);
      });
      optionsEl.appendChild(upgradeOption);

      const repairOption = this.buildDialogOption('I need my fishing rod repaired', () => {
        this.onFishingRepair?.(npc.id);
      });
      optionsEl.appendChild(repairOption);
    }

    // Placeholder for quest dialog options (talk_to_npc objectives)
    // These get injected when the server responds to quest.npc_dialogs
    const dialogPlaceholder = document.createElement('div');
    dialogPlaceholder.setAttribute('data-quest-dialogs', '');
    optionsEl.appendChild(dialogPlaceholder);

    // Request pending quest dialogs for this NPC
    this.currentNpcForDialogs = npc.id;
    this.pendingNpcDialogs = [];
    this.onNpcDialogsRequest?.(npc.id);

    const backOption = this.buildDialogOption('Leave', () => {
      if (this.currentBuilding) {
        this.renderBuilding(this.currentBuilding);
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
    expeditionLabel?: string,
  ): HTMLElement {
    const section = document.createElement('div');
    section.dataset['expeditionSection'] = String(actionId);
    section.style.cssText =
      'border:1px solid #3a2e1a;border-radius:4px;padding:10px;background:rgba(20,16,8,0.7);';

    const title = document.createElement('p');
    title.style.cssText = 'margin:0 0 8px;font-size:12px;letter-spacing:0.06em;color:#c9a55c;';
    title.textContent = (expeditionLabel || 'EXPEDITION').toUpperCase();
    section.appendChild(title);

    if (!state || state.squire_status === 'idle') {
      // Derive idle squires from the live roster — not from stale state.available_squires
      const roster = this.currentSquireRoster;
      const allSquires = roster?.squires ?? state?.available_squires ?? [];
      const slotsTotal = roster?.slots_total ?? 5;
      const slotsUnlocked = roster?.slots_unlocked ?? 2;

      // A squire is idle if its status is 'idle' in the roster
      const idleSquires = allSquires.filter((s) => s.status === 'idle');
      const idleIds = new Set(idleSquires.map((s) => s.id));

      let selectedSquireId: number | null = idleSquires.length > 0 ? idleSquires[0]!.id : null;

      const slotsRow = document.createElement('div');
      slotsRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;justify-content:center;';

      // Tooltip element (shared, repositioned on hover)
      const tooltip = document.createElement('div');
      tooltip.style.cssText = 'display:none;position:absolute;z-index:50;background:#1a1610;border:1px solid #5a4a2a;border-radius:4px;padding:6px 8px;pointer-events:none;white-space:nowrap;font-family:"Crimson Text",serif;font-size:11px;color:#e0d8c8;';
      section.style.position = 'relative';
      section.appendChild(tooltip);

      const slotEls: HTMLElement[] = [];

      const updateSelection = (): void => {
        slotEls.forEach((el) => {
          const sid = parseInt(el.dataset['squireId'] ?? '0', 10);
          const isSelected = sid === selectedSquireId;
          el.style.borderColor = isSelected ? '#f0c060' : '#3a3020';
          el.style.boxShadow = isSelected ? '0 0 6px rgba(240,192,96,0.4)' : 'none';
        });
      };

      for (let i = 0; i < slotsTotal; i++) {
        const slotEl = document.createElement('div');
        slotEl.style.cssText = 'width:84px;height:84px;border-radius:4px;border:2px solid #3a3020;display:flex;align-items:center;justify-content:center;transition:border-color 0.15s,box-shadow 0.15s;';

        if (i < allSquires.length) {
          const sq = allSquires[i]!;
          const isIdle = idleIds.has(sq.id);
          slotEl.dataset['squireId'] = String(sq.id);

          if (sq.icon_url) {
            slotEl.innerHTML = `<img src="${sq.icon_url}" style="width:80px;height:80px;border-radius:2px;image-rendering:pixelated;${isIdle ? '' : 'opacity:0.35;filter:grayscale(0.7);'}" />`;
          } else {
            slotEl.innerHTML = `<span style="font-size:20px;${isIdle ? 'color:#c9a55c;' : 'color:#3a3020;'}">⚔</span>`;
          }

          if (isIdle) {
            slotEl.style.cursor = 'pointer';
            slotEl.addEventListener('click', () => {
              selectedSquireId = sq.id;
              updateSelection();
            });
          } else {
            slotEl.style.opacity = '0.5';
            slotEl.style.cursor = 'not-allowed';
          }

          // Hover tooltip
          slotEl.addEventListener('mouseenter', (e) => {
            const statusLabel = isIdle ? 'Idle' : 'On Expedition';
            tooltip.innerHTML = `<strong style="color:#f0c060;">${sq.name}</strong><br>${sq.rank} · Power: ${sq.power_level}<br><span style="color:${isIdle ? '#5a8a3a' : '#d4a84b'};">${statusLabel}</span>`;
            tooltip.style.display = 'block';
            const rect = slotEl.getBoundingClientRect();
            const parentRect = section.getBoundingClientRect();
            tooltip.style.left = `${rect.left - parentRect.left}px`;
            tooltip.style.top = `${rect.bottom - parentRect.top + 4}px`;
          });
          slotEl.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

          slotEls.push(slotEl);
        } else if (i < slotsUnlocked) {
          slotEl.style.borderStyle = 'dashed';
          slotEl.style.borderColor = '#2a2418';
          slotEl.innerHTML = '<span style="color:#2a2418;font-size:10px;">—</span>';
        } else {
          slotEl.style.background = 'rgba(20,16,8,0.5)';
          slotEl.style.borderColor = '#1a1610';
          slotEl.innerHTML = '<span style="font-size:12px;">🔒</span>';
        }

        slotsRow.appendChild(slotEl);
      }

      section.appendChild(slotsRow);
      updateSelection();

      if (idleSquires.length === 0) {
        const noSquires = document.createElement('p');
        noSquires.style.cssText = 'margin:0 0 6px;font-family:"Crimson Text",serif;font-size:11px;color:#5a4a2a;text-align:center;';
        noSquires.textContent = 'No idle squires available.';
        section.appendChild(noSquires);
      } else {
        // Duration buttons — always show 1h/3h/6h when idle squires exist
        const durations: (1 | 3 | 6)[] = [1, 3, 6];
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;';

        for (const hours of durations) {
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
          btn.textContent = `${hours}h`;
          btn.addEventListener('click', () => {
            if (selectedSquireId) {
              btn.disabled = true;
              this.onExpeditionDispatch?.(buildingId, actionId, hours, selectedSquireId);
            }
          });
          btnRow.appendChild(btn);
        }

        section.appendChild(btnRow);
      }
    } else if (state.squire_status === 'exploring') {
      const sq = state.active_squire;
      const exploringRow = document.createElement('div');
      exploringRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';

      if (sq?.icon_url) {
        exploringRow.innerHTML += `<img src="${sq.icon_url}" style="width:40px;height:40px;border-radius:3px;image-rendering:pixelated;flex-shrink:0;" />`;
      }

      const infoCol = document.createElement('div');
      infoCol.style.cssText = 'flex:1;min-width:0;';
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-weight:bold;color:#f0c060;font-size:13px;font-family:"Crimson Text",serif;';
      nameEl.textContent = sq?.name ?? state.squire_name;
      infoCol.appendChild(nameEl);
      const statusEl = document.createElement('div');
      statusEl.style.cssText = 'font-size:11px;color:#d4a84b;';
      statusEl.textContent = sq ? `${sq.rank} · Power ${sq.power_level} · On expedition` : 'On expedition';
      infoCol.appendChild(statusEl);
      exploringRow.appendChild(infoCol);
      section.appendChild(exploringRow);

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
      info.textContent = `${state.active_squire?.name ?? state.squire_name} has returned with rewards!`;
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

  showExpeditionDispatched(payload: ExpeditionDispatchedPayload & { started_at?: string; action_id?: number }): void {
    const actionId = payload.action_id ?? 0;
    const newState: ExpeditionStateDto = {
      action_id: actionId,
      squire_name: payload.squire_name,
      squire_status: 'exploring',
      expedition_id: payload.expedition_id,
      started_at: payload.started_at ?? new Date().toISOString(),
      completes_at: payload.completes_at,
      active_squire: (payload as any).squire ?? undefined,
    };
    this.expeditionStates.set(actionId, newState);
    // Refresh ALL sections — dispatched squire should appear greyed out in other expeditions
    this.refreshAllExpeditionSections();
  }

  handleExpeditionCompleted(payload: ExpeditionCompletedPayload): void {
    // Find which action this expedition belongs to
    for (const [actionId, state] of this.expeditionStates) {
      if (state.expedition_id === payload.expedition_id) {
        this.expeditionStates.set(actionId, {
          ...state,
          squire_status: 'ready',
          expedition_id: payload.expedition_id,
          started_at: undefined,
          completes_at: undefined,
        });
        break;
      }
    }
    // Refresh all — the completed squire might now be collectable
    this.refreshAllExpeditionSections();
  }

  showExpeditionCollectResult(payload: ExpeditionCollectResultPayload & { expedition_id?: number }): void {
    const r = payload.rewards;

    // Reset the collected expedition's state to idle — match by expedition_id first
    for (const [actionId, state] of this.expeditionStates) {
      if (payload.expedition_id != null ? state.expedition_id === payload.expedition_id : state.squire_status === 'ready') {
        this.expeditionStates.set(actionId, {
          ...state,
          squire_status: 'idle',
          expedition_id: undefined,
          collectable_rewards: undefined,
          started_at: undefined,
          completes_at: undefined,
          active_squire: undefined,
        });
        break;
      }
    }

    // Refresh ALL expedition sections — the roster update will also trigger this,
    // but do it now so the UI updates immediately before the modal shows
    this.refreshAllExpeditionSections();

    // Show reward modal
    this.showExpeditionRewardModal(payload.squire_name, r, payload.items_skipped);
  }

  private showExpeditionRewardModal(
    squireName: string,
    rewards: { gold: number; exp: number; items: { item_def_id: number; name: string; quantity: number; icon_url?: string | null }[] },
    itemsSkipped: boolean,
  ): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:300',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.7)',
      'font-family:Cinzel,serif', 'color:#c9a55c',
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'width:380px', 'max-width:90vw',
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'box-shadow:0 8px 40px rgba(0,0,0,0.9)',
      'display:flex', 'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:18px 16px 12px;text-align:center;background:#111008;border-bottom:1px solid #3a2e1a;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:1.4rem;font-weight:700;color:#f0c060;text-shadow:0 2px 8px rgba(0,0,0,0.8);letter-spacing:0.06em;';
    title.textContent = 'Expedition Complete!';
    header.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:0.8rem;color:#8a7a5a;font-family:"Crimson Text",serif;margin-top:6px;';
    subtitle.textContent = `${squireName} returned with rewards`;
    header.appendChild(subtitle);

    modal.appendChild(header);

    // Body — loot grid
    const body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px;display:flex;flex-direction:column;gap:10px;';

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';

    if (rewards.gold > 0) {
      grid.appendChild(this.buildRewardTile(getCrownsIconUrl(), '♛', '#f0c060', rewards.gold, `+${rewards.gold} Gold`));
    }
    if (rewards.exp > 0) {
      grid.appendChild(this.buildRewardTile(getXpIconUrl(), '✦', '#a78bfa', rewards.exp, `+${rewards.exp} XP`));
    }
    for (const item of rewards.items) {
      grid.appendChild(this.buildRewardTile(item.icon_url ?? null, '◆', '#c9a55c', item.quantity, item.name));
    }

    body.appendChild(grid);

    if (itemsSkipped) {
      const warn = document.createElement('div');
      warn.style.cssText = 'text-align:center;font-size:0.75rem;color:#c06050;font-family:"Crimson Text",serif;';
      warn.textContent = 'Some items could not be added — inventory full.';
      body.appendChild(warn);
    }

    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:12px 16px 16px;display:flex;justify-content:center;border-top:1px solid #2a2010;background:#0a0806;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Continue';
    closeBtn.style.cssText = [
      'padding:8px 36px', 'font-family:Cinzel,serif',
      'font-size:0.9rem', 'font-weight:600', 'color:#1a1510',
      'background:#d4a84b', 'border:1px solid #b8922e', 'cursor:pointer',
      'border-radius:3px', 'letter-spacing:0.05em',
      'transition:background 0.15s',
    ].join(';');
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#e8c060'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#d4a84b'; });
    closeBtn.addEventListener('click', () => { overlay.remove(); });
    footer.appendChild(closeBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  private buildRewardTile(
    iconUrl: string | null,
    fallbackSymbol: string,
    color: string,
    quantity: number,
    tooltipText: string,
  ): HTMLElement {
    const tile = document.createElement('div');
    tile.style.cssText = [
      'position:relative',
      'width:48px', 'height:48px',
      'background:#1a1510', 'border:1px solid #3a2e1a', 'border-radius:4px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'overflow:visible', 'cursor:default', 'flex-shrink:0',
    ].join(';');
    tile.title = tooltipText;

    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      tile.appendChild(img);
    } else {
      tile.textContent = fallbackSymbol;
      tile.style.color = color;
      tile.style.fontSize = '1.4rem';
    }

    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:absolute', 'bottom:-2px', 'right:-2px',
      'min-width:16px', 'height:16px', 'padding:0 3px',
      'background:#0d0b08', 'border:1px solid #5a4a2a', 'border-radius:3px',
      'font-size:0.6rem', 'font-family:Rajdhani,sans-serif', 'font-weight:700',
      'color:#e8c870', 'text-align:center', 'line-height:16px',
    ].join(';');
    badge.textContent = quantity > 1 ? String(quantity) : '+1';
    tile.appendChild(badge);

    return tile;
  }

  private refreshExpeditionSection(actionId: number): void {
    const section = this.bodyEl.querySelector<HTMLElement>(`[data-expedition-section="${actionId}"]`);
    if (!section || !this.currentBuilding) return;
    this.clearProgressIntervals();
    const actionDto = this.currentBuilding.actions.find((a) => a.id === actionId);
    const label = actionDto?.label;
    const state = this.expeditionStates.get(actionId);
    const newSection = this.renderExpeditionSection(
      this.currentBuilding.id, actionId, state, undefined, label,
    );
    section.replaceWith(newSection);
  }

  /** Re-render ALL expedition sections — call after roster changes or collect */
  private refreshAllExpeditionSections(): void {
    if (!this.currentBuilding) return;
    this.clearProgressIntervals();
    for (const action of this.currentBuilding.actions) {
      if (action.action_type === 'expedition') {
        const section = this.bodyEl.querySelector<HTMLElement>(`[data-expedition-section="${action.id}"]`);
        if (!section) continue;
        const state = this.expeditionStates.get(action.id);
        const newSection = this.renderExpeditionSection(
          this.currentBuilding.id, action.id, state, undefined, action.label,
        );
        section.replaceWith(newSection);
      }
    }
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
    this.marketplaceModal.close();
    this.panel.remove();
    this.combatModal.close();
    this.craftingModal.close();
  }
}
