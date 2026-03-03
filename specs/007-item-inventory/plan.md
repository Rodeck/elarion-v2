# Implementation Plan: Item and Inventory System

**Branch**: `007-item-inventory` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-item-inventory/spec.md`

## Summary

Implement a full item definition system (admin-managed) and player inventory (in-game). Admin creates item templates with category-specific stats and icons via a new "Items" tab in the admin UI (REST). Players hold up to 20 inventory slots, displayed in a grid panel left of the map; stackable items (resource, food, heal) merge into one slot. All in-game inventory mutations (delete, receive) use the existing WebSocket protocol. Replaces the legacy `items`/`character_items` DB schema with new `item_definitions`/`inventory_items` tables.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, admin — all packages)
**Primary Dependencies**: Phaser 3.60.0 (game frontend), Node.js 20 LTS + `ws` (game backend), Express 4 + `multer` (admin backend), Vite 5 (both frontends)
**Storage**: PostgreSQL 16 — two new tables (`item_definitions`, `inventory_items`) replacing legacy `items`/`character_items` via migration 010
**Testing**: `npm test && npm run lint` per root-level command
**Target Platform**: Browser (game frontend) + Node.js server (game + admin backends)
**Project Type**: Full-stack web game (browser client + WebSocket server + admin web app)
**Performance Goals**: Inventory panel renders < 1 second post-connect; filter responds < 200 ms
**Constraints**: Server-authoritative design; no client-side inventory mutation without server confirmation; PNG-only icons; 20-slot hard cap (config, not gameplay)
**Scale/Scope**: Per-player inventory (single character per account); admin operates on shared item definitions

## Constitution Check

*GATE: Must pass before implementation begins. Re-evaluated post-design below.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | ✅ PASS | Player inventory mutations (delete, receive) use WebSocket. Admin item CRUD uses REST — this is admin tooling, not game state, consistent with existing admin backend pattern. |
| 2. Server-side validation present | ✅ PASS | `inventory-delete-handler.ts` validates slot ownership. `insertInventoryItem` logic validates capacity and stack rules before any DB write. |
| 3. Structured logging required | ✅ PASS | All inventory handler code paths emit structured logs (see quickstart.md log table). |
| 4. Contract documented | ✅ PASS | 6 new WebSocket message types documented in `contracts/websocket-messages.md`. Admin REST documented in `contracts/admin-rest-api.md`. |
| 5. Graceful rejection handling | ✅ PASS | `inventory.delete_rejected` handled by frontend (re-enable button, show error). `inventory.full` shows notification. No silent failures. |
| 6. Complexity justified | ✅ PASS | No unjustified complexity. See Complexity Tracking below. |

**Post-design re-evaluation**: No constitution violations found after design phase. All gates still pass.

## Project Structure

### Documentation (this feature)

```text
specs/007-item-inventory/
├── plan.md              # This file
├── research.md          # Phase 0 — codebase analysis and design decisions
├── data-model.md        # Phase 1 — schema, entities, business rules
├── quickstart.md        # Phase 1 — developer guide
├── contracts/
│   ├── websocket-messages.md   # 6 new WS message types
│   └── admin-rest-api.md       # 5 admin REST endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── assets/
│   └── items/
│       └── icons/                    # NEW: item icon files (UUID.png)
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 010_item_inventory.sql  # NEW: replace items/character_items
│   │   └── queries/
│   │       ├── inventory.ts           # NEW: ItemDefinition + InventoryItem CRUD
│   │       └── items.ts               # REPLACE: update to re-export from inventory.ts (or delete)
│   ├── game/
│   │   └── inventory/
│   │       └── inventory-delete-handler.ts  # NEW: handles inventory.delete_item
│   ├── websocket/
│   │   └── handlers/
│   │       └── inventory-state-handler.ts   # NEW: sendInventoryState()
│   └── index.ts                       # MODIFY: register inventory.delete_item handler

shared/
└── protocol/
    └── index.ts                       # MODIFY: add 6 new payload types + ItemCategory/WeaponSubtype enums

admin/
├── backend/
│   └── src/
│       ├── routes/
│       │   └── items.ts               # NEW: CRUD + icon upload for item definitions
│       └── index.ts                   # MODIFY: mount itemsRouter, add /item-icons static route
└── frontend/
    └── src/
        ├── ui/
        │   └── item-manager.ts        # NEW: ItemManager component (list + form)
        ├── editor/
        │   └── api.ts                 # MODIFY: add item definition API calls
        └── main.ts                    # MODIFY: tab navigation, init ItemManager

frontend/
├── index.html                         # MODIFY: add #inventory-panel div, flex-row #game
└── src/
    ├── ui/
    │   └── InventoryPanel.ts          # NEW: HTML inventory panel component
    └── scenes/
        └── GameScene.ts               # MODIFY: init InventoryPanel, register inventory.* handlers
```

**Structure Decision**: Follows the existing web-application layout (Option 2 from template). Game backend in `backend/`, admin backend in `admin/backend/`, game frontend in `frontend/`, admin frontend in `admin/frontend/`, shared types in `shared/protocol/`. New feature code goes in new files within existing directories; no new top-level directories.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Cross-package DB query import (`admin/backend` imports from `backend/src/db`) | Admin backend needs access to the same DB query functions as the game backend — avoids duplication | Duplicating query functions in `admin/backend/src/db/` would create two sources of truth for the same schema; existing `routes/upload.ts` already uses this pattern (`import { updateMapImage } from '../../../../backend/src/db/queries/city-maps'`) |
| Two new tables replacing two existing tables | New feature requirements (9 categories, 6 weapon subtypes, per-stat columns, icon, stack size) are fundamentally incompatible with the old schema | Extending the old schema (`ALTER TABLE`) would leave orphaned columns (`stat_modifiers JSONB`, `equipped BOOLEAN`) and require a CHECK constraint on `type` that conflicts with existing values; a clean replacement is less complex overall |
