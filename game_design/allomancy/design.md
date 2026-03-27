# Metal Economy — Mistborn-Inspired Allomancy Foundation

## Context

The game needs a metal-based resource economy as the foundation for a future Allomancy-style combat system where abilities consume metals. This plan designs the **starting game content** (items, NPCs, recipes, gathering, monsters) — no code changes required, everything is created via the existing admin API and `/game-entities` skill.

The economy creates interdependent player roles:
- **Gatherers** mine ores from various locations
- **Crafters** smelt ores into bars and forge alloys
- **Warriors** buy metals for combat, loot rare materials from bosses that only crafters can use

---

## Metal Tier Design

### Tier 1 — Common (easily gathered)
| Ore | Bar | Notes |
|-----|-----|-------|
| Iron Ore | Iron Bar | Grey, rust-streaked. Most common metal. |
| Copper Ore | Copper Bar | Greenish ore, warm to the touch. |

### Tier 2 — Uncommon (deeper mines, lower drop rates)
| Ore | Bar | Notes |
|-----|-----|-------|
| Zinc Ore | Zinc Bar | Pale bluish-white, found deep underground. |
| Cobalt Ore | Cobalt Bar | Deep blue ore that glows faintly in darkness. |

### Tier 3 — Alloys (crafted from two different bars)
| Alloy | Ingredients | Notes |
|-------|-------------|-------|
| Steel Bar | 2x Iron Bar + 1x Zinc Bar | Strong grey alloy. The warrior's staple. |
| Brass Bar | 2x Copper Bar + 1x Cobalt Bar | Golden alloy with a warm sheen. Powerful when burned. |

### Tier 4 — Rare/Boss (uncraftable, boss-drop only) [FUTURE — not in initial execution]
| Metal | Source | Notes |
|-------|--------|-------|
| Mythril Shard | Ore Golem (20%), boss-only | Crystalline metal that shimmers with pale light. Cannot be smelted. |
| Titanite Dust | Ashvein Lurker (8%), Ore Golem (25%), Cave Troll (3%) | Shimmering dark powder. Hardens any metal beyond natural limits. |

---

## Items to Create (16 total)

### Resources (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | Iron Ore | 50 | A heavy grey ore streaked with rust. The most common metal found in Elarion's mines. |
| 2 | Iron Bar | 50 | A smelted ingot of iron. Sturdy and reliable, the backbone of any forge. |
| 3 | Copper Ore | 50 | Greenish ore with a warm hue. Miners prize it for its malleability. |
| 4 | Copper Bar | 50 | A polished copper ingot, warm to the touch even in winter. |
| 5 | Zinc Ore | 30 | Pale bluish-white ore found deep underground. Brittle until properly refined. |
| 6 | Zinc Bar | 30 | A refined zinc ingot, surprisingly light. Essential for advanced alloys. |
| 7 | Cobalt Ore | 30 | Deep blue ore that glows faintly in darkness. Only found in the deepest shafts. |
| 8 | Cobalt Bar | 30 | A deep blue ingot that pulses with inner heat. Prized by alloy smiths. |
| 9 | Steel Bar | 20 | An alloy of iron and zinc. Strong grey metal with a keen edge. The warrior's staple. |
| 10 | Brass Bar | 20 | An alloy of copper and cobalt. Gleams golden and radiates warmth. Powerful when burned. |
| 11 | Mythril Shard | 10 | A crystalline metal fragment that shimmers with pale light. No forge can smelt it — it must be used as-is. |
| 12 | Titanite Dust | 10 | Shimmering dark powder scraped from the bones of ancient beasts. Hardens any metal beyond natural limits. |
| 13 | Charite | 99 | Dense charcoal compressed from ironwood. Burns hot enough to smelt all common ores. |

### Tools (category: tool)
| # | Name | tool_type | max_durability | power | Description |
|---|------|-----------|---------------|-------|-------------|
| 14 | Worn Pickaxe | pickaxe | 60 | 1 | A battered pickaxe with a chipped head. Barely adequate for surface mining. |
| 15 | Iron Pickaxe | pickaxe | 150 | 2 | A solid pickaxe forged from common iron. Reliable for most mining work. |
| 16 | Steel Pickaxe | pickaxe | 300 | 3 | A pickaxe head forged from steel. Cuts through rock with uncanny ease. |

---

## NPCs to Create (2)

| NPC | Description | is_crafter |
|-----|-------------|------------|
| Magra the Smelter | A broad-shouldered woman who tends the great furnaces near the mine entrance. Her arms are scarred from years of stoking coals. She converts raw ore into refined bars for a modest fee. | true |
| Varn Ashforge | A reclusive master smith who works with rare alloys in a forge that burns unnaturally hot. He speaks of metals as though they were living things and charges handsomely for his expertise. | true |

---

## Crafting Recipes (9 total)

