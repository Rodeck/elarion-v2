# Research: Arena System

**Branch**: `029-arena-system` | **Date**: 2026-04-01

## Decision 1: PvP Combat Engine Approach

**Decision**: Reuse existing combat engine functions with a symmetric PvP wrapper — not a new engine.

**Rationale**: The combat engine (`combat-engine.ts`) is fully pure/functional. All key functions (`computePlayerAttack`, `computeEnemyTurn`, `computeAutoAbilities`, `computeActiveAbility`) accept explicit stat parameters. For PvP, each turn calls:
1. `computePlayerAttack(playerAStats, playerBDodge, playerBDefence, stateA)` — A attacks B
2. `computeAutoAbilities(playerASlots, playerAStats, playerBDefence, stateA)` — A's auto-abilities
3. Same pair for B attacking A using `stateB`
4. Active window for both simultaneously
5. Effect ticking for both states

The only adaptation needed is:
- Two `EngineState` objects per fight (one per player perspective)
- Event remapping: each player sees their own events as `source: 'player'` and opponent's as `source: 'enemy'`
- DoT ticking needs the attacker's stats passed in (currently uses single `playerStats`)

**Alternatives considered**:
- **New PvP engine**: Rejected — duplicates logic, increases maintenance, and the existing engine is already parameterized correctly
- **Modify existing engine for dual-mode**: Rejected — violates the constraint of not modifying core combat engine

## Decision 2: Arena State Management

**Decision**: In-memory state manager (`Map<arenaId, ArenaState>`) with DB persistence for crash recovery.

**Rationale**: Follows the boss instance pattern. `arena_participants` table provides crash recovery. In-memory state provides low-latency lookups for combat validation and lobby broadcasts. The `arena_participants.current_hp` column is updated after each fight, and a `pre_fight_hp` column stores HP before combat starts (for crash recovery — restore to pre-fight HP if a fight was in progress).

**Alternatives considered**:
- **DB-only state**: Rejected — too many queries per turn for real-time combat validation
- **Redis**: Rejected per constitution (deferred until measured need)

## Decision 3: Map Visibility Filtering

**Decision**: Remove arena players from zone registry on arena entry; re-add on exit.

**Rationale**: The zone registry (`zone-registry.ts`) is a `Map<zoneId, Map<characterId, PlayerState>>`. On arena entry: call `removePlayer(zoneId, characterId)` + broadcast `player.left_zone`. On arena exit: call `addPlayer(zoneId, playerState)` + broadcast `player.entered_zone`. This reuses existing zone broadcast primitives with zero changes to the registry code itself.

**Alternatives considered**:
- **Filter at broadcast time**: Rejected — requires modifying every broadcast call site; error-prone
- **Add `arenaId` field to `PlayerState`**: Rejected — unnecessary; simply removing/re-adding is cleaner and uses existing primitives

## Decision 4: PvP Turn Timing Model

**Decision**: Simultaneous turns with shared active window, following boss combat timer pattern.

**Rationale**: Each PvP turn:
1. Both players' auto-attacks and auto-abilities resolve simultaneously (server computes both sides)
2. `arena:combat_active_window` sent to BOTH players (3s window, same as boss combat `TURN_TIMER_MS`)
3. Both players can send `arena:combat_trigger_active` during the window
4. After window closes (or both players have acted), effects tick and enemy turns resolve
5. `arena:combat_turn_result` sent to both players with their respective perspective
6. Next turn after `ENEMY_TURN_DELAY_MS` (2s)

The timer constants match existing combat timing. The boss combat handler's `setTimeout` pattern is directly reusable.

**Alternatives considered**:
- **Alternating turns (A attacks, then B attacks)**: Rejected — feels slow for PvP; simultaneous is more engaging
- **Real-time (no turns)**: Rejected — fundamentally incompatible with existing engine architecture

## Decision 5: Global vs Per-Arena Cooldown Storage

**Decision**: Store cooldown on the `characters` table as `arena_cooldown_until TIMESTAMPTZ`.

**Rationale**: Cooldown is global (blocks ALL arenas), so it belongs on the character, not on a per-arena-participant record (which is deleted on exit). A single column on `characters` is checked on arena entry. Set on kick/leave, cleared when expired (or simply compared against `NOW()`).

**Alternatives considered**:
- **Separate cooldown table**: Rejected — one column is simpler; YAGNI
- **In-memory only**: Rejected — doesn't survive server restart

## Decision 6: WebSocket Handler Registration

**Decision**: Export `registerArenaHandlers()` from arena handler module, called once in `bootstrap()`.

**Rationale**: Follows the grouped handler pattern used by crafting, fishing, and marketplace. Cleaner than individual `registerHandler()` calls in index.ts. Add arena message schemas to `validator.ts` for payload validation (unlike boss combat which skips validation).

## Decision 7: Admin Arena Management

**Decision**: New admin routes at `/api/arenas` following the boss admin pattern.

**Rationale**: `admin/backend/src/routes/bosses.ts` provides the exact template: CRUD + sub-resource management (abilities/loot → monsters for arena) + instance management (force-respawn → force-kick for arena). The admin frontend follows `admin/frontend/src/ui/boss-manager.ts` as the UI template.

## Decision 8: Token Consumption Pattern

**Decision**: Reuse the exact boss challenge token pattern from `boss-combat-handler.ts`.

**Rationale**: The pattern is proven: find token slot by name → verify quantity >= 1 → perform arena validation → consume token (delete if qty=1, decrement otherwise) → push inventory update. Same DB functions (`getInventoryWithDefinitions`, `deleteInventoryItem`, `updateInventoryQuantity`). Token consumption happens AFTER arena combat validation succeeds (so tokens aren't wasted on rejected challenges).
