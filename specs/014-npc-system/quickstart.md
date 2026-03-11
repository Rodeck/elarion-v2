# Quickstart: NPC System Implementation

**Feature**: 014-npc-system
**Date**: 2026-03-09

This guide shows a developer how to implement and verify the NPC system from scratch.

---

## Prerequisites

- All existing migrations applied (up to `015_day_night_cycle.sql`)
- Backend and admin backend running locally
- Admin account available

---

## Step 1: Apply the Database Migration

Run `016_npcs.sql` through the existing migration runner:

```bash
# Apply the migration (same process as all prior migrations)
cd backend
# The migration runner picks up new files in src/db/migrations/ alphabetically
npm run migrate
```

Verify:
```sql
\d npcs           -- should show id, name, description, icon_filename, created_at
\d building_npcs  -- should show id, building_id, npc_id, sort_order + unique constraint
```

---

## Step 2: Create NPC Asset Directory

```bash
mkdir -p backend/assets/npcs/icons
```

Add the static route in `admin/backend/src/index.ts` (next to existing static routes):

```typescript
app.use('/npc-icons', express.static(path.resolve(__dirname, '../../../backend/assets/npcs/icons')));
```

---

## Step 3: Add Admin Backend Routes

Create `admin/backend/src/routes/npcs.ts` following the pattern in `items.ts`/`monsters.ts`.

Register in `admin/backend/src/index.ts`:

```typescript
import npcRoutes from './routes/npcs';
// ...
app.use('/api/npcs', requireAdmin, npcRoutes);
```

Add building NPC assignment routes (can be in `admin/backend/src/routes/buildings.ts` or a new `building-npcs.ts`):

```typescript
// Nested under existing building routes
router.get('/:buildingId/npcs', ...);
router.post('/:buildingId/npcs', ...);
router.delete('/:buildingId/npcs/:npcId', ...);
```

### Quick Test (Admin REST)

```bash
# Create an NPC (after uploading an icon first)
curl -X POST http://localhost:4001/api/npcs \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test NPC","description":"A test character","icon_filename":"test.png"}'

# List NPCs
curl http://localhost:4001/api/npcs \
  -H "Authorization: Bearer <admin-token>"

# Assign to building
curl -X POST http://localhost:4001/api/maps/1/buildings/1/npcs \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"npc_id":1}'
```

---

## Step 4: Update Shared Protocol

In `shared/protocol/index.ts`:

1. Add `NpcDto` interface.
2. Add `npcs: NpcDto[]` to `CityMapBuilding`.

```typescript
export interface NpcDto {
  id: number;
  name: string;
  icon_url: string;
}

export interface CityMapBuilding {
  // ... existing fields ...
  npcs: NpcDto[];
}
```

---

## Step 5: Update Backend WorldState Builder

Find where `world.state` builds the buildings array (look for the query that selects buildings by zone_id).

Extend it to LEFT JOIN `building_npcs` and `npcs`, then map the results to include `npcs: NpcDto[]`.

```sql
-- Conceptual query (adapt to existing builder pattern)
SELECT
  b.*,
  COALESCE(
    JSON_AGG(
      JSON_BUILD_OBJECT('id', n.id, 'name', n.name, 'icon_filename', n.icon_filename)
    ) FILTER (WHERE n.id IS NOT NULL),
    '[]'
  ) AS npcs_json
FROM buildings b
LEFT JOIN building_npcs bn ON bn.building_id = b.id
LEFT JOIN npcs n ON n.id = bn.npc_id
WHERE b.zone_id = $1
GROUP BY b.id
ORDER BY b.id;
```

Map `icon_filename` → `icon_url` by prepending `/npc-icons/` in TypeScript.

### Quick Test (WorldState)

Log in as a player, enter a zone with a building that has the test NPC assigned. Check the `world.state` WebSocket message payload. The building's `npcs` array should contain the NPC.

---

## Step 6: Add NPC Manager to Admin Frontend

Create `admin/frontend/src/ui/npc-manager.ts`.

Add a new tab in `admin/frontend/src/main.ts`:

```typescript
// In tab click handler
case 'npcs':
  if (!npcManager) npcManager = new NpcManager(mainContent);
  npcManager.render();
  break;
```

Add the tab button in `index.html`:

```html
<button class="tab-btn" data-tab="npcs">NPCs</button>
```

### Manual Test

1. Open admin at `http://localhost:4001`
2. Click the "NPCs" tab
3. Fill in name + description, upload a PNG icon, click Save
4. NPC appears in the list on the right
5. Click the NPC in the list — form populates with its data
6. Edit name, save — list updates
7. Delete — NPC removed from list

---

## Step 7: Add NPC Assignment to Building Properties Panel

Extend `admin/frontend/src/ui/properties.ts` to add an NPC section when a building is selected.

The section shows:
- A dropdown populated from `GET /api/npcs`
- An "Assign" button calling `POST /api/maps/:mapId/buildings/:buildingId/npcs`
- A list of currently assigned NPCs with individual "Remove" buttons

### Manual Test

1. Open the map editor
2. Click a building — the Properties panel opens
3. In the NPCs section, select "Test NPC" from dropdown → click Assign
4. NPC appears in the assigned list
5. Click Remove → NPC removed from list

---

## Step 8: Update Game Frontend Building Menu

Find the building menu UI component in `frontend/src/` (the panel that shows when a player interacts with a building).

Add a conditional NPC section:

```typescript
if (building.npcs.length > 0) {
  // Render "You can find here:" heading
  // Render each NPC: icon + name, clickable (stub for dialog)
}
```

### Manual Test (End-to-End)

1. Run the full stack (backend + frontend)
2. Log in as a player
3. Navigate to a building that has the test NPC assigned
4. Click the building
5. Building menu shows "You can find here:" section with the NPC's icon and name
6. Click a building with no NPCs — section is absent

---

## Verification Checklist

- [ ] `016_npcs.sql` migration applies without errors
- [ ] `POST /api/npcs` creates NPC and returns correct shape
- [ ] `POST /api/npcs/upload` accepts PNG, rejects non-PNG and >2MB
- [ ] `DELETE /api/npcs/:id` removes NPC and all building assignments (CASCADE)
- [ ] `POST /api/maps/:mapId/buildings/:buildingId/npcs` returns 409 on duplicate
- [ ] `world.state` payload includes `npcs: []` for buildings with no assignments
- [ ] `world.state` payload includes correct NPC data for buildings with assignments
- [ ] Admin frontend NPC tab: create, edit, delete work
- [ ] Admin frontend building panel: assign, unassign work
- [ ] Game frontend: "You can find here:" section visible with NPCs, absent without
- [ ] NPC icon served correctly from `/npc-icons/` route
- [ ] AI icon generation dialog works from NPC form
