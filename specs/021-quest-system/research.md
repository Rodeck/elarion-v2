# Research: Quest System

**Feature**: 021-quest-system | **Date**: 2026-03-24

## R1: Daily/Weekly/Monthly Reset Mechanism

**Decision**: Period-key column on `character_quests` table (query-time availability check)

**Rationale**: The reset_period_key approach computes quest availability at query time rather than requiring a background job. When a player asks for available quests from an NPC, the server checks if a completed/active `character_quests` row exists for the current period key. If not, the quest is available. This means:
- Daily key = `'2026-03-24'` (ISO date)
- Weekly key = `'2026-W13'` (ISO week)
- Monthly key = `'2026-03'` (year-month)
- One-time (main/side) key = `NULL` (UNIQUE constraint allows only one row)
- Repeatable key = ISO timestamp (always generates a fresh key)

**Alternatives considered**:
- **Cron job to reset rows**: Requires a background scheduler, adds operational complexity, can fail silently. Rejected because query-time check is simpler and equally correct.
- **TTL-based expiry**: Would require Redis or similar. Rejected for adding infrastructure dependency without benefit.

## R2: Quest Objective Tracking Architecture

**Decision**: Event-based hook system — a `QuestTracker` singleton with methods called from existing handlers after their core logic.

**Rationale**: The tracker exposes typed methods (`onMonsterKilled`, `onItemCrafted`, etc.) that existing game handlers call after completing their primary action. Each method queries active quests with matching objective types, updates progress in the DB, and returns progress payloads for the caller to send to the client. This design:
- Requires minimal changes to existing handlers (one function call each)
- Keeps quest logic centralized in `quest-tracker.ts`
- Produces immediate client updates (no polling)
- Is testable in isolation

**Alternatives considered**:
- **EventEmitter pattern**: More decoupled but harder to trace, adds async complexity, and quest progress updates need to be sent through the same WebSocket session. Rejected for added complexity without clear benefit.
- **Database triggers**: Would hide business logic in SQL and make the system harder to debug. Rejected per constitution Principle III (simplicity).
- **Polling/timer-based check**: Would add latency and unnecessary DB load. Rejected.

## R3: collect_item Objective Behavior

**Decision**: Check actual inventory count on each `onInventoryChanged` event, rather than tracking increments.

**Rationale**: Standard RPG behavior — if a player needs 5 Iron Ore and has 5, then drops 2, progress should show 3/5. This requires re-querying the inventory each time it changes, but:
- The inventory query is already optimized (max 20 slots per character)
- Prevents false completions from items consumed/sold/dropped
- Matches player expectations from other RPGs

**Alternatives considered**:
- **Increment-only tracking** (like kill_monster): Simpler but would allow exploits (collect 5, turn in, the 5 were already consumed). Rejected for game integrity.

## R4: Admin UI Quest Editor Architecture

**Decision**: New `QuestManager` class following existing Manager pattern with dynamic form builders for objectives/prerequisites/rewards.

**Rationale**: The admin UI uses a consistent pattern across all entity managers (ItemManager, MonsterManager, RecipeManager, etc.). Following this pattern means:
- Consistent UX for game designers
- Proven architecture (lazy-init, two-column layout, CRUD operations)
- RecipeManager's ingredient rows pattern directly applicable to dynamic objective/prerequisite/reward rows

**Alternatives considered**:
- **Visual node-based editor** (like UE4 Blueprints): Far more complex to build, overkill for quest definition which is fundamentally form-based data. Rejected per YAGNI.
- **JSON editor**: Power-user friendly but terrible UX for game designers. Rejected.

## R5: AI Agent Quest Catalog

**Decision**: Static JSON endpoint at `GET /api/quests/catalog` that returns a self-documenting schema of all quest building blocks.

**Rationale**: AI agents need structured documentation of all available objective types, prerequisite types, reward types, and their parameters to create valid quests. A JSON endpoint:
- Is always up-to-date (generated from the same type definitions)
- Can be fetched programmatically
- Includes parameter descriptions, examples, and API endpoint references
- Serves as both human docs and machine-readable spec

**Alternatives considered**:
- **OpenAPI/Swagger spec**: More formal but adds a dependency and the admin API doesn't currently use OpenAPI. Rejected for consistency.
- **Markdown docs only**: Not machine-parseable for AI agents. Rejected.

## R6: Quest Log Limit

**Decision**: 25 active quests per player, enforced server-side.

**Rationale**: 25 is generous enough for players to have daily/weekly/monthly quests alongside main/side quests, but bounded enough to prevent abuse and keep the UI manageable. This is a runtime check in the quest accept handler, not a DB constraint.

**Alternatives considered**:
- **Unlimited**: Could lead to performance issues with many active quests being checked on every game event. Rejected.
- **10 quests**: Too restrictive when daily+weekly+monthly alone could fill 6-9 slots. Rejected.

## R7: Chain Quest Implementation

**Decision**: Use the existing `completed_quest` prerequisite type combined with `chain_id` + `chain_step` columns for admin UI grouping.

**Rationale**: Chain quests are a natural consequence of the prerequisite system — no special mechanics needed. The `chain_id` (string) and `chain_step` (integer) columns are purely for admin UI display (grouping related quests visually). The actual sequencing enforcement comes from `completed_quest` prerequisites. This keeps the runtime system simple while giving designers visual organization tools.

**Alternatives considered**:
- **Separate chain_quests junction table**: More complex schema for the same behavior. Rejected.
- **Ordered array in quest definition**: Would couple quests tightly and make reordering harder. Rejected.

## R8: Existing System Integration Points

**Decision**: 8 hook points in existing handlers, each adding one async function call.

Verified integration points in the codebase:

| Hook | Existing File | Integration Location |
|------|--------------|---------------------|
| `onMonsterKilled` | `backend/src/game/combat/combat-session.ts` | After combat win + XP award |
| `onItemCrafted` | `backend/src/game/crafting/crafting-handler.ts` | After `handleCraftingCollect` grants items |
| `onGatheringCompleted` | `backend/src/game/gathering/gathering-handler.ts` | After gathering session ends successfully |
| `onInventoryChanged` | `backend/src/game/inventory/inventory-grant-service.ts` | After `grantItemToCharacter` |
| `onLevelUp` | `backend/src/game/progression/xp-service.ts` | After level calculation detects level-up |
| `onCrownsSpent` | `backend/src/game/currency/crown-service.ts` | After `deductCrowns` |
| `onLocationVisited` | `backend/src/game/world/city-movement-handler.ts` | After zone/building arrival |
| `onNpcTalkedTo` | `backend/src/game/quest/quest-handler.ts` | Inside `handleQuestListAvailable` |

Each hook adds ~3 lines: import, call tracker method, send any progress messages. Minimal disruption to existing code.
