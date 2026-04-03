# Stat Training Recipe Chains — Comprehensive Redesign

## Problem Statement

The current stat training recipes are flat and implausible:
- Barley Beer is brewed from **Flax** (not grain) and water — nonsensical
- Spiced Wine uses Herb and Flax — no grapes, no fermentation vessel
- Sinew Oil is just Animal Skin + Herb — too simple for a training consumable
- No intermediate crafting materials exist — every recipe is a single step from raw resources
- T2/T3 items are barely harder than T1 — the difficulty curve is almost flat
- The 6 lootless arena monsters (Pit Brawler through Arena Champion) have nothing to drop

This redesign introduces **20 new intermediate resource items**, assigns **meaningful loot drops** to all lootless monsters, and creates **multi-step crafting chains** where higher tiers demand increasingly complex material pipelines.

---

## Design Principles

1. **Thematic coherence** — Beer needs grain and a vessel. Wine needs fruit. Salves need venom from actual venomous creatures.
2. **Shared intermediates** — Glass Bottle, Coarse Salt, and Clay Crucible appear in multiple stat lines, creating cross-line material demand.
3. **Progressive difficulty** — T1: 1-2 craft steps from common drops. T2: 2-3 steps with uncommon drops. T3: 3-4 steps with rare drops and T1/T2 as ingredients.
4. **Monster ecosystem** — Every lootless monster gets 1-3 drops that feed into the crafting system. Existing weak monsters get supplementary drops.
5. **NPC specialization** — Intermediate steps route through existing crafters (Magra smelts glass, Greta grows grain, Old Marinus processes food) before final assembly at the trainer NPC.

---

## 1. New Items to Create (20 intermediate resources)

All items are `category: resource`, stackable.

### Shared Intermediates (used across multiple stat lines)

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | **Glass Bottle** | 10 | A crude bottle blown from sand and charite. Holds liquids without leaking — mostly. |
| 2 | **Coarse Salt** | 20 | Rough grey salt scraped from coastal stone. Bitter and gritty, but it preserves anything. |
| 3 | **Clay Crucible** | 10 | A thick-walled ceramic pot fired in a kiln. Withstands extreme heat for smelting and distillation. |

### Strength Line — Brewing Intermediates

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 4 | **Barley Grain** | 20 | Pale golden grain harvested from hardy barley stalks. The foundation of any honest brew. |
| 5 | **Malt Extract** | 10 | A thick, sticky syrup made by soaking barley in water and draining off the sweet liquor. Smells of wet bread. |
| 6 | **Wild Grapes** | 20 | Small, tart grapes that grow in tangled clusters on forest vines. More sour than sweet, but they ferment fiercely. |
| 7 | **Juniper Berries** | 20 | Dusty blue-black berries with a sharp, resinous bite. Used to flavor spirits and ward off illness. |

### Constitution Line — Preservation Intermediates

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 8 | **Smoking Rack** | 5 | A crude wooden frame strung with iron wire. Holds fish over coals for slow smoking. Reusable, but fragile. |
| 9 | **Curing Brine** | 10 | A pungent solution of salt, water, and crushed herbs. Draws moisture from flesh and hardens it for storage. |

### Intelligence Line — Mineral Intermediates

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 10 | **Quartz Shard** | 20 | A jagged fragment of raw quartz, cloudy white with hairline fractures. Common in rocky soil. |
| 11 | **Arcane Dust** | 20 | Fine, faintly luminous powder scraped from surfaces where dark rituals were performed. Tingles against the skin. |
| 12 | **Amethyst Cluster** | 10 | A rough cluster of violet crystals embedded in grey matrix stone. Must be separated and cut before use. |

### Dexterity Line — Alchemy Intermediates

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 13 | **Glass Vial** | 10 | A small stoppered vial of thin glass. Holds a single dose of tincture or oil. |
| 14 | **Viper Fang** | 20 | A curved, hollow fang pulled from a dead serpent. Still glistens with residual venom at the tip. |
| 15 | **Spider Silk Thread** | 20 | Thin, incredibly strong thread harvested from spider webs. Used to bind poultices and filter liquids. |
| 16 | **Nightbloom Petal** | 10 | A black-veined petal from a flower that blooms only in darkness. Dissolves into an oily, numbing liquid when crushed. |

### Toughness Line — Metallurgy Intermediates

| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 17 | **Iron Grit** | 20 | Coarse iron fragments ground between millstones. Too rough for forging, but useful as an abrasive or supplement. |
| 18 | **Ite Salt** | 10 | A crystalline mineral salt extracted from deep ore veins. Reacts violently with heat, binding metals at the molecular level. |
| 19 | **Tempered Alloy Paste** | 10 | A dense grey paste of pulverized steel, ite salt, and rendered fat. Applied to skin, it slowly hardens the body's outer layer. |
| 20 | **Warbrace Tonic Base** | 10 | A viscous liquid made from boiled leather scraps and iron grit. The carrier fluid for metallic body-hardening compounds. |

---

## 2. Monster Loot Drops to Add

### Previously Lootless Monsters — New Drops

| Monster (ID) | Item | Drop Chance | Qty | Rationale |
|-------------|------|-------------|-----|-----------|
| Pit Brawler (16) | Iron Grit | 35% | 2 | Arena fighters shed iron filings from battered armor |
| Pit Brawler (16) | Coarse Salt | 25% | 1 | Fighters carry salt to treat wounds |
| Pit Brawler (16) | Animal Skin | 20% | 1 | Leather wrappings |
| Duellist (18) | Viper Fang | 30% | 1 | Duellists coat blades with venom |
| Duellist (18) | Juniper Berries | 20% | 2 | Carried as a stimulant before bouts |
| Duellist (18) | Glass Vial | 15% | 1 | Poison vials on their belt |
| Sellsword (17) | Wild Grapes | 30% | 2 | Mercenaries carry field rations including foraged fruit |
| Sellsword (17) | Coarse Salt | 25% | 2 | Preserving supplies for travel |
| Sellsword (17) | Barley Grain | 20% | 3 | Trail rations |
| Shieldwall Veteran (19) | Ite Salt | 25% | 1 | Veterans carry metallurgical supplies for field repairs |
| Shieldwall Veteran (19) | Iron Grit | 30% | 3 | Ground from their heavy armor |
| Shieldwall Veteran (19) | Clay Crucible | 15% | 1 | Field smelting equipment |
| Reaver Captain (20) | Nightbloom Petal | 20% | 1 | Raiders use nightbloom as a combat drug |
| Reaver Captain (20) | Amethyst Cluster | 15% | 1 | Looted treasure |
| Reaver Captain (20) | Wild Grapes | 25% | 3 | Plundered wine stocks |
| Reaver Captain (20) | Coarse Salt | 20% | 2 | Naval supplies |
| Arena Champion (21) | Nightbloom Petal | 25% | 2 | The champion's personal stash |
| Arena Champion (21) | Ite Salt | 20% | 2 | Rare metallurgical knowledge |
| Arena Champion (21) | Amethyst Cluster | 15% | 1 | Trophy collection |
| Arena Champion (21) | Viper Fang | 20% | 2 | Poisoned weapons |

### Existing Monsters — Supplementary Drops

| Monster (ID) | Item | Drop Chance | Qty | Rationale |
|-------------|------|-------------|-----|-----------|
| Forest Spider (8) | Spider Silk Thread | 40% | 2 | Spiders produce silk — obvious source |
| Forest Spider (8) | Viper Fang | 15% | 1 | Some forest spiders have venomous fangs |
| Cultist Shade (12) | Arcane Dust | 35% | 2 | Shades leave arcane residue |
| Cultist Shade (12) | Quartz Shard | 20% | 1 | Cultists use crystals in rituals |
| Wild Dog (1) | Barley Grain | 10% | 1 | Scavenged from farm fields |
| Cave Rat (2) | Coarse Salt | 15% | 1 | Cave mineral deposits on their fur |
| Field Mouse (5) | Barley Grain | 25% | 2 | Mice eat grain — they carry it in their cheeks |
| Bandit Scout (9) | Juniper Berries | 20% | 2 | Bandits forage from the wild |
| Bandit Scout (9) | Wild Grapes | 15% | 1 | Foraged fruit |
| Mud Crab (7) | Coarse Salt | 30% | 2 | Coastal creatures encrusted with sea salt |
| Mud Crab (7) | Quartz Shard | 10% | 1 | Embedded in their shell |
| Stone Golem (13) | Quartz Shard | 30% | 2 | Quartz veins run through their stone bodies |
| Stone Golem (13) | Amethyst Cluster | 8% | 1 | Rare crystalline deposits inside golems |
| Mine Crawler (11) | Ite Salt | 10% | 1 | Deep mine mineral deposits |
| Mine Crawler (11) | Quartz Shard | 15% | 1 | Tunnel mineral fragments |
| Ashvein Lurker (15) | Ite Salt | 20% | 1 | Deep vein creatures carry rare minerals |

