# Fishing System

## Design Goal
Create an engaging fishing mini-game that provides a meaningful progression loop tied to rod upgrades, daily quests, and rare loot — while being actively hostile to automation. Simultaneously introduce **ring** and **amulet** equipment slots, giving fishing a path to high-value gear drops.

## Core Fantasy
You stand at the edge of a dark river running through the city, casting your line into waters that hold both common fish and relics lost to the Ash. The fisherman NPC knows these waters — prove your skill daily and he'll help you forge a better rod, unlocking deeper catches and rarer treasures.

## Game Systems Touched
- **Combat**: Not directly involved, but rare ring/amulet drops from fishing provide combat stats (crit, dodge, mana regen)
- **Economy**: Fish are tradeable resources; rare rings/amulets create marketplace demand; rod repair costs crowns + resources
- **Progression**: Rod tiers gate what fish/loot pools are accessible; daily quests provide steady upgrade currency
- **World/Zones**: Fishing spots are new building actions on water-adjacent buildings; different zones could have different fish pools
- **Social/Quests**: Daily quests from Fisherman NPC ("Catch 5 Silverscale Trout") grant rod upgrade points; potential weekly rare-fish bounties
- **Crafting**: Fish used as cooking ingredients (new recipes at cook NPC); rod upgrades require crafted/gathered materials (linen, iron, etc.)
- **Gathering**: Fishing IS a new gathering type using `tool_type: 'fishing_rod'`; uses existing durability system

## Content Scope Estimate
| Entity Type | Estimated Count | Notes |
|-------------|----------------|-------|
| Items | ~25 | 5 fishing rods (T1-T5), ~12 fish (resource/food), 4 rings, 4 amulets |
| NPCs | 1-2 | Fisherman (quest giver + rod upgrader), optionally a Jeweler for ring/amulet context |
| Monsters | 0 | No monsters — fishing is a peaceful activity |
| Recipes | 6-8 | Fish-based cooking recipes at existing cook NPC |
| Abilities | 0 | No new abilities |
| Quests | 7-10 | 3-4 daily fishing quests, 1 weekly rare bounty, 2-3 rod upgrade quests (milestone) |
| Gathering Actions | 3-5 | Fishing spots at different buildings/zones (shallow water, river, deep dock) |
| Building Actions | 1-2 | "Fish" action on water buildings; "Upgrade Rod" at Fisherman |

## Player Loop
1. Player equips a fishing rod and goes to a water building with a "Fish" action
2. **Mini-game starts**: A timing/reaction challenge plays out in the UI (see Anti-Bot Design below)
3. Success yields fish (common → rare based on rod tier + skill) with a small chance of ring/amulet drops
4. Player turns in fish to the Fisherman NPC via daily quests → earns **Rod Upgrade Points**
5. Once enough points accumulated, player combines points + world resources (linen, iron bars, etc.) to upgrade rod
6. Higher rod tier unlocks new fishing spots, better fish, and higher rare-drop chances
7. Fish feed into cooking recipes for food/heal items; rings and amulets equip into new slots for combat stats

## Anti-Bot Mini-Game Design
The fishing mini-game must require **active human input** that's hard to script:

**Concept: "Tension Bar" fishing**
- Cast line → wait for a bite (random 2-8 second delay with visual/audio cue)
- On bite: A **tension meter** appears — player must keep it in a "green zone" by tapping/clicking rhythmically
- The fish pulls in **randomized patterns** (fast tugs, slow drags, pauses) — player must react
- Different fish species have different pull patterns (aggressive, erratic, steady)
- A **timing window** at the end: player must click at the right moment to reel in
- Failure = fish escapes (no loot, still costs durability)
- The combination of random delays, variable patterns, and precision timing makes botting impractical

**Additional anti-bot measures:**
- Occasional "snap check": if player reels too early or with inhuman consistency, line snaps
- Randomized catch windows that shift per attempt
- Rod durability loss on every cast (bots burn through rods fast)

## Tier/Progression Sketch

