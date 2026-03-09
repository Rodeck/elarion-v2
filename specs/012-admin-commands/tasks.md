# Tasks: Admin Commands System

**Input**: Design documents from `/specs/012-admin-commands/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not explicitly requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure is needed — all changes touch existing files. One new directory/file is created.

- [x] T001 Create `backend/src/game/admin/` directory and empty `admin-command-handler.ts` file (placeholder only — implementations added in story phases)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type changes, JWT propagation, WebSocket session update, protocol type, shared query helpers, chat interception, and frontend handler. All user story commands depend on every task in this phase.

**⚠️ CRITICAL**: No user story command can be tested until this entire phase is complete.

- [x] T002 Add `is_admin: boolean` to `Account` interface and include `is_admin` in the SELECT query in `backend/src/db/queries/accounts.ts`
- [x] T003 [P] Add `isAdmin: boolean` to `JwtClaims` interface in `backend/src/auth/jwt.ts`
- [x] T004 Update `handleAuthLogin` in `backend/src/auth/login-handler.ts` to read `account.is_admin` and pass `isAdmin` to `signToken()`
- [x] T005 Add `isAdmin: boolean` (default `false`) to `AuthenticatedSession` in `backend/src/websocket/server.ts`; populate it from the decoded JWT claims when a session authenticates
- [x] T006 [P] Add `AdminCommandResultPayload` interface and register message type `admin.command_result` (S→C) in `shared/protocol/index.ts`
- [x] T007 [P] Add `getCharacterByName(name: string): Promise<Character | null>` query to `backend/src/db/queries/characters.ts` — SELECT by unique `name` column
- [x] T008 Fill `backend/src/game/admin/admin-command-handler.ts`: export `handleAdminCommand(session, rawMessage)` with a `switch` on the command token that routes to `handleLevelUp`, `handleGiveItem`, `handleClearInventory` (stubs that immediately reply `"not yet implemented"`) and an `Unknown command` default case
- [x] T009 In `backend/src/game/chat/chat-handler.ts`, add `/`-prefix interception before the broadcast path: if `message.startsWith('/')` and `session.isAdmin === false` → send `admin.command_result { success: false, message: 'You do not have permission…' }` and return; if `session.isAdmin === true` → call `handleAdminCommand(session, message)` and return (no broadcast)
- [x] T010 In `frontend/src/ui/ChatBox.ts`, register a handler for `admin.command_result`: append the result to the chat display with a distinct colour (green for success, red for failure) and a `[Admin]` prefix; do not add it to chat history

**Checkpoint**: Foundation complete. Any admin account can now type `/level_up x` and receive a "not yet implemented" reply; non-admins receive a permission error. Frontend displays both correctly.

---

## Phase 3: User Story 1 — Level Up a Player (Priority: P1) 🎯 MVP

**Goal**: Admin can type `/level_up <player>` or `/level_up <player> <count>` to increase a named player's level.

**Independent Test**: Log in as admin → type `/level_up Roddeck` → Roddeck's level increases by 1 and admin sees confirmation. Type `/level_up Roddeck 5` → level increases by 5. Non-admin attempt returns permission error.

- [x] T011 [US1] Implement `handleLevelUp(session, args, reply)` in `backend/src/game/admin/admin-command-handler.ts`:
  - Parse `args[0]` as player name; if missing, reply with `"Usage: /level_up <player> [count]"` and return
  - Parse `args[1]` as count (default 1); if present and not a positive integer, reply with `"Count must be a positive number."` and return
  - Call `getCharacterByName(playerName)`; if null, reply with `"Player '<name>' not found."` and return
  - Call `levelUp(characterId)` from `backend/src/game/progression/level-up-service.ts` once per count (loop)
  - Reply with `"Levelled up <name> by <count>. New level: <newLevel>."`
  - Emit structured log entry `{ event: 'admin_command', command: 'level_up', … }`

**Checkpoint**: User Story 1 fully functional. `/level_up` works end-to-end for any registered player.

---

## Phase 4: User Story 2 — Give Items to a Player (Priority: P2)

**Goal**: Admin can type `/item <player> <item_id> <quantity>` to add items to a named player's inventory.

**Independent Test**: Log in as admin → type `/item Roddeck 1 3` → Roddeck's inventory contains 3× item ID 1 and admin sees confirmation. Invalid item ID returns error. Non-admin attempt returns permission error.

- [x] T012 [US2] Implement `handleGiveItem(session, args, reply)` in `backend/src/game/admin/admin-command-handler.ts`:
  - Parse `args[0]` as player name; if missing, reply with `"Usage: /item <player> <item_id> <quantity>"` and return
  - Parse `args[1]` as item_id (positive integer); if invalid, reply with `"item_id must be a positive number."` and return
  - Parse `args[2]` as quantity (positive integer); if invalid, reply with `"Quantity must be a positive number."` and return
  - Call `getCharacterByName(playerName)`; if null, reply with `"Player '<name>' not found."` and return
  - Call existing `getItemDefinitionById(itemId)` from `backend/src/db/queries/inventory.ts`; if null, reply with `"Item with ID <id> does not exist."` and return
  - Call existing `insertInventoryItem(characterId, itemId, quantity)` (handles stacking via `findStackableSlot`)
  - If the target player is online, push `inventory.item_received` to their session using existing `sendToSession`
  - Reply with `"Gave <quantity>x <itemName> to <playerName>."`
  - Emit structured log entry `{ event: 'admin_command', command: 'item', … }`

**Checkpoint**: User Story 2 fully functional. `/item` works end-to-end; target receives inventory update if online.

---

## Phase 5: User Story 3 — Clear a Player's Inventory (Priority: P3)

**Goal**: Admin can type `/clear_inventory <player>` to remove all items from a named player's inventory.

**Independent Test**: Log in as admin → type `/clear_inventory Roddeck` → Roddeck's inventory is empty and admin sees confirmation. If already empty, still returns success confirmation. Non-admin attempt returns permission error.

- [x] T013 [US3] Add `clearAllInventory(characterId: string): Promise<number>` to `backend/src/db/queries/inventory.ts` — executes `DELETE FROM inventory_items WHERE character_id = $1` and returns the number of deleted rows
- [x] T014 [US3] Implement `handleClearInventory(session, args, reply)` in `backend/src/game/admin/admin-command-handler.ts`:
  - Parse `args[0]` as player name; if missing, reply with `"Usage: /clear_inventory <player>"` and return
  - Call `getCharacterByName(playerName)`; if null, reply with `"Player '<name>' not found."` and return
  - Call `clearAllInventory(characterId)` and capture deleted row count
  - If the target player is online, push `inventory.state` (empty inventory) to their session using existing `sendToSession`
  - Reply with `"Cleared inventory of <playerName> (<count> items removed)."`
  - Emit structured log entry `{ event: 'admin_command', command: 'clear_inventory', … }`

**Checkpoint**: All three user stories functional. Full admin command system operational.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Logging verification, edge case hardening, and end-to-end validation.

- [x] T015 [P] Review `backend/src/game/admin/admin-command-handler.ts` — confirm every code path (success and failure for all three commands) emits a structured log entry conforming to the schema in `contracts/admin_commands.md`; add any missing log calls
- [ ] T016 [P] Run through all 8 manual test scenarios in `specs/012-admin-commands/quickstart.md` and confirm each produces the expected outcome (including non-admin rejection and offline-player persistence)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 — can run in parallel with Phase 3 (different files)
- **Phase 5 (US3)**: Depends on Phase 2 — can run in parallel with Phase 3 and 4
- **Phase 6 (Polish)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete; no dependency on US2 or US3
- **US2 (P2)**: Requires Phase 2 complete; no dependency on US1 or US3 (shares `getCharacterByName` from foundational T007)
- **US3 (P3)**: Requires Phase 2 complete + T013 (new query); no dependency on US1 or US2

### Within Each Phase

- T002–T010 within Phase 2: T003, T006, T007 are parallelizable (different files); T004 depends on T003; T005 depends on T003; T008 depends on T007; T009 depends on T006; T010 depends on T006

### Parallel Opportunities

- **Phase 2**: T003, T006, T007 can start simultaneously; T002 is independent of all three
- **Phase 3, 4, 5**: All three story phases can proceed in parallel once Phase 2 is done (different function implementations within the same file — coordinate if single developer to avoid conflicts in `admin-command-handler.ts`)
- **Phase 6**: T015 and T016 can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```text
Start simultaneously:
  Task T002 — accounts.ts: add is_admin to interface + SELECT
  Task T003 — jwt.ts: add isAdmin to JwtClaims
  Task T006 — characters.ts: add getCharacterByName()
  Task T007 — admin-command-handler.ts: skeleton + routing

