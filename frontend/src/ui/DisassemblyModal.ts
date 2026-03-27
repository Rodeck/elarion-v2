import type {
  InventorySlotDto,
  DisassemblyPreviewResultPayload,
  DisassemblyResultPayload,
  DisassemblyRejectedPayload,
  DisassemblyOutputPreview,
  DisassemblyReceivedItem,
} from '@elarion/protocol';

type SendFn = (type: string, payload: unknown) => void;
type InventorySlotsGetter = () => InventorySlotDto[];
type LifecycleCallback = () => void;

export class DisassemblyModal {
  private overlay: HTMLElement | null = null;
  private sendFn: SendFn | null = null;
  private getInventorySlots: InventorySlotsGetter | null = null;
  private onCloseCallback: LifecycleCallback | null = null;
  private npcId = 0;
  private gridSlots: (InventorySlotDto | null)[] = new Array(15).fill(null);
  private kilnSlot: InventorySlotDto | null = null;
  private previewData: DisassemblyPreviewResultPayload | null = null;
  private errorMsg: string | null = null;
  private errorTimeout: number | null = null;

  // DOM refs
  private gridEl: HTMLElement | null = null;
  private kilnEl: HTMLElement | null = null;
  private kilnBarEl: HTMLElement | null = null;
  private kilnTextEl: HTMLElement | null = null;
  private outputEl: HTMLElement | null = null;
  private costEl: HTMLElement | null = null;
  private disassembleBtn: HTMLButtonElement | null = null;
  private errorEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  setInventorySlotsGetter(getter: InventorySlotsGetter): void {
    this.getInventorySlots = getter;
  }

  setOnClose(cb: LifecycleCallback): void {
    this.onCloseCallback = cb;
  }

  open(npcId: number): void {
    this.npcId = npcId;
    this.gridSlots = new Array(15).fill(null);
    this.kilnSlot = null;
    this.previewData = null;
    this.errorMsg = null;
    this.render();
  }