### At Magra the Smelter
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Smelt Iron Bar | 3x Iron Ore + 1x Charite | 1x Iron Bar | 2 | 10s |
| Smelt Copper Bar | 3x Copper Ore + 1x Charite | 1x Copper Bar | 3 | 15s |
| Smelt Zinc Bar | 5x Zinc Ore + 2x Charite | 1x Zinc Bar | 8 | 30s |
| Smelt Cobalt Bar | 5x Cobalt Ore + 2x Charite | 1x Cobalt Bar | 10 | 45s |
| Buy Charite | (no ingredients) | 3x Charite | 5 | 5s |

### At Varn Ashforge
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Forge Steel Bar | 2x Iron Bar + 1x Zinc Bar | 1x Steel Bar | 15 | 60s |
| Forge Brass Bar | 2x Copper Bar + 1x Cobalt Bar | 1x Brass Bar | 20 | 90s |

### At Borin (existing NPC)
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Craft Iron Pickaxe | 3x Iron Bar + 1x Tanned Leather | 1x Iron Pickaxe | 10 | 30s |
| Craft Steel Pickaxe | 2x Steel Bar + 1x Tanned Leather | 1x Steel Pickaxe | 30 | 60s |

---

## Monsters

### Phase 1 — Gather Encounter Monsters (this execution)

| Monster | ATK | DEF | HP | XP | Crowns | Purpose |
|---------|-----|-----|-----|-----|--------|---------|
| Tunnel Crawler | 4 | 2 | 20 | 8 | 1–3 | Spider-like creature in Deep Tunnels (gather encounter) |
| Ashvein Lurker | 8 | 5 | 45 | 20 | 3–8 | Serpentine beast in Ashvein Drift (gather encounter) |

**Tunnel Crawler Loot**: Iron Ore (40%, qty 2), Zinc Ore (15%, qty 1), Worn Pickaxe (5%, qty 1)

**Ashvein Lurker Loot**: Cobalt Ore (30%, qty 2), Zinc Ore (25%, qty 2)

### Phase 2 — Boss Monsters [FUTURE]

| Monster | ATK | DEF | HP | XP | Crowns | Purpose |
|---------|-----|-----|-----|-----|--------|---------|
| Ore Golem | 12 | 8 | 80 | 40 | 5–15 | Boss in the deepest mine (explore action) |

**Ore Golem Loot** (to be added when boss is introduced):
- Mythril Shard (20%, qty 1), Titanite Dust (25%, qty 2), Cobalt Ore (40%, qty 3), Steel Bar (15%, qty 1)

**Ashvein Lurker** will also gain Titanite Dust (8%, qty 1) loot when bosses are introduced.

**Cave Troll** (existing) will gain Titanite Dust (3%, qty 1) loot when bosses are introduced.

---

## Gathering Locations (1 gather action per building)

### Surface Quarry — Quarry (building 13)
- Tool: pickaxe, durability/sec: 1, duration: 10–30s
- Events (weights sum to 100):
  - Iron Ore x2 (35), Copper Ore x2 (20), Zinc Ore x1 (5)
  - Charite x3 (8), Gold 1–3 crowns (10), Nothing (17), Accident 3hp (5)

### Deep Tunnels — Forgotten Mines (building 12)
- Tool: pickaxe, durability/sec: 2, duration: 15–45s
- Events (weights sum to 100):
  - Iron Ore x3 (15), Copper Ore x2 (15), Zinc Ore x2 (15), Cobalt Ore x1 (10)
  - Charite x2 (5), Gold 2–5 crowns (8), Tunnel Crawler encounter (10), Nothing (12), Accident 5hp (10)

### Ashvein Drift — Old Cult (building 16)
- Tool: pickaxe, durability/sec: 3, duration: 20–60s
- Events (weights sum to 100):
  - Zinc Ore x3 (13), Cobalt Ore x2 (15)
  - Iron Ore x4 (5), Copper Ore x3 (5), Gold 3–8 crowns (7)
  - Ashvein Lurker encounter (20), Nothing (15), Accident 8hp (20)

### Building → Action Map
| Building | Zone | Gather Action | NPCs |
|----------|------|---------------|------|
| Quarry (13) | Ulysses Peninsula | Surface Quarry (easy) | Magra the Smelter, Torvan the Smith |
| Forgotten Mines (12) | Ulysses Peninsula | Deep Tunnels (medium) | Varn Ashforge |
| Old Cult (16) | Ulysses Peninsula | Ashvein Drift (hard) | — |

---

## Economy Flow

```
GATHER ──► Raw Ores ──► SMELT (Magra) ──► Bars ──► ALLOY (Varn) ──► Alloy Bars
                                                                        │
                                                                        ▼
                                                              Warriors buy for combat
                                                                        │
                                                                        ▼
                                                              Kill bosses ──► Rare drops
                                                                        │         [FUTURE]
                                                                        ▼
                                                         Mythril Shards / Titanite Dust
                                                      (boss-exclusive, feeds back to crafters)
```

**Cost analysis for 1 Steel Bar**: 6 Iron Ore + 5 Zinc Ore + 4 Charite + 25 crowns + 70s craft time

---

## Execution Plan — Phase 1 (this round)

All content is created via the `game-entities` skill (admin REST API calls). Order matters for FK constraints:

