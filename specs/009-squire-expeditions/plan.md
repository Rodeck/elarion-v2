# Implementation Plan: Squire Expeditions

**Branch**: `009-squire-expeditions` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)

## Summary

Introduce passive expeditions to the game: admins configure expedition actions on
buildings (rewards + durations); players dispatch their squire(s) from the building
menu for a chosen duration; when the timer expires the server notifies the player
on next connect; the player visits the building to collect gold, exp, and items.
Each new character starts with one idle squire. The feature extends the existing
building action system (action type `'expedition'`) and adds two new WebSocket
message pairs.

---

## Technical Context

**Language/Version**: TypeScript 5.x (all packages)
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + ws (backend), Express 4 (admin backend), Vite 5 (frontends)
**Storage**: PostgreSQL 16 — two new tables (`squires`, `squire_expeditions`), extended `building_actions` CHECK constraint
**Testing**: `npm test && npm run lint` (existing project commands)
**Target Platform**: Browser (frontend) + Node.js server (backend) + Node.js server (admin backend)
**Project Type**: multiplayer web RPG (WebSocket game + REST admin)
**Performance Goals**: match existing baseline; no new polling loops in initial implementation
**Constraints**: no REST for game-state mutations; server-authoritative; structured logging required
**Scale/Scope**: same player scale as existing game; one squire per player at launch

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Dispatch and collect use WebSocket (`expedition.dispatch`, `expedition.collect`). Admin configuration uses REST (admin-only, not game state mutation). |
| 2. Server-side validation present | PASS | All dispatch and collect validations run server-side in `expedition-handler.ts` before any state change. |
| 3. Structured logging required | PASS | All code paths in `expedition-handler.ts` and `expedition-service.ts` emit `log()` calls matching the existing pattern. |
| 4. Contract documented | PASS | Full contract in `contracts/websocket-expedition.md` covering all new message types and the `city.building_arrived` extension. |
| 5. Graceful rejection handling | PASS | Both `expedition.dispatch_rejected` and `expedition.collect_rejected` payloads are defined; `BuildingPanel.ts` handles them with user-visible error messages. |
| 6. Complexity justified | See table below |

---

## Complexity Tracking

> No constitution violations. No entries required.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-squire-expeditions/
├── plan.md              # This file
├── research.md          # Phase 0 — all design decisions
├── data-model.md        # Phase 1 — DB schema + TypeScript interfaces
├── quickstart.md        # Phase 1 — dev setup guide
├── contracts/
│   └── websocket-expedition.md  # Phase 1 — full WS + REST contract
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code

```text
backend/src/
├── db/
│   ├── migrations/
│   │   └── 012_squire_expeditions.sql        [NEW]
│   └── queries/
│       └── squires.ts                         [NEW]
├── game/
│   ├── expedition/
│   │   ├── expedition-handler.ts              [NEW]
│   │   └── expedition-service.ts              [NEW]
│   └── world/
│       ├── building-action-handler.ts         [CHANGED — add expedition_state to building_arrived]
│       └── character-create-handler.ts        [CHANGED — insert squire on character creation]
├── websocket/
│   ├── handlers/
│   │   └── world-state-handler.ts             [CHANGED — notify completed expeditions on connect]
│   └── validator.ts                           [CHANGED — add schemas for new C→S messages]
└── index.ts                                   [CHANGED — register expedition handlers]

shared/
└── protocol/index.ts                          [CHANGED — add expedition message types]

admin/
├── backend/src/routes/buildings.ts            [CHANGED — accept 'expedition' action_type]
└── frontend/src/ui/properties.ts             [CHANGED — expedition form fields]

frontend/src/
├── network/WSClient.ts                        [CHANGED — handle new S→C messages]
├── scenes/GameScene.ts                        [CHANGED — wire expedition callbacks]
└── ui/BuildingPanel.ts                        [CHANGED — expedition UI section]
```

**Structure Decision**: Web application layout (backend + frontend + shared + admin).
All changes fit within the existing monorepo structure. No new packages or directories
are created (the `expedition/` subdirectory under `game/` is the only new folder).

---

## Implementation Phases

### Phase A — Database & Shared Protocol

**Goal**: Establish the DB schema and shared TypeScript types before any handler code.

**Tasks**:

A1. Write `012_squire_expeditions.sql`:
  - Extend `building_actions.action_type` CHECK to include `'expedition'`
  - Create `squires` table
  - Create `squire_expeditions` table (see `data-model.md` for full DDL)

