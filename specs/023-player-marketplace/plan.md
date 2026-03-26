# Implementation Plan: Player Marketplace

**Branch**: `023-player-marketplace` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/023-player-marketplace/spec.md`

## Summary

Add a building-scoped player-to-player marketplace where players can browse, buy, and list items for sale. Each marketplace building maintains its own listing pool and earnings accumulation. Implementation follows existing building action patterns (action_type extension, WebSocket messages, modal UI) with new database tables for listings and earnings, server-side transaction-based concurrency control for purchases, and a CraftingModal-style frontend modal with drag-and-drop listing support.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
**Storage**: PostgreSQL 16 — migration `025_marketplace.sql` (2 new tables, 1 CHECK constraint extension)
**Testing**: Manual testing + structured logging verification
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web-based multiplayer game (real-time WebSocket)
**Performance Goals**: Paginated browse under 1s; 1,000+ listings per marketplace without degradation
**Constraints**: All marketplace operations via WebSocket (no REST for game state); server-authoritative
**Scale/Scope**: Per-building listing pools; 10 listing limit per player (default)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All marketplace operations use WebSocket messages under `marketplace.*` namespace. See [contracts](contracts/marketplace-protocol.md). |
| 2. Server-side validation present | PASS | All operations validated server-side: crown balance, inventory capacity, listing ownership, listing status, price minimums, listing limits. Client is projection only. |
| 3. Structured logging required | PASS | Marketplace handler will emit structured logs for: listing created, item purchased, listing cancelled, crowns collected, items collected, all rejections with reason. |
| 4. Contract documented | PASS | All message types documented in [contracts/marketplace-protocol.md](contracts/marketplace-protocol.md). |
| 5. Graceful rejection handling | PASS | Every server response includes `success` boolean and `reason` string on failure. Frontend displays appropriate feedback and does not freeze/panic. |
| 6. Complexity justified | PASS | No violations — design follows existing patterns (building action, CraftingModal, crown service). |

**Post-Phase 1 re-check**: All gates still pass. Data model uses standard PostgreSQL patterns (FK, CHECK, partial indexes). No new abstractions beyond what's needed.

## Project Structure

### Documentation (this feature)

```text
specs/023-player-marketplace/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions
├── data-model.md        # Phase 1 output — tables, columns, state machine
├── quickstart.md        # Phase 1 output — key files and approach
├── contracts/
│   └── marketplace-protocol.md  # WebSocket message contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 025_marketplace.sql          # NEW: tables + constraint
│   │   └── queries/
│   │       └── marketplace.ts               # NEW: all marketplace queries
│   ├── game/
│   │   ├── marketplace/
│   │   │   ├── marketplace-handler.ts       # NEW: WS message handlers
│   │   │   └── marketplace-service.ts       # NEW: business logic
│   │   └── world/
│   │       └── building-action-handler.ts   # MODIFY: add 'marketplace' branch
│   └── index.ts                             # MODIFY: register handlers

frontend/
├── src/
│   ├── ui/
│   │   ├── MarketplaceModal.ts              # NEW: main modal
│   │   ├── ListItemDialog.ts                # NEW: quantity/price dialog
│   │   ├── BuildingPanel.ts                 # MODIFY: marketplace action handling
│   │   └── InventoryPanel.ts                # MODIFY: add drag-and-drop
│   └── scenes/
│       └── GameScene.ts                     # MODIFY: wire WS handlers

shared/
└── protocol/
    └── index.ts                             # MODIFY: add marketplace types

admin/
└── backend/
    └── src/
        └── routes/
            └── buildings.ts                 # MODIFY: marketplace config validation
```

**Structure Decision**: Follows existing monorepo layout. New `backend/src/game/marketplace/` directory for marketplace-specific backend logic (same pattern as `backend/src/game/crafting/`, `backend/src/game/inventory/`). Frontend adds two new UI files to the existing `frontend/src/ui/` directory.

## Complexity Tracking

No violations to justify — design reuses existing patterns throughout.
