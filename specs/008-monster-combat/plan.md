# Implementation Plan: Monster Combat System

**Branch**: `008-monster-combat` | **Date**: 2026-03-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-monster-combat/spec.md`

---

## Summary

Replace the old roaming-monster system with a building-exploration mechanic. Players click an **Explore** action on a building to roll for a monster encounter. Combat is resolved fully server-side in a single pass; the result is streamed to the client in a modal with artificial per-round delays. Admins manage monsters (stats, icon, loot table) and configure exploration probability + monster tables per building via the admin panel. The old `monsters`, `combat_simulations`, and `combat_participants` tables are dropped and replaced by a clean schema.

---

## Technical Context

**Language/Version**: TypeScript 5.x (all packages — frontend, backend, shared, admin)
**Primary Dependencies**:
- Game backend: Node.js 20 LTS, `ws` (WebSocket), PostgreSQL `pg` driver
- Game frontend: Phaser 3.60.0, Vite 5
- Admin backend: Express 4, `multer` (icon uploads)
- Admin frontend: Vite 5, vanilla TypeScript DOM

**Storage**: PostgreSQL 16 — new `monsters` + `monster_loot` tables; `building_actions` extended; old combat tables dropped

**Testing**: `npm test && npm run lint` (from repo root)

**Target Platform**: Browser (frontend), Node.js server (backend), Admin browser SPA

**Project Type**: Full-stack multiplayer RPG (monorepo: frontend / backend / shared / admin)

**Performance Goals**: Explore response < 500 ms end-to-end (combat resolution is pure computation, negligible latency)

**Constraints**: Server-authoritative combat (no client trust); WebSocket-only for game state mutations; icon files < 2 MB (matches item icon limit)

**Scale/Scope**: ~tens of monster types, ~hundreds of active players; no high-concurrency concern for explore action

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status | Notes |
|------|------------|--------|-------|
| 1. No REST for game state | Explore action uses `city.building_action` WebSocket message; combat result sent via `building.explore_result` WebSocket | ✅ PASS | Admin monster CRUD uses REST — permitted (admin tool, not game state) |
| 2. Server-side validation | All gate checks (at building, not in combat, valid action, valid monster table) in `handleBuildingAction`; combat resolved server-side | ✅ PASS | No client-trust for encounter roll or damage calculation |
| 3. Structured logging | Explore + combat events will emit structured logs in handler and combat service | ✅ PLAN | Log: explore triggered, encounter roll, monster selected, combat outcome, XP/loot granted |
| 4. Contract documented | New `building.explore_result` type + modified `BuildingActionDto` documented in `contracts/websocket.md` | ✅ DONE | See contracts/websocket.md |
| 5. Graceful rejection handling | `BuildingPanel.ts` handles `city.building_action_rejected` (already implemented for travel); new `'EXPLORE_FAILED'` reason added | ✅ PLAN | Frontend shows inline error message; does not freeze |
| 6. Complexity justified | No novel abstractions introduced; pattern follows existing building-action + item patterns | ✅ PASS | No Complexity Tracking entries required |

---

## Project Structure

### Documentation (this feature)

```text
specs/008-monster-combat/
├── plan.md              ← this file
├── spec.md              ← feature specification
├── research.md          ← Phase 0 decisions
├── data-model.md        ← Phase 1 schema design
├── quickstart.md        ← Phase 1 dev guide
├── contracts/
│   └── websocket.md     ← Phase 1 protocol contract
└── checklists/
    └── requirements.md  ← spec validation checklist
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 011_monster_combat.sql    NEW
│   │   └── queries/
│   │       ├── monsters.ts               REWRITE (new schema)
│   │       └── monster-loot.ts           NEW
│   ├── game/
│   │   ├── combat/
│   │   │   └── explore-combat-service.ts NEW
│   │   └── world/
│   │       ├── building-action-handler.ts MODIFY (+explore case)
│   │       ├── monster-registry.ts        DELETE (old system)
│   │       └── monster-spawner.ts         DELETE (old system)
│   └── index.ts                           MODIFY (remove spawner init, remove combat.start handler)

shared/
└── protocol/
    └── index.ts                           MODIFY (remove old types, add explore types)

