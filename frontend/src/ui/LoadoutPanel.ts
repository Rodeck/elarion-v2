import type {
  LoadoutStatePayload,
  LoadoutSlotDto,
  OwnedAbilityDto,
  LoadoutUpdateRejectedPayload,
} from '../../../shared/protocol/index';
import { SkillDetailModal } from './SkillDetailModal';

type SlotName = 'auto_1' | 'auto_2' | 'auto_3' | 'active';

const SLOT_DEFS: { name: SlotName; label: string }[] = [
  { name: 'auto_1', label: 'Auto 1' },
  { name: 'auto_2', label: 'Auto 2' },
  { name: 'auto_3', label: 'Auto 3' },
  { name: 'active', label: 'Active' },
];

export class LoadoutPanel {
  private container: HTMLElement;
  private onUpdateSlot: (slotName: SlotName, abilityId: number | null, priority: number) => void;

  private slotsRowEl!: HTMLElement;
  private abilityGridEl!: HTMLElement;
  private lockedBannerEl!: HTMLElement;

  private ownedAbilities: OwnedAbilityDto[] = [];
  private slots: LoadoutSlotDto[] = [];
  private locked = false;
  private dragType: 'ability' | 'slot' | null = null;
  private cooldownTimers: ReturnType<typeof setInterval>[] = [];
  private skillDetailModal: SkillDetailModal;

