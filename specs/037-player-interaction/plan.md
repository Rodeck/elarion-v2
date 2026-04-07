# Implementation Plan: Player Interaction Panel

**Branch**: `037-player-interaction` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/037-player-interaction/spec.md`

## Summary

Replace the Combat Log panel with a Nearby Players panel that shows other players at the same city map node. Clicking a player name opens a detail modal (placeholder icon, name, level) with live presence tracking. **Frontend-only change** — no backend, database, or protocol modifications needed. All required data (player positions, node IDs) is already broadcast via existing WebSocket messages.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend only)
**Primary Dependencies**: Phaser 3.60.0 (game framework), Vite 5 (dev server)
**Storage**: N/A — no persistence changes; all state is in-memory on frontend
**Testing**: Manual testing with two browser sessions
**Target Platform**: Web browser (desktop)
**Project Type**: Web game (multiplayer RPG)
**Performance Goals**: Panel updates within 1 second of player movement; modal opens in <500ms
**Constraints**: Must work with existing WebSocket protocol (no new message types)
**Scale/Scope**: 2 new UI components, 1 modified scene file, ~400-600 lines of new code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | No new endpoints; uses existing WebSocket messages |
| 2. Server-side validation | PASS | No new player actions — frontend reads existing broadcasts |
| 3. Structured logging | N/A | No backend changes |
| 4. Contract documented | PASS | No new message types; existing protocol documented in [contracts/](contracts/) |
| 5. Graceful rejection handling | N/A | No new actions that can be rejected |
| 6. Complexity justified | PASS | No complexity violations — straightforward UI replacement |
| 7. Tooling updated | PASS | No new entity types, validation arrays, or queryable data |

**Post-design re-check**: All gates still PASS. Frontend-only feature with no protocol changes.

## Project Structure

### Documentation (this feature)

```text
specs/037-player-interaction/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research decisions
├── data-model.md        # Frontend data structures
├── quickstart.md        # Development quickstart
├── contracts/           # Protocol documentation (no changes)
│   └── no-protocol-changes.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── ui/
│   │   ├── NearbyPlayersPanel.ts   # NEW — replaces CombatLog in bottom-bar
│   │   ├── PlayerDetailModal.ts    # NEW — player detail overlay modal
│   │   ├── CombatLog.ts            # EXISTING — no longer imported (can be deleted)
│   │   └── ChatBox.ts              # MODIFIED — add addSystemMessage() for server errors
│   └── scenes/
│       └── GameScene.ts            # MODIFIED — wire new panel, track node IDs, remove CombatLog
```

**Structure Decision**: All changes within existing `frontend/src/ui/` and `frontend/src/scenes/` directories. Two new files, two modified files, one file removed from usage.

## Complexity Tracking

No violations to justify — this is a straightforward UI replacement with no new abstractions, layers, or backend changes.
