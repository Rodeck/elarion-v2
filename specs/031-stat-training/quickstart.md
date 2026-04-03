# Quickstart: NPC Stat Training

**Branch**: `031-stat-training` | **Date**: 2026-04-02

## What This Feature Does

Adds a consumable-item-based stat training system. Players give items to specialized trainer NPCs for a chance to permanently increase a stat by 1 point. Success probability depends on item tier and character level.

## How It Integrates

### Existing Systems Touched

1. **NPC System** — `npcs` table gets a new `trainer_stat` column. `NpcDto` in shared protocol gets a new field. `BuildingPanel.ts` renders a new dialog option for NPCs with `trainer_stat` set.

2. **Inventory System** — Training consumes items from the player's inventory. Uses existing `removeItemQuantity` or equivalent inventory mutation.

3. **Stat Allocation System** — Training points share the same stat cap as manually allocated points (`10 * (level - 1)`). The derived stat recalculation uses the same formulas from `training-handler.ts`.

4. **Combat Stats** — After successful training, derived stats (max_hp, attack_power, defence, max_mana, crit_chance, crit_damage, dodge_chance) are recalculated using `computeCombatStats` or inline formulas matching the existing training handler.

### New Systems

1. **Stat Training Handler** — `backend/src/game/training/stat-training-handler.ts` — handles `stat-training.open` and `stat-training.attempt` WebSocket messages.

2. **Stat Training DB Queries** — `backend/src/db/queries/stat-training.ts` — queries `stat_training_items` table.

3. **Stat Training Modal** — `frontend/src/ui/StatTrainingModal.ts` — UI for selecting training items and viewing results.

4. **Admin Stat Training Routes** — `admin/backend/src/routes/stat-training.ts` — CRUD for training item mappings.

## Verification Steps

After implementation, verify the system works:

1. **DB Migration**: Run `034_stat_training.sql`. Verify table exists:
   ```sql
   SELECT * FROM stat_training_items;
   SELECT trainer_stat FROM npcs WHERE trainer_stat IS NOT NULL;
   ```

2. **Admin API**: Create a test training item mapping:
   ```bash
   curl -X POST http://localhost:4001/api/stat-training \
     -H "Content-Type: application/json" \
     -d '{"item_def_id": <id>, "stat_name": "strength", "tier": 1, "base_chance": 95, "decay_per_level": 3.0, "npc_id": <npc_id>}'
   ```

3. **In-Game**: Visit the trainer NPC with the training item in inventory. Click "Train Strength". Select the item. Verify item consumed, result shown, stat updated on success.

4. **Edge Cases**: Try training with stat at cap, in combat, without items, at level 1.

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/migrations/034_stat_training.sql` | DB schema |
| `backend/src/db/queries/stat-training.ts` | DB query functions |
| `backend/src/game/training/stat-training-handler.ts` | WebSocket handlers |
| `shared/protocol/index.ts` | Message type definitions |
| `frontend/src/ui/StatTrainingModal.ts` | Training UI modal |
| `frontend/src/ui/BuildingPanel.ts` | Dialog option addition |
| `frontend/src/scenes/GameScene.ts` | Modal + WS wiring |
| `admin/backend/src/routes/stat-training.ts` | Admin CRUD API |
| `scripts/game-data.js` | Query command for stat training data |
| `scripts/game-entities.js` | Create command for stat training items |
