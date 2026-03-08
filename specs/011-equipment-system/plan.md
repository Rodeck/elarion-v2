# Implementation Plan: Equipment System

**Branch**: `011-equipment-system` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-equipment-system/spec.md`

## Summary

Add an equipment system with a tabbed left panel (Equipment / Inventory), 7 named equipment slots, drag-and-drop equip/unequip/swap mechanics, and server-authoritative stat computation. Equipment state is persisted via a new `equipped_slot` column on `inventory_items`. Effective attack and defence stats (base + bonuses) are computed server-side and pushed to the client on every equipment change.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared)
**Primary Dependencies**: Phaser 3.60 (frontend game canvas), `ws` library (WebSocket), `pg` (PostgreSQL client), Vite 5 (frontend build)
**Storage**: PostgreSQL 16 — schema change via migration 014 (new column + category extension)
**Testing**: `npm test && npm run lint` (project standard)
**Target Platform**: Browser (frontend), Node.js 20 LTS (backend)
**Project Type**: Multiplayer web game (Phaser 3 client + Node WebSocket server)
**Performance Goals**: Equipment change round-trip < 200ms perceived latency; no change to 60fps game loop
**Constraints**: Server-authoritative; no client-side stat computation; no REST for equipment actions
**Scale/Scope**: Single-player-per-session equipment; 7 slots per character; affects existing inventory system

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | ✅ PASS | All equipment actions use `equipment.equip` / `equipment.unequip` WebSocket messages |
| 2. Server-side validation | ✅ PASS | `equipment-handler.ts` validates ownership, category match, capacity, and 2H/shield exclusion before any DB write |
| 3. Structured logging | ✅ PASS | All handler paths emit structured logs via existing `log()` utility |
| 4. Contract documented | ✅ PASS | `contracts/websocket-equipment.md` defines all new message types |
| 5. Graceful rejection handling | ✅ PASS | Frontend handles `equipment.equip_rejected` and `equipment.unequip_rejected` with rollback + user notification |
| 6. Complexity justified | ✅ PASS | No design element violates Principle III; drag-and-drop is the minimum viable interaction for this spec |

**Post-design re-check**: All gates continue to pass. The `equipped_slot` column approach eliminates the need for a new table, keeping the design within Principle III.

## Project Structure

### Documentation (this feature)

```text
specs/011-equipment-system/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions 1–8
├── data-model.md        # Phase 1 — migration 014 schema
├── quickstart.md        # Phase 1 — architecture, file map, DB patterns
├── contracts/
│   └── websocket-equipment.md   # Phase 1 — all new WS message types
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code

```text
shared/
└── protocol/
    └── index.ts                             # ADD: EquipSlot, EquipmentSlotsDto, equipment payload types

backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 014_equipment.sql            # NEW
│   │   └── queries/
│   │       ├── inventory.ts                 # MODIFY: filter equipped items, add getCharacterEffectiveStats()
│   │       └── equipment.ts                 # NEW: getEquipmentState, equipItem, unequipItem (transactional)
│   ├── game/
│   │   └── equipment/
│   │       └── equipment-handler.ts         # NEW: handles equipment.equip and equipment.unequip
│   └── websocket/
│       ├── handlers/
│       │   ├── inventory-state-handler.ts   # MODIFY: also call sendEquipmentState
│       │   └── equipment-state-handler.ts   # NEW: sendEquipmentState()
│       └── server.ts                        # MODIFY: route equipment.equip / equipment.unequip

frontend/
├── index.html                               # MODIFY: minor CSS for tab bar (no ID changes)
└── src/
    ├── ui/
    │   ├── LeftPanel.ts                     # NEW: tab controller
    │   ├── EquipmentPanel.ts                # NEW: 7 slots + mini-inventory D&D
    │   └── InventoryPanel.ts                # MODIFY: accept parent container ref, expose applyDelta()
    └── scenes/
        └── GameScene.ts                     # MODIFY: mount LeftPanel, wire equipment WS messages
```

**Structure Decision**: Web application (Option 2). Frontend/backend separation maintained. Equipment queries are a new file `equipment.ts` to keep the existing `inventory.ts` focused.

## Complexity Tracking

No violations of Principle III. All design choices solve a defined current requirement.

---

## Phase 0: Research

See [research.md](research.md) for all 8 decisions.

Key resolved questions:
- Category name: `chestplate` (not `chestpiece`) — matched to existing `InventoryPanel.ts`
- DB approach: `equipped_slot` column on `inventory_items` — simplest, no new table
- Effective stats: computed via JOIN at query time, NOT stored
- Frontend D&D: native HTML5 drag-and-drop API

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](data-model.md). Key changes:

1. `item_definitions.category` CHECK extended with `'helmet'`, `'chestplate'`
2. `inventory_items.equipped_slot VARCHAR(16)` column added (nullable)
3. Unique partial index prevents two items in the same slot
4. Inventory capacity query updated to `WHERE equipped_slot IS NULL`

