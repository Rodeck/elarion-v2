# Quickstart: Equipment System (011)

**Branch**: `011-equipment-system` | **Date**: 2026-03-08

## What This Feature Adds

- A tabbed left panel replacing the raw inventory panel: **Equipment** tab and **Inventory** tab
- 7 equipment slots (Helmet, Chestplate, Left Arm, Right Arm, Greaves, Bracer, Boots)
- Drag-and-drop equip/unequip/swap from the Equipment tab's mini-inventory
- Two-handed weapon + shield mutual exclusion with visual Left Arm grayout
- Effective stats (attack, defence) computed as base + all equipped item bonuses

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `backend/src/db/migrations/014_equipment.sql` | DB: extend category CHECK, add `equipped_slot` column + unique index |
| `backend/src/db/queries/equipment.ts` | DB queries: equip, unequip, get equipment state, effective stats |
| `backend/src/game/equipment/equipment-handler.ts` | WS handler for `equipment.equip` and `equipment.unequip` |
| `backend/src/websocket/handlers/equipment-state-handler.ts` | Sends `equipment.state` on session start |
| `frontend/src/ui/LeftPanel.ts` | Tab controller: mounts Equipment and Inventory tabs |
| `frontend/src/ui/EquipmentPanel.ts` | Equipment tab: 7 slots + mini-inventory with D&D |

### Modified Files

| File | Change |
|------|--------|
| `shared/protocol/index.ts` | Add equipment types, `EquipSlot`, payloads, message aliases, union updates |
| `backend/src/db/queries/inventory.ts` | `getInventorySlotCount` and `getInventoryWithDefinitions` filter to `equipped_slot IS NULL`; add `getCharacterEffectiveStats()` |
| `backend/src/websocket/handlers/inventory-state-handler.ts` | Call `sendEquipmentState` alongside `sendInventoryState` on session start |
| `backend/src/websocket/server.ts` (or message router) | Route `equipment.equip` and `equipment.unequip` to handler |
| `frontend/index.html` | No ID change needed — `#inventory-panel` div is repurposed as the LeftPanel mount |
| `frontend/src/scenes/GameScene.ts` | Replace direct `InventoryPanel` mount with `LeftPanel`; wire `equipment.*` WS messages; update StatsBar on `equipment.changed` |

---

## Architecture Overview

```
Client (EquipmentPanel)
  │  dragstart  →  item ghost follows cursor
  │  drop on slot  →  send equipment.equip { slot_id, slot_name }
  │  drop on mini-inv  →  send equipment.unequip { slot_name }
  │
  ▼ WS: equipment.equip / equipment.unequip
Backend (equipment-handler.ts)
  │  validate ownership, category match, capacity
  │  BEGIN TRANSACTION
  │    UPDATE inventory_items SET equipped_slot = ?     (equip)
  │    UPDATE inventory_items SET equipped_slot = NULL  (unequip/swap)
  │    UPDATE inventory_items SET equipped_slot = NULL  (auto-unequip shield for 2H)
  │  COMMIT
  │  compute effective stats via JOIN query
  │  send equipment.changed { slots, effective_attack, effective_defence, inventory_delta }
  │
  ▼ WS: equipment.changed
Client (LeftPanel)
  │  EquipmentPanel.applyChange(payload)   → update slot icons, gray out left_arm if 2H
  │  InventoryPanel.applyDelta(payload)    → add/remove items from mini-inventory grid
  │  StatsBar.updateStats(attack, defence) → refresh attack/defence display
```

---

## DB Transaction Patterns

### Equip (empty slot)
```
BEGIN;
  SELECT COUNT(*) FROM inventory_items WHERE character_id = ? AND equipped_slot IS NULL → check < 20 after removing this item
  UPDATE inventory_items SET equipped_slot = 'right_arm' WHERE id = ? AND character_id = ?;
COMMIT;
```

### Equip (occupied slot — swap)
```
BEGIN;
  SELECT COUNT(*) FROM inventory_items WHERE character_id = ? AND equipped_slot IS NULL → check < 20
  UPDATE inventory_items SET equipped_slot = NULL WHERE character_id = ? AND equipped_slot = 'right_arm';
  UPDATE inventory_items SET equipped_slot = 'right_arm' WHERE id = ? AND character_id = ?;
COMMIT;
```

### Equip 2H weapon (with shield auto-return)
```
BEGIN;
  non-equipped count = SELECT COUNT(*) WHERE equipped_slot IS NULL
  shield_slot_id = SELECT id FROM inventory_items WHERE character_id = ? AND equipped_slot = 'left_arm'
  IF shield_slot_id EXISTS:
    check non-equipped count < 20 (space for the returning shield + freeing the new weapon)
    UPDATE inventory_items SET equipped_slot = NULL WHERE id = shield_slot_id;
  UPDATE any existing right_arm item SET equipped_slot = NULL;
  UPDATE inventory_items SET equipped_slot = 'right_arm' WHERE id = ? AND character_id = ?;
COMMIT;
```

### Unequip
```
BEGIN;
  non-equipped count = SELECT COUNT(*) WHERE equipped_slot IS NULL → must be < 20
  UPDATE inventory_items SET equipped_slot = NULL WHERE character_id = ? AND equipped_slot = 'boots';
COMMIT;
```

---

## Effective Stats Query

```sql
SELECT
  c.attack_power + COALESCE(SUM(d.attack), 0)   AS effective_attack,
  c.defence      + COALESCE(SUM(d.defence), 0)  AS effective_defence
FROM characters c
LEFT JOIN inventory_items ii
  ON ii.character_id = c.id
  AND ii.equipped_slot IS NOT NULL
LEFT JOIN item_definitions d
  ON d.id = ii.item_def_id
WHERE c.id = $1
GROUP BY c.id, c.attack_power, c.defence
```

---

## Frontend Tab Structure

```html
<!-- #inventory-panel (existing div, repurposed as LeftPanel) -->
<div id="inventory-panel" style="display:flex;flex-direction:column;">

  <!-- Tab bar (top, fixed height) -->
  <div class="left-panel__tabs">
    <button class="left-panel__tab is-active" data-tab="equipment">⚔ Equipment</button>
    <button class="left-panel__tab" data-tab="inventory">🎒 Inventory</button>
  </div>

  <!-- Tab content areas (only active one is visible) -->
  <div class="left-panel__content" data-content="equipment">
    <!-- EquipmentPanel mounts here -->
  </div>
  <div class="left-panel__content" data-content="inventory" style="display:none">
    <!-- InventoryPanel mounts here (unchanged) -->
  </div>

</div>
```

---

## Key Invariants to Validate

1. `equipped_slot` + `character_id` is unique (index enforces this).
2. An equipped item always has `quantity = 1` (non-stackable check in handler).
3. `CharacterData.attack_power` / `defence` sent over WS = effective values (base + bonuses).
4. `InventoryStatePayload.slots` never includes equipped items.
5. `EquipmentChangedPayload` is always sent atomically after a transaction commits.
6. Left Arm slot in the UI is always grayed out when `right_arm` holds a two-handed weapon (detected by `weapon_subtype IN ['two_handed', 'staff']`).
