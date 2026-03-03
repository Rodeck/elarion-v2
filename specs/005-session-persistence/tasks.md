# Tasks: Session Persistence & Logout

**Input**: Design documents from `/specs/005-session-persistence/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Protocol types, backend config, storage utility, and server-side session routing logic that MUST be complete before either user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add `AuthSessionInfoPayload` and `AuthSessionInfoMessage` to `shared/protocol/index.ts` — add interface `{ has_character: boolean }`, message alias `WsMessage<AuthSessionInfoPayload>`, and include in `AnyServerMessage` union
- [x] T002 [P] Add `jwtExpiry` to `backend/src/config.ts` — read `JWT_EXPIRY` env var with default `'30d'`: `jwtExpiry: process.env['JWT_EXPIRY'] ?? '30d'`
- [x] T003 [P] Create `frontend/src/auth/SessionStore.ts` — export object with three methods: `save(token: string): void` writes to `localStorage.setItem('elarion_token', token)`; `load(): string | null` returns `localStorage.getItem('elarion_token') || null`; `clear(): void` calls `localStorage.removeItem('elarion_token')`
- [x] T004 Update `backend/src/auth/jwt.ts` — replace hardcoded `const EXPIRY = '10m'` with `import { config } from '../config'` and use `config.jwtExpiry` in `setExpirationTime()` call (depends on T002)
- [x] T005 Update `backend/src/websocket/handlers/world-state-handler.ts` — in `sendWorldState()`, after `const character = await findByAccountId(session.accountId)`, when character is `null` replace the early `return` with: log a `warn` entry, then `sendToSession(session, 'auth.session_info', { has_character: false })` and return (depends on T001)
- [x] T006 Update `backend/src/websocket/server.ts` — change the `worldStateHandler` auto-call condition from `if (session.characterId && worldStateHandler)` to `if (session.accountId && worldStateHandler)` so that connections authenticated by accountId-only tokens (no characterId in JWT) also trigger world state lookup (depends on T005)

**Checkpoint**: Foundation ready — backend sends correct session signals, JWT expiry is long-lived, SessionStore available in frontend. User story implementation can now begin.

---

## Phase 3: User Story 1 — Automatic Session Restore on Page Reload (Priority: P1) 🎯 MVP

**Goal**: Player who previously logged in navigates to the game URL (or refreshes) and is taken directly to the game without seeing the login screen.

**Independent Test**: Log in → close browser → reopen → navigate to game URL → game loads directly without entering credentials.

### Implementation for User Story 1

- [x] T007 [US1] Update `frontend/src/scenes/LoginScene.ts` — import `SessionStore` from `'../auth/SessionStore'`; in the `client.on<AuthSuccessPayload>('auth.success', ...)` handler, replace `sessionStorage.setItem('elarion_token', payload.token)` with `SessionStore.save(payload.token)` (depends on T003)
- [x] T008 [US1] Update `frontend/src/scenes/BootScene.ts` — replace `this.scene.start('LoginScene')` in `create()` with an auto-login check: (1) call `SessionStore.load()`; (2) if null/empty, start `'LoginScene'` immediately; (3) if token exists, read `VITE_WS_HOST`, create a `WSClient` with `ws://${wsHost}/game?token=${token}`, call `client.connect()` and handle three outcomes: on `'world.state'` → `client.disconnect()` then `scene.start('GameScene', { token })`; on `'auth.session_info'` with `has_character: false` → `client.disconnect()` then `scene.start('CharacterCreateScene', { token })`; on WS `'disconnected'` event (connect failure / 401 rejection) → `SessionStore.clear()` then `scene.start('LoginScene')`; also add a 5-second `setTimeout` fallback that clears the token and starts `'LoginScene'` if neither message arrives (depends on T003, T006, T007)

**Checkpoint**: User Story 1 fully functional — session persists across page reload, browser restart, and tab close. Invalid/expired tokens correctly redirect to login.

---

## Phase 4: User Story 2 — Explicit Logout (Priority: P2)

**Goal**: A visible logout button in the top-right corner of the game interface allows the player to end their session at any time, clearing stored credentials and returning to the login screen.

**Independent Test**: While in game, click the logout button → login screen appears → refresh page → login screen remains (no auto-login).

### Implementation for User Story 2

