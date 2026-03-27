# Fishing System — Dark Waters, Rare Treasures

## Context

Fishing introduces the first non-combat gathering system in Elarion. Players cast lines into the dark waters at the city docks and coastal towns, engaging in a tension-based mini-game that rewards skill and punishes automation. The system creates a self-sustaining progression loop: catch fish → complete daily quests → earn upgrade points → upgrade rod → unlock rarer catches. Rings and amulets — entirely new equipment slots — drop exclusively from fishing, making it the only early source of secondary combat stats (dodge, crit, mana) in the game. Rod upgrades and repairs serve as a major crown sink in an economy that currently lacks high-cost drains.

**What's new:**
- 26 items (5 rods, 8 raw fish, 5 cooked fish, 4 rings, 4 amulets)
- 1 NPC (Fisherman)
- 5 rod tier definitions
- 16 fishing loot entries
- 5 cooking recipes
- 2 fishing building actions
- 4 daily quests + 1 weekly quest
- 2 new equipment slots (ring, amulet) — **code change required**
- `characters.fishing_upgrade_points` column — **migration required**
- Fishing mini-game UI — **frontend engineering task**

---

## Tier/Category Design

Content is organized by **rod tier**, which gates access to fish species, jewelry drops, and fishing locations.

| Tier | Rod | Durability | Power | New Fish Unlocked | Jewelry Access | Upgrade Cost |
|------|-----|-----------|-------|-------------------|----------------|-------------|
| T1 | Crude Fishing Rod | 30 | 1 | Mudfish, River Perch | None | — (starting rod) |
| T2 | Sturdy Fishing Rod | 50 | 2 | Silverscale Trout | T1 ring + amulet | 50 pts + 75 crowns |
| T3 | Reinforced Fishing Rod | 75 | 3 | Golden Carp, Ashfin Eel | T2 ring + amulet | 100 pts + 200 crowns |
| T4 | Master Fishing Rod | 100 | 5 | Deep Lurker, Mistscale | T3 ring + amulet | 200 pts + 500 crowns |
| T5 | Legendary Ashen Rod | 150 | 8 | Abyssal Leviathan Fin | T4 ring + amulet | 500 pts + 1000 crowns |

**Power** influences nothing in the admin API — it's a data field for the fishing mini-game to use when calculating catch difficulty and rare drop bonuses.

**Repair costs** (crowns, at Fisherman NPC):

| Tier | Repair Cost | Notes |
|------|------------|-------|
| T1 | 10 crowns | Cheap, ~0.33 crowns/cast |
| T2 | 25 crowns | ~0.50 crowns/cast |
| T3 | 50 crowns | ~0.67 crowns/cast |
| T4 | 100 crowns | 1.00 crowns/cast |
| T5 | 150 crowns | 1.00 crowns/cast |

---

## Items to Create (26 total)

### Fishing Rods (category: tool)

| # | Name | tool_type | max_durability | power | Description |
|---|------|-----------|---------------|-------|-------------|
| 1 | Crude Fishing Rod | fishing_rod | 30 | 1 | A rough pole with a frayed line. Good enough for river mud. |
| 2 | Sturdy Fishing Rod | fishing_rod | 50 | 2 | Reinforced with linen cord. Handles the pull of trout. |
| 3 | Reinforced Fishing Rod | fishing_rod | 75 | 3 | Iron-braced frame and waxed line. Built for the deep current. |
| 4 | Master Fishing Rod | fishing_rod | 100 | 5 | Steel fittings and silk line. Bends without breaking. |
| 5 | Legendary Ashen Rod | fishing_rod | 150 | 8 | Forged from ashwood and alloy wire. They say it hums near deep water. |

### Raw Fish (category: resource)

