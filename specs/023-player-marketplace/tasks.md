# Tasks: Player Marketplace

**Input**: Design documents from `/specs/023-player-marketplace/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Database schema and shared protocol types — blocking prerequisites for all implementation

- [x] T001 Create migration `backend/src/db/migrations/025_marketplace.sql` — create `marketplace_listings` table (id, building_id FK, seller_id FK, item_def_id FK, quantity, price_per_item, current_durability, status CHECK, created_at, expires_at, sold_at, buyer_id FK, seller_collected BOOLEAN), create `marketplace_earnings` table (id, building_id FK, seller_id FK, pending_crowns, UNIQUE(building_id, seller_id)), extend `building_actions.action_type` CHECK to include `'marketplace'`, add indexes per data-model.md
- [x] T002 Add all marketplace payload interfaces to `shared/protocol/index.ts` — add `MarketplaceBrowsePayload`, `MarketplaceItemListingsPayload`, `MarketplaceBuyPayload`, `MarketplaceListItemPayload`, `MarketplaceCancelListingPayload`, `MarketplaceMyListingsPayload`, `MarketplaceCollectCrownsPayload`, `MarketplaceCollectItemsPayload` (client→server) and `MarketplaceBrowseResultPayload`, `MarketplaceItemSummary`, `MarketplaceItemListingsResultPayload`, `MarketplaceListingDto`, `MarketplaceBuyResultPayload`, `MarketplaceListItemResultPayload`, `MarketplaceCancelResultPayload`, `MarketplaceMyListingsResultPayload`, `MyListingDto`, `MarketplaceCollectCrownsResultPayload`, `MarketplaceCollectItemsResultPayload`, `MarketplaceRejectedPayload` (server→client), plus `MarketplaceActionConfig` type for building action config JSONB shape per contracts/marketplace-protocol.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend skeleton files and handler registration — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create `backend/src/db/queries/marketplace.ts` with query functions skeleton — export empty async functions for: `getActiveListingsSummary(buildingId, page, pageSize, category?, search?)`, `getListingsForItem(buildingId, itemDefId)`, `getListingById(listingId)`, `createListing(buildingId, sellerId, itemDefId, quantity, pricePerItem, currentDurability, expiresAt)`, `updateListingStatus(listingId, status, buyerId?)`, `getSellerListings(buildingId, sellerId)`, `countSellerActiveListings(sellerId)`, `getOrCreateEarnings(buildingId, sellerId)`, `addEarnings(buildingId, sellerId, amount)`, `collectEarnings(buildingId, sellerId)`, `markListingCollected(listingId)`. Each function should have correct TypeScript signatures with return types matching protocol DTOs but empty implementation (throw 'not implemented')
- [x] T004 [P] Create `backend/src/game/marketplace/marketplace-service.ts` with service function skeleton — export empty async functions for: `browseMarketplace(session, payload)`, `getItemListings(session, payload)`, `buyListing(session, payload)`, `listItem(session, payload)`, `cancelListing(session, payload)`, `getMyListings(session, payload)`, `collectCrowns(session, payload)`, `collectItems(session, payload)`. Import types from protocol and queries module
- [x] T005 Create `backend/src/game/marketplace/marketplace-handler.ts` — register 8 WebSocket handlers mapping `marketplace.browse` → `browseMarketplace`, `marketplace.item_listings` → `getItemListings`, `marketplace.buy` → `buyListing`, `marketplace.list_item` → `listItem`, `marketplace.cancel_listing` → `cancelListing`, `marketplace.my_listings` → `getMyListings`, `marketplace.collect_crowns` → `collectCrowns`, `marketplace.collect_items` → `collectItems`. Export a `registerMarketplaceHandlers(registerHandler)` function following existing handler registration patterns
- [x] T006 Register marketplace handlers in `backend/src/index.ts` — import `registerMarketplaceHandlers` from `marketplace-handler.ts` and call it alongside existing handler registrations
- [x] T007 Add `'marketplace'` branch to the action_type dispatch in `backend/src/game/world/building-action-handler.ts` — when `action.action_type === 'marketplace'`, send a response message `marketplace.open` with `{ building_id, config }` to indicate the client should open the marketplace modal (follow existing if/else pattern for explore/expedition/gather)

**Checkpoint**: Foundation ready — handler routing works end-to-end (though service functions are stubs). User story implementation can begin.

---

## Phase 3: User Story 1 — Browse and Buy Items (Priority: P1) 🎯 MVP

**Goal**: Players can open marketplace at a building, browse paginated item listings with category/search filters, view individual listings sorted by price, and purchase a listing stack

**Independent Test**: Pre-seed marketplace_listings via SQL, enter marketplace building, browse/filter/search items, click item to see listings, buy a listing — verify crowns deducted and item received

### Implementation for User Story 1

- [x] T008 [US1] Implement `getActiveListingsSummary` query in `backend/src/db/queries/marketplace.ts` — aggregate active non-expired listings by item_def_id for a building_id, joining item_definitions for name/category/icon_filename, with optional category filter and ILIKE search on name, paginated with LIMIT/OFFSET, returning `MarketplaceItemSummary[]` plus total count. Use `WHERE status = 'active' AND expires_at > NOW()` for expiration filtering
- [x] T009 [US1] Implement `getListingsForItem` query in `backend/src/db/queries/marketplace.ts` — fetch individual active non-expired listings for a specific building_id + item_def_id, joining characters table for seller name and item_definitions for max_durability, sorted by price_per_item ASC, returning `MarketplaceListingDto[]`
- [x] T010 [US1] Implement `getListingById` query in `backend/src/db/queries/marketplace.ts` — fetch single listing by id with `SELECT ... FOR UPDATE` variant for use in purchase transaction, returning full listing row
- [x] T011 [US1] Implement `browseMarketplace` in `backend/src/game/marketplace/marketplace-service.ts` — validate session has character at marketplace building, call `getActiveListingsSummary` with page/category/search from payload, compute total_pages, send `marketplace.browse_result` response. Log browse action with structured logging
- [x] T012 [US1] Implement `getItemListings` in `backend/src/game/marketplace/marketplace-service.ts` — validate session, call `getListingsForItem`, send `marketplace.item_listings_result`. Log item detail view
- [x] T013 [US1] Implement `buyListing` in `backend/src/game/marketplace/marketplace-service.ts` — within a database transaction: `getListingById` with FOR UPDATE, verify status='active' and expires_at > NOW(), check buyer inventory capacity, call `deductCrowns(buyerId, totalPrice)` (reject if null), call `grantItemToCharacter(session, buyerId, itemDefId, quantity)` (handle tools with durability), call `addEarnings(buildingId, sellerId, totalPrice)`, call `updateListingStatus(listingId, 'sold', buyerId)`. Send `marketplace.buy_result` with success/failure. Log purchase with structured logging including listing_id, buyer, seller, amount
- [x] T014 [US1] Implement `addEarnings` and `getOrCreateEarnings` in `backend/src/db/queries/marketplace.ts` — `getOrCreateEarnings` uses INSERT ... ON CONFLICT DO NOTHING then SELECT; `addEarnings` uses UPDATE ... SET pending_crowns = pending_crowns + $3 on marketplace_earnings
- [x] T015 [US1] Implement `updateListingStatus` in `backend/src/db/queries/marketplace.ts` — UPDATE marketplace_listings SET status=$2, sold_at=NOW(), buyer_id=$3 WHERE id=$1
- [x] T016 [US1] Create `frontend/src/ui/MarketplaceModal.ts` — browse view with: overlay (position:fixed, inset:0, z-index:250, dark background matching existing modals), large inner modal (80% viewport width, 70% viewport height), header with title "Marketplace" and close button, category filter bar (All / Weapons / Armor / Resources / Tools / Food / Heal — matching item categories), text search input, paginated item grid (6 columns, each cell showing item icon via img tag with icon_url, item name, total quantity, min-max price range), page navigation (prev/next buttons, page N of M), item detail panel at bottom (hidden until item selected, showing individual listings in a table: seller, quantity, price/item, total, durability if tool, Buy button per row), empty state message "No items for sale". Constructor takes `parent: HTMLElement`, exposes `setSendFn`, `open(buildingId, config)`, `close()`, `isOpen()`, `handleBrowseResult(payload)`, `handleItemListingsResult(payload)`, `handleBuyResult(payload)`. Use existing CSS theme (Cinzel/Crimson Text fonts, gold #d4a84b/#e8c870, dark bg #0d0b08, border #5a4a2a)
- [x] T017 [US1] Wire marketplace modal into `frontend/src/ui/BuildingPanel.ts` — import and instantiate `MarketplaceModal`, when building has a marketplace action show "Browse Marketplace" button, on click call `marketplaceModal.open(buildingId, config)` which sends `marketplace.browse` message via sendFn
- [x] T018 [US1] Wire marketplace WS handlers in `frontend/src/scenes/GameScene.ts` — register message handlers for `marketplace.browse_result`, `marketplace.item_listings_result`, `marketplace.buy_result`, `marketplace.rejected`, routing each to the corresponding `marketplaceModal.handle*` method. Pass the scene's send function to modal via `setSendFn`

**Checkpoint**: Browse and Buy fully functional — players can open marketplace, browse/filter/search, view listings, and purchase items

---

## Phase 4: User Story 2 — List Items for Sale (Priority: P1)

**Goal**: Players can drag items from inventory to marketplace modal, set quantity/price, pay listing fee, and create marketplace listings

**Independent Test**: Open marketplace, drag an item from inventory, set price (and quantity for stackable), click Sell — verify fee deducted, item removed from inventory, listing appears in browse

### Implementation for User Story 2

- [x] T019 [US2] Implement `createListing` query in `backend/src/db/queries/marketplace.ts` — INSERT INTO marketplace_listings with all fields, computing expires_at as `NOW() + $duration * INTERVAL '1 day'`, RETURNING id
- [x] T020 [US2] Implement `countSellerActiveListings` query in `backend/src/db/queries/marketplace.ts` — COUNT listings WHERE seller_id=$1 AND (status='active' OR (status IN ('sold','expired') AND seller_collected=FALSE))
- [x] T021 [US2] Implement `listItem` in `backend/src/game/marketplace/marketplace-service.ts` — validate: session character at marketplace building, slot_id exists in inventory and is not equipped, quantity valid (1 for non-stackable, 1..stack for stackable), price_per_item >= 1, listing count < max_listings (from building action config). Within transaction: deductCrowns(sellerId, listingFee), remove/reduce inventory item, createListing. Send `marketplace.list_item_result` with success + listings_used/max, or rejection reason. Also send `inventory.delete_item` or updated slot. Log listing creation with structured logging
- [x] T022 [US2] Add drag-and-drop capability to `frontend/src/ui/InventoryPanel.ts` — add `setDragEnabled(enabled: boolean)` method. When enabled: set `draggable="true"` on filled inventory cell elements, add `dragstart` handler that sets `dataTransfer.setData('text/plain', JSON.stringify({ slot_id, item_def_id }))` and adds a visual drag class, add `dragend` handler to remove drag class. When disabled: remove draggable attribute and handlers. No changes to existing click behavior
- [x] T023 [US2] Create `frontend/src/ui/ListItemDialog.ts` — small overlay dialog for setting listing parameters. Shows item icon+name, quantity selector (number input, 1..max, hidden for non-stackable items where stack_size=1 or null), per-item price input (number, min 1), total price display (quantity * price, auto-updates), listing fee display (from config), "Sell" and "Cancel" buttons. Constructor takes parent HTMLElement. `open(slot: InventorySlotDto, config: MarketplaceActionConfig)` shows dialog. On Sell click, calls `onConfirm(slot_id, quantity, price_per_item)` callback. On Cancel, closes without action. Styled matching existing modal theme
- [x] T024 [US2] Add drop target and listing flow to `frontend/src/ui/MarketplaceModal.ts` — add `dragover` (preventDefault to allow drop) and `drop` handlers on the modal content area. On drop: parse slot data from dataTransfer, find the InventorySlotDto from current inventory state, open ListItemDialog. On ListItemDialog confirm: send `marketplace.list_item` message via sendFn. Add `handleListItemResult(payload)` method — on success show confirmation message and refresh browse, on failure show error reason. Enable inventory drag when modal opens (`inventoryPanel.setDragEnabled(true)`), disable on close
- [x] T025 [US2] Wire `marketplace.list_item_result` handler in `frontend/src/scenes/GameScene.ts` — route to `marketplaceModal.handleListItemResult`. Pass inventory panel reference to marketplace modal for drag enable/disable control

**Checkpoint**: Browse, Buy, and List Items fully functional — two-sided marketplace economy works

---

## Phase 5: User Story 3 — Manage Own Listings and Collect Earnings (Priority: P2)

**Goal**: Players can view their own active/expired/sold listings, collect accumulated crown earnings, collect expired items back to inventory, and cancel active listings

**Independent Test**: Create listings, simulate a purchase (via another player or SQL), verify seller sees pending crowns and can collect. Wait for expiration (or manipulate expires_at via SQL), verify expired items collectable. Cancel an active listing, verify items returned

### Implementation for User Story 3

- [x] T026 [P] [US3] Implement `getSellerListings` query in `backend/src/db/queries/marketplace.ts` — fetch all non-cancelled listings for a seller at a building, joining item_definitions for name/icon, returning `MyListingDto[]` with status reflecting expiration (if status='active' AND expires_at <= NOW(), report as 'expired')
- [x] T027 [P] [US3] Implement `collectEarnings` query in `backend/src/db/queries/marketplace.ts` — within a transaction: SELECT pending_crowns FROM marketplace_earnings WHERE building_id=$1 AND seller_id=$2 FOR UPDATE, UPDATE pending_crowns=0, return the original pending_crowns amount. Also UPDATE marketplace_listings SET seller_collected=TRUE WHERE building_id=$1 AND seller_id=$2 AND status='sold' AND seller_collected=FALSE
- [x] T028 [P] [US3] Implement `markListingCollected` query in `backend/src/db/queries/marketplace.ts` — UPDATE marketplace_listings SET seller_collected=TRUE, status='expired' WHERE id=$1 AND seller_id=$2 AND (status='expired' OR (status='active' AND expires_at <= NOW())) RETURNING item_def_id, quantity, current_durability
- [x] T029 [US3] Implement `getMyListings` in `backend/src/game/marketplace/marketplace-service.ts` — validate session at marketplace building, call `getSellerListings`, call `getOrCreateEarnings` for pending_crowns, call `countSellerActiveListings` for listings_used, get max_listings from building config. Send `marketplace.my_listings_result`
- [x] T030 [US3] Implement `collectCrowns` in `backend/src/game/marketplace/marketplace-service.ts` — validate session at marketplace building, call `collectEarnings` (returns amount), if amount > 0 call `addCrowns(characterId, amount)`, send `marketplace.collect_crowns_result` with crowns_collected and new balance. Log crown collection with structured logging
- [x] T031 [US3] Implement `collectItems` in `backend/src/game/marketplace/marketplace-service.ts` — validate session, verify listing ownership and expired status, check inventory capacity, call `markListingCollected`, call `grantItemToCharacter` (handle tools with durability), send `marketplace.collect_items_result`. Log item collection
- [x] T032 [US3] Implement `cancelListing` in `backend/src/game/marketplace/marketplace-service.ts` — validate session, verify listing ownership and status='active', check inventory capacity, within transaction: update listing status='cancelled', grant item back to inventory. Send `marketplace.cancel_result`. Log cancellation
- [x] T033 [US3] Add "My Listings" tab/section to `frontend/src/ui/MarketplaceModal.ts` — add tab bar at top of modal with "Browse" and "My Listings" tabs. My Listings view shows: pending crowns amount + "Collect Crowns" button (hidden if 0), listings used counter (e.g., "3/10 listings"), list of own listings each showing item icon/name, quantity, price, status badge (active/sold/expired), and action button per listing: "Cancel" for active, "Collect Items" for expired, no action for sold (crowns collected via bulk button). Add `handleMyListingsResult(payload)`, `handleCollectCrownsResult(payload)`, `handleCollectItemsResult(payload)`, `handleCancelResult(payload)` methods. On tab switch to "My Listings", send `marketplace.my_listings` message
- [x] T034 [US3] Wire remaining marketplace WS handlers in `frontend/src/scenes/GameScene.ts` — register handlers for `marketplace.my_listings_result`, `marketplace.collect_crowns_result`, `marketplace.collect_items_result`, `marketplace.cancel_result`, routing to corresponding modal methods

**Checkpoint**: Full marketplace feature complete for players — browse, buy, list, manage listings, collect earnings/items, cancel listings

---

## Phase 6: User Story 4 — Admin Configuration (Priority: P3)

**Goal**: Admins can designate buildings as marketplaces and configure listing fee, max listings, and listing duration through the admin panel

**Independent Test**: In admin panel, add marketplace action to a building with custom config (e.g., listing_fee=25, max_listings=15, listing_duration_days=7). Verify player sees marketplace at that building with correct settings applied

### Implementation for User Story 4

- [x] T035 [US4] Extend marketplace action type support in `admin/backend/src/routes/buildings.ts` — add `'marketplace'` to the allowed action_type validation list in POST and PUT routes. Add config validation for marketplace type: require `listing_fee` (integer >= 0), `max_listings` (integer >= 1), `listing_duration_days` (integer >= 1), reject unknown fields. Follow existing validation pattern used for gather/explore/expedition config
- [x] T036 [US4] Add marketplace action type to the admin frontend building action form in `admin/frontend/` — add "Marketplace" option to the action type dropdown, show marketplace-specific config fields (listing fee, max listings, listing duration days) with appropriate input types and defaults (10, 10, 5). Follow existing pattern for how gather/explore action config fields are rendered

**Checkpoint**: Admin can create and configure marketplace buildings — full feature complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling, UX refinements, and logging verification

- [x] T037 Add structured logging to all marketplace service functions in `backend/src/game/marketplace/marketplace-service.ts` — verify every operation (browse, buy, list, cancel, collect_crowns, collect_items) and every rejection emits a structured log entry with relevant context (character_id, building_id, listing_id, amount, reason). Follow existing logging patterns from crafting/combat handlers
- [x] T038 Handle edge cases in `frontend/src/ui/MarketplaceModal.ts` — empty state message when no listings, disable Buy button while purchase request is in-flight (prevent double-click), update browse grid after successful buy/list (re-fetch current page), show tool durability in listing details, handle `marketplace.rejected` with user-friendly error toast
- [x] T039 Verify inventory synchronization — when marketplace modal is open and inventory changes (item listed, item purchased, item collected), ensure InventoryPanel reflects updates correctly. Test: list a partial stack and verify remaining quantity updates in inventory. Test: buy an item and verify it appears in inventory

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (migration + protocol types) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core browse & buy
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 if needed, but listing makes more sense after browse exists
- **US3 (Phase 5)**: Depends on Phase 2 — can start after Phase 2, but logically builds on US1+US2
- **US4 (Phase 6)**: Depends on Phase 2 only — can run in parallel with any user story (admin-side only)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories
- **US2 (P1)**: After Phase 2 — independent from US1 but recommended after US1 (browse needed to verify listings appear)
- **US3 (P2)**: After Phase 2 — independent but requires US1+US2 listings to exist for meaningful testing
- **US4 (P3)**: After Phase 2 — fully independent (admin side only)

### Within Each User Story

- Queries before service functions
- Service functions before frontend
- Frontend modal before scene wiring

### Parallel Opportunities

- T003 + T004 can run in parallel (different files, no dependencies)
- T026 + T027 + T028 can run in parallel (different query functions, same file but independent)
- US4 can run entirely in parallel with US1/US2/US3 (different codebase area)

---

## Parallel Example: User Story 1

```bash
# Sequential dependency chain:
T008 (browse query) → T011 (browse service) → T016 (modal UI) → T017 (BuildingPanel) → T018 (GameScene wiring)
T009 (listings query) → T012 (item listings service) ↗ (feeds into T016 modal)
T010 (getById query) + T014 (earnings query) + T015 (status query) → T013 (buy service) ↗ (feeds into T016 modal)