---

## 3. Crafting Recipes — Organized by NPC

### Recipes DELETED (replaced by new chains)

The following **existing recipes** (IDs 31-45) should be deleted and replaced by the new versions below. The output items (IDs 99-113) remain the same — only the recipe ingredients change.

| Old Recipe ID | Old Name | Problem |
|---|---|---|
| 31 | Brew Barley Beer | Uses Flax instead of grain |
| 32 | Brew Spiced Wine | Uses Flax — no grapes or vessel |
| 33 | Distill Dwarven Vodka | Too simple for T3 |
| 34 | Smoke Mudfish | Too simple — just fish + wood |
| 35 | Cure Silverscale | Lacks salt or proper preservation |
| 36 | Prepare Leviathan Jerky | Missing curing process |
| 37 | Shape Raw Quartz | Too simple — just stone + charite |
| 38 | Polish Amethyst | Lacks proper mineral input |
| 39 | Crystallize Arcane Shard | Needs arcane dust from cultists |
| 40 | Render Sinew Oil | Too simple, no vessel |
| 41 | Brew Vipervenom Salve | Missing actual venom source |
| 42 | Distill Shadowstep Tincture | Missing proper alchemy chain |
| 43 | Grind Iron Filings | Too simple |
| 44 | Temper Steel Dust | Missing metallurgical intermediates |
| 45 | Extract Mythril Essence | Too simple for T3 |

---

### Magra the Smelter (NPC 8) — Shared Intermediates

Magra already smelts metals. She now also produces glass and ite salt from raw minerals.

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| Blow Glass Bottle | Stone x3, Charite x2 | Glass Bottle | 2 | 5 | 15s |
| Blow Glass Vial | Glass Bottle x1, Charite x1 | Glass Vial | 3 | 3 | 10s |
| Fire Clay Crucible | Stone x5, Iron Ore x1, Charite x3 | Clay Crucible | 1 | 8 | 25s |
| Extract Ite Salt | Cobalt Ore x3, Zinc Ore x2, Charite x2 | Ite Salt | 1 | 12 | 30s |

### Greta the Farmer (NPC 5) — Growing Intermediates

Greta already grows Flax. She now grows Barley from seeds (Barley Grain from monster drops acts as both a harvestable and a drop).

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| Harvest Wild Grapes | Herb x2, Water Wineskin x1 | Wild Grapes | 4 | 3 | 20s |

*Note: Wild Grapes also drop from Sellsword and Reaver Captain. Greta provides a farmable alternative using herbs as vine-tending labor.*

### Old Marinus (NPC 4) — Food Processing Intermediates

Old Marinus already cooks fish. He now also handles salt extraction and malt preparation.

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| Evaporate Coarse Salt | Water Wineskin x2, Stone x2 | Coarse Salt | 3 | 3 | 15s |
| Steep Malt Extract | Barley Grain x4, Water Wineskin x1 | Malt Extract | 2 | 5 | 20s |
| Prepare Curing Brine | Coarse Salt x3, Herb x2, Water Wineskin x1 | Curing Brine | 2 | 5 | 15s |
| Build Smoking Rack | Wood x4, Iron Bar x1 | Smoking Rack | 1 | 8 | 25s |

### Torvan the Smith (NPC 7) — Toughness Line + Metalwork

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| Grind Iron Grit | Iron Bar x1, Stone x2 | Iron Grit | 4 | 3 | 10s |
| **Grind Iron Filings** (T1) | Iron Grit x3, Coarse Salt x1, Glass Vial x1 | Iron Filings | 3 | 8 | 20s |
| **Temper Steel Dust** (T2) | Steel Bar x1, Ite Salt x1, Iron Filings x2, Clay Crucible x1 | Tempered Steel Dust | 2 | 20 | 40s |
| Mix Tempered Alloy Paste | Tempered Steel Dust x1, Ite Salt x1, Animal Skin x2 | Tempered Alloy Paste | 2 | 15 | 25s |
| **Extract Mythril Essence** (T3) | Mythril Shard x2, Tempered Alloy Paste x2, Brass Bar x1, Clay Crucible x1 | Mythril Essence | 1 | 50 | 90s |

