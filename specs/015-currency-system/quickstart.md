# Quickstart: Currency System (Crowns)

**Feature**: 015-currency-system
**Date**: 2026-03-11

---

## 1. Apply the Database Migration

```bash
# The migration runs automatically on backend startup via migrate.ts
# File to create: backend/src/db/migrations/017_currency.sql
```

The migration adds:
- `crowns INTEGER NOT NULL DEFAULT 0` to `characters`
- `min_crowns INTEGER NOT NULL DEFAULT 0` and `max_crowns INTEGER NOT NULL DEFAULT 0` to `monsters`

All existing characters start with 0 Crowns. All existing monsters default to 0 Crown drop range.

---

## 2. Test the Crown Balance on Login

1. Start the backend: `npm run dev` (from `backend/`)
2. Start the frontend: `npm run dev` (from `frontend/`)
3. Log in with an existing character
4. Verify the StatsBar in the top bar shows a "CR 0" (or equivalent) field

---

## 3. Configure a Monster to Drop Crowns

Using the admin panel:
1. Open `http://localhost:4001` (admin panel)
2. Go to **Monsters**
3. Edit any monster (e.g., "Cave Rat")
4. Set **Min Crowns** = `5` and **Max Crowns** = `15`
5. Save

---

## 4. Test the Crown Drop

1. In-game, explore a building that can spawn the configured monster
2. Win a combat encounter
3. The explore result message (`building.explore_result`) should include `crowns_gained: N` where N is between 5–15
4. The StatsBar Crown display should increment by N

---

## 5. Test the Admin Command

1. Log in with an admin account (in-game chat)
2. Type: `/crown <YourCharacterName> 500`
3. Verify your Crown balance increases by 500 in the StatsBar
4. Check backend logs for the structured admin event

**Command format**: `/crown <PlayerName> <Amount>`
- `PlayerName`: case-sensitive character name (must be online)
- `Amount`: positive integer

**Error cases**:
- Player not found: `Player 'X' not found.`
- Player offline: `Player 'X' is not currently online.`
- Invalid amount (zero, negative, non-integer): `Amount must be a positive integer.`
- Not admin: command silently ignored (permission gate in chat-handler)

---

## 6. Key Files Reference

| Area | File |
|------|------|
| DB migration | `backend/src/db/migrations/017_currency.sql` |
| Crown award service | `backend/src/game/currency/crown-service.ts` |
| Characters DB query | `backend/src/db/queries/characters.ts` |
| Monsters DB query | `backend/src/db/queries/monsters.ts` |
| Explore combat (loot integration) | `backend/src/game/combat/explore-combat-service.ts` |
| Night encounter (loot integration) | `backend/src/game/world/night-encounter-service.ts` |
| Admin command handler | `backend/src/game/admin/admin-command-handler.ts` |
| Protocol types | `shared/protocol/index.ts` |
| Frontend StatsBar | `frontend/src/ui/StatsBar.ts` |
| Frontend GameScene (message handling) | `frontend/src/scenes/GameScene.ts` |
| Admin backend monster route | `admin/backend/src/routes/monsters.ts` |
| Admin frontend monster manager | `admin/frontend/src/ui/monster-manager.ts` |

---

## 7. Logging

All Crown events are logged as structured JSON by the backend:

```json
// Combat win — from explore-combat-service / night-encounter-service
{ "level": "info", "subsystem": "combat", "event": "crowns_awarded", "characterId": "...", "monsterId": 3, "amount": 12, "newBalance": 312 }

// Admin grant — from admin-command-handler
{ "level": "info", "subsystem": "admin", "event": "admin_command", "command": "crown", "target_player": "Roddeck", "args": { "amount": 1000 }, "success": true }
```
