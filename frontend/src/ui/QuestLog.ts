import type {
  CharacterQuestDto,
  QuestLogPayload,
  QuestProgressPayload,
  QuestAbandonedPayload,
  QuestType,
} from '@elarion/protocol';

type SendFn = (type: string, payload: unknown) => void;

/** Display order and human-readable labels for quest type groups. */
const TYPE_ORDER: { type: QuestType; label: string }[] = [
  { type: 'main', label: 'Main Quests' },
  { type: 'side', label: 'Side Quests' },
  { type: 'daily', label: 'Daily' },
  { type: 'weekly', label: 'Weekly' },
  { type: 'monthly', label: 'Monthly' },
  { type: 'repeatable', label: 'Repeatable' },
];

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  daily: { bg: 'rgba(60,100,160,0.4)', text: '#70a8d0' },
  weekly: { bg: 'rgba(120,70,160,0.4)', text: '#b080d0' },
  monthly: { bg: 'rgba(60,130,80,0.4)', text: '#70c080' },
  main: { bg: 'rgba(160,120,40,0.4)', text: '#e8c870' },
  side: { bg: 'rgba(140,140,140,0.3)', text: '#a0a0a0' },
  repeatable: { bg: 'rgba(100,120,80,0.3)', text: '#90a878' },
};

export class QuestLog {
  private container: HTMLElement;
  private contentEl: HTMLElement;
  private sendFn: SendFn | null = null;
  private quests: CharacterQuestDto[] = [];
  private visible = false;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:absolute',
      'top:0',
      'right:0',
      'width:320px',
      'max-height:80vh',
      'overflow-y:auto',
      'background:rgba(20,16,8,0.95)',
      'border:1px solid #3a2e1a',
      'box-sizing:border-box',
      'display:none',
      'flex-direction:column',
      'z-index:150',
      'font-family:Cinzel,serif',
      'color:#c9a55c',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText =
      'padding:12px 14px 8px;border-bottom:1px solid #3a2e1a;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';

