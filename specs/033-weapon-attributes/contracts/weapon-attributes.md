# Contract: Weapon Attributes

**Feature**: 033-weapon-attributes | **Protocol Version**: No version bump (additive fields only)

## Modified Messages

### `world.state` (server → client)

**Change**: Three new fields added to `my_character` object.

```typescript
// Added to CharacterData in shared/protocol/index.ts
{
  // ... existing fields ...
  armor_penetration: number;     // 0–100, aggregated from equipped items
  additional_attacks: number;    // 0+, aggregated from equipped items
  gear_crit_chance: number;      // 0–100, aggregated gear crit chance bonus
}
```

**Backward compatibility**: New fields are additive. Old clients that don't read these fields are unaffected.

### `ItemDefinitionDto` (server → client, via inventory messages)

**Change**: Two new fields. `crit_chance` already present.

```typescript
// Already in ItemDefinitionDto:
crit_chance: number;

// Added:
armor_penetration: number;     // 0–100
additional_attacks: number;    // 0–10
```

**Backward compatibility**: Additive fields. Old clients ignore unknown fields.

## Modified Combat Behavior

### Armor Penetration (all combat types)

Applied in `combat-engine.ts` damage calculation functions:

```
// Before (existing):
damage = max(1, rawDamage - enemyDefence)

// After:
effectiveDefence = floor(enemyDefence * (1 - armorPenetration / 100))
damage = max(1, rawDamage - effectiveDefence)
```

Affects: `playerAutoAttack()`, `resolveAbilityDamage()`, `resolveDrainDamage()`

### Additional Attacks (all combat types)

New phase at combat start, before first normal turn:

```
for i in 0..additionalAttacks:
  execute playerAutoAttack() with forceCrit=false
  send combat log entry for bonus hit
```

Applies to: regular combat (`combat-session.ts`), boss combat (`boss-combat-handler.ts`), PvP combat (`arena-combat-handler.ts`)

## Admin API Changes

### `POST /api/items` and `PUT /api/items/:id`

**Change**: Accept two new optional fields in request body.

```typescript
{
  // ... existing fields ...
  armor_penetration?: number;    // 0–100, default 0
  additional_attacks?: number;   // 0–10, default 0
}
```

**Validation**: Only accepted for equippable categories. Returns 400 if set on non-equippable items.

### `GET /api/items` and `GET /api/items/:id`

**Change**: Response includes new fields.

```typescript
{
  // ... existing fields ...
  armor_penetration: number;
  additional_attacks: number;
}
```
