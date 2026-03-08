# Research: Equipment System (011)

**Branch**: `011-equipment-system` | **Date**: 2026-03-08

## Decision 1 — Category names: "chestpiece" vs "chestplate"

**Decision**: Use `chestplate` (not `chestpiece`) as the DB category string for the torso armour slot.

**Rationale**: `frontend/src/ui/InventoryPanel.ts` already lists `'chestplate'` inside the `armor` filter group. Using `chestplate` in the DB migration keeps frontend code change-free in this area. The spec used "chestpiece" as a human-facing label; the canonical code-level name is `chestplate`.

**Alternatives considered**: Renaming `chestplate` → `chestpiece` everywhere. Rejected: unnecessary churn, changes already-shipped filter logic.

---

## Decision 2 — DB representation of equipped items

**Decision**: Add a nullable `equipped_slot VARCHAR(16)` column to the existing `inventory_items` table. Items with `equipped_slot IS NULL` are unequipped (counted against the 20-slot cap). Items with `equipped_slot IS NOT NULL` are equipped (excluded from the cap count).

**Rationale**: Simplest schema change. No new join table or FK cascade complexity. Equip/unequip is a single `UPDATE inventory_items SET equipped_slot = ? WHERE id = ?`. Swap is two UPDATEs inside a transaction. Compatible with existing query patterns.

**Alternatives considered**:
- Separate `character_equipment` table with FK columns per slot — more expressive but requires LEFT JOIN everywhere and two writes per equip.
- Move item row to a new `equipped_items` table — item gets a new ID on every equip/unequip cycle, breaking any in-flight client references.

---

## Decision 3 — Effective stats computation

**Decision**: Keep `characters.attack_power` and `characters.defence` as base stats (class base + level bonuses). Compute effective stats dynamically in the query layer (`getCharacterEffectiveStats`) by summing `item_definitions.attack / defence` across all equipped items via JOIN. Send effective values in `CharacterData` and `EquipmentChangedPayload`.

**Rationale**: No risk of base stat corruption from equip/unequip cycles. Single source of truth for base stats. The JOIN is a cheap indexed read (at most 7 equipped items per character). Matches the server-authoritative principle — all stat math lives on the server.

**Alternatives considered**: Update `characters.attack_power` in DB on every equip/unequip. Rejected: loses the base stat; unequip would require knowing what to subtract; conflicts with level-up service which writes the base value.

---

## Decision 4 — Equipment state delivery

**Decision**: On session start, send a new `equipment.state` message alongside the existing `inventory.state`. After any equip/unequip, send a single `equipment.changed` message that carries: full equipment slots state + effective attack + effective defence + an inventory delta (added/removed slot IDs and updated slots).

**Rationale**: Avoids resending the entire `world.state` for a UI action. Avoids modifying the existing `InventoryStatePayload` shape (no breaking changes). The `inventory delta` embedded in `equipment.changed` lets the frontend sync the mini-inventory without a separate round-trip.

**Alternatives considered**: Embed equipment in `world.state`. Rejected: world.state is already large and triggers re-renders of the map. Include a full `inventory.state` in `equipment.changed`. Rejected: over-sending data for a routine slot update.

---

## Decision 5 — Frontend drag-and-drop mechanism

**Decision**: Use native HTML5 drag-and-drop API (`draggable="true"`, `dragstart`, `dragover`, `drop` events). Item icon cells in the mini-inventory are marked `draggable`. Equipment slots are drop targets. Equipment slot icons are also draggable (for unequip drag to mini-inventory).

**Rationale**: The existing UI is pure HTML/DOM (no canvas for panels). HTML5 D&D is zero-dependency, works in all modern browsers, and fits the existing pattern of inline event listeners used in `InventoryPanel.ts`. No new library required.

**Alternatives considered**: Pointer events with manual drag ghost. More code, no benefit for mouse-only game UI. Canvas-based drag in Phaser. Rejected: equipment and inventory panels are HTML, not Phaser objects.

---

## Decision 6 — Slot ↔ Category mapping

| Equipment Slot | Accepts Item Categories           | Notes                          |
|---------------|-----------------------------------|-------------------------------|
| `right_arm`   | `weapon`                          | All weapon subtypes            |
| `left_arm`    | `shield`                          | Disabled when 2H weapon in `right_arm` |
| `helmet`      | `helmet`                          |                               |
| `chestplate`  | `chestplate`                      |                               |
| `greaves`     | `greaves`                         |                               |
| `bracer`      | `bracer`                          |                               |
| `boots`       | `boots`                           |                               |

Two-handed weapon subtypes: `two_handed`, `staff` (both use the right_arm slot only and disable left_arm).
One-handed weapon subtypes: `one_handed`, `dagger`, `wand`, `bow` (do NOT disable left_arm).

**Alternatives considered**: Treating `wand` and `bow` as two-handed. Rejected: bows and wands are single-handed projectile/casting weapons; disabling the shield for them would be unintuitive. Open for future re-evaluation.

---

## Decision 7 — Two-handed + shield auto-swap on equip

**Decision**: When equipping a two-handed weapon and a shield is currently in `left_arm`, automatically return the shield to inventory (UPDATE `equipped_slot = NULL`). Block the equip only if the unequipped shield would push inventory over 20 non-equipped slots. This is wrapped in a DB transaction.

**Rationale**: Chosen by the user (clarification Q1, Option B). Smoother UX; shield is automatically placed back.

---

## Decision 8 — Backend message routing

**Decision**: Add two new message type strings — `equipment.equip` and `equipment.unequip` — handled by a new `equipment-handler.ts` file following the same pattern as `inventory-delete-handler.ts`.

**Rationale**: Consistent with existing handler conventions. Each handler is a single-responsibility async function taking `(session, rawPayload)`.
