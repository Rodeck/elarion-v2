# Quickstart: Fishing System

**Feature**: 024-fishing-system | **Date**: 2026-03-26

## Prerequisites

- Node.js 20 LTS, PostgreSQL 16 running
- Game server and frontend dev server running (`npm run dev` in backend/frontend)
- Admin server running on port 4001

## Implementation Order

### Phase 1: Database & Types (Foundation)

1. **Migration 026**: Create `fishing_loot` and `fishing_rod_tiers` tables. ALTER `characters` to add `rod_upgrade_points`. Extend CHECK constraints on `item_definitions.category` (+ring, +amulet), `item_definitions.tool_type` (+fishing_rod), `inventory_items.equipped_slot` (+ring, +amulet), `building_actions.action_type` (+fishing).

2. **Shared protocol types**: Add to `shared/protocol/index.ts`:
   - `'ring'` and `'amulet'` to `ItemCategory` and `EquipSlot`
   - `ring` and `amulet` fields to `EquipmentSlotsDto`
   - `'rod_upgrade_points'` to `RewardType`
   - `FishingBuildingActionDto` to `BuildingActionDto` union
   - All fishing message payload interfaces (see contracts/fishing-protocol.md)

### Phase 2: Equipment Extension (Ring & Amulet)

3. **Equipment handler**: In `backend/src/game/equipment/equipment-handler.ts`, add `'ring'` and `'amulet'` to `VALID_SLOTS` and add entries to `SLOT_CATEGORY_MAP`.

4. **Equipment queries**: In `backend/src/db/queries/equipment.ts`, no changes needed — the generic SQL already sums stats from all equipped items.

5. **Combat stats**: In `backend/src/game/combat/combat-stats-service.ts`, no changes needed — `computeCombatStats()` already aggregates all equipped items.

6. **Frontend equipment UI**: Update equipment panel to render ring and amulet slots.

### Phase 3: Core Fishing Loop

7. **Fishing handler** (`backend/src/game/fishing/fishing-handler.ts`): Handle `fishing.cast`, `fishing.complete`, `fishing.cancel` messages. Validate preconditions (rod equipped, at fishing spot, not in combat, durability > 1).

8. **Fishing service** (`backend/src/game/fishing/fishing-service.ts`): In-memory session management. On cast: pick fish from loot pool, generate pull pattern parameters, compute bite delay, create session. On complete: validate timing data, run anti-bot checks, determine success, grant loot, consume durability.

9. **Fishing loot service** (`backend/src/game/fishing/fishing-loot-service.ts`): Query `fishing_loot` table filtered by rod tier, weighted random selection.

10. **Building action dispatch**: Add `'fishing'` case to `building-action-handler.ts` that sends the player to the fishing handler.

11. **Frontend mini-game** (`frontend/src/ui/fishing-minigame.ts`): Render tension meter from server parameters, capture player inputs with timestamps, send `fishing.complete` on finish.

### Phase 4: Rod Progression

12. **Fishing upgrade service** (`backend/src/game/fishing/fishing-upgrade-service.ts`): Handle rod upgrades (transform in-place: update item_def_id to next tier's rod, reset durability). Handle rod repairs (restore durability, deduct crowns).

13. **Fishing DB queries** (`backend/src/db/queries/fishing.ts`): Queries for rod tier lookup, upgrade points management, loot table access.

14. **Quest reward integration**: In `backend/src/game/quest/quest-service.ts`, add `'rod_upgrade_points'` case to `grantQuestRewards()` — calls a new `awardRodUpgradePoints()` function.

### Phase 5: Content & Quests

15. **Seed data**: Create all item definitions (5 rods, 12 fish, 4 rings, 4 amulets) via admin API or migration INSERT statements.

16. **Fishing loot entries**: Populate `fishing_loot` table with drop weights per item per rod tier.

17. **Fisherman NPC**: Create via admin API with `is_quest_giver: true`. Assign to a water building.

18. **Daily quests**: Create 4+ quest definitions with `quest_type: 'daily'`, objective `'collect_item'` targeting fish, reward `'rod_upgrade_points'` + `'crowns'`.

19. **Fishing building actions**: Add `action_type: 'fishing'` actions to 3+ water buildings via admin.

### Phase 6: Admin & Polish

20. **Admin routes** (`admin/backend/src/routes/fishing.ts`): CRUD for fishing_loot table entries.

21. **Admin UI**: Fishing loot manager for configuring drop weights and tier gates.

22. **Frontend polish**: Fishing spot indicators on map, rod durability display, upgrade/repair UI at Fisherman NPC.

## Key Files to Read First

| Purpose | File |
|---------|------|
| Equipment system pattern | `backend/src/game/equipment/equipment-handler.ts` |
| Gathering system pattern | `backend/src/game/gathering/gathering-handler.ts` |
| Building action dispatch | `backend/src/game/world/building-action-handler.ts` |
| Quest reward granting | `backend/src/game/quest/quest-service.ts` (grantQuestRewards) |
| Inventory granting | `backend/src/game/inventory/inventory-grant-service.ts` |
| Protocol types | `shared/protocol/index.ts` |
| Latest migration | `backend/src/db/migrations/025_marketplace.sql` |

## Testing Checklist

- [ ] Equip T1 rod → fish at spot → complete mini-game → receive fish
- [ ] Fail mini-game → no loot, durability consumed
- [ ] Fish until durability = 1 → rod locked, cannot fish
- [ ] Repair rod at Fisherman → full durability, crowns deducted
- [ ] Upgrade rod T1→T2 → same item, new stats, new loot pool
- [ ] Equip ring → stats appear in combat
- [ ] Equip amulet → stats appear in combat
- [ ] Accept daily quest → catch required fish → quest progress updates → turn in → receive rod upgrade points + crowns
- [ ] Fish with inhuman timing consistency → snap check triggers
- [ ] Disconnect mid-fishing → session cleaned up, durability consumed
- [ ] Inventory full → catch lost with warning
- [ ] List fish on marketplace → another player can buy
