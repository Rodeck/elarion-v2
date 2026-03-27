import type {
  EquipmentSlotsDto,
  EquipSlot,
  InventorySlotDto,
} from '../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Slot → allowed item categories mapping (client-side validation only)
// ---------------------------------------------------------------------------

const SLOT_CATEGORY_MAP: Record<EquipSlot, string[]> = {
  right_arm:  ['weapon'],
  left_arm:   ['shield'],
  helmet:     ['helmet'],
  chestplate: ['chestplate'],
  greaves:    ['greaves'],
  bracer:     ['bracer'],
  boots:      ['boots'],
  ring:       ['ring'],
  amulet:     ['amulet'],
};

const ARMOR_CATEGORIES = ['shield', 'boots', 'greaves', 'bracer', 'helmet', 'chestplate', 'ring', 'amulet'];
const TWO_HANDED_SUBTYPES = ['two_handed', 'staff'];

// ---------------------------------------------------------------------------
// Slot layout config: name, label, grid area
// ---------------------------------------------------------------------------

interface SlotConfig {
  name: EquipSlot;
  label: string;
  gridArea: string;
}

const SLOT_CONFIGS: SlotConfig[] = [
  { name: 'helmet',     label: 'Helmet',     gridArea: 'helmet'     },
  { name: 'chestplate', label: 'Chest',      gridArea: 'chest'      },
  { name: 'left_arm',   label: 'Left Arm',   gridArea: 'leftarm'    },
  { name: 'right_arm',  label: 'Right Arm',  gridArea: 'rightarm'   },
  { name: 'greaves',    label: 'Greaves',    gridArea: 'greaves'    },
  { name: 'bracer',     label: 'Bracer',     gridArea: 'bracer'     },
  { name: 'boots',      label: 'Boots',      gridArea: 'boots'      },
  { name: 'ring',       label: 'Ring',        gridArea: 'ring'       },
  { name: 'amulet',     label: 'Amulet',     gridArea: 'amulet'     },
];

export class EquipmentPanel {
  private container: HTMLElement;
  private onEquip: (slotId: number, slotName: EquipSlot) => void;
  private onUnequip: (slotName: EquipSlot) => void;

  private slotElements = new Map<EquipSlot, HTMLElement>();
  private miniInventoryGrid!: HTMLElement;
  private miniInventorySlots = new Map<number, InventorySlotDto>();
  private miniInventoryFilter: 'weapon' | 'armor' = 'weapon';
  private notificationEl!: HTMLElement;
  private leftArmGrayedOut = false;
  private currentDragType: 'inventory' | 'equipped' | null = null;

  constructor(
    container: HTMLElement,
    onEquip: (slotId: number, slotName: EquipSlot) => void,
    onUnequip: (slotName: EquipSlot) => void,
  ) {
    this.container = container;
    this.onEquip = onEquip;
    this.onUnequip = onUnequip;
    this.build();
  }

  // ---------------------------------------------------------------------------
  // Build layout
  // ---------------------------------------------------------------------------

