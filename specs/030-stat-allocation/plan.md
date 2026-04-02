# Implementation Plan: Character Stat Allocation System

**Branch**: `030-stat-allocation` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/030-stat-allocation/spec.md`

## Summary

Replace the automatic per-level stat grants (HP, ATK, DEF) with a manual allocation system using 5 core attributes (Constitution, Strength, Intelligence, Dexterity, Toughness). Players receive 7 stat points per level and allocate them via a new Trainer NPC dialog. Combat stats are derived from allocated attributes + equipment. A database migration resets existing characters to class base stats and grants retroactive unspent points.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)  
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client), `jose` (JWT)  
**Storage**: PostgreSQL 16 — ALTER `characters` table (6 new columns), ALTER `npcs` table (1 new column); migration `033_stat_allocation.sql`  
**Testing**: Manual integration testing via game client + admin panel  
**Target Platform**: Browser (frontend), Linux/Windows server (backend)  
**Project Type**: Web-based multiplayer RPG (monorepo: frontend, backend, shared, admin)  
**Performance Goals**: Stat allocation round-trip < 200ms, no combat calculation regression  
**Constraints**: Server-authoritative (all allocation validated server-side), WebSocket for all game state mutations  
**Scale/Scope**: ~14 files modified, 2-3 new files created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | Stat allocation uses WebSocket messages (`training.open`, `training.allocate`, `training.result`) |
| 2. Server-side validation present | PASS | Backend validates: unspent points available, per-stat cap not exceeded, player not in combat |
| 3. Structured logging required | PASS | Level-up service already logs; training handler will log allocation events |
| 4. Contract documented | PASS | New message types documented in `contracts/websocket-messages.md` |
| 5. Graceful rejection handling | PASS | Frontend handles allocation rejection with rollback + user feedback in modal |
| 6. Complexity justified | PASS | No unnecessary complexity — follows existing NPC role pattern exactly |
| 7. Tooling updated | PASS | game-data.js, game-entities.js, CLAUDE.md checklist updated for is_trainer role |

## Project Structure

### Documentation (this feature)

```text
specs/030-stat-allocation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── websocket-messages.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/033_stat_allocation.sql     # NEW — schema changes
│   │   └── queries/
│   │       ├── characters.ts                      # MODIFY — add attribute fields to Character interface
│   │       └── npcs.ts                            # MODIFY — add is_trainer to interfaces + SELECTs
│   ├── game/
│   │   ├── progression/
│   │   │   └── level-up-service.ts                # MODIFY — remove auto-stats, grant points
│   │   ├── combat/
│   │   │   └── combat-stats-service.ts            # MODIFY — derive from attributes
│   │   ├── training/
│   │   │   └── training-handler.ts                # NEW — stat allocation logic
│   │   └── world/
│   │       └── city-map-loader.ts                 # MODIFY — add is_trainer to NPC mapping
│   └── index.ts                                   # MODIFY — register training message handlers

shared/
└── protocol/
    └── index.ts                                   # MODIFY — add NpcDto.is_trainer, training messages, CharacterData attributes

frontend/
└── src/
    ├── ui/
    │   ├── TrainingModal.ts                       # NEW — stat allocation UI
    │   ├── BuildingPanel.ts                       # MODIFY — add "Train" dialog option
    │   └── StatsBar.ts                            # MODIFY — add unspent points badge
    └── scenes/
        └── GameScene.ts                           # MODIFY — wire training callbacks + messages

admin/
├── backend/
│   └── src/routes/npcs.ts                         # MODIFY — add PUT /:id/trainer endpoint
└── frontend/
    └── src/
        ├── editor/api.ts                          # MODIFY — add toggleNpcTrainer()
        └── ui/npc-manager.ts                      # MODIFY — add Trainer checkbox
```

**Structure Decision**: Follows existing monorepo layout. New `training-handler.ts` mirrors the pattern of other game handlers. New `TrainingModal.ts` follows CraftingModal pattern.

## Stat Derivation Formulas

Reference — current auto-leveling grants per level:
- Warrior: +20 HP, +3 ATK, +2 DEF
- Mage: +10 HP, +5 ATK, +1 DEF
- Ranger: +15 HP, +4 ATK, +2 DEF

**Per 1 allocated point:**

| Attribute | Derived Stats | Per Point |
|-----------|--------------|-----------|
| Constitution | Max HP, Attack Power | +4 HP, +1 ATK |
| Strength | Attack Power, Crit Damage | +2 ATK, +0.3% crit damage |
| Intelligence | Max Mana | +8 mana |
| Dexterity | Crit Chance, Evasion | +0.1% crit, +0.1% evasion |
| Toughness | Defence | +1 DEF |

**Balance validation** — Warrior-like build at level 7 (42 total points), 15 CON / 10 STR / 0 INT / 7 DEX / 10 TOU:
- HP: 120 base + 60 = 180 (vs old 240 — 75%, gap filled by future training methods)
- ATK: 15 base + 15 + 20 = 50 (higher than old 33, but split across two stats)
- DEF: 12 base + 10 = 22 (vs old 24 — close)
- Crit: +0.7% chance, +3% crit damage (modest early-game bonus)
- Evasion: +0.7% dodge (modest early-game bonus)

**High-level scaling** — At level 50 (343 total points), even a full DEX build (all 343 into DEX) yields 34.3% crit and 34.3% evasion — strong but not game-breaking. Percentage stats scale gradually, rewarding long-term specialization without becoming overpowered at any level range.

## Complexity Tracking

No violations. All design follows existing patterns (NPC role pattern, modal pattern, WebSocket message pattern).
