# Boss Encounter System — Research

## Combat System Integration

### Decision: Extend existing CombatSession vs. create separate BossCombatSession
- **Decision**: Create a separate `BossCombatHandler` that reuses `CombatEngine` but wraps its own session lifecycle
- **Rationale**: The boss combat flow has too many differences from regular combat to fit cleanly as a flag on CombatSession: persistent HP across fights, hidden HP in payloads, boss ability execution, token consumption, instance locking. A separate handler keeps both paths clean.
- **Alternatives considered**:
  - Adding `variant: 'normal' | 'boss'` to CombatSession — rejected because it would pollute the session with conditionals everywhere (HP visibility, loot, end behavior)
  - Subclassing CombatSession — rejected because TS class inheritance gets messy with the tight coupling to WS message sending
- **Shared code**: Both regular and boss combat use `CombatEngine` for turn resolution (attack calculation, ability effects, dodge/crit). The engine is stateless — it operates on an `EngineState` object. Boss handler creates its own engine state with boss stats.

### Decision: Boss abilities execution model
- **Decision**: Bosses have unlimited mana; abilities gated by cooldowns only
- **Rationale**: Boss mana management adds complexity with no player-facing value (players can't see boss mana). Cooldowns alone create the rhythm of "boss uses ability every N turns" which is sufficient for tactical variety.
- **Alternatives considered**: Fixed mana pool with regen — rejected per YAGNI, adds UI/logic complexity for invisible resource

### Decision: HP bracket system
- **Decision**: 5 brackets — full (>80%), high (60-80%), medium (40-60%), low (20-40%), critical (<20%)
- **Rationale**: 5 brackets give enough granularity for "how much more do I need to hit" without revealing exact numbers. Maps cleanly to visual indicators (5-segment bar with color coding).
- **Alternatives considered**: 3 brackets (too coarse, "medium" covers 34-66%), percentage ranges (too precise, defeats purpose)

## Boss Instance Lifecycle

### Decision: In-memory manager with DB persistence
- **Decision**: `BossInstanceManager` holds live state in a `Map<number, BossInstance>` loaded from DB on startup. HP persisted to DB after each combat turn. Respawn checks via `setInterval`.
- **Rationale**: In-memory map for fast reads (boss blocking checks happen on every building action). DB persistence for crash recovery. Matches existing patterns (combat sessions are in-memory, character state persisted).
- **Alternatives considered**: Pure DB with queries on every check — rejected for latency on the hot path (building action checks)

### Decision: Respawn timer implementation
- **Decision**: Pre-calculate `respawn_at` timestamp on defeat, check via 30-second interval timer
- **Rationale**: Simpler than `setTimeout` per boss (timers don't survive restart). 30-second granularity is acceptable — players see "respawns in ~X:XX" which doesn't need second-precision. On startup, check all defeated instances against current time.
- **Alternatives considered**: Per-boss `setTimeout` — rejected (lost on restart, memory overhead with many bosses)

## Building Action Blocking

### Decision: Single guard check at top of building-action-handler
- **Decision**: Add `isBossBlocking(buildingId)` check in `handleBuildingAction()` after action validation, before type-specific branching. Returns a rejection message if blocked.
- **Rationale**: All building actions (explore, gather, expedition, marketplace, fishing) must be blocked uniformly. A single check point prevents missed coverage.
- **Alternatives considered**: Per-action-type checks — rejected (7 places to update vs 1, easy to miss one)

## Database Design

### Decision: Separate `bosses` table (not reusing `monsters`)
- **Decision**: New `bosses` table with its own ID space, plus `boss_abilities`, `boss_loot`, `boss_instances`
- **Rationale**: Bosses differ fundamentally from monsters:
  - Monsters are templates used in encounter pools (no persistent state). Bosses have persistent live instances.
  - Monsters don't have ability loadouts. Bosses do.
  - Monsters don't have building assignments or respawn timers.
  - Mixing boss rows into `monsters` would require nullable columns for all boss-specific fields, polluting the schema.
- **Alternatives considered**: Adding `is_boss` flag to monsters + `monster_instances` table — rejected because it couples two very different lifecycles

### Decision: `boss_instances` tracks live state
- **Decision**: One row per active boss instance. Created on spawn, updated during combat, tracks defeat/respawn timestamps.
- **Rationale**: Provides crash recovery (reload state from DB on startup) and admin visibility (query current instance states). Also enables future analytics (total attempts per instance, average kills).

## Admin Panel

### Decision: Follow existing entity management patterns
- **Decision**: Express REST routes in `admin/backend/src/routes/bosses.ts`, vanilla TS UI in `admin/frontend/src/ui/boss-manager.ts`
- **Rationale**: Matches existing patterns for monsters, NPCs, quests. No reason to deviate.
- **File upload**: Same multer + PNG validation pattern as monster icons.

## Frontend Display

### Decision: Boss sprite as Phaser sprite at building position
- **Decision**: Render boss as a sprite image (loaded from uploaded sprite file) at the building's node position with a slight offset. Click opens BossInfoPanel.
- **Rationale**: Consistent with how building hotspots and NPCs are rendered. Sprite gives visual presence without complex animation.
- **Alternatives considered**: AnimatedSprite with idle animation — deferred to future enhancement, static sprite with pulsing glow effect is sufficient for v1.

### Decision: Boss combat UI as CombatScreen variant
- **Decision**: Modify existing `CombatScreen.ts` to accept a `variant` parameter. When `variant === 'boss'`, hide exact HP numbers and show bracket indicator instead.
- **Rationale**: Reusing CombatScreen avoids duplicating the entire combat UI. The differences are cosmetic (HP display, boss name styling) not structural.

## Tooling Updates (Constitution Gate 7)

### Changes needed
1. **`scripts/game-data.js`**: Add `bosses` command (list all definitions + stats) and `boss-instances` command (list live instances with state)
2. **`scripts/game-entities.js`**: Add `create-boss`, `create-boss-loot`, `assign-boss-ability`, `upload-boss-icon`, `upload-boss-sprite` commands
3. **`CLAUDE.md`**: Add "Adding a Boss" checklist section
4. **`gd.design.md`**: Boss entities can reference the admin boss panel for creation (already handled — bosses are admin-panel-created, not script-created in the standard entity flow)
