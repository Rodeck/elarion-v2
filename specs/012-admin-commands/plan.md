# Implementation Plan: Admin Commands System

**Branch**: `012-admin-commands` | **Date**: 2026-03-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-admin-commands/spec.md`

## Summary

Admin players can type privileged slash commands (`/level_up`, `/item`, `/clear_inventory`)
into the existing in-game chat box. The backend intercepts these commands before broadcast,
validates admin status from the JWT session, executes the mutation (level-up, item grant,
inventory clear), and replies with a private `admin.command_result` message visible only to
the admin. No REST endpoints are used; no new client-to-server message type is needed.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — no new tables; `accounts.is_admin` column already present
**Testing**: Manual in-game testing (existing project pattern)
**Target Platform**: Linux server (backend), modern browser (frontend)
**Project Type**: Multiplayer browser game (WebSocket client-server)
**Performance Goals**: Admin commands are low-frequency; no specific throughput target
**Constraints**: All game state mutations must use WebSocket (Constitution §I); server-authoritative validation (Constitution §II)
**Scale/Scope**: Single shared game world; admin commands target individual named players

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | ✅ PASS | Admin commands flow through existing `chat.send` WebSocket message; no HTTP endpoints introduced |
| 2. Server-side validation present | ✅ PASS | Admin flag validated from JWT session; player existence and argument validity validated server-side in `admin-command-handler.ts` |
| 3. Structured logging required | ✅ PASS | All admin command executions and rejections emit structured JSON log events (defined in contracts) |
| 4. Contract documented | ✅ PASS | New `admin.command_result` message type documented in `contracts/admin_commands.md` |
| 5. Graceful rejection handling | ✅ PASS | Frontend handles `admin.command_result` with `success: false` and displays error to admin; no crashes |
| 6. Complexity justified | ✅ PASS | No complexity violations — design is intentionally minimal (YAGNI) |

**Post-design re-check**: All gates still pass. No complexity tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/012-admin-commands/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── admin_commands.md   # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/src/
├── auth/
│   ├── jwt.ts                         # MODIFY: add isAdmin to JwtClaims
│   └── login-handler.ts               # MODIFY: pass isAdmin to signToken
├── db/queries/
│   ├── accounts.ts                    # MODIFY: add is_admin to Account interface
│   ├── characters.ts                  # MODIFY: add getCharacterByName()
│   └── inventory.ts                   # MODIFY: add clearAllInventory()
├── websocket/
│   └── server.ts                      # MODIFY: add isAdmin to AuthenticatedSession
└── game/
    ├── admin/
    │   └── admin-command-handler.ts   # NEW: parse and execute admin commands
    └── chat/
        └── chat-handler.ts            # MODIFY: intercept /- prefixed messages

shared/protocol/
└── index.ts                           # MODIFY: add AdminCommandResultPayload

frontend/src/ui/
└── ChatBox.ts                         # MODIFY: handle admin.command_result message
```

**Structure Decision**: Web application layout (Option 2 from template). All changes touch
existing directories. One new file added: `backend/src/game/admin/admin-command-handler.ts`.