### Bruna the Brewmistress (NPC 12) — Strength Line

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| **Brew Barley Beer** (T1) | Malt Extract x1, Water Wineskin x1, Glass Bottle x1 | Barley Beer | 3 | 8 | 20s |
| **Brew Spiced Wine** (T2) | Wild Grapes x4, Juniper Berries x2, Glass Bottle x1, Malt Extract x1 | Spiced Wine | 2 | 18 | 35s |
| **Distill Dwarven Vodka** (T3) | Barley Beer x2, Spiced Wine x1, Juniper Berries x3, Clay Crucible x1, Charite x2 | Dwarven Vodka | 1 | 50 | 90s |

### Harlen the Fisherman (NPC 10) — Constitution Line

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| **Smoke Mudfish** (T1) | Mudfish x3, Coarse Salt x1, Smoking Rack x1 | Smoked Mudfish | 3 | 8 | 20s |
| **Cure Silverscale** (T2) | Silverscale Trout x2, Curing Brine x1, Linen x1, Coarse Salt x2 | Cured Silverscale | 2 | 18 | 35s |
| **Prepare Leviathan Jerky** (T3) | Deep Lurker x2, Curing Brine x2, Ashfin Eel x1, Coarse Salt x3, Charite x2 | Leviathan Jerky | 1 | 50 | 90s |

### Lysara the Sage (NPC 13) — Intelligence Line

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| **Shape Raw Quartz** (T1) | Quartz Shard x4, Arcane Dust x1, Charite x1 | Raw Quartz | 3 | 8 | 20s |
| **Polish Amethyst** (T2) | Amethyst Cluster x2, Quartz Shard x3, Arcane Dust x2, Cobalt Ore x2 | Polished Amethyst | 2 | 18 | 35s |
| **Crystallize Arcane Shard** (T3) | Polished Amethyst x2, Arcane Dust x4, Mythril Shard x1, Cobalt Bar x1, Charite x2 | Arcane Crystal | 1 | 50 | 90s |

### Kael the Swift (NPC 14) — Dexterity Line

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| **Render Sinew Oil** (T1) | Animal Skin x3, Viper Fang x1, Glass Vial x1 | Sinew Oil | 3 | 8 | 20s |
| **Brew Vipervenom Salve** (T2) | Sinew Oil x2, Viper Fang x2, Spider Silk Thread x3, Herb x2 | Vipervenom Salve | 2 | 18 | 35s |
| **Distill Shadowstep Tincture** (T3) | Vipervenom Salve x2, Nightbloom Petal x2, Titanite Dust x1, Glass Vial x2, Charite x2 | Shadowstep Tincture | 1 | 50 | 90s |

---

## 4. Recipe Dependency Diagrams

### STRENGTH — Barley Beer / Spiced Wine / Dwarven Vodka

```
[Barley Grain]─────► Old Marinus: Steep Malt Extract ──┐
[Water Wineskin]────►                                   ├──► Bruna: Brew Barley Beer (T1)
[Stone]─► Magra: Blow Glass Bottle ─────────────────────┘        │
                        │                                         │
[Wild Grapes]───────────┤                                         │
[Juniper Berries]───────┼──► Bruna: Brew Spiced Wine (T2)        │
[Malt Extract]──────────┘        │                                │
                                 │                                │
                                 └──► Bruna: Distill Dwarven Vodka (T3)
[Barley Beer x2]─────────────────────►    │
[Juniper Berries x3]─────────────────►    │
[Stone]─► Magra: Fire Clay Crucible ──────┘
[Charite x2]──────────────────────────────►
```

**T1 full chain**: Barley Grain (drop) → Malt Extract (Marinus) + Glass Bottle (Magra) + Water → Beer (Bruna)
**Craft steps to T1**: 3 (Malt Extract + Glass Bottle + Beer)
**T2 full chain**: Wild Grapes (drop/farm) + Juniper Berries (drop) + Glass Bottle + Malt Extract → Wine (Bruna)
**Craft steps to T2**: 3-4 (Grapes optionally farmed + Malt + Bottle + Wine)
**T3 full chain**: Beer x2 + Wine x1 + Juniper x3 + Crucible + Charite → Vodka (Bruna)
**Craft steps to T3**: 5+ (all T1/T2 chains + Crucible + final distillation)

---

### CONSTITUTION — Smoked Mudfish / Cured Silverscale / Leviathan Jerky

