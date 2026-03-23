import { InventoryPanel } from './InventoryPanel';
import { EquipmentPanel } from './EquipmentPanel';
import { LoadoutPanel } from './LoadoutPanel';
import type {
  InventorySlotDto,
  InventoryStatePayload,
  InventoryItemReceivedPayload,
  InventoryFullPayload,
  EquipmentStatePayload,
  EquipmentChangedPayload,
  EquipmentEquipRejectedPayload,
  EquipmentUnequipRejectedPayload,
  EquipSlot,
  LoadoutStatePayload,
  LoadoutUpdateRejectedPayload,
} from '../../../shared/protocol/index';

const EQUIPPABLE_CATEGORIES = ['weapon', 'shield', 'boots', 'greaves', 'bracer', 'helmet', 'chestplate'];

export class LeftPanel {
  private container: HTMLElement;
  private onEquip: (slotId: number, slotName: EquipSlot) => void;
  private onUnequip: (slotName: EquipSlot) => void;
  private onDeleteItem: (slotId: number) => void;
  private onUpdateLoadoutSlot: (slotName: 'auto_1' | 'auto_2' | 'auto_3' | 'active', abilityId: number | null, priority: number) => void;

  private tabsEl!: HTMLElement;
  private equipmentContentEl!: HTMLElement;
  private inventoryContentEl!: HTMLElement;
  private loadoutContentEl!: HTMLElement;

  private inventoryPanel: InventoryPanel;
  private equipmentPanel: EquipmentPanel | null = null;
  private loadoutPanel: LoadoutPanel | null = null;
  private activeTab: 'equipment' | 'inventory' | 'loadout' = 'inventory';

  private inventorySlots: InventorySlotDto[] = [];

  getInventorySlots(): InventorySlotDto[] {
    return this.inventorySlots;
  }

  constructor(
    container: HTMLElement,
    onEquip: (slotId: number, slotName: EquipSlot) => void,
    onUnequip: (slotName: EquipSlot) => void,
    onDeleteItem: (slotId: number) => void,
    onUpdateLoadoutSlot?: (slotName: 'auto_1' | 'auto_2' | 'auto_3' | 'active', abilityId: number | null, priority: number) => void,
  ) {
    this.container = container;
    this.onEquip = onEquip;
    this.onUnequip = onUnequip;
    this.onDeleteItem = onDeleteItem;
    this.onUpdateLoadoutSlot = onUpdateLoadoutSlot ?? (() => undefined);

    this.build();

    // Inventory panel mounts in the inventory content pane
    this.inventoryPanel = new InventoryPanel(this.inventoryContentEl, onDeleteItem);
  }

