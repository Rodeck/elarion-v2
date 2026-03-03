# Implementation Plan: City Map System

**Branch**: `003-city-map-system` | **Date**: 2026-03-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-city-map-system/spec.md`

## Summary

Replace the existing tile-based map system with city maps using path-graph navigation. Adds a standalone admin map editor (Express + Vite on ports 4001/4002) for creating/editing city maps with node-based walkable paths and building hotspots. Players navigate by clicking on paths/buildings with animated movement along the graph. Server remains authoritative for all movement via BFS pathfinding. New DB tables for path nodes, edges, and buildings. Existing zone infrastructure extended with a `map_type` discriminator.

## Technical Context

**Language/Version**: TypeScript 5.x (backend, frontend, admin, shared protocol)
**Primary Dependencies**: ws (game server), Express + multer (admin backend), Phaser 3 (game client), Vite (frontend + admin frontend), HTML5 Canvas 2D (map editor)
**Storage**: PostgreSQL 16 (shared database), filesystem for PNG map images
**Testing**: Manual testing (no test framework established yet)
**Target Platform**: Browser (game client + map editor), Node.js 20 LTS (backends)
**Project Type**: Web application — multiplayer game + admin tool
**Performance Goals**: Map render <3s, pathfinding <50ms for <200 node graphs, animated movement at consistent speed
**Constraints**: 10 MB max image upload, server-authoritative movement, small node graphs (<200 nodes per map)
**Scale/Scope**: Single-server deployment, ~3 new DB tables, ~2 modified tables, new admin app (~15 source files), modified game backend (~5 files), modified game frontend (~3 files)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Player movement uses WS (`city.move`). Admin REST API is for content authoring (non-game-state), explicitly allowed by Constitution. |
| 2. Server-side validation present | PASS | Server validates `city.move` via BFS reachability, combat check, rate limiting. Client path preview is cosmetic only. |
| 3. Structured logging required | PASS | All city movement handlers, admin CRUD operations, and map loading will emit structured JSON logs. |
| 4. Contract documented | PASS | New WS messages (`city.move`, `city.player_moved`, `city.building_arrived`, `city.move_rejected`) documented in `contracts/websocket-messages.md`. |
| 5. Graceful rejection handling | PASS | `city.move_rejected` with reason codes; client rolls back to `current_node_id` on rejection. |
| 6. Complexity justified | PASS | See Complexity Tracking below for the admin app addition. |

### Post-Design Re-Check

| Gate | Status | Notes |
|------|--------|-------|
| 1. No REST for game state | PASS | Confirmed: `city.move` is WS. Admin REST is content-only. `world.state` extended to include `city_map` data — still WS. |
| 2. Server-side validation | PASS | BFS pathfinding on server, `current_node_id` update is server-only, client receives position broadcasts. |
| 3. Structured logging | PASS | Plan includes logging for: city map loading, movement validation/rejection, building arrival, admin CRUD ops. |
| 4. Contract documented | PASS | All 4 new WS message types + admin REST API fully documented in contracts. |
| 5. Graceful rejection | PASS | Client handles `city.move_rejected` by snapping character back to current node. |
| 6. Complexity justified | PASS | Admin app justified in Complexity Tracking table. |

## Project Structure

### Documentation (this feature)

```text
specs/003-city-map-system/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── websocket-messages.md
└── tasks.md                 # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
admin/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Express bootstrap, static serving
│   │   ├── config.ts                   # EDITOR_PORT, DATABASE_URL, JWT_SECRET
│   │   ├── middleware/
│   │   │   └── auth.ts                 # JWT validation + is_admin check
│   │   └── routes/
│   │       ├── maps.ts                 # Map CRUD endpoints
│   │       ├── nodes.ts                # Node CRUD endpoints
│   │       ├── edges.ts                # Edge CRUD endpoints
│   │       ├── buildings.ts            # Building CRUD endpoints
│   │       └── upload.ts               # Image upload (multer, PNG validation)
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── main.ts                     # Editor entry point
    │   ├── editor/
    │   │   ├── canvas.ts               # Canvas 2D rendering + pan/zoom
    │   │   ├── modes.ts                # Toolbar mode state machine
    │   │   ├── graph.ts                # In-memory graph + BFS connectivity check
    │   │   └── api.ts                  # REST API client
    │   └── ui/
    │       ├── toolbar.ts              # Mode selection toolbar
    │       ├── properties.ts           # Building name, label position editor
    │       └── map-list.ts             # Map list / create / select
    ├── index.html
    ├── package.json
    └── vite.config.ts

backend/
├── src/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 008_city_maps.sql       # NEW — schema changes
│   │   └── queries/
│   │       └── city-maps.ts            # NEW — DB queries for city map data
│   ├── game/world/
│   │   ├── city-map-loader.ts          # NEW — load city maps from DB into memory
│   │   ├── city-movement-handler.ts    # NEW — handle city.move messages
│   │   ├── movement-handler.ts         # MODIFIED — delegate city maps to city handler
│   │   └── zone-loader.ts             # MODIFIED — skip TMX for city-type zones
│   └── websocket/
│       └── handlers/
│           └── world-state-handler.ts  # MODIFIED — include city_map data
└── assets/maps/images/                 # NEW — uploaded PNG storage directory

frontend/src/
├── scenes/
│   └── GameScene.ts                    # MODIFIED — city map rendering + click-to-move
└── network/
    └── WSClient.ts                     # MODIFIED — new message type handlers

shared/protocol/
└── index.ts                            # MODIFIED — new message interfaces
```

**Structure Decision**: Extended existing `backend/` + `frontend/` + `shared/` with a new top-level `admin/` directory. The admin app is a separate deployable unit (Express backend + Vite frontend) sharing the same PostgreSQL database and JWT secret. This follows Constitution V (Independent Deployability) — game server and admin tool have separate lifecycles.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New `admin/` application (separate Express server + Vite frontend) | Map editor requires HTTP REST for CRUD operations + file upload + canvas-based UI. Cannot be done via WS game protocol. | Embedding admin routes in the game WS server couples admin tooling to game server lifecycle, violating Constitution V. A CLI-based map editor was considered but rejected because spatial node/edge placement is inherently visual and requires a canvas. |
