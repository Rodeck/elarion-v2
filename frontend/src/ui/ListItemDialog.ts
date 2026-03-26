import type { InventorySlotDto, MarketplaceActionConfig } from '@elarion/protocol';
import { getCrownsIconUrl } from './ui-icons';

type ConfirmCallback = (slotId: number, quantity: number, pricePerItem: number) => void;

export class ListItemDialog {
  private overlay: HTMLElement | null = null;
  private onConfirm: ConfirmCallback | null = null;

  constructor(private parent: HTMLElement) {}

  setOnConfirm(fn: ConfirmCallback): void {
    this.onConfirm = fn;
  }

  open(slot: InventorySlotDto, config: MarketplaceActionConfig): void {
    this.close();

    const isStackable = (slot.definition.stack_size ?? 0) > 1;
    const maxQty = isStackable ? slot.quantity : 1;
    let quantity = maxQty;
    let pricePerItem = 1;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'padding:20px',
      'min-width:320px',
      'max-width:400px',
      'color:#c9a55c',
      'font-family:Cinzel,serif',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7)',
    ].join(';');

    // Title
    const title = document.createElement('div');
    title.textContent = 'List Item for Sale';
    title.style.cssText = 'font-size:16px;color:#e8c870;margin-bottom:16px;text-align:center;';
    dialog.appendChild(title);

    // Item info
    const itemInfo = document.createElement('div');
    itemInfo.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:8px;background:rgba(90,74,42,0.2);border-radius:4px;';
    if (slot.definition.icon_url) {
      const icon = document.createElement('img');
      icon.src = slot.definition.icon_url;
      icon.style.cssText = 'width:40px;height:40px;image-rendering:pixelated;';
      itemInfo.appendChild(icon);
    }
    const nameEl = document.createElement('span');
    nameEl.textContent = slot.definition.name;
    nameEl.style.cssText = 'font-family:"Crimson Text",serif;font-size:15px;color:#d4a84b;';
    itemInfo.appendChild(nameEl);
    dialog.appendChild(itemInfo);

    // Total display
    const totalEl = document.createElement('div');
    totalEl.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:14px;color:#c9a55c;margin-bottom:8px;text-align:right;';

    const updateTotal = () => {
      totalEl.innerHTML = '';
      totalEl.appendChild(document.createTextNode('Total: '));
      totalEl.appendChild(this.crownsIcon(quantity * pricePerItem));
    };

    // Quantity selector (only for stackable)
    if (isStackable) {
      const qtyRow = this.createInputRow('Quantity', `1 - ${maxQty}`);
      const qtyInput = qtyRow.querySelector('input')!;
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.max = String(maxQty);
      qtyInput.value = String(maxQty);
      qtyInput.addEventListener('input', () => {
        quantity = Math.max(1, Math.min(maxQty, parseInt(qtyInput.value) || 1));
        qtyInput.value = String(quantity);
        updateTotal();
      });
      dialog.appendChild(qtyRow);
    }

    // Price input
    const priceRow = this.createInputRow('Price per item', 'min 1 crown');
    const priceInput = priceRow.querySelector('input')!;
    priceInput.type = 'number';
    priceInput.min = '1';
    priceInput.value = '1';
    priceInput.addEventListener('input', () => {
      pricePerItem = Math.max(1, parseInt(priceInput.value) || 1);
      priceInput.value = String(pricePerItem);
      updateTotal();
    });
    dialog.appendChild(priceRow);

    // Total
    updateTotal();
    dialog.appendChild(totalEl);

    // Fee notice
    const feeEl = document.createElement('div');
    feeEl.style.cssText = 'font-family:"Crimson Text",serif;font-size:12px;color:#8a7a5a;margin-bottom:16px;text-align:center;display:flex;align-items:center;justify-content:center;gap:3px;';
    feeEl.appendChild(document.createTextNode('Listing fee: '));
    feeEl.appendChild(this.crownsIcon(config.listing_fee));
    feeEl.appendChild(document.createTextNode(' (non-refundable)'));
    dialog.appendChild(feeEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;';

    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell';
    sellBtn.style.cssText = this.buttonStyle('#4a6a2a', '#5a8a3a');
    sellBtn.addEventListener('click', () => {
      this.close();
      this.onConfirm?.(slot.slot_id, quantity, pricePerItem);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = this.buttonStyle('#5a4a2a', '#6a5a3a');
    cancelBtn.addEventListener('click', () => this.close());

    btnRow.appendChild(sellBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);

    this.overlay.appendChild(dialog);
    this.parent.appendChild(this.overlay);
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private createInputRow(label: string, placeholder: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-family:"Crimson Text",serif;font-size:14px;color:#c9a55c;';

    const input = document.createElement('input');
    input.placeholder = placeholder;
    input.style.cssText = [
      'width:100px',
      'padding:4px 8px',
      'background:#1a1610',
      'border:1px solid #5a4a2a',
      'border-radius:3px',
      'color:#e8c870',
      'font-family:Rajdhani,sans-serif',
      'font-size:14px',
      'text-align:right',
    ].join(';');

    row.appendChild(labelEl);
    row.appendChild(input);
    return row;
  }

  private crownsIcon(amount: number): HTMLElement {
    const span = document.createElement('span');
    span.style.cssText = 'display:inline-flex;align-items:center;gap:2px;';
    const iconUrl = getCrownsIconUrl();
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = 'width:14px;height:14px;image-rendering:pixelated;';
      span.appendChild(img);
    }
    const txt = document.createElement('span');
    txt.textContent = String(amount);
    txt.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:14px;color:#f0c060;';
    span.appendChild(txt);
    return span;
  }

  private buttonStyle(bg: string, hoverBg: string): string {
    return [
      `background:${bg}`,
      'border:1px solid #5a4a2a',
      'border-radius:4px',
      'color:#e8c870',
      'font-family:Cinzel,serif',
      'font-size:13px',
      'padding:6px 20px',
      'cursor:pointer',
    ].join(';');
  }
}
