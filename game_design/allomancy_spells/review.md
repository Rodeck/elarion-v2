# Allomantic Spells — Balance Review

## Summary Verdict

| Category | Status | Notes |
|----------|--------|-------|
| Stat Curve Fit | PASS | Spell effects scale reasonably across 5 levels |
| Economy Flow | PASS | Heavy crown + material sinks; creates sustained metal demand |
| Loot Tables | N/A | No new monster loot in this design |
| Crafting Costs | PASS | Tome recipes use appropriate T1/T2/T3 ingredients |
| Time-to-Reward | PASS | Learn a spell in ~5min gather+craft; each cast 1-5 bars ongoing |
| Power Progression | WARN | Cobalt Ruin Lv5 (+100% crit damage) is very strong; see below |
| Completeness | PASS | All referenced items exist in DB; dependency order correct |
| Naming Conflicts | WARN | Test spells (Haste, Hammer) overlap effect types; must delete first |

**Overall Verdict**: Ready to execute — after addressing 1 critical issue (test spell cleanup) and 1 warning (Cobalt Ruin tuning)

---

## Existing Test Spells Conflict (CRITICAL)

Two test spells already exist in the database:

| Test Spell | Effect Type | Metal Used | Values |
|------------|------------|-----------|--------|
| Haste (id 1) | movement_speed | Iron Bar | 50-150%, 3600s, 0 gold |
| Hammer of The Second (id 2) | crit_chance_pct | Brass Bar | 50-90%, 120s, 0 gold |

**Conflicts with new design:**
- `movement_speed` → Design assigns to **Steel Bar** (Steel Push), test uses **Iron Bar**
- `crit_chance_pct` → Design assigns to **Zinc Bar** (Zinc Sight), test uses **Brass Bar**
- Test values are wildly unbalanced (Haste: 50% speed for 1 HOUR, zero cost)
- 1 character has learned each test spell

**Resolution**: Delete both test spells before executing the new design. Use admin API or direct SQL:
```sql
DELETE FROM active_spell_buffs WHERE spell_id IN (1, 2);
DELETE FROM character_spells WHERE spell_id IN (1, 2);
DELETE FROM spell_costs WHERE spell_id IN (1, 2);
DELETE FROM spell_levels WHERE spell_id IN (1, 2);
DELETE FROM spells WHERE id IN (1, 2);
```

---

## Power Progression Analysis

### Buff Spells — Effect Values vs Level

| Spell | Lv1 | Lv5 | Growth | Duration Lv5 | Comparable |
|-------|-----|-----|--------|-------------|-----------|
| Iron's Wrath (ATK%) | 15% | 60% | 4x | 360s (6min) | Reasonable — a mid-tier weapon (23 ATK) gets +14 ATK at Lv5 |
| Coppershield (DEF%) | 15% | 60% | 4x | 360s | Reasonable — full T4 armor (~75 DEF) gets +45 DEF at Lv5 |
| Zinc Sight (crit%) | 8% | 35% | 4.4x | 300s | Strong — at 10 DEX (1% base), this adds 35% flat crit |
| Cobalt Ruin (crit dmg%) | 20% | 100% | 5x | 300s | **Very strong** — base 150% becomes 250% crit damage |
| Steel Push (speed%) | 15% | 70% | 4.7x | 360s | Reasonable — compare to deleted Haste (50-150%) |

### Instant Spells

| Spell | Lv1 | Lv5 | Context |
|-------|-----|-----|---------|
| Brass Mending (HP) | 30 | 170 | Herb Potion heals 15. Lv5 = ~11 potions. Fair for cost (3 Brass + 85g) |
| Pewter Surge (energy) | 25 | 120 | Max energy is 100 base. Lv5 restores full bar + 20% overflow (capped by LEAST) |

### Concern: Cobalt Ruin + Zinc Sight Stacking

A player with both Zinc Sight Lv5 (35% crit) and Cobalt Ruin Lv5 (250% crit damage) creates a powerful burst build:
- **Cost per combo**: 4 Zinc Bars + 4 Cobalt Bars + 125 crowns per 5min window
- **Material chain**: 20 Zinc Ore + 20 Cobalt Ore + ~16 Charite + ~200 crowns total
- This is expensive enough to gate behind serious gathering investment. **Acceptable** — high cost, high reward.

**Recommendation**: Keep Cobalt Ruin Lv5 at 100%. The material cost (4 Cobalt Bars per cast = 20 Cobalt Ore from the hardest gathering location) provides sufficient gating.

---

## Economy Flow Analysis

### New Crown Sinks

| Sink | Cost per Use | Frequency |
|------|-------------|-----------|
| Spell casting (Lv1, T1 metal) | 5 crowns | Frequent |
| Spell casting (Lv5, T3 metal) | 65-85 crowns | Moderate |
| Tome inscription (T1) | 20 crowns | One-time per spell per player |
| Tome inscription (T3) | 35-45 crowns | One-time per spell per player |
| Pewter Bar forging | 10 crowns | Per bar |

**Active player spell usage estimate**: A player casting 2-3 buffs before combat at Lv3:
- Iron's Wrath: 3 Iron Bars + 20g
- Zinc Sight: 2 Zinc Bars + 25g  
- Steel Push: 2 Steel Bars + 40g
- **Per session**: ~85 crowns + 7 bars consumed

