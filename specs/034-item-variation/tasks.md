# Tasks: Item Bonus Variation

**Input**: Design documents from `/specs/034-item-variation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US1 and US2 are combined into one phase since they share the same code path (item grant randomization).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Database migration and shared type changes that all subsequent work depends on

- [x] T001 Create migration `backend/src/db/migrations/038_item_variation.sql` — ALTER `inventory_items` adding 9 nullable SMALLINT columns: `instance_attack`, `instance_defence`, `instance_crit_chance`, `instance_additional_attacks`, `instance_armor_penetration`, `instance_max_mana`, `instance_mana_on_hit`, `instance_mana_regen`, `instance_quality_tier`. Add CHECK constraints: all instance stats >= 0 when NOT NULL, `instance_quality_tier` IN (1,2,3,4) when NOT NULL. Also ALTER `marketplace_listings` adding the same 9 columns (nullable).
- [x] T002 Update `shared/protocol/index.ts` — Add instance stat fields and quality tier to `InventorySlotDto`: `instance_attack?: number | null`, `instance_defence?: number | null`, `instance_crit_chance?: number | null`, `instance_additional_attacks?: number | null`, `instance_armor_penetration?: number | null`, `instance_max_mana?: number | null`, `instance_mana_on_hit?: number | null`, `instance_mana_regen?: number | null`, `quality_tier?: number | null`, `quality_label?: string | null`. Add `QualityTier` type (1|2|3|4) and `QUALITY_LABELS` constant mapping tier numbers to "Poor"/"Common"/"Fine"/"Superior".

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services and query changes that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `backend/src/game/inventory/item-roll-service.ts` — Implement `rollItemStats(def: ItemDefinitionRow): InstanceStats | null` function. Use weighted distribution `Math.floor(max * (1 - Math.random() ** 2))` for all rolls. Logic by weapon_subtype: `dagger` → roll `crit_chance` (0 to def.crit_chance); `bow` → roll `additional_attacks` (0 to def.additional_attacks); `staff` → roll `armor_penetration` (0 to def.armor_penetration); `wand` → roll `max_mana`, `mana_on_hit`, `mana_regen` each 0 to def value. For `one_handed`/`two_handed` subtypes → roll attack bonus 0-20% of def.attack (floor). For armor categories (`helmet`, `chestplate`, `shield`, `greaves`, `bracer`, `boots`) with no weapon_subtype → roll defence bonus 0-20% of def.defence (floor). Return null for rings, amulets, stackables, tools, skill_books. Also implement `computeQualityTier(rollPct: number): 1|2|3|4` (0-25%=1, 26-50%=2, 51-75%=3, 76-100%=4) and `computeRollPercentage(stats: InstanceStats, def: ItemDefinitionRow): number` that computes the overall roll quality as a 0-1 fraction.
- [x] T004 Update `backend/src/db/queries/inventory.ts` — (a) Modify `insertInventoryItem()` to accept optional instance stat columns and include them in the INSERT. (b) Modify `getInventoryWithDefinitions()` SELECT to include all 9 `ii.instance_*` columns. (c) Add a new function `insertInventoryItemWithStats(characterId, itemDefId, quantity, instanceStats)` that INSERTs with all instance columns in one query. (d) Update `InventoryItemWithDefinition` type to include the instance columns.
- [x] T005 Update `backend/src/db/queries/equipment.ts` — (a) Modify the SELECT in `getEquipmentState()` to include all 9 `ii.instance_*` columns. (b) Update `buildInventorySlotDto()` to map instance columns to the DTO's new fields: `instance_attack: row.instance_attack ?? null`, etc. Also compute `quality_label` from `instance_quality_tier` using the QUALITY_LABELS mapping. (c) Update the `InventoryItemWithDefinition` interface used by equipment queries.

**Checkpoint**: Foundation ready — roll service exists, queries support instance columns, DTO carries instance data.

---

## Phase 3: User Stories 1 & 2 — Randomization at Grant Time (Priority: P1) MVP

**Goal**: When any item is granted to a player, stats are randomly rolled and stored per-instance.

**Independent Test**: Use admin `/grant` command to give the same dagger 10 times — verify crit_chance varies across instances. Give the same sword 10 times — verify attack values range from base to base+20%.

### Implementation

- [x] T006 [US1] Modify `backend/src/game/inventory/inventory-grant-service.ts` — Import `rollItemStats` from `item-roll-service.ts`. After loading the item definition (existing code), call `rollItemStats(def)`. If result is non-null, use `insertInventoryItemWithStats()` instead of `insertInventoryItem()`. Update the `InventorySlotDto` building (lines ~53-84) to include instance fields from the roll result. This is the SINGLE point of randomization — all 10+ grant paths flow through here.
- [x] T007 [US1] Update `backend/src/game/inventory/inventory-grant-service.ts` DTO building — When building the `InventorySlotDto` after grant, populate `instance_attack`, `instance_defence`, `instance_crit_chance`, `instance_additional_attacks`, `instance_armor_penetration`, `instance_max_mana`, `instance_mana_on_hit`, `instance_mana_regen`, `quality_tier`, and `quality_label` from the roll result (or from the newly inserted row's instance columns). Ensure the `inventory.item_received` WebSocket message includes these new fields.
- [x] T008 [US2] Update `backend/src/websocket/handlers/inventory-state-handler.ts` — When building the full inventory state response, ensure each `InventorySlotDto` includes the instance stat fields read from the database (via the updated `getInventoryWithDefinitions()` query).

**Checkpoint**: Items are now granted with randomized stats. Verify by granting items via admin and checking inventory state messages.

---

## Phase 4: User Story 3 — Combat Stats Reflect Per-Instance Bonuses (Priority: P1)

**Goal**: Equipped items contribute their per-instance stat values to combat, not the definition base values.

**Independent Test**: Equip a dagger with instance crit_chance=3 (base 5). Enter combat. Verify character's computed crit chance uses 3, not 5.

### Implementation

- [x] T009 [US3] Modify `backend/src/game/combat/combat-stats-service.ts` — Update the equipped items SQL query (lines ~61-78) to use COALESCE for all stat columns: `COALESCE(ii.instance_attack, id.attack) AS attack`, `COALESCE(ii.instance_defence, id.defence) AS defence`, `COALESCE(ii.instance_crit_chance, id.crit_chance) AS crit_chance`, `COALESCE(ii.instance_additional_attacks, id.additional_attacks) AS additional_attacks`, `COALESCE(ii.instance_armor_penetration, id.armor_penetration) AS armor_penetration`, `COALESCE(ii.instance_max_mana, id.max_mana) AS max_mana`, `COALESCE(ii.instance_mana_on_hit, id.mana_on_hit) AS mana_on_hit`, `COALESCE(ii.instance_mana_regen, id.mana_regen) AS mana_regen`. The aggregation loop (lines ~94-109) remains unchanged — it already sums the query result fields.

**Checkpoint**: Combat now uses per-instance values. Existing items (NULL instance columns) fall back to definition values via COALESCE.

---

## Phase 5: User Story 4 — Item Display Shows Instance Values (Priority: P2)

**Goal**: Inventory and equipment panels display the per-instance stat values, not definition base values.

**Independent Test**: View two daggers in inventory with different crit_chance rolls — verify they show different values.

### Implementation

- [x] T010 [P] [US4] Modify `frontend/src/ui/InventoryPanel.ts` — In the item detail/tooltip rendering (showDetailPanel, ~lines 293-320), change stat reads from `def.attack` to `slot.instance_attack ?? def.attack`, `def.defence` to `slot.instance_defence ?? def.defence`, and similarly for crit_chance, additional_attacks, armor_penetration, max_mana, mana_on_hit, mana_regen. Create a helper function `getEffectiveStat(instance: number | null | undefined, base: number | null): number | null` that returns `instance ?? base`.
- [x] T011 [P] [US4] Modify `frontend/src/ui/EquipmentPanel.ts` — In `buildItemTooltip()` / `buildTooltipStats()` (~lines 377-464), apply the same `getEffectiveStat()` pattern to read instance values with definition fallback. Import or duplicate the helper.

**Checkpoint**: Players see per-instance stat values in both inventory and equipment panels.

---

## Phase 6: User Story 5 — Marketplace Items Retain Rolled Values (Priority: P2)

**Goal**: Items listed and sold on the marketplace preserve their per-instance stats through the trade.

**Independent Test**: List a sword with instance_attack=12 → another player buys it → buyer's inventory shows attack=12.

### Implementation

- [x] T012 [US5] Modify `backend/src/game/marketplace/marketplace-service.ts` listing flow — In `listItem()` (~line 358), extract all instance stat columns from the seller's inventory slot (in addition to existing `current_durability`). Pass them to `createListing()`. Update the `createListing` DB function to INSERT the 9 instance columns into `marketplace_listings`.
- [x] T013 [US5] Modify `backend/src/game/marketplace/marketplace-service.ts` buy flow — In `buyListing()` (~line 250), instead of calling plain `grantItemToCharacter()`, pass the listing's instance stats as an override parameter. Update `grantItemToCharacter()` signature to accept an optional `instanceStatsOverride` parameter — when provided, skip `rollItemStats()` and use the override values directly. This preserves the exact stats through the trade.

**Checkpoint**: Marketplace trades preserve per-instance stats end-to-end.

---

## Phase 7: User Story 6 — Visual Quality Indicators (Priority: P2)

**Goal**: Items show quality tier labels (Poor/Common/Fine/Superior) and color-coded stat values.

**Independent Test**: View two swords of the same type with different rolls — verify different tier labels and stat colors.

### Implementation

- [x] T014 [P] [US6] Modify `frontend/src/ui/InventoryPanel.ts` — Add quality tier display: (a) Show `slot.quality_label` next to item name (e.g., "Iron Sword [Fine]") with color based on tier. (b) Color-code the varied stat values: tier 1 (Poor) = #888888 gray, tier 2 (Common) = #cccccc white, tier 3 (Fine) = #44cc44 green, tier 4 (Superior) = #f0c060 gold. Use `slot.quality_tier` to determine color. Only color the stats that were randomized (instance fields that are non-null).
- [x] T015 [P] [US6] Modify `frontend/src/ui/EquipmentPanel.ts` — Same quality tier display as InventoryPanel: show `quality_label` in tooltip header with tier color, color-code varied stat values by tier. Define shared constants for tier colors (or import from a shared location if convenient).

**Checkpoint**: Items display quality tiers and color-coded stats. Full feature is complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tooling updates and cleanup

- [x] T016 Update `scripts/game-data.js` — When displaying inventory items, show instance stat values alongside definition values. Format: "Attack: 12 (base: 10, +20%)" for items with instance overrides. Show quality tier label.
- [x] T017 Add structured logging in `backend/src/game/inventory/inventory-grant-service.ts` — Log roll results when items are granted with instance stats: `{ event: 'item_roll', character_id, item_def_id, weapon_subtype, instance_stats, quality_tier }`.
- [x] T018 Verify `backend/src/game/disassembly/disassembly-service.ts` — Confirm disassembly does not attempt to preserve or transfer instance stats. The service should work unchanged since it operates on item_def_id, not instance columns.
- [x] T019 Verify `backend/src/game/crafting/crafting-service.ts` and `backend/src/game/crafting/crafting-handler.ts` — Confirm crafting output goes through `grantItemToCharacter()` and thus gets randomized. No changes needed if this is already the case.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1+US2 (Phase 3)**: Depends on Phase 2 — core randomization
- **US3 (Phase 4)**: Depends on Phase 2 only (combat stats query change is independent of grant flow)
- **US4 (Phase 5)**: Depends on Phase 2 (needs DTO changes) — can run parallel with US3
- **US5 (Phase 6)**: Depends on Phase 3 (needs the instanceStatsOverride parameter on grantItemToCharacter)
- **US6 (Phase 7)**: Depends on Phase 5 (builds on frontend display changes)
- **Polish (Phase 8)**: Depends on all story phases

### User Story Dependencies

- **US1+US2 (P1)**: After Foundational — no other story dependencies
- **US3 (P1)**: After Foundational — independent of US1/US2 (reads from DB, doesn't depend on grant changes)
- **US4 (P2)**: After Foundational — independent of US1/US2/US3 (frontend display)
- **US5 (P2)**: After US1+US2 — needs `instanceStatsOverride` parameter added in Phase 3
- **US6 (P2)**: After US4 — extends the frontend display with visual indicators

### Within Each Phase

- Tasks marked [P] can run in parallel
- Sequential tasks have implicit order (top to bottom)

### Parallel Opportunities

```
Phase 2:  T003 ──┐
          T004 ──┤ (all parallel - different files)
          T005 ──┘
                 │