  close(): void {
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.onCloseCallback?.();
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  handlePreviewResult(payload: DisassemblyPreviewResultPayload): void {
    this.previewData = payload;
    this.renderOutputSummary();
    this.updateButtonState();
  }

  handleResult(payload: DisassemblyResultPayload): void {
    // Clear grid and update kiln BEFORE rendering
    this.gridSlots = new Array(15).fill(null);
    this.previewData = null;
    this.kilnSlot = payload.kiln_slot ?? null;
    // Show success with received items (also re-renders grid/kiln)
    this.showResultScreen(payload.received_items);
  }

  handleRejected(payload: DisassemblyRejectedPayload): void {
    const messages: Record<string, string> = {
      NO_CHARACTER: 'No character found',
      NPC_NOT_FOUND: 'NPC not found',
      NPC_NOT_DISASSEMBLER: 'This NPC cannot disassemble',
      NOT_AT_BUILDING: 'You are not at this building',
      IN_COMBAT: 'Cannot disassemble during combat',
      NO_KILN: 'You need a kiln to disassemble',
      INSUFFICIENT_KILN_DURABILITY: 'Kiln does not have enough durability',
      INSUFFICIENT_CROWNS: 'Not enough crowns',
      INSUFFICIENT_INVENTORY_SPACE: 'Not enough inventory space for outputs',
      ITEM_NOT_DISASSEMBLABLE: 'This item cannot be disassembled',
      INVALID_ITEM: 'Invalid item',
      GRID_EMPTY: 'No items to disassemble',
    };
    this.showError(messages[payload.reason] ?? payload.details ?? 'Disassembly failed');
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    this.close();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:250;padding:1rem;';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1a1510;border:2px solid #5a4a2a;border-radius:8px;width:100%;max-width:700px;max-height:90vh;display:flex;flex-direction:column;color:#c9a55c;font-family:"Crimson Text",serif;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #3a2e1a;';
    header.innerHTML = '<h3 style="margin:0;font-family:Cinzel,serif;font-size:16px;color:#e8c870;">Disassembly</h3>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'background:none;border:none;color:#c9a55c;font-size:24px;cursor:pointer;padding:0 4px;';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding:16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;';

    // Error area
    this.errorEl = document.createElement('div');
    this.errorEl.style.cssText = 'display:none;background:#4a1a1a;border:1px solid #8a3030;border-radius:4px;padding:8px 12px;color:#ff9090;font-size:13px;';
    body.appendChild(this.errorEl);

    // Kiln section
    const kilnSection = document.createElement('div');
    kilnSection.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px;background:rgba(90,74,42,0.15);border:1px solid #3a2e1a;border-radius:4px;';

    const kilnLabel = document.createElement('span');
    kilnLabel.style.cssText = 'font-family:Cinzel,serif;font-size:11px;letter-spacing:0.06em;color:#8a7a5a;white-space:nowrap;';
    kilnLabel.textContent = 'KILN';
    kilnSection.appendChild(kilnLabel);

    this.kilnEl = document.createElement('div');
    this.kilnEl.style.cssText = 'width:48px;height:48px;border:2px dashed #5a4a2a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#5a4a2a;cursor:pointer;flex-shrink:0;';
    this.kilnEl.textContent = 'Drop';
    this.setupKilnDropZone(this.kilnEl);
    kilnSection.appendChild(this.kilnEl);

    const kilnInfo = document.createElement('div');
    kilnInfo.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;';
    this.kilnTextEl = document.createElement('span');
    this.kilnTextEl.style.cssText = 'font-size:12px;color:#8a7a5a;';
    this.kilnTextEl.textContent = 'Drag a kiln from inventory';
    kilnInfo.appendChild(this.kilnTextEl);

    const barBg = document.createElement('div');
    barBg.style.cssText = 'height:6px;background:#2a2010;border-radius:3px;overflow:hidden;';
    this.kilnBarEl = document.createElement('div');
    this.kilnBarEl.style.cssText = 'height:100%;background:#5a8a2a;border-radius:3px;width:0%;transition:width 0.3s;';
    barBg.appendChild(this.kilnBarEl);
    kilnInfo.appendChild(barBg);
    kilnSection.appendChild(kilnInfo);

    body.appendChild(kilnSection);

    // Grid (5x3)
    const gridLabel = document.createElement('p');
    gridLabel.style.cssText = 'margin:0;font-family:Cinzel,serif;font-size:11px;letter-spacing:0.06em;color:#8a7a5a;';
    gridLabel.textContent = 'ITEMS TO DISASSEMBLE';
    body.appendChild(gridLabel);

    this.gridEl = document.createElement('div');
    this.gridEl.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:4px;';
    for (let i = 0; i < 15; i++) {
      const cell = this.createGridCell(i);
      this.gridEl.appendChild(cell);
    }
    body.appendChild(this.gridEl);

    // Output summary
    const outputLabel = document.createElement('p');
    outputLabel.style.cssText = 'margin:0;font-family:Cinzel,serif;font-size:11px;letter-spacing:0.06em;color:#8a7a5a;';
    outputLabel.textContent = 'POSSIBLE OUTPUTS';
    body.appendChild(outputLabel);

    this.outputEl = document.createElement('div');
    this.outputEl.style.cssText = 'min-height:40px;padding:8px;background:rgba(42,74,42,0.15);border:1px solid #2a3e1a;border-radius:4px;font-size:13px;color:#8a8a6a;';
    this.outputEl.textContent = 'Add items to see possible outputs';
    body.appendChild(this.outputEl);

    // Cost display
    this.costEl = document.createElement('div');
    this.costEl.style.cssText = 'font-size:13px;color:#c9a55c;display:none;';
    body.appendChild(this.costEl);

    this.contentEl = body;
    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #3a2e1a;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Close';
    cancelBtn.style.cssText = 'padding:8px 16px;background:rgba(90,74,42,0.25);border:1px solid #5a4a2a;color:#c9a55c;font-family:Cinzel,serif;font-size:13px;cursor:pointer;border-radius:4px;';
    cancelBtn.addEventListener('click', () => this.close());
    footer.appendChild(cancelBtn);

    this.disassembleBtn = document.createElement('button');
    this.disassembleBtn.textContent = 'Disassemble';
    this.disassembleBtn.disabled = true;
    this.disassembleBtn.style.cssText = 'padding:8px 16px;background:#4a3010;border:1px solid #8a6a2a;color:#e8c870;font-family:Cinzel,serif;font-size:13px;cursor:pointer;border-radius:4px;';
    this.disassembleBtn.addEventListener('click', () => this.executeDisassembly());
    footer.appendChild(this.disassembleBtn);

    modal.appendChild(footer);
    overlay.appendChild(modal);

    // ESC to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private createGridCell(index: number): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText = 'width:100%;aspect-ratio:1;border:1px dashed #3a2e1a;border-radius:4px;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;';
    cell.dataset['idx'] = String(index);

    // Drop zone
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      cell.style.borderColor = '#8a6a2a';
    });
    cell.addEventListener('dragleave', () => {
      cell.style.borderColor = this.gridSlots[index] ? '#5a4a2a' : '#3a2e1a';
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.style.borderColor = '#3a2e1a';
      this.handleGridDrop(index, e);
    });