  private build(): void {
    this.container.innerHTML = '';
    this.container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

    // Notification area
    this.notificationEl = document.createElement('div');
    this.notificationEl.style.cssText =
      'flex-shrink:0;padding:0 8px;height:0;overflow:hidden;transition:height 0.15s;';
    this.container.appendChild(this.notificationEl);

    // Slot grid area
    const slotSection = document.createElement('div');
    slotSection.style.cssText =
      'flex-shrink:0;padding:12px 8px 8px;';

    const slotGrid = document.createElement('div');
    slotGrid.style.cssText = [
      'display:grid;',
      "grid-template-areas:'  .      helmet    .    ' 'leftarm  chest  rightarm' '  .      greaves   .    ' 'bracer    .      boots   ' 'ring      .      amulet  ';",
      'grid-template-columns: 1fr 1fr 1fr;',
      'grid-template-rows: auto auto auto auto auto;',
      'gap:6px;',
    ].join('');

    for (const cfg of SLOT_CONFIGS) {
      const slotEl = this.buildSlotElement(cfg);
      slotGrid.appendChild(slotEl);
      this.slotElements.set(cfg.name, slotEl);
    }

    slotSection.appendChild(slotGrid);
    this.container.appendChild(slotSection);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:#3a2e1a;flex-shrink:0;';
    this.container.appendChild(divider);

    // Mini-inventory section
    const miniSection = document.createElement('div');
    miniSection.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

    // Filter bar
    const filterBar = document.createElement('div');
    filterBar.style.cssText =
      'display:flex;gap:3px;padding:6px;background:#1a1814;border-bottom:1px solid #3a2e1a;flex-shrink:0;';

    const filters: { value: 'weapon' | 'armor'; label: string }[] = [
      { value: 'weapon', label: 'Weapons' },
      { value: 'armor',  label: 'Armor'   },
    ];

    for (const f of filters) {
      const btn = document.createElement('button');
      btn.textContent = f.label;
      btn.dataset['filter'] = f.value;
      btn.style.cssText =
        'flex:1;font-size:12px;padding:3px 9px;background:#252119;border:1px solid #5a4a2a;' +
        'color:#a89880;cursor:pointer;border-radius:2px;font-family:Cinzel,serif;letter-spacing:0.03em;' +
        'text-align:center;transition:color 0.15s,border-color 0.15s;';
      if (f.value === this.miniInventoryFilter) {
        btn.style.color = '#d4a84b';
        btn.style.borderColor = '#7a5a2a';
      }
      btn.addEventListener('click', () => {
        this.miniInventoryFilter = f.value;
        filterBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
          const active = b.dataset['filter'] === f.value;
          b.style.color = active ? '#d4a84b' : '#a89880';
          b.style.borderColor = active ? '#7a5a2a' : '#5a4a2a';
        });
        this.applyMiniInventoryFilter();
      });
      filterBar.appendChild(btn);
    }

    miniSection.appendChild(filterBar);

    // Grid
    this.miniInventoryGrid = document.createElement('div');
    this.miniInventoryGrid.style.cssText =
      'display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:8px;flex:1;align-content:start;overflow-y:auto;';

    // Make mini-inventory grid a drop target for unequip
    this.miniInventoryGrid.addEventListener('dragover', (e) => {
      if (this.currentDragType === 'equipped') {
        e.preventDefault();
        (e.dataTransfer as DataTransfer).dropEffect = 'move';
        this.miniInventoryGrid.style.background = 'rgba(90,74,42,0.3)';
      }
    });
    this.miniInventoryGrid.addEventListener('dragleave', () => {
      this.miniInventoryGrid.style.background = '';
    });
    this.miniInventoryGrid.addEventListener('drop', (e) => {
      this.miniInventoryGrid.style.background = '';
      const data = this.getDragData(e);
      if (data?.type === 'equipped') {
        e.preventDefault();
        this.onUnequip(data.slot_name as EquipSlot);
      }
    });

    miniSection.appendChild(this.miniInventoryGrid);
    this.container.appendChild(miniSection);
  }

  // ---------------------------------------------------------------------------
  // Slot element builder
  // ---------------------------------------------------------------------------

  private buildSlotElement(cfg: SlotConfig): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `grid-area:${cfg.gridArea};display:flex;flex-direction:column;align-items:center;gap:2px;`;

    const slot = document.createElement('div');
    slot.dataset['slotName'] = cfg.name;
    slot.style.cssText =
      'width:52px;height:52px;background:#1c1814;border:1px dashed #4a3820;border-radius:2px;' +
      'display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;' +
      'transition:border-color 0.15s,background 0.15s;cursor:default;';

    // Empty placeholder crosshair
    const ph = this.buildCrosshair();
    slot.appendChild(ph);

    const label = document.createElement('div');
    label.style.cssText =
      'font-size:9px;color:#7a6a52;font-family:Cinzel,serif;letter-spacing:0.04em;text-align:center;line-height:1.2;';
    label.textContent = cfg.label;

    wrapper.appendChild(slot);
    wrapper.appendChild(label);

    // Drag-over highlight
    slot.addEventListener('dragover', (e) => {
      if (cfg.name === 'left_arm' && this.leftArmGrayedOut) return;
      if (this.currentDragType === 'inventory') {
        e.preventDefault();
        (e.dataTransfer as DataTransfer).dropEffect = 'move';
        slot.style.borderColor = '#d4a84b';
        slot.style.background = 'rgba(90,74,42,0.3)';
      }
    });
    slot.addEventListener('dragleave', () => {
      this.resetSlotStyle(slot, cfg.name);
    });
    slot.addEventListener('drop', (e) => {
      this.resetSlotStyle(slot, cfg.name);
      if (cfg.name === 'left_arm' && this.leftArmGrayedOut) return;

      const data = this.getDragData(e);
      if (!data || data.type !== 'inventory') return;

      e.preventDefault();
      const slotId = data.slot_id as number;
      const inventorySlot = this.miniInventorySlots.get(slotId);

      if (!inventorySlot) return;

      // Client-side category validation
      const allowed = SLOT_CATEGORY_MAP[cfg.name] ?? [];
      if (!allowed.includes(inventorySlot.definition.category)) {
        // Red border flash
        slot.style.borderColor = '#c06060';
        slot.style.background = 'rgba(192,96,96,0.15)';
        setTimeout(() => this.resetSlotStyle(slot, cfg.name), 500);
        return;
      }

      this.onEquip(slotId, cfg.name);
    });

    return wrapper;
  }

  private buildCrosshair(): HTMLElement {
    const ph = document.createElement('div');
    ph.className = 'eq-slot-ph';
    ph.style.cssText = 'width:16px;height:16px;opacity:0.25;position:relative;';
    ph.innerHTML =
      '<div style="position:absolute;top:50%;left:0;width:100%;height:1px;background:#a89060;transform:translateY(-50%)"></div>' +
      '<div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#a89060;transform:translateX(-50%)"></div>';
    return ph;
  }

  private resetSlotStyle(slot: HTMLElement, slotName: EquipSlot): void {
    if (slotName === 'left_arm' && this.leftArmGrayedOut) return;
    const isOccupied = !slot.querySelector('.eq-slot-ph');
    slot.style.borderColor = isOccupied ? '#5a4a2a' : '#4a3820';
    slot.style.background = isOccupied ? '#252119' : '#1c1814';
  }

  // ---------------------------------------------------------------------------
  // renderEquipmentState — T013 + T022 (two-handed detection)
  // ---------------------------------------------------------------------------

  renderEquipmentState(slots: EquipmentSlotsDto): void {
    for (const cfg of SLOT_CONFIGS) {
      const wrapperEl = this.slotElements.get(cfg.name);
      if (!wrapperEl) continue;
      const slotEl = wrapperEl.querySelector<HTMLElement>('[data-slot-name]');
      if (!slotEl) continue;

      const item = slots[cfg.name];
      this.renderSlotItem(slotEl, cfg.name, item);
    }

    // Two-handed grayout detection — T022
    const rightArmItem = slots.right_arm;
    const isTwoHanded = rightArmItem != null &&
      TWO_HANDED_SUBTYPES.includes(rightArmItem.definition.weapon_subtype ?? '');

    this.leftArmGrayedOut = isTwoHanded;

    const leftArmWrapper = this.slotElements.get('left_arm');
    const leftArmSlot = leftArmWrapper?.querySelector<HTMLElement>('[data-slot-name]');
    if (leftArmSlot) {
      if (isTwoHanded) {
        leftArmSlot.style.opacity = '0.4';
        leftArmSlot.style.cursor = 'not-allowed';
        leftArmSlot.style.filter = 'grayscale(1)';
      } else {
        leftArmSlot.style.opacity = '';
        leftArmSlot.style.cursor = 'default';
        leftArmSlot.style.filter = '';
      }
    }
  }

  private renderSlotItem(slotEl: HTMLElement, slotName: EquipSlot, item: InventorySlotDto | null): void {
    // Clear existing content
    slotEl.innerHTML = '';

    if (!item) {
      // Empty slot
      slotEl.style.borderStyle = 'dashed';
      slotEl.style.borderColor = '#4a3820';
      slotEl.style.background = '#1c1814';
      slotEl.appendChild(this.buildCrosshair());
      return;
    }

    // Filled slot
    slotEl.style.borderStyle = 'solid';
    slotEl.style.borderColor = '#5a4a2a';
    slotEl.style.background = '#252119';

    if (item.definition.icon_url) {
      const img = document.createElement('img');
      img.src = item.definition.icon_url;
      img.alt = item.definition.name;
      img.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:76%;height:76%;object-fit:contain;';
      img.draggable = true;
      img.addEventListener('dragstart', (e) => {
        if (slotName === 'left_arm' && this.leftArmGrayedOut) {
          e.preventDefault();
          return;
        }
        (e.dataTransfer as DataTransfer).setData('text/plain', JSON.stringify({ type: 'equipped', slot_name: slotName }));
        (e.dataTransfer as DataTransfer).effectAllowed = 'move';
        this.currentDragType = 'equipped';
      });
      img.addEventListener('dragend', () => { this.currentDragType = null; });
      img.onerror = () => {
        img.style.display = 'none';
        slotEl.appendChild(this.buildIconPlaceholder(item.definition.category));
      };
      slotEl.appendChild(img);
    } else {
      const ph = this.buildIconPlaceholder(item.definition.category);
      ph.draggable = true;
      ph.addEventListener('dragstart', (e) => {
        if (slotName === 'left_arm' && this.leftArmGrayedOut) {
          e.preventDefault();
          return;
        }
        (e.dataTransfer as DataTransfer).setData('text/plain', JSON.stringify({ type: 'equipped', slot_name: slotName }));
        (e.dataTransfer as DataTransfer).effectAllowed = 'move';
        this.currentDragType = 'equipped';
      });
      ph.addEventListener('dragend', () => { this.currentDragType = null; });
      slotEl.appendChild(ph);
    }

    // Tooltip on hover — build from non-null stats
    const tipParts: string[] = [item.definition.name];
    const def = item.definition;
    if (def.attack != null) tipParts.push(`Attack: ${def.attack}`);
    if (def.defence != null) tipParts.push(`Defence: ${def.defence}`);
    if (def.heal_power != null) tipParts.push(`Heal: ${def.heal_power}`);
    if (def.max_mana > 0) tipParts.push(`Max Mana: +${def.max_mana}`);
    if (def.mana_on_hit > 0) tipParts.push(`Mana on Hit: +${def.mana_on_hit}`);
    if (def.mana_on_damage_taken > 0) tipParts.push(`Mana on Hit Taken: +${def.mana_on_damage_taken}`);
    if (def.mana_regen > 0) tipParts.push(`Mana Regen: +${def.mana_regen}`);
    if (def.dodge_chance > 0) tipParts.push(`Dodge: ${def.dodge_chance}%`);
    if (def.crit_chance > 0) tipParts.push(`Crit Chance: ${def.crit_chance}%`);
    if (def.crit_damage !== 150) tipParts.push(`Crit Dmg: ${def.crit_damage}%`);
    slotEl.title = tipParts.join('\n');
  }

  private buildIconPlaceholder(category: string): HTMLElement {
    const ph = document.createElement('div');
    ph.style.cssText =
      'position:absolute;inset:12%;background:#2a2520;display:flex;align-items:center;' +
      'justify-content:center;color:#a89880;font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;border-radius:1px;';
    ph.textContent = (category[0] ?? '?').toUpperCase();
    return ph;
  }

  // ---------------------------------------------------------------------------
  // Mini-inventory — T014
  // ---------------------------------------------------------------------------

  renderMiniInventory(slots: InventorySlotDto[]): void {
    this.miniInventorySlots.clear();
    this.miniInventoryGrid.innerHTML = '';
    for (const slot of slots) {
      this.miniInventorySlots.set(slot.slot_id, slot);
      const cell = this.buildMiniInventoryCell(slot);
      this.miniInventoryGrid.appendChild(cell);
    }
    this.applyMiniInventoryFilter();
  }

  addMiniInventorySlot(slot: InventorySlotDto): void {
    const existing = this.miniInventoryGrid.querySelector<HTMLElement>(`[data-slot-id="${slot.slot_id}"]`);
    if (existing) {
      const newCell = this.buildMiniInventoryCell(slot);
      existing.replaceWith(newCell);
    } else {
      this.miniInventoryGrid.appendChild(this.buildMiniInventoryCell(slot));
    }
    this.miniInventorySlots.set(slot.slot_id, slot);
    this.applyMiniInventoryFilter();
  }

  removeMiniInventorySlot(slotId: number): void {
    const cell = this.miniInventoryGrid.querySelector<HTMLElement>(`[data-slot-id="${slotId}"]`);
    cell?.remove();
    this.miniInventorySlots.delete(slotId);
  }

  private buildMiniInventoryCell(slot: InventorySlotDto): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'eq-mini-cell';
    cell.dataset['slotId'] = String(slot.slot_id);
    cell.dataset['category'] = slot.definition.category;
    cell.style.cssText =
      'position:relative;aspect-ratio:1;background:#252119;border:1px solid #5a4a2a;' +
      'cursor:grab;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:2px;' +
      'transition:border-color 0.15s,background 0.15s;';

    // Drag support — T016
    cell.draggable = true;
    cell.addEventListener('dragstart', (e) => {
      (e.dataTransfer as DataTransfer).setData('text/plain', JSON.stringify({ type: 'inventory', slot_id: slot.slot_id }));
      (e.dataTransfer as DataTransfer).effectAllowed = 'move';
      this.currentDragType = 'inventory';
    });
    cell.addEventListener('dragend', () => {
      cell.style.opacity = '';
      this.currentDragType = null;
    });

    cell.addEventListener('mouseenter', () => {
      cell.style.borderColor = '#a07830';
      cell.style.background = '#2f2820';
    });
    cell.addEventListener('mouseleave', () => {
      cell.style.borderColor = '#5a4a2a';
      cell.style.background = '#252119';
    });

    if (slot.definition.icon_url) {
      const img = document.createElement('img');
      img.src = slot.definition.icon_url;
      img.alt = slot.definition.name;
      img.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:76%;height:76%;object-fit:contain;pointer-events:none;';
      img.onerror = () => {
        img.style.display = 'none';
        cell.appendChild(this.buildIconPlaceholder(slot.definition.category));
      };
      cell.appendChild(img);
    } else {
      cell.appendChild(this.buildIconPlaceholder(slot.definition.category));
    }

    // Quantity badge
    if (slot.quantity > 1) {
      const badge = document.createElement('span');
      badge.textContent = String(slot.quantity);
      badge.style.cssText =
        'position:absolute;bottom:2px;right:3px;font-size:13px;color:#f0c060;' +
        'font-family:Rajdhani,sans-serif;font-weight:700;line-height:1;pointer-events:none;';
      cell.appendChild(badge);
    }

    cell.title = slot.definition.name;
    return cell;
  }

  private applyMiniInventoryFilter(): void {
    const filter = this.miniInventoryFilter;
    this.miniInventoryGrid.querySelectorAll<HTMLElement>('.eq-mini-cell').forEach((cell) => {
      const cat = cell.dataset['category'] ?? '';
      let visible = false;
      if (filter === 'weapon') {
        visible = cat === 'weapon';
      } else {
        visible = ARMOR_CATEGORIES.includes(cat);
      }
      cell.style.display = visible ? '' : 'none';
    });
  }

  // ---------------------------------------------------------------------------
  // Notification — T019, T021
  // ---------------------------------------------------------------------------

  showNotification(message: string, _type: 'error' | 'info' = 'error'): void {
    const el = document.createElement('div');
    el.style.cssText =
      'padding:6px 10px;background:#3a1a1a;border:1px solid #c06060;border-radius:2px;' +
      'color:#e08080;font-size:12px;font-family:Cinzel,serif;margin:6px 8px 0;';
    el.textContent = message;
    this.notificationEl.appendChild(el);
    this.notificationEl.style.height = 'auto';

    setTimeout(() => {
      el.remove();
      if (this.notificationEl.childElementCount === 0) {
        this.notificationEl.style.height = '0';
      }
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getDragData(e: DragEvent): Record<string, unknown> | null {
    try {
      const raw = e.dataTransfer?.getData('text/plain');
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