Phase 3:  T006 → T007 → T008  (sequential - same file dependencies)
                 │
          ┌──────┴──────┐
Phase 4:  T009          │     (parallel with Phase 5)
Phase 5:  │      T010 ──┤
          │      T011 ──┘     (T010 & T011 parallel)
          │             │
Phase 6:  T012 → T013  │     (sequential - same file)
Phase 7:         T014 ──┤     (after Phase 5)
                 T015 ──┘     (T014 & T015 parallel)
```

---

## Implementation Strategy

### MVP First (User Stories 1+2+3 Only)

1. Complete Phase 1: Setup (migration + protocol)
2. Complete Phase 2: Foundational (roll service + queries)
3. Complete Phase 3: US1+US2 (randomization at grant time)
4. Complete Phase 4: US3 (combat stats use instance values)
5. **STOP and VALIDATE**: Grant items, check stat variation, enter combat, verify
6. At this point the core gameplay mechanic is live — items have variation and it affects combat

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1+US2 + US3 → Core mechanic live (MVP)
3. US4 → Players can see variation in UI
4. US5 → Marketplace preserves variation
5. US6 → Quality tiers add visual polish
6. Polish → Tooling and logging complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The SINGLE grant point design (FR-009) means all 10+ acquisition paths automatically get randomization from one code change in T006
- Existing items have NULL instance columns → COALESCE fallback to definition values = zero-risk migration
- Commit after each phase checkpoint for clean rollback points
