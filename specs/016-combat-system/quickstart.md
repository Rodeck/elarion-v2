# Quickstart: Combat System

**Branch**: `016-combat-system`

## Prerequisites

- Existing Elarion dev environment running (backend, frontend, admin, PostgreSQL 16)
- Node.js 20 LTS

## Setup Steps

### 1. Run the migration

```bash
# From repo root
cd backend
npm run migrate
# Runs 018_combat_system.sql — creates abilities/loadouts tables,
# adds mana stats to item_definitions, seeds 9 default abilities
```

### 2. Verify default abilities exist

```bash
psql $DATABASE_URL -c "SELECT id, name, effect_type, mana_cost FROM abilities ORDER BY id;"
# Should return 9 rows: Power Strike, Mend, Iron Skin, Venom Edge,
# Battle Cry, Shatter, Execute, Reflect, Drain Life
```

### 3. Assign an ability to a monster's loot table (optional, for drop testing)

Via admin panel → Monsters → select a monster → Ability Loot tab → Add ability with a drop chance.

Or directly in the DB:

```sql
INSERT INTO monster_ability_loot (monster_id, ability_id, drop_chance)
VALUES (1, 1, 100);  -- monster 1 always drops Power Strike
```

### 4. Give a character a starting ability (for loadout testing)

```sql
INSERT INTO character_owned_abilities (character_id, ability_id)
SELECT id, 1 FROM characters LIMIT 1;
-- Grants Power Strike to the first character
```

### 5. Start the backend and frontend

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev

# Terminal 3 — admin (optional, for ability config)
cd admin/backend && npm run dev
cd admin/frontend && npm run dev
```

## Smoke Test Checklist

### Loadout Panel
- [ ] Open character panel → "Loadouts" tab is visible
- [ ] Owned abilities appear in the ability list
- [ ] Assign an ability to auto slot 1 → slot shows ability name and mana cost
- [ ] Set priority to 2 → saved and reflected on reopen
- [ ] Assign ability to active slot → visible as active ability button placeholder

### Combat Flow
- [ ] Navigate to an explore location → click Explore
- [ ] Encounter triggers → combat screen opens (Pokemon-style layout, both placeholders visible)
- [ ] HP bars and mana bar render with correct starting values
- [ ] Turn timer countdown visible on active ability button
- [ ] Mana bar fills turn-by-turn as auto-attacks land
- [ ] Auto-ability fires when mana threshold reached → combat log shows ability name and effect
- [ ] Active ability button becomes available (not greyed) when mana ≥ cost
- [ ] Click active ability → fires, mana drains, cooldown timer appears
- [ ] Combat ends → win/loss screen shows XP and any loot
- [ ] Ability drop appears in loot if configured

### Loadout Locked During Combat
- [ ] Start a combat → open Loadouts tab → slots are read-only → message shown

### Admin — Ability Configuration
- [ ] Admin panel → Abilities → all 9 defaults listed
- [ ] Edit mana cost of Power Strike → save → start a new combat → mana cost matches
- [ ] Upload an icon → icon visible on ability in loadout panel

## Key Files

| Area | File |
|------|------|
| Migration | `backend/src/db/migrations/018_combat_system.sql` |
| Combat engine | `backend/src/game/combat/combat-engine.ts` |
| Session manager | `backend/src/game/combat/combat-session-manager.ts` |
| WS handlers | `backend/src/websocket/dispatcher.ts` |
| Shared protocol | `shared/protocol/index.ts` |
| Loadout panel | `frontend/src/ui/LoadoutPanel.ts` |
| Combat screen | `frontend/src/ui/CombatScreen.ts` |
| Left panel tabs | `frontend/src/ui/LeftPanel.ts` |
| Admin abilities | `admin/backend/src/routes/abilities.ts` |

## Troubleshooting

**Combat screen doesn't open after explore**: Check browser console for `combat:start` WebSocket message. Check backend logs for `combat_session_started` log entry.

**Abilities not firing**: Verify the character has a loadout configured (`SELECT * FROM character_loadouts WHERE character_id = '...'`) and the ability `mana_cost` is reachable given the character's equipment stats.

**Loadout update rejected with `in_combat`**: The character's `in_combat` flag is stuck. Either wait for the combat session to time out, or manually reset: `UPDATE characters SET in_combat = false WHERE id = '...'`.
