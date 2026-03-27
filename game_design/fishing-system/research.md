# Fishing System — Research

## Game State Overview
| Entity | Count |
|--------|-------|
| Items | 43 (23 resource, 7 weapon, 3 tool, 1 food, 1 heal, 8 armor/equipment) |
| Monsters | 15 (HP 18–300, ATK 8–35) |
| Zones | 2 (Elarion City: 7 buildings, Ulysses Peninsula: 10 buildings) |
| Buildings | 17 total |
| NPCs | 9 (8 crafters, 1 non-crafter) |
| Recipes | 25 |
| Quests | 6 (3 main, 2 daily, 1 side) |
| Gathering Actions | 3 (all pickaxe-based mining) |
| Characters | 3 |

## Existing Related Content

### Water-Adjacent Buildings (Fishing Spot Candidates)
| Building | Zone | Current Actions | NPCs | Notes |
|----------|------|----------------|-------|-------|
| **Docs** (id:4) | Elarion City | 1 explore (Mud Crab, Sewer Rat) | None | **Best candidate** — "Docks" is literally waterfront; currently only has a weak explore action |
| **Fry'Shtack Coast Town** (id:11) | Ulysses Peninsula | 1 explore (Mud Crab, Sewer Rat) | Old Marinus (1 recipe) | **Second candidate** — coastal town, already has an NPC; could host Fisherman NPC |

### Existing Tool System (Pickaxes)
| Tool | tool_type | max_durability | power | Craft Cost |
|------|-----------|---------------|-------|------------|
| Wooden Pickaxe (id:26) | pickaxe | 1000 | 10 | N/A (monster drop) |
| Iron Pickaxe (id:43) | pickaxe | 150 | 2 | 10 crowns + Iron Bar x3, Tanned Leather x1 |
| Steel Pickaxe (id:44) | pickaxe | 300 | 3 | 30 crowns + Steel Bar x2, Tanned Leather x1 |

**Note**: Wooden Pickaxe has 1000 durability (outlier — likely a starter item). Iron/Steel follow 150→300 progression. Gathering actions consume durability at 1-3 dur/second over 10-60s windows, meaning 10-180 durability per gather. Fishing rods should have **much lower** durability since the concept proposes 1 durability per cast (not per-second drain).

### Existing Resources Relevant to Rod Upgrades
| Resource | id | stack_size | Sources |
|----------|----|-----------|---------|
| Linen | 25 | 10 | Crafted (Silk Mara: Flax x4, 5 crowns) |
| Iron Bar | 31 | 50 | Smelted (Magra: Iron Ore x3 + Charite x1, 2 crowns) |
| Steel Bar | 38 | 20 | Forged (Varn Ashforge: Iron Bar x2 + Zinc Bar x1, 15 crowns) |
| Copper Bar | 33 | 50 | Smelted (Magra: Copper Ore x3 + Charite x1, 3 crowns) |

### Existing Food/Heal Items
| Item | Category | Power | stack_size |
|------|----------|-------|-----------|
| Cooked Meat (id:16) | food | 10 food_power | 10 |
| Herb Potion (id:15) | heal | 15 heal_power | 10 |

**Only 1 food item and 1 heal item exist**. Fish-based cooking would significantly expand the food system.

