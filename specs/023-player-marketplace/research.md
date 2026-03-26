# Research: Player Marketplace

**Feature Branch**: `023-player-marketplace`
**Date**: 2026-03-26

## Decisions

### 1. Building Action Type Extension

**Decision**: Add `'marketplace'` to the `building_actions.action_type` CHECK constraint, following the same ALTER pattern used for `'gather'` in migration 021.

**Rationale**: Every prior feature (explore, expedition, gather) extended the same CHECK constraint via `DROP CONSTRAINT` + `ADD CONSTRAINT`. The marketplace action fits naturally into this pattern — it's a building-scoped interaction triggered by the player entering a building.

**Alternatives considered**:
- Separate `marketplace_buildings` table with FK to `buildings` — rejected because it duplicates the existing building action system without benefit.
- Boolean flag on `buildings` table — rejected because it doesn't support per-building config (fee, limits, duration).

### 2. Marketplace Data Model

**Decision**: Two new tables — `marketplace_listings` (individual item listings) and `marketplace_earnings` (accumulated seller crowns per building). No separate "marketplace" entity table; the marketplace identity is derived from the building action.

**Rationale**: The building action's `config JSONB` already provides per-marketplace settings (listing fee, max listings, duration). A separate marketplace table would add indirection without value. Listings reference `building_id` directly.

**Alternatives considered**:
- Single `marketplace_listings` table with an `earned_crowns` column — rejected because aggregating earnings per seller per building on every query is expensive vs. a dedicated accumulator.
- Earnings stored on the listing row itself — rejected because a sold listing's crowns need to persist after the listing is "completed," and mixing listing state with earnings state is confusing.

### 3. Concurrency Control for Purchases

**Decision**: Use PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) on the listing row within a transaction. The transaction atomically checks listing status, deducts buyer crowns, grants items, credits seller earnings, and updates listing status.

**Rationale**: The existing `deductCrowns` function already uses an atomic `WHERE crowns >= $2` guard. Wrapping the full purchase in a transaction with `FOR UPDATE` on the listing row prevents double-purchases naturally. This is the simplest approach that guarantees SC-005 (exactly one successful transaction).

**Alternatives considered**:
- Optimistic locking with version column — rejected as more complex; row-level lock is sufficient given marketplace is not high-contention per individual listing.
- Application-level mutex/Map — rejected because it doesn't survive server restarts and adds complexity.

### 4. Listing Expiration Strategy

**Decision**: Expiration is checked at query time (`WHERE expires_at > NOW() AND status = 'active'`). No background cron job needed.

**Rationale**: Listings only need to be "expired" when someone views or interacts with them. A query-time check is simpler and avoids the need for a background worker. The `expires_at` timestamp is computed at listing creation as `NOW() + config.listing_duration_days * INTERVAL '1 day'`.

**Alternatives considered**:
- Background job that periodically marks expired listings — rejected per Principle III (YAGNI). Query-time filtering achieves the same result without infrastructure.
- PostgreSQL `pg_cron` extension — rejected as an external dependency for a simple timestamp comparison.

### 5. Frontend Modal Architecture

**Decision**: New `MarketplaceModal` class following the `CraftingModal` pattern — constructor takes `parent: HTMLElement`, receives a `setSendFn` for outbound WebSocket messages, and exposes `handle*` methods for inbound server responses.

**Rationale**: The CraftingModal pattern is the most feature-rich existing modal (bidirectional WS communication, multiple server response handlers). The marketplace needs the same capabilities (browse request → response, buy request → result, list request → result).

**Alternatives considered**:
- CombatModal pattern (one-shot payload) — rejected because marketplace requires ongoing bidirectional interaction, not a single result display.

### 6. Drag-and-Drop for Listing Items

**Decision**: Add `draggable` capability to inventory slots when marketplace modal is open. The marketplace modal registers as a drop target. Since no drag-and-drop exists in the current InventoryPanel, this is new functionality.

**Rationale**: The spec explicitly requires drag-and-drop from inventory to marketplace. The simplest approach is to make inventory cells `draggable` with HTML5 Drag and Drop API, using `dataTransfer` to carry `slot_id`. The marketplace modal listens for `dragover`/`drop` events.

**Alternatives considered**:
- Button-based "List this item" in the inventory detail panel — rejected because the spec explicitly calls for drag-and-drop. Could be added as a secondary mechanism later.
- Pointer-based custom drag (no HTML5 DnD) — rejected as more complex with no benefit for desktop-first game.

### 7. WebSocket Message Design

**Decision**: New message types under `marketplace.*` namespace. Client sends action requests; server responds with state updates. The marketplace state is fetched on-demand when the modal opens (not pushed continuously).

**Rationale**: Marketplace data is only relevant when the modal is open. Pushing marketplace updates to all connected clients would waste bandwidth. The client requests data when needed, and the server sends targeted responses.

**Alternatives considered**:
- Real-time push of all marketplace changes — rejected as wasteful; marketplace is not a real-time competitive feature.
- REST endpoints — rejected per Constitution Principle I (all game state communication via WebSocket).

### 8. Pagination Strategy

**Decision**: Server-side pagination. Client sends page number + optional filters (category, search text). Server returns a page of aggregated item summaries plus total count. Page size configurable but defaulting to 24 items (fits a 6×4 or 8×3 grid).

**Rationale**: With up to 1,000 listings per marketplace, sending all data to the client on every filter change is wasteful. Server-side pagination with filtering keeps payloads small and response times fast.

**Alternatives considered**:
- Client-side pagination (send all data, paginate in JS) — rejected because 1,000+ listings with item definitions would be a large payload.
