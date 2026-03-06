import { query } from '../../db/connection';
import type { Squire, SquireExpedition, ExpeditionActionConfig, ExpeditionRewardSnapshot } from '../../db/queries/squires';
import type { ExpeditionStateDto, ExpeditionDurationOption, CollectableRewards } from '@elarion/protocol';

// Non-linear scaling: 6h gives more total but less per hour than 1h
export const DURATION_MULTIPLIERS: Record<1 | 3 | 6, number> = {
  1: 1.0,
  3: 2.4,
  6: 4.0,
};

async function resolveItemName(itemDefId: number): Promise<string> {
  const row = await query<{ name: string }>(
    'SELECT name FROM item_definitions WHERE id = $1',
    [itemDefId],
  );
  return row.rows[0]?.name ?? `item_${itemDefId}`;
}

/**
 * Compute the reward snapshot to store at dispatch time.
 * Fetches item names from the DB so they are preserved even if definitions change later.
 */
export async function computeRewardSnapshot(
  config: ExpeditionActionConfig,
  durationHours: 1 | 3 | 6,
): Promise<ExpeditionRewardSnapshot> {
  const mult = DURATION_MULTIPLIERS[durationHours];
  const gold = Math.round(config.base_gold * mult);
  const exp = Math.round(config.base_exp * mult);

  const items: ExpeditionRewardSnapshot['items'] = [];
  for (const item of config.items) {
    const quantity = Math.max(1, Math.round(item.base_quantity * mult));
    const name = await resolveItemName(item.item_def_id);
    items.push({ item_def_id: item.item_def_id, name, quantity });
  }

  return { gold, exp, items };
}

/**
 * Build the expedition state DTO for a squire.
 * - expedition === null  → squire is idle, include duration_options
 * - completes_at in future → squire is exploring
 * - completes_at in past  → squire is ready to collect
 */
export async function buildExpeditionStateDto(
  squire: Squire,
  actionId: number,
  config: ExpeditionActionConfig,
  expedition: SquireExpedition | null,
): Promise<ExpeditionStateDto> {
  if (expedition === null) {
    const duration_options: ExpeditionDurationOption[] = [];

    for (const hours of [1, 3, 6] as const) {
      const mult = DURATION_MULTIPLIERS[hours];
      const est_gold = Math.round(config.base_gold * mult);
      const est_exp = Math.round(config.base_exp * mult);
      const items: { name: string; quantity: number }[] = [];

      for (const item of config.items) {
        const quantity = Math.max(1, Math.round(item.base_quantity * mult));
        const name = await resolveItemName(item.item_def_id);
        items.push({ name, quantity });
      }

      duration_options.push({ duration_hours: hours, est_gold, est_exp, items });
    }

    return {
      action_id: actionId,
      squire_name: squire.name,
      squire_status: 'idle',
      duration_options,
    };
  }

  const now = new Date();

  if (expedition.completes_at > now) {
    return {
      action_id: actionId,
      squire_name: squire.name,
      squire_status: 'exploring',
      expedition_id: expedition.id,
      started_at: expedition.started_at.toISOString(),
      completes_at: expedition.completes_at.toISOString(),
    };
  }

  // ready — expose snapshot rewards
  const snapshot = expedition.reward_snapshot;
  const collectable_rewards: CollectableRewards = {
    gold: snapshot.gold,
    exp: snapshot.exp,
    items: snapshot.items.map((i) => ({ name: i.name, quantity: i.quantity })),
  };

  return {
    action_id: actionId,
    squire_name: squire.name,
    squire_status: 'ready',
    expedition_id: expedition.id,
    collectable_rewards,
  };
}
