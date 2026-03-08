# Tasks: Equipment System

**Input**: Design documents from `/specs/011-equipment-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. Each phase is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Maps to user story from spec.md

---

## Phase 1: Setup

No new project structure required — this feature extends an existing monorepo. All paths from plan.md are additions to existing packages.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema, shared protocol types, backend query layer, and backend handler — all must be complete before any frontend user story can be verified end-to-end.

**⚠️ CRITICAL**: No user story work can be tested end-to-end until this phase is complete.

- [x] T001 Create `backend/src/db/migrations/014_equipment.sql`: (1) ALTER `item_definitions` category CHECK to add `'helmet'` and `'chestplate'`; (2) ALTER `inventory_items` ADD COLUMN `equipped_slot VARCHAR(16) CHECK (equipped_slot IN ('helmet','chestplate','left_arm','right_arm','greaves','bracer','boots'))`; (3) CREATE UNIQUE INDEX `idx_inventory_items_equipped_slot` ON `inventory_items(character_id, equipped_slot) WHERE equipped_slot IS NOT NULL`; run migration via existing `backend/src/db/migrate.ts` mechanism

- [x] T002 [P] Add equipment types to `shared/protocol/index.ts`: add `EquipSlot` type, `EquipmentSlotsDto` interface, `EquipmentEquipPayload`, `EquipmentUnequipPayload`, `EquipmentStatePayload`, `EquipmentChangedPayload` (with `slots`, `effective_attack`, `effective_defence`, `inventory_added`, `inventory_removed` fields), `EquipmentEquipRejectedPayload` (with `EquipRejectReason` type), `EquipmentUnequipRejectedPayload` (with `UnequipRejectReason` type), all six message type aliases, and add them to `AnyClientMessage` and `AnyServerMessage` unions — see `contracts/websocket-equipment.md` for exact shapes

- [x] T003 [P] Update `backend/src/db/queries/inventory.ts`: (1) `getInventorySlotCount()` — add `AND equipped_slot IS NULL` to the WHERE clause; (2) `getInventoryWithDefinitions()` — add `AND ii.equipped_slot IS NULL` so equipped items are excluded from the inventory listing; (3) add `getCharacterEffectiveStats(characterId: string)` function that JOINs `inventory_items` (WHERE `equipped_slot IS NOT NULL`) with `item_definitions` and returns `{ effective_attack: number, effective_defence: number }` as described in `quickstart.md`

- [x] T004 Create `backend/src/db/queries/equipment.ts` with four exported functions: (1) `getEquipmentState(characterId)` — queries all inventory_items WHERE `equipped_slot IS NOT NULL` for the character, JOINs item_definitions, returns `EquipmentSlotsDto`; (2) `equipItem(characterId, slotId, slotName)` — transactional: validate item ownership + `equipped_slot IS NULL`, if target slot occupied return old item to free inventory (check cap), if equipping 2H weapon (`weapon_subtype IN ('two_handed','staff')`) and `left_arm` has a shield auto-return it (check cap), UPDATE new item `equipped_slot = slotName`, return `{ inventory_added: InventorySlotDto[], inventory_removed: number[] }`; (3) `unequipItem(characterId, slotName)` — transactional: check free count < 20, UPDATE `equipped_slot = NULL`, return the unequipped `InventorySlotDto`; (4) helper `buildInventorySlotDto(row)` to map DB row to protocol DTO. Use the query patterns from `backend/src/db/queries/inventory.ts` as reference.

- [x] T005 Create `backend/src/websocket/handlers/equipment-state-handler.ts`: export `sendEquipmentState(session: AuthenticatedSession)` that calls `getEquipmentState()` and sends `equipment.state` message to the session, following the same pattern as `sendInventoryState` in `inventory-state-handler.ts`

- [x] T006 Modify `backend/src/websocket/handlers/inventory-state-handler.ts`: import `sendEquipmentState` and call it immediately after `sendInventoryState` in `sendInventoryState()` (or the function that sends inventory on session restore) so both states arrive together on session start

- [x] T007 Create `backend/src/game/equipment/equipment-handler.ts`: export `handleEquipmentEquip(session, rawPayload)` and `handleEquipmentUnequip(session, rawPayload)`. Equip handler: validate `session.characterId` present; validate `slot_id` is positive integer and `slot_name` is valid `EquipSlot`; call `equipItem()`; on error send `equipment.equip_rejected` with appropriate reason code (`ITEM_NOT_FOUND`, `WRONG_SLOT_TYPE`, `TWO_HANDED_BLOCKS`, `INVENTORY_FULL`); on success call `getCharacterEffectiveStats()` and send `equipment.changed` with full `slots`, `effective_attack`, `effective_defence`, `inventory_added`, `inventory_removed`; emit structured log on both success and rejection. Unequip handler: validate `slot_name`; call `unequipItem()`; on error send `equipment.unequip_rejected` (`SLOT_EMPTY`, `INVENTORY_FULL`); on success send `equipment.changed`; emit structured log. Use `log()` from `backend/src/logger.ts` and `sendToSession()` from `backend/src/websocket/server.ts` following patterns in `backend/src/game/inventory/inventory-delete-handler.ts`.

- [x] T008 Add equipment payload schemas to `backend/src/websocket/validator.ts`: add `'equipment.equip'` schema (`slot_id: { type: 'number', required: true }`, `slot_name: { type: 'string', required: true, enumValues: ['helmet','chestplate','left_arm','right_arm','greaves','bracer','boots'] }`) and `'equipment.unequip'` schema (`slot_name: { type: 'string', required: true, enumValues: [...same values...] }`) following the existing schema pattern in that file

- [x] T009 Register equipment handlers in `backend/src/index.ts`: import `handleEquipmentEquip` and `handleEquipmentUnequip` from `backend/src/game/equipment/equipment-handler.ts`; add `registerHandler('equipment.equip', handleEquipmentEquip)` and `registerHandler('equipment.unequip', handleEquipmentUnequip)` alongside the existing inventory handler registration

**Checkpoint**: Backend is ready. Test with a WebSocket client: send `equipment.equip` and `equipment.unequip` messages; verify `equipment.state` arrives on session start; verify `equipment.changed` or rejection responses are sent correctly.

---

## Phase 3: User Story 1 — Switch Between Tabs (Priority: P1) 🎯 MVP Entry Point

**Goal**: Replace the raw inventory panel with a tabbed left panel. Player can click Equipment or Inventory tab icons. Active tab is highlighted.

**Independent Test**: Open the game; confirm the left panel shows two tab buttons at the top; click Equipment tab → equipment view content area shows; click Inventory tab → inventory grid shows; active tab button is visually distinguished.

- [x] T010 [US1] Add tab bar CSS to `frontend/index.html`: add styles for `.left-panel__tabs` (flex row, fixed height ~36px, border-bottom), `.left-panel__tab` (button style with gold theme matching existing palette), and `.left-panel__tab.is-active` (highlighted state with `--color-gold-primary` border/color matching `.login-tab.is-active` pattern); also change `#inventory-panel` `overflow-y: auto` to `overflow: hidden` since internal panels will scroll individually

