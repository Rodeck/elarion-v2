# Boss Encounter System — Quickstart

## What This Feature Does

Adds persistent world bosses that guard buildings. When a boss is alive, the building it guards is locked — no one can explore, gather, craft, or do anything there. Players challenge bosses with Boss Challenge Tokens, fight them in a combat variant with hidden HP and boss abilities, and unlock the building when the boss is defeated. Bosses respawn after a configurable timer.

## Integration Points

### Existing Systems Modified
1. **Building action handler** — Add boss-blocking guard check before all action dispatch
2. **Shared protocol** — Add boss DTOs and message types to the union types
3. **CombatScreen (frontend)** — Add boss variant: hidden HP bar, bracket indicator
4. **GameScene (frontend)** — Render boss sprites on map, handle boss click
5. **Zone state payload** — Include boss data when player enters zone
6. **game-data.js / game-entities.js** — Add boss query and CRUD commands
7. **CLAUDE.md** — Add "Adding a Boss" checklist

### New Systems Created
1. **Boss DB tables** — `bosses`, `boss_abilities`, `boss_loot`, `boss_instances`
2. **Boss instance manager** — Lifecycle: spawn, lock, HP persist, defeat, respawn
3. **Boss combat handler** — Combat variant using CombatEngine with hidden HP
4. **Boss info panel** — Frontend UI for viewing boss status and challenging
5. **Admin boss routes** — REST CRUD for boss definitions, abilities, loot, instances
6. **Admin boss manager** — Frontend UI for creating and managing bosses

## Key Development Sequence

```
1. DB migration (tables)
2. Shared protocol types (DTOs, message types)
3. Boss DB queries
4. Boss instance manager (spawn/despawn/respawn)
5. Building action blocking (hook into existing handler)
6. Boss combat handler (reuses CombatEngine)
7. Zone state boss data (backend sends boss list on zone enter)
8. Frontend: BossSprite + BossInfoPanel + CombatScreen variant
9. Admin: routes + UI
10. Tooling: game-data.js + game-entities.js + CLAUDE.md
```

## How to Test

1. Run DB migration
2. Start admin backend, create a boss via admin panel (assign to a building)
3. Start game backend + frontend
4. Navigate to the building — should be blocked
5. Give character a Boss Challenge Token via admin
6. Challenge the boss — combat should start with hidden HP
7. Win or lose — verify HP persistence, respawn timer, building unlock
