# Metal Economy (Allomancy Foundation)

## Design Goal
Create a metal-based resource economy as the foundation for a future Allomancy-style combat system where abilities consume metals. The economy creates interdependent player roles: gatherers mine ores, crafters smelt and forge alloys, warriors buy metals for combat.

## Core Fantasy
Mistborn-inspired metal system where different metals have distinct properties and uses. Mining, smelting, and alloying feel like a real metallurgical craft — not just "combine 3 of X to get Y."

## Game Systems Touched
- **Combat**: Foundation for future Allomancy abilities that consume metals
- **Economy**: Core material economy — ores, bars, alloys, crowns flow
- **Progression**: Tool progression (Worn → Iron → Steel pickaxe), tier-gated gathering
- **World/Zones**: Three mining locations across Ulysses Peninsula with escalating difficulty
- **Social/Quests**: Not involved in Phase 1
- **Crafting**: 9 recipes across 3 NPCs (smelting, alloying, tool crafting)
- **Gathering**: 3 new gathering actions with weighted event tables and monster encounters

## Content Scope Estimate
| Entity Type | Estimated Count | Notes |
|-------------|----------------|-------|
| Items | 16 | 4 ores, 4 bars, 2 alloys, 2 rare metals, 1 fuel, 3 tools |
| NPCs | 2 | Magra the Smelter (crafter), Varn Ashforge (crafter) |
| Monsters | 2 (Phase 1), 1 (Phase 2) | Tunnel Crawler, Ashvein Lurker; Ore Golem (boss, future) |
| Recipes | 9 | 5 smelting, 2 alloying, 2 tool crafting |
| Abilities | 0 | Deferred to combat system rework |
| Quests | 0 | Not in scope |
| Gathering Actions | 3 | Surface Quarry, Deep Tunnels, Ashvein Drift |
| Building Actions | 0 | Gathering actions go on existing buildings |

## Player Loop
1. Player acquires a pickaxe (bought or crafted)
2. Travels to a mining location and gathers ores (risking encounters and accidents)
3. Takes raw ores to Magra the Smelter, pays crowns to smelt into bars
4. Takes bars to Varn Ashforge, pays more crowns to forge alloys
5. Uses alloy bars for combat abilities (future) or sells surplus on marketplace
6. Better pickaxes unlock harder mining locations with rarer ores

## Tier/Progression Sketch
| Tier | Theme | Access | Key Content |
|------|-------|--------|-------------|
| T1 | Common metals | Surface Quarry (easy) | Iron Ore, Copper Ore → Iron/Copper Bars |
| T2 | Uncommon metals | Deep Tunnels (medium), requires decent pickaxe | Zinc Ore, Cobalt Ore → Zinc/Cobalt Bars |
| T3 | Alloys | Varn Ashforge (crafting) | Steel Bar (Iron+Zinc), Brass Bar (Copper+Cobalt) |
| T4 | Rare/Boss drops | Boss encounters (future Phase 2) | Mythril Shard, Titanite Dust — uncraftable |

## Dependencies
- Requires: Buildings 12 (Forgotten Mines), 13 (Quarry), 16 (Old Cult) on Ulysses Peninsula
- Requires: Existing NPC Borin for tool crafting recipes
- Builds on: Existing gathering system, crafting system, combat encounter system

## Open Questions
- [x] What buildings exist for mining locations? → Resolved: buildings 12, 13, 16 on zone 2
- [x] Does Borin already have recipes? → Yes, tool recipes at Borin are standard
- [ ] When will the Allomancy combat system use these metals? → Phase 2, future design