- [x] T011 [US1] Create `frontend/src/ui/LeftPanel.ts`: constructor takes `(container: HTMLElement, onEquip: ..., onUnequip: ..., onDeleteItem: ...)`. Build a tab bar with Equipment and Inventory buttons, and two content pane divs (only active one visible via `display: none`). Default active tab: Inventory. Instantiate `InventoryPanel` in the inventory content pane (passing `onDeleteItem` through). Expose public methods: `showTab(tab: 'equipment' | 'inventory')`, `onInventoryState(p)`, `onInventoryItemReceived(p)`, `onInventoryItemDeleted(slotId)`, `onInventoryFull(p)`, `onEquipmentState(p)` (stub — delegates to EquipmentPanel once created in Phase 4), `onEquipmentChanged(p)` (stub), `onEquipRejected(p)` (stub), `onUnequipRejected(p)` (stub). Follow the class structure of `InventoryPanel.ts`.

- [x] T012 [US1] Modify `frontend/src/scenes/GameScene.ts`: replace `new InventoryPanel(inventoryEl, ...)` with `new LeftPanel(inventoryEl, sendEquip, sendUnequip, deleteItem)` where `sendEquip` calls `client.send('equipment.equip', ...)` and `sendUnequip` calls `client.send('equipment.unequip', ...)`; update all existing `this.inventoryPanel.*` calls to route through `this.leftPanel.*`; add `client.on('equipment.state', ...)`, `client.on('equipment.changed', ...)`, `client.on('equipment.equip_rejected', ...)`, `client.on('equipment.unequip_rejected', ...)` handlers that delegate to `leftPanel`

