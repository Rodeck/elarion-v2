# Quickstart: Quest System Development

**Feature**: 021-quest-system | **Date**: 2026-03-24

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running locally
- Existing Elarion v2 dev environment set up (backend, frontend, admin all buildable)

## Branch Setup

```bash
git checkout 021-quest-system
```

## Development Order

### Phase 1: Database + Protocol + Backend Core

1. **Migration**: Write `backend/src/db/migrations/022_quest_system.sql` (7 tables + 1 ALTER)
2. **Protocol**: Add quest types and DTOs to `shared/protocol/index.ts`
3. **Queries**: Create `backend/src/db/queries/quests.ts`
4. **Service**: Create `backend/src/game/quest/quest-service.ts` (DTO builders, prerequisite checking, reward granting)
5. **Handler**: Create `backend/src/game/quest/quest-handler.ts` (WS message handlers)
6. **Tracker**: Create `backend/src/game/quest/quest-tracker.ts` (objective progress tracking)
7. **Register**: Add `registerQuestHandlers()` call in `backend/src/index.ts`

**Verify**: Start backend, check migration runs, tables exist.

### Phase 2: Quest Tracker Integration

Hook tracker into existing systems (one call per file):
- `combat-session.ts` → `onMonsterKilled`
- `crafting-handler.ts` → `onItemCrafted`
- `gathering-handler.ts` → `onGatheringCompleted`
- `inventory-grant-service.ts` → `onInventoryChanged`
- `xp-service.ts` → `onLevelUp`
- `crown-service.ts` → `onCrownsSpent`
- `city-movement-handler.ts` → `onLocationVisited`

**Verify**: Accept a kill quest, kill target monster, check DB for updated progress.

### Phase 3: Admin UI

1. **Routes**: Create `admin/backend/src/routes/quests.ts` + mount in `admin/backend/src/index.ts`
2. **API Client**: Add quest functions to `admin/frontend/src/editor/api.ts`
3. **Manager**: Create `admin/frontend/src/ui/quest-manager.ts`
4. **Tab**: Add Quests tab in `admin/frontend/src/main.ts`
5. **Catalog**: Add `GET /api/quests/catalog` endpoint

**Verify**: Create a quest via admin UI, verify it appears in quest list and can be edited.

### Phase 4: Frontend Game UI

1. Add `is_quest_giver` to NPC DTO in protocol + world state
2. Modify `BuildingPanel.ts` — add quest dialogue option
3. Create `QuestPanel.ts` — NPC quest interaction modal
4. Create `QuestLog.ts` — quest journal panel
5. Create `QuestTracker.ts` — HUD overlay
6. Wire message handlers in `GameScene.ts`

**Verify**: Full end-to-end: create quest in admin → talk to NPC → accept → complete objectives → turn in → receive rewards.

## Running the Project

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Admin backend
cd admin/backend && npm run dev

# Terminal 4: Admin frontend
cd admin/frontend && npm run dev
```

## Key Files Reference

| Purpose | Path |
|---------|------|
| Migration | `backend/src/db/migrations/022_quest_system.sql` |
| Protocol types | `shared/protocol/index.ts` |
| DB queries | `backend/src/db/queries/quests.ts` |
| Quest handler | `backend/src/game/quest/quest-handler.ts` |
| Quest service | `backend/src/game/quest/quest-service.ts` |
| Quest tracker | `backend/src/game/quest/quest-tracker.ts` |
| Handler registration | `backend/src/index.ts` |
| Admin routes | `admin/backend/src/routes/quests.ts` |
| Admin quest editor | `admin/frontend/src/ui/quest-manager.ts` |
| Admin API client | `admin/frontend/src/editor/api.ts` |
| NPC dialogue | `frontend/src/ui/BuildingPanel.ts` |
| Quest panel | `frontend/src/ui/QuestPanel.ts` |
| Quest log | `frontend/src/ui/QuestLog.ts` |
| Quest HUD | `frontend/src/ui/QuestTracker.ts` |
| Game scene wiring | `frontend/src/scenes/GameScene.ts` |
