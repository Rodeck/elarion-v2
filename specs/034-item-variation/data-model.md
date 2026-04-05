# Data Model: Item Bonus Variation

**Feature**: 034-item-variation | **Date**: 2026-04-05

## Schema Changes

### Migration 038: `038_item_variation.sql`

#### ALTER `inventory_items` — Add per-instance stat columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `instance_attack` | SMALLINT | YES | NULL | Rolled attack value (1H/2H weapons only) |
| `instance_defence` | SMALLINT | YES | NULL | Rolled defence value (armor only) |
| `instance_crit_chance` | SMALLINT | YES | NULL | Rolled crit chance (daggers only) |
| `instance_additional_attacks` | SMALLINT | YES | NULL | Rolled additional attacks (bows only) |
| `instance_armor_penetration` | SMALLINT | YES | NULL | Rolled armor penetration (staves only) |
| `instance_max_mana` | SMALLINT | YES | NULL | Rolled max mana (wands only) |
| `instance_mana_on_hit` | SMALLINT | YES | NULL | Rolled mana on hit (wands only) |
| `instance_mana_regen` | SMALLINT | YES | NULL | Rolled mana regen (wands only) |
| `instance_quality_tier` | SMALLINT | YES | NULL | Quality tier 1-4 (Poor/Common/Fine/Superior) |

All columns are nullable. NULL means "use item_definitions base value" — this provides backward compatibility for existing inventory items.

CHECK constraints:
- `instance_quality_tier` IN (1, 2, 3, 4) when NOT NULL
- All instance stat columns >= 0 when NOT NULL

#### ALTER `marketplace_listings` — Preserve instance stats through listings

Same 9 columns added to `marketplace_listings` table, all nullable. Populated when a player lists an item with instance stats; preserved when buyer purchases.

### No changes to `item_definitions`

Item definitions continue to represent:
- **For special weapons (dagger/bow/staff/wand)**: The maximum possible roll for the category-specific bonus
- **For standard weapons/armor (1H/2H/armor)**: The base value; the +20% bonus is computed from this

## Entity Relationships

```text
item_definitions (1) ──── (many) inventory_items
       │                            │
       │ base stats                 │ instance stats (override)
       │ (template)                 │ (per-item roll, nullable)
       │                            │
       └── marketplace_listings ────┘
           (preserves instance stats during trade)
```

## Stat Resolution Logic

For any stat, the effective value is:

```
effective_value = COALESCE(inventory_items.instance_<stat>, item_definitions.<stat>)
```

This means:
- **New items** (post-feature): Have instance columns populated with rolled values
- **Existing items** (pre-feature): Have NULL instance columns → fall back to definition values
- **Stackable items**: Never have instance columns populated (always NULL)

## Quality Tier Mapping

| Tier | Value | Label | Color | Roll % Range |
|------|-------|-------|-------|-------------|
| 1 | 1 | Poor | #888888 (gray) | 0-25% of max |
| 2 | 2 | Common | #cccccc (white) | 26-50% of max |
| 3 | 3 | Fine | #44cc44 (green) | 51-75% of max |
| 4 | 4 | Superior | #f0c060 (gold) | 76-100% of max |

## Randomization Rules by Weapon Subtype

| Subtype | Randomized Stats | Range | +20% Attack Bonus? |
|---------|-----------------|-------|---------------------|
| `dagger` | `crit_chance` | 0 to def.crit_chance | No |
| `bow` | `additional_attacks` | 0 to def.additional_attacks | No |
| `staff` | `armor_penetration` | 0 to def.armor_penetration | No |
| `wand` | `max_mana`, `mana_on_hit`, `mana_regen` | 0 to respective def values | No |
| `one_handed` | `attack` | def.attack to def.attack * 1.2 | Yes |
| `two_handed` | `attack` | def.attack to def.attack * 1.2 | Yes |

| Category (non-weapon) | Randomized Stats | Range |
|------------------------|-----------------|-------|
| `helmet` | `defence` | def.defence to def.defence * 1.2 |
| `chestplate` | `defence` | def.defence to def.defence * 1.2 |
| `shield` | `defence` | def.defence to def.defence * 1.2 |
| `greaves` | `defence` | def.defence to def.defence * 1.2 |
| `bracer` | `defence` | def.defence to def.defence * 1.2 |
| `boots` | `defence` | def.defence to def.defence * 1.2 |

| Category (excluded) | Reason |
|---------------------|--------|
| `ring` | Accessory — fixed stats |
| `amulet` | Accessory — fixed stats |
| `resource` | Stackable — no instances |
| `food` | Stackable — no instances |
| `heal` | Stackable — no instances |
| `tool` | Has durability variation only |
| `skill_book` | Consumable — no combat stats |
