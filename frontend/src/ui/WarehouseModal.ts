import type {
  WarehouseStatePayload,
  WarehouseSlotDto,
  WarehouseRejectedPayload,
  WarehouseBulkResultPayload,
  WarehouseBuySlotResultPayload,
} from '@elarion/protocol';
import { getCrownsIconUrl } from './ui-icons';

type SendFn = (type: string, payload: unknown) => void;
type LifecycleCallback = () => void;

export class WarehouseModal {
  private overlay: HTMLElement | null = null;
  private sendFn: SendFn | null = null;
  private buildingId = 0;
  private state: WarehouseStatePayload | null = null;

  // DOM refs
  private warehouseGridEl: HTMLElement | null = null;
  private headerInfoEl: HTMLElement | null = null;
  private feedbackEl: HTMLElement | null = null;

  private onOpenCallback: LifecycleCallback | null = null;
  private onCloseCallback: LifecycleCallback | null = null;

  private playerCrowns = 0;

  setSendFn(fn: SendFn): void { this.sendFn = fn; }
  setOnOpen(fn: LifecycleCallback): void { this.onOpenCallback = fn; }
  setOnClose(fn: LifecycleCallback): void { this.onCloseCallback = fn; }
  setPlayerCrowns(crowns: number): void { this.playerCrowns = crowns; }
  getBuildingId(): number { return this.buildingId; }

  open(buildingId: number): void {
    this.close();
    this.buildingId = buildingId;
    this.state = null;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'width:50vw',
      'max-width:520px',
      'height:70vh',
      'max-height:700px',
      'display:flex',
      'flex-direction:column',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7)',
      'overflow:hidden',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #5a4a2a;flex-shrink:0;';

    this.headerInfoEl = document.createElement('div');
    this.headerInfoEl.style.cssText = 'color:#e8c870;font-family:Cinzel,serif;font-size:16px;';
    this.headerInfoEl.textContent = 'Warehouse';
    header.appendChild(this.headerInfoEl);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'background:none;border:none;color:#c9a55c;font-size:18px;cursor:pointer;padding:4px 8px;';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Action buttons row
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid #3a3020;flex-shrink:0;';

    actionsRow.appendChild(this.createActionBtn('\u2190 All to Inventory', 'Transfer all to inventory', () => {
      this.sendFn?.('warehouse.bulk_to_inventory', { building_id: this.buildingId });
    }));
    actionsRow.appendChild(this.createActionBtn('All to Warehouse \u2192', 'Transfer all to warehouse', () => {
      this.sendFn?.('warehouse.bulk_to_warehouse', { building_id: this.buildingId });
    }));
    actionsRow.appendChild(this.createActionBtn('Merge \u21A3', 'Merge matching items to warehouse', () => {
      this.sendFn?.('warehouse.merge', { building_id: this.buildingId });
    }));
    modal.appendChild(actionsRow);

    // Warehouse grid
    this.warehouseGridEl = document.createElement('div');
    this.warehouseGridEl.style.cssText = 'flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;overflow-y:auto;align-content:start;padding:12px 16px;';
    this.setupWarehouseDropZone(this.warehouseGridEl);
    modal.appendChild(this.warehouseGridEl);

    // Footer: feedback only
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:8px 16px;border-top:1px solid #5a4a2a;flex-shrink:0;min-height:32px;';

    this.feedbackEl = document.createElement('div');
    this.feedbackEl.style.cssText = 'color:#c9a55c;font-size:12px;font-family:Crimson Text,serif;';
    footer.appendChild(this.feedbackEl);

    modal.appendChild(footer);
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.onOpenCallback?.();
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.warehouseGridEl = null;
    this.headerInfoEl = null;
    this.feedbackEl = null;
    this.state = null;
    this.onCloseCallback?.();
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  // ---------------------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------------------

  handleState(payload: WarehouseStatePayload): void {
    if (!this.overlay) {
      this.open(payload.building_id);
    }
    this.state = payload;
    this.renderWarehouseGrid();
    this.updateHeader();
  }

  handleRejected(payload: WarehouseRejectedPayload): void {
    this.showFeedback(payload.message);
  }

  handleBulkResult(payload: WarehouseBulkResultPayload): void {
    if (payload.partial) {
      this.showFeedback(`Transferred ${payload.transferred_count} items, ${payload.skipped_count} skipped (no space).`);
    } else if (payload.transferred_count > 0) {
      this.showFeedback(`Transferred ${payload.transferred_count} items.`);
    } else {
      this.showFeedback('Nothing to transfer.');
    }
  }

