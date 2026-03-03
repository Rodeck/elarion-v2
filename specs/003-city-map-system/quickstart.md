# Quickstart: City Map System

**Feature Branch**: `003-city-map-system`
**Date**: 2026-03-02

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running locally
- Existing Elarion backend/frontend working (migrations 001-007 applied)

## New Components

This feature adds a new **admin** application alongside the existing backend and frontend:

```
elarion-v2/
├── admin/                    # NEW — Map editor (admin tool)
│   ├── backend/              # Express REST API on port 4001
│   │   ├── src/
│   │   │   ├── index.ts      # Express app bootstrap
│   │   │   ├── config.ts     # EDITOR_PORT, DATABASE_URL, JWT_SECRET
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts   # JWT + is_admin check
│   │   │   └── routes/
│   │   │       ├── maps.ts   # CRUD endpoints
│   │   │       ├── nodes.ts
│   │   │       ├── edges.ts
│   │   │       ├── buildings.ts
│   │   │       └── upload.ts # Image upload via multer
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/             # Vite + TypeScript editor UI
│       ├── src/
│       │   ├── main.ts       # Entry point
│       │   ├── editor/
│       │   │   ├── canvas.ts # Canvas rendering + interaction
│       │   │   ├── modes.ts  # Node/Edge/Building/Select/Delete modes
│       │   │   ├── graph.ts  # In-memory graph + BFS validation
│       │   │   └── api.ts    # REST client
│       │   └── ui/
│       │       ├── toolbar.ts
│       │       ├── properties.ts  # Building name, label position
│       │       └── map-list.ts    # Map selection/creation
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── backend/                  # EXISTING — modified
│   ├── src/
│   │   ├── game/world/
│   │   │   ├── city-map-loader.ts    # NEW — load city maps from DB
│   │   │   ├── city-movement-handler.ts # NEW — city.move handler
│   │   │   └── movement-handler.ts   # MODIFIED — delegate to city handler
│   │   ├── websocket/
│   │   │   └── handlers/
│   │   │       └── world-state-handler.ts # MODIFIED — include city_map data
│   │   └── db/
│   │       └── migrations/
│   │           └── 008_city_maps.sql  # NEW migration
│   └── assets/maps/images/           # NEW — uploaded PNG storage
├── frontend/                 # EXISTING — modified
│   └── src/scenes/
│       ├── GameScene.ts              # MODIFIED — city map rendering
│       └── CityMapScene.ts           # NEW — or integrated into GameScene
└── shared/protocol/
    └── index.ts              # MODIFIED — new message types
```

## Setup Steps

### 1. Apply migration

The new migration `008_city_maps.sql` runs automatically on backend startup (existing migration runner).

### 2. Set an admin account

After migration, manually flag an account as admin:

```sql
UPDATE accounts SET is_admin = true WHERE username = 'your_admin_name';
```

### 3. Seed Elarion city map

A seed script creates the initial Elarion city zone in `map_zones` with `map_type = 'city'`. The actual map content (nodes, paths, buildings) is created via the map editor.

### 4. Start admin backend

```bash
cd admin/backend
npm install
npm run dev   # starts Express on port 4001
```

### 5. Start admin frontend

```bash
cd admin/frontend
npm install
npm run dev   # starts Vite dev server on port 4002, proxies API to 4001
```

### 6. Create Elarion city map

1. Open `http://localhost:4002` in browser
2. Log in with admin JWT
3. Select the Elarion city zone
4. Upload a PNG background image
5. Place path nodes and connect them
6. Mark one node as spawn
7. Add buildings (building nodes and/or hotspots)
8. Save

### 7. Play

Players logging in will spawn at the Elarion city map and can navigate via click-to-move on paths.

## Environment Variables

| Variable       | Default      | Description                     |
| -------------- | ------------ | ------------------------------- |
| `EDITOR_PORT`  | `4001`       | Admin backend HTTP port         |
| `DATABASE_URL` | (required)   | Shared PostgreSQL connection    |
| `JWT_SECRET`   | (required)   | Shared with game backend        |

## Key Dependencies (new)

| Package   | Purpose                  | Used in          |
| --------- | ------------------------ | ---------------- |
| `express` | Admin HTTP server        | admin/backend    |
| `multer`  | File upload handling     | admin/backend    |
| `cors`    | Cross-origin for editor  | admin/backend    |