# Parallel within queries:
Task: T008 "browse summary query"
Task: T009 "item listings query"
Task: T010 "getById query"
Task: T014 "earnings query"
Task: T015 "status update query"
# All 5 query tasks write different functions in the same file — can be done in one pass
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration + protocol)
2. Complete Phase 2: Foundational (skeleton + registration)
3. Complete Phase 3: US1 — Browse and Buy
4. **STOP and VALIDATE**: Pre-seed listings via SQL, test browse/filter/search/buy flow
5. Working marketplace viewer with purchasing — deployable MVP

### Incremental Delivery

1. Setup + Foundational → skeleton ready
2. Add US1 (Browse & Buy) → one-way marketplace (admin seeds listings) → Deploy
3. Add US2 (List Items) → two-sided economy (players list and buy) → Deploy
4. Add US3 (Manage & Collect) → full lifecycle (earnings, expiration, cancellation) → Deploy
5. Add US4 (Admin Config) → configurable marketplaces → Deploy
6. Polish → edge cases, logging, UX refinements → Final

### Recommended Execution

Since this is a single-developer project, execute sequentially P1→P2→P3→P4 within each phase:
1. Phases 1-2 first (foundation)
2. US1 complete (browse + buy — testable with SQL-seeded data)
3. US2 complete (listing — now a real marketplace)
4. US3 complete (full lifecycle)
5. US4 complete (admin config)
6. Polish pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All marketplace operations go through WebSocket (no REST) per constitution
- Server-authoritative: every client action validated server-side before response
