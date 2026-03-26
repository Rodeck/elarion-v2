import type {
  MarketplaceActionConfig,
  MarketplaceBrowseResultPayload,
  MarketplaceItemListingsResultPayload,
  MarketplaceBuyResultPayload,
  MarketplaceListItemResultPayload,
  MarketplaceCancelResultPayload,
  MarketplaceMyListingsResultPayload,
  MarketplaceCollectCrownsResultPayload,
  MarketplaceCollectItemsResultPayload,
  MarketplaceRejectedPayload,
  MarketplaceItemSummary,
  MarketplaceListingDto,
  MyListingDto,
  InventorySlotDto,
} from '@elarion/protocol';
import { ListItemDialog } from './ListItemDialog';
import { getCrownsIconUrl } from './ui-icons';

type SendFn = (type: string, payload: unknown) => void;
type InventorySlotsGetter = () => InventorySlotDto[];
type LifecycleCallback = () => void;

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'weapon', label: 'Weapons' },
  { value: 'helmet', label: 'Helmets' },
  { value: 'chestplate', label: 'Chest' },
  { value: 'greaves', label: 'Greaves' },
  { value: 'boots', label: 'Boots' },
  { value: 'shield', label: 'Shields' },
  { value: 'bracer', label: 'Bracers' },
  { value: 'resource', label: 'Resources' },
  { value: 'tool', label: 'Tools' },
  { value: 'food', label: 'Food' },
  { value: 'heal', label: 'Healing' },
];

export class MarketplaceModal {
  private overlay: HTMLElement | null = null;
  private sendFn: SendFn | null = null;
  private getInventorySlots: InventorySlotsGetter | null = null;
  private listItemDialog: ListItemDialog;
  private buildingId = 0;
  private config: MarketplaceActionConfig = { listing_fee: 10, max_listings: 10, listing_duration_days: 5 };
  private currentTab: 'browse' | 'my_listings' = 'browse';
  private currentPage = 1;
  private currentCategory = '';
  private currentSearch = '';
  private selectedItemDefId: number | null = null;
  private buyInFlight = false;

  // Cached data
  private browseResult: MarketplaceBrowseResultPayload | null = null;
  private itemListings: MarketplaceListingDto[] = [];
  private myListingsResult: MarketplaceMyListingsResultPayload | null = null;

  // DOM refs
  private contentEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;
  private listingsEl: HTMLElement | null = null;
  private paginationEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  private onOpenCallback: LifecycleCallback | null = null;
  private onCloseCallback: LifecycleCallback | null = null;

  constructor(private parent: HTMLElement) {
    this.listItemDialog = new ListItemDialog(parent);
  }

  setSendFn(fn: SendFn): void {
    this.sendFn = fn;
  }

  setInventorySlotsGetter(fn: InventorySlotsGetter): void {
    this.getInventorySlots = fn;
  }

  setOnOpen(fn: LifecycleCallback): void {
    this.onOpenCallback = fn;
  }

  setOnClose(fn: LifecycleCallback): void {
    this.onCloseCallback = fn;
  }

  open(buildingId: number, config: MarketplaceActionConfig): void {
    this.close();
    this.buildingId = buildingId;
    this.config = config;
    this.currentTab = 'browse';
    this.currentPage = 1;
    this.currentCategory = '';
    this.currentSearch = '';
    this.selectedItemDefId = null;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = [
      'background:#0d0b08',
      'border:1px solid #5a4a2a',
      'border-radius:6px',
      'width:80vw',
      'max-width:900px',
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

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:4px;';

    const browseTab = this.createTab('Browse', 'browse');
    const myTab = this.createTab('My Listings', 'my_listings');
    tabBar.appendChild(browseTab);
    tabBar.appendChild(myTab);
    header.appendChild(tabBar);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#c9a55c;font-size:18px;cursor:pointer;padding:4px 8px;';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Content area
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;';

    // Drop zone for drag-and-drop listing
    this.contentEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    this.contentEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData('text/plain');
      if (!data) return;
      try {
        const { slot_id } = JSON.parse(data);
        const slots = this.getInventorySlots?.() ?? [];
        const slot = slots.find((s) => s.slot_id === slot_id);
        if (slot) {
          this.listItemDialog.setOnConfirm((slotId, quantity, pricePerItem) => {
            this.sendFn?.('marketplace.list_item', {
              building_id: this.buildingId,
              slot_id: slotId,
              quantity,
              price_per_item: pricePerItem,
            });
          });
          this.listItemDialog.open(slot, this.config);
        }
      } catch { /* ignore invalid data */ }
    });

