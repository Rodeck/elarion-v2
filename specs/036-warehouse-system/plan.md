# Implementation Plan: Warehouse System

**Branch**: `036-warehouse-system` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/036-warehouse-system/spec.md`

## Summary

Add a per-building, per-player warehouse system allowing item storage, drag-and-drop transfers, bulk operations, and expandable slot capacity purchased with crowns. Extends the existing building action type system with a new `'warehouse'` type, adds two PostgreSQL tables (`warehouse_slots`, `warehouse_items`), and introduces a `WarehouseModal` frontend component following the established MarketplaceModal pattern.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)  
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (frontends)  
**Storage**: PostgreSQL 16 — two new tables (`warehouse_slots`, `warehouse_items`); `building_actions` CHECK constraint extended  
**Testing**: Manual testing via game client and admin panel  
**Target Platform**: Browser (game client), Node.js (backend)  
**Project Type**: Web game (multiplayer browser RPG)  
**Performance Goals**: Item transfers < 2s, bulk operations < 3s  
**Constraints**: Server-authoritative design, WebSocket-only for game state  
**Scale/Scope**: Per-player per-building storage, ~15-30 slots per warehouse

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All warehouse operations use WebSocket messages (`warehouse.deposit`, `warehouse.withdraw`, etc.) |
| 2. Server-side validation present | PASS | All transfers validated server-side: ownership, slot availability, equipped status, crown balance |
| 3. Structured logging required | PASS | Handler will log all deposit/withdraw/bulk/purchase operations with character_id, building_id, item details |
| 4. Contract documented | PASS | `contracts/websocket-messages.md` defines all message types with payload interfaces |
| 5. Graceful rejection handling | PASS | `warehouse.rejected` message with typed reasons; frontend displays user-friendly messages |
| 6. Complexity justified | PASS | No complexity violations — follows existing patterns (MarketplaceModal, building action dispatch) |
| 7. Tooling updated | PASS | Plan includes: CLAUDE.md checklist, game-data.js warehouse command, game-entities.js updates, admin panel support |

## Project Structure

### Documentation (this feature)

```text
specs/036-warehouse-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── websocket-messages.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 041_warehouse_system.sql        # NEW: schema
│   │   └── queries/
│   │       └── warehouse.ts                     # NEW: SQL queries
│   └── game/
│       ├── warehouse/
│       │   └── warehouse-handler.ts             # NEW: WS message handlers
│       └── world/
│           ├── building-action-handler.ts       # MODIFIED: add warehouse branch
│           └── city-map-loader.ts               # MODIFIED: add warehouse DTO mapping

frontend/
├── src/
│   ├── ui/
│   │   └── WarehouseModal.ts                    # NEW: warehouse UI
│   └── scenes/
│       └── GameScene.ts                         # MODIFIED: wire warehouse modal

shared/
└── protocol/
    └── index.ts                                 # MODIFIED: warehouse message types

admin/
├── backend/
│   └── src/
│       └── routes/
│           └── buildings.ts                     # MODIFIED: warehouse action validation
└── frontend/
    └── src/
        ├── editor/
        │   └── api.ts                           # MODIFIED: warehouse action type
        └── ui/
            └── properties.ts                    # MODIFIED: warehouse in dropdown

scripts/
├── game-data.js                                 # MODIFIED: warehouse query command
└── game-entities.js                             # MODIFIED: VALID_ACTION_TYPES

.claude/commands/
├── game-data.md                                 # MODIFIED: document warehouse command
└── game-entities.md                             # MODIFIED: document warehouse action type

CLAUDE.md                                        # MODIFIED: no new checklist needed (uses existing "Adding a New Building Action Type")
```

**Structure Decision**: Follows the established monorepo layout. New warehouse handler goes in `backend/src/game/warehouse/` (same pattern as `boss/`, `quest/`, `training/`). Frontend modal follows `MarketplaceModal.ts` pattern.

## Complexity Tracking

No violations. All design decisions follow existing patterns:
- Building action type extension: documented checklist in CLAUDE.md
- Modal pattern: mirrors MarketplaceModal
- DB schema: mirrors inventory_items structure
- WS protocol: follows marketplace message naming convention
