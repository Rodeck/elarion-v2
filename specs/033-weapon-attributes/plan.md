# Implementation Plan: Weapon Attributes

**Branch**: `033-weapon-attributes` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/033-weapon-attributes/spec.md`

## Summary

Extend the item system with two new database columns (`armor_penetration`, `additional_attacks`) and wire the existing `crit_chance` column through the admin UI. Integrate armor penetration into the combat damage formula (reducing effective enemy defence) and add a bonus-hits phase at combat start for additional attacks. Display all three attributes in the admin item editor, game character stats panel, and item tooltips.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared + admin)
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (frontends)
**Storage**: PostgreSQL 16 — migration 037 (ALTER `item_definitions`)
**Testing**: Manual testing via admin panel + in-game combat
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web-based multiplayer RPG (monorepo)
**Performance Goals**: No new performance concerns — extending existing stat aggregation and damage calc
**Constraints**: Server-authoritative; all combat logic server-side
**Scale/Scope**: ~15 files modified across 4 packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Combat stats flow via WebSocket `world.state` message. Admin CRUD uses REST (non-game-state). |
| 2. Server-side validation | PASS | Armor penetration applied in `combat-engine.ts` server-side. Additional attacks executed server-side in combat session. Admin input validated in `items.ts` route. |
| 3. Structured logging | PASS | Combat engine already logs all damage events. Additional attacks will use same logging path. |
| 4. Contract documented | PASS | Will document modified `world.state` payload and `ItemDefinitionDto` changes in `contracts/`. |
| 5. Graceful rejection handling | PASS | No new rejection paths — attributes are passive stats. Admin validation returns 400 on invalid values (existing pattern). |
| 6. Complexity justified | PASS | No new abstractions. Extends existing patterns (stat aggregation, damage formula, admin fields). |
| 7. Tooling updated | PASS | Will update `game-entities.js`, `game-entities.md`, `game-data.js`, `game-data.md`, and CLAUDE.md. |

## Project Structure

### Documentation (this feature)

```text
specs/033-weapon-attributes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── weapon-attributes.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/037_weapon_attributes.sql    # New columns
│   │   └── queries/inventory.ts                    # Extended SELECT
│   └── game/
│       ├── combat/
│       │   ├── combat-engine.ts                    # Armor pen in damage calc
│       │   ├── combat-stats-service.ts             # Aggregate new stats
│       │   └── combat-session.ts                   # Additional attacks phase
│       ├── boss/boss-combat-handler.ts             # Additional attacks phase
│       └── arena/arena-combat-handler.ts           # Additional attacks + armor pen
shared/
└── protocol/index.ts                               # Extended DTOs
admin/
├── backend/src/routes/items.ts                     # Validation for new fields
└── frontend/src/ui/
    ├── item-modal.ts                               # New input fields
    └── item-manager.ts                             # New stat pills
frontend/
└── src/ui/
    ├── StatsBar.ts                                 # Display new derived stats
    └── (inventory tooltip)                         # Show item attributes
scripts/
├── game-data.js                                    # Query support
└── game-entities.js                                # Create support
```

**Structure Decision**: No new files or directories. All changes extend existing modules following established patterns.

## Complexity Tracking

No violations. All changes follow existing patterns (stat column → aggregation → combat formula → UI display).
