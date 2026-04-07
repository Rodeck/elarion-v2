# Allomantic Spells — Metal-Burning Magic System

## Context

The Allomancy foundation (metal economy) provides ores, bars, and alloys. This design adds the **consumption layer** — seven spells, each fueled by burning a specific metal. Every spell maps to one of the seven effect types in the spell system, creating a 1:1 relationship between metals and magical effects.

The existing metal economy gains a powerful new sink: warriors and mages burn bars for combat buffs, healing, and energy. Crafters who produce bars now serve both equipment crafting AND spell casting demand. Gatherers who mine ores feed both pipelines.

A new metal — **Pewter** — completes the set of seven, and a new NPC — **Elara the Inscriber** — crafts spell tomes from metal bars, creating the path to learn each spell.

**Core fantasy**: You are an Allomancer. You swallow metal and burn it inside your body to fuel supernatural abilities. Each metal grants a different power. The rarer the metal, the more devastating the effect.

---

## Metal → Spell Mapping

| Metal | Tier | Spell | Effect Type | Theme |
|-------|------|-------|-------------|-------|
| Iron Bar | T1 | Iron's Wrath | attack_pct | Raw iron fuels brute striking power |
| Copper Bar | T1 | Coppershield | defence_pct | Copper hardens skin into living armor |
| Zinc Bar | T2 | Zinc Sight | crit_chance_pct | Zinc sharpens perception to find weaknesses |
| Cobalt Bar | T2 | Cobalt Ruin | crit_damage_pct | Cobalt's deep fire makes critical hits devastating |
| Steel Bar | T3 | Steel Push | movement_speed | Steel propels the body with unnatural speed |
| Brass Bar | T3 | Brass Mending | heal | Brass releases golden warmth that knits flesh |
| Pewter Bar | T3 (NEW) | Pewter Surge | energy | Pewter floods muscles with raw endurance |

**Design principle**: T1 metals (common, easy to gather) fuel the workhorse buffs (attack, defence). T2 metals (uncommon, deeper mines) fuel precision effects (crit). T3 alloys (crafted, expensive) fuel utility and recovery (speed, heal, energy).

---

## Items to Create (8 total)

### New Metal (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | Pewter Bar | 20 | An alloy of iron and copper. Dull grey with a warm undertone, heavy in the hand. Grants raw endurance when burned. |

### Spell Tomes (category: spell_book_spell)
| # | Name | stack_size | spell_id | Description |
|---|------|-----------|----------|-------------|
| 2 | Tome of Iron's Wrath | 5 | [Iron's Wrath] | Iron-bound pages inscribed with burning glyphs. Reading it sears the knowledge of iron-burning into your mind. |
| 3 | Tome of Coppershield | 5 | [Coppershield] | Copper-clasped tome that hums with a protective resonance. The words within teach the art of copper-burning. |
| 4 | Tome of Zinc Sight | 5 | [Zinc Sight] | Pale blue tome edged in zinc filigree. Its teachings sharpen the mind's eye to see what others cannot. |
| 5 | Tome of Cobalt Ruin | 5 | [Cobalt Ruin] | Deep blue tome that pulses with inner heat. The incantations within unlock cobalt's devastating potential. |
| 6 | Tome of Steel Push | 5 | [Steel Push] | Grey-steel covers bound with wire. The techniques inscribed within teach the body to defy its own weight. |
| 7 | Tome of Brass Mending | 5 | [Brass Mending] | Golden-bound tome warm to the touch. Its healing verses teach the art of burning brass for restoration. |
| 8 | Tome of Pewter Surge | 5 | [Pewter Surge] | Heavy pewter-plated tome. The words within awaken the body's deepest reserves of stamina. |

---

## NPCs to Create (1)

| NPC | Description | is_crafter | is_disassembler | is_trainer | Building Assignment |
|-----|-------------|------------|-----------------|------------|---------------------|
| Elara the Inscriber | A pale woman with ink-stained fingers and eyes that glow faintly in dim light. She transcribes Allomantic knowledge into metal-bound tomes, working by candlelight in a workshop that smells of hot wax and burnt iron. | true | false | false | Forgotten Mines (12) |

---

## Spells to Create (7)

