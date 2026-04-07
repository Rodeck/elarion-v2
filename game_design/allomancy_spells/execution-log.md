# Allomantic Spells — Execution Log

**Executed**: 2026-04-07
**Status**: Complete — all entities created

## Pre-execution Cleanup
- Deleted test spell "Haste" (id 1) — movement_speed, unbalanced values
- Deleted test spell "Hammer of The Second" (id 2) — crit_chance_pct, unbalanced values

## Code Changes Made
- `admin/backend/src/routes/items.ts`: Added `spell_book_spell` to `VALID_CATEGORIES` and `STACKABLE_CATEGORIES`; added `spell_id` to create/update/format handlers
- `backend/src/db/queries/inventory.ts`: Added `spell_id` to `ItemDefinition`, `CreateItemDefinitionData`, `UpdateItemDefinitionData` interfaces and INSERT query

## Created Entity IDs

### Items
| # | Name | Item ID | Category |
|---|------|---------|----------|
| 1 | Pewter Bar | 208 | resource |
| 2 | Tome of Iron's Wrath | 210 | spell_book_spell (spell_id: 3) |
| 3 | Tome of Coppershield | 211 | spell_book_spell (spell_id: 4) |
| 4 | Tome of Zinc Sight | 212 | spell_book_spell (spell_id: 5) |
| 5 | Tome of Cobalt Ruin | 213 | spell_book_spell (spell_id: 6) |
| 6 | Tome of Steel Push | 214 | spell_book_spell (spell_id: 7) |
| 7 | Tome of Brass Mending | 215 | spell_book_spell (spell_id: 8) |
| 8 | Tome of Pewter Surge | 216 | spell_book_spell (spell_id: 9) |

### Spells
| # | Name | Spell ID | Effect Type |
|---|------|----------|-------------|
| 1 | Iron's Wrath | 3 | attack_pct |
| 2 | Coppershield | 4 | defence_pct |
| 3 | Zinc Sight | 5 | crit_chance_pct |
| 4 | Cobalt Ruin | 6 | crit_damage_pct |
| 5 | Steel Push | 7 | movement_speed |
| 6 | Brass Mending | 8 | heal |
| 7 | Pewter Surge | 9 | energy |

### Spell Levels (5 levels each, all 7 spells = 35 total)
All levels configured with scaling effect_value, duration_seconds, and gold_cost.

### Spell Costs (5 levels each, all 7 spells = 35 total)
Each level consumes the spell's corresponding metal bar (scaling quantity).

### NPCs
| NPC | NPC ID | Icon |
|-----|--------|------|
| Elara the Inscriber | 15 | placeholder (12a98f83-d466-447f-88a2-8e428b293fc4.png) |

### NPC Assignments
| NPC | Building | Status |
|-----|----------|--------|
| Elara the Inscriber | Forgotten Mines (12, zone 2) | Assigned |

### Recipes
| # | Recipe | Recipe ID | NPC |
|---|--------|-----------|-----|
| 1 | Forge Pewter Bar | 72 | Varn Ashforge |
| 2 | Inscribe Iron's Wrath | 73 | Elara the Inscriber |
| 3 | Inscribe Coppershield | 74 | Elara the Inscriber |
| 4 | Inscribe Zinc Sight | 75 | Elara the Inscriber |
| 5 | Inscribe Cobalt Ruin | 76 | Elara the Inscriber |
| 6 | Inscribe Steel Push | 77 | Elara the Inscriber |
| 7 | Inscribe Brass Mending | 78 | Elara the Inscriber |
| 8 | Inscribe Pewter Surge | 79 | Elara the Inscriber |

## Errors
None.

## Verification
- Overview: 169 items (+8), 15 NPCs (+1), 53 recipes (+8), 7 spells (was 2 test → now 7 proper)
- All 7 spell tomes have correct spell_id linkage confirmed via API
- All spell levels and costs verified via `game-data.js spells`
- Elara assigned to Forgotten Mines building 12

## Remaining
- NPC icon: Elara uses a placeholder icon — generate proper icon via `/gd.prompts`
- Spell icons: All 7 spells have no icons yet — generate via `/gd.prompts`
