# Data Model: Equipment System (011)

**Branch**: `011-equipment-system` | **Date**: 2026-03-08

## Migration 014 — equipment_system.sql

### Changes to `item_definitions`

Extend the `category` CHECK constraint to include two new armour categories:

```sql
-- Existing categories:
-- 'resource','food','heal','weapon','boots','shield','greaves','bracer','tool'
-- Added: 'helmet', 'chestplate'
ALTER TABLE item_definitions
  DROP CONSTRAINT item_definitions_category_check,
  ADD CONSTRAINT item_definitions_category_check
    CHECK (category IN (
      'resource','food','heal','weapon',
      'boots','shield','greaves','bracer','tool',
      'helmet','chestplate'
    ));
```

### Changes to `inventory_items`

Add a nullable `equipped_slot` column that records which equipment slot (if any) currently holds this item:

```sql
ALTER TABLE inventory_items
  ADD COLUMN equipped_slot VARCHAR(16)
    CHECK (equipped_slot IN (
      'helmet','chestplate','left_arm','right_arm','greaves','bracer','boots'
    ));

-- Unique constraint: each slot can hold at most one item per character
-- (enforced by the handler, but we add a partial unique index for safety)
CREATE UNIQUE INDEX idx_inventory_items_equipped_slot
  ON inventory_items(character_id, equipped_slot)
  WHERE equipped_slot IS NOT NULL;
```

### Inventory capacity count (updated query)

The 20-slot cap counts only **unequipped** items:

```sql
SELECT COUNT(*) AS count
FROM inventory_items
WHERE character_id = $1 AND equipped_slot IS NULL
```

---

## Entity: `inventory_items` (updated)

| Column         | Type         | Nullable | Notes                                            |
|---------------|--------------|----------|--------------------------------------------------|
| `id`          | SERIAL PK    | NO       | Stable across equip/unequip cycles               |
| `character_id`| UUID FK      | NO       | → `characters(id)` ON DELETE CASCADE            |
| `item_def_id` | INTEGER FK   | NO       | → `item_definitions(id)`                        |
| `quantity`    | SMALLINT     | NO       | ≥ 1; stackable items only have quantity > 1; all equipped items have quantity = 1 |
| `created_at`  | TIMESTAMPTZ  | NO       |                                                  |
| `equipped_slot`| VARCHAR(16) | YES      | NULL = in free inventory; non-NULL = equipped slot name |

**Invariants**:
- An item with `equipped_slot IS NOT NULL` MUST have `quantity = 1` (equipment is never stacked).
- Two rows for the same `(character_id, equipped_slot)` MUST NOT exist simultaneously (enforced by unique partial index).
- Items with `equipped_slot IS NOT NULL` are excluded from the 20-slot inventory cap.

---

## Entity: `item_definitions` (updated)

| Category    | Equippable | Accepted Slot | Stat Columns Used           |
|------------|------------|---------------|----------------------------|
| `weapon`   | YES        | `right_arm`   | `attack`                   |
| `shield`   | YES        | `left_arm`    | `defence`                  |
| `helmet`   | YES        | `helmet`      | `defence`                  |
| `chestplate`| YES       | `chestplate`  | `defence`                  |
| `greaves`  | YES        | `greaves`     | `defence`                  |
| `bracer`   | YES        | `bracer`      | `defence`                  |
| `boots`    | YES        | `boots`       | `defence`                  |
| `resource` | NO         | —             | —                          |
| `food`     | NO         | —             | —                          |
| `heal`     | NO         | —             | —                          |
| `tool`     | NO         | —             | —                          |

**Two-handed weapon detection**: A weapon item is two-handed when `weapon_subtype IN ('two_handed', 'staff')`. When such a weapon is equipped:
- `left_arm` slot is disabled for new equips.
- Any shield currently in `left_arm` is auto-returned to inventory.

---

## Derived Value: Effective Stats

Computed at query time; NOT stored in the DB.

```
effective_attack  = characters.attack_power + SUM(item_definitions.attack  WHERE equipped)
effective_defence = characters.defence       + SUM(item_definitions.defence WHERE equipped)
```

`NULL` attack/defence values from item definitions are treated as 0 in the SUM.

Used in:
- `CharacterData.attack_power` / `CharacterData.defence` (sent in `world.state`)
- `EquipmentChangedPayload.effective_attack` / `effective_defence`

---

## Slot → Category Mapping

| Slot Name    | Accepted `item_definitions.category` | Two-Handed Blocks Slot? |
|-------------|--------------------------------------|------------------------|
| `right_arm` | `weapon`                             | N/A                    |
| `left_arm`  | `shield`                             | YES (if `weapon_subtype IN ('two_handed','staff')`) |
| `helmet`    | `helmet`                             | —                      |
| `chestplate`| `chestplate`                         | —                      |
| `greaves`   | `greaves`                            | —                      |
| `bracer`    | `bracer`                             | —                      |
| `boots`     | `boots`                              | —                      |
