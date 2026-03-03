import type { CityMapBuilding, CityBuildingActionPayload } from '@elarion/protocol';

type TravelCallback = (payload: CityBuildingActionPayload) => void;

export class BuildingPanel {
  private container: HTMLElement;
  private overlay: HTMLElement | null = null;
  private onTravel: TravelCallback | null = null;

  constructor(parent: HTMLElement, onTravel: TravelCallback) {
    this.container = parent;
    this.onTravel = onTravel;
  }

  show(building: CityMapBuilding): void {
    this.hide();

    const panel = document.createElement('div');
    panel.id = 'building-panel';
    panel.style.cssText = [
      'position:absolute',
      'top:0',
      'right:0',
      'width:260px',
      'height:100%',
      'background:rgba(15,13,10,0.92)',
      'border-left:1px solid #5a4a2a',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'display:flex',
      'flex-direction:column',
      'z-index:100',
      'box-sizing:border-box',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 16px 8px;border-bottom:1px solid #3a2e1a;';
    const title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:15px;letter-spacing:0.08em;color:#e8c870;';
    title.textContent = building.name;
    header.appendChild(title);
    panel.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding:12px 16px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;';

    // Description
    if (building.description) {
      const desc = document.createElement('p');
      desc.style.cssText = 'margin:0;font-family:\"Crimson Text\",serif;font-size:13px;color:#a89060;line-height:1.5;';
      desc.textContent = building.description;
      body.appendChild(desc);
    }

    // Actions
    if (building.actions.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'margin:0;font-family:\"Crimson Text\",serif;font-size:12px;color:#6a5a3a;font-style:italic;';
      empty.textContent = 'Nothing to do here.';
      body.appendChild(empty);
    } else {
      const actionsSection = document.createElement('div');
      actionsSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:4px;';

      for (const action of building.actions) {
        const btn = document.createElement('button');
        btn.dataset['actionId'] = String(action.id);
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
          this.onTravel?.({
            building_id: building.id,
            action_id: action.id,
            action_type: action.action_type,
          });
        });

        actionsSection.appendChild(btn);
      }

      body.appendChild(actionsSection);
    }

    // Error area (initially hidden)
    const errorEl = document.createElement('p');
    errorEl.id = 'building-panel-error';
    errorEl.style.cssText = 'margin:0;font-family:\"Crimson Text\",serif;font-size:12px;color:#c0504a;display:none;';
    body.appendChild(errorEl);

    panel.appendChild(body);

    // Make the parent relative if not already
    const parentPos = getComputedStyle(this.container).position;
    if (parentPos === 'static') this.container.style.position = 'relative';

    this.container.appendChild(panel);
    this.overlay = panel;
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  showRejection(reason: string): void {
    if (!this.overlay) return;
    this.enableButtons();
    const errorEl = this.overlay.querySelector<HTMLElement>('#building-panel-error');
    if (errorEl) {
      errorEl.textContent = this.rejectionMessage(reason);
      errorEl.style.display = 'block';
    }
  }

  private disableButtons(): void {
    if (!this.overlay) return;
    this.overlay.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    });
  }

  private enableButtons(): void {
    if (!this.overlay) return;
    this.overlay.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    });
  }

  private rejectionMessage(reason: string): string {
    switch (reason) {
      case 'NOT_AT_BUILDING': return 'You are no longer at this building.';
      case 'INVALID_ACTION': return 'This action is no longer available.';
      case 'INVALID_DESTINATION': return 'The destination no longer exists.';
      case 'IN_COMBAT': return 'You cannot travel while in combat.';
      case 'NOT_CITY_MAP': return 'Travel is only available in city maps.';
      default: return 'Travel failed. Please try again.';
    }
  }

  destroy(): void {
    this.hide();
  }
}
