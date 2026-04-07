# Quickstart: Warehouse System

**Feature**: 036-warehouse-system  
**Branch**: `036-warehouse-system`

## Prerequisites

- PostgreSQL 16 running with Elarion database
- Node.js 20 LTS
- All existing migrations applied (up to 040)

## Setup

```bash
# Switch to feature branch
git checkout 036-warehouse-system

# Install dependencies (if needed)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd admin/backend && npm install && cd ..
cd admin/frontend && npm install && cd ..

# Apply migration
psql -d elarion -f backend/src/db/migrations/041_warehouse_system.sql

# Start services
cd backend && npm run dev &
cd frontend && npm run dev &
cd admin/backend && npm run dev &
cd admin/frontend && npm run dev &
```

## Testing the Feature

### 1. Create a Warehouse Action (Admin Panel)

1. Open admin panel at `http://localhost:4001`
2. Select a building on the map
3. In the Properties panel, click "Add Action"
4. Select type "Warehouse" from dropdown
5. Click Save

### 2. Open Warehouse (Game Client)

1. Open game at `http://localhost:5173`
2. Log in and navigate to the building with warehouse action
3. Click the building to open BuildingPanel
4. Click the "Warehouse" action button
5. Warehouse modal should open showing inventory (left) and warehouse (right)

### 3. Test Item Transfers

- **Deposit**: Drag an item from inventory grid to an empty warehouse slot
- **Withdraw**: Drag an item from warehouse grid to inventory
- **Stack merge**: Drag a stackable item onto same type in destination
- **Bulk to inventory**: Click left-arrow button
- **Bulk to warehouse**: Click right-arrow button
- **Merge**: Click merge button (transfers only matching types)

### 4. Test Slot Expansion

1. Verify initial 15 slots displayed
2. Click "Expand Storage" button
3. Confirm purchase dialog shows cost (1000 crowns for first)
4. Purchase and verify 16 slots, crown balance reduced
5. Check next cost is 3000 crowns

## Key Files

| Area | File | Purpose |
|------|------|---------|
| Migration | `backend/src/db/migrations/041_warehouse_system.sql` | DB schema |
| DB queries | `backend/src/db/queries/warehouse.ts` | SQL query functions |
| Handler | `backend/src/game/warehouse/warehouse-handler.ts` | WS message handlers |
| Shared types | `shared/protocol/index.ts` | Warehouse message types |
| Frontend modal | `frontend/src/ui/WarehouseModal.ts` | Warehouse UI |
| Building panel | `frontend/src/ui/BuildingPanel.ts` | Warehouse action button |
| Game scene | `frontend/src/scenes/GameScene.ts` | Modal wiring |
| City map loader | `backend/src/game/world/city-map-loader.ts` | DTO mapping |
| Action handler | `backend/src/game/world/building-action-handler.ts` | Action dispatch |
| Admin buildings | `admin/backend/src/routes/buildings.ts` | Admin API validation |
| Admin API types | `admin/frontend/src/editor/api.ts` | Admin type definitions |
| Admin properties | `admin/frontend/src/ui/properties.ts` | Admin UI fields |
| Game data script | `scripts/game-data.js` | Warehouse query command |
| Game entities script | `scripts/game-entities.js` | Entity creation |