### Existing Quests
- 3 main quests (kill rat, talk to Eleina chain)
- 2 daily quests (kill rat + skin, daily gossip)
- 1 side quest (A Father's Worry)

**Very few quests overall** — fishing dailies would roughly double the quest content.

## Balance Baselines

### Monster Stats (current ranges)
| Stat | Min | Max | Median | Notes |
|------|-----|-----|--------|-------|
| HP | 18 | 300 | 50 | Cave Troll (300) is a major outlier; typical range 18-90 |
| ATK | 8 | 35 | 17 | T1 mobs: 8-16, T2: 17-25, T3 (boss): 28-35 |
| DEF | 3 | 24 | 9 | Most mobs 3-14; Cave Troll/Stone Golem at 20-24 |
| XP | 3 | 120 | 18 | Scales with HP roughly linearly |
| Crowns (min) | 0 | 20 | 3 | Low-tier: 0-2, mid: 5-8, high: 10-20 |
| Crowns (max) | 3 | 60 | 15 | Low-tier: 3-8, mid: 14-22, high: 35-60 |

### Item Stats (current ranges)
**Weapons**: ATK 6 (Crude Wand) → 12 (Wooden Club); outliers: Longbow 70, Warhammer 590 (dev/test items)
**Armor (realistic tier)**: DEF 3 (Bracers) → 12 (Brigandine)
**Tools**: Durability 150-300 (Iron/Steel pickaxes), 1000 (Wooden — outlier)
**Resources**: stack_size mostly 20; refined materials 10-50; Charite at 99
**Food/Heal**: food_power 10, heal_power 15 (only 1 of each)
**Combat stats on equipment**: Currently ALL zero for dodge_chance, crit_chance, max_mana, mana_on_hit, mana_regen. crit_damage is 150 (base default) on everything. **Rings and amulets would be the FIRST items with non-zero secondary stats.**

### Recipe Costs
| Metric | Min | Max | Median |
|--------|-----|-----|--------|
| Crown cost | 0 | 30 | 15 |
| Craft time (s) | 3 | 90 | 30 |
| Ingredient count | 0-1 | 4 | 2 |

### Economy Snapshot
- **Crown sources**: Monster drops (0-60 per kill, median ~10), gathering gold events (1-8 crowns), expeditions (2-10 gold)
- **Crown sinks**: Crafting (2-30 crowns per recipe), Charite purchase (5 crowns → 3 Charite)
- **Active players**: 3 characters
- **Net flow**: Early-game economy; players likely accumulate crowns faster than they spend since few high-cost sinks exist. **Rod repair is a welcome new crown sink.**

## Gap Analysis

1. **No fishing or water-based gathering** — all 3 gathering actions are pickaxe mining. Fishing fills a completely empty gathering niche.
2. **No secondary combat stats on items** — dodge_chance, crit_chance, mana_regen are all 0 on every item. Rings/amulets would be the **first items introducing these stats**, making them highly desirable.
3. **Only 1 food item** (Cooked Meat) — fish-based cooking would expand food diversity significantly.
4. **No ring/amulet equipment slots** — equipment system has 7 slots (helmet, chestplate, left_arm, right_arm, greaves, bracer, boots). Adding ring + amulet = 9 slots.
5. **Very few daily quests** (only 2) — fishing dailies would more than double daily quest content.
6. **No tool variety** — only pickaxes exist. Fishing rod introduces a second tool_type.
7. **No NPC at Docks** (Elarion City building 4) — perfect empty slot for a Fisherman NPC.
8. **Fry'Shtack Coast Town** has Old Marinus (water-filler NPC) with only 1 recipe — could host a second fishing spot or the Fisherman could be placed here instead.

## Design Constraints

1. **Tool durability model differs**: Existing gathering consumes durability at `dur/second` rate over a time window (e.g., 2 dur/s * 30s = 60 durability). Concept proposes 1 durability per cast. This is **compatible** — the `durability_per_second` field in gathering actions can be set to any value; the mini-game just needs to consume a fixed amount per attempt rather than time-based drain.
2. **Equipment slot additions require code changes**: Adding `ring` and `amulet` to `EquipSlot`, `EquipmentSlotsDto`, `ItemCategory` types in `shared/protocol/index.ts` + backend equipment logic + frontend UI. This is a **schema/code change**, not just admin API entity creation.
3. **ItemCategory and EquipSlot are TypeScript union types**: Adding `'ring' | 'amulet'` requires modifying `shared/protocol/index.ts` lines 557-560 and 705-713, plus a DB migration for the CHECK constraint on `item_definitions.category`.
4. **Resource stack sizes**: T1 resources use stack_size 20, refined materials 10-50. Fish should use stack_size 10-20 to match.
5. **Gathering event weight system**: Existing gathering uses weighted events (resource, gold, monster, nothing, accident). Fishing loot tables should use the same weight system for consistency.
6. **Rod upgrade points**: Tracked as a new column on `characters` table (`fishing_upgrade_points INTEGER DEFAULT 0`). Non-tradeable, quest-granted only. Requires a DB migration.

## Resolved Questions

> **Which existing building(s) should host fishing spots?**
**Answer**: **Docs** (building 4, Elarion City) is the primary candidate — it's literally the docks/waterfront with only a weak explore action and no NPCs. Place the Fisherman NPC and first fishing spot here. **Fry'Shtack Coast Town** (building 11, Ulysses Peninsula) is the secondary spot — a coastal town with thematic fit. This gives one fishing spot per zone.

> **Should rod upgrade points be a visible currency in inventory, or tracked internally?**
**Answer**: Track as a **dedicated column on the characters table** (`fishing_upgrade_points INTEGER DEFAULT 0`). Quest rewards increment this counter directly. This keeps upgrade points non-tradeable (players must earn them), avoids inventory clutter, and is simpler than an item-based approach. The UI can display the current count at the Fisherman NPC's upgrade interface.

> **Should rings/amulets drop ONLY from fishing?**
**Answer**: Start fishing-exclusive to give fishing a unique value proposition. Later, rare rings/amulets can be added to monster loot tables or quest rewards. Since **no items currently have secondary combat stats**, fishing becomes the exclusive early source of dodge/crit/mana gear — a strong incentive.

> **Cooking system doesn't exist yet — should fish just be "food" items directly?**
**Answer**: Make fish **resource** items (like raw materials) that are crafted into cooked food via recipes. This is consistent with how Animal Skin → Tanned Leather works. However, there is no "Cook" NPC yet. Options: (a) add a Cook NPC at Fry'Shtack Coast Town or Docs, (b) add cooking recipes to Old Marinus (he's at the coast — thematic fit). **Recommendation**: Add cooking recipes to Old Marinus at Fry'Shtack Coast Town — he currently has only 1 recipe (Fill Wineskin) and is underutilized.