    modal.appendChild(this.contentEl);

    // Status bar
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'padding:8px 16px;border-top:1px solid #5a4a2a;font-family:"Crimson Text",serif;font-size:12px;color:#8a7a5a;text-align:center;flex-shrink:0;';
    this.statusEl.textContent = 'Drag items from inventory to list them for sale';
    modal.appendChild(this.statusEl);

    this.overlay.appendChild(modal);
    this.parent.appendChild(this.overlay);

    this.onOpenCallback?.();
    this.requestBrowse();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.listItemDialog.close();
    this.onCloseCallback?.();
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  // ---------------------------------------------------------------------------
  // Server response handlers
  // ---------------------------------------------------------------------------

  handleBrowseResult(payload: MarketplaceBrowseResultPayload): void {
    this.browseResult = payload;
    this.renderBrowseView();
  }

  handleItemListingsResult(payload: MarketplaceItemListingsResultPayload): void {
    this.itemListings = payload.listings;
    this.selectedItemDefId = payload.item_def_id;
    this.renderListingsDetail();
  }

  handleBuyResult(payload: MarketplaceBuyResultPayload): void {
    this.buyInFlight = false;
    if (payload.success) {
      this.showStatus('Purchase successful!', '#5a8a3a');
      this.requestBrowse();
      if (this.selectedItemDefId !== null) {
        this.sendFn?.('marketplace.item_listings', {
          building_id: this.buildingId,
          item_def_id: this.selectedItemDefId,
        });
      }
    } else {
      const reasons: Record<string, string> = {
        INSUFFICIENT_CROWNS: 'Not enough crowns',
        INVENTORY_FULL: 'Inventory is full',
        LISTING_UNAVAILABLE: 'Listing no longer available',
      };
      this.showStatus(reasons[payload.reason ?? ''] ?? 'Purchase failed', '#8a3a3a');
    }
  }

  handleListItemResult(payload: MarketplaceListItemResultPayload): void {
    if (payload.success) {
      this.showStatus(`Listed! (${payload.listings_used}/${payload.listings_max} slots used)`, '#5a8a3a');
      this.requestBrowse();
    } else {
      const reasons: Record<string, string> = {
        INSUFFICIENT_CROWNS: 'Not enough crowns for listing fee',
        LISTING_LIMIT: 'Maximum listings reached',
        INVALID_ITEM: 'Invalid item',
        EQUIPPED_ITEM: 'Unequip item first',
        INVALID_QUANTITY: 'Invalid quantity',
        INVALID_PRICE: 'Price must be at least 1 crown',
      };
      this.showStatus(reasons[payload.reason ?? ''] ?? 'Listing failed', '#8a3a3a');
    }
  }

  handleCancelResult(payload: MarketplaceCancelResultPayload): void {
    if (payload.success) {
      this.showStatus('Listing cancelled, items returned', '#5a8a3a');
      this.sendFn?.('marketplace.my_listings', { building_id: this.buildingId });
    } else {
      const reasons: Record<string, string> = {
        NOT_OWNER: 'Not your listing',
        NOT_ACTIVE: 'Listing is not active',
        INVENTORY_FULL: 'Inventory is full',
      };
      this.showStatus(reasons[payload.reason ?? ''] ?? 'Cancel failed', '#8a3a3a');
    }
  }

  handleMyListingsResult(payload: MarketplaceMyListingsResultPayload): void {
    this.myListingsResult = payload;
    this.renderMyListingsView();
  }

  handleCollectCrownsResult(payload: MarketplaceCollectCrownsResultPayload): void {
    if (payload.success && payload.crowns_collected > 0) {
      this.showStatus(`Collected ${payload.crowns_collected} crowns!`, '#5a8a3a');
      this.sendFn?.('marketplace.my_listings', { building_id: this.buildingId });
    }
  }

