# Data Model: Weapon Attributes

**Feature**: 033-weapon-attributes | **Date**: 2026-04-03

## Schema Changes

### Migration 037: `037_weapon_attributes.sql`

#### ALTER `item_definitions`

| Column | Type | Default | Constraint | Notes |
|--------|------|---------|------------|-------|
| `armor_penetration` | SMALLINT | 0 | CHECK (0–100) | % of target defence ignored |
| `additional_attacks` | SMALLINT | 0 | CHECK (0–10) | Bonus hits at combat start |

`crit_chance` already exists (migration 018) — no schema change needed for it.

## Entity Changes

### ItemDefinition (extended)

Existing fields unchanged. New fields:

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `armor_penetration` | integer | 0–100 | Percentage of enemy defence bypassed during damage calculation |
| `additional_attacks` | integer | 0–10 | Number of bonus auto-attacks at start of combat |

### DerivedCombatStats (extended)

Existing fields unchanged. New fields:

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `armorPenetration` | integer | 0–100 | Sum of `armor_penetration` across all equipped items, capped at 100 |
| `additionalAttacks` | integer | 0+ | Sum of `additional_attacks` across all equipped items |

### CharacterData DTO (extended)

New fields added to the `world.state` WebSocket payload:

| Field | Type | Description |
|-------|------|-------------|
| `armor_penetration` | number | Aggregated gear armor penetration (0–100) |
| `additional_attacks` | number | Aggregated gear additional attacks |
| `gear_crit_chance` | number | Aggregated gear crit chance bonus (already computed server-side but not sent) |

## Relationships

```
item_definitions (armor_penetration, additional_attacks, crit_chance)
    ↓ equipped items aggregation (combat-stats-service.ts)
DerivedCombatStats (armorPenetration, additionalAttacks, critChance)
    ↓ used by
combat-engine.ts (damage formula, bonus hits)
    ↓ sent via world.state
CharacterData DTO → StatsBar UI
```

## Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| `armor_penetration` | 0 ≤ value ≤ 100, integer only | "armor_penetration must be an integer between 0 and 100" |
| `additional_attacks` | 0 ≤ value ≤ 10, integer only | "additional_attacks must be an integer between 0 and 10" |
| Category restriction | Only allowed for equippable categories | "armor_penetration/additional_attacks not allowed for category X" |

## State Transitions

No new state transitions. These are static item properties that feed into existing combat state machines.
