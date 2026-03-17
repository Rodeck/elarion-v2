# Research: Crafting System

**Feature**: 017-crafting-system | **Date**: 2026-03-17

## R-001: Crafting Progress Persistence Model

**Decision**: Wall-clock time model with `started_at` timestamp and `total_duration_seconds` column. Progress = `min(1.0, elapsed / total_duration)`.

**Rationale**: Simplest possible model — no background timers, no cron jobs, no tick loops. Progress is computed on-demand from `now() - started_at`. Server downtime automatically counts as elapsed time (per spec requirement). Zero state to maintain between restarts.

**Alternatives considered**:
- **Tick-based accumulator** (store `seconds_completed`, increment periodically): Rejected — requires background timer, loses progress on crash, more complex state management.
- **Pause-on-shutdown** (store `paused_at`, resume on startup): Rejected — spec explicitly states downtime counts toward progress. Would require shutdown hooks and startup reconciliation.

## R-002: NPC Crafting Designation

**Decision**: Add `is_crafter BOOLEAN NOT NULL DEFAULT false` column to existing `npcs` table. Recipes reference NPC via `npc_id` foreign key.

**Rationale**: Minimal schema change. Boolean flag is sufficient — a crafting NPC is simply one with `is_crafter = true` and at least one recipe. No need for a separate NPC type system.

**Alternatives considered**:
- **NPC type enum**: Rejected — over-engineering for a single boolean distinction. YAGNI.
- **Implicit detection** (NPC is crafter if it has recipes): Rejected — admin needs explicit control to enable/disable crafting without deleting recipes.

## R-003: Recipe-NPC Relationship

**Decision**: Each recipe belongs to exactly one NPC via `npc_id` foreign key on `crafting_recipes`. One NPC can have many recipes.

**Rationale**: Matches the spec's model where recipes are "available at that NPC." Simple one-to-many relationship. If a recipe needs to be available at multiple NPCs in the future, it can be duplicated or the model can be extended.

**Alternatives considered**:
- **Many-to-many join table** (recipe_npcs): Rejected — spec describes recipes as NPC-specific. YAGNI.

## R-004: Material Deduction Strategy

**Decision**: Atomic transaction — deduct all materials and crowns in a single database transaction. If any deduction fails (insufficient quantity), the entire transaction rolls back.

**Rationale**: Prevents partial deduction states. Uses PostgreSQL transaction guarantees. Materials are deducted from `inventory_items` rows; crowns from `characters.crowns` column.

**Alternatives considered**:
- **Optimistic check + deduct**: Rejected — race condition between check and deduct in concurrent requests.
- **SELECT FOR UPDATE**: Valid but unnecessary complexity if the UPDATE itself uses WHERE quantity >= required.

## R-005: Cancellation Refund Calculation

**Decision**: Refund = `floor(original_quantity * 0.5)` for each ingredient; `floor(original_crowns * 0.5)` for crowns. Store original costs in `crafting_sessions` table to enable accurate refund calculation regardless of recipe changes.

**Rationale**: Spec states "50% of resources, regardless of time left." Storing original costs decouples refund from current recipe state (recipe may have been edited since crafting started).

**Alternatives considered**:
- **Recalculate from recipe**: Rejected — recipe might change between start and cancel. Storing original costs is safer.

## R-006: Crown Deduction Function

**Decision**: Add `deductCrowns(characterId, amount)` to `backend/src/db/queries/characters.ts`. Uses `UPDATE ... SET crowns = crowns - $2 WHERE id = $1 AND crowns >= $2 RETURNING crowns`. Returns `null` if insufficient balance (no rows updated).

**Rationale**: Atomic check-and-deduct in single SQL statement. Existing `addCrowns` only handles positive amounts. Need a safe deduction that won't go negative.

## R-007: Crafting Session Data Storage

**Decision**: Store in `crafting_sessions` table with columns: id, character_id, recipe_id, npc_id, quantity, started_at, total_duration_seconds, cost_crowns, status (enum: 'in_progress', 'completed', 'collected', 'cancelled'). Store ingredient costs in `crafting_session_costs` join table (session_id, item_def_id, quantity_spent).

**Rationale**: Full audit trail of what was spent. Enables accurate 50% refund. Status enum tracks lifecycle. `npc_id` stored for validation (player must be at the right NPC to interact).

**Alternatives considered**:
- **Store costs as JSON blob**: Rejected — harder to query, validate, and join.
- **No cost tracking** (recalculate from recipe): Rejected — recipe may change after crafting starts.

## R-008: Frontend Crafting UI Approach

**Decision**: HTML overlay modal (CraftingModal class) following the CombatModal pattern. Fixed-position overlay with z-index 200+, dark backdrop, centered modal panel.

**Rationale**: Consistent with existing UI patterns. CombatModal already proves this pattern works. Crafting modal is more complex (recipe list, ingredient display, quantity selection, progress bars) but the container pattern is identical.

**Alternatives considered**:
- **Render inside BuildingPanel**: Rejected — BuildingPanel body area is too narrow for recipe details + ingredient lists + progress bars. Modal gives more space.
- **Phaser scene**: Rejected — all game UI is HTML-based. Phaser is for the game canvas only.

## R-009: Dialog Option Integration

**Decision**: Extend `BuildingPanel.renderNpcPanel()` to add "I want to craft some items" dialog option when NPC has `is_crafter: true` in the NPC DTO. Clicking opens CraftingModal.

**Rationale**: NPC dialog options are already rendered as clickable buttons in BuildingPanel. Adding one more conditional option is minimal code. The NPC DTO needs a new `is_crafter` boolean field.

## R-010: Admin /crafting_finish Command

**Decision**: Follow existing admin command pattern in `admin-command-handler.ts`. Parse `/crafting_finish <player_name>`, find all in-progress sessions for that character, update status to 'completed'. If player is online, send `crafting.sessions_updated` message.

**Rationale**: Exact same pattern as `/level_up`, `/item`, `/crown` commands. Resolve by character name, execute DB update, notify if online.