  constructor(
    container: HTMLElement,
    onUpdateSlot: (slotName: SlotName, abilityId: number | null, priority: number) => void,
  ) {
    this.container = container;
    this.onUpdateSlot = onUpdateSlot;
    this.skillDetailModal = new SkillDetailModal(document.body);
    this.build();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  render(payload: LoadoutStatePayload): void {
    this.clearCooldownTimers();
    this.slots = payload.slots;
    this.ownedAbilities = payload.owned_abilities;
    this.renderSlots();
    this.renderAbilityGrid();
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.lockedBannerEl.style.display = locked ? '' : 'none';
    this.clearCooldownTimers();
    this.renderSlots();
    this.renderAbilityGrid();
  }

  handleUpdateRejected(payload: LoadoutUpdateRejectedPayload): void {
    const cell = this.slotsRowEl.querySelector<HTMLElement>(`[data-slot="${payload.slot_name}"]`);
    if (!cell) return;
    cell.style.borderColor = '#c06060';
    setTimeout(() => {
      const slot = this.slots.find((s) => s.slot_name === payload.slot_name);
      cell.style.borderColor = slot?.ability ? '#5a4a2a' : '#4a3820';
    }, 600);
  }

  // ---------------------------------------------------------------------------
  // Build skeleton
  // ---------------------------------------------------------------------------

  private build(): void {
    this.container.innerHTML = '';
    this.container.style.cssText =
      'display:flex;flex-direction:column;height:100%;overflow:hidden;box-sizing:border-box;';

    // Locked banner
    this.lockedBannerEl = document.createElement('div');
    this.lockedBannerEl.style.cssText =
      'display:none;background:#3a1010;color:#c06060;font-size:13px;font-family:Cinzel,serif;' +
      'text-align:center;padding:4px 8px;border-bottom:1px solid #5a2020;flex-shrink:0;';
    this.lockedBannerEl.textContent = 'Loadout locked during combat';
    this.container.appendChild(this.lockedBannerEl);

    // Slots header
    const slotsHeader = document.createElement('div');
    slotsHeader.style.cssText =
      'padding:6px 8px 4px;font-size:12px;color:#5a4a2a;font-family:Cinzel,serif;letter-spacing:0.06em;flex-shrink:0;';
    slotsHeader.textContent = 'SLOTS';
    this.container.appendChild(slotsHeader);

    // Slots row — 4 square cells side by side
    this.slotsRowEl = document.createElement('div');
    this.slotsRowEl.style.cssText =
      'display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:0 8px 8px;flex-shrink:0;';
    this.container.appendChild(this.slotsRowEl);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:#3a2e1a;flex-shrink:0;';
    this.container.appendChild(divider);

    // Ability list header
    const listHeader = document.createElement('div');
    listHeader.style.cssText =
      'padding:6px 8px 4px;font-size:12px;color:#5a4a2a;font-family:Cinzel,serif;letter-spacing:0.06em;flex-shrink:0;';
    listHeader.textContent = 'OWNED ABILITIES';
    this.container.appendChild(listHeader);

    // Ability list — drop target for unequipping
    this.abilityGridEl = document.createElement('div');
    this.abilityGridEl.style.cssText =
      'display:flex;flex-direction:column;gap:4px;padding:0 8px 8px;flex:1;overflow-y:auto;';

    this.abilityGridEl.addEventListener('dragover', (e) => {
      if (this.dragType !== 'slot') return;
      e.preventDefault();
      (e.dataTransfer as DataTransfer).dropEffect = 'move';
      this.abilityGridEl.style.background = 'rgba(90,74,42,0.2)';
    });
    this.abilityGridEl.addEventListener('dragleave', () => {
      this.abilityGridEl.style.background = '';
    });
    this.abilityGridEl.addEventListener('drop', (e) => {
      this.abilityGridEl.style.background = '';
      if (this.locked) return;
      const data = this.parseDragData(e);
      if (data?.type !== 'slot') return;
      e.preventDefault();
      this.onUpdateSlot(data.slot_name as SlotName, null, 1);
    });

    this.container.appendChild(this.abilityGridEl);

    this.renderSlots();
    this.renderAbilityGrid();
  }

  // ---------------------------------------------------------------------------
  // Render slots
  // ---------------------------------------------------------------------------

  private renderSlots(): void {
    this.slotsRowEl.innerHTML = '';
    for (const def of SLOT_DEFS) {
      const slotData = this.slots.find((s) => s.slot_name === def.name);
      this.slotsRowEl.appendChild(this.buildSlotCell(def.name, def.label, slotData));
    }
  }

  private buildSlotCell(name: SlotName, label: string, slotData: LoadoutSlotDto | undefined): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';

    const cell = document.createElement('div');
    cell.dataset['slot'] = name;
    const ability = slotData?.ability ?? null;
    const occupied = ability !== null;

    cell.style.cssText =
      `aspect-ratio:1;width:100%;background:${occupied ? '#252119' : '#1c1814'};` +
      `border:1px ${occupied ? 'solid #5a4a2a' : 'dashed #4a3820'};border-radius:2px;` +
      'position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;' +
      'transition:border-color 0.15s,background 0.15s;box-sizing:border-box;';

    if (occupied) {
      // Tinted background swatch based on effect type
      const swatch = document.createElement('div');
      swatch.style.cssText =
        `position:absolute;inset:0;background:${this.getEffectTypeColor(ability!.effect_type)};opacity:0.12;pointer-events:none;`;
      cell.appendChild(swatch);

      if (ability!.icon_url) {
        const img = document.createElement('img');
        img.src = ability!.icon_url;
        img.alt = ability!.name;
        img.style.cssText =
          'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72%;height:72%;object-fit:contain;pointer-events:none;image-rendering:pixelated;';
        img.onerror = () => { img.remove(); cell.appendChild(this.buildLetterPlaceholder(ability!)); };
        cell.appendChild(img);
      } else {
        cell.appendChild(this.buildLetterPlaceholder(ability!));
      }

      // Mana cost badge
      const badge = document.createElement('span');
      badge.style.cssText =
        'position:absolute;bottom:1px;right:2px;font-size:11px;color:#7aabcf;' +
        'font-family:Rajdhani,sans-serif;font-weight:700;line-height:1;pointer-events:none;';
      badge.textContent = String(ability!.mana_cost);
      cell.appendChild(badge);

      // Level badge overlay (top-left)
      const lvlOverlay = document.createElement('span');
      lvlOverlay.style.cssText =
        'position:absolute;top:1px;left:1px;font-size:9px;color:#d4a84b;' +
        'font-family:Rajdhani,sans-serif;font-weight:700;line-height:1;' +
        'background:rgba(0,0,0,0.6);padding:1px 3px;border-radius:2px;pointer-events:none;';
      lvlOverlay.textContent = `Lv.${ability!.level}`;
      cell.appendChild(lvlOverlay);

      cell.title = `${ability!.name} (Lv.${ability!.level})\n${ability!.mana_cost} MP · ${ability!.effect_type}`;
      cell.style.cursor = this.locked ? 'default' : 'grab';
      cell.draggable = !this.locked;

      cell.addEventListener('dragstart', (e) => {
        if (this.locked) { e.preventDefault(); return; }
        (e.dataTransfer as DataTransfer).setData(
          'text/plain',
          JSON.stringify({ type: 'slot', slot_name: name }),
        );
        (e.dataTransfer as DataTransfer).effectAllowed = 'move';
        this.dragType = 'slot';
      });
      cell.addEventListener('dragend', () => { this.dragType = null; });

    } else {
      cell.appendChild(this.buildCrosshair());
      cell.style.cursor = 'default';
    }

    // Drop target: accept dragged ability from the grid
    cell.addEventListener('dragover', (e) => {
      if (this.locked || this.dragType !== 'ability') return;
      e.preventDefault();
      (e.dataTransfer as DataTransfer).dropEffect = 'move';
      cell.style.borderColor = '#d4a84b';
      cell.style.background = 'rgba(90,74,42,0.3)';
    });
    cell.addEventListener('dragleave', () => {
      cell.style.borderColor = occupied ? '#5a4a2a' : '#4a3820';
      cell.style.background = occupied ? '#252119' : '#1c1814';
    });
    cell.addEventListener('drop', (e) => {
      cell.style.borderColor = occupied ? '#5a4a2a' : '#4a3820';
      cell.style.background = occupied ? '#252119' : '#1c1814';
      if (this.locked) return;
      const data = this.parseDragData(e);
      if (data?.type !== 'ability') return;
      e.preventDefault();
      const priority = slotData?.priority ?? 1;
      this.onUpdateSlot(name, data.id as number, priority);
    });

    wrapper.appendChild(cell);

    // Slot-type label (always shown, dimmer)
    const slotLabelEl = document.createElement('div');
    slotLabelEl.style.cssText =
      'font-size:10px;color:#5a4a2a;font-family:Cinzel,serif;letter-spacing:0.04em;text-align:center;line-height:1.2;';
    slotLabelEl.textContent = label;
    wrapper.appendChild(slotLabelEl);

    // Spell name (shown only when occupied)
    if (occupied) {
      const spellNameEl = document.createElement('div');
      spellNameEl.style.cssText =
        'font-size:11px;color:#c9a55c;font-family:Cinzel,serif;text-align:center;' +
        'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;';
      spellNameEl.textContent = ability!.name;
      spellNameEl.title = ability!.name;
      wrapper.appendChild(spellNameEl);
    }

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Render ability grid
  // ---------------------------------------------------------------------------

  private renderAbilityGrid(): void {
    this.abilityGridEl.innerHTML = '';

    if (this.ownedAbilities.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'color:#5a4a2a;font-size:13px;font-family:Cinzel,serif;padding:12px 0;text-align:center;';
      empty.textContent = 'No abilities owned yet.';
      this.abilityGridEl.appendChild(empty);
      return;
    }

    for (const ability of this.ownedAbilities) {
      this.abilityGridEl.appendChild(this.buildAbilityRow(ability));
    }
  }

  private buildAbilityRow(ability: OwnedAbilityDto): HTMLElement {
    const row = document.createElement('div');
    row.dataset['abilityId'] = String(ability.id);
    row.style.cssText =
      'display:flex;flex-direction:column;gap:2px;' +
      'background:#1a1510;border:1px solid #2a2010;border-radius:2px;' +
      `padding:5px 7px;cursor:${this.locked ? 'default' : 'grab'};` +
      'transition:border-color 0.15s,background 0.15s;';

    // Top line: name + level badge + mana cost + effect type
    const topLine = document.createElement('div');
    topLine.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:0.85rem;color:#c9a55c;font-family:Cinzel,serif;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameEl.textContent = ability.name;

    const levelBadge = document.createElement('span');
    levelBadge.style.cssText = 'font-size:11px;color:#d4a84b;font-family:Rajdhani,sans-serif;font-weight:700;flex-shrink:0;';
    levelBadge.textContent = `Lv.${ability.level}`;

    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;';

    const costEl = document.createElement('div');
    costEl.style.cssText = 'font-size:0.7rem;color:#6a8ab0;flex-shrink:0;';
    costEl.textContent = `${ability.mana_cost} MP`;

    const typeChip = document.createElement('div');
    typeChip.style.cssText =
      'font-size:0.65rem;padding:1px 5px;border-radius:2px;flex-shrink:0;' +
      `background:${this.getEffectTypeColor(ability.effect_type)};color:#1a1510;`;
    typeChip.textContent = ability.effect_type;

    topLine.appendChild(nameEl);
    topLine.appendChild(levelBadge);
    topLine.appendChild(spacer);
    topLine.appendChild(costEl);
    topLine.appendChild(typeChip);
    row.appendChild(topLine);

    // Bottom line: progress bar + mastered/cooldown text
    const bottomLine = document.createElement('div');
    bottomLine.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const isMaxLevel = ability.level >= 5;

    // Progress bar
    const barBg = document.createElement('div');
    barBg.style.cssText = 'width:100px;height:4px;background:#1a1814;border-radius:2px;overflow:hidden;flex-shrink:0;';
    const barFill = document.createElement('div');
    const fillPct = isMaxLevel ? 100 : (ability.points_to_next ? (ability.points / ability.points_to_next) * 100 : 0);
    barFill.style.cssText =
      `width:${fillPct}%;height:100%;background:${isMaxLevel ? '#27ae60' : '#d4a84b'};border-radius:2px;`;
    barBg.appendChild(barFill);
    bottomLine.appendChild(barBg);

    if (isMaxLevel) {
      const masteredEl = document.createElement('span');
      masteredEl.style.cssText = 'font-size:10px;color:#27ae60;font-family:Rajdhani,sans-serif;font-weight:700;flex-shrink:0;';
      masteredEl.textContent = 'MASTERED';
      bottomLine.appendChild(masteredEl);
    } else {
      const pointsEl = document.createElement('span');
      pointsEl.style.cssText = 'font-size:10px;color:#7a6a4a;font-family:Rajdhani,sans-serif;flex-shrink:0;';
      pointsEl.textContent = `${ability.points}/${ability.points_to_next ?? 100}`;
      bottomLine.appendChild(pointsEl);
    }

    // Cooldown timer
    if (ability.cooldown_until) {
      const cdEl = document.createElement('span');
      cdEl.style.cssText = 'font-size:10px;color:#c06060;font-family:Rajdhani,sans-serif;flex-shrink:0;margin-left:auto;';
      const updateCd = () => {
        const text = this.formatCooldownRemaining(ability.cooldown_until!);
        if (text) {
          cdEl.textContent = text;
          cdEl.style.display = '';
        } else {
          cdEl.style.display = 'none';
        }
      };
      updateCd();
      const timer = setInterval(updateCd, 60_000);
      this.cooldownTimers.push(timer);
      bottomLine.appendChild(cdEl);
    }

    row.appendChild(bottomLine);

    row.addEventListener('mouseenter', () => {
      if (this.dragType) return;
      row.style.borderColor = '#5a4a2a';
      row.style.background = '#221a0c';
    });
    row.addEventListener('mouseleave', () => {
      row.style.borderColor = '#2a2010';
      row.style.background = '#1a1510';
    });

    row.draggable = !this.locked;
    let didDrag = false;
    row.addEventListener('dragstart', (e) => {
      if (this.locked) { e.preventDefault(); return; }
      didDrag = true;
      (e.dataTransfer as DataTransfer).setData(
        'text/plain',
        JSON.stringify({ type: 'ability', id: ability.id }),
      );
      (e.dataTransfer as DataTransfer).effectAllowed = 'move';
      this.dragType = 'ability';
    });
    row.addEventListener('dragend', () => { this.dragType = null; });
    row.addEventListener('click', () => {
      if (didDrag) { didDrag = false; return; }
      this.skillDetailModal.open(ability);
    });

    return row;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildLetterPlaceholder(ability: { name: string; effect_type: string }): HTMLElement {
    const color = this.getEffectTypeColor(ability.effect_type);
    const ph = document.createElement('div');
    ph.style.cssText =
      'position:absolute;inset:18%;display:flex;align-items:center;justify-content:center;' +
      `background:${color}33;border-radius:2px;pointer-events:none;`;  // 33 = 20% alpha in hex
    const letter = document.createElement('span');
    letter.style.cssText =
      `color:${color};font-family:Cinzel,serif;font-size:14px;font-weight:700;pointer-events:none;`;
    letter.textContent = (ability.name[0] ?? '?').toUpperCase();
    ph.appendChild(letter);
    return ph;
  }

  private buildCrosshair(): HTMLElement {
    const ph = document.createElement('div');
    ph.style.cssText = 'width:16px;height:16px;opacity:0.25;position:relative;pointer-events:none;';
    ph.innerHTML =
      '<div style="position:absolute;top:50%;left:0;width:100%;height:1px;background:#a89060;transform:translateY(-50%)"></div>' +
      '<div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#a89060;transform:translateX(-50%)"></div>';
    return ph;
  }

  private parseDragData(e: DragEvent): Record<string, unknown> | null {
    try {
      const raw = e.dataTransfer?.getData('text/plain');
      return raw ? JSON.parse(raw) as Record<string, unknown> : null;
    } catch { return null; }
  }

  private clearCooldownTimers(): void {
    for (const t of this.cooldownTimers) clearInterval(t);
    this.cooldownTimers = [];
  }

  private formatCooldownRemaining(isoUntil: string): string | null {
    const diff = new Date(isoUntil).getTime() - Date.now();
    if (diff <= 0) return null;
    const totalMin = Math.ceil(diff / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  private getEffectTypeColor(effectType: string): string {
    switch (effectType) {
      case 'damage':  return '#c0392b';
      case 'heal':    return '#27ae60';
      case 'buff':    return '#d4a84b';
      case 'debuff':  return '#8e44ad';
      case 'dot':     return '#e67e22';
      case 'reflect': return '#2980b9';
      case 'drain':   return '#1abc9c';
      default:        return '#7f8c8d';
    }
  }
}