    const title = document.createElement('h2');
    title.style.cssText =
      'margin:0;font-size:14px;letter-spacing:0.08em;color:#e8c870;';
    title.textContent = 'Quest Log';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText =
      'background:none;border:none;color:#7a6a4a;font-size:16px;cursor:pointer;padding:0 4px;line-height:1;';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#e8c870';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = '#7a6a4a';
    });
    header.appendChild(closeBtn);

    this.container.appendChild(header);

    // Scrollable content area
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText =
      'flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:10px;';
    this.container.appendChild(this.contentEl);

    parent.appendChild(this.container);
  }

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.sendFn?.('quest.log', {});
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  // ---------------------------------------------------------------------------
  // Server message handlers
  // ---------------------------------------------------------------------------

  handleQuestLog(payload: QuestLogPayload): void {
    this.quests = payload.active_quests;
    this.render();
  }

  handleProgress(payload: QuestProgressPayload): void {
    for (const cq of this.quests) {
      if (cq.character_quest_id !== payload.character_quest_id) continue;
      for (const obj of cq.objectives) {
        if (obj.id === payload.objective_id) {
          obj.current_progress = payload.current_progress;
          obj.is_complete = payload.is_complete;
        }
      }
      break;
    }
    this.render();
  }

  handleAbandoned(payload: QuestAbandonedPayload): void {
    this.quests = this.quests.filter(
      (q) => q.character_quest_id !== payload.character_quest_id,
    );
    this.render();
  }

  handleQuestAccepted(quest: CharacterQuestDto): void {
    // Avoid duplicates
    if (this.quests.some((q) => q.character_quest_id === quest.character_quest_id)) {
      return;
    }
    this.quests.push(quest);
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    this.contentEl.innerHTML = '';

    if (this.quests.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText =
        'margin:0;font-family:"Crimson Text",serif;font-size:13px;color:#7a6a4a;font-style:italic;';
      empty.textContent = 'No active quests.';
      this.contentEl.appendChild(empty);
      return;
    }

    // Group quests by type
    const grouped = new Map<QuestType, CharacterQuestDto[]>();
    for (const cq of this.quests) {
      const type = cq.quest.quest_type;
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type)!.push(cq);
    }

    // Render in defined order
    for (const { type, label } of TYPE_ORDER) {
      const group = grouped.get(type);
      if (!group || group.length === 0) continue;
      this.contentEl.appendChild(this.renderGroup(label, group));
    }
  }

  private renderGroup(label: string, quests: CharacterQuestDto[]): HTMLElement {
    const section = document.createElement('div');

    // Section header
    const header = document.createElement('h3');
    header.style.cssText = [
      'margin:0 0 6px',
      'font-size:11px',
      'letter-spacing:0.1em',
      'text-transform:uppercase',
      'color:#c9a55c',
      'border-bottom:1px solid #3a2e1a',
      'padding-bottom:4px',
      'font-family:Cinzel,serif',
    ].join(';');
    header.textContent = label;
    section.appendChild(header);

    for (const cq of quests) {
      section.appendChild(this.renderQuestCard(cq));
    }

    return section;
  }

  private renderQuestCard(cq: CharacterQuestDto): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = [
      'border:1px solid #3a2e1a',
      'border-radius:4px',
      'padding:10px',
      'background:rgba(20,16,8,0.7)',
      'margin-bottom:6px',
    ].join(';');

    // Name row with type badge
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText =
      'font-size:13px;color:#d4a84b;font-weight:bold;letter-spacing:0.04em;';
    nameEl.textContent = cq.quest.name;
    nameRow.appendChild(nameEl);

    nameRow.appendChild(this.renderTypeBadge(cq.quest.quest_type));
    card.appendChild(nameRow);

    // Objectives with progress bars
    for (const obj of cq.objectives) {
      card.appendChild(this.renderObjective(obj));
    }

    // Abandon button
    const abandonBtn = document.createElement('button');
    abandonBtn.style.cssText = [
      'margin-top:6px',
      'padding:3px 10px',
      'font-size:10px',
      'font-family:Cinzel,serif',
      'letter-spacing:0.04em',
      'background:rgba(140,50,50,0.3)',
      'border:1px solid #6a3030',
      'color:#c06060',
      'cursor:pointer',
      'border-radius:2px',
      'transition:background 0.15s',
    ].join(';');
    abandonBtn.textContent = 'Abandon';
    abandonBtn.addEventListener('mouseenter', () => {
      abandonBtn.style.background = 'rgba(140,50,50,0.6)';
    });
    abandonBtn.addEventListener('mouseleave', () => {
      abandonBtn.style.background = 'rgba(140,50,50,0.3)';
    });
    abandonBtn.addEventListener('click', () => {
      abandonBtn.disabled = true;
      abandonBtn.style.opacity = '0.4';
      this.sendFn?.('quest.abandon', {
        character_quest_id: cq.character_quest_id,
      });
    });
    card.appendChild(abandonBtn);

    return card;
  }

  private renderObjective(obj: {
    description: string | null;
    target_name: string | null;
    current_progress: number;
    target_quantity: number;
    is_complete: boolean;
  }): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:4px;';

    const label = obj.description ?? obj.target_name ?? 'Objective';
    const progressText =
      obj.target_quantity > 1
        ? `${obj.current_progress}/${obj.target_quantity}`
        : '';
    const checkMark = obj.is_complete ? ' \u2713' : '';

    // Label line
    const labelEl = document.createElement('div');
    labelEl.style.cssText = [
      'font-family:"Crimson Text",serif',
      'font-size:12px',
      obj.is_complete ? 'color:#70a860' : 'color:#a89060',
      'margin-bottom:2px',
    ].join(';');
    labelEl.textContent = progressText
      ? `${label} ${progressText}${checkMark}`
      : `${label}${checkMark}`;
    row.appendChild(labelEl);

    // Progress bar (only for multi-step objectives)
    if (obj.target_quantity > 1) {
      const barOuter = document.createElement('div');
      barOuter.style.cssText = [
        'width:100%',
        'height:4px',
        'background:#1a1510',
        'border-radius:2px',
        'overflow:hidden',
      ].join(';');

      const pct = Math.min(
        100,
        Math.round((obj.current_progress / obj.target_quantity) * 100),
      );

      const barFill = document.createElement('div');
      barFill.style.cssText = [
        `width:${pct}%`,
        'height:100%',
        obj.is_complete ? 'background:#70a860' : 'background:#d4a84b',
        'border-radius:2px',
        'transition:width 0.3s ease',
      ].join(';');

      barOuter.appendChild(barFill);
      row.appendChild(barOuter);
    }

    return row;
  }

  private renderTypeBadge(questType: string): HTMLElement {
    const c = TYPE_BADGE_COLORS[questType] ?? TYPE_BADGE_COLORS.side!;
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
}