Then (after T003 completes):
  Task T004 — login-handler.ts: pass isAdmin in signToken()
  Task T005 — server.ts: add isAdmin to session, populate from JWT

Then (after T006 and T007 complete):
  Task T008 — chat-handler.ts: add slash-prefix interception
  Task T009 — [after T006] shared/protocol/index.ts: AdminCommandResultPayload (T006 is a pre-req for T009)

Finally:
  Task T010 — ChatBox.ts: handle admin.command_result
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001)
2. Complete Phase 2 (T002–T010)
3. Complete Phase 3 / US1 (T011)
4. **STOP and VALIDATE**: Admin can `/level_up` any player
5. Demo / confirm before continuing

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready (permission system + routing active)
2. Phase 3 (US1) → `/level_up` works → demo
3. Phase 4 (US2) → `/item` works → demo
4. Phase 5 (US3) → `/clear_inventory` works → demo
5. Phase 6 → Logging verified + manual checklist passed

---

## Notes

- [P] tasks = different files, no shared state conflicts
- `admin-command-handler.ts` is written incrementally: skeleton in T008, then each command handler in T011/T012/T014 — coordinate if pair-programming
- `getCharacterByName` (T007) is shared by all three commands — foundational, not story-specific
- `getItemDefinitionById` already exists in `inventory.ts` — US2 does not need a new query for it
- No DB migration required — `accounts.is_admin` already exists from migration 008
