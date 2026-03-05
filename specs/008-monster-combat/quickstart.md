# Quickstart: Monster Combat System (008)

**Branch**: `008-monster-combat`

This guide covers how to set up, run, and verify the monster combat feature locally.

---

## Prerequisites

- PostgreSQL 16 running locally (same as previous features)
- Node.js 20 LTS
- All packages installed: run `npm install` from repo root

---

## 1. Run Migration

```bash
# From repo root
psql -U <user> -d <database> -f backend/src/db/migrations/011_monster_combat.sql
```

This drops the old `combat_simulations`, `combat_participants`, and `monsters` tables, then creates the new `monsters` and `monster_loot` tables, and extends the `building_actions` action_type check.

---

## 2. Start Services

```bash
# Terminal 1: Game backend (WebSocket server)
cd backend && npm run dev

# Terminal 2: Admin backend (REST API + static assets)
cd admin/backend && npm run dev

# Terminal 3: Game frontend
cd frontend && npm run dev

# Terminal 4: Admin frontend
cd admin/frontend && npm run dev
```

---

## 3. Create a Test Monster (Admin)

1. Open the admin panel (default: `http://localhost:4001`)
2. Click the **Monsters** tab
3. Click **New Monster**
4. Fill in: Name = `Cave Rat`, Attack = `5`, Defense = `2`, HP = `15`, XP Reward = `25`
5. Optionally upload an icon PNG
6. Click **Save**
7. On the monster detail view, click **Add Loot**
8. Select an item from the dropdown, set Drop Chance = `50`, Quantity = `1`
9. Click **Save Loot Entry**

---

## 4. Configure Explore Action on a Building

1. In the admin panel, go to **Map Editor** and open a city map
2. Click **Building Mode** in the toolbar
3. Click an existing building node to open the Properties panel
4. Scroll to **Actions** and click **Add Action**
5. Select type **Explore**
6. Set Encounter Chance = `100` (for deterministic testing)
7. Click **Add Monster** in the monster table, select `Cave Rat`, set Weight = `1`
8. Click **Save Action**

---

## 5. Test the Explore Flow (Game Client)

1. Open the game frontend and log in
2. Navigate to the building where you added the Explore action (walk to its node)
3. Click the building to open the Building Panel
4. Click **Explore**
5. Observe the combat modal:
   - Monster icon (if uploaded) and name appear
   - Combat rounds stream in one by one (~800 ms apart)
   - Result shows Win/Loss + XP gained + items dropped
6. Close the modal and check the inventory panel for any dropped items
7. Check the chat log / character stats for XP update

---

## 6. Verify No Encounter

1. Set the building's Explore action Encounter Chance = `0` in admin
2. Click Explore in the game — expect a "nothing found" message and no combat modal

---

## 7. Run Tests & Lint

```bash
npm test && npm run lint
```

---

## Key File Locations

| Component | File |
|-----------|------|
| DB migration | `backend/src/db/migrations/011_monster_combat.sql` |
| Monster DB queries | `backend/src/db/queries/monsters.ts` |
| Loot DB queries | `backend/src/db/queries/monster-loot.ts` |
| Combat resolver | `backend/src/game/combat/explore-combat-service.ts` |
| Building action handler | `backend/src/game/world/building-action-handler.ts` |
| Protocol types | `shared/protocol/index.ts` |
| Admin REST: monsters | `admin/backend/src/routes/monsters.ts` |
| Admin UI: monster manager | `admin/frontend/src/ui/monster-manager.ts` |
| Game frontend: combat modal | `frontend/src/ui/CombatModal.ts` |
| Game frontend: building panel | `frontend/src/ui/BuildingPanel.ts` |
