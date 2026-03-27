import type {
  QuestDefinitionDto,
  CharacterQuestDto,
  QuestObjectiveDto,
  QuestRewardDto,
  QuestAvailableListPayload,
  QuestAcceptedPayload,
  QuestCompletedPayload,
  QuestProgressPayload,
  QuestRejectedPayload,
} from '@elarion/protocol';
import { getXpIconUrl, getCrownsIconUrl, getRodUpgradePointsIconUrl } from './ui-icons';

type SendFn = (type: string, payload: unknown) => void;

export class QuestPanel {
  private overlay: HTMLElement | null = null;
  private parent: HTMLElement;
  private sendFn: SendFn | null = null;
  private currentNpcId: number = 0;
  private availableQuests: QuestDefinitionDto[] = [];
  private activeQuests: CharacterQuestDto[] = [];
  private completableQuests: CharacterQuestDto[] = [];
  private feedbackEl: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.parent = parent;
  }

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  open(npcId: number): void {
    this.currentNpcId = npcId;
    this.close();
    this.buildOverlay();
    this.renderLoading();
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  // ---------------------------------------------------------------------------
  // Server message handlers
  // ---------------------------------------------------------------------------

  handleAvailableList(payload: QuestAvailableListPayload): void {
    this.currentNpcId = payload.npc_id;
    this.availableQuests = payload.available_quests;
    this.activeQuests = payload.active_quests;
    this.completableQuests = payload.completable_quests;
    if (!this.overlay) {
      this.open(payload.npc_id);
    }
    this.renderContent();
  }

  handleAccepted(payload: QuestAcceptedPayload): void {
    // Move from available to active
    this.availableQuests = this.availableQuests.filter(
      (q) => q.id !== payload.quest.quest.id,
    );
    this.activeQuests.push(payload.quest);
    this.renderContent();
    this.showFeedback(`Quest accepted: ${payload.quest.quest.name}`, '#b8e870');
  }

  handleCompleted(payload: QuestCompletedPayload): void {
    this.completableQuests = this.completableQuests.filter(
      (cq) => cq.character_quest_id !== payload.character_quest_id,
    );
    this.renderContent();

    const rewardLines = payload.rewards_granted.map((r) => {
      if (r.reward_type === 'crowns') return `${r.quantity} Crowns`;
      if (r.reward_type === 'xp') return `${r.quantity} XP`;
      return `${r.quantity}x ${r.target_name ?? 'item'}`;
    });
    this.showFeedback(`Quest complete! Rewards: ${rewardLines.join(', ')}`, '#b8e870');
  }

  handleProgress(payload: QuestProgressPayload): void {
    for (const cq of this.activeQuests) {
      if (cq.character_quest_id !== payload.character_quest_id) continue;
      for (const obj of cq.objectives) {
        if (obj.id === payload.objective_id) {
          obj.current_progress = payload.current_progress;
          obj.is_complete = payload.is_complete;
        }
      }
      // If the whole quest is now completable, move it
      if (payload.quest_complete) {
        this.activeQuests = this.activeQuests.filter(
          (q) => q.character_quest_id !== cq.character_quest_id,
        );
        this.completableQuests.push(cq);
      }
    }
    this.renderContent();
  }

  handleRejected(payload: QuestRejectedPayload): void {
    const messages: Record<string, string> = {
      NOT_AT_NPC: 'You are not near this NPC.',
      QUEST_NOT_FOUND: 'Quest not found.',
      PREREQUISITES_NOT_MET: 'Prerequisites not met.',
      QUEST_ALREADY_ACTIVE: 'Quest is already active.',
      QUEST_LOG_FULL: 'Your quest log is full.',
      QUEST_NOT_COMPLETABLE: payload.details ?? 'Quest is not yet completable.',
      INVENTORY_FULL: payload.details ?? 'Inventory is full.',
      INVALID_REQUEST: payload.details ?? 'Invalid request.',
    };
    this.showFeedback(messages[payload.reason] ?? 'Action failed.', '#c0504a');
    this.enableAllButtons();
  }

  // ---------------------------------------------------------------------------
  // Overlay structure
  // ---------------------------------------------------------------------------

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.72)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:200',
    ].join(';');

    const modal = document.createElement('div');
    modal.id = 'quest-panel-modal';
    modal.style.cssText = [
      'background:rgba(20,16,8,0.95)',
      'border:1px solid #3a2e1a',
      'width:520px',
      'max-height:85vh',
      'display:flex',
      'flex-direction:column',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'box-sizing:border-box',
      'overflow:hidden',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText =
      'padding:14px 18px 10px;border-bottom:1px solid #3a2e1a;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';

    const title = document.createElement('h2');
    title.style.cssText =
      'margin:0;font-size:15px;letter-spacing:0.08em;color:#e8c870;';
    title.textContent = 'Quests';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText =
      'background:none;border:none;color:#7a6a4a;font-size:18px;cursor:pointer;padding:0 4px;';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => this.close());
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#e8c870';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = '#7a6a4a';
    });
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.id = 'quest-panel-body';
    body.style.cssText =
      'flex:1;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:14px;';
    modal.appendChild(body);

    // Feedback area
    const feedback = document.createElement('div');
    feedback.id = 'quest-panel-feedback';
    feedback.style.cssText = 'padding:0 18px 10px;flex-shrink:0;display:none;';
    modal.appendChild(feedback);
    this.feedbackEl = feedback;

    overlay.appendChild(modal);
    this.parent.appendChild(overlay);
    this.overlay = overlay;
  }

  private getBody(): HTMLElement {
    return this.overlay!.querySelector('#quest-panel-body') as HTMLElement;
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  private renderLoading(): void {
    const body = this.getBody();
    body.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText =
      'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#7a6a4a;font-style:italic;';
    p.textContent = 'Loading quests...';
    body.appendChild(p);
  }

  private renderContent(): void {
    const body = this.getBody();
    body.innerHTML = '';

    const hasContent =
      this.completableQuests.length > 0 ||
      this.activeQuests.length > 0 ||
      this.availableQuests.length > 0;

    if (!hasContent) {
      const p = document.createElement('p');
      p.style.cssText =
        'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#7a6a4a;font-style:italic;';
      p.textContent = 'No quests available from this NPC.';
      body.appendChild(p);
      return;
    }

    // Ready to Complete section (most important, shown first)
    if (this.completableQuests.length > 0) {
      body.appendChild(this.renderSection('Ready to Complete', this.completableQuests, 'completable'));
    }

    // Active Quests section
    if (this.activeQuests.length > 0) {
      body.appendChild(this.renderSection('Active Quests', this.activeQuests, 'active'));
    }

    // Available Quests section
    if (this.availableQuests.length > 0) {
      body.appendChild(this.renderAvailableSection());
    }
  }

  // ---------------------------------------------------------------------------
  // Section rendering
  // ---------------------------------------------------------------------------

  private renderSectionHeader(text: string): HTMLElement {
    const h = document.createElement('h3');
    h.style.cssText = [
      'margin:0 0 8px',
      'font-size:12px',
      'letter-spacing:0.1em',
      'text-transform:uppercase',
      'color:#e8c870',
      'border-bottom:1px solid #3a2e1a',
      'padding-bottom:6px',
    ].join(';');
    h.textContent = text;
    return h;
  }

  private renderAvailableSection(): HTMLElement {
    const section = document.createElement('div');
    section.appendChild(this.renderSectionHeader('Available Quests'));

    for (const quest of this.availableQuests) {
      section.appendChild(this.renderAvailableCard(quest));
    }
    return section;
  }

  private renderSection(
    title: string,
    quests: CharacterQuestDto[],
    mode: 'active' | 'completable',
  ): HTMLElement {
    const section = document.createElement('div');
    section.appendChild(this.renderSectionHeader(title));

    for (const cq of quests) {
      section.appendChild(this.renderCharacterQuestCard(cq, mode));
    }
    return section;
  }

  // ---------------------------------------------------------------------------
  // Available quest card
  // ---------------------------------------------------------------------------

  private renderAvailableCard(quest: QuestDefinitionDto): HTMLElement {
    const card = this.createCard();

    // Name row with type badge
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:13px;color:#e8c870;font-weight:bold;letter-spacing:0.04em;';
    nameEl.textContent = quest.name;
    nameRow.appendChild(nameEl);

    nameRow.appendChild(this.renderTypeBadge(quest.quest_type));
    card.appendChild(nameRow);

    // Description
    if (quest.description) {
      const desc = document.createElement('p');
      desc.style.cssText =
        'margin:0 0 6px;font-family:"Crimson Text",serif;font-size:12px;color:#a89060;font-style:italic;';
      desc.textContent = quest.description;
      card.appendChild(desc);
    }

    // Objectives
    if (quest.objectives.length > 0) {
      card.appendChild(this.renderObjectivesList(quest.objectives));
    }

    // Rewards
    if (quest.rewards.length > 0) {
      card.appendChild(this.renderRewardsLine(quest.rewards));
    }

    // Accept button
    const acceptBtn = this.createButton('Accept', 'rgba(60,90,40,0.6)', '#5a8a3a', '#b8e870');
    acceptBtn.addEventListener('mouseenter', () => {
      acceptBtn.style.background = 'rgba(60,90,40,0.9)';
    });
    acceptBtn.addEventListener('mouseleave', () => {
      acceptBtn.style.background = 'rgba(60,90,40,0.6)';
    });
    acceptBtn.addEventListener('click', () => {
      acceptBtn.disabled = true;
      acceptBtn.style.opacity = '0.5';
      this.sendFn?.('quest.accept', {
        npc_id: this.currentNpcId,
        quest_id: quest.id,
      });
    });
    card.appendChild(acceptBtn);

    return card;
  }

  // ---------------------------------------------------------------------------
  // Character quest card (active / completable)
  // ---------------------------------------------------------------------------

  private renderCharacterQuestCard(
    cq: CharacterQuestDto,
    mode: 'active' | 'completable',
  ): HTMLElement {
    const card = this.createCard();

    // Name row with type badge
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:13px;color:#e8c870;font-weight:bold;letter-spacing:0.04em;';
    nameEl.textContent = cq.quest.name;
    nameRow.appendChild(nameEl);

    nameRow.appendChild(this.renderTypeBadge(cq.quest.quest_type));
    card.appendChild(nameRow);

    // Objectives with progress
    if (cq.objectives.length > 0) {
      card.appendChild(this.renderObjectivesList(cq.objectives));
    }

    // Complete button (only for completable)
    if (mode === 'completable') {
      // Rewards preview
      if (cq.quest.rewards.length > 0) {
        card.appendChild(this.renderRewardsLine(cq.quest.rewards));
      }

      const completeBtn = this.createButton(
        'Complete Quest',
        'rgba(90,74,42,0.4)',
        '#5a4a2a',
        '#e8c870',
      );
      completeBtn.addEventListener('mouseenter', () => {
        completeBtn.style.background = 'rgba(90,74,42,0.7)';
      });
      completeBtn.addEventListener('mouseleave', () => {
        completeBtn.style.background = 'rgba(90,74,42,0.4)';
      });
      completeBtn.addEventListener('click', () => {
        completeBtn.disabled = true;
        completeBtn.style.opacity = '0.5';
        this.sendFn?.('quest.complete', {
          character_quest_id: cq.character_quest_id,
        });
      });
      card.appendChild(completeBtn);
    }

    return card;
  }

  // ---------------------------------------------------------------------------
  // Shared rendering helpers
  // ---------------------------------------------------------------------------

  private createCard(): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = [
      'border:1px solid #3a2e1a',
      'border-radius:4px',
      'padding:12px',
      'background:rgba(20,16,8,0.7)',
      'margin-bottom:8px',
    ].join(';');
    return card;
  }

  private renderTypeBadge(questType: string): HTMLElement {
    const colors: Record<string, { bg: string; text: string }> = {
      daily: { bg: 'rgba(60,100,160,0.4)', text: '#70a8d0' },
      weekly: { bg: 'rgba(120,70,160,0.4)', text: '#b080d0' },
      monthly: { bg: 'rgba(60,130,80,0.4)', text: '#70c080' },
      main: { bg: 'rgba(160,120,40,0.4)', text: '#e8c870' },
      side: { bg: 'rgba(140,140,140,0.3)', text: '#a0a0a0' },
      repeatable: { bg: 'rgba(100,120,80,0.3)', text: '#90a878' },
    };

    const c = colors[questType] ?? colors.side!;
    const badge = document.createElement('span');
    badge.style.cssText = [
      `background:${c.bg}`,
      `color:${c.text}`,
      'padding:1px 7px',
      'border-radius:8px',
      'font-family:"Crimson Text",serif',
      'font-size:10px',
      'text-transform:uppercase',
      'letter-spacing:0.06em',
    ].join(';');
    badge.textContent = questType;
    return badge;
  }

  private renderObjectivesList(objectives: QuestObjectiveDto[]): HTMLElement {
    const list = document.createElement('ul');
    list.style.cssText =
      'margin:0 0 6px;padding:0 0 0 16px;list-style:disc;';

    for (const obj of objectives) {
      const li = document.createElement('li');
      li.style.cssText = [
        'font-family:"Crimson Text",serif',
        'font-size:12px',
        'margin-bottom:2px',
        obj.is_complete ? 'color:#70a860' : 'color:#a89060',
      ].join(';');

      const label = obj.description ?? obj.target_name ?? 'Objective';

      if (obj.target_icon_url) {
        const icon = document.createElement('img');
        icon.src = obj.target_icon_url;
        icon.style.cssText =
          'width:14px;height:14px;object-fit:contain;image-rendering:pixelated;vertical-align:middle;margin-right:4px;';
        li.appendChild(icon);
      }

      const progressText =
        obj.target_quantity > 1
          ? ` (${obj.current_progress}/${obj.target_quantity})`
          : '';
      const checkMark = obj.is_complete ? ' \u2713' : '';

      li.appendChild(document.createTextNode(`${label}${progressText}${checkMark}`));
      list.appendChild(li);
    }

    return list;
  }

  private renderRewardsLine(rewards: QuestRewardDto[]): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';

    for (const reward of rewards) {
      const chip = document.createElement('span');
      chip.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:3px',
        'padding:2px 6px',
        'background:rgba(90,74,42,0.25)',
        'border:1px solid #5a4a2a',
        'font-family:"Crimson Text",serif',
        'font-size:11px',
        'color:#d4a84b',
      ].join(';');

      // Resolve icon: use target_icon_url for items/squires, UI icons for crowns/xp/rod pts
      let iconUrl = reward.target_icon_url;
      let fallbackSymbol = '';
      let label: string;

      if (reward.reward_type === 'crowns') {
        iconUrl = iconUrl ?? getCrownsIconUrl();
        fallbackSymbol = '♛';
        label = `${reward.quantity} Crowns`;
      } else if (reward.reward_type === 'xp') {
        iconUrl = iconUrl ?? getXpIconUrl();
        fallbackSymbol = '✦';
        label = `${reward.quantity} XP`;
      } else if (reward.reward_type === 'rod_upgrade_points') {
        iconUrl = iconUrl ?? getRodUpgradePointsIconUrl();
        fallbackSymbol = '🎣';
        label = `${reward.quantity} Rod Pts`;
      } else {
        label = `${reward.quantity}x ${reward.target_name ?? 'item'}`;
      }

      if (iconUrl) {
        const icon = document.createElement('img');
        icon.src = iconUrl;
        icon.style.cssText =
          'width:14px;height:14px;object-fit:contain;image-rendering:pixelated;';
        chip.appendChild(icon);
      } else if (fallbackSymbol) {
        const sym = document.createElement('span');
        sym.style.cssText = 'font-size:12px;line-height:1;';
        sym.textContent = fallbackSymbol;
        chip.appendChild(sym);
      }

      chip.appendChild(document.createTextNode(label));
      row.appendChild(chip);
    }

    return row;
  }

  private createButton(
    text: string,
    bg: string,
    border: string,
    color: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = [
      'width:100%',
      'padding:7px 14px',
      `background:${bg}`,
      `border:1px solid ${border}`,
      `color:${color}`,
      'font-family:Cinzel,serif',
      'font-size:11px',
      'letter-spacing:0.04em',
      'cursor:pointer',
      'margin-top:4px',
    ].join(';');
    btn.textContent = text;
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Button state
  // ---------------------------------------------------------------------------

  private enableAllButtons(): void {
    if (!this.overlay) return;
    this.overlay
      .querySelectorAll<HTMLButtonElement>('button[disabled]')
      .forEach((btn) => {
        btn.disabled = false;
        btn.style.opacity = '1';
      });
  }

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  private showFeedback(text: string, color: string): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.style.display = 'block';
    this.feedbackEl.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = `margin:0;font-family:"Crimson Text",serif;font-size:12px;color:${color};`;
    p.textContent = text;
    this.feedbackEl.appendChild(p);

    setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.style.display = 'none';
    }, 5000);
  }
}