```
[Mudfish x3]────────────────────────────┐
[Water Wineskin]─► Marinus: Salt ───────┤
[Stone]──────────►                      ├──► Harlen: Smoke Mudfish (T1)
[Wood]─► Marinus: Build Smoking Rack ───┘
[Iron Bar]►                                   

[Silverscale Trout x2]─────────────────────┐
[Coarse Salt x3 + Herb x2]─► Marinus: Brine┼──► Harlen: Cure Silverscale (T2)
[Linen]─────────────────────────────────────┘
[Coarse Salt x2]────────────────────────────►

[Deep Lurker x2]────────────────────────────────┐
[Curing Brine x2]──────────────────────────────┤
[Ashfin Eel x1]────────────────────────────────┼──► Harlen: Leviathan Jerky (T3)
[Coarse Salt x3]────────────────────────────────┤
[Charite x2]────────────────────────────────────┘
```

**T1 full chain**: Mudfish (fishing) + Salt (Marinus) + Smoking Rack (Marinus) → Smoked Mudfish (Harlen)
**Craft steps to T1**: 3 (Salt + Rack + Smoke)
**T2 full chain**: Silverscale (fishing) + Brine (Marinus, needs Salt+Herb+Water) + Linen + Salt → Cured (Harlen)
**Craft steps to T2**: 3-4 (Salt + Brine + Linen(Mara) + Cure)
**T3 full chain**: Deep Lurker + Ashfin (fishing) + Brine x2 + Salt x3 + Charite → Jerky (Harlen)
**Craft steps to T3**: 4-5 (Salt batches + Brine batches + Jerky)

---

### INTELLIGENCE — Raw Quartz / Polished Amethyst / Arcane Crystal

```
[Quartz Shard x4]──────┐
[Arcane Dust x1]────────┼──► Lysara: Shape Raw Quartz (T1)
[Charite x1]────────────┘

[Amethyst Cluster x2]──────┐
[Quartz Shard x3]───────────┤
[Arcane Dust x2]─────────────┼──► Lysara: Polish Amethyst (T2)
[Cobalt Ore x2]──────────────┘

[Polished Amethyst x2]─────────┐
[Arcane Dust x4]─────────────────┤
[Mythril Shard x1]───────────────┼──► Lysara: Crystallize Arcane Shard (T3)
[Cobalt Bar x1]───────────────────┤
[Charite x2]──────────────────────┘
```

**T1 full chain**: Quartz Shard (Stone Golem/mine drops) + Arcane Dust (Cultist Shade) + Charite → Raw Quartz (Lysara)
**Craft steps to T1**: 1 (single craft, but requires combat drops from two different monster types)
**T2 full chain**: Amethyst Cluster (Reaver Captain/Stone Golem rare) + Quartz + Arcane Dust + Cobalt Ore → Polished (Lysara)
**Craft steps to T2**: 1-2 (materials are the gate, not steps — requires harder monsters)
**T3 full chain**: Polished Amethyst x2 (each needs T2 craft) + Arcane Dust x4 + Mythril Shard + Cobalt Bar (smelted) + Charite → Crystal (Lysara)
**Craft steps to T3**: 3-4 (Cobalt Bar smelting + T2 crafts + final crystallization)

*Intelligence line is gated by monster difficulty rather than craft steps — fitting for a scholar's path.*

---

### DEXTERITY — Sinew Oil / Vipervenom Salve / Shadowstep Tincture

```
[Animal Skin x3]──────┐
[Viper Fang x1]────────┤
[Glass Bottle]─► Magra ┼─► Glass Vial ──► Kael: Render Sinew Oil (T1)
[Charite]──────►       │
                       │
[Sinew Oil x2]─────────┤
[Viper Fang x2]─────────┤
[Forest Spider]► Spider Silk Thread x3 ──┼──► Kael: Brew Vipervenom Salve (T2)
[Herb x2]────────────────────────────────┘

[Vipervenom Salve x2]────────────┐
[Nightbloom Petal x2]─────────────┤
[Titanite Dust x1]─────────────────┼──► Kael: Distill Shadowstep Tincture (T3)
[Glass Vial x2]─────────────────────┤
[Charite x2]────────────────────────┘
```

