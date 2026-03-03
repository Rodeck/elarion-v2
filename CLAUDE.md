# elarion-v2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-02

## Active Technologies
- TypeScript 5.x (frontend only — no backend changes) + Phaser 3.60.0, Vite 5.0.12, Google Fonts (Cinzel, Crimson Text, Rajdhani) (002-game-ui-overhaul)
- N/A — no persistence changes (002-game-ui-overhaul)

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
- 003-city-map-system: Added Express + multer (admin backend), HTML5 Canvas 2D (map editor). New admin/ directory for standalone map editor app.

- 002-game-ui-overhaul: Added TypeScript 5.x (frontend only — no backend changes) + Phaser 3.60.0, Vite 5.0.12, Google Fonts (Cinzel, Crimson Text, Rajdhani)

- 001-game-design: Added TypeScript 5.x — used on both frontend and backend.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
