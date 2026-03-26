import { query } from '../../db/connection';
import type { CharacterSquire, SquireExpedition, ExpeditionActionConfig, ExpeditionRewardSnapshot } from '../../db/queries/squires';
import { getActiveExpeditionForSquire } from '../../db/queries/squires';
import { buildCharacterSquireDto } from '../squire/squire-grant-service';
import type { ExpeditionStateDto, ExpeditionDurationOption, CollectableRewards, CharacterSquireDto } from '@elarion/protocol';

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
 *
 * @param powerLevel Optional squire power level (0–100). Applied as a multiplier
 *   AFTER the duration multiplier: `1 + (powerLevel / 100)`.
 */
export async function computeRewardSnapshot(
  config: ExpeditionActionConfig,
  durationHours: 1 | 3 | 6,
  powerLevel?: number,
): Promise<ExpeditionRewardSnapshot> {
  const mult = DURATION_MULTIPLIERS[durationHours];
  const powerMult = 1 + ((powerLevel ?? 0) / 100);

  const gold = Math.round(config.base_gold * mult * powerMult);
  const exp = Math.round(config.base_exp * mult * powerMult);

  const items: ExpeditionRewardSnapshot['items'] = [];
  for (const item of config.items) {
    const quantity = Math.max(1, Math.round(item.base_quantity * mult * powerMult));
    const name = await resolveItemName(item.item_def_id);
    items.push({ item_def_id: item.item_def_id, name, quantity });
  }

  return { gold, exp, items };
}

/**
 * Build the expedition state DTO for a building's expedition action.
 *
 * Accepts an array of idle squires so the client can present a squire picker.
 * Checks all character squires for an active expedition on this action to determine state:
 * - No active expedition → idle state with available_squires and duration_options
 * - completes_at in future → exploring state with active_squire
 * - completes_at in past  → ready to collect with active_squire
 *
 * @param idleSquires All idle (not on any expedition) squires for the character
 * @param allSquires  All squires for the character (needed to find the one on expedition)
 */
export async function buildExpeditionStateDto(
  idleSquires: CharacterSquire[],
  allSquires: CharacterSquire[],
  actionId: number,
  config: ExpeditionActionConfig,
): Promise<ExpeditionStateDto> {
  // Check if any squire is currently on an expedition for this action
  let activeExpedition: SquireExpedition | null = null;
  let expeditionSquire: CharacterSquire | null = null;

  for (const squire of allSquires) {
    const expedition = await getActiveExpeditionForSquire(squire.id);
    if (expedition && expedition.action_id === actionId) {
      activeExpedition = expedition;
      expeditionSquire = squire;
      break;
    }
  }

  if (!activeExpedition || !expeditionSquire) {
    // No active expedition — idle state with squire picker
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

    const available_squires: CharacterSquireDto[] = idleSquires.map(
      (s) => buildCharacterSquireDto(s, false),
    );

    return {
      action_id: actionId,
      squire_name: idleSquires[0]?.name ?? '',
      squire_status: 'idle',
      duration_options,
      available_squires,
    };
  }

  const now = new Date();
  const activeSquireDto = buildCharacterSquireDto(expeditionSquire, true);

  if (activeExpedition.completes_at > now) {
    return {
      action_id: actionId,
      squire_name: expeditionSquire.name,
      squire_status: 'exploring',
      expedition_id: activeExpedition.id,
      started_at: activeExpedition.started_at.toISOString(),
      completes_at: activeExpedition.completes_at.toISOString(),
      active_squire: activeSquireDto,
    };
  }

  // ready — expose snapshot rewards
  const snapshot = activeExpedition.reward_snapshot;
  const collectable_rewards: CollectableRewards = {
    gold: snapshot.gold,
    exp: snapshot.exp,
    items: snapshot.items.map((i) => ({ name: i.name, quantity: i.quantity })),
  };

  return {
    action_id: actionId,
    squire_name: expeditionSquire.name,
    squire_status: 'ready',
    expedition_id: activeExpedition.id,
    collectable_rewards,
    active_squire: activeSquireDto,
  };
}