| # | Name | effect_type | base effect_value | base duration_seconds | Description |
|---|------|------------|-------------------|----------------------|-------------|
| 1 | Iron's Wrath | attack_pct | 15 | 120 | Channel the unyielding fury of raw iron through your veins. Your strikes fall like hammers on an anvil, each blow heavier than the last. |
| 2 | Coppershield | defence_pct | 15 | 120 | Wrap yourself in copper's ancient ward. Your skin takes on a faint greenish sheen as it hardens against blows that would fell lesser warriors. |
| 3 | Zinc Sight | crit_chance_pct | 8 | 90 | Burn zinc to see the world in crystalline clarity. Every gap in armor, every hesitation in your enemy's stance, becomes a target. |
| 4 | Cobalt Ruin | crit_damage_pct | 20 | 90 | Ignite the deep blue fire of cobalt within your blood. When your blade finds its mark, it strikes with the force of a collapsing mine shaft. |
| 5 | Steel Push | movement_speed | 15 | 120 | Burn steel to push against the weight of the world itself. Your movements become a blur of grey light as gravity loosens its grip. |
| 6 | Brass Mending | heal | 30 | 0 | Release the golden warmth trapped within brass. The heat seeps into your wounds, knitting flesh and mending bone in a wave of searing relief. |
| 7 | Pewter Surge | energy | 25 | 0 | Flood your body with pewter's raw endurance. Exhaustion melts away as your muscles burn with renewed vigor, ready to swing again. |

### Spell Level Scaling

#### Buff Spells (ongoing effects)

| Spell | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|-------|-----|-----|-----|-----|-----|
| Iron's Wrath | 15% / 120s | 25% / 180s | 35% / 240s | 45% / 300s | 60% / 360s |
| Coppershield | 15% / 120s | 25% / 180s | 35% / 240s | 45% / 300s | 60% / 360s |
| Zinc Sight | 8% / 90s | 12% / 120s | 18% / 180s | 25% / 240s | 35% / 300s |
| Cobalt Ruin | 20% / 90s | 35% / 120s | 50% / 180s | 70% / 240s | 100% / 300s |
| Steel Push | 15% / 120s | 25% / 180s | 35% / 240s | 50% / 300s | 70% / 360s |

#### Instant Spells (no duration)

| Spell | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|-------|-----|-----|-----|-----|-----|
| Brass Mending | 30 HP | 55 HP | 85 HP | 120 HP | 170 HP |
| Pewter Surge | 25 energy | 40 energy | 60 energy | 85 energy | 120 energy |

### Spell Casting Costs (per level)

Costs increase significantly at higher levels. Each cast consumes the metal bar + crowns.

#### Iron's Wrath (Iron Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Iron Bar | 5 |
| 2 | 2x Iron Bar | 10 |
| 3 | 3x Iron Bar | 20 |
| 4 | 4x Iron Bar | 35 |
| 5 | 5x Iron Bar | 50 |

#### Coppershield (Copper Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Copper Bar | 5 |
| 2 | 2x Copper Bar | 10 |
| 3 | 3x Copper Bar | 20 |
| 4 | 4x Copper Bar | 35 |
| 5 | 5x Copper Bar | 50 |

#### Zinc Sight (Zinc Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Zinc Bar | 8 |
| 2 | 1x Zinc Bar | 15 |
| 3 | 2x Zinc Bar | 25 |
| 4 | 3x Zinc Bar | 40 |
| 5 | 4x Zinc Bar | 60 |

#### Cobalt Ruin (Cobalt Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Cobalt Bar | 10 |
| 2 | 1x Cobalt Bar | 18 |
| 3 | 2x Cobalt Bar | 30 |
| 4 | 3x Cobalt Bar | 45 |
| 5 | 4x Cobalt Bar | 65 |

#### Steel Push (Steel Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Steel Bar | 15 |
| 2 | 1x Steel Bar | 25 |
| 3 | 2x Steel Bar | 40 |
| 4 | 2x Steel Bar | 60 |
| 5 | 3x Steel Bar | 80 |

#### Brass Mending (Brass Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Brass Bar | 15 |
| 2 | 1x Brass Bar | 25 |
| 3 | 2x Brass Bar | 40 |
| 4 | 2x Brass Bar | 60 |
| 5 | 3x Brass Bar | 85 |

#### Pewter Surge (Pewter Bar)
| Level | Metal Cost | Gold Cost |
|-------|-----------|-----------|
| 1 | 1x Pewter Bar | 10 |
| 2 | 1x Pewter Bar | 18 |
| 3 | 2x Pewter Bar | 30 |
| 4 | 2x Pewter Bar | 45 |
| 5 | 3x Pewter Bar | 65 |

---

## Crafting Recipes (8 total)