**Checkpoint**: US1 complete — tabbed panel visible with working tab switching.

---

## Phase 4: User Story 2 — Equipment Panel Layout (Priority: P1)

**Goal**: Equipment tab shows 7 named slots in body arrangement plus a mini-inventory with weapon/armor filter. Slots show equipped item icons or empty placeholders.

**Independent Test**: Equip test items via the backend; open the Equipment tab; confirm all 7 slots (Helmet, Chestplate, Left Arm, Right Arm, Greaves, Bracer, Boots) are visible; confirm slots with items show the item icon; confirm mini-inventory shows only weapon/armor items (not food/resources); confirm filter buttons narrow the mini-inventory grid.

- [x] T013 [US2] Create `frontend/src/ui/EquipmentPanel.ts` — slot layout section: constructor takes `(container: HTMLElement, onEquip: (slotId, slotName) => void, onUnequip: (slotName) => void)`. Build the body-silhouette slot layout using a CSS grid or absolute positioning: Helmet at top-centre, Chestplate below it, Left Arm and Right Arm side-by-side, Greaves below that, Bracer and Boots at bottom. Each slot element: labelled, shows a placeholder icon (dashed border, crosshair SVG) when empty, shows item icon when occupied. Add `renderEquipmentState(slots: EquipmentSlotsDto)` public method that updates all slot elements. Use the same dark-gold visual theme as `InventoryPanel.ts` (colors: `#252119`, `#5a4a2a`, `#d4a84b`).

- [x] T014 [US2] Add mini-inventory section to `frontend/src/ui/EquipmentPanel.ts`: a scrollable grid area below the slots showing only the player's weapon and armor items. Include a filter bar with buttons: Weapon | Armor (no All/Consumable/Resource). Add public methods `renderMiniInventory(slots: InventorySlotDto[])`, `addMiniInventorySlot(slot)`, `removeMiniInventorySlot(slotId)`. Item cells are built using the same cell-building pattern as `InventoryPanel.buildFilledCell()` (icon, quantity badge, hover highlight). Wire the filter buttons to show/hide cells by category group.

- [x] T015 [US2] Connect equipment.state to EquipmentPanel in `frontend/src/ui/LeftPanel.ts`: in `onEquipmentState(payload)` call `equipmentPanel.renderEquipmentState(payload.slots)` and `equipmentPanel.renderMiniInventory(inventorySlots)` using the last-known inventory slots (pass them in from `onInventoryState`); store inventory slots in LeftPanel state so the mini-inventory stays in sync; implement `onInventoryItemReceived` and `onInventoryItemDeleted` to also call the appropriate EquipmentPanel mini-inventory update methods

**Checkpoint**: US2 complete — Equipment tab displays correctly with live data from server. All slots and mini-inventory render.

---

## Phase 5: User Story 3 — Equip by Drag and Drop (Priority: P1)

**Goal**: Player drags an item from the mini-inventory onto a compatible equipment slot. Item moves to the slot, leaves the mini-inventory, server confirms with `equipment.changed`.

