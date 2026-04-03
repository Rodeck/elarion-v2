# Implementation Plan: Skill Development System

**Branch**: `032-skill-development` | **Date**: 2026-04-03 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/032-skill-development/spec.md`  
**Design Reference**: `game_design/skill-development/design.md`

## Summary

Add a skill leveling system where players use consumable skill books to gain points toward leveling their combat abilities (levels 1-5). Each level has admin-defined stat scaling (effect_value, mana_cost, duration_turns, cooldown_turns). The combat engine reads level-scaled stats. The admin ability manager is overhauled from a side-panel form to a modal-based editor with per-level stat management. New `skill_book` item category links items to abilities.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)  
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + ws (backend), Express 4 (admin backend), pg (PostgreSQL client), jose (JWT), Vite 5 (frontends)  
**Storage**: PostgreSQL 16 — migration `035_skill_development.sql` (new tables + ALTER)  
**Testing**: `npm test && npm run lint`  
**Target Platform**: Browser (frontend), Node.js server (backend)  
**Project Type**: Multiplayer RPG web game  
**Performance Goals**: <1s for skill book use response (SC-001)  
**Constraints**: Server-authoritative, all validation server-side, WebSocket for game state  
**Scale/Scope**: Single-server deployment, <1000 concurrent players

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Skill book usage via WebSocket `skill-book.use` message. Admin CRUD uses REST (non-game-state). |
| 2. Server-side validation present | PASS | All validation in skill-book-handler: ability ownership, cooldown, max level, combat check. |
| 3. Structured logging required | PASS | Will add structured logs for skill book usage, level-ups, and rejections. |
| 4. Contract documented | PASS | New WS messages documented in `contracts/skill-book-messages.ts`. |
| 5. Graceful rejection handling | PASS | `skill-book.error` payload with human-readable message; frontend shows error to player. |
| 6. Complexity justified | PASS | No unnecessary complexity. Level fallback logic (previous level) is the simplest correct approach. |
| 7. Tooling updated | PASS | Will update `game-entities.js`, `game-entities.md`, `game-data.js`, `game-data.md`, `gd.design.md`, and `CLAUDE.md`. |

## Project Structure

### Documentation (this feature)

```text
specs/032-skill-development/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── skill-book-messages.ts
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 035_skill_development.sql      # NEW: ability_levels + character_ability_progress + ALTER item_definitions
│   │   └── queries/
│   │       ├── ability-levels.ts               # NEW: CRUD for ability_levels table
│   │       ├── ability-progress.ts             # NEW: CRUD for character_ability_progress table
│   │       ├── loadouts.ts                     # MODIFY: getCharacterLoadout() and getOwnedAbilities() to include level data
│   │       └── inventory.ts                    # MODIFY: ItemDefinition interface to add ability_id
│   ├── game/
│   │   ├── skill/
│   │   │   └── skill-book-handler.ts           # NEW: WS handler for skill-book.use
│   │   ├── combat/
│   │   │   └── combat-session.ts               # MODIFY: buildLoadout() to use level-scaled stats
│   │   └── boss/
│   │       └── boss-combat-handler.ts          # MODIFY: buildLoadout() to use level-scaled stats
│   └── index.ts                                # MODIFY: register skill-book handlers

shared/
└── protocol/
    └── index.ts                                # MODIFY: add skill_book to ItemCategory, new DTOs

admin/
├── backend/
│   └── src/
│       └── routes/
│           ├── abilities.ts                    # MODIFY: add level stats CRUD endpoints
│           └── items.ts                        # MODIFY: add skill_book to VALID_CATEGORIES
└── frontend/
    └── src/
        └── ui/
            └── ability-manager.ts              # MODIFY: replace side-panel form with modal, add level stats editor

frontend/
└── src/
    └── ui/
        ├── LoadoutPanel.ts                     # MODIFY: add level badges, progress bars, cooldown timers, click handler
        ├── SkillDetailModal.ts                 # NEW: ability detail modal with level stats
        ├── InventoryPanel.ts                   # MODIFY: add "Use" button for skill_book items
        └── GameScene.ts                        # MODIFY: register skill-book WS handlers

scripts/
├── game-entities.js                            # MODIFY: add skill_book category, create-skill-book, set-ability-levels
└── game-data.js                                # MODIFY: add ability-levels, ability-progress queries
```

**Structure Decision**: Existing monorepo structure (backend/, frontend/, shared/, admin/) is preserved. New files follow established patterns: DB queries in `queries/`, game handlers in `game/skill/`, frontend UI in `ui/`.

## Complexity Tracking

No violations. All design choices follow the simplest correct approach:
- Level fallback uses previous-level stats (simple query with `ORDER BY level DESC LIMIT 1`)
- Skill book handler follows same pattern as stat-training-handler (established pattern)
- Admin modal follows existing modal patterns in the frontend (ListItemDialog, StatTrainingModal)
