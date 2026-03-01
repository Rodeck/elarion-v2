# Implementation Plan: Elarion — Core Game Design

**Branch**: `001-game-design` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-game-design/spec.md`

## Summary

Implement the foundational multiplayer RPG loop for Elarion: account registration
and login, character creation, tile-based world navigation with real-time player
visibility, fully automatic server-simulated combat, character XP and level
progression, and in-zone/global chat. All game state is server-authoritative;
client-server communication uses WebSocket only.

**Stack**: Node.js 20 + TypeScript (backend) | Phaser 3 + TypeScript (frontend) |
PostgreSQL 16 (persistence) | `ws` (WebSocket library) | Tiled TMX (maps) |
JSON over WebSocket (protocol, v1)

## Technical Context

**Language/Version**: TypeScript 5.x — used on both frontend and backend.
Shared type definitions live in `shared/protocol/`.

**Primary Dependencies**:
- Backend: Node.js 20 LTS, `ws` 8.x, `pg` (PostgreSQL client), `jose` (JWT),
  `bcrypt`, `fast-xml-parser` (TMX parsing)
- Frontend: Phaser 3.x, Vite (build)

**Storage**: PostgreSQL 16. Schema: accounts, characters, character_classes,
map_zones, monsters, combat_simulations, combat_participants, items,
character_items, chat_messages.

**Testing**: Jest (unit tests for combat simulation, stat formulas, rate limiting)
+ Playwright (E2E validation per quickstart.md checklist).

**Target Platform**: Browser (frontend, any modern browser); Linux server (backend).

**Project Type**: Web game — fullstack (frontend + backend independently deployed).

**Performance Goals**:
- Movement update propagation: ≤ 300ms p95 for 200 concurrent players.
- Chat delivery: ≤ 500ms p95.
- Combat round stream: ≤ 100ms between rounds (server-paced).
- Auth (JWT verify): ≤ 5ms (CPU-only, no DB query).

**Constraints**:
- Browser-native only; no plugins, no native runtime.
- REST endpoints prohibited for any game state mutation (Constitution Principle I).
- All player input is untrusted until server validates (Principle II).
- Structured JSON logs on all game-loop code paths (Principle IV).

**Scale/Scope**: MVP — 200 concurrent players, 3 character classes, 1 starting
map zone (Starter Plains), monsters up to level 5.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|---------|
| **1. No REST for game state** | ✅ PASS | All game actions use WebSocket (see `contracts/websocket-protocol.md`). REST is used only for the HTTP upgrade handshake. |
| **2. Server-side validation present** | ✅ PASS | FR-005 (movement), FR-008 (combat), FR-014 (rate limiting) all mandate server-side validation. Combat simulation runs entirely on server (FR-016). |
| **3. Structured logging required** | ✅ PASS | quickstart.md §5 verifies JSON log output. All subsystems (auth, world, combat, progression, chat) emit structured logs. |
| **4. Contract documented** | ✅ PASS | `contracts/websocket-protocol.md` defines all 20 message types with JSON schemas, error codes, and versioning policy. |
| **5. Graceful rejection handling** | ✅ PASS | `player.move_rejected` carries authoritative position for client rollback. `server.error` covers all invalid-action cases. `server.rate_limited` provides retry guidance. |
| **6. Complexity justified** | ✅ PASS (see table below) | One complexity item: `shared/protocol/` directory. Justified in Complexity Tracking. |

**Post-Phase-1 re-check**: All gates still pass. The WebSocket contract is now fully
documented; the data model adds no REST dependencies; logging requirements are
reflected in the quickstart validation checklist.

## Project Structure

### Documentation (this feature)

```text
specs/001-game-design/
├── plan.md              # This file
├── research.md          # Phase 0 — tech stack decisions
├── data-model.md        # Phase 1 — entity definitions and DB schema
├── quickstart.md        # Phase 1 — local dev validation guide
├── contracts/
│   └── websocket-protocol.md   # Phase 1 — full message type definitions
└── checklists/
    └── requirements.md  # Spec quality checklist (all passing)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/            # Registration, login, JWT issuance + verification
│   ├── game/
│   │   ├── world/       # Zone loading (TMX), player placement, movement validation
│   │   ├── combat/      # Turn-based simulation engine, loot + XP distribution
│   │   ├── progression/ # Level-up checks, stat recalculation
│   │   └── chat/        # Message routing (local zone broadcast, global broadcast)
│   ├── websocket/       # WS server bootstrap, connection lifecycle, message dispatch
│   ├── db/              # PostgreSQL connection pool, migrations, query functions
│   └── models/          # TypeScript interfaces mirroring DB entities
├── tests/
│   ├── unit/            # Combat formula, rate limiter, stat progression
│   └── integration/     # DB-backed auth and character persistence tests
└── package.json

frontend/
├── src/
│   ├── scenes/          # Phaser scenes: Boot, Login, CharacterCreate, Game
│   ├── entities/        # Phaser GameObjects: PlayerSprite, MonsterSprite, MapTile
│   ├── ui/              # HUD elements: StatsBar, ChatBox, CombatLog
│   └── network/         # WebSocket client, message send/receive, reconnect logic
├── tests/               # Playwright E2E tests (quickstart.md validation)
└── package.json

shared/
└── protocol/            # Shared TypeScript interfaces for all WS message payloads
    └── index.ts         # Re-exports all message types
```

**Structure Decision**: Web application structure (separate `backend/` and
`frontend/` trees) with an additional `shared/` directory for protocol types.
Both `backend/` and `frontend/` are independently buildable and deployable as
required by Constitution Principle V. The `shared/` directory is justified in the
Complexity Tracking table below.

## Complexity Tracking

> Filled because `shared/` adds a non-standard third directory to a two-project layout.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `shared/protocol/` directory (third root-level project) | Both backend and frontend need the same TypeScript types for every WebSocket message. Without a shared source, types must be duplicated in two places, creating two sources of truth for the protocol — directly violating Constitution Principle V (contract documented, single versioned source). | Duplicating types in `backend/src/models/protocol.ts` and `frontend/src/network/protocol.ts` was rejected: any protocol change would require two edits, one of which is easily forgotten, causing hard-to-debug type drift. This is a known, immediate problem — not a speculative one. |