**Independent Test**: Open Equipment tab with a weapon in mini-inventory; drag the weapon icon onto the Right Arm slot; verify: slot fills with item icon, item disappears from mini-inventory, attack stat in top bar changes (after US5), server log shows successful equip; drag a helmet to Boots slot → drop is rejected and helmet returns to mini-inventory.

- [x] T016 [US3] Add HTML5 drag-and-drop to mini-inventory item cells in `frontend/src/ui/EquipmentPanel.ts`: set `draggable="true"` on filled cells; in `dragstart` handler store `{ type: 'inventory', slot_id }` as `dataTransfer` text; add visual drag ghost; in `dragend` reset any pending visual state

- [x] T017 [US3] Add drop targets to equipment slot elements in `frontend/src/ui/EquipmentPanel.ts`: on each slot add `dragover` (call `preventDefault()` to allow drop) and `drop` handlers; on drop: parse `dataTransfer` data, verify `type === 'inventory'`, call `onEquip(slot_id, slot_name)`; add visual drop-target highlight on `dragenter` / `dragover` and remove on `dragleave` / `drop`; do NOT call `onEquip` for incompatible category — instead show brief visual rejection (red border flash) using the `SLOT_CATEGORY_MAP` constant (right_arm←weapon, left_arm←shield, helmet←helmet, chestplate←chestplate, greaves←greaves, bracer←bracer, boots←boots); client-side category check prevents wasted round-trips

- [x] T018 [US3] Implement `onEquipmentChanged(payload: EquipmentChangedPayload)` in `frontend/src/ui/LeftPanel.ts`: call `equipmentPanel.renderEquipmentState(payload.slots)` to update slot icons; call `equipmentPanel.removeMiniInventorySlot(id)` for each id in `payload.inventory_removed`; call `equipmentPanel.addMiniInventorySlot(slot)` for each slot in `payload.inventory_added`; call `inventoryPanel.removeSlot(id)` for each removed id; call `inventoryPanel.addOrUpdateSlot(slot)` for each added slot; store effective stats for later stat bar update (callback placeholder for US5)

- [x] T019 [US3] Handle `equipment.equip_rejected` in `frontend/src/ui/LeftPanel.ts`: add `onEquipRejected(payload)` method; flash the relevant slot element with a red border for ~500ms; show a brief inline notification (small text element appended to the equipment panel, auto-removed after 2 seconds) with a human-readable message per rejection reason (e.g., `INVENTORY_FULL` → "Inventory is full", `TWO_HANDED_BLOCKS` → "Cannot equip shield with two-handed weapon")

**Checkpoint**: US3 complete — full equip round-trip works. Drag from mini-inventory → slot → server confirms → UI updates.

---

## Phase 6: User Story 4 — Unequip and Swap (Priority: P1)

**Goal**: Player can drag an equipped item from its slot back to the mini-inventory to unequip. Dragging a new item onto an occupied slot swaps them.

**Independent Test**: Equip an item; drag it from the slot back onto the mini-inventory area → slot empties, item reappears in mini-inventory; equip a second item in same slot → first item returns to mini-inventory automatically; fill inventory to 20 items → attempt unequip → action blocked with notification.

- [x] T020 [US4] Add draggable equipped items and mini-inventory unequip drop target to `frontend/src/ui/EquipmentPanel.ts`: (1) when a slot renders a filled item, set the icon element `draggable="true"` and in `dragstart` store `{ type: 'equipped', slot_name }`; (2) make the mini-inventory grid area a drop target — add `dragover` (preventDefault) and `drop` handler; on drop: parse `dataTransfer`, if `type === 'equipped'` call `onUnequip(slot_name)`, if `type === 'inventory'` ignore (items cannot be dropped back to mini-inventory from mini-inventory); add visual drop-target highlight on the mini-inventory area during `dragover` of equipped items

