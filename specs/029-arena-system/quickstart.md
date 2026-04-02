# Quickstart: Arena System

**Branch**: `029-arena-system` | **Date**: 2026-04-01

## What This Feature Does

Adds a PvP arena system where players can enter a dedicated building, fight other players and NPC fighters, with HP persisting between bouts. Losers are kicked, winners stay. Configurable rewards and timers managed by admins.

## Key Files to Read First

1. **Game design**: `game_design/arena-system/design.md` — Full design with entity definitions and testing walkthroughs
2. **Spec**: `specs/029-arena-system/spec.md` — Requirements, user stories, clarifications
3. **Data model**: `specs/029-arena-system/data-model.md` — DB tables, DTOs, state machines
4. **Protocol contract**: `specs/029-arena-system/contracts/arena-messages.md` — All WebSocket messages

## Implementation Order

### Phase 1: Foundation (DB + Shared Types + Admin)
1. **Migration** `031_arena_system.sql` — Create tables, alter characters, extend building_actions CHECK
2. **Shared protocol** `shared/protocol/index.ts` — Add all arena DTOs and payload types, extend `BuildingActionDto` union
3. **DB queries** `backend/src/db/queries/arenas.ts` — CRUD for arenas, participants, monster assignments
4. **Admin backend** `admin/backend/src/routes/arenas.ts` — REST CRUD for arena management
5. **Admin frontend** `admin/frontend/src/ui/arena-manager.ts` — Arena config UI

### Phase 2: Arena Entry/Exit (Building Action + Visibility)
6. **Building action type** — Follow CLAUDE.md 7-location checklist for `'arena'` type
7. **Arena state manager** `backend/src/game/arena/arena-state-manager.ts` — In-memory participant tracking
8. **Arena handler** `backend/src/game/arena/arena-handler.ts` — Enter/leave logic, cooldowns, visibility toggle
9. **Zone visibility** — Remove/re-add players from zone registry on arena enter/exit
10. **Frontend arena panel** `frontend/src/ui/ArenaPanel.ts` — Lobby UI with participant list, fighter list, timers

### Phase 3: Combat
11. **Arena combat handler** `backend/src/game/arena/arena-combat-handler.ts` — PvP symmetric combat + NPC combat
12. **PvP engine adapter** — Two EngineState objects, event remapping, simultaneous turns
13. **Token consumption** — Arena Challenge Token check + consume on NPC challenge
14. **Frontend combat integration** — Wire arena combat messages to existing CombatScreen
15. **Rewards + kick logic** — XP/crowns grant, loser kick, winner HP persist, combat_wins increment

### Phase 4: Polish + Tooling
16. **Message validation** `backend/src/websocket/validator.ts` — Add arena message schemas
17. **Structured logging** — Log all arena events (enter, leave, challenge, combat, kick)
18. **Tooling updates** — `game-data.js` (arenas command), `game-entities.js` (VALID_ACTION_TYPES), skill docs
19. **CLAUDE.md** — Update building action type values list

## Existing Code Patterns to Follow

| Pattern | Reference File | What to Copy |
|---------|---------------|-------------|
| In-memory combat sessions | `backend/src/game/boss/boss-combat-handler.ts` | `Map<string, Session>`, timer-driven turn loop |
| Token consumption | `backend/src/game/boss/boss-combat-handler.ts:119-151` | Find token → validate → consume → push inventory |
| Building action type | `CLAUDE.md` "Adding a New Building Action Type" | 7-location checklist |
| Admin CRUD routes | `admin/backend/src/routes/bosses.ts` | CRUD + sub-resource pattern |
| Handler registration | `backend/src/game/combat/combat-session-manager.ts` | `registerXxxHandlers()` factory |
| Zone player broadcast | `backend/src/game/world/zone-registry.ts` | `removePlayer()` / `addPlayer()` + broadcast |
| Combat stats computation | `backend/src/game/combat/combat-stats-service.ts` | `computeCombatStats(characterId)` |

## Testing

No automated tests (project pattern). Manual testing via the walkthroughs in `game_design/arena-system/design.md` — Tests 1-6 cover all user stories.

After code is deployed, run `/gd.execute` to create game entities (Arena Challenge Token, 6 fighters, NPC).
