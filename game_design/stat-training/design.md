# Stat Training via NPCs — Consumable Item Training System

## Context

The current stat allocation system grants 7 points per level, but each stat can grow up to 10 points per level — meaning a level 20 character has 133 unspent points but 1000 possible stat points across 5 attributes. Players can never come close to maxing out through level-up points alone.

This design introduces **NPC stat trainers** — specialized NPCs who accept consumable items in exchange for a *chance* to permanently increase a specific attribute by 1 point. Each stat has its own item line with multiple tiers (grades), and each tier has a base success probability that decays as the character's level increases. Higher-tier items are harder to craft but maintain high success rates at higher levels.

This creates:
- A **long-term progression loop** beyond level-up point allocation
- **Crafting demand** for new item lines tied to character growth
- **Risk/reward decisions** — use cheap items with low odds, or invest in expensive ones
- **Stat specialization** — players can grind toward maxing a specific stat over time
- **Economy sinks** — consumable items + crown costs for training attempts

---

## Tier Design

Each stat has 3 training item tiers. Success chance uses a formula:

**Success % = base_chance - (character_level * decay_per_level)**

Minimum success chance is clamped at 5% (never zero).

| Tier | Base Chance | Decay/Level | Effective at Lv5 | Effective at Lv10 | Effective at Lv20 | Effective at Lv30 |
|------|-------------|-------------|-------------------|--------------------|--------------------|---------------------|
| T1 (Common) | 95% | 3%/level | 85% | 65% | 35% | 5% |
| T2 (Uncommon) | 95% | 1.5%/level | 88% | 80% | 65% | 50% |
| T3 (Rare) | 95% | 0.5%/level | 93% | 90% | 85% | 80% |

T1 items are easy to obtain (simple crafting, cheap). T2 require more complex recipes. T3 require rare drops and expensive ingredients.

---

## Stat-to-Item Mapping

| Stat | Theme | T1 Item | T2 Item | T3 Item | Trainer NPC |
|------|-------|---------|---------|---------|-------------|
| Strength | Alcohol | Barley Beer | Spiced Wine | Dwarven Vodka | Bruna the Brewmistress |
| Constitution | Fish | Smoked Mudfish | Cured Silverscale | Leviathan Jerky | Harlen the Fisherman (existing) |
| Intelligence | Minerals | Raw Quartz | Polished Amethyst | Arcane Crystal | Lysara the Sage |
| Dexterity | Oils & Salves | Sinew Oil | Vipervenom Salve | Shadowstep Tincture | Kael the Swift |
| Toughness | Metals | Iron Filings | Tempered Steel Dust | Mythril Essence | Torvan the Smith (existing) |

---

## Items to Create (15 total)

### Strength Training Items (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | Barley Beer | 10 | A frothy mug of barley beer. Crude, but it loosens the muscles for training. |
| 2 | Spiced Wine | 10 | Dark wine steeped with juniper and clove. Warms the blood and hardens the sinew. |
| 3 | Dwarven Vodka | 5 | A clear, brutally strong spirit distilled from mountain grain. Burns going down, builds steel going in. |

### Constitution Training Items (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 4 | Smoked Mudfish | 10 | Mudfish dried over low coals until the flesh turns dark and chewy. Builds endurance in those who eat it regularly. |
| 5 | Cured Silverscale | 10 | Silverscale trout preserved in salt and herbs. The dense, oily meat fortifies the body over time. |
| 6 | Leviathan Jerky | 5 | Strips of deep lurker flesh cured with sea salt and ashfin oil. Eating it feels like swallowing iron. |

### Intelligence Training Items (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 7 | Raw Quartz | 10 | A cloudy quartz crystal. When held during meditation, it sharpens focus. |
| 8 | Polished Amethyst | 10 | A violet gemstone polished to a mirror finish. Channels arcane energy into the mind. |
| 9 | Arcane Crystal | 5 | A crystalline shard that hums with latent power. Expands the boundaries of the intellect. |

