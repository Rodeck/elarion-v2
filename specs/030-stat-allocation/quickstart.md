# Quickstart: Character Stat Allocation System

**Feature**: 030-stat-allocation | **Branch**: `030-stat-allocation`

## Prerequisites

- PostgreSQL 16 running with the Elarion database
- Node.js 20 LTS
- All previous migrations applied (up to 032)

## Setup

1. **Checkout the branch**:
   ```bash
   git checkout 030-stat-allocation
   ```

2. **Run migration**:
   ```bash
   # The migration runner auto-applies pending migrations on backend start
   cd backend && npm run dev
   ```

3. **Create a Trainer NPC** (via admin panel or direct SQL):
   ```sql
   -- Option A: Flag an existing NPC as trainer
   UPDATE npcs SET is_trainer = true WHERE name = 'Master Aldric';
   
   -- Option B: Verify via admin panel at http://localhost:4001
   -- NPC Manager → Select NPC → Check "Trainer" checkbox
   ```

4. **Assign Trainer NPC to a building** (if not already assigned):
   ```sql
   INSERT INTO building_npcs (building_id, npc_id, sort_order)
   VALUES (1, (SELECT id FROM npcs WHERE is_trainer = true LIMIT 1), 1)
   ON CONFLICT DO NOTHING;
   ```

## Testing the Feature

### 1. Verify Migration
```sql
-- Check existing characters were reset
SELECT c.name, c.level, c.max_hp, c.attack_power, c.defence, 
       c.stat_points_unspent, c.attr_constitution, c.attr_strength
FROM characters c
JOIN character_classes cc ON c.class_id = cc.id;

-- Verify: max_hp = cc.base_hp, attack_power = cc.base_attack, 
--         stat_points_unspent = 7 × (level - 1), all attrs = 0
```

### 2. Test Level-Up
- Play the game, defeat monsters to earn XP
- On level-up: verify no HP/ATK/DEF change, chat message shows "+7 stat points"
- Check StatsBar for unspent points badge

### 3. Test Stat Allocation
- Visit building with Trainer NPC
- Click NPC → "I want to train"
- Allocate points in the modal
- Confirm → verify stats update in StatsBar
- Enter combat → verify new stats are used

### 4. Test Edge Cases
- Try allocating more points than available (should be prevented)
- Try exceeding per-stat cap (should be prevented)
- Try allocating while in combat (should fail)
- Level up with unspent points (should accumulate)

## Key Files

| Purpose | File |
|---------|------|
| Migration | `backend/src/db/migrations/033_stat_allocation.sql` |
| Training handler | `backend/src/game/training/training-handler.ts` |
| Level-up changes | `backend/src/game/progression/level-up-service.ts` |
| Combat stats | `backend/src/game/combat/combat-stats-service.ts` |
| Protocol types | `shared/protocol/index.ts` |
| Training modal | `frontend/src/ui/TrainingModal.ts` |
| StatsBar badge | `frontend/src/ui/StatsBar.ts` |
| Building panel | `frontend/src/ui/BuildingPanel.ts` |
