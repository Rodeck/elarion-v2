# Weapon & Armor Sets — Balance Review (Wand Addition)

## Summary Verdict

| Category | Status | Notes |
|----------|--------|-------|
| Stat Curve Fit | PASS | Wand ATK sits between daggers and staves at every tier |
| Economy Flow | PASS | No new crown sources/sinks — equipment only |
| Loot Tables | N/A | Loot distribution deferred to Phase 2 |
| Crafting Costs | N/A | Crafting recipes deferred to Phase 2 |
| Time-to-Reward | N/A | Distribution not yet designed |
| Power Progression | PASS | 6 tiers with clear step-up per tier, unique mana niche |
| Completeness | PASS | All 6 wands self-contained, no dependencies |
| Naming Conflicts | PASS | No conflicts with existing 201 items |

**Overall Verdict**: Ready to execute

---

## Stat Curve Fit

### Wand ATK vs All Weapon Subtypes (Tier Comparison)

| Tier | Dagger | Wand | Staff | 1H Sword | Bow | 2H |
|------|--------|------|-------|----------|-----|----|
| T1 | 7 | **8** | 9 | 10 | 10 | 15 |
| T2 | 10 | **11** | 12 | 14 | 13 | 20 |
| T3 | 13 | **15** | 16 | 18 | 17 | 26 |
| T4 | 17 | **20** | 21 | 23 | 22 | 33 |
| T5 | 22 | **26** | 27 | 29 | 28 | 41 |
| T6 | 28 | **33** | 34 | 36 | 35 | 50 |

Wand ATK is consistently 1 point below staves and 2–3 below one-handed swords. This is appropriate — wands trade raw damage for mana utility. The curve is smooth with no outliers.

### Wand Mana Stats Progression

| Tier | Name | ATK | max_mana | mana_regen |
|------|------|-----|----------|------------|
| T1 | Crooked Twig Wand | 8 | 5 | 1 |
| T2 | Bone-Core Wand | 11 | 8 | 2 |
| T3 | Amethyst Focus Wand | 15 | 12 | 3 |
| T4 | Ironwood Conduit | 20 | 17 | 4 |
| T5 | Pale Ember Wand | 26 | 23 | 5 |
| T6 | Voidglass Scepter | 33 | 30 | 7 |

**mana_regen** scales linearly 1→5, then jumps to 7 at T6. The T5→T6 jump (+2 instead of +1) gives the endgame wand a premium feel — acceptable since it mirrors the ATK jumps in other subtypes at T6.

**max_mana** scales roughly +4 per tier (5, 8, 12, 17, 23, 30). The acceleration at higher tiers mirrors the ATK scaling pattern across all weapon types.

### Balance Assessment: Wand vs Other 1H Weapons

Wands are one-handed (shield-compatible), so they compete directly with swords, daggers, and staves:

| Subtype | T4 ATK | T4 Special | Shield? | Best For |
|---------|--------|------------|---------|----------|
| 1H Sword | 23 | None | Yes | Pure damage + defense |
| Dagger | 17 | 13% crit | Yes | Burst/crit builds |
| Staff | 21 | 8 armor pen | Yes | Anti-armor |
| **Wand** | **20** | **17 mana, 4 regen** | **Yes** | **Ability sustain** |
| Bow | 22 | 4 bonus hits | No | Pre-combat alpha |
| 2H | 33 | None | No | Max ATK |

Wands occupy a clear niche. At T4, the Ironwood Conduit (20 ATK + 17 max_mana + 4 mana_regen) sacrifices 3 ATK vs a Knight's Longsword but gains significant mana sustain for ability-focused builds. This is a meaningful tradeoff, not strictly better or worse.

---

## Economy Flow Analysis

No new crown sources or sinks. These are pure equipment items that will enter the economy through monster loot, quest rewards, or crafting (all deferred to Phase 2).

**Net Impact**: Zero — no change to current economy balance.

---

## Completeness Check

- [x] All 6 wand items are self-contained (no recipes, loot tables, or NPC dependencies)
- [x] Weapon subtype `wand` already exists in DB CHECK constraint
- [x] `max_mana` and `mana_regen` columns exist on `item_definitions` (migration 018)
- [x] Admin API and frontend already support all fields
- [x] Execution plan covers all 6 wands
- [x] No orphaned entities

---

## Naming Conflict Check

| Entity | Name | Conflict? | Resolution |
|--------|------|-----------|------------|
| weapon | Crooked Twig Wand | No | — |
| weapon | Bone-Core Wand | No | — |
| weapon | Amethyst Focus Wand | No | Note: "Polished Amethyst" (resource) and "Amethyst Cluster" (resource) exist — no conflict, different category |
| weapon | Ironwood Conduit | No | — |
| weapon | Pale Ember Wand | No | — |
| weapon | Voidglass Scepter | No | — |

No naming conflicts found across all 201 existing items.

---

## Issues Found

### Critical (must fix before execution)
None.

### Warnings (should fix, not blocking)
None.

### Suggestions (nice-to-have improvements)
1. **Consider mana_on_hit for mid/high-tier wands**: Currently only max_mana and mana_regen are used. Adding small mana_on_hit values (1–3) to T4–T6 wands would further differentiate them from staves and reward aggressive play. Not blocking — can be added later via admin panel.

---

## Code Changes Assessment

| Needs Code Changes? | Scope |
|---------------------|-------|
| No | Entities only — no code changes needed |

- `wand` weapon_subtype already in DB CHECK constraint and admin validation
- `max_mana`, `mana_regen` columns already exist (migration 018)
- Wands are one-handed by default (not in `TWO_HANDED_SUBTYPES` array in `equipment.ts`)
- Combat stats service already aggregates `max_mana` and `mana_regen` from all equipped items generically

**Next step**: Proceed directly to `/gd.execute`

---

## Recommendations

The 6 wands are balanced, fill a unique niche (mana sustain for ability builds), and require no code changes. Ready to execute.
