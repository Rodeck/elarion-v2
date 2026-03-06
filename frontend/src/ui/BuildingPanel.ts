import type { CityMapBuilding, CityBuildingActionPayload, BuildingExploreResultPayload } from '@elarion/protocol';
import { CombatModal } from './CombatModal';

type ActionCallback = (payload: CityBuildingActionPayload) => void;

export class BuildingPanel {
  private panel: HTMLElement;
  private headerEl: HTMLElement;
  private bodyEl: HTMLElement;
  private onAction: ActionCallback | null = null;
  private combatModal: CombatModal;

  constructor(parent: HTMLElement, onAction: ActionCallback) {
    this.onAction = onAction;
    this.combatModal = new CombatModal(document.body);

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

  show(building: CityMapBuilding): void {
    this.renderBuilding(building);
  }

  hide(): void {
    this.renderEmpty();
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  private renderEmpty(): void {
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

  private renderBuilding(building: CityMapBuilding): void {
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
            action_type: action.action_type,
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
    this.panel.remove();
    this.combatModal.close();
  }
}