**Net impact**: Significant new crown sink. Currently the economy has recipe costs up to 50 crowns. Spell casting adds 5-85 crowns per cast as a repeating sink. This is healthy — creates ongoing demand vs one-time crafting.

### Metal Demand Created

| Metal | Spell Demand (per cast) | Existing Uses | Impact |
|-------|------------------------|---------------|--------|
| Iron Bar | 1-5 (Iron's Wrath) | Pickaxes, Steel alloy, Iron Filings | High demand — T1 metal becomes critical |
| Copper Bar | 1-5 (Coppershield) | Brass alloy | Moderate increase |
| Zinc Bar | 1-4 (Zinc Sight) | Steel alloy | Moderate increase |
| Cobalt Bar | 1-4 (Cobalt Ruin) | Brass alloy | Moderate increase |
| Steel Bar | 1-3 (Steel Push) | Pickaxes, Tempered Steel Dust | High demand — alloy + spell |
| Brass Bar | 1-3 (Brass Mending) | Mythril Essence recipe | High demand — alloy + spell |
| Pewter Bar | 1-3 (Pewter Surge) | NEW, spell-only | Spell-exclusive metal |

**Healthy**: Every metal now has at least two uses (crafting + spells), creating trade-off decisions.

---

## Crafting Cost Analysis

| End Product | Materials Needed | Gather Sessions | Total Crowns |
|-------------|-----------------|----------------|-------------|
| Tome of Iron's Wrath | 3 Iron Bar (= 9 Iron Ore + 3 Charite + 6g smelt) + 2 Charite | 2-3 quarry runs | 26 |
| Tome of Steel Push | 2 Steel Bar (= 4 Iron Bar + 2 Zinc Bar + 30g forge) + 1 Charite | 5-8 mine runs | 70 |
| Tome of Brass Mending | 2 Brass Bar (= 4 Copper Bar + 2 Cobalt Bar + 40g forge) + 1 Charite | 6-10 mine runs | 85 |
| Pewter Bar | 1 Iron Bar + 1 Copper Bar | 1-2 quarry runs | 15 |

**Time-to-learn**: T1 spell ~5-10 min. T3 spell ~20-30 min. This fits the game's pacing.

---

## Completeness Check

- [x] All metal bars exist in DB: Iron (31), Copper (33), Zinc (35), Cobalt (37), Steel (38), Brass (39)
- [x] Charite exists (42)
- [x] Varn Ashforge exists (NPC 9) at Forgotten Mines (building 12)
- [x] Magra the Smelter exists (NPC 8) at Quarry
- [x] Pewter Bar is new — needs creation
- [x] 7 spell tomes are new — need creation
- [x] Elara the Inscriber is new — needs creation + building assignment
- [x] Execution plan has correct FK dependency order
- [x] No orphaned entities

---

## Naming Conflict Check

| Entity | Name | Conflict? | Resolution |
|--------|------|-----------|------------|
| item | Pewter Bar | No | — |
| spell | Iron's Wrath | No | — |
| spell | Coppershield | No | — |
| spell | Zinc Sight | No | — |
| spell | Cobalt Ruin | No | — |
| spell | Steel Push | No | — |
| spell | Brass Mending | No | Close to "Mend Skill Book" but different type |
| spell | Pewter Surge | No | — |
| npc | Elara the Inscriber | No | — |
| item | Tome of Iron's Wrath | No | — |
| item | Tome of Coppershield | No | — |
| item | Tome of Zinc Sight | No | — |
| item | Tome of Cobalt Ruin | No | — |
| item | Tome of Steel Push | No | — |
| item | Tome of Brass Mending | No | — |
| item | Tome of Pewter Surge | No | — |

---

## Issues Found

### Critical (must fix before execution)

1. **Delete test spells before execution.** Haste (id 1) and Hammer of The Second (id 2) must be removed — they use conflicting metal-to-effect mappings and have unbalanced values (50% speed for 3600s with zero gold cost). One character has learned each. Run cleanup SQL or use admin panel.

### Warnings (should consider)

1. **Pewter Surge Lv5 (120 energy) exceeds default max energy (100).** Not broken — the SQL uses `LEAST(current_energy + value, max_energy)` so it caps correctly. But consider reducing Lv5 to 100 for cleaner design, or keep 120 to future-proof for INT-boosted max energy.

2. **Elara assigned to Forgotten Mines (building 12)** — this building already hosts Varn Ashforge (NPC 9). That's 2 crafter NPCs in one building. Fine functionally, but consider whether a different building is more thematic for a spell inscriber (e.g., Mage Tower building if it exists on zone 2).

### Suggestions (nice-to-have)

1. **Add Pewter Bar to gathering tables** in a future update — currently it's alloy-only. Could add as rare drop from Ashvein Drift to give gatherers direct access.
2. **Consider tome drops from bosses** — spell tomes as rare boss loot would add another acquisition path beyond crafting.
3. **Spell book icons** — run `/gd.prompts` to generate art for the 7 tomes and 7 spell icons.

---

## Code Changes Assessment

| Needs Code Changes? | Scope |
|---------------------|-------|
| No | Entities only — all 7 effect types already implemented in spell system |

- **Next step**: Delete test spells → `/gd.execute`

---

## Recommendations

1. **Delete test spells** (Haste + Hammer of The Second) via SQL or admin panel
2. **Optionally** move Elara to Mage Tower (building) instead of Forgotten Mines to spread NPC load
3. **Proceed to `/gd.execute`** — design is balanced and complete
