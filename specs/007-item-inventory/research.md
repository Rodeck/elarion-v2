# Research: Item and Inventory System (007)

**Branch**: `007-item-inventory` | **Phase**: 0 | **Date**: 2026-03-03

## Summary

All design decisions are resolved from internal codebase analysis. No external research was required — patterns are fully established by the existing 006-building-actions feature.

---

## Decision 1: Existing Item Schema — Extend vs Replace

**Finding**: Migration `005_game_entities.sql` already creates `items` and `character_items` tables with a simplified schema:
```sql
items (id SMALLINT PK, name, type IN ('weapon','armour','consumable'), stat_modifiers JSONB, description TEXT)
character_items (character_id UUID, item_id SMALLINT, quantity, equipped BOOLEAN, PK(character_id, item_id))
```

The existing `items.ts` query file has `findItemById`, `insertCharacterItem`, and `updateCharacterItemQuantity`.

**Decision**: Replace both tables with new `item_definitions` and `inventory_items` tables via migration 010. The old schema has incompatible types, limited category constraint, and no support for 9 categories, weapon subtypes, per-stat fields, icon, or stack size.

**Impact**: The `loot_table JSONB` field on the `monsters` table likely references old item IDs. Since item drops via loot tables are not part of this feature (spec assumption: players receive items through existing mechanisms), loot table references will be invalidated. Migration 010 should clear or annotate loot_table values; the loot drop system will be re-implemented against `item_definitions` in a future feature.

**Rationale**: Keeping two item schemas would create dual-maintenance overhead and confusion. Clean replacement is justified (Principle III: YAGNI — the old schema predated the feature requirements).

---

## Decision 2: Inventory Slot Model

**Decision**: Use `inventory_items` with `SERIAL PRIMARY KEY` (one row = one occupied slot). No explicit slot_index column. Grid display order = `ORDER BY created_at, id`.

**Rationale**:
- Supports both stackable (one row per item type, quantity incremented at app level) and non-stackable items (multiple rows of same item_def_id allowed — e.g., player could receive 2 iron swords).
- 20-slot cap enforced at application level: `SELECT COUNT(*) FROM inventory_items WHERE character_id = $1` before any insert.
- Avoids explicit slot management (slot_index juggling on deletion) — simpler and extensible (Principle III).

**Simpler Alternative Rejected**: `PRIMARY KEY (character_id, item_def_id)` would enforce one slot per item type but blocks multiple copies of non-stackable items. Not appropriate for an RPG inventory.

---

## Decision 3: Stacking Enforcement Layer

**Decision**: Application-level stacking logic in the backend handler (not DB constraint).

**Rationale**: Cannot enforce "stackable uniqueness only for certain categories" via a partial unique index when the stackable flag lives in `item_definitions` (different table). Application code is clearer and easier to test.

**Logic**:
1. Lookup item definition to determine if stackable (`stack_size IS NOT NULL`).
2. If stackable: find existing row for `(character_id, item_def_id)`. If exists and `quantity + received < stack_size`, increment. If at cap, treat as non-stackable (new slot or overflow notification).
3. If non-stackable or no existing row: count current slots; if `count < 20`, INSERT new row; else return `inventory.full`.

---

## Decision 4: Icon Storage and Serving

**Finding**: The admin backend already follows this pattern for map images:
- Files stored in `backend/assets/maps/images/` (shared assets directory, relative to admin backend)
- Served via `app.use('/images', express.static(imagesDir))` on the admin backend (port 4001)
- Game backend WebSocket payload includes relative URL `/images/{filename}`

**Decision**: Follow identical pattern for item icons:
- Store in `backend/assets/items/icons/`
- Serve via `app.use('/item-icons', express.static(iconsDir))` on admin backend
- PNG only (consistent with map image policy); validate magic bytes
- Filename: `crypto.randomUUID() + '.png'`
- DB stores filename only; URL constructed when building API/WS responses
- Placeholder: `null` filename → frontend renders a default grey icon

---

## Decision 5: Inventory WebSocket Message Architecture

**Finding**: The existing `world.state` handler is complex (zone registration, player broadcasting, city map loading). Adding inventory to `world.state` payload risks coupling and bloating an already large function.

**Decision**: Send `inventory.state` as a **separate message** immediately after `world.state` in `sendWorldState()`. The frontend registers both handlers and renders inventory independently.

**Rationale**: Follows the Single Responsibility principle (Principle III). The inventory panel is logically independent of the world map. Keeps `world.state` focused on spatial/game state. The ordering guarantee (world.state first, then inventory.state) is sufficient since both are sent synchronously from the same async function.

---

## Decision 6: Admin Frontend — Item Manager Integration

**Finding**: The admin frontend is a single-page canvas-based map editor. It has no routing or page-switching mechanism currently.

**Decision**: Add a tab bar at the top of the admin HTML (`index.html`) with "Map Editor" and "Items" tabs. Each tab toggles visibility of the main editor container vs a new `#item-manager` container. Item manager is implemented as a TypeScript class `ItemManager` in `admin/frontend/src/ui/item-manager.ts`, following the same component pattern as `properties.ts`.

**Rationale**: Tabs are the simplest nav pattern that doesn't require a router. Both sections share the same page, admin auth token, and API client.

---

## Decision 7: Inventory Panel Frontend Placement

**Finding**: Current HTML layout:
```html
<div id="top-bar"></div>     <!-- 15vh -->
<div id="game"></div>        <!-- flex: 1 -->
<div id="bottom-bar"></div>  <!-- 20vh -->
```
The spec says the inventory panel is to the **left of the map**, always visible on the map scene.

**Decision**: Add `<div id="inventory-panel"></div>` **inside** `#game` as a sibling to the Phaser canvas. The `#game` div changes from block/column to flex row. The inventory panel takes a fixed width (e.g., 220px), with the Phaser canvas filling the remaining space.

**Rationale**: The Phaser canvas already uses `Scale.FIT + CENTER_BOTH` with DPR scaling, so shrinking the available space in the game container will cause Phaser to refit the canvas to the remaining area. No Phaser config changes needed — only CSS changes to `#game`.

**Note**: `InventoryPanel` is a pure HTML component like `BuildingPanel` — appended to `#inventory-panel` div. `GameScene.ts` instantiates it and registers WebSocket handlers to update it.

---

## Codebase Patterns Confirmed (follow exactly)

| Pattern | Source | Apply To |
|---------|--------|----------|
| Multer PNG-only + magic bytes validation | `routes/upload.ts` | Item icon upload |
| `crypto.randomUUID() + '.png'` filenames | `routes/upload.ts` | Item icon filenames |
| `fs.mkdirSync(dir, { recursive: true })` before write | `routes/upload.ts` | Icon storage dir |
| `console.log(JSON.stringify({level, event, ...}))` | All admin routes | Admin routes logging |
| `log('info', 'subsystem', 'event', {...})` | `backend/src/logger.ts` | Backend handlers |
| Sequential validation gates with early return | `building-action-handler.ts` | Delete item handler |
| `sendToSession(session, 'msg.type', payload)` | `building-action-handler.ts` | Inventory WS responses |
| `registerHandler('type', handlerFn)` | `backend/src/index.ts` | inventory.delete_item |
| HTML component class (show/hide, DOM manipulation) | `BuildingPanel.ts` | `InventoryPanel` |
| `client.on<T>('type', (payload) => {...})` | `GameScene.ts` | Inventory WS handlers |
| Shared protocol types in `shared/protocol/index.ts` | `shared/protocol/index.ts` | New WS payload types |
