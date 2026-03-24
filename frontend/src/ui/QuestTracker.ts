import type {
  QuestProgressPayload,
  CharacterQuestDto,
  QuestObjectiveDto,
} from '@elarion/protocol';

/** Maximum number of objective lines shown in the tracker. */
const MAX_TRACKED = 3;

export class QuestTracker {
  private container: HTMLElement;
  private trackedQuests: CharacterQuestDto[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:absolute',
      'bottom:8px',
      'right:8px',
      'padding:8px 12px',
      'background:rgba(20,16,8,0.7)',
      'border:1px solid rgba(58,46,26,0.5)',
      'border-radius:4px',
      'pointer-events:none',
      'max-width:280px',
      'box-sizing:border-box',
      'z-index:100',
      'display:none',
    ].join(';');

    parent.appendChild(this.container);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Replace tracked quests from a full quest log refresh. */
  updateFromQuestLog(quests: CharacterQuestDto[]): void {
    this.trackedQuests = quests.slice();
    this.render();
  }

  /** Update a single objective's progress in-place. */
  handleProgress(payload: QuestProgressPayload): void {
    for (const cq of this.trackedQuests) {
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

  /** Add a newly accepted quest to the tracker. */
  addQuest(quest: CharacterQuestDto): void {
    if (this.trackedQuests.some((q) => q.character_quest_id === quest.character_quest_id)) {
      return;
    }
    this.trackedQuests.push(quest);
    this.render();
  }

  /** Remove a completed or abandoned quest. */
  removeQuest(characterQuestId: number): void {
    this.trackedQuests = this.trackedQuests.filter(
      (q) => q.character_quest_id !== characterQuestId,
    );
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    this.container.innerHTML = '';

    // Collect up to MAX_TRACKED incomplete objectives from the most recent quests
    const lines = this.collectObjectiveLines();

    if (lines.length === 0) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';

    for (const line of lines) {
      this.container.appendChild(this.renderLine(line));
    }
  }

  /** Gather displayable objective lines, most-recent quests first. */
  private collectObjectiveLines(): TrackerLine[] {
    const lines: TrackerLine[] = [];

    // Walk quests from newest (last) to oldest (first)
    for (let qi = this.trackedQuests.length - 1; qi >= 0 && lines.length < MAX_TRACKED; qi--) {
      const cq = this.trackedQuests[qi]!;
      for (const obj of cq.objectives) {
        if (lines.length >= MAX_TRACKED) break;
        lines.push({
          questName: cq.quest.name,
          label: obj.description ?? obj.target_name ?? 'Objective',
          current: obj.current_progress,
          target: obj.target_quantity,
          complete: obj.is_complete,
          icon: this.objectiveIcon(obj),
        });
      }
    }

    return lines;
  }

  private renderLine(line: TrackerLine): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:4px;';

    // Quest name label (small, dim)
    const questLabel = document.createElement('div');
    questLabel.style.cssText = [
      'font-family:Cinzel,serif',
      'font-size:10px',
      'color:#8a7a5a',
      'line-height:1.2',
      'margin-bottom:1px',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';');
    questLabel.textContent = line.questName;
    row.appendChild(questLabel);

    // Objective line
    const objEl = document.createElement('div');
    objEl.style.cssText = [
      'font-family:"Crimson Text",serif',
      'font-size:12px',
      line.complete ? 'color:#70a860;opacity:0.7' : 'color:#c9a55c',
      'line-height:1.3',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';');

    const progressText =
      line.target > 1 ? ` ${line.current}/${line.target}` : '';
    const checkMark = line.complete ? ' \u2713' : '';

    objEl.textContent = `${line.icon} ${line.label}${progressText}${checkMark}`;
    row.appendChild(objEl);

    return row;
  }

  /** Pick a small icon character based on objective type. */
  private objectiveIcon(obj: QuestObjectiveDto): string {
    switch (obj.objective_type) {
      case 'kill_monster':
        return '\u2694'; // crossed swords
      case 'collect_item':
        return '\uD83D\uDCE6'; // package
      case 'talk_to_npc':
        return '\uD83D\uDCAC'; // speech balloon
      case 'visit_location':
        return '\uD83D\uDCCD'; // pin
      case 'craft_item':
        return '\uD83D\uDD28'; // hammer
      case 'gather_resource':
        return '\u26CF'; // pick
      default:
        return '\u2022'; // bullet
    }
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TrackerLine {
  questName: string;
  label: string;
  current: number;
  target: number;
  complete: boolean;
  icon: string;
}