### Dexterity Training Items (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 10 | Sinew Oil | 10 | A slick oil rendered from animal tendons. Loosens joints and quickens reflexes. |
| 11 | Vipervenom Salve | 10 | A numbing salve made from diluted viper venom. Sharpens nerve response when applied. |
| 12 | Shadowstep Tincture | 5 | A dark tincture brewed from nightbloom petals. Heightens awareness to preternatural levels. |

### Toughness Training Items (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 13 | Iron Filings | 10 | Fine iron shavings mixed into a bitter drink. Hardens skin and bone over time. |
| 14 | Tempered Steel Dust | 10 | Powdered tempered steel suspended in oil. Strengthens the body's natural armor. |
| 15 | Mythril Essence | 5 | A luminous liquid distilled from mythril shards. Infuses the body with supernatural resilience. |

---

## NPCs to Create (3)

| NPC | Description | is_crafter | is_disassembler | is_trainer | Building Assignment |
|-----|-------------|------------|-----------------|------------|---------------------|
| Bruna the Brewmistress | A stout woman with ruddy cheeks and calloused hands. She brews drinks that can make a man strong — or kill him trying. | true | false | true | Fry'Shtack Coast Town (id 11) |
| Lysara the Sage | A gaunt scholar wrapped in faded robes, her eyes reflecting the cold light of crystals she keeps in her pockets. She studies the mind's connection to arcane minerals. | true | false | true | Mage Tover (id 14) |
| Kael the Swift | A lean, scarred man who moves like smoke. Former thief turned trainer, he teaches agility through pain and poison. | true | false | true | Farsi Village (id 9) |

**Existing NPCs to modify** (set `is_trainer = true` and use as stat trainers):
- **Harlen the Fisherman** (id 10) — Constitution trainer. Already at Docs (Elarion City). Also needs `is_crafter = true` for the fish curing recipes.
- **Torvan the Smith** (id 7) — Toughness trainer. Already at Quary.

---

## Crafting Recipes (15 total)

### At Bruna the Brewmistress (Strength)
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Brew Barley Beer | Flax x2, Water Wineskin x1 | 3x Barley Beer | 5 | 15s |
| Brew Spiced Wine | Herb x3, Flax x2, Water Wineskin x1 | 2x Spiced Wine | 15 | 30s |
| Distill Dwarven Vodka | Barley Beer x3, Herb x2, Charite x1 | 1x Dwarven Vodka | 40 | 60s |

### At Harlen the Fisherman (Constitution) — existing NPC, new recipes
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Smoke Mudfish | Mudfish x3, Wood x2 | 3x Smoked Mudfish | 5 | 15s |
| Cure Silverscale | Silverscale Trout x2, Herb x2, Linen x1 | 2x Cured Silverscale | 15 | 30s |
| Prepare Leviathan Jerky | Deep Lurker x2, Ashfin Eel x1, Charite x1 | 1x Leviathan Jerky | 40 | 60s |

### At Lysara the Sage (Intelligence)
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Shape Raw Quartz | Stone x5, Charite x1 | 3x Raw Quartz | 5 | 15s |
| Polish Amethyst | Raw Quartz x3, Cobalt Ore x2 | 2x Polished Amethyst | 15 | 30s |
| Crystallize Arcane Shard | Polished Amethyst x2, Mythril Shard x1, Cobalt Bar x1 | 1x Arcane Crystal | 40 | 60s |

### At Kael the Swift (Dexterity)
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Render Sinew Oil | Animal Skin x4, Herb x1 | 3x Sinew Oil | 5 | 15s |
| Brew Vipervenom Salve | Sinew Oil x2, Herb x3, Linen x1 | 2x Vipervenom Salve | 15 | 30s |
| Distill Shadowstep Tincture | Vipervenom Salve x2, Titanite Dust x1, Charite x2 | 1x Shadowstep Tincture | 40 | 60s |

### At Torvan the Smith (Toughness) — existing NPC, new recipes
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| Grind Iron Filings | Iron Bar x1, Stone x3 | 3x Iron Filings | 5 | 15s |
| Temper Steel Dust | Steel Bar x1, Iron Filings x2, Charite x1 | 2x Tempered Steel Dust | 15 | 30s |
| Extract Mythril Essence | Mythril Shard x2, Tempered Steel Dust x2, Brass Bar x1 | 1x Mythril Essence | 40 | 60s |