- [x] T021 [US4] Handle `equipment.unequip_rejected` in `frontend/src/ui/LeftPanel.ts`: add `onUnequipRejected(payload)` method; show a brief notification with human-readable message (`INVENTORY_FULL` → "Inventory is full", `SLOT_EMPTY` → "Nothing equipped in that slot"); wire this to the `GameScene.ts` `equipment.unequip_rejected` handler added in T012

**Checkpoint**: US4 complete — full equip/unequip/swap cycle works, including blocked unequip when inventory is full.

---

## Phase 7: User Story 6 — Two-Handed Weapon Left Arm Restriction (Priority: P1)

**Goal**: When a two-handed weapon is equipped in the Right Arm slot, the Left Arm slot is visually grayed out and rejects drops. Server already enforces `TWO_HANDED_BLOCKS` in Phase 2.

**Independent Test**: Equip a two-handed weapon → Left Arm slot becomes grayed out and visually non-interactive; attempt to drag a shield onto the grayed Left Arm slot → drop is rejected (no request sent); unequip the two-handed weapon → Left Arm returns to normal interactive state.

- [x] T022 [US6] Add two-handed detection and left-arm grayout to `frontend/src/ui/EquipmentPanel.ts`: in `renderEquipmentState(slots)` detect if `slots.right_arm` has an item with `definition.weapon_subtype` in `['two_handed', 'staff']`; if so apply grayed-out CSS to the `left_arm` slot element (`opacity: 0.4`, `pointer-events: none`, `filter: grayscale(1)`); if not restore normal styling; also in the `dragover` handler for `left_arm` slot: return early without `preventDefault()` when grayed-out (prevents drop highlight and drop acceptance regardless of pointer-events); ensure `renderEquipmentState()` is called on every `equipment.changed` so the grayout updates in real-time

**Checkpoint**: US6 complete — two-handed weapon disables Left Arm slot visually and functionally. Confirmed by both frontend check (no request sent) and server validation (TWO_HANDED_BLOCKS).

---

## Phase 8: User Story 5 — Equipped Items Influence Player Stats (Priority: P2)

**Goal**: Attack and defence values in the top stats bar reflect base + equipment bonuses. Values update immediately after every equip/unequip. Initial load also shows effective stats.

**Independent Test**: Note base attack. Equip weapon with attack +10 → stats bar immediately shows base+10. Unequip → stats bar returns to base. Reload game → stats bar still shows correct effective value on load.

- [x] T023 [US5] Add `updateStats(attack: number, defence: number): void` to `frontend/src/ui/StatsBar.ts`: update only the displayed attack and defence values without re-rendering the full bar; find the existing DOM elements for attack and defence values (by data attribute, class, or stored reference) and update their text content

- [x] T024 [US5] Wire effective stats from `equipment.changed` to StatsBar in `frontend/src/scenes/GameScene.ts`: in the `equipment.changed` handler, after calling `leftPanel.onEquipmentChanged(payload)`, call `statsBar.updateStats(payload.effective_attack, payload.effective_defence)`; store current effective stats in `this.myCharacter.attack_power` and `this.myCharacter.defence` so subsequent operations have accurate values

- [x] T025 [US5] Update world.state effective stats on backend: find the backend handler that builds `CharacterData` for `WorldStatePayload` (search for `'world.state'` in `backend/src/` — likely in `backend/src/game/world/`); call `getCharacterEffectiveStats(characterId)` and use `effective_attack`/`effective_defence` values for `attack_power`/`defence` fields in the `CharacterData` object; this ensures the stats bar shows correct values immediately on game load without waiting for an equipment action

**Checkpoint**: US5 complete — stats bar is fully live. All equip/unequip actions and initial page load show accurate effective stats.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Structural verification and consistency checks across all user stories.

- [x] T026 [P] Verify structured logging in `backend/src/game/equipment/equipment-handler.ts`: confirm all code paths (successful equip, successful unequip, each rejection reason) emit at least one `log()` call with structured key-value payload including `character_id`, `slot_id` or `slot_name`, and relevant outcome fields; match the format used in `inventory-delete-handler.ts`

