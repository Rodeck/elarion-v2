import { findByAccountId } from '../../db/queries/characters';
import { getCityMapCache } from '../world/city-map-loader';
import { getBuildingById, getBuildingActions } from '../../db/queries/city-maps';
import {
  getActiveExpeditionForSquire,
  getCharacterSquireById,
  createExpedition,
  getExpeditionById,
  markExpeditionCollected,
} from '../../db/queries/squires';
import type { ExpeditionActionConfig } from '../../db/queries/squires';
import { buildCharacterSquireDto } from '../squire/squire-grant-service';
import { computeRewardSnapshot } from './expedition-service';
import { buildSquireRosterDto } from '../squire/squire-grant-service';
import { config } from '../../config';
import { awardXp } from '../progression/xp-service';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { query } from '../../db/connection';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import type { ExpeditionDispatchPayload, ExpeditionCollectPayload } from '@elarion/protocol';

export async function handleExpeditionDispatch(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, action_id, duration_hours, squire_id } = payload as ExpeditionDispatchPayload;

  if (!session.characterId) {
    sendToSession(session, 'server.error', { code: 'CHARACTER_REQUIRED', message: 'Character required.' });
    return;
  }

  const characterId = session.characterId;
  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'server.error', { code: 'INTERNAL_ERROR', message: 'Character not found.' });
    return;
  }

  // Gate: must be on a city map
  const cityCache = getCityMapCache(character.zone_id);
  if (!cityCache) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'NOT_CITY_MAP' });
    return;
  }

  // Gate: must not be in combat
  if ((character as unknown as { in_combat: boolean }).in_combat) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'IN_COMBAT' });
    return;
  }

  // Gate: must not be gathering
  if ((character as unknown as { in_gathering: boolean }).in_gathering) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'IN_COMBAT' as 'IN_COMBAT' });
    return;
  }

  // Gate: must have HP > 0
  if ((character as unknown as { current_hp: number }).current_hp <= 0) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'IN_COMBAT' as 'IN_COMBAT' });
    return;
  }

  const currentNodeId = (character as unknown as { current_node_id: number | null }).current_node_id;

  // Gate: must be at the building
  const building = await getBuildingById(building_id);
  if (!building || building.zone_id !== character.zone_id || building.node_id !== currentNodeId) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'NOT_AT_BUILDING' });
    return;
  }

  // Gate: action must be an expedition action on this building
  const actions = await getBuildingActions(building_id);
  const action = actions.find((a) => a.id === action_id && (a.action_type as string) === 'expedition');
  if (!action) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'NO_EXPEDITION_CONFIG' });
    return;
  }

  const expeditionConfig = action.config as unknown as ExpeditionActionConfig;

  // Gate: squire must exist and belong to this character
  const selectedSquire = await getCharacterSquireById(squire_id);
  if (!selectedSquire || selectedSquire.character_id !== characterId) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'SQUIRE_NOT_FOUND' });
    log('warn', 'expedition', 'dispatch_squire_not_found', {
      character_id: characterId,
      squire_id,
    });
    return;
  }

  // Gate: squire must be idle (no active expedition)
  const activeExpedition = await getActiveExpeditionForSquire(selectedSquire.id);
  if (activeExpedition) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'SQUIRE_NOT_IDLE' });
    log('info', 'expedition', 'dispatch_squire_not_idle', {
      character_id: characterId,
      squire_id: selectedSquire.id,
      squire_name: selectedSquire.name,
      active_expedition_id: activeExpedition.id,
    });
    return;
  }

  // Gate: valid duration
  if (duration_hours !== 1 && duration_hours !== 3 && duration_hours !== 6) {
    sendToSession(session, 'expedition.dispatch_rejected', { reason: 'INVALID_DURATION' });
    return;
  }

  // Compute and store reward snapshot with squire power bonus
  const snapshot = await computeRewardSnapshot(expeditionConfig, duration_hours, selectedSquire.power_level);
  const expedition = await createExpedition(
    selectedSquire.id,
    characterId,
    building_id,
    action_id,
    duration_hours,
    snapshot,
  );

  const squireDto = buildCharacterSquireDto(selectedSquire, true, {
    building_name: building.name,
    started_at: expedition.started_at.toISOString(),
    completes_at: expedition.completes_at.toISOString(),
  });

  sendToSession(session, 'expedition.dispatched', {
    expedition_id: expedition.id,
    squire_name: selectedSquire.name,
    squire: squireDto,
    building_name: building.name,
    duration_hours,
    started_at: expedition.started_at.toISOString(),
    completes_at: expedition.completes_at.toISOString(),
    action_id,
  });

  // Send updated roster so squire panel reflects the new expedition status
  const roster = await buildSquireRosterDto(characterId);
  sendToSession(session, 'squire.roster_update', roster);

  log('info', 'expedition', 'expedition_dispatched', {
    character_id: characterId,
    squire_id: selectedSquire.id,
    squire_name: selectedSquire.name,
    power_level: selectedSquire.power_level,
    building_id,
    action_id,
    duration_hours,
    expedition_id: expedition.id,
    completes_at: expedition.completes_at.toISOString(),
  });
}