---

## Economy Flow

```
GATHERING/COMBAT                    CRAFTING                         TRAINING
─────────────────                   ────────                         ────────
Flax, Water Wineskin  ──► Bruna  ──► Barley Beer (T1)  ──► Bruna  ──► +1 STR (chance)
Herb, Flax            ──► Bruna  ──► Spiced Wine (T2)  ──► Bruna  ──► +1 STR (chance)
Beer + Herb + Charite ──► Bruna  ──► Dwarven Vodka(T3) ──► Bruna  ──► +1 STR (chance)

Mudfish, Wood         ──► Harlen ──► Smoked Mudfish(T1) ──► Harlen ──► +1 CON (chance)
Stone, Charite        ──► Lysara ──► Raw Quartz (T1)   ──► Lysara ──► +1 INT (chance)
Animal Skin, Herb     ──► Kael   ──► Sinew Oil (T1)    ──► Kael   ──► +1 DEX (chance)
Iron Bar, Stone       ──► Torvan ──► Iron Filings (T1) ──► Torvan ──► +1 TOU (chance)
```

**Cost analysis for 1x Dwarven Vodka (T3 Strength)**:
- 3x Barley Beer = 3x (Flax x2 + Water Wineskin x1 + 5cr) = Flax x6, Water Wineskin x3, 15cr
- Water Wineskin needs Wineskin (5cr at Tessa) = 15cr for wineskins
- + Herb x2, Charite x1, 40cr craft cost
- **Total**: Flax x6, Herb x2, Wineskin x3, Charite x1 + 70 crowns
- This is expensive but gives 80%+ success even at level 30

**Cost analysis for 1x Raw Quartz (T1 Intelligence)**:
- Stone x5, Charite x1, 5cr
- Very cheap — but only useful at low levels (35% at lv20, 5% at lv30)

---

## Code Changes Required

This design requires a **new game mechanic** — NPC stat training via consumable items is not supported by the existing training system (which only allocates level-up points). The new system needs:

### Summary
| Change | Scope | Description |
|--------|-------|-------------|
| DB migration | backend | New `stat_training_items` table mapping items to stats/tiers; new `is_stat_trainer` flag or reuse `is_trainer` with specialization |
| WebSocket messages | shared/backend/frontend | New `stat-training.open`, `stat-training.attempt` messages |
| Backend handler | backend | New stat training handler with probability calculation, item consumption, stat increment |
| Frontend UI | frontend | New dialog option for stat trainers, training attempt modal with success/failure feedback |
| Admin support | admin | Admin route to manage stat training item mappings |

### Detailed Requirements

1. **DB Migration (`034_stat_training.sql`)**:
   Create a `stat_training_items` table:
   ```sql
   CREATE TABLE stat_training_items (
     id SERIAL PRIMARY KEY,
     item_def_id INTEGER NOT NULL REFERENCES item_definitions(id),
     stat_name TEXT NOT NULL CHECK (stat_name IN ('constitution', 'strength', 'intelligence', 'dexterity', 'toughness')),
     tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
     base_chance SMALLINT NOT NULL CHECK (base_chance BETWEEN 1 AND 100),
     decay_per_level NUMERIC(4,2) NOT NULL CHECK (decay_per_level > 0),
     npc_id INTEGER NOT NULL REFERENCES npcs(id),
     UNIQUE (item_def_id)
   );
   ```
   The `npc_id` column links each training item to the specific NPC who accepts it. This allows the handler to validate that the player is at the correct NPC.

   Additionally, add a column to NPCs to indicate which stat they train:
   ```sql
   ALTER TABLE npcs ADD COLUMN trainer_stat TEXT DEFAULT NULL 
     CHECK (trainer_stat IS NULL OR trainer_stat IN ('constitution', 'strength', 'intelligence', 'dexterity', 'toughness'));
   ```

