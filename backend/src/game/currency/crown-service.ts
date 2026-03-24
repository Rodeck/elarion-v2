import { addCrowns } from '../../db/queries/characters';
import { log } from '../../logger';
import { QuestTracker } from '../quest/quest-tracker';
import type { Monster } from '../../db/queries/monsters';
import type { QuestProgressPayload } from '../../../../shared/protocol/index';

/**
 * Atomically credits `amount` Crowns to a character.
 * Returns the new balance.
 */
export async function awardCrowns(characterId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  const newBalance = await addCrowns(characterId, amount);
  log('info', 'currency', 'crowns_awarded', { characterId, amount, newBalance });
  return newBalance;
}

/**
 * Rolls a random Crown drop for a monster based on its configured min/max range.
 * Returns 0 when both min_crowns and max_crowns are 0.
 */
/**
 * Track crowns spent for quest objectives.
 * Call this wherever crowns are deducted (crafting, shops, etc.).
 */
export async function trackCrownsSpent(characterId: string, amount: number): Promise<QuestProgressPayload[]> {
  return QuestTracker.onCrownsSpent(characterId, amount);
}

export function rollCrownDrop(monster: Monster): number {
  if (monster.min_crowns === 0 && monster.max_crowns === 0) return 0;
  const min = monster.min_crowns;
  const max = monster.max_crowns;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
