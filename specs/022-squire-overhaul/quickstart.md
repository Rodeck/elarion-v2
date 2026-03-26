# Quickstart: Squire System Overhaul

**Branch**: `022-squire-overhaul` | **Date**: 2026-03-24

## Prerequisites

- PostgreSQL 16 running with existing Elarion schema (migrations 001–022 applied)
- Node.js 20 LTS
- All existing `npm install` dependencies (no new packages required)

## Implementation Order

### Phase 1: Database & Shared Types

1. **Migration `023_squire_overhaul.sql`**: Create `squire_definitions`, rename `squires` → `character_squires` with new columns, create `monster_squire_loot`, alter `quest_rewards` CHECK, alter `npcs`, alter `characters`. Migrate legacy data.

2. **Shared protocol types**: Add `SquireDefinitionDto`, `CharacterSquireDto`, `SquireRosterDto`, `SquireDroppedDto` to `shared/protocol/index.ts`. Add `SQUIRE_RANKS` constant and `getSquireRank()` helper. Extend `RewardType`, `GatheringTickEvent`, `CombatEndPayload`, `ExpeditionDispatchPayload`.

### Phase 2: Backend Core

3. **DB queries** (`backend/src/db/queries/squire-definitions.ts`): CRUD for squire definitions.

4. **DB queries update** (`backend/src/db/queries/squires.ts`): Update all queries to use `character_squires` table with JOINs to `squire_definitions`. Add `getSquireCount()`, `canAcquireSquire()`, `deleteSquire()`.

5. **Squire grant service** (`backend/src/game/squire/squire-grant-service.ts`): Central `grantSquireToCharacter(characterId, squireDefId, level)` — checks slot availability, creates `character_squires` row, sends `squire.acquired` or `squire.acquisition_failed`.

6. **Monster squire loot** (`backend/src/db/queries/monster-squire-loot.ts`): CRUD queries. Update `combat-session.ts` to roll squire drops after item drops.

7. **Quest squire rewards**: Update `quest-service.ts` `grantQuestRewards()` to handle `reward_type === 'squire'`. Update `quest-handler.ts` space check to include squire slot availability.

8. **Gathering squire events**: Update `gathering-service.ts` to handle `type: 'squire'` events, calling the squire grant service.

9. **Expedition power bonus**: Update `expedition-service.ts` `computeRewardSnapshot()` to accept squire power_level and apply `1 + (power_level / 100)` multiplier. Update `buildExpeditionStateDto()` to include available squires.

10. **Expedition dispatch update**: Update `expedition-handler.ts` to accept `squire_id` from payload, validate ownership and idle status.

11. **Dismissal handler** (`backend/src/game/squire/squire-dismiss-handler.ts`): Handle `squire.dismiss_list` and `squire.dismiss_confirm`. Validate NPC is dismisser, squire is idle, player owns squire.

12. **Roster handler**: Handle `squire.roster` request, return full `SquireRosterDto`.

### Phase 3: Admin Backend

13. **Squire definitions routes** (`admin/backend/src/routes/squire-definitions.ts`): CRUD endpoints + icon upload.

14. **Monster squire loot routes**: Add endpoints to `admin/backend/src/routes/monsters.ts`.

15. **NPC dismisser route**: Add `PUT /api/npcs/:id/squire-dismisser` to `admin/backend/src/routes/npcs.ts`.

16. **Extend quest routes**: Update validation in `admin/backend/src/routes/quests.ts` to accept `reward_type: 'squire'`.

17. **Extend building action routes**: Update gather event validation in `admin/backend/src/routes/buildings.ts` to accept `type: 'squire'`.

### Phase 4: Agent Commands

18. **game-entities.js**: Add `create-squire`, `upload-squire-icon`, `create-monster-squire-loot` commands. Extend `create-quest` and `create-building-action` validators for squire types.

19. **game-entities.md**: Update skill documentation with new commands and examples.

### Phase 5: Admin Frontend

20. **Squire definitions UI** in admin panel: List, create, edit, deactivate, icon upload.

21. **Monster squire loot UI**: Add squire loot section to monster editor.

22. **NPC dismisser toggle**: Add checkbox to NPC editor.

23. **Quest reward squire option**: Add squire type to quest reward editor.

24. **Gather event squire option**: Add squire type to gather event editor.

### Phase 6: Game Frontend

25. **Squire roster panel** (`frontend/src/ui/SquireRosterPanel.ts`): New UI component showing 5 slots with squire cards (name, icon, rank, power, status).

26. **Expedition UI update**: Update `BuildingPanel.ts` expedition section to show squire picker instead of single squire name. Show power bonus on reward estimates.

27. **NPC dismissal UI**: Add "I want to dismiss a squire" option to NPC dialog when `is_squire_dismisser`. Show squire selection list and confirmation dialog.

28. **Combat end squire drops**: Update combat end UI to display squire drops alongside item drops.

29. **Gathering squire events**: Update gathering tick UI to show squire acquisition events.

30. **Quest complete squire rewards**: Update quest completion UI to display squire rewards.

### Phase 7: Migration & Integration

31. **World state handler update**: Update `world-state-handler.ts` to send squire roster on connect (replace legacy squire backfill).

32. **Character creation update**: Remove legacy random squire assignment from `character-create-handler.ts`. New characters start with empty roster.

## File Impact Summary

| Area | Files Modified | Files Created |
|------|---------------|---------------|
| Migration | - | `023_squire_overhaul.sql` |
| Shared | `shared/protocol/index.ts` | - |
| Backend DB | `squires.ts` | `squire-definitions.ts`, `monster-squire-loot.ts` |
| Backend Game | `expedition-service.ts`, `expedition-handler.ts`, `combat-session.ts`, `gathering-service.ts`, `quest-service.ts`, `quest-handler.ts`, `world-state-handler.ts`, `character-create-handler.ts`, `city-movement-handler.ts` | `squire-grant-service.ts`, `squire-dismiss-handler.ts` |
| Backend WS | `index.ts` (register handlers), `validator.ts` | - |
| Admin Backend | `monsters.ts`, `npcs.ts`, `quests.ts`, `buildings.ts` | `squire-definitions.ts` |
| Admin Frontend | `properties.ts`, `quest-manager.ts` | squire definitions UI section |
| Game Frontend | `BuildingPanel.ts`, `GameScene.ts` | `SquireRosterPanel.ts` |
| Scripts | `game-entities.js` | - |
| Skill Docs | `.claude/commands/game-entities.md` | - |

## Validation Checklist

- [ ] Legacy squires migrated correctly (all existing characters retain their squire)
- [ ] Squire acquisition from all 3+ sources works
- [ ] Expedition power bonus doubles rewards at max power
- [ ] Roster full prevents new acquisitions
- [ ] Dismissal at NPC works with confirmation
- [ ] Squires on expedition cannot be dismissed
- [ ] Agent commands create definitions and configure drops
- [ ] Admin panel CRUD for squire definitions
- [ ] All squire levels display as named ranks
