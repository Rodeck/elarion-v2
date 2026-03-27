import { query } from '../connection';

// ---------------------------------------------------------------------------
// Fishing loot queries
// ---------------------------------------------------------------------------

export interface FishingLootEntry {
  id: number;
  min_rod_tier: number;
  item_def_id: number;
  drop_weight: number;
  item_name: string;
  item_category: string;
  icon_filename: string | null;
  stack_size: number | null;
}

export async function getFishingLootByTier(rodTier: number): Promise<FishingLootEntry[]> {
  const result = await query<FishingLootEntry>(
    `SELECT fl.id, fl.min_rod_tier, fl.item_def_id, fl.drop_weight,
            d.name AS item_name, d.category AS item_category,
            d.icon_filename, d.stack_size
     FROM fishing_loot fl
     JOIN item_definitions d ON d.id = fl.item_def_id
     WHERE fl.min_rod_tier <= $1
     ORDER BY fl.drop_weight DESC`,
    [rodTier],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Fishing rod tier queries
// ---------------------------------------------------------------------------

export interface FishingRodTier {
  tier: number;
  item_def_id: number;
  upgrade_points_cost: number;
  max_durability: number;
  repair_crown_cost: number;
}

export async function getRodTierByItemDefId(itemDefId: number): Promise<FishingRodTier | null> {
  const result = await query<FishingRodTier>(
    `SELECT tier, item_def_id, upgrade_points_cost, max_durability, repair_crown_cost
     FROM fishing_rod_tiers WHERE item_def_id = $1`,
    [itemDefId],
  );
  return result.rows[0] ?? null;
}

export async function getNextRodTier(currentTier: number): Promise<FishingRodTier | null> {
  const result = await query<FishingRodTier>(
    `SELECT tier, item_def_id, upgrade_points_cost, max_durability, repair_crown_cost
     FROM fishing_rod_tiers WHERE tier = $1`,
    [currentTier + 1],
  );
  return result.rows[0] ?? null;
}

export async function getAllRodTiers(): Promise<FishingRodTier[]> {
  const result = await query<FishingRodTier>(
    `SELECT tier, item_def_id, upgrade_points_cost, max_durability, repair_crown_cost
     FROM fishing_rod_tiers ORDER BY tier`,
    [],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Rod tier CRUD (admin)
// ---------------------------------------------------------------------------

export async function addRodTier(
  tier: number,
  itemDefId: number,
  upgradePointsCost: number,
  maxDurability: number,
  repairCrownCost: number,
): Promise<FishingRodTier> {
  const result = await query<FishingRodTier>(
    `INSERT INTO fishing_rod_tiers (tier, item_def_id, upgrade_points_cost, max_durability, repair_crown_cost)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tier, itemDefId, upgradePointsCost, maxDurability, repairCrownCost],
  );
  return result.rows[0]!;
}

export async function updateRodTier(
  tier: number,
  upgradePointsCost: number,
  maxDurability: number,
  repairCrownCost: number,
): Promise<void> {
  await query(
    `UPDATE fishing_rod_tiers
     SET upgrade_points_cost = $2, max_durability = $3, repair_crown_cost = $4
     WHERE tier = $1`,
    [tier, upgradePointsCost, maxDurability, repairCrownCost],
  );
}

export async function deleteRodTier(tier: number): Promise<void> {
  await query(`DELETE FROM fishing_rod_tiers WHERE tier = $1`, [tier]);
}

// ---------------------------------------------------------------------------
// Rod upgrade points
// ---------------------------------------------------------------------------

export async function getRodUpgradePoints(characterId: string): Promise<number> {
  const result = await query<{ rod_upgrade_points: number }>(
    `SELECT rod_upgrade_points FROM characters WHERE id = $1`,
    [characterId],
  );
  return result.rows[0]?.rod_upgrade_points ?? 0;
}

export async function updateRodUpgradePoints(characterId: string, delta: number): Promise<number> {
  const result = await query<{ rod_upgrade_points: number }>(
    `UPDATE characters
     SET rod_upgrade_points = rod_upgrade_points + $2
     WHERE id = $1
     RETURNING rod_upgrade_points`,
    [characterId, delta],
  );
  return result.rows[0]?.rod_upgrade_points ?? 0;
}

// ---------------------------------------------------------------------------
// Rod in-place upgrade (transform item_def_id + reset durability)
// ---------------------------------------------------------------------------

export async function upgradeRodInPlace(
  slotId: number,
  newItemDefId: number,
  newDurability: number,
): Promise<void> {
  await query(
    `UPDATE inventory_items
     SET item_def_id = $2, current_durability = $3
     WHERE id = $1`,
    [slotId, newItemDefId, newDurability],
  );
}

// ---------------------------------------------------------------------------
// Min rod tier for a specific item (used by quest filtering)
// ---------------------------------------------------------------------------

export async function getMinRodTierForItem(itemDefId: number): Promise<number | null> {
  const result = await query<{ min_rod_tier: number }>(
    `SELECT min_rod_tier FROM fishing_loot WHERE item_def_id = $1 ORDER BY min_rod_tier ASC LIMIT 1`,
    [itemDefId],
  );
  return result.rows[0]?.min_rod_tier ?? null;
}

// ---------------------------------------------------------------------------
// Admin: fishing loot CRUD
// ---------------------------------------------------------------------------

export async function addFishingLootEntry(
  minRodTier: number,
  itemDefId: number,
  dropWeight: number,
): Promise<FishingLootEntry> {
  const result = await query<FishingLootEntry>(
    `INSERT INTO fishing_loot (min_rod_tier, item_def_id, drop_weight)
     VALUES ($1, $2, $3)
     RETURNING id, min_rod_tier, item_def_id, drop_weight,
       (SELECT name FROM item_definitions WHERE id = $2) AS item_name,
       (SELECT category FROM item_definitions WHERE id = $2) AS item_category,
       (SELECT icon_filename FROM item_definitions WHERE id = $2) AS icon_filename,
       (SELECT stack_size FROM item_definitions WHERE id = $2) AS stack_size`,
    [minRodTier, itemDefId, dropWeight],
  );
  return result.rows[0]!;
}

export async function updateFishingLootEntry(
  id: number,
  minRodTier: number,
  dropWeight: number,
): Promise<void> {
  await query(
    `UPDATE fishing_loot SET min_rod_tier = $2, drop_weight = $3 WHERE id = $1`,
    [id, minRodTier, dropWeight],
  );
}

export async function deleteFishingLootEntry(id: number): Promise<void> {
  await query(`DELETE FROM fishing_loot WHERE id = $1`, [id]);
}

export async function getAllFishingLoot(): Promise<FishingLootEntry[]> {
  const result = await query<FishingLootEntry>(
    `SELECT fl.id, fl.min_rod_tier, fl.item_def_id, fl.drop_weight,
            d.name AS item_name, d.category AS item_category,
            d.icon_filename, d.stack_size
     FROM fishing_loot fl
     JOIN item_definitions d ON d.id = fl.item_def_id
     ORDER BY fl.min_rod_tier, fl.drop_weight DESC`,
    [],
  );
  return result.rows;
}