| Tier | Rod Name | Access | Durability | Loot Pool | Upgrade Cost |
|------|----------|--------|------------|-----------|-------------|
| T1 | Crude Fishing Rod | Starting / bought cheaply | 30 | Common fish only (Mudfish, River Perch) | — |
| T2 | Sturdy Fishing Rod | 50 upgrade pts + 10 Linen | 50 | + Silverscale Trout, chance at T1 rings | 50 pts + 10 Linen |
| T3 | Reinforced Fishing Rod | 100 upgrade pts + 15 Iron Bars | 75 | + Golden Carp, Ashfin Eel, T1-T2 rings/amulets | 100 pts + 15 Iron Bars |
| T4 | Master Fishing Rod | 200 upgrade pts + 10 Steel Ingots + 5 Silk | 100 | + Deep Lurker, Mistscale, T2-T3 rings/amulets | 200 pts + materials |
| T5 | Legendary Ashen Rod | 500 upgrade pts + rare quest chain | 150 | + Abyssal Leviathan Fin, T3-T4 rare rings/amulets | 500 pts + quest |

## Ring & Amulet Equipment Slots (New)

**New ItemCategory values**: `'ring'`, `'amulet'`
**New EquipSlot values**: `'ring'`, `'amulet'`
**New EquipmentSlotsDto fields**: `ring: InventorySlotDto | null`, `amulet: InventorySlotDto | null`

| Item | Tier | Source | Stats |
|------|------|--------|-------|
| Copper River Ring | T1 | Fishing (T2+ rod) | +2 defence |
| Silverscale Band | T2 | Fishing (T3+ rod) | +3 dodge_chance |
| Ashfin Loop | T3 | Fishing (T4+ rod) | +5 crit_chance, +2 mana_regen |
| Leviathan's Coil | T4 | Fishing (T5 rod, very rare) | +8 crit_damage, +5 dodge_chance |
| Tarnished River Pendant | T1 | Fishing (T2+ rod) | +3 max_mana |
| Mistscale Amulet | T2 | Fishing (T3+ rod) | +5 mana_regen |
| Deep Current Charm | T3 | Fishing (T4+ rod) | +4 mana_on_hit, +3 defence |
| Abyssal Talisman | T4 | Fishing (T5 rod, very rare) | +10 max_mana, +5 mana_regen, +3 crit_chance |

## Rod Durability & Repair
- Every cast costs 1 durability regardless of success/failure
- At **1 durability**, rod is **locked** — cannot fish, cannot be destroyed, must be repaired
- Repair at Fisherman NPC: costs crowns (scaling with rod tier) + a small resource cost
- Repair restores to full durability
- This is a **crown sink** that scales with progression

## Daily Quest Examples
| Quest | Requirement | Reward |
|-------|-------------|--------|
| River Bounty | Catch 5 Mudfish | 10 Rod Upgrade Points + 5 Crowns |
| Silver Haul | Catch 3 Silverscale Trout | 20 Rod Upgrade Points + 10 Crowns |
| The Elusive Carp | Catch 1 Golden Carp | 35 Rod Upgrade Points + 20 Crowns |
| Deep Water Challenge | Catch 2 Ashfin Eels | 30 Rod Upgrade Points + 15 Crowns |

## Dependencies
- **Requires**: At least one water-adjacent building to place fishing gathering action; existing tool/durability system; existing quest system with daily quest support; existing crafting NPC for cooking recipes
- **Builds on**: Gathering system (`tool_type` + durability), quest system (daily quests), equipment system (new slots), crafting system (cooking recipes), marketplace (tradeable fish + jewelry)

## Open Questions
- [ ] Which existing building(s) should host fishing spots? Or do we need a new "Dock" / "Riverside" building?
- [ ] Should rod upgrade points be a visible currency in inventory, or tracked internally per-character?
- [ ] How should the mini-game render in Phaser? Overlay scene? Modal UI panel? (Engine consideration)
- [ ] Should rings/amulets drop ONLY from fishing, or also from other sources (combat, quests) to avoid fishing being mandatory?
- [ ] Cooking system doesn't exist yet — should fish just be "food" items directly, or do we need a cook NPC + recipes first?
- [ ] Should there be a "fishing level" or is rod tier sufficient as the progression metric?
- [ ] How many daily quests should be available simultaneously? (All 4? Random 2 of 4?)
