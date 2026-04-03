import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { findByAccountId, findClassById, updateCharacter } from '../../db/queries/characters';
import { getNpcById } from '../../db/queries/npcs';
import { getTrainingItemsByNpcId, getTrainingItemByItemDefId } from '../../db/queries/stat-training';
import { getInventoryWithDefinitions, updateInventoryQuantity, deleteInventoryItem } from '../../db/queries/inventory';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { config } from '../../config';
import type {
  StatTrainingOpenPayload,
  StatTrainingAttemptPayload,
  StatTrainingItemDto,
} from '../../../../shared/protocol/index';

const MAX_POINTS_PER_STAT_PER_LEVEL = 10;
const MIN_SUCCESS_CHANCE = 5;

const ATTR_DB_FIELDS: Record<string, string> = {
  constitution: 'attr_constitution',
  strength: 'attr_strength',
  intelligence: 'attr_intelligence',
  dexterity: 'attr_dexterity',
  toughness: 'attr_toughness',
};

function sendError(session: AuthenticatedSession, message: string): void {
  sendToSession(session, 'stat-training.error', { message });
}

function computeSuccessChance(baseChance: number, decayPerLevel: number, level: number): number {
  return Math.max(MIN_SUCCESS_CHANCE, Math.round(baseChance - level * decayPerLevel));
}

// ---------------------------------------------------------------------------
// stat-training.open
// ---------------------------------------------------------------------------

async function handleStatTrainingOpen(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id } = payload as StatTrainingOpenPayload;
  const characterId = session.characterId;
  if (!characterId) { sendError(session, 'No character.'); return; }

  const npc = await getNpcById(npc_id);
  if (!npc || !npc.trainer_stat) {
    sendError(session, 'This NPC does not offer stat training.');
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) { sendError(session, 'Character not found.'); return; }

  if (character.in_combat) {
    sendError(session, 'Cannot train while in combat.');
    return;
  }

  const perStatCap = MAX_POINTS_PER_STAT_PER_LEVEL * (character.level - 1);

  if (perStatCap === 0) {
    sendError(session, 'Training is available from level 2.');
    return;
  }

  const statName = npc.trainer_stat;
  const dbField = ATTR_DB_FIELDS[statName];
  if (!dbField) { sendError(session, 'Invalid trainer configuration.'); return; }

  const currentValue = (character as unknown as Record<string, unknown>)[dbField] as number;

  // Get training items configured for this NPC
  const trainingItems = await getTrainingItemsByNpcId(npc_id);

  // Get player inventory to check owned quantities
  const inventory = await getInventoryWithDefinitions(characterId);

  // Build item DTOs — only include items the player owns
  const items: StatTrainingItemDto[] = [];
  for (const ti of trainingItems) {
    const ownedSlots = inventory.filter(s => s.item_def_id === ti.item_def_id);
    const ownedQuantity = ownedSlots.reduce((sum, s) => sum + s.quantity, 0);
    if (ownedQuantity <= 0) continue;

    items.push({
      item_def_id: ti.item_def_id,
      name: ti.item_name,
      icon_url: ti.icon_filename ? `${config.adminBaseUrl}/item-icons/${ti.icon_filename}` : null,
      tier: ti.tier,
      success_chance: computeSuccessChance(ti.base_chance, Number(ti.decay_per_level), character.level),
      owned_quantity: ownedQuantity,
    });
  }

  log('debug', 'stat-training', 'stat_training_open', {
    characterId, npcId: npc_id, stat: statName, itemCount: items.length,
  });

  sendToSession(session, 'stat-training.state', {
    stat_name: statName,
    current_value: currentValue,
    per_stat_cap: perStatCap,
    level: character.level,
    items,
  });
}

// ---------------------------------------------------------------------------
// stat-training.attempt
// ---------------------------------------------------------------------------

