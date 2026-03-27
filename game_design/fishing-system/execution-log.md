# Fishing System — Execution Log

**Executed**: 2026-03-26
**Status**: Complete — all entities created

## Entity Count Changes

| Entity | Before | After | Delta |
|--------|--------|-------|-------|
| Items | 43 | 69 | +26 |
| NPCs | 9 | 10 | +1 |
| Recipes | 25 | 30 | +5 |
| Quests | 6 | 11 | +5 |
| Rod Tiers | 0 | 5 | +5 |
| Fishing Loot | 0 | 16 | +16 |
| Building Actions | — | +2 | +2 (fishing) |

## Created Entity IDs

### Items — Fishing Rods (tool)
| # | Name | Item ID |
|---|------|---------|
| 1 | Crude Fishing Rod | 70 |
| 2 | Sturdy Fishing Rod | 71 |
| 3 | Reinforced Fishing Rod | 72 |
| 4 | Master Fishing Rod | 73 |
| 5 | Legendary Ashen Rod | 74 |

### Items — Raw Fish (resource)
| # | Name | Item ID |
|---|------|---------|
| 6 | Mudfish | 75 |
| 7 | River Perch | 76 |
| 8 | Silverscale Trout | 77 |
| 9 | Golden Carp | 78 |
| 10 | Ashfin Eel | 79 |
| 11 | Deep Lurker | 80 |
| 12 | Mistscale | 81 |
| 13 | Abyssal Leviathan Fin | 82 |

### Items — Cooked Fish (food)
| # | Name | Item ID |
|---|------|---------|
| 14 | Grilled Mudfish | 83 |
| 15 | Pan-Seared Perch | 84 |
| 16 | Silverscale Fillet | 85 |
| 17 | Ashfin Stew | 86 |
| 18 | Deep Lurker Feast | 87 |

### Items — Rings
| # | Name | Item ID |
|---|------|---------|
| 19 | Copper River Ring | 88 |
| 20 | Silverscale Band | 89 |
| 21 | Ashfin Loop | 90 |
| 22 | Levithans Coil | 91 |

### Items — Amulets
| # | Name | Item ID |
|---|------|---------|
| 23 | Tarnished River Pendant | 92 |
| 24 | Mistscale Amulet | 93 |
| 25 | Deep Current Charm | 94 |
| 26 | Abyssal Talisman | 95 |

### NPCs
| NPC | NPC ID | Icon |
|-----|--------|------|
| Harlen the Fisherman | 10 | placeholder.png |

### Rod Tiers
| Tier | Item ID | Upgrade Pts | Durability | Repair Cost |
|------|---------|-------------|-----------|------------|
| 1 | 70 | 0 | 30 | 10 |
| 2 | 71 | 50 | 50 | 25 |
| 3 | 72 | 100 | 75 | 50 |
| 4 | 73 | 200 | 100 | 100 |
| 5 | 74 | 500 | 150 | 150 |

### Fishing Loot (16 entries)
| Item | Item ID | Min Rod Tier | Weight |
|------|---------|-------------|--------|
| Mudfish | 75 | 1 | 40 |
| River Perch | 76 | 1 | 30 |
| Silverscale Trout | 77 | 2 | 20 |
| Golden Carp | 78 | 3 | 12 |
| Ashfin Eel | 79 | 3 | 12 |
| Deep Lurker | 80 | 4 | 8 |
| Mistscale | 81 | 4 | 8 |
| Abyssal Leviathan Fin | 82 | 5 | 4 |
| Copper River Ring | 88 | 2 | 3 |
| Tarnished River Pendant | 92 | 2 | 3 |
| Silverscale Band | 89 | 3 | 2 |
| Mistscale Amulet | 93 | 3 | 2 |
| Ashfin Loop | 90 | 4 | 1 |
| Deep Current Charm | 94 | 4 | 1 |
| Levithans Coil | 91 | 5 | 1 |
| Abyssal Talisman | 95 | 5 | 1 |

### Recipes
| Recipe | NPC | Output | Crowns | Time |
|--------|-----|--------|--------|------|
| Grill Mudfish | Old Marinus (4) | 2x Grilled Mudfish | 2 | 10s |
| Sear Perch | Old Marinus (4) | 2x Pan-Seared Perch | 3 | 15s |
| Fillet Silverscale | Old Marinus (4) | 1x Silverscale Fillet | 8 | 20s |
| Brew Ashfin Stew | Old Marinus (4) | 1x Ashfin Stew | 15 | 30s |
| Prepare Deep Lurker Feast | Old Marinus (4) | 1x Deep Lurker Feast | 30 | 45s |

### Building Actions
| Building | Zone | Action Type | Action ID |
|----------|------|-------------|-----------|
| Docs (4) | Elarion City (1) | fishing | 22 |
| Fry'Shtack Coast Town (11) | Ulysses Peninsula (2) | fishing | 23 |

### NPC Assignments
| NPC | Building | Status |
|-----|----------|--------|
| Harlen the Fisherman (10) | Docs (4, zone 1) | Assigned |

### Quests
| Quest | Quest ID | Type | Rewards |
|-------|----------|------|---------|
| River Bounty | 10 | daily | 10 rod pts, 5 crowns, 15 xp |
| Silver Haul | 11 | daily | 20 rod pts, 10 crowns, 25 xp |
| The Elusive Carp | 12 | daily | 35 rod pts, 20 crowns, 40 xp |
| Deep Water Challenge | 13 | daily | 30 rod pts, 15 crowns, 35 xp |
| Bounty of the Deep | 14 | weekly | 75 rod pts, 50 crowns, 100 xp |

## Fixes Applied During Execution

1. **admin/backend/src/routes/items.ts**: Added `'ring'`, `'amulet'` to `VALID_CATEGORIES` and `DEFENCE_CATEGORIES`
2. **admin/backend/src/routes/items.ts**: Added `'fishing_rod'` to `VALID_TOOL_TYPES`
3. **admin/backend/src/routes/buildings.ts**: Added `'fishing_rod'` to tool type validation
4. **admin/frontend/src/ui/properties.ts**: Added `'fishing_rod'` option to tool type dropdown
5. **admin/frontend/src/ui/item-manager.ts**: Added `'fishing_rod'` option to tool type dropdown
6. **scripts/game-entities.js**: Added `'ring'`, `'amulet'` to `DEFENCE_CATEGORIES`
7. **scripts/game-entities.js**: Fixed fishing/rod-tier commands: replaced undefined `success()`/`fail()` with `output()`, added `authenticate()` calls, added `apiDelete()` function
8. **DB constraint**: Added `'rod_upgrade_points'` to `quest_rewards.reward_type` CHECK constraint

## Pending Items

- **Ring/amulet combat stats**: Secondary stats (dodge_chance, crit_chance, mana_regen, etc.) not set — admin API doesn't pass these fields through on create. Need manual DB update or admin API extension.
- **NPC icon**: Harlen uses placeholder.png — generate and upload real portrait.
- **Item icons**: All 26 items have no icons — generate spritesheet and upload via admin panel.
- **Rod upgrade crown costs**: The `fishing_rod_tiers` table has no `upgrade_crown_cost` column. Upgrade costs (75/200/500/1000 crowns) need backend implementation.
