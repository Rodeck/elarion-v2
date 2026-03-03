# Developer Quickstart: Item and Inventory System (007)

**Branch**: `007-item-inventory` | **Date**: 2026-03-03

A concise guide for any developer picking up this feature. Read `research.md`, `data-model.md`, and `contracts/` first for full context.

---

## What This Feature Adds

1. **Admin UI**: Item definition CRUD with icon upload — new "Items" tab in admin panel.
2. **Backend**: DB migration (replaces old `items`/`character_items`), inventory WebSocket handlers, inventory query functions.
3. **Shared protocol**: 6 new WebSocket message types (`inventory.*`).
4. **Frontend**: `InventoryPanel` HTML component left of the map; filter bar, grid, detail panel, delete.

---

## Affected Packages

| Package | Changes |
|---------|---------|
| `backend/` | Migration 010, new query file, new WS handlers, `world-state-handler.ts` (send inventory.state) |
| `shared/protocol/` | New types: `ItemCategory`, `WeaponSubtype`, `ItemDefinitionDto`, `InventorySlotDto`, 6 payload interfaces |
| `admin/backend/` | New route file `routes/items.ts`, mount in `index.ts`, serve `/item-icons/` static |
| `admin/frontend/` | New `ui/item-manager.ts`, tab navigation in HTML, `editor/api.ts` additions |
| `frontend/` | `InventoryPanel.ts` component, `GameScene.ts` handler registration, `index.html` layout change |

---

## Development Setup (No Changes to Existing Workflow)

```bash
# Terminal 1: Game backend
cd backend && npm run dev

# Terminal 2: Admin backend
cd admin/backend && npm run dev

# Terminal 3: Game frontend
cd frontend && npm run dev

# Terminal 4: Admin frontend
cd admin/frontend && npm run dev
```

The DB migration runs automatically on game backend startup (`runMigrations()` in `backend/src/db/migrate.ts`).

**Warning**: Migration 010 drops `items` and `character_items`. Any seed data referencing these tables must be updated. Check `backend/src/db/seeds/initial-data.ts` before running.

---

## Implementation Order (follow dependency chain)

### 1. Database first
- Write `backend/src/db/migrations/010_item_inventory.sql`
- Run backend to auto-apply: `cd backend && npm run dev`
- Verify tables exist in psql: `\dt item_definitions`, `\dt inventory_items`

### 2. Shared protocol types
- Add new types to `shared/protocol/index.ts`
- Run `npm run build` in `shared/` if there's a build step; else TypeScript will pick up changes

### 3. Backend query layer
- Write `backend/src/db/queries/inventory.ts`
- Functions: `getItemDefinitions`, `createItemDefinition`, `updateItemDefinition`, `deleteItemDefinition`, `getInventoryWithDefinitions`, `getInventorySlotCount`, `findStackableSlot`, `insertInventoryItem`, `updateInventoryQuantity`, `deleteInventoryItem`

### 4. Admin backend route
- Write `admin/backend/src/routes/items.ts` (CRUD + multer icon upload)
- Follow pattern of `routes/buildings.ts` (validation → query → response) and `routes/upload.ts` (multer + PNG validation)
- Mount in `admin/backend/src/index.ts` + add `/item-icons` static route
- Test with curl or Postman before building the admin UI

### 5. Admin frontend
- Add "Items" tab to `admin/frontend/index.html`
- Write `admin/frontend/src/ui/item-manager.ts` — list, create form, edit form, delete
- Add API functions to `admin/frontend/src/editor/api.ts` (or new `items-api.ts`)
- Test create/edit/delete/filter in browser

### 6. Backend inventory handlers
- Write `backend/src/game/inventory/inventory-delete-handler.ts`
- Write `backend/src/websocket/handlers/inventory-state-handler.ts` (called from `sendWorldState`)
- Register `inventory.delete_item` in `backend/src/index.ts`
- Update `sendWorldState` to call `sendInventoryState` after `sendToSession(session, 'world.state', ...)`

### 7. Frontend inventory panel
- Update `frontend/index.html`: add `<div id="inventory-panel">` inside `#game`, change `#game` to `flex-direction: row`
- Write `frontend/src/ui/InventoryPanel.ts` — grid, filter bar, detail panel, delete action
- Update `frontend/src/scenes/GameScene.ts`: instantiate `InventoryPanel`, register `inventory.*` handlers

---

## Key Design Constraints (non-negotiable)

1. **Server authority**: All inventory mutations (add, delete) are validated server-side. Frontend only updates after server confirmation.
2. **No REST for game state**: `inventory.delete_item` → WebSocket. The admin's REST API is for admin-only operations (item definition management), not player inventory mutations.
3. **Stacking logic on server**: Server decides whether to stack or open new slot. Client just renders what server sends.
4. **Icon URL in WS payload**: Game backend constructs absolute icon URL from `ADMIN_BASE_URL` env + `icon_filename`. Default: `http://localhost:4001`. Add to `backend/src/config.ts`.

---

## Testing Checklist

Before marking the feature complete:

- [ ] Admin can create all 9 category types with correct stat fields
- [ ] Admin can upload PNG icon; placeholder shown when no icon
- [ ] Admin can edit existing item (including icon replace)
- [ ] Admin can filter items by category
- [ ] Admin can delete item definition
- [ ] Player connects → inventory panel shows correct slots
- [ ] Player clicks item → detail panel shows all correct fields
- [ ] Player filters by category → grid filters correctly (empty = empty grid, not error)
- [ ] Player deletes item → grid updates immediately
- [ ] Player receives stackable item → quantity increments, no new slot
- [ ] Player receives stackable item at stack cap → new slot (if space) or inventory.full
- [ ] Player inventory at 20 slots → cannot receive new item, inventory.full shown
- [ ] Server structured logs emitted for: item received, item deleted, inventory full

---

## Structured Log Events to Emit

| Event | Level | Subsystem | Details |
|-------|-------|-----------|---------|
| `item_definition_created` | info | `admin-items` | `{ item_id, name, category }` |
| `item_definition_updated` | info | `admin-items` | `{ item_id, fields_changed }` |
| `item_definition_deleted` | info | `admin-items` | `{ item_id }` |
| `inventory_item_received` | info | `inventory` | `{ character_id, item_def_id, quantity, stacked }` |
| `inventory_full` | info | `inventory` | `{ character_id, item_def_id, item_name }` |
| `inventory_item_deleted` | info | `inventory` | `{ character_id, slot_id, item_def_id }` |
| `inventory_delete_rejected` | warn | `inventory` | `{ character_id, slot_id, reason }` |