### Contracts

See [contracts/websocket-equipment.md](contracts/websocket-equipment.md). New message types:

**Client → Server**: `equipment.equip`, `equipment.unequip`
**Server → Client**: `equipment.state`, `equipment.changed`, `equipment.equip_rejected`, `equipment.unequip_rejected`

Existing `InventoryStatePayload` and `CharacterData` have **behavioural** changes (equipped items excluded; effective stats included) but **no interface changes** — fully backward-compatible.

### Implementation Notes

#### Backend: `equipment.ts` query module

Three main functions:

1. **`getEquipmentState(characterId)`** — returns `EquipmentSlotsDto` by querying all inventory_items with `equipped_slot IS NOT NULL` for the character, joining with `item_definitions`.

2. **`equipItem(characterId, slotId, slotName, isAutoUnequipShield)`** — transactional:
   - Validates item ownership and `equipped_slot IS NULL`
   - If target slot occupied: return old item to inventory (check cap)
   - If 2H weapon into `right_arm` and `left_arm` has shield: auto-return shield (check cap)
   - UPDATE new item to `equipped_slot = slotName`
   - Returns `{ newSlots, inventoryAdded, inventoryRemoved }`

3. **`unequipItem(characterId, slotName)`** — transactional:
   - Check non-equipped count < 20
   - UPDATE `equipped_slot = NULL`
   - Returns the returned `InventorySlotDto`

4. **`getCharacterEffectiveStats(characterId)`** — the JOIN query described in `quickstart.md`.

#### Backend: `equipment-handler.ts`

```
handleEquipmentEquip(session, rawPayload):
  1. Validate authentication
  2. Validate slot_id positive integer, slot_name valid EquipSlot
  3. Fetch item from DB — must exist, owned, equipped_slot IS NULL
  4. Validate category matches slot (SLOT_CATEGORY_MAP)
  5. Validate 2H/shield constraint
  6. Call equipItem() in transaction
  7. If error → send equipment.equip_rejected
  8. If success → compute effective stats → send equipment.changed
  9. Log structured event

handleEquipmentUnequip(session, rawPayload):
  1. Validate authentication
  2. Validate slot_name valid EquipSlot
  3. Call unequipItem() in transaction
  4. If error → send equipment.unequip_rejected
  5. If success → compute effective stats → send equipment.changed
  6. Log structured event
```

#### Frontend: `LeftPanel.ts`

Mounts into `#inventory-panel`. Creates tab bar and two content panes. Delegates to `EquipmentPanel` and `InventoryPanel` instances. Exposes:
- `onInventoryState(payload)` — delegates to InventoryPanel
- `onInventoryItemReceived(payload)` — delegates to InventoryPanel and EquipmentPanel mini-inv
- `onInventoryItemDeleted(slotId)` — delegates to both
- `onEquipmentState(payload)` — delegates to EquipmentPanel
- `onEquipmentChanged(payload)` — delegates to both + triggers StatsBar update callback

#### Frontend: `EquipmentPanel.ts`

**Slot section** (upper portion):
- 7 slot elements laid out in a body silhouette arrangement
- Each slot: empty = dashed border placeholder; filled = item icon
- `dragover` + `drop` event handlers on each slot
- When `right_arm` has a 2H weapon: `left_arm` slot gets `pointer-events: none; opacity: 0.4`

**Mini-inventory section** (lower portion):
- Reuses same cell-building logic as `InventoryPanel` (or extracts a shared `buildItemCell()` helper)
- Filter bar: Weapon | Armor only (no All/Consumable/Resource/Tool)
- Cells are `draggable="true"`; `dragstart` sets `dataTransfer` with `slot_id`
- Slot icons are also `draggable="true"`; `dragstart` sets `dataTransfer` with `slot_name` (for unequip)
- Drop on slot → `equipment.equip`
- Drop on mini-inventory area → `equipment.unequip`

#### Frontend: `GameScene.ts` changes

- Replace `this.inventoryPanel = new InventoryPanel(...)` with `this.leftPanel = new LeftPanel(...)`
- Add handlers:
  ```
  client.on('equipment.state', payload => leftPanel.onEquipmentState(payload))
  client.on('equipment.changed', payload => {
    leftPanel.onEquipmentChanged(payload)
    statsBar.updateStats(payload.effective_attack, payload.effective_defence)
  })
  client.on('equipment.equip_rejected', payload => leftPanel.onEquipRejected(payload))
  client.on('equipment.unequip_rejected', payload => leftPanel.onUnequipRejected(payload))
  ```
- `StatsBar` needs a new `updateStats(attack, defence)` method (or update existing data-binding).

#### Stat bar update

`StatsBar.ts` already renders `attack_power` and `defence` from `CharacterData`. Add a public `updateStats(attack: number, defence: number): void` method that directly updates the displayed values without re-rendering the full bar.
