# Contract: InventorySlotDto Changes

**Feature**: 034-item-variation | **Protocol Version**: Current + additive fields

## Changed Interface: `InventorySlotDto`

### New Fields (additive — backward compatible)

```typescript
export interface InventorySlotDto {
  // Existing fields (unchanged)
  slot_id: number;
  item_def_id: number;
  quantity: number;
  current_durability?: number | null;
  is_disassemblable?: boolean;
  definition: ItemDefinitionDto;

  // NEW: Per-instance stat overrides (null = use definition value)
  instance_attack?: number | null;
  instance_defence?: number | null;
  instance_crit_chance?: number | null;
  instance_additional_attacks?: number | null;
  instance_armor_penetration?: number | null;
  instance_max_mana?: number | null;
  instance_mana_on_hit?: number | null;
  instance_mana_regen?: number | null;

  // NEW: Quality tier (null for items without variation)
  quality_tier?: number | null;       // 1=Poor, 2=Common, 3=Fine, 4=Superior
  quality_label?: string | null;      // "Poor", "Common", "Fine", "Superior"
}
```

### Resolution Rule

For display and combat stat computation, the effective stat value is:

```
effective_<stat> = instance_<stat> ?? definition.<stat>
```

Frontend MUST use this resolution when displaying stats. The `definition` field continues to carry the base/max values for reference (e.g., showing "Attack: 12 / 10" where 12 is instance and 10 is base).

## Changed Message: `inventory.item_received`

The `InventorySlotDto` payload in `inventory.item_received` WebSocket messages now includes the new instance fields when the granted item has randomized bonuses.

## Changed Message: `inventory.state`

The full inventory state response includes updated `InventorySlotDto` objects with instance fields.

## Changed Message: `equipment.changed`

Equipment slot DTOs include instance stat fields.

## Unchanged Messages

- `marketplace.listings` — Listings already show item info; the DTO change flows through naturally.
- `combat.start`, `combat.end` — Use server-computed combat stats, not raw item DTOs.

## Backward Compatibility

All new fields are optional (`?`). Clients that don't understand instance fields will fall back to `definition.*` values — functionally correct for existing items (which have NULL instance fields anyway).