**T1 full chain**: Animal Skin (common drop) + Viper Fang (Duellist/Spider) + Glass Vial (Magra, from Glass Bottle) → Oil (Kael)
**Craft steps to T1**: 3 (Glass Bottle + Glass Vial + Oil)
**T2 full chain**: Sinew Oil x2 (each T1) + more Fangs + Spider Silk Thread (Forest Spider) + Herb → Salve (Kael)
**Craft steps to T2**: 4 (Bottle + Vial + Oil batches + Salve)
**T3 full chain**: Salve x2 (each T2) + Nightbloom (Reaver Captain/Arena Champion) + Titanite Dust (boss-only) + Vials + Charite → Tincture (Kael)
**Craft steps to T3**: 5+ (full T1+T2 chains + rare drops + final distillation)

---

### TOUGHNESS — Iron Filings / Tempered Steel Dust / Mythril Essence

```
[Iron Bar x1]──────┐
[Stone x2]──────────┼──► Torvan: Grind Iron Grit
                    │         │
[Iron Grit x3]─────┘         │
[Coarse Salt x1]──────────────┤
[Glass Vial x1]────────────────┼──► Torvan: Grind Iron Filings (T1)
                               │
[Steel Bar x1]─────────────────┤
[Ite Salt x1]──────────────────┤
[Iron Filings x2]──────────────┼──► Torvan: Temper Steel Dust (T2)
[Clay Crucible x1]──────────────┘
                                    │
[Tempered Steel Dust x1]────────────┤
[Ite Salt x1 + Animal Skin x2]──────┼──► Torvan: Tempered Alloy Paste
                                     │         │
[Mythril Shard x2]───────────────────┤         │
[Tempered Alloy Paste x2]─────────────┤         │
[Brass Bar x1]──────────────────────────┼──► Torvan: Extract Mythril Essence (T3)
[Clay Crucible x1]──────────────────────┤
                                         │
```

**T1 full chain**: Iron Bar (smelted) → Iron Grit (Torvan) + Salt (Marinus) + Glass Vial (Magra) → Iron Filings (Torvan)
**Craft steps to T1**: 4 (Smelt Iron + Grit + Salt + Vial from Bottle + Filings)
**T2 full chain**: Steel Bar (Varn) + Ite Salt (Magra or drops) + Iron Filings x2 (T1) + Clay Crucible (Magra) → Steel Dust (Torvan)
**Craft steps to T2**: 5+ (all T1 chains + Steel smelting + Ite Salt extraction + Crucible + Temper)
**T3 full chain**: Mythril Shard (boss) + Alloy Paste x2 (needs Steel Dust + Ite Salt + Animal Skin) + Brass Bar + Crucible → Essence (Torvan)
**Craft steps to T3**: 6+ (deepest chain in the game — befitting the stat that governs endurance)

---

## 5. Cross-Line Shared Materials Summary

Shows which intermediates create demand across multiple stat lines, driving cross-system play.

| Intermediate | Used In | Source |
|-------------|---------|--------|
| **Glass Bottle** | Strength (Beer, Wine), Dexterity (via Glass Vial) | Magra: Stone + Charite |
| **Glass Vial** | Dexterity (Sinew Oil, Tincture), Toughness (Iron Filings) | Magra: Glass Bottle + Charite |
| **Coarse Salt** | Constitution (Smoke, Cure, Jerky), Toughness (Iron Filings) | Marinus: Water Wineskin + Stone; also Mud Crab/Cave Rat/Pit Brawler drops |
| **Clay Crucible** | Strength (Vodka T3), Toughness (Steel Dust T2, Essence T3) | Magra: Stone + Iron Ore + Charite; also Shieldwall Veteran drops |
| **Charite** | All lines at T3 | Magra: Buy (5cr/3), gathering |
| **Water Wineskin** | Strength (Malt), Constitution (Salt, Brine) | Marinus: Wineskin fill |

---

## 6. Economy Impact Analysis

### Crown Cost Comparison (Old vs New)

| Item | Old Total Crowns | New Total Crowns | Change |
|------|-----------------|-----------------|--------|
| Barley Beer (T1) x3 | 5 | 16 (5 bottle + 5 malt + 8 brew) | +220% |
| Spiced Wine (T2) x2 | 15 | 26 (5 bottle + 5 malt + 18 brew) | +73% |
| Dwarven Vodka (T3) x1 | 40 | 86+ (T1+T2 costs + 8 crucible + 50 distill) | +115% |
| Smoked Mudfish (T1) x3 | 5 | 19 (3 salt + 8 rack + 8 smoke) | +280% |
| Iron Filings (T1) x3 | 5 | 19 (2 smelt + 3 grit + 3 salt + 3 vial + 8 grind) | +280% |
| Mythril Essence (T3) x1 | 40 | 100+ (full chain) | +150% |

