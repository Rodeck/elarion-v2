# Quickstart: Weapon Attributes

**Feature**: 033-weapon-attributes | **Date**: 2026-04-03

## Overview

Add three weapon attributes (crit chance, armor penetration, additional attacks) to items. Wire through admin UI → database → combat engine → game UI.

## Implementation Order

1. **Database** — Migration 037: add `armor_penetration`, `additional_attacks` columns to `item_definitions`
2. **Shared protocol** — Extend `DerivedCombatStats`, `ItemDefinitionDto`, `CharacterData` with new fields
3. **Backend stat aggregation** — Extend `computeCombatStats()` to sum new stats from equipped items
4. **Backend combat engine** — Apply armor pen in damage calc, add bonus hits at combat start
5. **Backend world state** — Send new stats in `world.state` message
6. **Admin backend** — Accept and validate new fields in item create/update routes
7. **Admin frontend** — Add input fields to item modal, add stat pills to item list
8. **Game frontend** — Display new stats in StatsBar expanded panel and item tooltips
9. **Tooling** — Update scripts (`game-data.js`, `game-entities.js`) and documentation

## Key Files

| Layer | File | Change |
|-------|------|--------|
| DB | `backend/src/db/migrations/037_weapon_attributes.sql` | New migration |
| Shared | `shared/protocol/index.ts` | Extend 3 interfaces |
| Backend | `backend/src/game/combat/combat-stats-service.ts` | Aggregate 2 new stats |
| Backend | `backend/src/game/combat/combat-engine.ts` | Armor pen in damage, DerivedCombatStats interface |
| Backend | `backend/src/game/combat/combat-session.ts` | Bonus hits at combat start |
| Backend | `backend/src/game/boss/boss-combat-handler.ts` | Bonus hits at combat start |
| Backend | `backend/src/game/arena/arena-combat-handler.ts` | Bonus hits at combat start |
| Backend | `backend/src/db/queries/inventory.ts` | Add columns to SELECT |
| Backend | `backend/src/websocket/handlers/world-state-handler.ts` | Send new stats |
| Admin BE | `admin/backend/src/routes/items.ts` | Validate + persist new fields |
| Admin FE | `admin/frontend/src/ui/item-modal.ts` | 3 new input fields |
| Admin FE | `admin/frontend/src/ui/item-manager.ts` | 3 new stat pills |
| Admin FE | `admin/frontend/src/editor/api.ts` | Extend response type |
| Game FE | `frontend/src/ui/StatsBar.ts` | Show armor pen, additional attacks |
| Scripts | `scripts/game-data.js`, `scripts/game-entities.js` | New fields support |

## Testing

1. Create an item in admin with armor_penetration=10, additional_attacks=2, crit_chance=5
2. Equip the item on a character
3. Verify StatsBar shows all three values
4. Enter combat — verify 2 bonus hits at start, 10% defence reduction on damage
5. Test with multiple equipped items — verify additive stacking
6. Test caps — armor pen 100% should mean 0 effective defence