admin/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── monsters.ts                NEW
│   │   └── index.ts                       MODIFY (+monsters route, +monster-icons static)
│   └── assets/
│       └── monsters/
│           └── icons/                     NEW directory (gitignored like items/icons/)
└── frontend/
    └── src/
        ├── ui/
        │   ├── monster-manager.ts          NEW
        │   └── properties.ts              MODIFY (explore action config in building panel)
        ├── editor/
        │   └── api.ts                     MODIFY (+monster API fns, +explore action config)
        └── main.ts                        MODIFY (+Monsters tab)

frontend/
└── src/
    ├── scenes/
    │   └── GameScene.ts                   MODIFY (handle explore_result, remove old monster handlers)
    ├── ui/
    │   ├── BuildingPanel.ts               MODIFY (explore button + result, open CombatModal)
    │   └── CombatModal.ts                 NEW
    └── entities/
        └── MonsterSprite.ts               DELETE (old system)
```

**Structure Decision**: Follows the existing monorepo layout. Backend combat logic lives under `game/combat/` (new subdirectory, same level as `game/world/`). Admin follows the `ItemManager` → `MonsterManager` pattern. No new packages or projects added.

---

## Implementation Phases

### Phase A: Schema & Protocol (blocking)

All subsequent phases depend on this.

1. Write `backend/src/db/migrations/011_monster_combat.sql` — drop old tables, create `monsters` + `monster_loot`, alter `building_actions` CHECK constraint.
2. Rewrite `backend/src/db/queries/monsters.ts` — CRUD queries for new schema.
3. Create `backend/src/db/queries/monster-loot.ts` — loot entry CRUD.
4. Update `shared/protocol/index.ts`:
   - Remove: `MonsterInstance`, `ItemGained`, `CombatStartPayload`, `CombatStartedPayload`, `CombatRoundPayload`, `CombatEndedPayload`, `MonsterSpawnedPayload`, `MonsterDespawnedPayload`, `CombatStartMessage`.
   - Remove `monsters` from `WorldStatePayload`.
   - Extend `CityBuildingActionPayload.action_type` → `'travel' | 'explore'`.
   - Change `BuildingActionDto` to a discriminated union (`TravelBuildingActionDto | ExploreBuildingActionDto`).
   - Add: `ExploreActionDto`, `CombatRoundRecord`, `ItemDroppedDto`, `BuildingExploreResultPayload`.
   - Extend `CityBuildingActionRejectedPayload.reason` with `'EXPLORE_FAILED'`.

### Phase B: Backend Combat & Explore Handler

Depends on Phase A.

5. Create `backend/src/game/combat/explore-combat-service.ts`:
   - `resolveExplore(character, exploreConfig)` — rolls encounter, selects monster, runs combat loop, rolls loot drops, grants XP (with level-up check), grants items via `grantItemToCharacter`.
   - Returns `BuildingExploreResultPayload`.
6. Modify `backend/src/game/world/building-action-handler.ts`:
   - Add `'explore'` branch after gate checks.
   - Call `resolveExplore` and send `building.explore_result`.
   - Add structured log events: `explore_triggered`, `no_encounter`, `combat_outcome`.
7. Delete `backend/src/game/world/monster-registry.ts`.
8. Delete `backend/src/game/world/monster-spawner.ts`.
9. Update `backend/src/index.ts`:
   - Remove monster-spawner initialisation call.
   - Remove `registerHandler('combat.start', ...)`.

### Phase C: Admin Backend (monsters)

Depends on Phase A (new DB queries).

10. Create `admin/backend/src/routes/monsters.ts`:
    - `GET /api/monsters` — list all monsters.
    - `GET /api/monsters/:id` — get monster with loot entries.
    - `POST /api/monsters` — create (multipart; optional icon upload to `backend/assets/monsters/icons/`).
    - `PUT /api/monsters/:id` — update.
    - `DELETE /api/monsters/:id` — delete monster + icon file.
    - `GET /api/monsters/:id/loot` — list loot entries.
    - `POST /api/monsters/:id/loot` — add loot entry (validate `item_def_id` exists).
    - `PUT /api/monsters/:id/loot/:lootId` — update loot entry.
    - `DELETE /api/monsters/:id/loot/:lootId` — remove loot entry.
11. Update `admin/backend/src/index.ts`:
    - Mount `/api/monsters` router.
    - Serve `backend/assets/monsters/icons/` at `/monster-icons/`.
12. Validate explore action config in the buildings route (`buildings.ts`):
    - For `action_type: 'explore'`, validate `encounter_chance` (0–100) and `monsters[]` entries (monster_id exists, weight > 0).

### Phase D: Admin Frontend (monsters + explore config)

Depends on Phase C.

13. Update `admin/frontend/src/editor/api.ts`:
    - Add monster CRUD functions (`getMonsters`, `getMonster`, `createMonster`, `updateMonster`, `deleteMonster`).
    - Add monster loot functions (`addLootEntry`, `updateLootEntry`, `deleteLootEntry`).
14. Create `admin/frontend/src/ui/monster-manager.ts`:
    - Monster list view with create/edit/delete.
    - Monster form: name, attack, defense, HP, XP reward, optional icon upload.
    - Inline loot section: add/remove loot entries (item dropdown from `/api/items`, drop_chance, quantity).
15. Update `admin/frontend/src/main.ts`:
    - Add **Monsters** tab (alongside Maps, Items, Admin Tools).
    - Lazy-init `MonsterManager` on tab click.
16. Update `admin/frontend/src/ui/properties.ts`:
    - In the building actions panel, add **Explore** as a selectable action type.
    - When explore is selected: render encounter_chance number input + monster table editor (fetch `/api/monsters` for the dropdown; rows: monster name, weight, delete button; add-row button).

### Phase E: Game Frontend (combat modal + explore result)

Depends on Phase A (protocol types) and Phase B (backend sends the message).

17. Create `frontend/src/ui/CombatModal.ts`:
    - Pure HTML modal overlay (same pattern as other UI panels).
    - Accepts `BuildingExploreResultPayload`.
    - Renders monster icon (or placeholder), name, max HP.
    - Streams combat rounds: reveals each `CombatRoundRecord` with ~800 ms delay (via `setTimeout` chain).
    - After last round, shows result banner: Win (green, XP + items) or Loss (red, "You were defeated").
    - Shows "Close" button only after all rounds are revealed.
    - Emits `onClose` callback.
18. Modify `frontend/src/ui/BuildingPanel.ts`:
    - Render an **Explore** button for actions with `action_type: 'explore'`.
    - On click: send `city.building_action` (`action_type: 'explore'`), disable button while waiting.
    - Add `showExploreResult(payload: BuildingExploreResultPayload)` — if `outcome === 'no_encounter'` show a brief inline message; if `outcome === 'combat'` open `CombatModal`.
19. Modify `frontend/src/scenes/GameScene.ts`:
    - Register handler for `building.explore_result` → call `buildingPanel.showExploreResult(payload)`.
    - Remove handlers for `combat.started`, `combat.round`, `combat.ended`.
    - Remove handlers for `monster.spawned`, `monster.despawned`.
    - Remove monster sprite spawning code.
    - Remove `WorldStatePayload.monsters` rendering.
20. Delete `frontend/src/entities/MonsterSprite.ts`.

---

## Complexity Tracking

No violations of Constitution Principle III (Simplicity & YAGNI) are present in this plan.

---

## Risks & Notes

| Risk | Mitigation |
|------|-----------|
| Infinite combat loop if monster has 0 attack and player has very high defence | `max(1, ...)` formula ensures minimum 1 damage per hit — loop always terminates |
| `WorldStatePayload.monsters` removal may break frontend if any code still reads it | Full removal + TypeScript compilation will catch all usages at build time |
| Old `combat.start` handler removal may leave dead ws handler registration | Removing the `registerHandler` call in `index.ts` + deleting the handler file eliminates this cleanly |
| Monster icon directory not committed to git | Add `backend/assets/monsters/icons/.gitkeep` to ensure directory exists |
| Loot drops for `inventory.full` case | `grantItemToCharacter` already handles full inventory — sends `inventory.full` message; combat reward flow should collect and report all items, noting any that couldn't be added |
