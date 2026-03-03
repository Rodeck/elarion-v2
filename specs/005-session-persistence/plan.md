# Implementation Plan: Session Persistence & Logout

**Branch**: `005-session-persistence` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-session-persistence/spec.md`

## Summary

Enable authenticated players to resume the game on page refresh without re-entering credentials, by persisting the JWT in `localStorage` with a 30-day expiry, validating it at boot time via the existing WebSocket upgrade, and routing automatically to the correct scene. Add a logout button to the top-right of the game interface that clears the stored session and returns the player to the login screen.

## Technical Context

**Language/Version**: TypeScript 5.x — frontend (Phaser 3, Vite) and backend (Node.js 20 LTS)
**Primary Dependencies**: `jose` (JWT, backend), Phaser 3.60.0, `ws` library (WebSocket server)
**Storage**: `localStorage` (browser, client-side session token only); PostgreSQL 16 for all game data
**Testing**: `npm test && npm run lint` (existing project test command)
**Target Platform**: Browser (frontend); Node.js 20 LTS (backend)
**Project Type**: Web application — browser game client + WebSocket game server
**Performance Goals**: Session restore must complete and reach game view within 3 seconds of page load
**Constraints**: No new HTTP REST endpoints for session validation — validation happens implicitly via WS upgrade rejection (401). Token expiry extended from 10 min to 30 days.
**Scale/Scope**: Single-player per browser session; 2 frontend scenes modified, 1 new component, 3 backend files modified

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status | Notes |
|------|-------------|--------|-------|
| 1 — No REST for game state | Session restore uses WS, not REST | ✅ PASS | Token validated on WS upgrade (existing mechanism). No new REST endpoints. |
| 2 — Server-side validation | JWT verified server-side on every WS connection | ✅ PASS | `verifyToken()` runs in `upgrade` handler; invalid tokens rejected with HTTP 401 before WS is established. |
| 3 — Structured logging | Auth events logged | ✅ PASS | Session restore and logout events added to existing structured logger. |
| 4 — Contract documented | New `auth.session_info` message between client and server | ✅ PASS | Documented in `contracts/auth.md`. Required for signalling "authenticated but no character" on auto-login. |
| 5 — Graceful rejection handling | Invalid stored token clears storage and shows login | ✅ PASS | Frontend WS connect failure (401) clears `localStorage` and routes to `LoginScene`. |
| 6 — Complexity justified | No violations of Principle III | ✅ PASS | No speculative abstractions. `SessionStore` is a three-method thin wrapper, justified by the need to decouple storage key management. |

## Project Structure

### Documentation (this feature)

```text
specs/005-session-persistence/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth.md
└── tasks.md             # Phase 2 output (not yet created)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── auth/
│   │   └── SessionStore.ts        # NEW — localStorage wrapper for JWT
│   ├── scenes/
│   │   ├── BootScene.ts           # MODIFIED — auto-login check on startup
│   │   ├── LoginScene.ts          # MODIFIED — use SessionStore.save(), remove sessionStorage call
│   │   └── GameScene.ts           # MODIFIED — create LogoutButton, handle logout action
│   └── ui/
│       ├── StatsBar.ts            # MODIFIED — accept onLogout callback, expose destroy()
│       └── LogoutButton.ts        # NEW — logout button component (icon + tooltip)

backend/
└── src/
    ├── auth/
    │   └── jwt.ts                 # MODIFIED — extend EXPIRY from '10m' to JWT_EXPIRY env (default '30d')
    ├── websocket/
    │   ├── server.ts              # MODIFIED — trigger worldStateHandler on accountId (not characterId)
    │   └── handlers/
    │       └── world-state-handler.ts  # MODIFIED — send auth.session_info when no character found

shared/
└── protocol/
    └── index.ts                   # MODIFIED — add AuthSessionInfoPayload, AuthSessionInfoMessage
```

**Structure Decision**: Web application layout (frontend/backend/shared). No new directories at root level — new `frontend/src/auth/` follows existing separation of concerns pattern (entities/, ui/, scenes/, network/ already exist).

## Complexity Tracking

> No constitution violations. No entries required.

---

## Phase 0: Research

See [research.md](./research.md) — all decisions resolved, no NEEDS CLARIFICATION markers.

## Phase 1: Design

See [data-model.md](./data-model.md) and [contracts/auth.md](./contracts/auth.md).

---

## Implementation Sequence

The tasks are ordered to respect dependencies:

1. **Protocol** — Add `AuthSessionInfoPayload` to shared protocol (no deps)
2. **Backend: jwt.ts** — Extend JWT expiry (no deps)
3. **Backend: world-state-handler.ts** — Send `auth.session_info` when no character (depends on protocol change)
4. **Backend: server.ts** — Trigger worldState on `accountId` not `characterId` (depends on #3)
5. **Frontend: SessionStore.ts** — New localStorage wrapper (no deps)
6. **Frontend: LoginScene.ts** — Use SessionStore (depends on #5)
7. **Frontend: LogoutButton.ts** — New logout button component (no deps)
8. **Frontend: GameScene.ts** — Create LogoutButton, wire logout action (depends on #7, #5)
9. **Frontend: BootScene.ts** — Auto-login check using stored token (depends on #5, #6, protocol changes)