> **Should there be a "fishing level" or is rod tier sufficient?**
**Answer**: Rod tier is sufficient. The game doesn't have a skills/proficiency system; adding one just for fishing would be scope creep. Rod tier already gates progression cleanly.

> **How many daily quests should be available simultaneously?**
**Answer**: Offer **all 3-4 daily quests simultaneously**. With only 2 existing dailies in the whole game, more is better. Players can choose which to pursue based on their rod tier and available fish.

> **How should the mini-game render in Phaser?**
**Still open — engine/frontend decision**. Not resolvable from game data alone. Recommend discussing during implementation planning.

## Recommendations for Design Phase

### Fishing Rod Stats
- **Durability**: 30 / 50 / 75 / 100 / 150 (T1→T5) — much lower than pickaxes because 1 durability per cast, not per-second
- **tool_type**: `'fishing_rod'` (new)
- **power**: Use to influence loot table weights (higher power = higher chance of rare fish). Suggest 1 / 2 / 3 / 5 / 8

### Fish Items (Resources)
- **Category**: `resource` (raw fish) — cooked versions would be `food`
- **stack_size**: 20 (matches other T1 resources)
- **Naming**: Thematic to Elarion's dark fantasy (Mudfish, Ashfin Eel, Mistscale, etc.)

### Ring/Amulet Stats
- **Start conservative**: Since NO items currently have secondary stats, even +2-3 dodge/crit is significant
- **T1 ring/amulet**: +2-3 to a single stat
- **T4 ring/amulet**: +5-10 to 2-3 stats
- **These will be the most impactful gear in the game** until other sources of secondary stats are added

### Quest Rewards
- **Crown rewards**: 5-20 per daily (aligns with mid-tier monster drops)
- **XP rewards**: 15-50 per daily (aligns with monster XP range)
- **Fishing upgrade points**: 10-35 per daily quest (added to `characters.fishing_upgrade_points`)

### Gathering Action Config
- Use the standard weighted event system
- **Time per cast**: 5-15 seconds (shorter than mining's 10-60s — fishing should feel snappier)
- **Durability cost**: 1 per cast (fixed, not time-based)
- Include `nothing` events at weight 10-20 (matching mining's nothing weights)

### Crown Sinks (Rod Repair Costs)
| Rod Tier | Repair Cost (crowns) | Resource Cost |
|----------|---------------------|---------------|
| T1 | 10 | None |
| T2 | 25 | Linen x2 |
| T3 | 50 | Iron Bar x3 |
| T4 | 100 | Steel Bar x2 |
| T5 | 150 | Steel Bar x3 |

Repair costs are intentionally steep — at T5, a full rod (150 durability = 150 casts) costs 150 crowns to repair, i.e., **1 crown per cast**. This creates ongoing pressure even for endgame players.

### Rod Upgrade Costs (Major Crown Sink)
Rod upgrades should be **expensive** — one of the primary crown sinks in the game. Current top crafting cost is 30 crowns (shield/steel pickaxe); rod upgrades should far exceed that.

| Tier | Upgrade Points | Resource Cost | Crown Cost | Notes |
|------|---------------|---------------|------------|-------|
| T1→T2 | 50 | Linen x10 | 75 | ~5 days of dailies; crown cost = ~5 Cave Troll kills |
| T2→T3 | 100 | Iron Bar x15 | 200 | ~5-7 days; serious investment |
| T3→T4 | 200 | Steel Bar x10, Linen x5 | 500 | ~8-10 days; endgame crown commitment |
| T4→T5 | 500 | Quest chain + rare materials | 1000 | ~15-20 days + quest; prestige tier |

**Rationale**: At avg ~15 crowns/monster kill, T3 upgrade costs ~13 kills just in crowns. T5 costs ~67 kills. Combined with repair costs, fishing becomes a sustained crown drain that scales with engagement.

### Implementation Priority
1. **Schema changes first**: Add `ring`/`amulet` to ItemCategory, EquipSlot, EquipmentSlotsDto (code + migration); add `fishing_upgrade_points INTEGER DEFAULT 0` to `characters` table
2. **Items**: Create fishing rods, fish, rings, amulets via admin API
3. **NPC**: Create Fisherman NPC at Docs (Elarion City)
4. **Gathering actions**: Create fishing spots at Docs and Fry'Shtack Coast Town
5. **Recipes**: Create cooking recipes at Old Marinus
6. **Quests**: Create daily fishing quests from Fisherman
7. **Mini-game UI**: Frontend Phaser implementation (separate engineering task)