A2. Write `backend/src/db/queries/squires.ts`:
  - `createSquire(characterId, name): Squire`
  - `getSquiresForCharacter(characterId): Squire[]`
  - `getActiveExpeditionForSquire(squireId): SquireExpedition | null`
    — returns uncollected row if any
  - `createExpedition(squireId, characterId, buildingId, actionId, durationHours, snapshot): SquireExpedition`
  - `getExpeditionById(id): SquireExpedition | null`
  - `getUnnotifiedCompletedExpeditions(characterId): (SquireExpedition & { building_name, squire_name })[]`
  - `markExpeditionNotified(id): void`
  - `markExpeditionCollected(id): void`

A3. Extend `shared/protocol/index.ts`:
  - Add `ExpeditionDispatchPayload`, `ExpeditionCollectPayload` (C→S)
  - Add `ExpeditionDispatchedPayload`, `ExpeditionDispatchRejectedPayload`,
    `ExpeditionCompletedPayload`, `ExpeditionCollectResultPayload`,
    `ExpeditionCollectRejectedPayload` (S→C)
  - Add `ExpeditionStateDto` sub-type and extend `CityBuildingArrivedPayload`
    with optional `expedition_state?: ExpeditionStateDto`
  - Add `ExpeditionActionConfig` interface
  - Update `AnyServerMessage` and `AnyClientMessage` union types

---

### Phase B — Backend Game Logic

**Goal**: Implement server-side expedition logic.

**Tasks**:

B1. Write `backend/src/game/expedition/expedition-service.ts`:
  - Export `DURATION_MULTIPLIERS: Record<1|3|6, number>` = `{ 1: 1.0, 3: 2.4, 6: 4.0 }`
  - `computeRewardSnapshot(config: ExpeditionActionConfig, durationHours: 1|3|6): ExpeditionRewardSnapshot`
    — applies multipliers, floors values, omits zero-quantity items
  - `buildExpeditionStateDto(squires: Squire[], activeExpedition: SquireExpedition | null, config: ExpeditionActionConfig, buildingName: string): ExpeditionStateDto`
    — used by the building_arrived extension