The higher crown costs are intentional. The old recipes were too cheap for items that permanently increase stats. A T3 training item should feel like a meaningful investment.

### Material Acquisition Time Estimates

| Tier | Gather Sessions | Combat Encounters | Craft Steps | Total Estimated Time |
|------|----------------|-------------------|-------------|---------------------|
| T1 | 1-2 | 2-5 (weak monsters) | 2-3 | 10-20 minutes |
| T2 | 2-3 | 5-10 (mid monsters) | 3-4 | 25-45 minutes |
| T3 | 3-5 | 10-20 (strong monsters + rare drops) | 4-6 | 60-120 minutes |

This follows the design guideline of 2-5 gather sessions for end-tier items.

### New Crown Sinks Created

- 4 new intermediate recipes at Magra (Glass Bottle, Glass Vial, Clay Crucible, Ite Salt): 28 crowns total
- 4 new intermediate recipes at Old Marinus (Salt, Malt, Brine, Smoking Rack): 19 crowns total
- 1 new recipe at Greta (Wild Grapes): 3 crowns
- 1 new intermediate at Torvan (Iron Grit): 3 crowns
- 1 new intermediate at Torvan (Tempered Alloy Paste): 15 crowns
- All 15 training item recipes repriced: T1=8, T2=18, T3=50 (vs old 5/15/40)

---

## 7. Complete Recipe Registry

Total new recipes to create: **25** (10 intermediates + 15 training items)
Total old recipes to delete: **15** (IDs 31-45)

### Ordered by NPC for Execution

| # | NPC (ID) | Recipe Name | Ingredients | Output | Qty | Crowns | Time |
|---|----------|-------------|-------------|--------|-----|--------|------|
| 1 | Magra (8) | Blow Glass Bottle | Stone x3, Charite x2 | Glass Bottle | 2 | 5 | 15s |
| 2 | Magra (8) | Blow Glass Vial | Glass Bottle x1, Charite x1 | Glass Vial | 3 | 3 | 10s |
| 3 | Magra (8) | Fire Clay Crucible | Stone x5, Iron Ore x1, Charite x3 | Clay Crucible | 1 | 8 | 25s |
| 4 | Magra (8) | Extract Ite Salt | Cobalt Ore x3, Zinc Ore x2, Charite x2 | Ite Salt | 1 | 12 | 30s |
| 5 | Greta (5) | Harvest Wild Grapes | Herb x2, Water Wineskin x1 | Wild Grapes | 4 | 3 | 20s |
| 6 | Marinus (4) | Evaporate Coarse Salt | Water Wineskin x2, Stone x2 | Coarse Salt | 3 | 3 | 15s |
| 7 | Marinus (4) | Steep Malt Extract | Barley Grain x4, Water Wineskin x1 | Malt Extract | 2 | 5 | 20s |
| 8 | Marinus (4) | Prepare Curing Brine | Coarse Salt x3, Herb x2, Water Wineskin x1 | Curing Brine | 2 | 5 | 15s |
| 9 | Marinus (4) | Build Smoking Rack | Wood x4, Iron Bar x1 | Smoking Rack | 1 | 8 | 25s |
| 10 | Torvan (7) | Grind Iron Grit | Iron Bar x1, Stone x2 | Iron Grit | 4 | 3 | 10s |
| 11 | Torvan (7) | Grind Iron Filings | Iron Grit x3, Coarse Salt x1, Glass Vial x1 | Iron Filings | 3 | 8 | 20s |
| 12 | Torvan (7) | Temper Steel Dust | Steel Bar x1, Ite Salt x1, Iron Filings x2, Clay Crucible x1 | Tempered Steel Dust | 2 | 20 | 40s |
| 13 | Torvan (7) | Mix Tempered Alloy Paste | Tempered Steel Dust x1, Ite Salt x1, Animal Skin x2 | Tempered Alloy Paste | 2 | 15 | 25s |
| 14 | Torvan (7) | Extract Mythril Essence | Mythril Shard x2, Tempered Alloy Paste x2, Brass Bar x1, Clay Crucible x1 | Mythril Essence | 1 | 50 | 90s |
| 15 | Bruna (12) | Brew Barley Beer | Malt Extract x1, Water Wineskin x1, Glass Bottle x1 | Barley Beer | 3 | 8 | 20s |
| 16 | Bruna (12) | Brew Spiced Wine | Wild Grapes x4, Juniper Berries x2, Glass Bottle x1, Malt Extract x1 | Spiced Wine | 2 | 18 | 35s |
| 17 | Bruna (12) | Distill Dwarven Vodka | Barley Beer x2, Spiced Wine x1, Juniper Berries x3, Clay Crucible x1, Charite x2 | Dwarven Vodka | 1 | 50 | 90s |
| 18 | Harlen (10) | Smoke Mudfish | Mudfish x3, Coarse Salt x1, Smoking Rack x1 | Smoked Mudfish | 3 | 8 | 20s |
| 19 | Harlen (10) | Cure Silverscale | Silverscale Trout x2, Curing Brine x1, Linen x1, Coarse Salt x2 | Cured Silverscale | 2 | 18 | 35s |
| 20 | Harlen (10) | Prepare Leviathan Jerky | Deep Lurker x2, Curing Brine x2, Ashfin Eel x1, Coarse Salt x3, Charite x2 | Leviathan Jerky | 1 | 50 | 90s |
| 21 | Lysara (13) | Shape Raw Quartz | Quartz Shard x4, Arcane Dust x1, Charite x1 | Raw Quartz | 3 | 8 | 20s |
| 22 | Lysara (13) | Polish Amethyst | Amethyst Cluster x2, Quartz Shard x3, Arcane Dust x2, Cobalt Ore x2 | Polished Amethyst | 2 | 18 | 35s |
| 23 | Lysara (13) | Crystallize Arcane Shard | Polished Amethyst x2, Arcane Dust x4, Mythril Shard x1, Cobalt Bar x1, Charite x2 | Arcane Crystal | 1 | 50 | 90s |
| 24 | Kael (14) | Render Sinew Oil | Animal Skin x3, Viper Fang x1, Glass Vial x1 | Sinew Oil | 3 | 8 | 20s |
| 25 | Kael (14) | Brew Vipervenom Salve | Sinew Oil x2, Viper Fang x2, Spider Silk Thread x3, Herb x2 | Vipervenom Salve | 2 | 18 | 35s |
| 26 | Kael (14) | Distill Shadowstep Tincture | Vipervenom Salve x2, Nightbloom Petal x2, Titanite Dust x1, Glass Vial x2, Charite x2 | Shadowstep Tincture | 1 | 50 | 90s |

