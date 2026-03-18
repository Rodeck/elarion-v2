# Research: Building Item Overlay

**Feature**: 018-building-item-overlay
**Date**: 2026-03-18

## Decision 1: Endpoint Design — Single Map-Level Endpoint vs Per-Building

**Decision**: Single endpoint `GET /api/maps/:mapId/building-items` that returns all buildings' items in one response.

**Rationale**: The overlay needs data for ALL buildings simultaneously when toggled. Making N requests (one per building) would create unnecessary network overhead and complexity. A single query joining all relevant tables is more efficient and simpler.

**Alternatives considered**:
- Per-building endpoint (`GET /api/maps/:mapId/buildings/:buildingId/items`) — rejected because the overlay needs all buildings at once; would require N sequential or parallel requests.
- WebSocket message — rejected because this is admin tooling, not game state. Constitution permits REST for non-game operations.

## Decision 2: Data Computation — Server-Side SQL Join vs Client-Side Assembly

**Decision**: Server-side SQL query that joins building_actions → monsters → monster_loot → item_definitions and building_npcs → npcs → crafting_recipes → item_definitions in a single database round-trip.

**Rationale**: All data relationships exist in PostgreSQL. A server-side join is the most efficient approach — the client doesn't have access to monster_loot or crafting_recipes data, and fetching those separately would be wasteful.

**Alternatives considered**:
- Client-side assembly from multiple existing endpoints — rejected because the admin frontend doesn't currently fetch monster_loot or crafting_recipes data on the map editor page.
- Materialized view — rejected as over-engineering per YAGNI. The query is straightforward and the data set is small (admin tool, max ~50 buildings).

## Decision 3: Canvas Rendering — Canvas 2D Layer vs HTML/DOM Overlay

**Decision**: Render item icons as part of the Canvas 2D render loop, as an additional layer after buildings.

**Rationale**: The existing canvas uses a layered render pattern (background → edges → nodes → buildings). Adding a new layer after buildings is the natural extension. Canvas rendering inherits pan/zoom transforms automatically. DOM overlays would require manual position synchronization with canvas transforms.

**Alternatives considered**:
- HTML `div` overlays positioned over the canvas — rejected because synchronizing DOM positions with canvas pan/zoom transforms is fragile and adds complexity.
- Separate overlay canvas stacked on top — rejected because it adds DOM complexity and hit-testing challenges.

## Decision 4: Icon Loading — Preload on Toggle vs Lazy Load

**Decision**: Load all item icons when overlay data arrives (on toggle enable). Cache `Image` objects for reuse. Icons that haven't loaded yet are drawn as colored placeholder squares.

**Rationale**: Item icon images are small PNGs (32×32 or 64×64). The total count per map is bounded (typically <50 unique items). Batch preloading ensures smooth rendering without pop-in. The existing canvas already uses `Image()` objects for background images.

**Alternatives considered**:
- Lazy load on first render — rejected because it causes visual pop-in and complicates the render loop with load state tracking.
- Use existing admin icon cache — no such cache exists currently in the canvas module.

## Decision 5: Tooltip Implementation — Canvas-Based vs DOM Tooltip

**Decision**: Use a DOM tooltip element positioned based on canvas coordinates. Transform canvas coordinates to screen coordinates using the current pan/zoom state.

**Rationale**: Canvas-based tooltips require custom text rendering and don't support rich formatting. A DOM tooltip is simpler, matches existing admin UI styling, and supports text wrapping naturally. The canvas already tracks mouse position for hit-testing.

**Alternatives considered**:
- Canvas-drawn tooltip — rejected because custom text layout (wrapping, padding, background) is verbose and fragile in Canvas 2D.
- No tooltip (P2 feature, could be deferred) — included because it adds modest complexity and significant usability.

## Decision 6: Color Coding Scheme

**Decision**: Use colored borders/outlines around item icons to indicate obtain method:
- **Red/Orange** (`#f87171` / `#fb923c`): Monster loot (explore actions)
- **Blue** (`#60a5fa`): Craftable (NPC recipes)
- **Green** (`#4ade80`): Reserved for future "found" method
- **Purple** (`#a78bfa`): Reserved for future "bought" method

**Rationale**: Colored borders are visible at small icon sizes, work with any icon art style, and match the existing stat-chip color patterns in the admin UI (`.stat-chip--atk` uses red, `.stat-chip--def` uses blue).

**Alternatives considered**:
- Background tint on the entire icon — rejected because it distorts the icon artwork.
- Corner dot/badge — rejected because it's too small to see at typical zoom levels.
- Full-icon color overlay with transparency — viable but borders are cleaner and don't obscure the icon.
