# Research: Warehouse System

**Feature**: 036-warehouse-system  
**Date**: 2026-04-07

## Decision 1: Database Schema for Warehouse Items

**Decision**: Use a dedicated `warehouse_items` table mirroring the `inventory_items` structure (per-item rows with item_def_id, quantity, instance stats) plus a `warehouse_slots` table tracking per-player, per-building slot counts.

**Rationale**: The existing `inventory_items` table stores items with per-instance stat overrides (item variations from 034-item-variation). Warehouse items need the same fidelity — a weapon with custom stats must retain those stats when stored. A separate table prevents contaminating inventory queries and keeps the `equipped_slot` column irrelevant.

**Alternatives considered**:
- Reusing `inventory_items` with a `location` column: Would require modifying all existing inventory queries to filter by location. Too invasive.
- JSONB blob per warehouse: Loses relational integrity, can't enforce FK to item_definitions, harder to query.

## Decision 2: Warehouse Slot Initialization

**Decision**: Lazy initialization — create the `warehouse_slots` row on first warehouse open (not on character creation). Default 15 slots, 0 extra purchased.

**Rationale**: Most characters won't visit every warehouse. Eager creation would produce rows for warehouses the player never visits. The marketplace uses a similar lazy pattern for `marketplace_earnings`.

**Alternatives considered**:
- Eager creation on character creation: Requires knowing all warehouse buildings at creation time; wasteful for buildings added later.

## Decision 3: Item Transfer Protocol

**Decision**: Individual transfers use `warehouse.deposit` / `warehouse.withdraw` messages. Bulk transfers use `warehouse.bulk_deposit` / `warehouse.bulk_withdraw` / `warehouse.merge` messages. All return an updated warehouse state payload.

**Rationale**: Follows the existing marketplace pattern where each operation has its own message type. Returning full state after each operation keeps the client in sync without requiring delta tracking.

**Alternatives considered**:
- Single `warehouse.transfer` message with direction flag: Less explicit, harder to validate server-side.
- Delta-based updates: More complex, risk of desync.

## Decision 4: Building Action Config

**Decision**: Warehouse action type uses empty config `{}`. The default slot count (15) and pricing formula are server-side constants, not per-building config.

**Rationale**: Unlike marketplace (which has per-building listing fees, max listings, duration), warehouse behavior is uniform across all locations. Making these configurable per-building adds unnecessary complexity. If tuning is needed later, config can be added without schema changes (JSONB is flexible).

**Alternatives considered**:
- Per-building config with custom slot count/pricing: Violates YAGNI — no current requirement for different warehouses to have different pricing.

## Decision 5: Drag-and-Drop Implementation

**Decision**: Follow the MarketplaceModal pattern — the warehouse modal listens for `dragover`/`drop` events on its content area. Inventory panel items are already draggable (from marketplace feature). Warehouse slots also become drag sources for withdrawal.

**Rationale**: The drag-and-drop infrastructure already exists. The marketplace uses it for listing items. Warehouse extends the same pattern bidirectionally.

**Alternatives considered**:
- Click-to-transfer only: Less intuitive, doesn't match the user's explicit requirement for drag-and-drop.

## Decision 6: Action Type Extension Points

**Decision**: Follow the CLAUDE.md "Adding a New Building Action Type" checklist — all 7 locations must be updated, plus admin panel, frontend, and game-entities tooling (Principle VI).

**Rationale**: This is a well-documented pattern with a mandatory checklist. Following it prevents the silent failures documented in CLAUDE.md.