  private build(): void {
    this.container.innerHTML = '';
    this.container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

    // Tab bar
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'left-panel__tabs';

    const tabs: { id: 'equipment' | 'inventory' | 'loadout'; label: string }[] = [
      { id: 'inventory', label: '🎒 Inventory' },
      { id: 'equipment', label: '⚔ Equipment' },
      { id: 'loadout',   label: '🗡 Loadout' },
    ];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = 'left-panel__tab' + (tab.id === this.activeTab ? ' is-active' : '');
      btn.dataset['tab'] = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => this.showTab(tab.id as 'equipment' | 'inventory' | 'loadout'));
      this.tabsEl.appendChild(btn);
    }

    // Content panes
    this.equipmentContentEl = document.createElement('div');
    this.equipmentContentEl.style.cssText = 'flex:1;display:none;overflow:hidden;flex-direction:column;';

    this.inventoryContentEl = document.createElement('div');
    this.inventoryContentEl.style.cssText = 'flex:1;display:flex;overflow:hidden;flex-direction:column;';

    this.loadoutContentEl = document.createElement('div');
    this.loadoutContentEl.style.cssText = 'flex:1;display:none;overflow:hidden;flex-direction:column;';

    this.container.appendChild(this.tabsEl);
    this.container.appendChild(this.equipmentContentEl);
    this.container.appendChild(this.inventoryContentEl);
    this.container.appendChild(this.loadoutContentEl);

    // Show default tab
    this.updateTabVisibility();
  }

  // ---------------------------------------------------------------------------
  // EquipmentPanel lazy initialization
  // ---------------------------------------------------------------------------

  private ensureEquipmentPanel(): EquipmentPanel {
    if (!this.equipmentPanel) {
      this.equipmentPanel = new EquipmentPanel(
        this.equipmentContentEl,
        this.onEquip,
        this.onUnequip,
      );
      // EquipmentPanel.build() sets display:flex on the container — restore correct visibility
      this.updateTabVisibility();
    }
    return this.equipmentPanel;
  }

  private ensureLoadoutPanel(): LoadoutPanel {
    if (!this.loadoutPanel) {
      this.loadoutPanel = new LoadoutPanel(
        this.loadoutContentEl,
        this.onUpdateLoadoutSlot,
      );
      // LoadoutPanel.render() sets display:flex on the container — restore correct visibility
      this.updateTabVisibility();
    }
    return this.loadoutPanel;
  }

  // ---------------------------------------------------------------------------
  // Tab navigation
  // ---------------------------------------------------------------------------

  showTab(tab: 'equipment' | 'inventory' | 'loadout'): void {
    this.activeTab = tab;
    this.updateTabVisibility();

    // Update button active state
    this.tabsEl.querySelectorAll<HTMLButtonElement>('.left-panel__tab').forEach((btn) => {
      const isActive = btn.dataset['tab'] === tab;
      btn.classList.toggle('is-active', isActive);
    });

    // If switching to equipment, ensure panel exists and sync mini-inventory
    if (tab === 'equipment') {
      const ep = this.ensureEquipmentPanel();
      ep.renderMiniInventory(this.inventorySlots.filter((s) => EQUIPPABLE_CATEGORIES.includes(s.definition.category)));
    }

    // If switching to loadout, ensure panel exists
    if (tab === 'loadout') {
      this.ensureLoadoutPanel();
    }
  }

  private updateTabVisibility(): void {
    const tab = this.activeTab;
    this.equipmentContentEl.style.display = tab === 'equipment' ? 'flex' : 'none';
    this.inventoryContentEl.style.display  = tab === 'inventory' ? 'flex' : 'none';
    this.loadoutContentEl.style.display    = tab === 'loadout'   ? 'flex' : 'none';
  }

  // ---------------------------------------------------------------------------
  // Inventory pass-through
  // ---------------------------------------------------------------------------

  onInventoryState(payload: InventoryStatePayload): void {
    this.inventorySlots = payload.slots;
    this.inventoryPanel.renderInventory(payload.slots, payload.capacity);
    // Sync mini-inventory if equipment panel is already rendered
    if (this.equipmentPanel) {
      this.equipmentPanel.renderMiniInventory(this.inventorySlots.filter((s) => EQUIPPABLE_CATEGORIES.includes(s.definition.category)));
    }
  }

  onInventoryItemReceived(payload: InventoryItemReceivedPayload): void {
    const slot = payload.slot;
    const existing = this.inventorySlots.findIndex((s) => s.slot_id === slot.slot_id);
    if (existing >= 0) {
      this.inventorySlots[existing] = slot;
    } else {
      this.inventorySlots.push(slot);
    }
    this.inventoryPanel.addOrUpdateSlot(slot);
    if (this.equipmentPanel && EQUIPPABLE_CATEGORIES.includes(slot.definition.category)) {
      this.equipmentPanel.addMiniInventorySlot(slot);
    }
  }

  onInventoryItemDeleted(slotId: number): void {
    this.inventorySlots = this.inventorySlots.filter((s) => s.slot_id !== slotId);
    this.inventoryPanel.removeSlot(slotId);
    if (this.equipmentPanel) {
      this.equipmentPanel.removeMiniInventorySlot(slotId);
    }
  }

  onInventoryFull(_payload: InventoryFullPayload): void {
    // Handled by caller (GameScene shows chat message)
  }

  showDeleteError(slotId: number): void {
    this.inventoryPanel.showDeleteError(slotId);
  }

  // ---------------------------------------------------------------------------
  // Equipment pass-through
  // ---------------------------------------------------------------------------

  onEquipmentState(payload: EquipmentStatePayload): void {
    const ep = this.ensureEquipmentPanel();
    ep.renderEquipmentState(payload.slots);
    ep.renderMiniInventory(this.inventorySlots.filter((s) => EQUIPPABLE_CATEGORIES.includes(s.definition.category)));
  }

  onEquipmentChanged(payload: EquipmentChangedPayload): void {
    const ep = this.ensureEquipmentPanel();
    ep.renderEquipmentState(payload.slots);

    for (const id of payload.inventory_removed) {
      ep.removeMiniInventorySlot(id);
      this.inventoryPanel.removeSlot(id);
      this.inventorySlots = this.inventorySlots.filter((s) => s.slot_id !== id);
    }

    for (const slot of payload.inventory_added) {
      this.inventoryPanel.addOrUpdateSlot(slot);
      const existing = this.inventorySlots.findIndex((s) => s.slot_id === slot.slot_id);
      if (existing >= 0) {
        this.inventorySlots[existing] = slot;
      } else {
        this.inventorySlots.push(slot);
      }
      if (EQUIPPABLE_CATEGORIES.includes(slot.definition.category)) {
        ep.addMiniInventorySlot(slot);
      }
    }
  }

  onEquipRejected(payload: EquipmentEquipRejectedPayload): void {
    const ep = this.ensureEquipmentPanel();
    const messages: Record<string, string> = {
      ITEM_NOT_FOUND:    'Item not found.',
      WRONG_SLOT_TYPE:   'Wrong slot type for this item.',
      TWO_HANDED_BLOCKS: 'Cannot equip shield with two-handed weapon.',
      INVENTORY_FULL:    'Inventory is full.',
      NOT_AUTHENTICATED: 'Not authenticated.',
    };
    const msg = messages[payload.reason] ?? 'Could not equip item.';
    ep.showNotification(msg, 'error');
  }

  onUnequipRejected(payload: EquipmentUnequipRejectedPayload): void {
    const ep = this.ensureEquipmentPanel();
    const messages: Record<string, string> = {
      SLOT_EMPTY:        'Nothing equipped in that slot.',
      INVENTORY_FULL:    'Inventory is full.',
      NOT_AUTHENTICATED: 'Not authenticated.',
    };
    const msg = messages[payload.reason] ?? 'Could not unequip item.';
    ep.showNotification(msg, 'error');
  }

  // ---------------------------------------------------------------------------
  // Loadout pass-through
  // ---------------------------------------------------------------------------

  updateLoadout(payload: LoadoutStatePayload): void {
    const lp = this.ensureLoadoutPanel();
    lp.render(payload);
  }

  setLoadoutLocked(locked: boolean): void {
    const lp = this.ensureLoadoutPanel();
    lp.setLocked(locked);
  }

  handleLoadoutUpdateRejected(payload: LoadoutUpdateRejectedPayload): void {
    const lp = this.ensureLoadoutPanel();
    lp.handleUpdateRejected(payload);
  }
}
