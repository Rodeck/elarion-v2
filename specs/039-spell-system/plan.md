# Implementation Plan: Spell System

**Branch**: `039-spell-system` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/039-spell-system/spec.md`

## Summary

Add a non-combat spell system allowing players to cast timed buff spells on themselves or other players. Spells are defined by admins, trained via spell book items (same mechanic as skill books), and cost resources (items + gold) to cast. Active buffs persist server-side with expiry timestamps, modify effective stats, and display in the stats panel (replacing the XP bar with a circular ring). Includes admin panel management, WebSocket message protocol, and admin commands.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend + shared + admin)  
**Primary Dependencies**: Phaser 3.60 (frontend), Node.js 20 LTS + `ws` (backend), Express 4 + `multer` (admin backend), Vite 5 (frontends)  
**Storage**: PostgreSQL 16 — migration 043 (5 new tables, 2 ALTER statements)  
**Testing**: Manual testing via admin panel + in-game  
**Target Platform**: Browser (frontend), Linux/Windows server (backend)  
**Project Type**: Web-based multiplayer RPG (monorepo: frontend, backend, shared, admin)  
**Performance Goals**: Spell cast round-trip < 200ms; buff state restore on reconnect < 100ms  
**Constraints**: All spell actions server-authoritative; buffs must survive server restarts  
**Scale/Scope**: ~15 new/modified files across 4 packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| 1. No REST for game state | PASS | All spell actions (cast, train, list) use WebSocket messages. Admin CRUD uses existing REST pattern (non-game-state). |
| 2. Server-side validation present | PASS | Cast handler validates: not in combat, owns spell, sufficient resources, level replacement rules. Train handler validates: owns book, cooldown, max level. |
| 3. Structured logging required | PASS | Spell cast, train, and buff expiry events will emit structured logs with character_id, spell_id, level, target_id. |
| 4. Contract documented | PASS | All new WS message types documented in `contracts/ws-spell-messages.md`. |
| 5. Graceful rejection handling | PASS | Frontend handles `spell.cast_rejected`, `spell-book.error` with user-facing messages. Cast button disabled when resources insufficient. |
| 6. Complexity justified | PASS | No violations — design follows existing patterns (mirrors ability/skill-book architecture). |
| 7. Tooling updated | PASS | New item category `spell_book_spell`, new admin commands, new `game-data.js` queries, `game-entities.js` commands, `CLAUDE.md` checklists, `gd.design.md` updates all planned. |

## Project Structure

### Documentation (this feature)

```text
specs/039-spell-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ws-spell-messages.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrations/043_spell_system.sql      # New tables + ALTERs
│   │   └── queries/
│   │       ├── spells.ts                         # Spell definition + level queries
│   │       ├── spell-progress.ts                 # Character spell ownership + progress
│   │       └── spell-buffs.ts                    # Active buff CRUD + expiry
│   └── game/
│       ├── spell/
│       │   ├── spell-cast-handler.ts             # WS: spell.cast, spell.cast_on_player
│       │   ├── spell-book-handler.ts             # WS: spell-book-spell.use
│       │   ├── spell-state-handler.ts            # WS: spell.request_state
│       │   └── spell-buff-service.ts             # Buff application, expiry, stat integration
│       ├── combat/combat-stats-service.ts        # Modified: add spell buff pass
│       └── admin/admin-command-handler.ts         # Modified: add /spells.all, rename /skill_all

shared/protocol/index.ts                          # New spell DTOs + message types

frontend/src/
├── ui/
│   ├── SpellPanel.ts                             # Spells tab content (list + detail)
│   ├── SpellDetailModal.ts                       # Spell detail + Cast button
│   ├── BuffBar.ts                                # Active buff icons + progress bars
│   ├── LeftPanel.ts                              # Modified: add 'spells' tab
│   ├── StatsBar.ts                               # Modified: XP ring + buff display
│   └── PlayerDetailModal.ts                      # Modified: add spell casting section

admin/
├── backend/src/routes/spells.ts                  # REST CRUD for spell definitions
└── frontend/src/ui/spell-manager.ts              # Spell admin UI

scripts/
├── game-data.js                                  # Modified: add spells, spell-buffs queries
└── game-entities.js                              # Modified: add create-spell, create-spell-book-spell
```

**Structure Decision**: Follows existing monorepo patterns. Spell handlers mirror the skill-book handler pattern. DB queries split by concern (definitions, progress, buffs). Frontend follows existing panel/modal pattern from LoadoutPanel + SkillDetailModal.

## Complexity Tracking

No violations. All design follows existing patterns:
- Spell definitions mirror `abilities` table structure
- Spell training mirrors `skill-book-handler.ts` pattern
- Spell tab mirrors `LoadoutPanel` tab pattern
- Admin spell manager mirrors `ability-manager.ts` pattern
- Buff persistence is the only novel element — uses simple timestamp-based expiry in a new DB table