    // Drag out (return to inventory)
    cell.draggable = false;
    cell.addEventListener('dragstart', (e) => {
      const slot = this.gridSlots[index];
      if (!slot) { e.preventDefault(); return; }
      e.dataTransfer?.setData('text/plain', JSON.stringify({ slot_id: slot.slot_id, from_disassembly: true }));
    });
    cell.addEventListener('click', () => {
      // Click to remove from grid
      const slot = this.gridSlots[index];
      if (slot) {
        this.gridSlots[index] = null;
        this.renderGrid();
        this.requestPreview();
      }
    });

    return cell;
  }

  private setupKilnDropZone(el: HTMLElement): void {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      el.style.borderColor = '#8a6a2a';
    });
    el.addEventListener('dragleave', () => {
      el.style.borderColor = '#5a4a2a';
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.style.borderColor = '#5a4a2a';
      this.handleKilnDrop(e);
    });
    el.addEventListener('click', () => {
      // Click to remove kiln
      if (this.kilnSlot) {
        this.kilnSlot = null;
        this.renderKiln();
        this.updateButtonState();
      }
    });
  }

  private handleGridDrop(index: number, e: DragEvent): void {
    const data = e.dataTransfer?.getData('text/plain');
    if (!data) return;

    try {
      const { slot_id } = JSON.parse(data);
      const slots = this.getInventorySlots?.() ?? [];
      const slot = slots.find((s) => s.slot_id === slot_id);
      if (!slot) return;

      // Reject equipped items
      if ((slot as { equipped_slot?: string }).equipped_slot) {
        this.showError('Cannot disassemble equipped items');
        return;
      }

      // Reject kiln items (those go in kiln slot)
      if (slot.definition.tool_type === 'kiln') {
        this.showError('Drag kilns to the kiln slot above');
        return;
      }

      // Reject items without disassembly recipes
      if (slot.is_disassemblable === false) {
        this.showError('This item cannot be disassembled');
        return;
      }

      // Check if slot is already in grid
      if (this.gridSlots.some((s) => s && s.slot_id === slot_id)) {
        this.showError('This item is already in the grid');
        return;
      }

      // Check if slot already used as kiln
      if (this.kilnSlot && this.kilnSlot.slot_id === slot_id) return;

      // Place in grid
      if (this.gridSlots[index] !== null) {
        // Slot occupied, find first empty
        const emptyIdx = this.gridSlots.findIndex((s) => s === null);
        if (emptyIdx === -1) {
          this.showError('Grid is full');
          return;
        }
        this.gridSlots[emptyIdx] = slot;
      } else {
        this.gridSlots[index] = slot;
      }

      this.renderGrid();
      this.requestPreview();
    } catch { /* ignore */ }
  }

  private handleKilnDrop(e: DragEvent): void {
    const data = e.dataTransfer?.getData('text/plain');
    if (!data) return;

    try {
      const { slot_id } = JSON.parse(data);
      const slots = this.getInventorySlots?.() ?? [];
      const slot = slots.find((s) => s.slot_id === slot_id);
      if (!slot) return;

      // Only accept kiln tools
      if (slot.definition.tool_type !== 'kiln') {
        this.showError('Only kilns can be placed here');
        return;
      }

      // Remove from grid if was there
      const gridIdx = this.gridSlots.findIndex((s) => s && s.slot_id === slot_id);
      if (gridIdx !== -1) this.gridSlots[gridIdx] = null;

      this.kilnSlot = slot;
      this.renderKiln();
      this.renderGrid();
      this.updateButtonState();
    } catch { /* ignore */ }
  }

  private renderGrid(): void {
    if (!this.gridEl) return;
    const cells = this.gridEl.children;
    for (let i = 0; i < 15; i++) {
      const cell = cells[i] as HTMLElement;
      const slot = this.gridSlots[i];
      if (slot) {
        cell.style.borderStyle = 'solid';
        cell.style.borderColor = '#5a4a2a';
        cell.style.background = 'rgba(90,74,42,0.2)';
        cell.draggable = true;

        const icon = slot.definition.icon_url
          ? `<img src="${slot.definition.icon_url}" style="width:32px;height:32px;object-fit:contain;" />`
          : `<span style="font-size:10px;color:#5a4a2a;">${slot.definition.name.substring(0, 3)}</span>`;
        const qtyBadge = slot.quantity > 1 ? `<span style="position:absolute;bottom:1px;right:3px;font-size:10px;color:#e8c870;font-weight:bold;">${slot.quantity}</span>` : '';
        cell.innerHTML = icon + qtyBadge;
        cell.title = `${slot.definition.name}${slot.quantity > 1 ? ` x${slot.quantity}` : ''} (click to remove)`;
      } else {
        cell.style.borderStyle = 'dashed';
        cell.style.borderColor = '#3a2e1a';
        cell.style.background = 'none';
        cell.draggable = false;
        cell.innerHTML = '';
        cell.title = '';
      }
    }
  }

  private renderKiln(): void {
    if (!this.kilnEl || !this.kilnTextEl || !this.kilnBarEl) return;

    if (this.kilnSlot) {
      const icon = this.kilnSlot.definition.icon_url
        ? `<img src="${this.kilnSlot.definition.icon_url}" style="width:32px;height:32px;object-fit:contain;" />`
        : `<span style="font-size:10px;color:#e8c870;">Kiln</span>`;
      this.kilnEl.innerHTML = icon;
      this.kilnEl.style.borderStyle = 'solid';
      this.kilnEl.style.background = 'rgba(90,74,42,0.2)';
      this.kilnEl.title = `${this.kilnSlot.definition.name} (click to remove)`;

      const cur = this.kilnSlot.current_durability ?? 0;
      const max = this.kilnSlot.definition.max_durability ?? 1;
      const pct = Math.round((cur / max) * 100);
      this.kilnTextEl.textContent = `Durability: ${cur} / ${max}`;
      this.kilnBarEl.style.width = `${pct}%`;
      this.kilnBarEl.style.background = pct > 30 ? '#5a8a2a' : pct > 10 ? '#8a6a2a' : '#8a2a2a';
    } else {
      this.kilnEl.innerHTML = '';
      this.kilnEl.textContent = 'Drop';
      this.kilnEl.style.borderStyle = 'dashed';
      this.kilnEl.style.background = 'none';
      this.kilnEl.title = '';
      this.kilnTextEl.textContent = 'Drag a kiln from inventory';
      this.kilnBarEl.style.width = '0%';
    }
  }

  private renderOutputSummary(): void {
    if (!this.outputEl || !this.costEl) return;

    if (!this.previewData || this.previewData.possible_outputs.length === 0) {
      this.outputEl.textContent = 'Add items to see possible outputs';
      this.outputEl.style.color = '#8a8a6a';
      this.costEl.style.display = 'none';
      return;
    }

    const { possible_outputs, total_cost, total_item_count, max_output_slots } = this.previewData;

    let html = '';
    for (const out of possible_outputs) {
      const icon = out.icon_url
        ? `<img src="${out.icon_url}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px;" />`
        : '';
      const range = out.min_quantity === out.max_quantity
        ? `${out.max_quantity}`
        : `${out.min_quantity}-${out.max_quantity}`;
      html += `<div style="display:flex;align-items:center;gap:4px;padding:2px 0;">${icon}<span style="color:#c9c090;">${out.item_name}</span> <span style="color:#8a8a6a;">x${range}</span></div>`;
    }
    this.outputEl.innerHTML = html;
    this.outputEl.style.color = '';

    this.costEl.innerHTML = `Cost: <span style="color:#e8c870;">${total_cost} crowns</span> | Items: <span style="color:#c9c090;">${total_item_count}</span> | Max outputs: <span style="color:#c9c090;">${max_output_slots}</span>`;
    this.costEl.style.display = '';
  }

  private updateButtonState(): void {
    if (!this.disassembleBtn) return;

    const hasItems = this.gridSlots.some((s) => s !== null);
    const hasKiln = this.kilnSlot !== null;

    this.disassembleBtn.disabled = !hasItems || !hasKiln;
    this.disassembleBtn.style.opacity = this.disassembleBtn.disabled ? '0.5' : '1';
  }

  private requestPreview(): void {
    this.updateButtonState();

    const slotIds = this.gridSlots.filter((s): s is InventorySlotDto => s !== null).map((s) => s.slot_id);
    if (slotIds.length === 0 || !this.kilnSlot) {
      this.previewData = null;
      this.renderOutputSummary();
      return;
    }

    this.sendFn?.('disassembly.preview', {
      npc_id: this.npcId,
      slot_ids: slotIds,
      kiln_slot_id: this.kilnSlot.slot_id,
    });
  }

  private executeDisassembly(): void {
    const slotIds = this.gridSlots.filter((s): s is InventorySlotDto => s !== null).map((s) => s.slot_id);
    if (slotIds.length === 0 || !this.kilnSlot) return;

    this.sendFn?.('disassembly.execute', {
      npc_id: this.npcId,
      slot_ids: slotIds,
      kiln_slot_id: this.kilnSlot.slot_id,
    });
  }

  private showResultScreen(items: DisassemblyReceivedItem[]): void {
    // Re-render grid and kiln (now cleared)
    this.renderGrid();
    this.renderKiln();
    this.updateButtonState();
    if (this.costEl) this.costEl.style.display = 'none';
    if (this.outputEl) this.outputEl.textContent = '';

    // Show reward popup overlay on top of the modal
    this.showRewardPopup(items);
  }

  private showRewardPopup(items: DisassemblyReceivedItem[]): void {
    const popup = document.createElement('div');
    popup.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:300',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.7)',
      'animation:disRewardFadeIn 0.3s ease-out',
    ].join(';');

    // Inject keyframes if not already present
    if (!document.getElementById('dis-reward-keyframes')) {
      const style = document.createElement('style');
      style.id = 'dis-reward-keyframes';
      style.textContent = `
        @keyframes disRewardFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes disRewardScaleIn { from { opacity:0; transform:scale(0.7) } to { opacity:1; transform:scale(1) } }
        @keyframes disRewardItemSlideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes disRewardShimmer { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
        @keyframes disRewardGlow { 0%,100% { text-shadow:0 0 8px rgba(112,232,154,0.4) } 50% { text-shadow:0 0 20px rgba(112,232,154,0.8),0 0 40px rgba(212,168,75,0.3) } }
      `;
      document.head.appendChild(style);
    }

    const card = document.createElement('div');
    card.style.cssText = [
      'background:linear-gradient(170deg,#1a1810 0%,#252018 50%,#1a1810 100%)',
      'border:2px solid #5a4a2a',
      'border-radius:12px',
      'padding:28px 36px',
      'min-width:280px',
      'max-width:400px',
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:16px',
      'animation:disRewardScaleIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
      'box-shadow:0 0 60px rgba(212,168,75,0.15),0 0 120px rgba(212,168,75,0.05)',
      'position:relative', 'overflow:hidden',
    ].join(';');

    // Shimmer bar across the top
    const shimmer = document.createElement('div');
    shimmer.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'right:0', 'height:2px',
      'background:linear-gradient(90deg,transparent,#e8c870,#70e89a,#e8c870,transparent)',
      'background-size:200% 100%',
      'animation:disRewardShimmer 2s linear infinite',
    ].join(';');
    card.appendChild(shimmer);

    // Anvil / hammer icon
    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'font-size:32px;margin-top:4px;';
    iconEl.textContent = '\u2692'; // ⚒ hammer and pick
    card.appendChild(iconEl);

    // Title
    const title = document.createElement('div');
    title.style.cssText = [
      'font-family:Cinzel,serif',
      'font-size:18px',
      'color:#e8c870',
      'letter-spacing:0.08em',
      'animation:disRewardGlow 2s ease-in-out infinite',
    ].join(';');
    title.textContent = 'Materials Obtained';
    card.appendChild(title);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'width:80%;height:1px;background:linear-gradient(90deg,transparent,#5a4a2a,transparent);';
    card.appendChild(divider);

    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;';

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:10px',
        'padding:8px 12px',
        'background:rgba(90,74,42,0.2)',
        'border:1px solid rgba(90,74,42,0.4)',
        'border-radius:6px',
        'opacity:0',
        `animation:disRewardItemSlideIn 0.35s ease-out ${0.15 + idx * 0.1}s forwards`,
      ].join(';');

      // Icon
      if (item.icon_url) {
        const img = document.createElement('img');
        img.src = item.icon_url;
        img.alt = item.item_name;
        img.style.cssText = 'width:28px;height:28px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;';
        row.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:28px;height:28px;background:rgba(90,74,42,0.4);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#5a4a2a;flex-shrink:0;';
        placeholder.textContent = '?';
        row.appendChild(placeholder);
      }

      // Name
      const name = document.createElement('span');
      name.style.cssText = 'font-family:"Crimson Text",serif;font-size:14px;color:#d4c8a0;flex:1;';
      name.textContent = item.item_name;
      row.appendChild(name);

      // Quantity
      const qty = document.createElement('span');
      qty.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:16px;font-weight:700;color:#70e89a;white-space:nowrap;';
      qty.textContent = `\u00d7${item.quantity}`;
      row.appendChild(qty);

      itemsContainer.appendChild(row);
    });

    card.appendChild(itemsContainer);

    // "Click to continue" hint
    const hint = document.createElement('div');
    hint.style.cssText = [
      'font-family:"Crimson Text",serif',
      'font-size:11px',
      'color:#5a5040',
      'letter-spacing:0.06em',
      'margin-top:4px',
      'opacity:0',
      `animation:disRewardItemSlideIn 0.3s ease-out ${0.3 + items.length * 0.1}s forwards`,
    ].join(';');
    hint.textContent = 'Click anywhere to continue';
    card.appendChild(hint);

    popup.appendChild(card);

    // Click to dismiss
    popup.addEventListener('click', () => {
      popup.style.transition = 'opacity 0.2s ease-out';
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
    });

    document.body.appendChild(popup);
  }

  private showError(msg: string): void {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg;
    this.errorEl.style.display = '';

    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    this.errorTimeout = window.setTimeout(() => {
      if (this.errorEl) this.errorEl.style.display = 'none';
    }, 3000);
  }
}
