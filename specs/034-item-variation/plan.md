# Implementation Plan: Item Bonus Variation

**Branch**: `034-item-variation` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/034-item-variation/spec.md`

## Summary

Add per-instance stat variation to weapons and armor. When items are granted to players, their combat stats are randomly rolled: special weapons (dagger/bow/staff/wand) randomize their category-specific bonuses (0 to base), while standard weapons and armor get a 0-20% bonus on attack/defence. The distribution is weighted toward lower values (~30% average), making high rolls rare. Items display quality tier labels and color-coded stats.

The core architectural change is adding per-instance stat override columns to `inventory_items` and modifying all DTO-building and combat-stat queries to read from instance columns (with fallback to definition values for existing items).

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared)  
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (frontends)  
**Storage**: PostgreSQL 16 — migration 038 (ALTER `inventory_items`, ALTER `marketplace_listings`)  
**Testing**: Manual game testing + admin grant commands  
**Target Platform**: Browser (frontend), Node.js server (backend)  
**Project Type**: Web-based multiplayer RPG  
**Performance Goals**: No measurable latency increase on item grant or combat stat computation  
**Constraints**: Single grant point (`grantItemToCharacter`) must handle all randomization; existing items must continue working with NULL instance columns  
**Scale/Scope**: ~15 files modified across backend, frontend, shared, admin

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Item granting uses WebSocket; randomization happens server-side in grant flow |
| 2. Server-side validation present | PASS | All randomization computed server-side in `grantItemToCharacter`; client receives result only |
| 3. Structured logging required | PASS | Will log roll results in grant service |
| 4. Contract documented | PASS | Will document updated `InventorySlotDto` in contracts/ |
| 5. Graceful rejection handling | N/A | No new rejection paths — randomization is transparent to player |
| 6. Complexity justified | PASS | No unnecessary complexity; per-instance columns are the simplest approach |
| 7. Tooling updated | PASS | Will update game-data.js, game-entities.js, CLAUDE.md |

## Project Structure

### Documentation (this feature)

```text
specs/034-item-variation/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart
├── contracts/           # Phase 1 WebSocket contract changes
│   └── inventory-slot-dto.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/038_item_variation.sql     # New migration
│   │   └── queries/
│   │       ├── inventory.ts                       # Modified: INSERT with stat columns, SELECT with stat columns
│   │       └── equipment.ts                       # Modified: buildInventorySlotDto uses instance stats
│   ├── game/
│   │   ├── inventory/
│   │   │   ├── inventory-grant-service.ts         # Modified: roll stats at grant time
│   │   │   └── item-roll-service.ts               # New: randomization logic + quality tier computation
│   │   ├── combat/
│   │   │   └── combat-stats-service.ts            # Modified: read instance stats instead of definition stats
│   │   ├── marketplace/
│   │   │   └── marketplace-service.ts             # Modified: preserve instance stats on purchase
│   │   └── disassembly/
│   │       └── disassembly-service.ts             # Verify: no stat transfer on disassembly (OK)
│   └── websocket/handlers/
│       └── inventory-state-handler.ts             # Modified: include instance stats in DTO

shared/
└── protocol/
    └── index.ts                                    # Modified: InventorySlotDto adds instance stat fields + quality tier

frontend/
└── src/ui/
    ├── InventoryPanel.ts                           # Modified: display instance stats, quality colors/labels
    ├── EquipmentPanel.ts                           # Modified: display instance stats, quality colors/labels
    └── StatsBar.ts                                 # Verify: uses computed combat stats (no change needed)

admin/
├── backend/src/routes/
│   ├── items.ts                                    # Verify: item definitions unchanged
│   └── upload.ts                                   # No change
└── frontend/src/
    ├── editor/api.ts                               # No change
    └── ui/item-manager.ts                          # No change

scripts/
├── game-data.js                                    # Modified: show instance stats in inventory queries
└── game-entities.js                                # No change (creates definitions, not instances)
```

**Structure Decision**: Existing monorepo structure (backend/frontend/shared/admin). New file: `item-roll-service.ts` for randomization logic. New migration: `038_item_variation.sql`.

## Complexity Tracking

No violations. The design follows the simplest approach: add columns to `inventory_items`, roll values at grant time, read instance values in all queries.
