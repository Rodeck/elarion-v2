# Quickstart: Character Rankings

**Feature**: 026-character-rankings | **Date**: 2026-03-27

## What This Feature Does

Adds a character rankings system to the game. Players click a "Rankings" button in the top bar to view leaderboards across five categories: Top Level, Top Fighters, Top Crafters, Top Questers, and Map Population. Rankings are calculated every 5 minutes and cached in-memory.

## Key Files to Touch

### Database
- `backend/src/db/migrations/028_character_rankings.sql` — Add `combat_wins` column to `characters`

### Backend
- `backend/src/game/combat/combat-session.ts` — Increment `combat_wins` on victory (after line 355, inside `endCombat('win')`)
- `backend/src/game/rankings/rankings-service.ts` — **NEW** — Periodic computation, in-memory cache, player rank lookups
- `backend/src/game/rankings/rankings-handler.ts` — **NEW** — WebSocket handler for `rankings.get` → responds with `rankings.data`
- `backend/src/websocket/dispatcher.ts` — Register `rankings.get` handler

### Shared Protocol
- `shared/protocol/index.ts` — Add `RankingsDataPayload`, `LeaderboardEntryDto`, `MapPopulationDto` interfaces

### Frontend
- `frontend/src/ui/RankingsPanel.ts` — **NEW** — Panel UI with tabs, leaderboard rendering, toggle visibility
- `frontend/src/scenes/GameScene.ts` — Create rankings button in top bar, wire panel, register `rankings.data` handler

## Architecture Overview

```
Player clicks "Rankings" button
  → RankingsPanel.toggle() / show()
  → Client sends WS 'rankings.get' {}
  → Server handler reads in-memory cache
  → Server computes player's own rank per category
  → Server responds 'rankings.data' { snapshot + my_ranks }
  → RankingsPanel renders leaderboards with highlighted player entry

Background: setInterval every 5 min
  → rankings-service runs 5 SQL queries
  → Updates in-memory RankingSnapshot object
  → No DB writes (read-only aggregation)
```

## Constitution Compliance Notes

- **Principle I** (WebSocket): Rankings delivered via WS, not REST ✓
- **Principle II** (Server-authoritative): Rankings computed server-side from DB, client is display-only ✓
- **Principle III** (Simplicity): Single column addition, in-memory cache, no new tables for snapshots ✓
- **Principle IV** (Observability): Log ranking computation timing and errors ✓
- **Principle V** (Independent deploy): New WS message types documented in contracts/ ✓
- **Principle VI** (Tooling): No new entity types or admin-creatable content — tooling updates not required ✓
