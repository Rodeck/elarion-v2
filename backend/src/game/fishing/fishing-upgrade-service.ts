/**
 * fishing-upgrade-service.ts
 *
 * Handles rod upgrades (transform in-place) and rod repairs.
 */

import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import { registerHandler } from '../../websocket/dispatcher';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId, addCrowns } from '../../db/queries/characters';
import { query } from '../../db/connection';
import {
  getRodTierByItemDefId,
  getNextRodTier,
  getRodUpgradePoints,
  updateRodUpgradePoints,
  upgradeRodInPlace,
} from '../../db/queries/fishing';
import type { FishingRodTier } from '../../db/queries/fishing';
import { getEquipmentState } from '../../db/queries/equipment';
import { updateToolDurability } from '../../db/queries/inventory';
import type {
  FishingUpgradeRodPayload,
  FishingUpgradeResultPayload,
  FishingRepairRodPayload,
  FishingRepairResultPayload,
  InventorySlotDto,
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

// ---------------------------------------------------------------------------
// Rod Upgrade
// ---------------------------------------------------------------------------

export async function handleUpgradeRod(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) {
    sendToSession(session, 'fishing.upgrade_result', {
      success: false, new_tier: 0, new_max_durability: 0, new_durability: 0,
      points_remaining: 0, reason: 'No character.', updated_slots: [],
    });
    return;
  }

  // Get equipped rod
  const rod = await findFishingRodInInventory(characterId);
  if (!rod) {
    sendToSession(session, 'fishing.upgrade_result', {
      success: false, new_tier: 0, new_max_durability: 0, new_durability: 0,
      points_remaining: 0, reason: 'No fishing rod equipped.', updated_slots: [],
    });
    return;
  }

  // Get current tier
  const currentTier = await getRodTierByItemDefId(rod.itemDefId);
  if (!currentTier) {
    sendToSession(session, 'fishing.upgrade_result', {
      success: false, new_tier: 0, new_max_durability: 0, new_durability: 0,
      points_remaining: 0, reason: 'Rod tier not found.', updated_slots: [],
    });
    return;
  }

  // Check max tier
  const nextTier = await getNextRodTier(currentTier.tier);
  if (!nextTier) {
    sendToSession(session, 'fishing.upgrade_result', {
      success: false, new_tier: currentTier.tier, new_max_durability: currentTier.max_durability,
      new_durability: rod.currentDurability,
      points_remaining: await getRodUpgradePoints(characterId),
      reason: 'MAX_TIER', updated_slots: [],
    });
    return;
  }

  // Check upgrade points
  const currentPoints = await getRodUpgradePoints(characterId);
  if (currentPoints < nextTier.upgrade_points_cost) {
    sendToSession(session, 'fishing.upgrade_result', {
      success: false, new_tier: currentTier.tier, new_max_durability: currentTier.max_durability,
      new_durability: rod.currentDurability,
      points_remaining: currentPoints,
      reason: 'INSUFFICIENT_POINTS', updated_slots: [],
    });
    return;
  }

  // TODO: Check resource requirements (Linen, Iron Bars, etc.) per tier
  // For MVP, only upgrade points are checked

  // Perform upgrade: deduct points, transform rod in-place
  await updateRodUpgradePoints(characterId, -nextTier.upgrade_points_cost);
  await upgradeRodInPlace(rod.slotId, nextTier.item_def_id, nextTier.max_durability);

  const remainingPoints = await getRodUpgradePoints(characterId);
  const equipmentState = await getEquipmentState(characterId);
  const updatedSlots: InventorySlotDto[] = [];
  for (const slot of Object.values(equipmentState)) {
    if (slot) updatedSlots.push(slot);
  }

  log('info', 'fishing', 'rod_upgraded', {
    characterId,
    fromTier: currentTier.tier,
    toTier: nextTier.tier,
    pointsSpent: nextTier.upgrade_points_cost,
    pointsRemaining: remainingPoints,
  });

  sendToSession(session, 'fishing.upgrade_result', {
    success: true,
    new_tier: nextTier.tier,
    new_max_durability: nextTier.max_durability,
    new_durability: nextTier.max_durability,
    points_remaining: remainingPoints,
    updated_slots: updatedSlots,
  } as FishingUpgradeResultPayload);

  // Also send equipment.changed so UI updates
  sendToSession(session, 'equipment.changed', {
    slots: equipmentState,
    effective_stats: null, // Client can re-request
  });
}

// ---------------------------------------------------------------------------
// Rod Repair
// ---------------------------------------------------------------------------

export async function handleRepairRod(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) {
    sendToSession(session, 'fishing.repair_result', {
      success: false, new_durability: 0, crowns_remaining: 0,
      reason: 'No character.', updated_slots: [],
    });
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'fishing.repair_result', {
      success: false, new_durability: 0, crowns_remaining: 0,
      reason: 'Character not found.', updated_slots: [],
    });
    return;
  }

  // Get equipped rod
  const rod = await findFishingRodInInventory(characterId);
  if (!rod) {
    sendToSession(session, 'fishing.repair_result', {
      success: false, new_durability: 0, crowns_remaining: character.crowns,
      reason: 'No fishing rod equipped.', updated_slots: [],
    });
    return;
  }

  // Rod must be locked (durability <= 1)
  if (rod.currentDurability > 1) {
    sendToSession(session, 'fishing.repair_result', {
      success: false, new_durability: rod.currentDurability, crowns_remaining: character.crowns,
      reason: 'ROD_NOT_LOCKED', updated_slots: [],
    });
    return;
  }

  // Get tier for repair cost
  const tier = await getRodTierByItemDefId(rod.itemDefId);
  const repairCost = tier?.repair_crown_cost ?? 10;

  // Check crowns
  if (character.crowns < repairCost) {
    sendToSession(session, 'fishing.repair_result', {
      success: false, new_durability: rod.currentDurability, crowns_remaining: character.crowns,
      reason: 'INSUFFICIENT_CROWNS', updated_slots: [],
    });
    return;
  }

  // Deduct crowns and restore durability
  const newCrowns = await addCrowns(characterId, -repairCost);
  const fullDurability = tier?.max_durability ?? rod.maxDurability;
  await updateToolDurability(rod.slotId, fullDurability);

  const equipmentState = await getEquipmentState(characterId);
  const updatedSlots: InventorySlotDto[] = [];
  for (const slot of Object.values(equipmentState)) {
    if (slot) updatedSlots.push(slot);
  }

  log('info', 'fishing', 'rod_repaired', {
    characterId,
    tier: tier?.tier ?? 1,
    crownCost: repairCost,
    newCrowns,
  });

  sendToSession(session, 'fishing.repair_result', {
    success: true,
    new_durability: fullDurability,
    crowns_remaining: newCrowns,
    updated_slots: updatedSlots,
  } as FishingRepairResultPayload);

  // Send updated crowns
  sendToSession(session, 'character.crowns_changed', { crowns: newCrowns });

  // Send equipment.changed
  sendToSession(session, 'equipment.changed', {
    slots: equipmentState,
    effective_stats: null,
  });
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerFishingUpgradeHandlers(): void {
  registerHandler('fishing.upgrade_rod', handleUpgradeRod);
  registerHandler('fishing.repair_rod', handleRepairRod);
  log('info', 'fishing', 'upgrade_handlers_registered', {});
}
