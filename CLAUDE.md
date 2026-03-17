# elarion-v2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-02

## Active Technologies
- TypeScript 5.x (frontend only — no backend changes) + Phaser 3.60.0, Vite 5.0.12, Google Fonts (Cinzel, Crimson Text, Rajdhani) (002-game-ui-overhaul)
- N/A — no persistence changes (002-game-ui-overhaul)
- TypeScript 5.x (frontend only — no backend changes) + Phaser 3.60.0 (game framework, texture loading, game objects, update loop), Vite 5.0.12 (static asset serving from `public/`) (004-sprite-animation)
- N/A — sprite assets are static files served from Vite's `public/` directory; no database changes (004-sprite-animation)
- TypeScript 5.x — frontend (Phaser 3, Vite) and backend (Node.js 20 LTS) + `jose` (JWT, backend), Phaser 3.60.0, `ws` library (WebSocket server) (005-session-persistence)
- `localStorage` (browser, client-side session token only); PostgreSQL 16 for all game data (005-session-persistence)
- TypeScript 5.x (frontend, backend, admin) + Phaser 3.60.0 (game frontend), Node.js 20 LTS + `ws` (backend), Express 4 (admin backend), Vite 5 (both frontends) (006-building-actions)
- PostgreSQL 16 — new `building_actions` table; `buildings` table extended with `description TEXT` (006-building-actions)
- TypeScript 5.x (frontend, backend, admin — all packages) + Phaser 3.60.0 (game frontend), Node.js 20 LTS + `ws` (game backend), Express 4 + `multer` (admin backend), Vite 5 (both frontends) (007-item-inventory)
- PostgreSQL 16 — two new tables (`item_definitions`, `inventory_items`) replacing legacy `items`/`character_items` via migration 010 (007-item-inventory)
- TypeScript 5.x (all packages — frontend, backend, shared, admin) (008-monster-combat)
- PostgreSQL 16 — new `monsters` + `monster_loot` tables; `building_actions` extended; old combat tables dropped (008-monster-combat)
- TypeScript 5.x (all packages) + Phaser 3.60 (frontend), Node.js 20 LTS + ws (backend), Express 4 (admin backend), Vite 5 (frontends) (009-squire-expeditions)
- PostgreSQL 16 — two new tables (`squires`, `squire_expeditions`), extended `building_actions` CHECK constraint (009-squire-expeditions)
- TypeScript 5.x — admin backend (Node.js 20 LTS + Express 4), admin frontend (Vite 5, vanilla TS) + Express 4, `pg` (PostgreSQL client), `node-fetch` or native `fetch` (Node 18+) for OpenRouter HTTP calls; no new npm packages required (010-ai-image-gen)
- PostgreSQL 16 (2 new tables); filesystem (same `backend/assets/` directories as existing icons) (010-ai-image-gen)
- TypeScript 5.x (frontend + backend + shared) + Phaser 3.60 (frontend game canvas), `ws` library (WebSocket), `pg` (PostgreSQL client), Vite 5 (frontend build) (011-equipment-system)
- PostgreSQL 16 — schema change via migration 014 (new column + category extension) (011-equipment-system)
- TypeScript 5.x (frontend + backend + shared) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), `pg` (PostgreSQL client), `jose` (JWT) (012-admin-commands)
- PostgreSQL 16 — no new tables; `accounts.is_admin` column already present (012-admin-commands)
- TypeScript 5.x (frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client) (013-day-night-cycle)
- PostgreSQL 16 — one new table (`map_random_encounter_tables`); no schema changes to existing tables (013-day-night-cycle)
- TypeScript 5.x (frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (game backend), Phaser 3.60 + Vite 5 (game frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client) (014-npc-system)
- PostgreSQL 16 — two new tables (`npcs`, `building_npcs`); filesystem for NPC icon PNGs under `backend/assets/npcs/icons/` (014-npc-system)
- TypeScript 5.x (all packages: frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client) (015-currency-system)
- PostgreSQL 16 — two new columns on existing tables (`characters.crowns`, `monsters.min_crowns`, `monsters.max_crowns`); migration file `017_currency.sql` (015-currency-system)
- TypeScript 5.x (frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client), `jose` (JWT) (016-combat-system)
- PostgreSQL 16 — migration `018_combat_system.sql`; in-memory `Map<characterId, CombatSession>` for active sessions (016-combat-system)
- PostgreSQL 16 — new tables `crafting_recipes`, `recipe_ingredients`, `crafting_sessions`; `npcs` table extended with `is_crafter BOOLEAN` (017-crafting-system)

- TypeScript 5.x — used on both frontend and backend. (001-game-design)

- TypeScript 5.x + Express + multer (admin backend), HTML5 Canvas 2D (map editor), PostgreSQL 16 (003-city-map-system)

## Project Structure

```text
backend/
frontend/
shared/
admin/
  backend/   # Express REST API for map editor (port 4001)
  frontend/  # Vite + Canvas 2D map editor UI
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x — used on both frontend and backend.: Follow standard conventions

## Recent Changes
- 017-crafting-system: Added TypeScript 5.x (frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client)
- 016-combat-system: Added TypeScript 5.x (frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 + `multer` (admin backend), `pg` (PostgreSQL client), `jose` (JWT)
- 015-currency-system: Added TypeScript 5.x (all packages: frontend, backend, shared, admin) + Node.js 20 LTS + `ws` (backend), Phaser 3.60 + Vite 5 (frontend), Express 4 (admin backend), `pg` (PostgreSQL client)



<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
