import { log } from '../../logger';
import { getFishingLootByTier } from '../../db/queries/fishing';
import type { FishingLootEntry } from '../../db/queries/fishing';

/**
 * Resolve a single loot drop from the fishing loot pool for a given rod tier.
 * Uses weighted random selection across all entries where min_rod_tier <= rodTier.
 */
export async function resolveFishingLoot(rodTier: number): Promise<FishingLootEntry | null> {
  const entries = await getFishingLootByTier(rodTier);
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, e) => sum + e.drop_weight, 0);
  let roll = Math.floor(Math.random() * totalWeight);

  for (const entry of entries) {
    roll -= entry.drop_weight;
    if (roll < 0) {
      log('debug', 'fishing-loot', 'loot_resolved', {
        rodTier,
        item: entry.item_name,
        category: entry.item_category,
        weight: entry.drop_weight,
        totalWeight,
      });
      return entry;
    }
  }

  // Fallback (should not happen)
  return entries[entries.length - 1]!;
}
