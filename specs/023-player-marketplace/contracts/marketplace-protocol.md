# WebSocket Protocol: Marketplace Messages

**Feature Branch**: `023-player-marketplace`
**Protocol Version**: v1

All messages follow the standard envelope: `{ type: string, v: 1, payload: T }`

## Client → Server Messages

### marketplace.browse

Request the current marketplace listing summary for browsing.

```ts
interface MarketplaceBrowsePayload {
  building_id: number;
  page: number;              // 1-based page number
  category?: string;         // item category filter (e.g., 'weapon', 'resource')
  search?: string;           // text search filter on item name
}
```

### marketplace.item_listings

Request individual listings for a specific item.

```ts
interface MarketplaceItemListingsPayload {
  building_id: number;
  item_def_id: number;
}
```

### marketplace.buy

Purchase a specific listing.

```ts
interface MarketplaceBuyPayload {
  listing_id: number;
}
```

### marketplace.list_item

Create a new listing from inventory.

```ts
interface MarketplaceListItemPayload {
  building_id: number;
  slot_id: number;           // inventory slot to list from
  quantity: number;           // how many to list (1 for non-stackable)
  price_per_item: number;    // crowns per item (minimum 1)
}
```

### marketplace.cancel_listing

Cancel an active listing.

```ts
interface MarketplaceCancelListingPayload {
  listing_id: number;
}
```

### marketplace.my_listings

Request the seller's own listings and earnings for a building.

```ts
interface MarketplaceMyListingsPayload {
  building_id: number;
}
```

### marketplace.collect_crowns

Collect all pending crown earnings at a building.

```ts
interface MarketplaceCollectCrownsPayload {
  building_id: number;
}
```

### marketplace.collect_items

Collect items from an expired listing back to inventory.

```ts
interface MarketplaceCollectItemsPayload {
  listing_id: number;
}
```

## Server → Client Messages

### marketplace.browse_result

Response to `marketplace.browse` with paginated item summaries.

```ts
interface MarketplaceBrowseResultPayload {
  building_id: number;
  items: MarketplaceItemSummary[];
  page: number;
  total_pages: number;
  total_items: number;       // distinct item types, not individual listings
}

interface MarketplaceItemSummary {
  item_def_id: number;
  name: string;
  category: string;
  icon_url: string;
  total_quantity: number;    // sum of quantities across all active listings
  listing_count: number;     // number of individual listings
  min_price_per_item: number;
  max_price_per_item: number;
}
```

### marketplace.item_listings_result

Response to `marketplace.item_listings` with individual listings for a specific item.

```ts
interface MarketplaceItemListingsResultPayload {
  item_def_id: number;
  listings: MarketplaceListingDto[];
}

interface MarketplaceListingDto {
  listing_id: number;
  seller_name: string;
  quantity: number;
  price_per_item: number;
  total_price: number;       // quantity * price_per_item
  current_durability?: number | null;  // tools only
  max_durability?: number | null;      // tools only (from item_definitions)
  created_at: string;        // ISO 8601
}
```

### marketplace.buy_result

Response to `marketplace.buy`.

```ts
interface MarketplaceBuyResultPayload {
  success: boolean;
  listing_id: number;
  new_crowns?: number;       // buyer's updated crown balance (on success)
  item?: InventorySlotDto;   // the purchased item slot (on success)
  reason?: string;           // rejection reason (on failure): 'INSUFFICIENT_CROWNS' | 'INVENTORY_FULL' | 'LISTING_UNAVAILABLE'
}
```

### marketplace.list_item_result

Response to `marketplace.list_item`.

```ts
interface MarketplaceListItemResultPayload {
  success: boolean;
  new_crowns?: number;       // seller's updated crown balance after fee (on success)
  listing_id?: number;       // the created listing ID (on success)
  listings_used?: number;    // current listing count after creation (on success)
  listings_max?: number;     // maximum listings allowed (on success)
  reason?: string;           // rejection reason: 'INSUFFICIENT_CROWNS' | 'LISTING_LIMIT' | 'INVALID_ITEM' | 'EQUIPPED_ITEM' | 'INVALID_QUANTITY' | 'INVALID_PRICE'
}
```

### marketplace.cancel_result

Response to `marketplace.cancel_listing`.

```ts
interface MarketplaceCancelResultPayload {
  success: boolean;
  listing_id: number;
  returned_item?: InventorySlotDto;  // item returned to inventory (on success)
  reason?: string;           // 'NOT_OWNER' | 'NOT_ACTIVE' | 'INVENTORY_FULL'
}
```

### marketplace.my_listings_result

Response to `marketplace.my_listings`.

```ts
interface MarketplaceMyListingsResultPayload {
  building_id: number;
  listings: MyListingDto[];
  pending_crowns: number;    // total crowns available for collection at this building
  listings_used: number;     // current count toward limit (across all buildings)
  listings_max: number;      // maximum allowed
}

interface MyListingDto {
  listing_id: number;
  item_def_id: number;
  item_name: string;
  icon_url: string;
  quantity: number;
  price_per_item: number;
  status: 'active' | 'sold' | 'expired';
  created_at: string;
  expires_at: string;
  current_durability?: number | null;
}
```

### marketplace.collect_crowns_result

Response to `marketplace.collect_crowns`.

```ts
interface MarketplaceCollectCrownsResultPayload {
  success: boolean;
  crowns_collected: number;
  new_crowns: number;        // player's updated crown balance
}
```

### marketplace.collect_items_result

Response to `marketplace.collect_items`.

```ts
interface MarketplaceCollectItemsResultPayload {
  success: boolean;
  listing_id: number;
  returned_item?: InventorySlotDto;  // on success
  reason?: string;           // 'INVENTORY_FULL' | 'NOT_OWNER' | 'NOT_EXPIRED'
}
```

### marketplace.rejected

Generic rejection for marketplace actions when pre-conditions fail (e.g., not at building).

```ts
interface MarketplaceRejectedPayload {
  action: string;            // the message type that was rejected
  reason: string;            // 'NOT_AT_BUILDING' | 'NOT_MARKETPLACE' | 'UNKNOWN_ERROR'
}
```

## Message Flow Diagrams

### Browse & Buy Flow

```
Client                          Server
  │                               │
  ├─ marketplace.browse ─────────►│ query aggregated items
  │◄──── marketplace.browse_result┤
  │                               │
  ├─ marketplace.item_listings ──►│ query individual listings
  │◄─ marketplace.item_listings_result
  │                               │
  ├─ marketplace.buy ────────────►│ BEGIN TX
  │                               │   SELECT listing FOR UPDATE
  │                               │   check status = 'active'
  │                               │   check expires_at > NOW()
  │                               │   deductCrowns(buyer)
  │                               │   grantItem(buyer)
  │                               │   credit earnings(seller)
  │                               │   UPDATE listing status='sold'
  │                               │ COMMIT
  │◄──── marketplace.buy_result ──┤
```

### List Item Flow

```
Client                          Server
  │                               │
  ├─ marketplace.list_item ──────►│ validate item, quantity, price
  │                               │   check listing limit
  │                               │   deductCrowns(seller, fee)
  │                               │   remove from inventory
  │                               │   INSERT listing
  │◄─ marketplace.list_item_result┤
  │◄─ inventory.delete_item ──────┤ (inventory update)
```

### Collect Earnings Flow

```
Client                          Server
  │                               │
  ├─ marketplace.collect_crowns ─►│ read pending_crowns
  │                               │   addCrowns(seller, amount)
  │                               │   zero out earnings
  │                               │   mark sold listings collected
  │◄─ marketplace.collect_crowns_result
```
