/**
 * fishing-handler.ts
 *
 * WebSocket message handlers for fishing.cast, fishing.complete, fishing.cancel,
 * fishing.upgrade_rod, and fishing.repair_rod.
 */

import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import { registerHandler } from '../../websocket/dispatcher';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId, updateCharacter } from '../../db/queries/characters';
import { getBuildingActions, getBuildingById } from '../../db/queries/city-maps';
import { getCityMapCache } from '../world/city-map-loader';
import { getRodTierByItemDefId } from '../../db/queries/fishing';
import { query } from '../../db/connection';
import {
  hasActiveSession,
  startSession,
  completeSession,
  cancelSession,
} from './fishing-service';
import { registerFishingUpgradeHandlers } from './fishing-upgrade-service';
import type {
  FishingCastPayload,
  FishingCompletePayload,
  FishingCancelPayload,
  FishingRejectionReason,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EquippedRodInfo {
  slotId: number;
  itemDefId: number;
  currentDurability: number;
  maxDurability: number;
}

async function findFishingRodInInventory(characterId: string): Promise<EquippedRodInfo | null> {
  const result = await query<{
    id: number;
    item_def_id: number;
    current_durability: number;
    max_durability: number;
  }>(
    `SELECT ii.id, ii.item_def_id, ii.current_durability,
            d.max_durability
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.character_id = $1
       AND d.tool_type = 'fishing_rod'
       AND ii.current_durability > 1
     ORDER BY d.power DESC, ii.current_durability DESC
     LIMIT 1`,
    [characterId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    slotId: row.id,
    itemDefId: row.item_def_id,
    currentDurability: row.current_durability ?? row.max_durability,
    maxDurability: row.max_durability,
  };
}

function rejectFishing(
  session: AuthenticatedSession,
  action: 'cast' | 'complete' | 'cancel',
  reason: FishingRejectionReason,
  message: string,
): void {
  sendToSession(session, 'fishing.rejected', { action, reason, message });
}

// ---------------------------------------------------------------------------
// fishing.cast
// ---------------------------------------------------------------------------

async function handleFishingCast(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, action_id } = payload as FishingCastPayload;
  const characterId = session.characterId;

  if (!characterId) {
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT', 'No character.');
    return;
  }

  // Gate 1: character must exist
  const character = await findByAccountId(session.accountId);
  if (!character) {
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT', 'Character not found.');
    return;
  }

  // Gate 2: not in combat
  if (character.in_combat) {
    rejectFishing(session, 'cast', 'IN_COMBAT', 'Cannot fish while in combat.');
    return;
  }

  // Gate 3: not gathering
  if (character.in_gathering) {
    rejectFishing(session, 'cast', 'ALREADY_GATHERING', 'Cannot fish while gathering.');
    return;
  }

  // Gate 4: not already fishing
  if (hasActiveSession(characterId)) {
    rejectFishing(session, 'cast', 'ALREADY_FISHING', 'Already fishing.');
    return;
  }

  // Gate 5: must be on city map at building with fishing action
  const mapCache = getCityMapCache(character.zone_id);
  if (!mapCache) {
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT', 'Not on a city map.');
    return;
  }

  const building = await getBuildingById(building_id);
  if (!building) {
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT', 'Building not found.');
    return;
  }

  const actions = await getBuildingActions(building_id);
  const fishingAction = actions.find(
    (a) => a.id === action_id && a.action_type === 'fishing',
  );
  if (!fishingAction) {
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT', 'No fishing action at this building.');
    return;
  }

  // Gate 6: must have fishing rod equipped
  const rod = await findFishingRodInInventory(characterId);
  if (!rod) {
    rejectFishing(session, 'cast', 'NO_ROD_EQUIPPED', 'No fishing rod in inventory.');
    return;
  }

  // Gate 7: rod durability must be > 1
  if (rod.currentDurability <= 1) {
    rejectFishing(session, 'cast', 'ROD_LOCKED', 'Rod must be repaired before fishing.');
    return;
  }

  // Determine rod tier
  const rodTier = await getRodTierByItemDefId(rod.itemDefId);
  const tier = rodTier?.tier ?? 1;

  // Check min_rod_tier config on the fishing spot
  const spotConfig = fishingAction.config as { min_rod_tier?: number } | undefined;
  if (spotConfig?.min_rod_tier && tier < spotConfig.min_rod_tier) {
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT',
      `This spot requires a rod of tier ${spotConfig.min_rod_tier} or higher.`);
    return;
  }

  // Gate: energy check
  if (character.current_energy < 10) {
    rejectFishing(session, 'cast', 'INSUFFICIENT_ENERGY', 'Not enough energy.');
    return;
  }
  await updateCharacter(characterId, { current_energy: (character.current_energy - 10) as number });
  sendToSession(session, 'character.energy_changed', {
    current_energy: character.current_energy - 10,
    max_energy: character.max_energy,
  });

  // Start fishing session
  try {
    const sessionStart = await startSession(
      session,
      characterId,
      rod.slotId,
      tier,
      rod.currentDurability,
      rod.maxDurability,
    );
    sendToSession(session, 'fishing.session_start', sessionStart);
    log('info', 'fishing', 'cast_accepted', { characterId, building_id, action_id, tier });
  } catch (err) {
    log('error', 'fishing', 'cast_failed', { characterId, error: String(err) });
    rejectFishing(session, 'cast', 'NOT_AT_FISHING_SPOT', 'Failed to start fishing session.');
  }
}

// ---------------------------------------------------------------------------
// fishing.complete
// ---------------------------------------------------------------------------

async function handleFishingComplete(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { session_id, input_timestamps, reel_timestamp } = payload as FishingCompletePayload;
  const characterId = session.characterId;

  if (!characterId) {
    rejectFishing(session, 'complete', 'INVALID_SESSION', 'No character.');
    return;
  }

  try {
    const result = await completeSession(characterId, session_id, input_timestamps, reel_timestamp);
    sendToSession(session, 'fishing.result', result);
  } catch (err) {
    const reason = String(err).includes('INVALID_SESSION') ? 'INVALID_SESSION'
      : String(err).includes('SESSION_EXPIRED') ? 'SESSION_EXPIRED'
      : 'INVALID_SESSION';
    rejectFishing(session, 'complete', reason as FishingRejectionReason,
      reason === 'SESSION_EXPIRED' ? 'Fishing session expired.' : 'Invalid fishing session.');
  }
}

// ---------------------------------------------------------------------------
// fishing.cancel
// ---------------------------------------------------------------------------

async function handleFishingCancel(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { session_id } = payload as FishingCancelPayload;
  const characterId = session.characterId;

  if (!characterId) {
    rejectFishing(session, 'cancel', 'INVALID_SESSION', 'No character.');
    return;
  }

  await cancelSession(characterId);
  sendToSession(session, 'fishing.result', {
    success: false,
    fish_name: null,
    fish_icon_url: null,
    items_received: [],
    rod_durability_remaining: 0, // Client should re-query equipment
    rod_locked: false,
    snap_check_failed: false,
  });
}

// ---------------------------------------------------------------------------
// Register all handlers
// ---------------------------------------------------------------------------

export function registerFishingHandlers(): void {
  registerHandler('fishing.cast', handleFishingCast);
  registerHandler('fishing.complete', handleFishingComplete);
  registerHandler('fishing.cancel', handleFishingCancel);
  registerFishingUpgradeHandlers();
  log('info', 'fishing', 'handlers_registered', {});
}