B2. Write `backend/src/game/expedition/expedition-handler.ts`:
  - `handleExpeditionDispatch(session, payload)`:
    1. Validate character, city map, not in combat, at building, valid action, valid duration
    2. Check at least one idle squire (no uncollected expedition for any of character's squires)
    3. Compute reward snapshot
    4. Insert `squire_expeditions` row
    5. Send `expedition.dispatched`
    6. Log structured event
  - `handleExpeditionCollect(session, payload)`:
    1. Validate expedition exists, owned by character, complete, uncollected
    2. Credit gold to character (`UPDATE characters SET gold = gold + $1`)
    3. Credit exp via existing `xp-service.ts`
    4. Grant items via existing `grantItemToCharacter` (track if any were skipped)
    5. Set `collected_at = now()`
    6. Send `expedition.collect_result`
    7. Log structured event

B3. Update `backend/src/index.ts`:
  - `registerHandler('expedition.dispatch', handleExpeditionDispatch)`
  - `registerHandler('expedition.collect', handleExpeditionCollect)`

B4. Update `backend/src/websocket/validator.ts`:
  - Add schemas for `expedition.dispatch` and `expedition.collect`

---

### Phase C — Character Creation & World State

**Goal**: Wire squire creation into character flow and notification delivery into connect flow.

**Tasks**:

C1. Update `character-create-handler.ts`:
  - After `insertCharacter()`, call `createSquire(character.id, pickSquireName())`
  - `pickSquireName()` — returns name from pool `['Aldric', 'Brand', 'Cade', 'Daveth', 'Edgar', 'Finn', 'Gareth', 'Hadwyn']`
  - Log `squire.created` event

C2. Update `building-action-handler.ts`:
  - In the building arrival block (where `city.building_arrived` is sent), query
    for expedition action on the building + squire status for the character
  - Populate `expedition_state` field and include in payload
  - Requires new helper that calls `getSquiresForCharacter` and
    `getActiveExpeditionForSquire`, then calls `buildExpeditionStateDto`

C3. Update `world-state-handler.ts` (`sendWorldState`):
  - After sending inventory state, query `getUnnotifiedCompletedExpeditions(characterId)`
  - For each: send `expedition.completed`, then call `markExpeditionNotified(id)`
  - Log `expedition.notify_on_connect` structured event

---

### Phase D — Admin Backend

**Goal**: Allow admins to create and edit expedition actions on buildings.

**Tasks**:

D1. Update `admin/backend/src/routes/buildings.ts`:
  - In `POST` handler: add `'expedition'` to valid action_type check
  - Add expedition config validation branch:
    - `base_gold` integer ≥ 0
    - `base_exp` integer ≥ 0
    - `items` array (empty OK); each entry: `item_def_id` (validate exists), `base_quantity` integer ≥ 1
  - In `PUT` handler: allow updating expedition configs (extend config validation)
  - Log `expedition_action_created` / `expedition_action_updated` events

---

### Phase E — Admin Frontend

**Goal**: Provide form fields for expedition configuration in the building actions panel.

**Tasks**:

E1. Update `admin/frontend/src/ui/properties.ts`:
  - Add `'expedition'` to `actionTypes` dropdown alongside `'travel'` and `'explore'`
  - Add `expeditionFields` div (hidden by default, shown when expedition selected):
    - `base_gold` number input (min 0)
    - `base_exp` number input (min 0)
    - Dynamic "Items" table: add-row button with `item_def_id` select + `base_quantity` number
      (reuse pattern from existing monsters table in explore fields)
  - Show existing expedition config values when editing a saved expedition action
  - Wire type-select change to show/hide travel / explore / expedition field groups

---

### Phase F — Game Frontend

**Goal**: Display expedition UI in the building panel and handle all expedition messages.

**Tasks**:

F1. Update `shared/protocol/index.ts` types are already available after Phase A.

F2. Update `frontend/src/ui/BuildingPanel.ts`:
  - `show(building, expeditionState?)` — accept optional expedition state
  - When `expedition_state` is present, render an "Expedition" section below actions:
    - **idle**: show duration buttons (1h / 3h / 6h) with estimated reward preview;
      clicking a duration calls `onExpeditionDispatch(building_id, action_id, duration)`
    - **exploring**: show "Squire [Name] is exploring — returns in [time]" (compute from `completes_at`)
    - **ready**: show "Squire [Name] has returned! Collect rewards" button listing rewards;
      clicking calls `onExpeditionCollect(expedition_id)`
  - `showDispatchRejection(reason)` — map reason codes to user-friendly strings
  - `showCollectResult(result)` — show success message with reward amounts; re-enable buttons

F3. Update `frontend/src/network/WSClient.ts`:
  - Register handlers for: `expedition.dispatched`, `expedition.dispatch_rejected`,
    `expedition.completed`, `expedition.collect_result`, `expedition.collect_rejected`
  - Pass callbacks to `GameScene`

F4. Update `frontend/src/scenes/GameScene.ts`:
  - Pass `onExpeditionDispatch` and `onExpeditionCollect` callbacks to `BuildingPanel`
  - Send `expedition.dispatch` and `expedition.collect` messages via `WSClient`
  - On `expedition.completed`: inject a styled system message into `ChatBox`
  - On `expedition.collect_result`: refresh building panel to idle state
  - Pass `expedition_state` from `city.building_arrived` to `BuildingPanel.show()`

---

## Validation Plan

After all phases are complete:

1. **Admin creates expedition**: configure a building with expedition action → verify
   it appears in the admin action list with correct config.
2. **Player dispatches squire**: open building menu → see duration options with reward
   previews → dispatch → verify squire status becomes `exploring` in DB.
3. **Squire returns notification**: force-expire expedition in DB → reconnect → verify
   `expedition.completed` message received and chat shows system message.
4. **Player collects rewards**: visit building → collect → verify gold/exp credited on
   character, items in inventory, squire returns to idle.
5. **Edge cases**:
   - Player tries to dispatch with squire already exploring → `NO_SQUIRE_AVAILABLE` rejection displayed.
   - Player tries to collect before expiry → `NOT_COMPLETE` rejection.
   - Player tries to collect twice → `ALREADY_COLLECTED` rejection.
   - Admin disables expedition while squire is mid-expedition → squire completes normally
     (snapshot is preserved on the expedition row).

---

## Dependencies Between Phases

```
Phase A (DB + Protocol)
    ↓
Phase B (Backend Logic) ─── depends on A (queries + protocol types)
Phase C (Char Create / World) ─── depends on A + B
Phase D (Admin Backend) ─── depends on A only
    ↓
Phase E (Admin Frontend) ─── depends on D
Phase F (Game Frontend) ─── depends on A + B + C (WS messages must be defined)
```

Phases D and E (admin) are independent of B, C, F (game) and can be developed in
parallel.
