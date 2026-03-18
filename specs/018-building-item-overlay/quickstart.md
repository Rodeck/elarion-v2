# Quickstart: Building Item Overlay

**Feature**: 018-building-item-overlay
**Date**: 2026-03-18

## Prerequisites

- PostgreSQL 16 running with game database populated (buildings, items, monsters, NPCs, recipes)
- Admin backend running on port 4001
- Admin frontend running via Vite dev server
- At least one map with buildings that have explore actions (with monsters that have loot) and/or crafter NPCs (with recipes)

## What This Feature Does

Adds a toggle button ("Items") to the map editor toolbar. When enabled, it fetches all obtainable items per building from the backend and renders color-coded item icons next to each building on the canvas:

- **Red/Orange border**: Items dropped by monsters (via explore actions)
- **Blue border**: Items craftable by NPCs at this building

Hovering over an icon shows a tooltip with the item name and source.

## Key Files to Modify

### Backend (admin)
| File | Change |
|------|--------|
| `admin/backend/src/routes/building-items.ts` | **NEW** — Express route handler for `GET /api/maps/:mapId/building-items` |
| `admin/backend/src/index.ts` | Register new route: `app.use('/api/maps', buildingItemsRouter)` |

### Frontend (admin)
| File | Change |
|------|--------|
| `admin/frontend/src/editor/api.ts` | Add `fetchBuildingItems(mapId)` function |
| `admin/frontend/src/editor/canvas.ts` | Add overlay render layer, icon cache, tooltip, hit-testing |
| `admin/frontend/src/ui/toolbar.ts` | Add "Items" toggle button in actions group |
| `admin/frontend/src/main.ts` | Wire toolbar toggle to canvas overlay enable/disable |

## Data Flow

```
1. User clicks "Items" toggle in toolbar
2. main.ts calls fetchBuildingItems(mapId) from api.ts
3. api.ts sends GET /api/maps/:mapId/building-items
4. Backend route joins:
   - buildings → building_actions (explore) → monsters → monster_loot → item_definitions
   - buildings → building_npcs → npcs (is_crafter) → crafting_recipes → item_definitions
5. Returns BuildingItemsResponse JSON
6. main.ts passes data to canvas.setOverlayData(data)
7. Canvas preloads item icon Image objects
8. Canvas renders icons next to buildings in render loop
9. Mouse hover triggers tooltip display
```

## Testing Checklist

1. Open a map with buildings in the editor
2. Click "Items" in toolbar — overlay should appear
3. Verify loot items have red/orange borders
4. Verify crafted items have blue borders
5. Hover over icons — tooltip shows item name and source
6. Pan and zoom — icons follow correctly
7. Click "Items" again — overlay disappears
8. Check a building with no actions/NPCs — no icons shown
9. Check a building with both explore + crafter — both loot and craft icons appear