- [x] T009 [P] [US2] Create `frontend/src/ui/LogoutButton.ts` — export class `LogoutButton` with constructor `(mountEl: HTMLElement, onLogout: () => void)`; create an HTML `<button>` element positioned `absolute`, `top: 12px`, `right: 20px`, containing an 18×18 SVG logout icon (rectangle with outward arrow using `stroke="currentColor"` path); set `title="Log out"` for browser tooltip; apply styling consistent with the gold theme (`color: var(--color-gold-primary)`, transparent background, gold border on hover, `cursor: pointer`); wire `button.addEventListener('click', onLogout)`; append to `mountEl`; export a `destroy(): void` method that calls `button.remove()`
- [x] T010 [US2] Update `frontend/src/scenes/GameScene.ts` — (1) import `LogoutButton` from `'../ui/LogoutButton'` and `SessionStore` from `'../auth/SessionStore'`; (2) add private field `private logoutButton!: LogoutButton`; (3) in `buildStatsBar()`, after `mountEl.appendChild(this.statsBar.container)` (or after the StatsBar constructor), add `this.logoutButton = new LogoutButton(topBar, () => this.handleLogout())`; (4) add private method `handleLogout(): void` that calls `SessionStore.clear()`, `this.client.disconnect()`, `this.statsBar.destroy()`, `this.logoutButton.destroy()`, then `this.scene.start('LoginScene')` (depends on T003, T009)

**Checkpoint**: User Story 2 fully functional — logout button visible in game, clears session, returns to login, page refresh stays on login screen.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation, logging confirmation, and final review.

- [x] T011 Run `npm test && npm run lint` from repo root to verify no TypeScript errors or lint regressions introduced by the changes
- [x] T012 [P] Verify `JWT_EXPIRY` env variable is documented — check if a `.env.example` or equivalent file exists in the repo root; if it does, add `JWT_EXPIRY=30d` with a comment `# JWT session lifetime (jose duration format, e.g. 10m, 7d, 30d)`
- [ ] T013 [P] Manual smoke test per `specs/005-session-persistence/quickstart.md` — log in, refresh, confirm no re-login prompt; log out, refresh, confirm login screen; verify logout button has tooltip on hover

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. T002 and T003 are parallel (different stacks). T004 depends on T002. T005 depends on T001. T006 depends on T005.
- **User Story 1 (Phase 3)**: Depends on T003 (SessionStore), T006 (server.ts fix), T007 (LoginScene save). T007 depends on T003. T008 depends on T003, T006, T007.
- **User Story 2 (Phase 4)**: T009 is independent (no deps). T010 depends on T003 and T009.
- **Polish (Phase 5)**: Depends on all phases complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational phase. No dependency on US2.
- **User Story 2 (P2)**: Depends on T003 (SessionStore) from Foundational. No dependency on US1. Can technically be implemented in parallel with US1 after T003 is done.

### Within Each User Story

- T007 before T008 (LoginScene must save token before BootScene restores it)
- T009 before T010 (LogoutButton component before wiring in GameScene)

### Parallel Opportunities

- T002 (config.ts) and T003 (SessionStore.ts) are fully independent — run together
- T001 (protocol) is independent of T002/T003 — run all three in parallel
- T009 (LogoutButton.ts) is independent of all Phase 3 work — can start after T003

---

## Parallel Example: Foundational Phase

```
Batch 1 (all parallel):
  Task T001: Add AuthSessionInfoPayload to shared/protocol/index.ts
  Task T002: Add jwtExpiry to backend/src/config.ts
  Task T003: Create frontend/src/auth/SessionStore.ts

Batch 2 (after Batch 1):
  Task T004: Update backend/src/auth/jwt.ts (depends on T002)
  Task T005: Update world-state-handler.ts (depends on T001)

Batch 3 (after T005):
  Task T006: Update backend/src/websocket/server.ts (depends on T005)
```

## Parallel Example: User Story 2

```
After T003 is complete:
  Task T009: Create LogoutButton.ts (parallel, no deps beyond T003)

After T009:
  Task T010: Wire LogoutButton in GameScene.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T006)
2. Complete Phase 3: User Story 1 (T007–T008)
3. **STOP and VALIDATE**: Log in, refresh, confirm auto-resume. Test expired token clears and shows login.
4. User Story 1 delivers the core persistence feature as a standalone increment.

### Incremental Delivery

1. Complete Foundational → backend + SessionStore ready
2. Complete User Story 1 (T007–T008) → session restore works end-to-end
3. Complete User Story 2 (T009–T010) → logout button completes the session lifecycle
4. Complete Polish (T011–T013) → validated and clean

---

## Notes

- [P] tasks = different files, no blocking dependencies between them
- [Story] label maps each task to its user story for traceability
- T008 (BootScene) is the most complex task — read the data-model.md state transition diagram before implementing
- The WSClient in BootScene is a temporary connection used only for session validation; it must be disconnected before starting the game scene (which creates its own client)
- T006 also fixes a pre-existing bug: tokens issued without characterId (post-character-creation reconnects) now correctly trigger world state lookup
- Commit after T006 (foundational complete), after T008 (US1 complete), after T010 (US2 complete)