- [x] T027 Validate end-to-end against `quickstart.md` invariants: (1) confirm `InventoryStatePayload.slots` never includes equipped items (send `inventory.state` after equipping and verify count decreases); (2) confirm equipped item `slot_id` remains stable across equip/unequip cycles (same `id` returned in `inventory_added`); (3) confirm `CharacterData.attack_power` / `defence` in `world.state` equals base + equipment sum; (4) confirm equipment state persists across logout/login (DB query); (5) confirm the unique index prevents double-equip (attempt direct DB insert of duplicate `equipped_slot`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**: Depends on Phase 2 completion (protocol types needed for GameScene types)
- **US2 (Phase 4)**: Depends on Phase 3 (LeftPanel must exist before EquipmentPanel can be mounted)
- **US3 (Phase 5)**: Depends on Phase 4 (slots must be rendered before D&D is added)
- **US4 (Phase 6)**: Depends on Phase 5 (same D&D infrastructure, extends it)
- **US6 (Phase 7)**: Depends on Phase 5 (renderEquipmentState must already work)
- **US5 (Phase 8)**: Depends on Phase 5 (equipment.changed must exist); Phase 4 tasks can run after Phase 2
- **Polish (Phase 9)**: Depends on all phases complete

### Within Phase 2 — Parallel Opportunities

T002 (protocol), T003 (inventory queries) and T001 (migration) can all start in parallel. T004 depends on T001 (migration must exist before testing the queries). T005-T009 depend on T002 (protocol types) and T004 (queries).

### User Story Dependencies

- **US1**: After Foundational — independent of all other user stories
- **US2**: After US1 — depends on LeftPanel structure
- **US3**: After US2 — D&D requires rendered slot elements
- **US4**: After US3 — extends the same D&D system
- **US6**: After US3 — slot grayout integrates with `renderEquipmentState`; server validation is already in Foundational
- **US5**: After US3 — `equipment.changed` payload carries effective stats

---

## Parallel Example: Phase 2 (Foundational)

```
Parallel batch 1 (independent files):
  Task: T001 — backend/src/db/migrations/014_equipment.sql
  Task: T002 — shared/protocol/index.ts
  Task: T003 — backend/src/db/queries/inventory.ts

Sequential after batch 1:
  Task: T004 — backend/src/db/queries/equipment.ts  (needs T001 migration schema)
  Task: T005 — equipment-state-handler.ts           (needs T002 protocol types + T004 queries)
  Task: T006 — inventory-state-handler.ts           (needs T005)
  Task: T007 — equipment-handler.ts                 (needs T002 + T004)
  Task: T008 — validator.ts                         (needs T002 to know enum values)
  Task: T009 — backend/src/index.ts                 (needs T007 + T008)
```

---

## Implementation Strategy

### MVP First (Phases 2–5 = working equip round-trip)

1. Complete Phase 2: Foundational (backend ready)
2. Complete Phase 3: US1 (tabbed panel)
3. Complete Phase 4: US2 (slots visible)
4. Complete Phase 5: US3 (equip by drag works)
5. **STOP and VALIDATE**: Items can be equipped via drag-and-drop, server confirms, UI updates
6. Demo to user — all P1 core mechanics except unequip and 2H restriction

### Incremental Delivery

1. Phases 2–5 → Equip works ✅
2. Phase 6 (US4) → Unequip and swap work ✅
3. Phase 7 (US6) → Two-handed restriction enforced ✅
4. Phase 8 (US5) → Stats bar live ✅
5. Phase 9 → Polish ✅

### Notes

- Tasks marked [P] involve different files with no unresolved dependencies — safe to run concurrently
- Each story phase ends at a checkpoint that is independently testable
- The server-side 2H/shield logic (T007) is built in Foundational; US6 (T022) adds only the frontend grayout
- `getCharacterEffectiveStats()` is added in T003 but first used in T007 (Foundational) and T025 (US5) — no circular dependency
