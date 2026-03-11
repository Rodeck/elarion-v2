# Implementation Plan: Currency System (Crowns)

**Branch**: `015-currency-system` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-currency-system/spec.md`

---

## Summary

Introduce "Crowns" as the in-game currency. Characters accumulate Crowns by defeating monsters (configurable random drop range per monster type) and via the admin `/crown` command. The Crown balance is displayed in real time on the character stats bar in the top UI panel.

Technical approach: one SQL migration adds two columns (`characters.crowns`, `monsters.min_crowns` / `max_crowns`); a new `crown-service.ts` handles atomic DB increments; the existing combat services and admin command handler are extended; the shared protocol gains one new message type and two optional payload fields; the StatsBar gets a new Crown display element.

---

## Technical Context

**Language/Version**: TypeScript 5.x (all packages: frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — two new columns on existing tables (`characters.crowns`, `monsters.min_crowns`, `monsters.max_crowns`); migration file `017_currency.sql`
**Testing**: `npm test && npm run lint` (repo root)
**Target Platform**: Linux server (backend), browser (frontend/admin)
**Project Type**: Multiplayer web game (WebSocket backend + Phaser frontend)
**Performance Goals**: Crown award adds one atomic SQL UPDATE per combat win; negligible overhead
**Constraints**: No REST for game state (WebSocket only); server-authoritative balance; atomic DB increments to prevent race conditions
**Scale/Scope**: 12 files modified or created across 4 packages; 1 new migration; 1 new service module

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | ✅ PASS | Crown balance updates use WebSocket (`character.crowns_changed`, `crowns_gained` in combat result). Admin command goes via chat WS. |
| 2. Server-side validation | ✅ PASS | `awardCrowns` is server-only; admin command validates amount and online status server-side; DB CHECK constraint enforces non-negative balance. |
| 3. Structured logging | ✅ PASS | Crown award and admin command events emit structured JSON logs via existing `log()` helper. |
| 4. Contract documented | ✅ PASS | `contracts/ws-currency.md` documents all modified and new message types. |
| 5. Graceful rejection handling | ✅ PASS | Frontend handles the absence of `crowns_gained` (optional field); unknown message types are no-op in dispatcher. |
| 6. Complexity justified | ✅ PASS | No complexity violations. Feature adds a straightforward scalar field with atomic increment. |

**Post-design re-check**: All gates still pass. No new violations introduced.

---

## Project Structure

### Documentation (this feature)

```text
specs/015-currency-system/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Schema and type changes
├── quickstart.md        # Developer quick start
├── contracts/
│   └── ws-currency.md   # WebSocket protocol contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code Changes

```text
backend/src/db/migrations/
└── 017_currency.sql            # NEW — crowns column on characters; min/max_crowns on monsters

backend/src/db/queries/
├── characters.ts               # MODIFIED — add crowns field; add addCrowns() function
└── monsters.ts                 # MODIFIED — add min_crowns/max_crowns; extend create/update

backend/src/game/currency/
└── crown-service.ts            # NEW — awardCrowns(), rollCrownDrop()

backend/src/game/combat/
└── explore-combat-service.ts   # MODIFIED — call awardCrowns on win; include crowns_gained

backend/src/game/world/
└── night-encounter-service.ts  # MODIFIED — call awardCrowns on win; include crowns_gained

backend/src/game/admin/
└── admin-command-handler.ts    # MODIFIED — add /crown command case

shared/protocol/
└── index.ts                    # MODIFIED — crowns in CharacterData; crowns_gained in result payloads; CharacterCrownsChangedMessage

frontend/src/ui/
└── StatsBar.ts                 # MODIFIED — add crownsEl; add setCrowns(); update constructor

frontend/src/scenes/
└── GameScene.ts                # MODIFIED — pass crowns on init; handle character.crowns_changed

admin/backend/src/routes/
└── monsters.ts                 # MODIFIED — read/validate/write min_crowns, max_crowns

admin/frontend/src/ui/
└── monster-manager.ts          # MODIFIED — add min/max crowns inputs to form
```

**Structure Decision**: Follows the existing web application layout. New `backend/src/game/currency/` directory created for the crown service (consistent with `backend/src/game/combat/`, `backend/src/game/inventory/`, etc.).

---

## Complexity Tracking

> No constitution violations — table not required.