2. **Shared Protocol Types** (`shared/protocol/index.ts`):
   - `StatTrainingOpenPayload { npc_id: number }` — client requests available training items
   - `StatTrainingStatePayload { stat_name: string, items: StatTrainingItemDto[], current_value: number, per_stat_cap: number }` — server sends available training items with computed success chances
   - `StatTrainingItemDto { item_def_id: number, name: string, icon_url: string|null, tier: number, success_chance: number, owned_quantity: number }` — each item the player owns that can be used
   - `StatTrainingAttemptPayload { npc_id: number, item_def_id: number }` — client attempts training
   - `StatTrainingResultPayload { success: boolean, stat_name: string, new_value: number, message: string }` — server reports outcome

3. **Backend Handler** (`backend/src/game/training/stat-training-handler.ts`):
   - `stat-training.open`: Validate NPC has `trainer_stat` set. Query `stat_training_items` for that NPC. Check player inventory for matching items. Compute success chance per item: `max(5, base_chance - character.level * decay_per_level)`. Send state to client.
   - `stat-training.attempt`: Validate NPC, validate player has the item in inventory, validate stat isn't at cap. Consume 1x item from inventory. Roll RNG against computed success chance. If success: increment `attr_<stat>` by 1, recalculate derived stats, persist. Send result message. The stat cap is still `MAX_POINTS_PER_STAT_PER_LEVEL * (level - 1)` — training items compete with level-up point allocation for the same cap.
   - **Important**: Training item stat points share the same cap as allocated stat points. A point gained from training is identical to one allocated manually — it's just another way to fill the pool.

4. **Frontend UI**:
   - In `BuildingPanel.ts`: For NPCs with `trainer_stat` set, add a dialog option "Train [Stat Name]" that opens the stat training modal.
   - New `StatTrainingModal` (or extend existing `TrainingModal`): Shows the stat name, current value, cap, and a list of consumable items the player owns with their success percentages. Clicking an item triggers `stat-training.attempt`. Shows animated success/failure result.

5. **Admin Backend** (`admin/backend/src/routes/stat-training.ts`):
   - CRUD endpoints for `stat_training_items` table
   - Ability to map items to stats with tier/chance/decay configuration

### Implementation Sequence
1. `/speckit.specify` — Create technical spec from this section
2. `speckit.plan` -> `speckit.tasks` -> `speckit.implement` — Build the code
3. `/gd.execute` — Create entities via admin API (requires the code to be in place)

---

## Execution Plan

All content created via the `game-entities` skill (admin REST API). Order matters for FK constraints.

### Phase 1 — Training Items, NPCs, Recipes

**Pre-requisite**: Code changes from above must be implemented first (migration, handler, frontend).

1. **Create 15 training items** — All category `resource`, stackable
2. **Create 3 new NPCs** — Bruna (crafter+trainer), Lysara (crafter+trainer), Kael (crafter+trainer)
3. **Update 2 existing NPCs** — Set `is_trainer = true` and `trainer_stat` on Harlen the Fisherman (constitution, also set `is_crafter = true`) and Torvan the Smith (toughness)
4. **Assign 3 new NPCs to buildings** — Bruna → Fry'Shtack Coast Town (11), Lysara → Mage Tover (14), Kael → Farsi Village (9)
5. **Create 15 crafting recipes** — 3 per trainer NPC, referencing item IDs from step 1
6. **Insert stat_training_items rows** — Map each training item to its stat, tier, base_chance, decay_per_level, and NPC via admin API or direct SQL

### Phase 2 — Future Expansion (deferred)

- **T4 items**: Ultra-rare drops from bosses, 95% base / 0.2% decay — endgame training for level 40+
- **Training cooldowns**: Prevent spam-training (e.g., 1 attempt per stat per 5 minutes)
- **Training milestones**: Achievement-style rewards at stat thresholds (e.g., "Reach 50 Strength")
- **Stat reset NPC**: Allow resetting allocated + trained points for a large crown cost

---

## Stat Training Configuration Data

After all items and NPCs are created, these rows go into `stat_training_items`:

