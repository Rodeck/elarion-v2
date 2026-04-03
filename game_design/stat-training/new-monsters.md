# New Monsters for Stat Training Material Drops

## Design Rationale

Arena monsters (Pit Brawler, Sellsword, Duellist, Shieldwall Veteran, Reaver Captain, Arena Champion) are PvP opponents and should NOT drop loot. Instead we create new world monsters that fit existing locations thematically and provide the crafting materials needed for stat training chains.

## Monster Tiers

- **Tier 1 (Easy)**: HP 25-55, for Plains/Forest/Coast — drop T1 crafting materials
- **Tier 2 (Medium)**: HP 65-110, for Mines/Cult/Forest — drop T2 materials
- **Tier 3 (Hard)**: HP 140-250, for deep zones — drop T3 rare materials

---

## New Monsters (8)

### Tier 1 — Common Material Sources

| Monster | HP | ATK | DEF | XP | Crowns | Location | Loot Drops |
|---------|-----|-----|-----|-----|--------|----------|------------|
| Grain Weevil | 22 | 10 | 4 | 5 | 0-4 | Plains (17) | Barley Grain (45%, x2), Herb (15%, x1) |
| Salt Crab | 42 | 16 | 12 | 14 | 2-10 | Fry'Shtack Coast Town (11), Docs (4) | Coarse Salt (40%, x2), Stone (20%, x1), Quartz Shard (10%, x1) |
| Vineyard Serpent | 48 | 18 | 8 | 16 | 3-12 | Brookly Forest (15) | Wild Grapes (35%, x2), Viper Fang (25%, x1), Juniper Berries (20%, x2) |

### Tier 2 — Uncommon Material Sources

| Monster | HP | ATK | DEF | XP | Crowns | Location | Loot Drops |
|---------|-----|-----|-----|-----|--------|----------|------------|
| Crystal Spider | 75 | 21 | 12 | 32 | 4-18 | Mage Tover (14), Old Cult (16) | Spider Silk Thread (40%, x2), Quartz Shard (25%, x2), Arcane Dust (15%, x1) |
| Ironhide Beetle | 85 | 18 | 22 | 38 | 6-20 | Quary (13), Forgotten Mines (12) | Iron Grit (35%, x3), Ite Salt (15%, x1), Coarse Salt (20%, x2) |
| Marsh Viper | 70 | 24 | 10 | 28 | 4-16 | Fry'Shtack Coast Town (11) | Viper Fang (40%, x2), Juniper Berries (25%, x2), Herb (15%, x1) |

### Tier 3 — Rare Material Sources

| Monster | HP | ATK | DEF | XP | Crowns | Location | Loot Drops |
|---------|-----|-----|-----|-----|--------|----------|------------|
| Gloomveil Stalker | 160 | 30 | 18 | 65 | 10-30 | Brookly Forest (15), Mage Tover (14) | Nightbloom Petal (30%, x1), Spider Silk Thread (25%, x2), Amethyst Cluster (12%, x1) |
| Deep Ore Warden | 200 | 26 | 28 | 80 | 12-35 | Old Cult (16), Forgotten Mines (12) | Amethyst Cluster (25%, x1), Ite Salt (30%, x2), Iron Grit (20%, x3), Nightbloom Petal (10%, x1) |

---

## Monster Placement (Explore Actions to Update)

### Add to existing explore actions:
- **Plains (17)** [action 13]: Add Grain Weevil (w:4) alongside Field Mouse (w:6), Bandit Scout (w:2)
- **Fry'Shtack Coast Town (11)** [action 14]: Add Salt Crab (w:3), Marsh Viper (w:2) alongside Mud Crab (w:5), Sewer Rat (w:3)
- **Brookly Forest (15)** [action 3]: Add Vineyard Serpent (w:3), Gloomveil Stalker (w:1) alongside Wild Dog (w:1)
- **Mage Tover (14)** [action 15]: Add Crystal Spider (w:3), Gloomveil Stalker (w:1) alongside Cultist Shade (w:3), Forest Spider (w:4)
- **Forgotten Mines (12)** [action 4]: Add Ironhide Beetle (w:2), Deep Ore Warden (w:1) alongside Wild Dog (w:3), Cave Rat (w:4), Cave Troll (w:1)
- **Quary (13)**: No explore action exists — needs new explore action with Ironhide Beetle
- **Old Cult (16)**: No explore action (only gather) — needs new explore action with Crystal Spider, Deep Ore Warden
- **Docs (4)** [action 12]: Add Salt Crab (w:3) alongside Mud Crab (w:4), Sewer Rat (w:5)

### New explore actions needed:
- **Quary (13)**: explore, chance 30%, Ironhide Beetle (w:5), Stone Golem (w:2)
- **Old Cult (16)**: explore, chance 35%, Crystal Spider (w:3), Deep Ore Warden (w:2), Ashvein Lurker (w:3)

---

## Supplementary Drops on Existing Monsters

These existing monsters get additional drops to fill gaps in the material chain:

| Monster (ID) | New Item | Drop Chance | Qty | Rationale |
|-------------|----------|-------------|-----|-----------|
| Forest Spider (8) | Spider Silk Thread | 35% | 2 | Spiders produce silk |
| Cultist Shade (12) | Arcane Dust | 35% | 2 | Shades leave arcane residue |
| Cultist Shade (12) | Quartz Shard | 15% | 1 | Cultists use crystals in rituals |
| Stone Golem (13) | Quartz Shard | 30% | 2 | Quartz veins in their stone bodies |
| Stone Golem (13) | Amethyst Cluster | 8% | 1 | Rare crystalline deposits inside golems |
| Wild Dog (1) | Barley Grain | 10% | 1 | Scavenged from farm fields |
| Field Mouse (5) | Barley Grain | 20% | 2 | Mice eat grain |
| Cave Rat (2) | Coarse Salt | 15% | 1 | Cave mineral deposits |
| Mud Crab (7) | Coarse Salt | 25% | 2 | Coastal creatures with salt |
| Bandit Scout (9) | Juniper Berries | 20% | 2 | Foraged from the wild |
| Mine Crawler (11) | Ite Salt | 10% | 1 | Deep mine minerals |
| Ashvein Lurker (15) | Ite Salt | 20% | 1 | Deep vein minerals |