| # | Name | stack_size | Description | Min Rod Tier |
|---|------|-----------|-------------|-------------|
| 6 | Mudfish | 20 | A sluggish bottom-feeder with dull scales. Common in shallow water. | T1 |
| 7 | River Perch | 20 | A small striped fish that lurks near pilings. Easy to catch. | T1 |
| 8 | Silverscale Trout | 20 | Quick and bright-scaled. Puts up a fight on the line. | T2 |
| 9 | Golden Carp | 20 | A fat, gleaming fish that feeds on river moss. Prized for its taste. | T3 |
| 10 | Ashfin Eel | 20 | Slippery and dark, with fins the color of soot. Thrashes violently. | T3 |
| 11 | Deep Lurker | 20 | A pale, eyeless fish from the deep channels. Cold to the touch. | T4 |
| 12 | Mistscale | 20 | Its scales shimmer like fog. Found only where the current runs strongest. | T4 |
| 13 | Abyssal Leviathan Fin | 10 | A single massive fin from something far below. The rest never surfaces. | T5 |

*Abyssal Leviathan Fin has stack_size 10 — it's a rare trophy item, smaller stacks reflect scarcity.*

### Cooked Fish (category: food)

| # | Name | food_power | stack_size | Description |
|---|------|-----------|-----------|-------------|
| 14 | Grilled Mudfish | 8 | 10 | Charred on a stick. Tastes like river silt, but it fills the belly. |
| 15 | Pan-Seared Perch | 12 | 10 | Crispy skin and flaky flesh. A dockworker's staple. |
| 16 | Silverscale Fillet | 18 | 10 | Seasoned and seared. The silver scales crackle in the pan. |
| 17 | Ashfin Stew | 25 | 5 | A dark, oily broth that warms from the inside. Keeps you moving. |
| 18 | Deep Lurker Feast | 35 | 5 | A rare delicacy. The pale flesh is rich and sustaining. |

*food_power baseline: Cooked Meat (existing) = 10. Fishing food scales from 8 (below Cooked Meat — Mudfish is low-quality) to 35 (endgame). Stack_size 5 for T3+ food reflects higher value.*

### Rings (category: ring)

| # | Name | defence | dodge_chance | crit_chance | crit_damage | mana_regen | Description |
|---|------|---------|-------------|-------------|-------------|-----------|-------------|
| 19 | Copper River Ring | 2 | 0 | 0 | 0 | 0 | Tarnished green copper, pulled from the silt. Still solid. |
| 20 | Silverscale Band | 0 | 3 | 0 | 0 | 0 | Woven from trout scales and silver wire. Light as a whisper. |
| 21 | Ashfin Loop | 0 | 0 | 5 | 0 | 2 | Black iron ring with an eel-tooth setting. Hums faintly. |
| 22 | Leviathan's Coil | 0 | 5 | 0 | 8 | 0 | A heavy coil of deep-sea metal. Throbs with cold pressure. |