export async function handleExpeditionCollect(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { expedition_id } = payload as ExpeditionCollectPayload;

  if (!session.characterId) {
    sendToSession(session, 'server.error', { code: 'CHARACTER_REQUIRED', message: 'Character required.' });
    return;
  }

  const characterId = session.characterId;

  const expedition = await getExpeditionById(expedition_id);

  if (!expedition) {
    sendToSession(session, 'expedition.collect_rejected', { expedition_id, reason: 'NOT_FOUND' });
    return;
  }

  if (expedition.character_id !== characterId) {
    sendToSession(session, 'expedition.collect_rejected', { expedition_id, reason: 'NOT_OWNER' });
    return;
  }

  if (expedition.collected_at !== null) {
    sendToSession(session, 'expedition.collect_rejected', { expedition_id, reason: 'ALREADY_COLLECTED' });
    return;
  }

  if (expedition.completes_at > new Date()) {
    sendToSession(session, 'expedition.collect_rejected', { expedition_id, reason: 'NOT_COMPLETE' });
    return;
  }

  // Mark collected first (idempotency guard)
  await markExpeditionCollected(expedition_id);

  // Get squire name for response
  const squireRow = await query<{ name: string }>(
    `SELECT sd.name FROM character_squires cs
     JOIN squire_definitions sd ON sd.id = cs.squire_def_id
     WHERE cs.id = $1`,
    [expedition.squire_id],
  );
  const squireName = squireRow.rows[0]?.name ?? 'Unknown';

  const snapshot = expedition.reward_snapshot;
  let itemsSkipped = false;

  // Grant gold
  if (snapshot.gold > 0) {
    await query('UPDATE characters SET gold = gold + $1 WHERE id = $2', [snapshot.gold, characterId]);
  }

  // Grant XP
  if (snapshot.exp > 0) {
    await awardXp(characterId, snapshot.exp);
  }

  // Grant items
  const grantedItems: { item_def_id: number; name: string; quantity: number; icon_url: string | null }[] = [];
  for (const item of snapshot.items) {
    const slotCountRow = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM inventory_items WHERE character_id = $1',
      [characterId],
    );
    const slotCount = parseInt(slotCountRow.rows[0]?.count ?? '0', 10);
    if (slotCount >= 20) {
      itemsSkipped = true;
      log('info', 'expedition', 'collect_item_skipped_full_inventory', {
        character_id: characterId,
        item_def_id: item.item_def_id,
        expedition_id,
      });
      break;
    }
    await grantItemToCharacter(session, characterId, item.item_def_id, item.quantity);
    const iconRow = await query<{ icon_filename: string | null }>(
      'SELECT icon_filename FROM item_definitions WHERE id = $1',
      [item.item_def_id],
    );
    const iconFilename = iconRow.rows[0]?.icon_filename;
    const icon_url = iconFilename ? `${config.adminBaseUrl}/item-icons/${iconFilename}` : null;
    grantedItems.push({ item_def_id: item.item_def_id, name: item.name, quantity: item.quantity, icon_url });
  }

  sendToSession(session, 'expedition.collect_result', {
    expedition_id,
    squire_name: squireName,
    rewards: {
      gold: snapshot.gold,
      exp: snapshot.exp,
      items: grantedItems,
    },
    items_skipped: itemsSkipped,
  });

  // Send updated roster so squire panel reflects the squire is now idle
  const rosterAfterCollect = await buildSquireRosterDto(characterId);
  sendToSession(session, 'squire.roster_update', rosterAfterCollect);

  log('info', 'expedition', 'expedition_collected', {
    character_id: characterId,
    expedition_id,
    squire_name: squireName,
    gold: snapshot.gold,
    exp: snapshot.exp,
    items_count: grantedItems.length,
    items_skipped: itemsSkipped,
  });
}
