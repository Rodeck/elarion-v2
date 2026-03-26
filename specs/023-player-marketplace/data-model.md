# Data Model: Player Marketplace

**Feature Branch**: `023-player-marketplace`
**Migration**: `025_marketplace.sql`

## New Tables

### marketplace_listings

Stores individual item listings posted by players at specific marketplace buildings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Listing identifier |
| building_id | INTEGER | NOT NULL, FK → buildings(id) ON DELETE CASCADE | Marketplace building where item was listed |
| seller_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | Character who listed the item |
| item_def_id | INTEGER | NOT NULL, FK → item_definitions(id) | Item being sold |
| quantity | SMALLINT | NOT NULL, CHECK (quantity >= 1) | Number of items in this listing |
| price_per_item | INTEGER | NOT NULL, CHECK (price_per_item >= 1) | Price per single item in crowns |
| current_durability | INTEGER | NULL | Tool durability at time of listing (NULL for non-tools) |
| status | VARCHAR(16) | NOT NULL, DEFAULT 'active', CHECK (status IN ('active', 'sold', 'expired', 'cancelled')) | Current listing state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the listing was created |
| expires_at | TIMESTAMPTZ | NOT NULL | When the listing becomes unpurchasable |
| sold_at | TIMESTAMPTZ | NULL | When the listing was purchased (NULL if not sold) |
| buyer_id | UUID | NULL, FK → characters(id) | Character who bought the listing (NULL if unsold) |

**Indexes**:
- `idx_listings_building_active` ON (building_id, status) WHERE status = 'active' — fast browse queries
- `idx_listings_seller` ON (seller_id) — fast "my listings" and listing count queries
- `idx_listings_item_def` ON (item_def_id) WHERE status = 'active' — fast item aggregation
- `idx_listings_expires_at` ON (expires_at) WHERE status = 'active' — potential future use for batch expiration

### marketplace_earnings

Accumulates crowns from sales per seller per marketplace building.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Earnings record identifier |
| building_id | INTEGER | NOT NULL, FK → buildings(id) ON DELETE CASCADE | Marketplace building |
| seller_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | Character with pending earnings |
| pending_crowns | INTEGER | NOT NULL, DEFAULT 0, CHECK (pending_crowns >= 0) | Crowns available for collection |

**Unique constraint**: `UNIQUE (building_id, seller_id)` — one earnings record per seller per building.

## Schema Changes to Existing Tables

### building_actions

Extend `action_type` CHECK constraint to include `'marketplace'`:

```sql
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
  CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace'));
```

## Config JSONB Shape (building_actions.config for action_type = 'marketplace')

```json
{
  "listing_fee": 10,
  "max_listings": 10,
  "listing_duration_days": 5
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| listing_fee | integer | 10 | Crowns deducted when listing an item (non-refundable) |
| max_listings | integer | 10 | Maximum active + uncollected listings per player (global across all buildings) |
| listing_duration_days | integer | 5 | Days before a listing expires |

## State Transitions

### Listing Lifecycle

```
                ┌──────────┐
                │  active   │
                └────┬──┬──┬┘
       purchased     │  │  │  seller cancels
      ┌──────────────┘  │  └──────────────┐
      ▼                 │                  ▼
  ┌────────┐    expires_at passes    ┌───────────┐
  │  sold  │            │           │ cancelled  │
  └───┬────┘            ▼           └────────────┘
      │           ┌──────────┐        (items returned,
      │           │ expired  │         slot freed)
      │           └────┬─────┘
      │                │
      │  collect       │  collect
      │  crowns        │  items
      ▼                ▼
  (earnings record     (items returned
   zeroed, listing      to inventory,
   slot freed)          slot freed)
```

**Status rules**:
- `active` → `sold`: Purchase transaction sets `status = 'sold'`, `sold_at = NOW()`, `buyer_id = buyer`. Credits seller's `marketplace_earnings.pending_crowns`.
- `active` → `expired`: Determined at query time (`status = 'active' AND expires_at <= NOW()`). No explicit status update needed for browsing (filtered out). Status updated to `'expired'` when seller views "My Listings" or attempts to collect.
- `active` → `cancelled`: Seller cancels. Items returned to inventory. Listing fee not refunded. Slot freed immediately.
- `sold` → (collected): Seller collects crowns. `marketplace_earnings.pending_crowns` reduced. Listing row remains for history but no longer counts toward listing limit.
- `expired` → (collected): Seller collects items. Items granted back to inventory. Listing row remains for history but no longer counts toward listing limit.

**Listing limit counting**: A listing counts toward the limit when `status IN ('active', 'sold', 'expired')` — i.e., until the seller collects what's owed. Cancelled listings do not count (already freed).

**Correction on slot freeing for sold listings**: When a listing is sold, the slot is freed once the seller collects the earned crowns. To track this, the listing itself needs a `collected` flag or the slot-counting query checks `status = 'sold' AND seller has uncollected earnings`. Simplest approach: add a `seller_collected` boolean column.

### Updated marketplace_listings — additional column

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| seller_collected | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether seller has acknowledged/collected from this listing |

**Listing limit counting** (revised): `WHERE seller_id = $1 AND status IN ('active') OR (status IN ('sold', 'expired') AND seller_collected = FALSE)`

## Entity Relationships

```
buildings (1) ──── (N) building_actions [action_type = 'marketplace']
buildings (1) ──── (N) marketplace_listings
buildings (1) ──── (N) marketplace_earnings
characters (1) ── (N) marketplace_listings [as seller]
characters (1) ── (N) marketplace_listings [as buyer]
characters (1) ── (N) marketplace_earnings [as seller]
item_definitions (1) ── (N) marketplace_listings
```
