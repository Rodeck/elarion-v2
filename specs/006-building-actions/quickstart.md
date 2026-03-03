# Quickstart: Building Actions & Map Travel

**Feature Branch**: `006-building-actions`
**Date**: 2026-03-03

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running locally
- `.env` files configured in `backend/` and `admin/backend/`
- Existing maps created via the admin editor (003-city-map-system)

---

## 1. Run the Database Migration

```bash
# From repo root
psql -d elarion -f backend/src/db/migrations/009_building_actions.sql
```

This adds `description TEXT` to `buildings` and creates the `building_actions` table.

---

## 2. Start All Services

```bash
# Terminal 1 — game backend
cd backend && npm run dev

# Terminal 2 — admin backend
cd admin/backend && npm run dev

# Terminal 3 — admin frontend
cd admin/frontend && npm run dev

# Terminal 4 — game frontend
cd frontend && npm run dev
```

---

## 3. Configure a Building with a Travel Action (Admin)

1. Open the admin editor at `http://localhost:5173` (or admin frontend port)
2. Log in and open a city-type map
3. Select the **Building** mode in the toolbar
4. Click a node that has a building — the properties panel opens on the right
5. Fill in **Title** and **Description** fields
6. Click **+ Add Action → Travel to Location**
7. In the **Destination Map** dropdown, select the target map
8. In the **Destination Node** dropdown, select the arrival node
9. Click **Save Action**
10. The building now has a configured travel action

---

## 4. Test the Travel Flow (Game Client)

1. Open the game at `http://localhost:5174` (or frontend port)
2. Log in with a character that is on the same city map as the configured building
3. Click the building node to navigate your character there
4. When the character arrives, a **Building Panel** appears on the right side of the screen
5. The panel shows the building's title, description, and a **"Travel to [Destination]"** button
6. Click the travel button
7. A **fade-to-black** transition plays (~600ms)
8. The game loads the destination map and the character appears at the configured destination node
9. The panel closes automatically

---

## 5. Verify in Logs

The backend emits structured JSON logs on travel:

```jsonc
{
  "event": "player_travel",
  "character_id": "abc123",
  "from_zone_id": 1,
  "to_zone_id": 2,
  "building_id": 5,
  "action_id": 3,
  "timestamp": "2026-03-03T12:00:00.000Z"
}
```

---

## Key File Locations

| What | Where |
|------|-------|
| DB migration | `backend/src/db/migrations/009_building_actions.sql` |
| Building queries (DB layer) | `backend/src/db/queries/city-maps.ts` |
| City map cache (includes actions) | `backend/src/game/world/city-map-loader.ts` |
| Building action handler (WebSocket) | `backend/src/game/world/building-action-handler.ts` |
| Shared protocol types | `shared/protocol/index.ts` |
| Admin building routes | `admin/backend/src/routes/buildings.ts` |
| Admin building properties UI | `admin/frontend/src/ui/properties.ts` |
| Game building panel | `frontend/src/ui/BuildingPanel.ts` |
| Game scene (message handlers) | `frontend/src/scenes/GameScene.ts` |

---

## Troubleshooting

**Building panel doesn't appear after arriving at building node**
- Ensure `009_building_actions.sql` migration has been run (the `description` column must exist)
- Check backend logs for `city.building_arrived` being sent
- Verify the `BuildingPanel` component is mounted in `GameScene.ts`

**Travel action dropdown shows no maps / no nodes**
- Check that `GET /api/maps` returns maps from the admin backend
- Confirm the admin JWT token is valid (re-login if needed)

**Travel fails with `INVALID_DESTINATION`**
- The target zone or node was deleted after the action was configured
- Re-open the building in the admin editor and re-select a valid destination

**Fade animation doesn't trigger**
- Confirm the client receives `city.building_action` response from server (check browser DevTools → Network → WS)
- Check that `camera.fadeOut` is called on the correct Phaser Camera instance