*These are the FIRST items in the game with non-zero secondary combat stats. Even +2 defence on a ring is meaningful alongside leather armor (3-12 DEF range). crit_damage values are ADDITIONS to the 150 base (so Leviathan's Coil → 158 crit_damage).*

### Amulets (category: amulet)

| # | Name | defence | max_mana | mana_on_hit | mana_regen | crit_chance | Description |
|---|------|---------|---------|------------|-----------|-------------|-------------|
| 23 | Tarnished River Pendant | 0 | 3 | 0 | 0 | 0 | A dull pendant on a leather cord. Faint warmth pulses within. |
| 24 | Mistscale Amulet | 0 | 0 | 0 | 5 | 0 | Fog-colored scales set in bone. Mana trickles through it. |
| 25 | Deep Current Charm | 3 | 0 | 4 | 0 | 0 | A smooth river stone wrapped in silver. Draws power from each strike. |
| 26 | Abyssal Talisman | 0 | 10 | 0 | 5 | 3 | Carved from something old and dark. The chain never tangles. |

---

## NPCs to Create (1)

| NPC | Description | is_crafter | Building Assignment |
|-----|-------------|------------|---------------------|
| Harlen the Fisherman | A weathered old man who knows every current and eddy in Elarion's waters. Sells bait, repairs rods, and offers daily bounties for the brave or bored. | false | Docs (id:4, zone 1) |

*is_crafter: false — Harlen doesn't craft items via the recipe system. Rod repairs and upgrades are handled by the fishing backend (rod tier system), and quests are assigned via npc_ids. Cooking recipes go to Old Marinus (id:4), who is already a crafter at Fry'Shtack Coast Town.*

---

## Fishing Loot Table (16 entries)

The fishing system uses a **dedicated loot table** (`create-fishing-loot`). On each successful catch, the system filters entries by `min_rod_tier <= player's rod tier`, then picks one entry via weighted random selection.

### Fish Drops

| Item | min_rod_tier | drop_weight | Effective % at tier |
|------|-------------|-------------|-------------------|
| Mudfish | 1 | 40 | T1: 57%, T5: 24% |
| River Perch | 1 | 30 | T1: 43%, T5: 18% |
| Silverscale Trout | 2 | 20 | T2: 22%, T5: 12% |
| Golden Carp | 3 | 12 | T3: 10%, T5: 7% |
| Ashfin Eel | 3 | 12 | T3: 10%, T5: 7% |
| Deep Lurker | 4 | 8 | T4: 5%, T5: 5% |
| Mistscale | 4 | 8 | T4: 5%, T5: 5% |
| Abyssal Leviathan Fin | 5 | 4 | T5: 2.4% |

### Jewelry Drops

| Item | min_rod_tier | drop_weight | Effective % at tier |
|------|-------------|-------------|-------------------|
| Copper River Ring | 2 | 3 | T2: 3.3%, T5: 1.8% |
| Tarnished River Pendant | 2 | 3 | T2: 3.3%, T5: 1.8% |
| Silverscale Band | 3 | 2 | T3: 1.6%, T5: 1.2% |
| Mistscale Amulet | 3 | 2 | T3: 1.6%, T5: 1.2% |
| Ashfin Loop | 4 | 1 | T4: 0.6%, T5: 0.6% |
| Deep Current Charm | 4 | 1 | T4: 0.6%, T5: 0.6% |
| Leviathan's Coil | 5 | 1 | T5: 0.6% |
| Abyssal Talisman | 5 | 1 | T5: 0.6% |

**Weight totals per tier:**
- T1: 70 (2 fish only)
- T2: 96 (+1 fish, +2 jewelry)
- T3: 122 (+2 fish, +2 jewelry)
- T4: 140 (+2 fish, +2 jewelry)
- T5: 166 (+1 fish, +2 jewelry)

**Drop rate analysis at T5 (150 casts per full rod):**
- Expected Abyssal Leviathan Fin: ~3.6 per rod
- Expected T4 jewelry (Leviathan's Coil or Abyssal Talisman): ~0.9 each per rod
- Expected T1 jewelry: ~2.7 each per rod
- Common fish (Mudfish + River Perch): ~63 per rod

---

## Rod Tier Definitions (5)

| Tier | Item | upgrade_points_cost | max_durability | repair_crown_cost |
|------|------|-------------------|---------------|------------------|
| 1 | Crude Fishing Rod | 0 | 30 | 10 |
| 2 | Sturdy Fishing Rod | 50 | 50 | 25 |
| 3 | Reinforced Fishing Rod | 100 | 75 | 50 |
| 4 | Master Fishing Rod | 100 | 100 | 100 |
| 5 | Legendary Ashen Rod | 500 | 150 | 150 |

*Note: The `create-rod-tier` API defines upgrade_points_cost but not an upgrade crown cost. The crown costs (75 / 200 / 500 / 1000) specified in the tier table above need backend support — either an `upgrade_crown_cost` field on the rod tier table, or a separate mechanism. See Code Changes section.*

---

## Crafting Recipes (5 total)

### At Old Marinus (NPC id:4, Fry'Shtack Coast Town)

| Recipe | Ingredients | Output | Qty | Crowns | Time |
|--------|-------------|--------|-----|--------|------|
| Grill Mudfish | Mudfish x3 | Grilled Mudfish | 2 | 2 | 10s |
| Sear Perch | River Perch x3 | Pan-Seared Perch | 2 | 3 | 15s |
| Fillet Silverscale | Silverscale Trout x2, Linen x1 | Silverscale Fillet | 1 | 8 | 20s |
| Brew Ashfin Stew | Ashfin Eel x2, Water Wineskin x1 | Ashfin Stew | 1 | 15 | 30s |
| Prepare Deep Lurker Feast | Deep Lurker x2, Mistscale x1 | Deep Lurker Feast | 1 | 30 | 45s |

**Cost analysis — Silverscale Fillet**: 2 Silverscale Trout (T2+ fishing) + 1 Linen (Flax x4 + 5 crowns at Silk Mara) + 8 crowns craft = 13 crowns total. Yields food_power 18 (vs Cooked Meat at 10). Fair trade for the effort.

**Cost analysis — Deep Lurker Feast**: 2 Deep Lurker + 1 Mistscale (all T4 fishing, ~5% drop each) + 30 crowns. Requires significant fishing investment. Yields food_power 35 — by far the best food in the game. Justified by rarity of ingredients.

---

## Fishing Building Actions (2)

### Elarion Docks — Docs (building 4, zone 1)
- **action_type**: `fishing`
- **config**: `{ "min_rod_tier": 1 }`
- All rod tiers can fish here. This is the primary/starter fishing location.

### Coastal Waters — Fry'Shtack Coast Town (building 11, zone 2)
- **action_type**: `fishing`
- **config**: `{ "min_rod_tier": 1 }`
- Second fishing location. Same loot table access (the loot table is global, gated by rod tier, not location).

*Both spots use the same global fishing loot table. Location-specific pools could be added later by extending the fishing action config, but are not needed for the initial release.*

---

## Quests (5 total)

### Daily Quest: River Bounty
- **Type**: daily
- **Description**: Harlen needs common fish to feed the dockworkers. Bring him Mudfish from the shallows.
- **Objectives**:
  1. `collect_item`: Mudfish x5
- **Prerequisites**: None
- **Rewards**: 10 rod_upgrade_points, 5 crowns, 15 xp
- **NPC Givers**: Harlen the Fisherman

### Daily Quest: Silver Haul
- **Type**: daily
- **Description**: Silverscale Trout have been spotted near the pilings. Harlen wants a few for the market.
- **Objectives**:
  1. `collect_item`: Silverscale Trout x3
- **Prerequisites**: None (player self-gates by needing T2+ rod to catch these)
- **Rewards**: 20 rod_upgrade_points, 10 crowns, 25 xp
- **NPC Givers**: Harlen the Fisherman

### Daily Quest: The Elusive Carp
- **Type**: daily
- **Description**: The Golden Carp is a rare catch. Even one would fetch a good price. Harlen dares you to try.
- **Objectives**:
  1. `collect_item`: Golden Carp x1
- **Prerequisites**: None (self-gated by T3+ rod requirement)
- **Rewards**: 35 rod_upgrade_points, 20 crowns, 40 xp
- **NPC Givers**: Harlen the Fisherman

### Daily Quest: Deep Water Challenge
- **Type**: daily
- **Description**: Ashfin Eels are slippery and strong. Harlen wants proof you can handle the deep current.
- **Objectives**:
  1. `collect_item`: Ashfin Eel x2
- **Prerequisites**: None (self-gated by T3+ rod)
- **Rewards**: 30 rod_upgrade_points, 15 crowns, 35 xp
- **NPC Givers**: Harlen the Fisherman

### Weekly Quest: Bounty of the Deep
- **Type**: weekly
- **Description**: Something stirs in the deep channels beneath Elarion. Harlen wants proof — bring him a fin from whatever lurks down there.
- **Objectives**:
  1. `collect_item`: Abyssal Leviathan Fin x1
- **Prerequisites**: None (self-gated by T5 rod, 2.4% drop rate)
- **Rewards**: 75 rod_upgrade_points, 50 crowns, 100 xp
- **NPC Givers**: Harlen the Fisherman

**Upgrade points economy**: A player completing all 4 dailies earns 95 points/day. T1→T2 (50 pts) takes ~1 day. T4→T5 (500 pts) takes ~5-6 days of dailies alone, or ~4 days with the weekly bonus. Combined with crown costs (75–1000), progression is steady but expensive.

---

## Economy Flow

```
                          ┌─────────────────────┐
                          │   FISHING MINI-GAME  │
                          │  (costs 1 durability │
                          │   per cast)          │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐   ┌────────────┐   ┌────────────┐
              │ RAW FISH │   │ RINGS /    │   │ (nothing / │
              │ resource │   │ AMULETS    │   │  fail)     │
              └────┬─────┘   │ equipment  │   └────────────┘
                   │         └──────┬─────┘
          ┌────────┼────────┐       │
          ▼        ▼        ▼       ▼
    ┌──────────┐ ┌──────┐ ┌────────────────┐
    │ COOKING  │ │DAILY │ │ EQUIP (combat  │
    │ recipes  │ │QUESTS│ │ stat boost)    │
    │ (crowns) │ │      │ │ or MARKETPLACE │
    └────┬─────┘ └──┬───┘ └────────────────┘
         ▼          ▼
    ┌──────────┐ ┌───────────────────┐
    │ FOOD     │ │ UPGRADE POINTS +  │
    │ (combat  │ │ CROWNS + XP       │
    │  sustain)│ └─────────┬─────────┘
    └──────────┘           ▼
                    ┌──────────────┐
                    │ ROD UPGRADE  │───► higher tier ───► better drops
                    │ (pts+crowns) │                      (loop restarts)
                    └──────────────┘

    ╔══════════════════════════════════════════════╗
    ║            CROWN SINKS                       ║
    ║  Rod repair:    10–150 crowns per full rod   ║
    ║  Rod upgrade:   75–1000 crowns per tier      ║
    ║  Cooking:       2–30 crowns per recipe       ║
    ║                                              ║
    ║  Total T1→T5 investment:                     ║
    ║    Upgrade crowns:   1,775                   ║
    ║    Repair crowns:    ~500 (est. 50 repairs)  ║
    ║    Cooking crowns:   ~200 (est. usage)       ║
    ║    TOTAL:            ~2,475 crowns           ║
    ╚══════════════════════════════════════════════╝
```

**Crown drain comparison**: A Cave Troll (the top monster) drops 20–60 crowns. Reaching T5 fishing costs the equivalent of ~60-120 Cave Troll kills in crowns alone. This is a meaningful long-term sink.

---

## Code Changes Required (not admin API)

These changes are engineering tasks that must be completed **before or alongside** entity creation:

### 1. Equipment Slots — Ring & Amulet
**Files to modify:**
- `shared/protocol/index.ts`: Add `'ring' | 'amulet'` to `ItemCategory` (line ~557) and `EquipSlot` (line ~705); add `ring` and `amulet` fields to `EquipmentSlotsDto` (line ~715)
- Backend equipment logic: Allow equipping ring/amulet category items
- Frontend equipment UI: Render two new equipment slots
- DB migration: Extend CHECK constraint on `item_definitions.category` to include `'ring'`, `'amulet'`

### 2. Fishing Upgrade Points Column
**Migration**: `ALTER TABLE characters ADD COLUMN fishing_upgrade_points INTEGER NOT NULL DEFAULT 0;`

### 3. Rod Upgrade Crown Cost
The `create-rod-tier` API has `upgrade_points_cost` but no `upgrade_crown_cost` field. The design requires crown costs for upgrades (75 / 200 / 500 / 1000). Options:
- **Preferred**: Add `upgrade_crown_cost INTEGER NOT NULL DEFAULT 0` to `fishing_rod_tiers` table + API
- **Alternative**: Handle crown deduction in the rod upgrade handler as a hardcoded lookup

### 4. Fishing Mini-Game UI
Frontend Phaser implementation — tension bar mechanic. Separate engineering task. The backend fishing system works without it (server processes catch attempts), but the mini-game makes it engaging and anti-bot.

---

## Execution Plan

All content created via `game-entities` skill (admin REST API at port 4001). Ordered by foreign key dependencies.

### Phase 1 — Items (26 entities)

Create all items first — they're referenced by loot tables, recipes, rod tiers, and quests.

1. **Create 5 fishing rod items** (category: tool, tool_type: fishing_rod)
2. **Create 8 raw fish items** (category: resource)
3. **Create 5 cooked fish items** (category: food)
4. **Create 4 ring items** (category: ring)
5. **Create 4 amulet items** (category: amulet)

### Phase 2 — NPC + Assignment (2 calls)

6. **Create Harlen the Fisherman** NPC (is_crafter: false)
7. **Assign Harlen to Docs** (zone_id: 1, building_id: 4)

### Phase 3 — Rod Tiers (5 entries)

Requires fishing rod item IDs from Phase 1.

8. **Create 5 rod tier definitions** mapping tier → item_def_id + upgrade/repair costs

### Phase 4 — Fishing Loot Table (16 entries)

Requires fish + ring/amulet item IDs from Phase 1.

9. **Create 16 fishing loot entries** with min_rod_tier and drop_weight

### Phase 5 — Cooking Recipes (5 recipes)

Requires raw fish + cooked fish item IDs from Phase 1. Uses existing NPC Old Marinus (id:4).

10. **Create 5 cooking recipes** at Old Marinus

### Phase 6 — Fishing Building Actions (2 actions)

11. **Create fishing action at Docs** (zone 1, building 4, min_rod_tier: 1)
12. **Create fishing action at Fry'Shtack Coast Town** (zone 2, building 11, min_rod_tier: 1)

### Phase 7 — Quests (5 quests)

Requires Harlen NPC ID from Phase 2 and fish item IDs from Phase 1.

13. **Create 4 daily quests** (River Bounty, Silver Haul, Elusive Carp, Deep Water Challenge)
14. **Create 1 weekly quest** (Bounty of the Deep)

### Deferred — Phase 2 Content

Not included in initial release:
- **Location-specific loot pools**: Different fish at different locations. Requires fishing action config changes.
- **Rod upgrade resource costs**: Linen, Iron Bars, etc. as part of upgrade. Requires backend rod upgrade handler extension.
- **Fisherman shop**: Buying T1 rod, bait, repair materials. Needs a shop/vendor system.
- **Additional fishing spots**: New zones or buildings with higher min_rod_tier requirements.
- **Rings/amulets from non-fishing sources**: Monster drops, quest rewards. Can be added later via create-monster-loot.

---

## Testing Walkthrough

### Test 1: New Player Fishing Start
1. **Obtain a Crude Fishing Rod** (admin-grant or future shop) — verify it appears in inventory as tool, fishing_rod type, 30 durability
2. **Travel to Docs** (Elarion City) — verify "Fish" action appears in building actions
3. **Click Fish** — verify fishing session starts (or mini-game launches)
4. **Complete a catch** — verify one of: Mudfish or River Perch appears in inventory
5. **Check durability** — rod should be at 29/30
6. **Fish until rod hits 1 durability** — verify rod becomes unusable ("repair required")
7. **Repair at Fisherman** — verify 10 crowns deducted, durability restored to 30/30

### Test 2: Daily Quest Loop
1. **Accept "River Bounty" from Harlen** — verify quest appears in quest log
2. **Catch 5 Mudfish** — verify quest progress tracks (5/5)
3. **Turn in quest** — verify rewards: +10 fishing_upgrade_points, +5 crowns, +15 xp
4. **Check character** — verify fishing_upgrade_points column incremented

### Test 3: Rod Upgrade T1→T2
1. **Accumulate 50 upgrade points** via daily quests (~1 day)
2. **Interact with Harlen → Upgrade Rod** — verify 50 pts + 75 crowns deducted
3. **Verify Sturdy Fishing Rod** in inventory: 50 durability, power 2
4. **Fish at Docs** — verify Silverscale Trout and Copper River Ring / Tarnished River Pendant now appear in possible catches

### Test 4: Cooking Path
1. **Travel to Fry'Shtack Coast Town** — verify fishing action available
2. **Catch 3 Mudfish**
3. **Talk to Old Marinus** — verify "Grill Mudfish" recipe available
4. **Craft** — verify 3 Mudfish consumed, 2 crowns charged, 2 Grilled Mudfish produced (food_power 8)
5. **Use Grilled Mudfish in combat** — verify food_power 8 healing

### Test 5: Jewelry Equip
1. **Fish with T2+ rod until ring/amulet drops** (expect ~30 casts for first T1 jewelry)
2. **Equip Copper River Ring** — verify new "ring" equipment slot, +2 defence reflected in effective_defence
3. **Equip Tarnished River Pendant** — verify new "amulet" equipment slot, +3 max_mana reflected in character stats
4. **Enter combat** — verify secondary stats apply (dodge_chance, crit_chance, mana_regen on higher-tier jewelry)

### Test 6: Economy Validation
1. **Track crowns before and after T1→T5 progression** — verify total crown expenditure ~2,475
2. **Compare to crown income** from fishing quests (all 4 dailies = 50 crowns/day + weekly = 50/week) — verify net crown flow is **negative** (fishing is a sink, not a source)
3. **Check marketplace** — verify fish and jewelry are tradeable

---

## Verification Checklist

### Items
- [ ] 5 fishing rods created (tool, fishing_rod, durabilities 30/50/75/100/150)
- [ ] 8 raw fish created (resource, stack_size 20 except Leviathan Fin at 10)
- [ ] 5 cooked fish created (food, food_power 8/12/18/25/35)
- [ ] 4 rings created with secondary stats (defence/dodge/crit/crit_damage)
- [ ] 4 amulets created with secondary stats (max_mana/mana_regen/mana_on_hit/crit_chance)
- [ ] No duplicate names with existing 43 items

### NPCs & Assignments
- [ ] Harlen the Fisherman created and assigned to Docs (building 4, zone 1)
- [ ] Old Marinus (existing, id:4) has 5 new cooking recipes

### Fishing System
- [ ] 5 rod tiers defined with correct item_def_id linkage
- [ ] 16 fishing loot entries with correct min_rod_tier and weights
- [ ] 2 fishing building actions (Docs + Fry'Shtack Coast Town)
- [ ] Fishing action works at both locations

### Quests
- [ ] 4 daily quests created, all assigned to Harlen
- [ ] 1 weekly quest created, assigned to Harlen
- [ ] Quest rewards include rod_upgrade_points (10/20/35/30/75)
- [ ] Quest objectives reference correct fish item IDs

### Economy
- [ ] Rod repair costs drain crowns appropriately (10–150 per repair)
- [ ] Rod upgrade costs are a major sink (75–1000 crowns per tier)
- [ ] Cooking recipe costs align with existing recipe range (2–30 crowns)
- [ ] Net crown flow from fishing is negative (fishing is a drain)

### Equipment (code change)
- [ ] Ring and amulet equipment slots functional
- [ ] Secondary combat stats apply in combat
- [ ] characters.fishing_upgrade_points column exists
