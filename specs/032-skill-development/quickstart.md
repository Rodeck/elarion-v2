# Quickstart: Skill Development System

**Feature**: 032-skill-development  
**Branch**: `032-skill-development`

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running with the game database
- All prior migrations (001-034) applied

## Setup

```bash
# 1. Switch to feature branch
git checkout 032-skill-development

# 2. Install dependencies (if any new ones added)
cd backend && npm install
cd ../frontend && npm install
cd ../admin/backend && npm install
cd ../admin/frontend && npm install

# 3. Run migration
psql -d elarion -f backend/src/db/migrations/035_skill_development.sql

# 4. Start services
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Admin backend
cd admin/backend && npm run dev

# Terminal 4: Admin frontend
cd admin/frontend && npm run dev
```

## Key Files to Read First

1. **Spec**: `specs/032-skill-development/spec.md` — what we're building
2. **Design**: `game_design/skill-development/design.md` — game design context
3. **Data Model**: `specs/032-skill-development/data-model.md` — new tables and relationships
4. **Contracts**: `specs/032-skill-development/contracts/skill-book-messages.ts` — WS message types
5. **Research**: `specs/032-skill-development/research.md` — key design decisions

## Existing Patterns to Follow

| Pattern | Reference File | What to Copy |
|---------|---------------|-------------|
| WS handler registration | `backend/src/game/training/stat-training-handler.ts` | Handler structure, message registration, validation pattern |
| Item consumption | `backend/src/game/training/stat-training-handler.ts:162-167` | Decrement or delete inventory item |
| DB query module | `backend/src/db/queries/loadouts.ts` | Query function patterns, JOIN structure |
| Frontend modal | `frontend/src/ui/StatTrainingModal.ts` | Modal overlay pattern, dark theme, gold accents |
| Admin modal | `frontend/src/ui/ListItemDialog.ts` | Overlay + dialog structure, z-index, close handling |
| Inventory "Use" | `frontend/src/ui/InventoryPanel.ts` | Detail panel with action button pattern |
| Admin card grid | `admin/frontend/src/ui/ability-manager.ts:buildAbilityCard()` | Card layout, stat chips, edit/delete buttons |

## Implementation Order

1. **Migration** → `035_skill_development.sql`
2. **Shared types** → extend `shared/protocol/index.ts`
3. **DB queries** → new `ability-levels.ts` + `ability-progress.ts`, modify `loadouts.ts` + `inventory.ts`
4. **Backend handler** → new `skill-book-handler.ts`, register in `index.ts`
5. **Combat integration** → modify `loadouts.ts` query to return level-scaled stats
6. **Admin backend** → add level endpoints to `abilities.ts`, add `skill_book` to `items.ts`
7. **Admin frontend** → overhaul `ability-manager.ts` to modal-based with level stats
8. **Frontend loadout** → modify `LoadoutPanel.ts`, create `SkillDetailModal.ts`
9. **Frontend inventory** → add "Use" button to `InventoryPanel.ts`, register handlers in `GameScene.ts`
10. **Tooling** → update `game-entities.js`, `game-data.js`, `game-entities.md`, `game-data.md`, `gd.design.md`, `CLAUDE.md`

## Verification

```bash
# Run tests
npm test && npm run lint

# Manual testing steps (see spec.md Testing Walkthrough):
# 1. Create skill book items via admin/game-entities
# 2. Grant ability + skill book to test character
# 3. Use skill book from inventory → verify points gained
# 4. Repeat until level up → verify combat uses new stats
# 5. Verify cooldown enforcement (6 hours per ability)
# 6. Test admin modal: create/edit ability with level stats
```