  handleBuySlotResult(payload: WarehouseBuySlotResultPayload): void {
    if (payload.success) {
      this.playerCrowns = payload.new_crowns;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderWarehouseGrid(): void {
    if (!this.warehouseGridEl || !this.state) return;
    this.warehouseGridEl.innerHTML = '';

    // Filled slots
    for (const slot of this.state.slots) {
      this.warehouseGridEl.appendChild(this.createItemSlot(slot));
    }

    // Empty slots (drop targets)
    const emptyCount = this.state.total_capacity - this.state.slots.length;
    for (let i = 0; i < emptyCount; i++) {
      this.warehouseGridEl.appendChild(this.createEmptySlot());
    }

    // Unlock next slot cell (shows cost)
    this.warehouseGridEl.appendChild(this.createUnlockSlot());
  }

  private createItemSlot(slot: WarehouseSlotDto): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText = [
      'width:100%',
      'aspect-ratio:1',
      'background:rgba(30,25,18,0.8)',
      'border:1px solid #5a4a2a',
      'border-radius:4px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'cursor:grab',
      'position:relative',
      'overflow:hidden',
      'padding:2px',
    ].join(';');

    if (slot.definition.icon_url) {
      const img = document.createElement('img');
      img.src = slot.definition.icon_url;
      img.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;';
      cell.appendChild(img);
    }

    const name = document.createElement('div');
    name.textContent = slot.definition.name;
    name.style.cssText = 'font-size:9px;color:#c9a55c;text-align:center;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;';
    cell.appendChild(name);

    if (slot.quantity > 1) {
      const qty = document.createElement('div');
      qty.textContent = `x${slot.quantity}`;
      qty.style.cssText = 'position:absolute;top:1px;right:3px;font-size:10px;color:#e8c870;font-family:Rajdhani,sans-serif;';
      cell.appendChild(qty);
    }

    if (slot.quality_label) {
      const ql = document.createElement('div');
      ql.textContent = slot.quality_label;
      ql.style.cssText = 'position:absolute;bottom:1px;left:2px;font-size:8px;color:#44cc44;';
      cell.appendChild(ql);
    }

    // Draggable — drag out to inventory panel to withdraw
    cell.draggable = true;
    cell.addEventListener('dragstart', (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          warehouse_slot_id: slot.slot_id,
          quantity: slot.quantity,
          shift: e.shiftKey,
        }));
        e.dataTransfer.effectAllowed = 'copyMove';
      }
      cell.style.opacity = '0.5';
    });
    cell.addEventListener('dragend', () => { cell.style.opacity = '1'; });

    return cell;
  }

  private createEmptySlot(): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText = [
      'width:100%',
      'aspect-ratio:1',
      'background:rgba(30,25,18,0.3)',
      'border:1px dashed #3a3020',
      'border-radius:4px',
    ].join(';');

    // Each empty slot is also a drop target
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      cell.style.borderColor = '#e8c870';
    });
    cell.addEventListener('dragleave', () => {
      cell.style.borderColor = '#3a3020';
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.style.borderColor = '#3a3020';
      this.handleDrop(e);
    });

    return cell;
  }

  private createUnlockSlot(): HTMLElement {
    const cell = document.createElement('div');
    const cost = this.state?.next_slot_cost ?? 0;
    const costStr = cost.toLocaleString();
    const canAfford = this.playerCrowns >= cost;

    cell.style.cssText = [
      'width:100%',
      'aspect-ratio:1',
      'background:rgba(90,74,42,0.15)',
      'border:2px dashed ' + (canAfford ? '#5a4a2a' : '#2a2218'),
      'border-radius:4px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'cursor:' + (canAfford ? 'pointer' : 'not-allowed'),
      'opacity:' + (canAfford ? '1' : '0.5'),
      'padding:2px',
      'gap:2px',
    ].join(';');

    const plus = document.createElement('div');
    plus.textContent = '+';
    plus.style.cssText = 'font-size:18px;color:#5a4a2a;line-height:1;';
    cell.appendChild(plus);

    const costEl = document.createElement('div');
    const crownsIcon = getCrownsIconUrl();
    if (crownsIcon) {
      costEl.innerHTML = `<img src="${crownsIcon}" style="width:10px;height:10px;vertical-align:middle;"> ${costStr}`;
    } else {
      costEl.textContent = costStr;
    }
    costEl.style.cssText = 'font-size:9px;color:#c9a55c;font-family:Rajdhani,sans-serif;text-align:center;';
    cell.appendChild(costEl);

    if (canAfford) {
      cell.addEventListener('click', () => {
        this.sendFn?.('warehouse.buy_slot', { building_id: this.buildingId });
      });
      cell.title = `Unlock slot for ${costStr} crowns`;
    } else {
      cell.title = `Need ${costStr} crowns`;
    }

    return cell;
  }

  private setupWarehouseDropZone(el: HTMLElement): void {
    // Grid-level drop handler as fallback (for drops on filled slots or grid gaps)
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    el.addEventListener('drop', (e) => {
      // Only handle if not already handled by an empty slot
      if (e.defaultPrevented) return;
      e.preventDefault();
      this.handleDrop(e);
    });
  }

  private handleDrop(e: DragEvent): void {
    const raw = e.dataTransfer?.getData('text/plain');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.slot_id !== undefined) {
        const totalQty = data.quantity ?? 1;
        if (data.shift && totalQty > 1) {
          this.showQuantityPicker(totalQty, (qty) => {
            this.sendFn?.('warehouse.deposit', {
              building_id: this.buildingId,
              inventory_slot_id: data.slot_id,
              quantity: qty,
            });
          });
        } else {
          this.sendFn?.('warehouse.deposit', {
            building_id: this.buildingId,
            inventory_slot_id: data.slot_id,
            quantity: totalQty,
          });
        }
      }
    } catch { /* ignore bad drag data */ }
  }

  private updateHeader(): void {
    if (!this.headerInfoEl || !this.state) return;
    this.headerInfoEl.textContent = `Warehouse \u2014 ${this.state.used_slots}/${this.state.total_capacity} slots`;
  }

  private createActionBtn(label: string, title: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = [
      'padding:5px 10px',
      'background:rgba(90,74,42,0.3)',
      'border:1px solid #5a4a2a',
      'border-radius:4px',
      'color:#e8c870',
      'font-family:Cinzel,serif',
      'font-size:11px',
      'cursor:pointer',
      'white-space:nowrap',
    ].join(';');
    btn.addEventListener('click', onClick);
    return btn;
  }

  showQuantityPicker(maxQty: number, onConfirm: (qty: number) => void): void {
    if (!this.overlay) return;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'background:#1a1510',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'padding:16px 20px',
      'display:flex',
      'flex-direction:column',
      'gap:12px',
      'min-width:240px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.8)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Choose Quantity';
    title.style.cssText = 'color:#e8c870;font-family:Cinzel,serif;font-size:14px;text-align:center;';
    dialog.appendChild(title);

    const defaultVal = Math.ceil(maxQty / 2);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = String(maxQty);
    slider.value = String(defaultVal);
    slider.style.cssText = 'width:100%;accent-color:#d4a84b;';
    dialog.appendChild(slider);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;';

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.min = '1';
    numInput.max = String(maxQty);
    numInput.value = String(defaultVal);
    numInput.style.cssText = [
      'width:70px',
      'text-align:center',
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:4px',
      'color:#e8c870',
      'font-family:Rajdhani,sans-serif',
      'font-size:16px',
      'padding:4px 6px',
    ].join(';');

    const maxLabel = document.createElement('span');
    maxLabel.textContent = `/ ${maxQty}`;
    maxLabel.style.cssText = 'color:#a89880;font-family:Rajdhani,sans-serif;font-size:14px;';

    inputRow.appendChild(numInput);
    inputRow.appendChild(maxLabel);
    dialog.appendChild(inputRow);

    // Sync slider ↔ input
    slider.addEventListener('input', () => { numInput.value = slider.value; });
    numInput.addEventListener('input', () => {
      let v = parseInt(numInput.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > maxQty) v = maxQty;
      slider.value = String(v);
    });

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.cssText = 'padding:6px 16px;background:rgba(90,74,42,0.5);border:1px solid #5a4a2a;border-radius:4px;color:#e8c870;font-family:Cinzel,serif;font-size:12px;cursor:pointer;';
    confirmBtn.addEventListener('click', () => {
      let v = parseInt(numInput.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > maxQty) v = maxQty;
      backdrop.remove();
      onConfirm(v);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;background:rgba(60,50,35,0.3);border:1px solid #3a3020;border-radius:4px;color:#a89880;font-family:Cinzel,serif;font-size:12px;cursor:pointer;';
    cancelBtn.addEventListener('click', () => { backdrop.remove(); });

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);

    // Enter key confirms
    numInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    numInput.focus();
    numInput.select();
  }

  private showFeedback(msg: string): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = msg;
    setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.textContent = '';
    }, 4000);
  }
}
