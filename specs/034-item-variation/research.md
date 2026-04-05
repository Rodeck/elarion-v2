# Research: Item Bonus Variation

**Feature**: 034-item-variation | **Date**: 2026-04-05

## Decision 1: Per-Instance Storage Approach

**Decision**: Add nullable stat override columns directly to `inventory_items` table.

**Rationale**: The current architecture stores all stats in `item_definitions` and joins at query time. Adding override columns to `inventory_items` allows per-instance values while maintaining backward compatibility — NULL means "use definition value" (existing items). This avoids a separate `item_stats` table which would add JOIN complexity to every query.

**Alternatives considered**:
- **Separate `item_instance_stats` table**: Normalized but adds an extra JOIN to every inventory/equipment query. Rejected for performance and complexity.
- **JSON column on `inventory_items`**: Flexible but loses type safety and makes SQL aggregation in combat stats harder. Rejected.
- **Store only a "bonus percentage" per instance**: Simpler storage but requires recalculating from definition at every read. Loses the ability to change definitions without retroactively changing all instances. Rejected.

## Decision 2: Weighted Random Distribution

**Decision**: Use exponential distribution mapped to the bonus range, producing ~30% average of max value.

**Rationale**: A simple formula: `floor(max * (1 - random()^2))` where `random()` is uniform [0,1). This gives:
- ~50% chance of rolling in the bottom third
- ~35% chance of rolling in the middle third
- ~15% chance of rolling in the top third
- Exact max roll: ~0% (very rare for large ranges, e.g., 1/range for integers)

For the +20% bonus: `floor(base * 0.20 * (1 - random()^2))` added to base.

For special weapons (0 to base): `floor(base * (1 - random()^2))`.

This is simple, requires no lookup tables, and produces the desired "high rolls are rare" distribution.

**Alternatives considered**:
- **Uniform random**: Equal probability for all values. Rejected — no excitement, most items feel average.
- **Normal distribution (bell curve)**: Clusters around median. Rejected — we want skew toward low, not center.
- **Tiered probability table**: Define exact % for each tier. Rejected — overkill; the exponential curve achieves the same feel with one line of code.

## Decision 3: Quality Tier Thresholds

**Decision**: Four quality tiers based on roll percentage relative to possible range.

| Tier | Label | Roll % Range | Color |
|------|-------|-------------|-------|
| 1 | Poor | 0-25% | Gray (#888888) |
| 2 | Common | 26-50% | White (#cccccc) |
| 3 | Fine | 51-75% | Green (#44cc44) |
| 4 | Superior | 76-100% | Gold (#f0c060) |

**Rationale**: Four tiers are enough to be meaningful without being overwhelming. The color scheme matches existing game UI conventions (gold = premium from CSS tokens `--color-gold-bright`). With the weighted distribution (~30% average), most items will be Poor or Common, making Fine and Superior genuinely exciting.

For items where the range is small (e.g., additional_attacks 0-4), the tier is computed as: `rollValue / maxPossibleValue`. A dagger with crit_chance=3 out of max 5 = 60% = Fine tier.

For the +20% attack/defence bonus: the tier is based on the bonus amount relative to the max bonus. A sword with +1 attack out of max +2 = 50% = Common tier.

**Alternatives considered**:
- **Five tiers**: More granular but with small stat ranges (0-4), many tiers would have no items. Rejected.
- **Three tiers**: Too coarse — "Common" covers too wide a range. Rejected.

## Decision 4: Which Columns to Add to inventory_items

**Decision**: Add these nullable SMALLINT columns to `inventory_items`:

- `instance_attack` — for 1H/2H weapons (+20% bonus applied)
- `instance_defence` — for armor (+20% bonus applied)
- `instance_crit_chance` — for daggers
- `instance_additional_attacks` — for bows
- `instance_armor_penetration` — for staves
- `instance_max_mana` — for wands
- `instance_mana_on_hit` — for wands
- `instance_mana_regen` — for wands
- `instance_quality_tier` — computed tier (1-4) stored for easy querying/display

**Rationale**: Only columns that can actually vary need instance storage. Each weapon subtype only varies 1-3 stats, but storing the rolled values on the instance row means queries can use `COALESCE(ii.instance_attack, id.attack)` for backward compatibility. The quality tier is stored to avoid recomputing it on every display.

**Alternatives considered**:
- **Mirror ALL stat columns**: Wasteful — most columns would always be NULL. Only the stats that vary per subtype need storage. Rejected.
- **Store quality tier only, derive stats from tier**: Loses precision — tier is a bucket, not an exact value. Rejected.

## Decision 5: Marketplace Transfer

**Decision**: Add the same instance stat columns to `marketplace_listings` and preserve them through the buy flow.

**Rationale**: Currently `marketplace_listings` stores `current_durability` but the buy flow calls `grantItemToCharacter()` which creates a fresh item. We need to either:
(a) Pass instance stats through `grantItemToCharacter` (add optional override params), or
(b) Directly INSERT the marketplace item into buyer's inventory with preserved stats.

Option (a) is cleaner — extend `grantItemToCharacter` with an optional `instanceStats` parameter. If provided, use those values instead of rolling new ones. This keeps the single-entry-point design.

**Alternatives considered**:
- **Direct SQL transfer**: Move the row from marketplace to inventory. Breaks the grant service abstraction and skips quest tracking. Rejected.