### At Varn Ashforge (Forgotten Mines, building 12)
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Forge Pewter Bar | 1x Iron Bar + 1x Copper Bar | 1x Pewter Bar | 10 | 45s |

### At Elara the Inscriber (Forgotten Mines, building 12)
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Inscribe Iron's Wrath | 3x Iron Bar + 2x Charite | 1x Tome of Iron's Wrath | 20 | 30s |
| Inscribe Coppershield | 3x Copper Bar + 2x Charite | 1x Tome of Coppershield | 20 | 30s |
| Inscribe Zinc Sight | 2x Zinc Bar + 2x Charite | 1x Tome of Zinc Sight | 30 | 45s |
| Inscribe Cobalt Ruin | 2x Cobalt Bar + 2x Charite | 1x Tome of Cobalt Ruin | 35 | 45s |
| Inscribe Steel Push | 2x Steel Bar + 1x Charite | 1x Tome of Steel Push | 40 | 60s |
| Inscribe Brass Mending | 2x Brass Bar + 1x Charite | 1x Tome of Brass Mending | 45 | 60s |
| Inscribe Pewter Surge | 2x Pewter Bar + 1x Charite | 1x Tome of Pewter Surge | 35 | 60s |

---

## Economy Flow

```
GATHER ──► Raw Ores ──► SMELT (Magra) ──► Bars ──► ALLOY (Varn) ──► Alloy Bars
                                            │                            │
                                            ▼                            ▼
                                    INSCRIBE (Elara)            INSCRIBE (Elara)
                                            │                            │
                                            ▼                            ▼
                                      Spell Tomes ──► LEARN SPELL (use tome)
                                                              │
                                                              ▼
                                                    CAST SPELL (burns bars)
                                                              │
                                                              ▼
                                                    Ongoing metal demand
                                                    (bars consumed per cast)
```

**Cost analysis for 1x Lv5 Iron's Wrath cast**:
- 5x Iron Bar = 15x Iron Ore + 5x Charite + 10 crowns smelt cost
- + 50 crowns cast cost
- **Total**: 15 Iron Ore + 5 Charite + 60 crowns per cast

**Cost analysis for 1x Lv5 Steel Push cast**:
- 3x Steel Bar = 6x Iron Bar + 3x Zinc Bar = 18 Iron Ore + 15 Zinc Ore + 12 Charite + 69 crowns smelt/forge cost
- + 80 crowns cast cost
- **Total**: 18 Iron Ore + 15 Zinc Ore + 12 Charite + 149 crowns per cast

**Cost to learn a spell** (Tome of Steel Push):
- 2x Steel Bar + 1x Charite + 40 crowns
- = 4 Iron Bar + 2 Zinc Bar + 1 Charite + 70 crowns total material chain

---

## Code Changes Required

None — entities only. All 7 spell effect types (`attack_pct`, `defence_pct`, `crit_chance_pct`, `crit_damage_pct`, `heal`, `movement_speed`, `energy`) are already implemented in the spell system. Spell books (`spell_book_spell` category), spell levels, spell costs, and buff application are all functional.

The only prerequisite is that the **allomancy metal items** from `game_design/allomancy/design.md` must be executed first (or alongside this design), since spells consume metal bars and tomes require bars as ingredients.

---

## Execution Plan

All content is created via the `game-entities` skill (admin REST API). Order matters for FK constraints.

### Prerequisites
- **Allomancy metal economy must be executed first** — Iron Bar, Copper Bar, Zinc Bar, Cobalt Bar, Steel Bar, Brass Bar, Charite must exist as items. If not yet created, execute `game_design/allomancy/design.md` Phase 1 first.

### Phase 1 — Metal Spells (this execution)

1. **Create 1 item** — Pewter Bar (resource, stack 20)
2. **Create 1 crafting recipe** — Forge Pewter Bar at Varn Ashforge (requires Pewter Bar item ID + Varn NPC ID + Iron Bar ID + Copper Bar ID)
3. **Create 7 spells** — Iron's Wrath, Coppershield, Zinc Sight, Cobalt Ruin, Steel Push, Brass Mending, Pewter Surge (with effect_type, base effect_value, base duration_seconds)
4. **Set spell levels** — 5 levels per spell (effect_value, duration_seconds, gold_cost for each)
5. **Set spell costs** — Item costs per level (metal bar item_def_id + quantity for each level of each spell)
6. **Create 7 spell tome items** — Tome of [Spell Name] (category: spell_book_spell, linked to spell_id)
7. **Create 1 NPC** — Elara the Inscriber (is_crafter: true)
8. **Assign Elara to building** — Forgotten Mines (building 12)
9. **Create 7 crafting recipes** — Inscribe [Spell Name] at Elara (requires tome item IDs + metal bar IDs + Charite ID + Elara NPC ID)