---

## 8. Execution Plan

### Phase 0 — Delete Old Recipes
Delete recipe IDs 31-45 via admin API (`DELETE /api/recipes/:id`).

### Phase 1 — Create New Items (20 items)
Create all intermediate resource items. Must complete before recipes that reference them.

### Phase 2 — Add Monster Loot Drops
Add all loot entries from Section 2. Independent of recipe creation.

### Phase 3 — Create Intermediate Recipes (10 recipes)
Recipes at Magra, Greta, Old Marinus, and Torvan for shared intermediates.

### Phase 4 — Create Training Item Recipes (15 recipes, replacing old ones)
Final assembly recipes at each trainer NPC. These reference items from Phase 1 and intermediates from Phase 3.

### Phase 5 — Verify
- Confirm all 20 new items exist
- Confirm all 36 monster loot entries exist
- Confirm all 25 new recipes are functional
- Test one full T3 chain end-to-end (e.g., Dwarven Vodka from raw materials)

---

## 9. Verification Checklist

- [ ] 20 new intermediate items created (IDs assigned)
- [ ] 36 monster loot entries added (20 new monster drops + 16 existing monster additions)
- [ ] 15 old recipes deleted (IDs 31-45)
- [ ] 25 new recipes created and functional
- [ ] Glass Bottle appears in both Strength and Dexterity chains
- [ ] Coarse Salt appears in both Constitution and Toughness chains
- [ ] Clay Crucible appears in both Strength T3 and Toughness T2/T3
- [ ] T1 items require 2-3 craft steps from raw materials
- [ ] T2 items require 3-4 craft steps
- [ ] T3 items require 4-6 craft steps and include T1/T2 as ingredients
- [ ] Every previously lootless monster (16-21) now has at least 2 loot entries
- [ ] No circular recipe dependencies
- [ ] All NPC assignments match existing building locations
- [ ] Crown costs increase meaningfully across tiers (T1: ~16-19, T2: ~26-38, T3: ~86-100+)
