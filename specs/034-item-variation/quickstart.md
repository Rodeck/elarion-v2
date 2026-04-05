# Quickstart: Item Bonus Variation

**Feature**: 034-item-variation | **Date**: 2026-04-05

## What This Feature Does

Adds random stat variation to weapons and armor. Every time a player receives an equippable item, its stats are randomly rolled:

- **Daggers**: crit_chance rolled 0 to base (weighted low)
- **Bows**: additional_attacks rolled 0 to base (weighted low)
- **Staves**: armor_penetration rolled 0 to base (weighted low)
- **Wands**: mana stats rolled 0 to base (weighted low)
- **1H/2H weapons**: attack gets +0% to +20% bonus (weighted low)
- **Armor**: defence gets +0% to +20% bonus (weighted low)

Items display a quality tier (Poor/Common/Fine/Superior) with color-coded stats.

## Key Files to Modify

### Backend (7 files)

| File | Change |
|------|--------|
| `backend/src/db/migrations/038_item_variation.sql` | **NEW** — Add instance stat columns to `inventory_items` and `marketplace_listings` |
| `backend/src/game/inventory/item-roll-service.ts` | **NEW** — Randomization logic, quality tier computation |
| `backend/src/game/inventory/inventory-grant-service.ts` | Call roll service, pass instance stats to INSERT |
| `backend/src/db/queries/inventory.ts` | INSERT with instance columns, SELECT with COALESCE |
| `backend/src/db/queries/equipment.ts` | buildInventorySlotDto reads instance columns |
| `backend/src/game/combat/combat-stats-service.ts` | Read COALESCE'd stats from instance/definition |
| `backend/src/game/marketplace/marketplace-service.ts` | Store/restore instance stats through listings |

### Shared (1 file)

| File | Change |
|------|--------|
| `shared/protocol/index.ts` | Add instance stat fields + quality tier to InventorySlotDto |

### Frontend (2 files)

| File | Change |
|------|--------|
| `frontend/src/ui/InventoryPanel.ts` | Display instance stats with quality colors/labels |
| `frontend/src/ui/EquipmentPanel.ts` | Display instance stats with quality colors/labels |

### Tooling (2 files)

| File | Change |
|------|--------|
| `scripts/game-data.js` | Show instance stats in inventory queries |
| `CLAUDE.md` | No new checklist needed — variation is transparent |

## Implementation Order

1. **Migration** — Add columns (no code depends on them yet)
2. **Roll service** — New file, standalone logic, easy to test
3. **Grant service + inventory queries** — Wire roll service into grant flow
4. **Combat stats** — Read instance values
5. **Shared protocol** — Update DTO
6. **Frontend display** — Show instance stats with colors
7. **Marketplace** — Preserve stats through trade
8. **Tooling** — Update game-data.js

## Testing Strategy

1. Use `/admin grant` to give items repeatedly — verify stat variation in inventory
2. Equip items with known rolls — verify combat stats reflect instance values
3. List item on marketplace → buy → verify stats preserved
4. Check existing items still work (NULL instance columns → definition fallback)

## Randomization Formula

```typescript
// Weighted toward lower values (~30% average of max)
function weightedRoll(max: number): number {
  return Math.floor(max * (1 - Math.random() ** 2));
}

// Quality tier from roll percentage
function qualityTier(rollPct: number): 1 | 2 | 3 | 4 {
  if (rollPct <= 0.25) return 1;  // Poor
  if (rollPct <= 0.50) return 2;  // Common
  if (rollPct <= 0.75) return 3;  // Fine
  return 4;                        // Superior
}
```
