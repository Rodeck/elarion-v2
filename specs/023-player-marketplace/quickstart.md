# Quickstart: Player Marketplace

**Feature Branch**: `023-player-marketplace`

## What This Feature Does

Adds a player-to-player marketplace system to the game. Players can visit a marketplace building, browse items listed by other players, buy items with crowns, and list their own items for sale by dragging from inventory. Each marketplace building has its own independent listing pool. Listings expire after a configurable period, and sellers collect earnings at the building where they listed.

## Key Files to Create

### Backend

| File | Purpose |
|------|---------|
| `backend/src/db/migrations/025_marketplace.sql` | New tables + CHECK constraint extension |
| `backend/src/db/queries/marketplace.ts` | Database queries for listings and earnings |
| `backend/src/game/marketplace/marketplace-handler.ts` | WebSocket message handlers for all marketplace operations |
| `backend/src/game/marketplace/marketplace-service.ts` | Business logic: browse, buy, list, cancel, collect |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/ui/MarketplaceModal.ts` | Main marketplace modal (browse grid, listings, my listings, pagination) |
| `frontend/src/ui/ListItemDialog.ts` | Small dialog for setting quantity/price when listing an item |

### Shared

| File | Purpose |
|------|---------|
| `shared/protocol/index.ts` | New marketplace message types and payload interfaces (extend existing file) |

### Admin

| File | Purpose |
|------|---------|
| `admin/backend/src/routes/buildings.ts` | Extend to support `'marketplace'` action type with config validation |

## Key Files to Modify

| File | Change |
|------|--------|
| `backend/src/index.ts` | Register marketplace message handlers |
| `backend/src/game/world/building-action-handler.ts` | Add `'marketplace'` branch to action_type dispatch |
| `frontend/src/ui/BuildingPanel.ts` | Instantiate MarketplaceModal, handle marketplace action button |
| `frontend/src/ui/InventoryPanel.ts` | Add drag-and-drop support (draggable slots) |
| `frontend/src/scenes/GameScene.ts` | Wire marketplace WS message handlers to modal |
| `admin/backend/src/routes/buildings.ts` | Add marketplace config validation in POST/PUT |

## Architecture Decisions

1. **Building-scoped**: Each marketplace building has its own listing pool and earnings accumulation.
2. **Server-authoritative**: All marketplace operations validated server-side; client is a projection only.
3. **WebSocket only**: No REST endpoints for marketplace operations (per constitution).
4. **Query-time expiration**: No background jobs; expired listings filtered via `WHERE expires_at > NOW()`.
5. **Transaction-based concurrency**: Purchase uses `SELECT ... FOR UPDATE` to prevent double-buys.
6. **CraftingModal pattern**: MarketplaceModal uses `setSendFn` injection for outbound WS, `handle*` methods for inbound.

## Config JSONB (building_actions for marketplace)

```json
{
  "listing_fee": 10,
  "max_listings": 10,
  "listing_duration_days": 5
}
```

## Testing Approach

1. **Unit**: Marketplace service functions (price validation, listing limit checks, expiration logic)
2. **Integration**: Full purchase flow in a transaction (crown deduction, item grant, earnings credit)
3. **Concurrency**: Two simultaneous buy attempts on same listing → exactly one succeeds
4. **Frontend**: Modal opens/closes, pagination, filter/search, drag-and-drop listing flow