| Item | Stat | Tier | Base Chance | Decay/Level | Trainer NPC |
|------|------|------|-------------|-------------|-------------|
| Barley Beer | strength | 1 | 95 | 3.0 | Bruna the Brewmistress |
| Spiced Wine | strength | 2 | 95 | 1.5 | Bruna the Brewmistress |
| Dwarven Vodka | strength | 3 | 95 | 0.5 | Bruna the Brewmistress |
| Smoked Mudfish | constitution | 1 | 95 | 3.0 | Harlen the Fisherman |
| Cured Silverscale | constitution | 2 | 95 | 1.5 | Harlen the Fisherman |
| Leviathan Jerky | constitution | 3 | 95 | 0.5 | Harlen the Fisherman |
| Raw Quartz | intelligence | 1 | 95 | 3.0 | Lysara the Sage |
| Polished Amethyst | intelligence | 2 | 95 | 1.5 | Lysara the Sage |
| Arcane Crystal | intelligence | 3 | 95 | 0.5 | Lysara the Sage |
| Sinew Oil | dexterity | 1 | 95 | 3.0 | Kael the Swift |
| Vipervenom Salve | dexterity | 2 | 95 | 1.5 | Kael the Swift |
| Shadowstep Tincture | dexterity | 3 | 95 | 0.5 | Kael the Swift |
| Iron Filings | toughness | 1 | 95 | 3.0 | Torvan the Smith |
| Tempered Steel Dust | toughness | 2 | 95 | 1.5 | Torvan the Smith |
| Mythril Essence | toughness | 3 | 95 | 0.5 | Torvan the Smith |

---

## Testing Walkthrough

### Test 1: Low-Level Strength Training (Happy Path)
1. **Create a level 5 character** — should have `attr_strength = 0` and some unspent points
2. **Craft 3x Barley Beer** at Bruna (Flax x2, Water Wineskin x1, 5cr)
3. **Talk to Bruna** — click "Train Strength" dialog option
4. **Training modal opens** — shows Barley Beer with 85% success chance (95 - 5*3 = 80... wait, level 5: 95 - 5*3 = 80%). Shows current strength value and cap.
5. **Click Barley Beer** — item consumed, RNG rolls. ~80% chance of success.
6. **If success** — "Your muscles burn with new power. Strength increased!" attr_strength goes from 0 to 1. Derived stats update (attack +2, crit_damage +0.3%).
7. **If failure** — "The training has no lasting effect. Try again." Item still consumed.

### Test 2: High-Level Training Economics
1. **Level 20 character** tries Barley Beer — success chance is 95 - 20*3 = 35%. Low odds.
2. **Same character** tries Spiced Wine — success chance is 95 - 20*1.5 = 65%. Much better.
3. **Same character** tries Dwarven Vodka — success chance is 95 - 20*0.5 = 85%. Excellent but expensive.

### Test 3: Cap Enforcement
1. **Character has attr_strength = per_stat_cap** (e.g., level 10, cap 90, strength already 90)
2. **Attempt training** — server rejects: "Your strength has reached its maximum for your level."
3. **Verify item is NOT consumed** when cap prevents training

### Test 4: Wrong NPC Validation
1. **Take Barley Beer to Lysara** (intelligence trainer) — should NOT show Beer as trainable
2. **Verify** only intelligence items appear at Lysara's training dialog

### Test 5: All 5 Stats
1. **Visit each trainer NPC** — verify correct dialog option appears
2. **Train each stat once** with T1 item — verify stat increments correctly
3. **Verify derived stats** update properly for each (HP for CON, Attack for STR, Mana for INT, Dodge/Crit for DEX, Defence for TOU)

---

## Verification Checklist
- [ ] 15 training items created and visible in inventory
- [ ] 3 new NPCs created and assigned to buildings
- [ ] 2 existing NPCs updated with trainer_stat
- [ ] 15 crafting recipes functional
- [ ] stat_training_items table populated with all 15 mappings
- [ ] Training dialog option appears for trainer NPCs
- [ ] Item consumption works on training attempt
- [ ] Success/failure RNG follows the formula
- [ ] Stat cap enforcement prevents over-training
- [ ] Derived stats recalculate after successful training
- [ ] T1/T2/T3 success rates match the tier design table
- [ ] No duplicate items with existing content (checked: no conflicts with existing 72 items)
