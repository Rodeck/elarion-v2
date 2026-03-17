# Quickstart: Crafting System

**Feature**: 017-crafting-system | **Date**: 2026-03-17

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running with existing Elarion database
- All existing migrations applied (through 018_combat_system.sql)
- Backend, frontend, and admin services buildable (`npm run build` in each package)

## Setup Steps

### 1. Apply Migration

```sql
-- Run: backend/src/db/migrations/019_crafting_system.sql
-- Adds: npcs.is_crafter column, crafting_recipes, recipe_ingredients,
--        crafting_sessions, crafting_session_costs tables
```

### 2. Create a Test Recipe (Admin)

1. Start admin backend: `cd admin/backend && npm run dev`
2. Start admin frontend: `cd admin/frontend && npm run dev`
3. Open admin UI at `http://localhost:5174`
4. Navigate to NPC management, mark an NPC as "Crafter"
5. Navigate to Recipe management, create a recipe:
   - Name: "Iron Sword"
   - Output: select an existing weapon item definition
   - Output quantity: 1
   - Ingredients: add 1+ item definitions with quantities
   - Crown cost: e.g., 50
   - Craft time: e.g., 60 seconds
   - Assign to the crafter NPC

### 3. Test the Crafting Flow (Player)

1. Start game backend: `cd backend && npm run dev`
2. Start game frontend: `cd frontend && npm run dev`
3. Open game at `http://localhost:5173`
4. Login and navigate to a building with the crafter NPC
5. Click the NPC, select "I want to craft some items"
6. Select the recipe, choose quantity, start crafting
7. Verify materials and crowns are deducted
8. Wait or use `/crafting_finish <name>` to fast-forward
9. Return to NPC, collect crafted items

### 4. Test Admin Command

```
/crafting_finish <player_name>
```
Instantly completes all in-progress crafting sessions for the named player.

## Key Files

| Area | File | Purpose |
|------|------|---------|
| Migration | `backend/src/db/migrations/019_crafting_system.sql` | Database schema |
| Queries | `backend/src/db/queries/crafting.ts` | All crafting SQL queries |
| Service | `backend/src/game/crafting/crafting-service.ts` | Core crafting business logic |
| Handler | `backend/src/game/crafting/crafting-handler.ts` | WebSocket message handlers |
| Protocol | `shared/protocol/index.ts` | DTOs and message type definitions |
| Frontend UI | `frontend/src/ui/CraftingModal.ts` | Player crafting modal |
| Building integration | `frontend/src/ui/BuildingPanel.ts` | NPC dialog option hook |
| Admin routes | `admin/backend/src/routes/recipes.ts` | Recipe CRUD API |
| Admin UI | `admin/frontend/src/ui/recipe-manager.ts` | Recipe management interface |

## Architecture Notes

- **Progress model**: Wall-clock time. `progress = (now - started_at) / total_duration`. No timers or background jobs.
- **Server-authoritative**: All crafting mutations validated and executed server-side. Client sends requests, server sends confirmations or rejections.
- **Persistence**: Crafting sessions stored in PostgreSQL. Survive server restarts. Downtime counts as elapsed time.
- **Refund**: 50% of materials and crowns, rounded down. Original costs stored in `crafting_session_costs` for accuracy.
