# Implementation Plan: NPC System

**Branch**: `014-npc-system` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-npc-system/spec.md`

## Summary

Introduce a fully managed NPC system: admins create NPCs (name, description, icon via upload or AI generation) through a new admin panel tab, assign NPCs to buildings via the map editor's building properties panel, and players see assigned NPCs in the building menu under a "You can find here:" section. The feature extends the existing `world.state` message to carry NPC data, adds a new PostgreSQL migration for the `npcs` and `building_npcs` tables, and follows all established patterns for icon management, admin CRUD panels, and WebSocket data delivery.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, backend, shared, admin)
**Primary Dependencies**: Node.js 20 LTS + `ws` (game backend), Phaser 3.60 + Vite 5 (game frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client)
**Storage**: PostgreSQL 16 — two new tables (`npcs`, `building_npcs`); filesystem for NPC icon PNGs under `backend/assets/npcs/icons/`
**Testing**: Existing test runner (`npm test`), manual end-to-end verification per `quickstart.md`
**Target Platform**: Browser (frontend), Node.js server (backend), Express server (admin backend)
**Project Type**: Multiplayer web game (browser client + Node.js game server + Express admin backend)
**Performance Goals**: NPC data piggybacked on existing `world.state` message — no additional latency; icon uploads/generation match existing item/monster benchmarks (PNG ≤ 2 MB)
**Constraints**: PNG icons only, ≤ 2 MB; NPC click interaction stub only (no dialog in scope)
**Scale/Scope**: Admin-maintained NPC catalog; building assignments read by all connected players; no high-frequency operations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Requirement | Assessment | Status |
|------|-------------|------------|--------|
| 1. No REST for game state | Game state mutations must use WebSocket | NPC data is **read-only** from the game client; data is delivered via the existing `world.state` WS message. No REST call is made from the game client. Admin panel uses REST — permissible (admin ops are not game state). | ✅ PASS |
| 2. Server-side validation | Player-action features must validate server-side | No new player-initiated action mutates server state. NPC display is a projection of server-authoritative data already in `world.state`. | ✅ PASS (N/A for player actions) |
| 3. Structured logging | Code touching game loop or player actions must log | Admin NPC CRUD routes log creation/update/deletion events. The worldState builder is existing code; no new game-loop paths are introduced. Admin backend already logs per existing pattern. | ✅ PASS |
| 4. Contract documented | New WS message types must be in `contracts/` | No new message type. The modification to `CityMapBuilding.npcs` in the `world.state` payload is documented in `contracts/websocket-protocol.md`. | ✅ PASS |
| 5. Graceful rejection handling | Frontend must handle server rejections | No new player-initiated WS messages are introduced. Player cannot send NPC-related requests. N/A for this feature. | ✅ PASS (N/A) |
| 6. Complexity justified | Violations of Principle III in Complexity Tracking | No complexity violations identified. All patterns follow existing project conventions. | ✅ PASS |

**Constitution Check Result**: All gates pass. Proceeding to design.

## Project Structure

### Documentation (this feature)

```text
specs/014-npc-system/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── websocket-protocol.md  # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── assets/
│   └── npcs/
│       └── icons/                         # NEW — NPC icon storage
├── src/
│   └── db/
│       └── migrations/
│           └── 016_npcs.sql               # NEW — npcs + building_npcs tables
│   └── game/
│       └── world/
│           └── world-state-builder.ts     # MODIFIED — include npcs in buildings

admin/
├── backend/
│   └── src/
│       ├── index.ts                       # MODIFIED — add /npc-icons static route, register NPC routes
│       └── routes/
│           ├── npcs.ts                    # NEW — CRUD + icon upload for NPCs
│           └── buildings.ts              # MODIFIED — add NPC assignment endpoints
├── frontend/
│   └── src/
│       ├── index.html                     # MODIFIED — add NPCs tab button
│       ├── main.ts                        # MODIFIED — wire NPCs tab to NpcManager
│       └── ui/
│           ├── npc-manager.ts             # NEW — admin NPC management panel
│           └── properties.ts             # MODIFIED — add NPC assignment section

shared/
└── protocol/
    └── index.ts                           # MODIFIED — add NpcDto, extend CityMapBuilding

frontend/
└── src/
    └── [building menu component]          # MODIFIED — add "You can find here:" section
