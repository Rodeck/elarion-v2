# Stat Training — Execution Log

**Executed**: 2026-04-03
**Status**: Complete — all entities created

## Created Entity IDs

### Items (15)
| # | Name | Item ID |
|---|------|---------|
| 1 | Barley Beer | 99 |
| 2 | Spiced Wine | 100 |
| 3 | Dwarven Vodka | 101 |
| 4 | Smoked Mudfish | 102 |
| 5 | Cured Silverscale | 103 |
| 6 | Leviathan Jerky | 104 |
| 7 | Raw Quartz | 105 |
| 8 | Polished Amethyst | 106 |
| 9 | Arcane Crystal | 107 |
| 10 | Sinew Oil | 108 |
| 11 | Vipervenom Salve | 109 |
| 12 | Shadowstep Tincture | 110 |
| 13 | Iron Filings | 111 |
| 14 | Tempered Steel Dust | 112 |
| 15 | Mythril Essence | 113 |

### NPCs (3 new + 2 updated)
| NPC | NPC ID | Icon | Action |
|-----|--------|------|--------|
| Bruna the Brewmistress | 12 | default.png | Created, is_crafter=true, trainer_stat=strength |
| Lysara the Sage | 13 | default.png | Created, is_crafter=true, trainer_stat=intelligence |
| Kael the Swift | 14 | default.png | Created, is_crafter=true, trainer_stat=dexterity |
| Harlen the Fisherman | 10 | (existing) | Updated: is_crafter=true, trainer_stat=constitution |
| Torvan the Smith | 7 | (existing) | Updated: trainer_stat=toughness |

### NPC Assignments
| NPC | Building | Status |
|-----|----------|--------|
| Bruna the Brewmistress | Fry'Shtack Coast Town (id 11) | Assigned |
| Lysara the Sage | Mage Tover (id 14) | Assigned |
| Kael the Swift | Farsi Village (id 9) | Assigned |

### Recipes (15)
| Recipe | Recipe ID | NPC |
|--------|-----------|-----|
| Brew Barley Beer | 31 | Bruna (12) |
| Brew Spiced Wine | 32 | Bruna (12) |
| Distill Dwarven Vodka | 33 | Bruna (12) |
| Smoke Mudfish | 34 | Harlen (10) |
| Cure Silverscale | 35 | Harlen (10) |
| Prepare Leviathan Jerky | 36 | Harlen (10) |
| Shape Raw Quartz | 37 | Lysara (13) |
| Polish Amethyst | 38 | Lysara (13) |
| Crystallize Arcane Shard | 39 | Lysara (13) |
| Render Sinew Oil | 40 | Kael (14) |
| Brew Vipervenom Salve | 41 | Kael (14) |
| Distill Shadowstep Tincture | 42 | Kael (14) |
| Grind Iron Filings | 43 | Torvan (7) |
| Temper Steel Dust | 44 | Torvan (7) |
| Extract Mythril Essence | 45 | Torvan (7) |

### Stat Training Mappings (15)
| ID | Item | Stat | Tier | Base Chance | Decay/Level | NPC |
|----|------|------|------|-------------|-------------|-----|
| 1 | Barley Beer | strength | 1 | 95 | 3.0 | Bruna (12) |
| 2 | Spiced Wine | strength | 2 | 95 | 1.5 | Bruna (12) |
| 3 | Dwarven Vodka | strength | 3 | 95 | 0.5 | Bruna (12) |
| 4 | Smoked Mudfish | constitution | 1 | 95 | 3.0 | Harlen (10) |
| 5 | Cured Silverscale | constitution | 2 | 95 | 1.5 | Harlen (10) |
| 6 | Leviathan Jerky | constitution | 3 | 95 | 0.5 | Harlen (10) |
| 7 | Raw Quartz | intelligence | 1 | 95 | 3.0 | Lysara (13) |
| 8 | Polished Amethyst | intelligence | 2 | 95 | 1.5 | Lysara (13) |
| 9 | Arcane Crystal | intelligence | 3 | 95 | 0.5 | Lysara (13) |
| 10 | Sinew Oil | dexterity | 1 | 95 | 3.0 | Kael (14) |
| 11 | Vipervenom Salve | dexterity | 2 | 95 | 1.5 | Kael (14) |
| 12 | Shadowstep Tincture | dexterity | 3 | 95 | 0.5 | Kael (14) |
| 13 | Iron Filings | toughness | 1 | 95 | 3.0 | Torvan (7) |
| 14 | Tempered Steel Dust | toughness | 2 | 95 | 1.5 | Torvan (7) |
| 15 | Mythril Essence | toughness | 3 | 95 | 0.5 | Torvan (7) |

## Errors
None — all operations succeeded.

## Verification
- Items: 72 → 87 (+15)
- NPCs: 11 → 14 (+3)
- Recipes: 30 → 45 (+15)
- Stat training mappings: 0 → 15
- All 5 trainer NPCs have trainer_stat set correctly
- All 3 new NPCs assigned to correct buildings