### Phase 2 — Boss Spell Tome Drops (future)
1. Add spell tome drops to boss loot tables (Ore Golem, etc.)
2. Add rare tome drops to Ashvein Lurker and high-tier expedition rewards
3. Consider Mythril-enhanced spell variants (Lv6+ with Mythril Shard costs)

---

## Testing Walkthrough

All locations are on **Zone 2 — Ulysses Peninsula**.

### Test 1: Learn a T1 Spell (Iron's Wrath)

1. **Get Iron Bars** — mine Iron Ore at Quarry (building 13), smelt at Magra
2. **Get Charite** — buy from Magra (5 crowns → 3x Charite)
3. **Travel to Forgotten Mines (building 12)** → find Elara the Inscriber
4. **Craft "Inscribe Iron's Wrath"** — 3x Iron Bar + 2x Charite + 20 crowns → Tome of Iron's Wrath
5. **Use the tome** from inventory → learn Iron's Wrath spell
6. **Verify**: Spell appears in spell panel at Level 1

### Test 2: Cast Iron's Wrath (Lv1)

7. **Ensure you have 1x Iron Bar + 5 crowns** in inventory
8. **Open spell panel** → select Iron's Wrath → Cast
9. **Verify**: Iron Bar consumed, 5 crowns deducted, attack buff applied (15% for 120s)
10. **Check buff bar** — Iron's Wrath buff visible with countdown timer
11. **Enter combat** — verify attack stat is increased by 15%

### Test 3: Craft and Cast a T3 Spell (Steel Push)

12. **Forge Steel Bars** — at Varn Ashforge (2x Iron Bar + 1x Zinc Bar → Steel Bar)
13. **Craft "Inscribe Steel Push"** — at Elara (2x Steel Bar + 1x Charite + 40 crowns)
14. **Use tome** → learn Steel Push
15. **Cast Steel Push** — 1x Steel Bar + 15 crowns → 15% movement speed for 120s
16. **Verify**: Movement speed visually faster on map

### Test 4: Instant Spells (Brass Mending + Pewter Surge)

17. **Learn Brass Mending** via tome
18. **Take damage** (fight a monster, take some HP loss)
19. **Cast Brass Mending** — 1x Brass Bar + 15 crowns → restore 30 HP instantly
20. **Verify**: HP increases, no ongoing buff (instant effect)
21. **Learn Pewter Surge** via tome
22. **Deplete some energy** (gather, travel)
23. **Cast Pewter Surge** — 1x Pewter Bar + 10 crowns → restore 25 energy instantly

### Test 5: Pewter Bar Crafting

24. **At Varn Ashforge** — craft "Forge Pewter Bar" (1x Iron Bar + 1x Copper Bar + 10 crowns)
25. **Verify**: Pewter Bar appears in inventory (stack 20, resource category)

### Test 6: Level Up a Spell

26. **Craft multiple Tomes of Iron's Wrath**
27. **Use tomes** → gain spell progress points
28. **Level up** Iron's Wrath to Lv2
29. **Cast at Lv2** — 2x Iron Bar + 10 crowns → 25% attack for 180s
30. **Verify**: Higher effect and longer duration than Lv1

---

## Verification Checklist

- [ ] Pewter Bar item created (resource, stack 20)
- [ ] Pewter Bar recipe works at Varn (1 Iron + 1 Copper → 1 Pewter)
- [ ] All 7 spells created with correct effect_types
- [ ] All spell levels (1-5) configured with scaling values
- [ ] All spell costs configured (correct metal bar + gold per level)
- [ ] All 7 spell tome items created (spell_book_spell category, linked to spells)
- [ ] Elara the Inscriber NPC created and assigned to Forgotten Mines (12)
- [ ] All 7 inscription recipes work at Elara
- [ ] Using a tome teaches the spell
- [ ] Casting a buff spell applies the buff with correct % and duration
- [ ] Casting heal/energy spells restores the correct amount instantly
- [ ] Metal bars are consumed on cast
- [ ] Gold is deducted on cast
- [ ] Higher spell levels consume more bars and gold
- [ ] No duplicate spells or items with existing content
- [ ] Spell tomes stack correctly (max 5)
- [ ] Cast on player works for buff spells (target another player)