1. **Create all 16 items** — includes Tier 4 items (Mythril Shard, Titanite Dust) as definitions even though they won't drop yet
2. **Create 2 NPCs** (Magra, Varn) and set `is_crafter: true`
3. **Create 2 monsters** (Tunnel Crawler, Ashvein Lurker) — Ore Golem deferred to Phase 2
4. **Add monster loot entries** for Tunnel Crawler and Ashvein Lurker (no Tier 4 drops yet)
5. **Create 9 crafting recipes** with ingredients (requires item IDs + NPC IDs)
6. **Create 3 gathering building actions** on appropriate buildings (requires item IDs + monster IDs)
7. **Assign NPCs to buildings** (Magra → smelting building, Varn → forge building)

**Note**: Steps 6–7 require existing buildings on a map. If no mine/forge buildings exist yet, those must be created first via the map editor or buildings API.

## Execution Plan — Phase 2 (future)

1. **Create Ore Golem** boss monster with full loot table (Mythril Shard, Titanite Dust, Cobalt Ore, Steel Bar)
2. **Add Titanite Dust drops** to Ashvein Lurker (8%) and Cave Troll (3%)
3. **Create explore building action** for boss encounter in the deepest mine
4. **Integrate metal consumption** into the combat/ability system

---

## Testing Walkthrough

All locations are on **Zone 2 — Ulysses Peninsula**.

### Test 1: Basic Gather → Smelt → Alloy (Steel Bar)

1. **Get a pickaxe** — use admin command `/give <player> Wooden Pickaxe` (id 26)
2. **Quarry (building 13)** — select Surface Quarry gather action
   - Gather for 30s (costs 30 durability with Wooden Pickaxe)
   - Collect: Iron Ore (35%), Copper Ore (20%), Zinc Ore (5%), Charite (8%)
   - Repeat until you have **9x Iron Ore**, **5x Zinc Ore**, **4x Charite**
3. **Quarry → Magra the Smelter** — open crafting dialog
   - Craft 3x "Smelt Iron Bar" (9 Iron Ore + 3 Charite → 3 Iron Bar, 6 crowns, 30s)
   - Craft 1x "Smelt Zinc Bar" (5 Zinc Ore + 2 Charite → 1 Zinc Bar, 8 crowns, 30s)
   - Wait → collect bars
4. **Forgotten Mines (building 12) → Varn Ashforge** — open crafting dialog
   - Craft 1x "Forge Steel Bar" (2 Iron Bar + 1 Zinc Bar → 1 Steel Bar, 15 crowns, 60s)
   - Wait → collect **Steel Bar**

**Total cost**: 9 Iron Ore + 5 Zinc Ore + 4 Charite + 29 crowns + ~130s craft time

### Test 2: Craft a Steel Pickaxe

5. Get another Steel Bar (repeat steps 2–4)
6. Get 1x Tanned Leather (from Tessa the Tanner at Farsi Village, or existing inventory)
7. **Travel to Elarion City** (building 8 travel action → zone 1)
8. **Alabaster district → Borin** — craft "Craft Steel Pickaxe" (2 Steel Bar + 1 Tanned Leather, 30 crowns, 60s)
9. Collect **Steel Pickaxe** (dur 300, power 3)

### Test 3: Deep Mining with Combat Encounters

10. **Forgotten Mines (building 12)** — select Deep Tunnels gather action
    - Equip Iron or Steel Pickaxe, gather for 45s
    - 10% chance per tick: **Tunnel Crawler** fight (ATK 4, DEF 2, HP 20)
    - Good source of Zinc Ore (15%) and Cobalt Ore (10%)
    - Verify: combat triggers mid-gather, gathering resumes after win

### Test 4: Dangerous Mining (Ashvein Drift)

11. **Old Cult (building 16)** — select Ashvein Drift gather action
    - Requires good pickaxe (dur/s: 3), gather 20–60s
    - 20% chance per tick: **Ashvein Lurker** fight (ATK 8, DEF 5, HP 45)
    - 20% accident chance (8 HP damage)
    - Best Cobalt Ore source (15%) for Brass Bar crafting
    - Verify: high danger, player can die from accidents + encounters

### Test 5: Brass Bar (Copper path)

12. Gather Copper Ore from Quarry or Forgotten Mines
13. Gather Cobalt Ore from Deep Tunnels or Ashvein Drift
14. **Quarry → Magra** — smelt Copper Bars and Cobalt Bars
15. **Forgotten Mines → Varn** — forge "Forge Brass Bar" (2 Copper Bar + 1 Cobalt Bar, 20 crowns, 90s)

### Verification Checklist

- [ ] Surface Quarry gather works, yields correct ores
- [ ] Deep Tunnels gather works, Tunnel Crawler encounter triggers
- [ ] Ashvein Drift gather works, Ashvein Lurker encounter triggers
- [ ] Magra smelting recipes all work (Iron/Copper/Zinc/Cobalt bars + Charite buy)
- [ ] Varn alloying recipes work (Steel Bar, Brass Bar)
- [ ] Borin pickaxe recipes work (Iron Pickaxe, Steel Pickaxe)
- [ ] Monster loot drops correctly after combat
- [ ] Only one gather action per building (no duplicates)