async function handleStatTrainingAttempt(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id, item_def_id } = payload as StatTrainingAttemptPayload;
  const characterId = session.characterId;
  if (!characterId) { sendError(session, 'No character.'); return; }

  const npc = await getNpcById(npc_id);
  if (!npc || !npc.trainer_stat) {
    sendError(session, 'This NPC does not offer stat training.');
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) { sendError(session, 'Character not found.'); return; }

  if (character.in_combat) {
    sendError(session, 'Cannot train while in combat.');
    return;
  }

  const statName = npc.trainer_stat;
  const dbField = ATTR_DB_FIELDS[statName];
  if (!dbField) { sendError(session, 'Invalid trainer configuration.'); return; }

  const perStatCap = MAX_POINTS_PER_STAT_PER_LEVEL * (character.level - 1);
  if (perStatCap === 0) {
    sendError(session, 'Training is available from level 2.');
    return;
  }

  const currentValue = (character as unknown as Record<string, unknown>)[dbField] as number;
  if (currentValue >= perStatCap) {
    sendError(session, `Your ${statName} has reached its maximum for your level.`);
    return;
  }

  // Validate the item is a valid training item for this NPC
  const trainingItem = await getTrainingItemByItemDefId(item_def_id);
  if (!trainingItem || trainingItem.npc_id !== npc_id) {
    sendError(session, 'That item cannot be used for training here.');
    return;
  }

  // Find the item in player inventory
  const inventory = await getInventoryWithDefinitions(characterId);
  const itemSlot = inventory.find(s => s.item_def_id === item_def_id);
  if (!itemSlot || itemSlot.quantity <= 0) {
    sendError(session, "You don't have that item.");
    return;
  }

  // Consume 1x item
  if (itemSlot.quantity <= 1) {
    await deleteInventoryItem(itemSlot.id, characterId);
  } else {
    await updateInventoryQuantity(itemSlot.id, itemSlot.quantity - 1);
  }

  // Roll for success
  const successChance = computeSuccessChance(trainingItem.base_chance, Number(trainingItem.decay_per_level), character.level);
  const roll = Math.random() * 100;
  const success = roll < successChance;

  let newValue = currentValue;
  if (success) {
    newValue = currentValue + 1;

    // Recalculate derived stats using same formulas as training-handler.ts
    const cls = await findClassById(character.class_id);
    if (!cls) { sendError(session, 'Class data not found.'); return; }

    // Build new attribute values (only the trained stat changes)
    const attrs = {
      attr_constitution: character.attr_constitution,
      attr_strength: character.attr_strength,
      attr_intelligence: character.attr_intelligence,
      attr_dexterity: character.attr_dexterity,
      attr_toughness: character.attr_toughness,
    };
    (attrs as Record<string, number>)[dbField] = newValue;

    const newMaxHp = cls.base_hp + attrs.attr_constitution * 4;
    const newAttack = cls.base_attack + attrs.attr_constitution * 1 + attrs.attr_strength * 2;
    const newDefence = cls.base_defence + attrs.attr_toughness * 1;

    await updateCharacter(characterId, {
      [dbField]: newValue,
      max_hp: newMaxHp,
      attack_power: newAttack,
      defence: newDefence,
    } as Parameters<typeof updateCharacter>[1]);
  }

  log('info', 'stat-training', 'stat_training_attempt', {
    characterId, npcId: npc_id, itemDefId: item_def_id,
    stat: statName, successChance, success, newValue,
  });

  // Send result
  sendToSession(session, 'stat-training.result', {
    success,
    stat_name: statName,
    new_value: newValue,
    message: success
      ? `Training successful! Your ${statName} increased to ${newValue}.`
      : 'The training had no lasting effect. Try again.',
  });

  // Send updated inventory state
  await sendInventoryState(session);

  // Re-send training state (refreshes item counts and current value)
  await handleStatTrainingOpen(session, { npc_id });
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerStatTrainingHandlers(): void {
  registerHandler('stat-training.open', handleStatTrainingOpen);
  registerHandler('stat-training.attempt', handleStatTrainingAttempt);
}