  handleCollectItemsResult(payload: MarketplaceCollectItemsResultPayload): void {
    if (payload.success) {
      this.showStatus('Items collected!', '#5a8a3a');
      this.sendFn?.('marketplace.my_listings', { building_id: this.buildingId });
    } else {
      const reasons: Record<string, string> = {
        INVENTORY_FULL: 'Inventory is full',
        NOT_OWNER: 'Not your listing',
        NOT_EXPIRED: 'Listing has not expired',
      };
      this.showStatus(reasons[payload.reason ?? ''] ?? 'Collection failed', '#8a3a3a');
    }
  }

  handleRejected(payload: MarketplaceRejectedPayload): void {
    this.showStatus(`Error: ${payload.reason}`, '#8a3a3a');
  }

  // ---------------------------------------------------------------------------
  // Browse view rendering
  // ---------------------------------------------------------------------------

  private renderBrowseView(): void {
    if (!this.contentEl || !this.browseResult) return;
    this.contentEl.innerHTML = '';

    // Filters bar
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center;flex-shrink:0;';

    // Category filters
    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      btn.textContent = cat.label;
      const isActive = this.currentCategory === cat.value;
      btn.style.cssText = [
        `background:${isActive ? '#5a4a2a' : '#1a1610'}`,
        'border:1px solid #5a4a2a',
        'border-radius:3px',
        'color:#e8c870',
        'font-family:"Crimson Text",serif',
        'font-size:12px',
        'padding:3px 8px',
        'cursor:pointer',
      ].join(';');
      btn.addEventListener('click', () => {
        this.currentCategory = cat.value;
        this.currentPage = 1;
        this.selectedItemDefId = null;
        this.requestBrowse();
      });
      filterBar.appendChild(btn);
    }