```

**Structure Decision**: Web application layout (Option 2). Four packages in the monorepo — `backend`, `admin/backend`, `admin/frontend`, `frontend` — are all touched. The `shared/protocol/` package is the contract boundary between frontend and backend.

## Complexity Tracking

> No violations of Constitution Principle III. Table left empty per template convention.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

## Implementation Phases

### Phase A: Data Layer

**Deliverables**:
1. `backend/src/db/migrations/016_npcs.sql` — Creates `npcs` and `building_npcs` tables with constraints and cascades.
2. `backend/assets/npcs/icons/` — Directory created (can be an empty `.gitkeep`).

**Dependencies**: None (new tables, no schema changes to existing tables).

---

### Phase B: Admin Backend API

**Deliverables**:
1. `admin/backend/src/routes/npcs.ts`:
   - `GET /api/npcs` — List all NPCs
   - `POST /api/npcs` — Create NPC (requires name, description, icon_filename)
   - `PUT /api/npcs/:id` — Update NPC
   - `DELETE /api/npcs/:id` — Delete NPC (cascade handled by DB)
   - `POST /api/npcs/upload` — Upload PNG icon (multer, UUID filename, PNG validation)
2. `admin/backend/src/routes/buildings.ts` extended:
   - `GET /api/maps/:mapId/buildings/:buildingId/npcs`
   - `POST /api/maps/:mapId/buildings/:buildingId/npcs` — Assign NPC (409 on duplicate)
   - `DELETE /api/maps/:mapId/buildings/:buildingId/npcs/:npcId` — Remove assignment
3. `admin/backend/src/index.ts` updated:
   - Register `/npc-icons` static route → `backend/assets/npcs/icons/`
   - Register `npcRoutes` under `/api/npcs`

**Dependencies**: Phase A (migration must exist).

---

### Phase C: Shared Protocol Update

**Deliverables**:
1. `shared/protocol/index.ts` updated:
   - Add `NpcDto` interface
   - Add `npcs: NpcDto[]` to `CityMapBuilding`

**Dependencies**: None (TypeScript interface only, no runtime changes).

---

### Phase D: Backend WorldState Integration

**Deliverables**:
1. Backend `world.state` builder updated to:
   - JOIN `building_npcs` and `npcs` when fetching buildings for a zone
   - Map `icon_filename` to `icon_url` (`/npc-icons/` prefix)
   - Always include `npcs: []` when no assignments

**Dependencies**: Phase A (tables must exist), Phase C (NpcDto type must be defined).

---

### Phase E: Admin Frontend — NPC Manager

**Deliverables**:
1. `admin/frontend/src/ui/npc-manager.ts`:
   - Two-column layout: form (name, description, icon upload, AI generate) + NPC list
   - Create / edit / delete operations
   - Icon preview
2. `admin/frontend/src/main.ts` updated — "NPCs" tab lazy-loads NpcManager
3. `admin/frontend/src/index.html` updated — "NPCs" tab button added

**Dependencies**: Phase B (REST API must exist).

---

### Phase F: Admin Frontend — Building Assignment

**Deliverables**:
1. `admin/frontend/src/ui/properties.ts` updated:
   - "NPCs" collapsible section in building properties panel
   - Dropdown populated from `GET /api/npcs`
   - Assign button (calls `POST .../npcs`)
   - Assigned NPC list with individual Remove buttons

**Dependencies**: Phase B (assignment REST API), Phase E (NPC manager — NPCs must be creatable before assignment UI is useful, though technically independent).

---

### Phase G: Game Frontend — Building Menu NPC Section

**Deliverables**:
1. Game frontend building menu component updated:
   - Renders "You can find here:" heading + NPC list when `building.npcs.length > 0`
   - Each entry: NPC icon (img) + NPC name, wrapped in clickable element with stub click handler
   - No section rendered when `building.npcs` is empty

**Dependencies**: Phase C (NpcDto type), Phase D (data delivered in world.state).

---

## Verification

See `quickstart.md` for the full verification checklist. Key end-to-end smoke test:

1. Apply migration → admin creates NPC with uploaded icon → assign NPC to a building
2. Game client logs in, enters zone → inspects `world.state` WebSocket message → building has `npcs: [{...}]`
3. Player opens building in game → "You can find here:" section visible with NPC icon and name
4. Admin deletes NPC → player re-enters zone → building has `npcs: []` → section absent
