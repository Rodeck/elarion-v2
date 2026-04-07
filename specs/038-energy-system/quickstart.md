# Quickstart: Energy & Movement Speed System

**Branch**: `038-energy-system` | **Date**: 2026-04-07

## Prerequisites

- PostgreSQL 16 running with Elarion database
- Node.js 20 LTS
- All existing migrations applied (up to 041)

## Implementation Order

### Phase 1: Database + Shared Types

1. Create and run migration `042_energy_system.sql`
2. Update `shared/protocol/index.ts` — add fields to `CharacterData`, new payload types, extend `GatherBuildingActionDto`
3. Update `backend/src/db/queries/characters.ts` — add energy/movement_speed to `Character` interface and `updateCharacter` allowlist

### Phase 2: Backend Core

4. Create `backend/src/game/regen/energy-regen-service.ts` — mirror hp-regen-service pattern
5. Modify `backend/src/game/regen/hp-regen-service.ts` — read interval/percent from admin config
6. Update `backend/src/db/queries/admin-config.ts` — add 4 new config keys
7. Create `backend/src/game/inventory/inventory-use-handler.ts` — food/heal item consumption
8. Register `inventory.use_item` handler + start energy regen in `backend/src/index.ts`

### Phase 3: Energy Gates (all action handlers)

9. `backend/src/game/world/city-movement-handler.ts` — per-step energy deduction + speed scaling
10. `backend/src/game/world/building-action-handler.ts` — energy check for explore
11. `backend/src/game/arena/arena-handler.ts` — energy check on enter
12. `backend/src/game/boss/boss-combat-handler.ts` — energy check + death penalty
13. `backend/src/game/fishing/fishing-handler.ts` — energy check on cast
14. `backend/src/game/gathering/gathering-handler.ts` — energy check on start
15. `backend/src/game/gathering/gathering-service.ts` — per-tick deduction + early stop
16. `backend/src/game/combat/combat-session.ts` — halve energy on death

### Phase 4: Frontend

17. `frontend/src/scenes/GameScene.ts` — handle `character.energy_changed`, `inventory.use_result`, `inventory.use_rejected`
18. `frontend/src/ui/StatsBar.ts` — energy bar (collapsed + expanded) + movement speed display
19. `frontend/src/ui/InventoryPanel.ts` — "Use" button for food/heal items

### Phase 5: Admin Panel

20. `admin/frontend/src/ui/admin-config-manager.ts` — energy/HP regen config fields
21. `admin/backend/src/routes/buildings.ts` — energy_per_second in gather config
22. `admin/frontend/src/ui/properties.ts` — energy_per_second field in gather action editor

### Phase 6: World State Loader

23. `backend/src/game/world/city-map-loader.ts` — include energy_per_second in GatherBuildingActionDto

## Key Files Reference

| Purpose | File |
|---------|------|
| Migration | `backend/src/db/migrations/042_energy_system.sql` |
| Protocol types | `shared/protocol/index.ts` |
| Character queries | `backend/src/db/queries/characters.ts` |
| Energy regen | `backend/src/game/regen/energy-regen-service.ts` |
| HP regen (configurable) | `backend/src/game/regen/hp-regen-service.ts` |
| Item use handler | `backend/src/game/inventory/inventory-use-handler.ts` |
| Admin config | `backend/src/db/queries/admin-config.ts` |
| Stats bar UI | `frontend/src/ui/StatsBar.ts` |
| Protocol contract | `specs/038-energy-system/contracts/energy-protocol.md` |

## Verification

After implementation:

1. Create a character — verify energy = 1000, movement_speed = 100 in expanded panel
2. Travel between city nodes — verify energy decreases by 2 per step
3. Drain energy to 0 — verify city movement slows down, other actions show "Not enough energy"
4. Wait for regen tick — verify energy increases
5. Use food item — verify energy restores
6. Use heal item — verify HP restores
7. Die in combat — verify energy halved
8. Admin: change regen config — verify next tick uses new values
9. Admin: set energy_per_second on a gather action — verify gathering drains energy