    // Search
    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search...';
    search.value = this.currentSearch;
    search.style.cssText = 'margin-left:auto;padding:3px 8px;background:#1a1610;border:1px solid #5a4a2a;border-radius:3px;color:#e8c870;font-family:"Crimson Text",serif;font-size:12px;width:140px;';
    let searchTimeout: ReturnType<typeof setTimeout>;
    search.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.currentSearch = search.value;
        this.currentPage = 1;
        this.selectedItemDefId = null;
        this.requestBrowse();
      }, 300);
    });
    filterBar.appendChild(search);
    this.contentEl.appendChild(filterBar);

    // Grid
    this.gridEl = document.createElement('div');
    this.gridEl.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;flex:1;overflow-y:auto;align-content:start;';

    if (this.browseResult.items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No items for sale';
      empty.style.cssText = 'grid-column:1/-1;text-align:center;color:#8a7a5a;font-family:"Crimson Text",serif;padding:40px;font-size:14px;';
      this.gridEl.appendChild(empty);
    } else {
      for (const item of this.browseResult.items) {
        this.gridEl.appendChild(this.renderItemCard(item));
      }
    }
    this.contentEl.appendChild(this.gridEl);

    // Pagination
    this.paginationEl = document.createElement('div');
    this.paginationEl.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:10px;padding:8px 0;flex-shrink:0;';
    this.renderPagination();
    this.contentEl.appendChild(this.paginationEl);

    // Listings detail panel (below grid)
    this.listingsEl = document.createElement('div');
    this.listingsEl.style.cssText = 'flex-shrink:0;';
    if (this.selectedItemDefId !== null) {
      this.renderListingsDetail();
    }
    this.contentEl.appendChild(this.listingsEl);
  }

  private renderItemCard(item: MarketplaceItemSummary): HTMLElement {
    const card = document.createElement('div');
    const isSelected = this.selectedItemDefId === item.item_def_id;
    card.style.cssText = [
      `background:${isSelected ? 'rgba(90,74,42,0.4)' : 'rgba(26,22,16,0.6)'}`,
      'border:1px solid #5a4a2a',
      'border-radius:4px',
      'padding:6px',
      'cursor:pointer',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:2px',
      'min-height:90px',
    ].join(';');

    // Icon
    if (item.icon_url) {
      const icon = document.createElement('img');
      icon.src = item.icon_url;
      icon.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;';
      card.appendChild(icon);
    }

    // Name
    const name = document.createElement('div');
    name.textContent = item.name;
    name.style.cssText = 'font-family:"Crimson Text",serif;font-size:11px;color:#d4a84b;text-align:center;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;';
    card.appendChild(name);

    // Quantity
    const qty = document.createElement('div');
    qty.textContent = `×${item.total_quantity}`;
    qty.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:11px;color:#c9a55c;';
    card.appendChild(qty);

    // Price range
    const price = document.createElement('div');
    price.style.cssText = 'font-size:10px;';
    if (item.min_price_per_item === item.max_price_per_item) {
      price.appendChild(this.crownsEl(item.min_price_per_item, '10px'));
    } else {
      price.appendChild(this.crownsEl(`${item.min_price_per_item}-${item.max_price_per_item}`, '10px'));
    }
    card.appendChild(price);

    card.addEventListener('click', () => {
      this.selectedItemDefId = item.item_def_id;
      this.sendFn?.('marketplace.item_listings', {
        building_id: this.buildingId,
        item_def_id: item.item_def_id,
      });
      // Re-render grid to update selection highlight
      if (this.browseResult) this.renderBrowseView();
    });

    return card;
  }

  private renderListingsDetail(): void {
    if (!this.listingsEl) return;
    this.listingsEl.innerHTML = '';

    if (this.itemListings.length === 0) return;

    const title = document.createElement('div');
    title.textContent = 'Listings';
    title.style.cssText = 'font-family:Cinzel,serif;font-size:13px;color:#e8c870;margin:8px 0 4px;';
    this.listingsEl.appendChild(title);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-family:"Crimson Text",serif;font-size:12px;';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const text of ['Seller', 'Qty', 'Price/item', 'Total', '']) {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.cssText = 'text-align:left;padding:4px 6px;border-bottom:1px solid #5a4a2a;color:#8a7a5a;font-weight:normal;';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const listing of this.itemListings) {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid rgba(90,74,42,0.3);';

      // Seller
      const sellerTd = document.createElement('td');
      sellerTd.textContent = listing.seller_name;
      sellerTd.style.cssText = 'padding:4px 6px;color:#c9a55c;';
      tr.appendChild(sellerTd);

      // Qty
      const qtyTd = document.createElement('td');
      qtyTd.textContent = `${listing.quantity}`;
      qtyTd.style.cssText = 'padding:4px 6px;color:#c9a55c;';
      tr.appendChild(qtyTd);

      // Price/item with crown icon
      const priceTd = document.createElement('td');
      priceTd.style.cssText = 'padding:4px 6px;';
      priceTd.appendChild(this.crownsEl(listing.price_per_item, '12px'));
      tr.appendChild(priceTd);

      // Total with crown icon
      const totalTd = document.createElement('td');
      totalTd.style.cssText = 'padding:4px 6px;';
      totalTd.appendChild(this.crownsEl(listing.total_price, '12px'));
      tr.appendChild(totalTd);

      // Buy button
      const buyTd = document.createElement('td');
      buyTd.style.cssText = 'padding:4px 6px;';
      const buyBtn = document.createElement('button');
      buyBtn.textContent = 'Buy';
      buyBtn.style.cssText = 'background:#4a6a2a;border:1px solid #5a4a2a;border-radius:3px;color:#e8c870;font-family:Cinzel,serif;font-size:11px;padding:2px 10px;cursor:pointer;';
      buyBtn.addEventListener('click', () => {
        if (this.buyInFlight) return;
        this.buyInFlight = true;
        buyBtn.disabled = true;
        buyBtn.textContent = '...';
        this.sendFn?.('marketplace.buy', { listing_id: listing.listing_id });
      });
      buyTd.appendChild(buyBtn);
      tr.appendChild(buyTd);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.listingsEl.appendChild(table);
  }

  private renderPagination(): void {
    if (!this.paginationEl || !this.browseResult) return;
    this.paginationEl.innerHTML = '';

    const { page, total_pages } = this.browseResult;
    if (total_pages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Prev';
    prevBtn.disabled = page <= 1;
    prevBtn.style.cssText = this.pageButtonStyle(page > 1);
    prevBtn.addEventListener('click', () => {
      if (page > 1) { this.currentPage = page - 1; this.requestBrowse(); }
    });

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `${page} / ${total_pages}`;
    pageInfo.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:13px;color:#c9a55c;';

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = page >= total_pages;
    nextBtn.style.cssText = this.pageButtonStyle(page < total_pages);
    nextBtn.addEventListener('click', () => {
      if (page < total_pages) { this.currentPage = page + 1; this.requestBrowse(); }
    });

    this.paginationEl.appendChild(prevBtn);
    this.paginationEl.appendChild(pageInfo);
    this.paginationEl.appendChild(nextBtn);
  }

  // ---------------------------------------------------------------------------
  // My Listings view
  // ---------------------------------------------------------------------------

  private renderMyListingsView(): void {
    if (!this.contentEl || !this.myListingsResult) return;
    this.contentEl.innerHTML = '';

    const data = this.myListingsResult;

    // Crown collection bar
    if (data.pending_crowns > 0) {
      const crownBar = document.createElement('div');
      crownBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px;background:rgba(90,74,42,0.2);border-radius:4px;margin-bottom:10px;';

      const crownText = document.createElement('span');
      crownText.style.cssText = 'font-family:"Crimson Text",serif;font-size:14px;color:#e8c870;display:inline-flex;align-items:center;gap:4px;';
      crownText.appendChild(document.createTextNode('Pending earnings: '));
      crownText.appendChild(this.crownsEl(data.pending_crowns, '14px'));

      const collectBtn = document.createElement('button');
      collectBtn.textContent = 'Collect Crowns';
      collectBtn.style.cssText = 'background:#4a6a2a;border:1px solid #5a4a2a;border-radius:4px;color:#e8c870;font-family:Cinzel,serif;font-size:12px;padding:4px 14px;cursor:pointer;';
      collectBtn.addEventListener('click', () => {
        this.sendFn?.('marketplace.collect_crowns', { building_id: this.buildingId });
      });

      crownBar.appendChild(crownText);
      crownBar.appendChild(collectBtn);
      this.contentEl.appendChild(crownBar);
    }

    // Listings counter
    const counterEl = document.createElement('div');
    counterEl.textContent = `Listings: ${data.listings_used} / ${data.listings_max}`;
    counterEl.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:13px;color:#8a7a5a;margin-bottom:8px;';
    this.contentEl.appendChild(counterEl);

    if (data.listings.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'You have no listings at this marketplace';
      empty.style.cssText = 'text-align:center;color:#8a7a5a;font-family:"Crimson Text",serif;padding:40px;font-size:14px;';
      this.contentEl.appendChild(empty);
      return;
    }

    // Listings table
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-family:"Crimson Text",serif;font-size:12px;';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const text of ['Item', 'Qty', 'Price', 'Status', 'Expires', 'Action']) {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.cssText = 'text-align:left;padding:4px 6px;border-bottom:1px solid #5a4a2a;color:#8a7a5a;font-weight:normal;';
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const listing of data.listings) {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid rgba(90,74,42,0.3);';

      // Item cell with icon
      const itemTd = document.createElement('td');
      itemTd.style.cssText = 'padding:4px 6px;display:flex;align-items:center;gap:6px;';
      if (listing.icon_url) {
        const icon = document.createElement('img');
        icon.src = listing.icon_url;
        icon.style.cssText = 'width:24px;height:24px;image-rendering:pixelated;';
        itemTd.appendChild(icon);
      }
      const nameSpan = document.createElement('span');
      nameSpan.textContent = listing.item_name;
      nameSpan.style.cssText = 'color:#d4a84b;';
      itemTd.appendChild(nameSpan);
      tr.appendChild(itemTd);

      // Other cells
      const qtyTd = document.createElement('td');
      qtyTd.textContent = `${listing.quantity}`;
      qtyTd.style.cssText = 'padding:4px 6px;color:#c9a55c;';
      tr.appendChild(qtyTd);

      const priceTd = document.createElement('td');
      priceTd.style.cssText = 'padding:4px 6px;display:flex;align-items:center;gap:3px;';
      priceTd.appendChild(this.crownsEl(listing.price_per_item, '12px'));
      priceTd.appendChild(document.createTextNode(' each'));
      tr.appendChild(priceTd);

      // Status badge
      const statusTd = document.createElement('td');
      statusTd.style.cssText = 'padding:4px 6px;';
      const badge = document.createElement('span');
      badge.textContent = listing.status;
      const statusColors: Record<string, string> = {
        active: '#5a8a3a',
        sold: '#d4a84b',
        expired: '#8a3a3a',
      };
      badge.style.cssText = `color:${statusColors[listing.status] ?? '#8a7a5a'};font-size:11px;text-transform:uppercase;`;
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      // Expires
      const expTd = document.createElement('td');
      const expiresDate = new Date(listing.expires_at);
      const now = new Date();
      if (listing.status === 'active' && expiresDate > now) {
        const hoursLeft = Math.max(0, Math.floor((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
        const daysLeft = Math.floor(hoursLeft / 24);
        expTd.textContent = daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h` : `${hoursLeft}h`;
      } else {
        expTd.textContent = '—';
      }
      expTd.style.cssText = 'padding:4px 6px;color:#8a7a5a;font-family:Rajdhani,sans-serif;font-size:12px;';
      tr.appendChild(expTd);

      // Action button
      const actionTd = document.createElement('td');
      actionTd.style.cssText = 'padding:4px 6px;';
      if (listing.status === 'active') {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'background:#5a2a2a;border:1px solid #5a4a2a;border-radius:3px;color:#e8c870;font-family:Cinzel,serif;font-size:10px;padding:2px 8px;cursor:pointer;';
        cancelBtn.addEventListener('click', () => {
          this.sendFn?.('marketplace.cancel_listing', { listing_id: listing.listing_id });
        });
        actionTd.appendChild(cancelBtn);
      } else if (listing.status === 'expired') {
        const collectBtn = document.createElement('button');
        collectBtn.textContent = 'Collect Items';
        collectBtn.style.cssText = 'background:#4a6a2a;border:1px solid #5a4a2a;border-radius:3px;color:#e8c870;font-family:Cinzel,serif;font-size:10px;padding:2px 8px;cursor:pointer;';
        collectBtn.addEventListener('click', () => {
          this.sendFn?.('marketplace.collect_items', { listing_id: listing.listing_id });
        });
        actionTd.appendChild(collectBtn);
      }
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.contentEl.appendChild(table);
  }

  // ---------------------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------------------

  private createTab(label: string, tab: 'browse' | 'my_listings'): HTMLElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
      `background:${this.currentTab === tab ? '#5a4a2a' : 'transparent'}`,
      'border:1px solid #5a4a2a',
      'border-radius:3px',
      'color:#e8c870',
      'font-family:Cinzel,serif',
      'font-size:12px',
      'padding:4px 12px',
      'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', () => {
      this.currentTab = tab;
      if (tab === 'browse') {
        this.requestBrowse();
      } else {
        this.sendFn?.('marketplace.my_listings', { building_id: this.buildingId });
      }
      // Update tab styling
      this.open(this.buildingId, this.config);
    });
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private requestBrowse(): void {
    this.sendFn?.('marketplace.browse', {
      building_id: this.buildingId,
      page: this.currentPage,
      category: this.currentCategory || undefined,
      search: this.currentSearch || undefined,
    });
  }

  private showStatus(text: string, color: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = text;
      this.statusEl.style.color = color;
      setTimeout(() => {
        if (this.statusEl) {
          this.statusEl.textContent = 'Drag items from inventory to list them for sale';
          this.statusEl.style.color = '#8a7a5a';
        }
      }, 3000);
    }
  }

  /** Create a span with crowns icon + amount text */
  private crownsEl(amount: number | string, fontSize = '12px'): HTMLElement {
    const span = document.createElement('span');
    span.style.cssText = `display:inline-flex;align-items:center;gap:2px;`;
    const iconUrl = getCrownsIconUrl();
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = `width:${fontSize};height:${fontSize};image-rendering:pixelated;vertical-align:middle;`;
      span.appendChild(img);
    }
    const txt = document.createElement('span');
    txt.textContent = String(amount);
    txt.style.cssText = `font-family:Rajdhani,sans-serif;font-size:${fontSize};color:#f0c060;`;
    span.appendChild(txt);
    return span;
  }

  private pageButtonStyle(enabled: boolean): string {
    return [
      `background:${enabled ? '#1a1610' : '#0d0b08'}`,
      'border:1px solid #5a4a2a',
      'border-radius:3px',
      `color:${enabled ? '#e8c870' : '#5a4a2a'}`,
      'font-family:Cinzel,serif',
      'font-size:11px',
      'padding:3px 10px',
      `cursor:${enabled ? 'pointer' : 'default'}`,
    ].join(';');
  }
}
