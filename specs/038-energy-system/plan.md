# Implementation Plan: Energy & Movement Speed System

**Branch**: `038-energy-system` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/038-energy-system/spec.md`

## Summary

Add energy (resource with 1000 cap, passive regen, food restoration) and movement speed (base 100, halved at 0 energy) as character stats. Energy gates all gameplay actions (arena, boss, fishing, explore, gather) except tile-map movement. City travel speed scales with movement speed. Gathering drains energy per-second at a configurable rate. Admin panel gets tick configuration for both energy and HP regen. A new `inventory.use_item` handler enables food (energy) and heal (HP) item consumption.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared + admin)
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (frontends)
**Storage**: PostgreSQL 16 — migration `042_energy_system.sql` (ALTER `characters`, ALTER `building_actions` config)
**Testing**: Manual gameplay testing + admin panel verification
**Target Platform**: Browser (frontend), Linux/Windows server (backend)
**Project Type**: Web-based multiplayer RPG (monorepo: frontend, backend, shared, admin)
**Performance Goals**: Energy checks add <1ms per action handler; regen tick completes in <100ms for all characters
**Constraints**: Server-authoritative; all energy mutations happen server-side; client is a projection only
**Scale/Scope**: ~12 files modified, 3 new files, 1 migration, 4 packages touched (frontend, backend, shared, admin)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All energy mutations via WebSocket (`inventory.use_item`, `character.energy_changed`, action rejection messages). Admin config uses existing REST admin API (non-game-state). |
| 2. Server-side validation present | PASS | Energy checks in every action handler (arena, boss, fishing, explore, gather, city movement). Server deducts energy and broadcasts result. Client never mutates energy locally. |
| 3. Structured logging required | PASS | Energy regen tick logs healed count (mirrors hp-regen pattern). Item use handler logs consumption. Energy depletion during gathering logged. |
| 4. Contract documented | PASS | New protocol contract in `contracts/energy-protocol.md` documents all new/modified message types. |
| 5. Graceful rejection handling | PASS | Frontend handles `*_rejected` messages with "Not enough energy" user feedback. Gathering ends gracefully on energy depletion with partial rewards. |
| 6. Complexity justified | PASS | No violations — follows existing patterns (regen service, admin config, action gates). |
| 7. Tooling updated | PASS | `CLAUDE.md` updated with energy system notes. `game-data.js` not needed (energy is a character stat, not a queryable entity). `game-entities.js` not needed (no new entity type). |

## Project Structure

### Documentation (this feature)

```text
specs/038-energy-system/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
├── contracts/
│   └── energy-protocol.md  # WebSocket protocol contract
├── checklists/
│   └── requirements.md     # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 042_energy_system.sql          # NEW: ALTER characters + building_actions config
│   │   └── queries/
│   │       ├── characters.ts                   # MODIFY: add energy/movement_speed fields
│   │       └── admin-config.ts                 # MODIFY: add energy/HP regen config keys
│   ├── game/
│   │   ├── regen/
│   │   │   ├── hp-regen-service.ts             # MODIFY: make interval/percent configurable via admin config
│   │   │   └── energy-regen-service.ts         # NEW: energy regen tick service
│   │   ├── inventory/
│   │   │   └── inventory-use-handler.ts        # NEW: food/heal item consumption handler
│   │   ├── world/
│   │   │   ├── city-movement-handler.ts        # MODIFY: energy cost per step + speed scaling
│   │   │   └── building-action-handler.ts      # MODIFY: energy checks for explore
│   │   ├── combat/
│   │   │   └── combat-session.ts               # MODIFY: halve energy on death
│   │   ├── boss/
│   │   │   └── boss-combat-handler.ts          # MODIFY: energy check + halve on death
│   │   ├── gathering/
│   │   │   ├── gathering-handler.ts            # MODIFY: energy check on start
│   │   │   └── gathering-service.ts            # MODIFY: per-tick energy deduction + early stop
│   │   ├── fishing/
│   │   │   └── fishing-handler.ts              # MODIFY: energy check on cast
│   │   └── arena/
│   │       └── arena-handler.ts                # MODIFY: energy check on enter
│   └── index.ts                                # MODIFY: register inventory.use_item + start energy regen

shared/
└── protocol/
    └── index.ts                                # MODIFY: CharacterData + new payload types + GatherBuildingActionDto

frontend/
└── src/
    ├── ui/
    │   ├── StatsBar.ts                         # MODIFY: energy bar (collapsed + expanded) + movement speed display
    │   └── InventoryPanel.ts                   # MODIFY: "Use" button sends inventory.use_item message
    └── scenes/
        └── GameScene.ts                        # MODIFY: handle character.energy_changed message

admin/
├── backend/
│   └── src/
│       └── routes/
│           └── buildings.ts                    # MODIFY: energy_per_second in gather config
├── frontend/
│   └── src/
│       └── ui/
│           ├── admin-config-manager.ts         # MODIFY: energy/HP regen config fields
│           └── properties.ts                   # MODIFY: energy_per_second field for gather actions
```

**Structure Decision**: Follows existing monorepo layout. No new directories except `backend/src/game/inventory/` (for the new use-item handler) and `backend/src/game/regen/energy-regen-service.ts` (alongside existing HP regen service). All other changes are modifications to existing files.

## Complexity Tracking

No violations. All patterns follow existing precedent:
- Energy regen service mirrors `hp-regen-service.ts`
- Action energy gates mirror existing `in_combat`/`current_hp` gate pattern
- Admin config extends existing key-value store
- Protocol types extend existing `CharacterData` and message pattern
