import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { findByAccountId } from '../../db/queries/characters';
import { getInventorySlotById, deleteInventoryItem, updateInventoryQuantity } from '../../db/queries/inventory';
import { getAbilityById } from '../../db/queries/abilities';
import { characterOwnsAbility } from '../../db/queries/loadouts';
import { getAbilityProgress, upsertAbilityProgress } from '../../db/queries/ability-progress';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { sendLoadoutState } from '../combat/combat-handlers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ABILITY_LEVEL = 5;
const POINTS_TO_LEVEL = 100;
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendError(session: AuthenticatedSession, message: string): void {
  sendToSession(session, 'skill-book.error', { message });
}

/**
 * Roll points gained from using a skill book.
 * 60% chance: 10, 30% chance: 20, 9% chance: 30, 1% chance: 50.
 */
function rollPoints(): number {
  const rand = Math.random();
  if (rand < 0.60) return 10;
  if (rand < 0.90) return 20;
  if (rand < 0.99) return 30;
  return 50;
}

// ---------------------------------------------------------------------------
// skill-book.use
// ---------------------------------------------------------------------------

async function handleSkillBookUse(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { slot_id } = payload as { slot_id: number };
  const characterId = session.characterId;

  // 1. Auth check
  if (!characterId) {
    sendError(session, 'No character.');
    return;
  }

  // 2. Combat check
  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendError(session, 'Character not found.');
    return;
  }

  if (character.in_combat) {
    log('warn', 'skill-book', 'skill_book_rejected', {
      character_id: characterId, reason: 'in_combat',
    });
    sendError(session, 'Cannot use skill books while in combat.');
    return;
  }

  // 3. Inventory slot validation
  const slot = await getInventorySlotById(slot_id, characterId);
  if (!slot) {
    log('warn', 'skill-book', 'skill_book_rejected', {
      character_id: characterId, reason: 'slot_not_found', slot_id,
    });
    sendError(session, 'Item not found in your inventory.');
    return;
  }

  // 4. Category check
  if (slot.def_category !== 'skill_book') {
    log('warn', 'skill-book', 'skill_book_rejected', {
      character_id: characterId, reason: 'wrong_category', category: slot.def_category,
    });
    sendError(session, 'This item is not a skill book.');
    return;
  }

  // 5. Ability reference check
  const abilityId = slot.def_ability_id;
  if (!abilityId) {
    log('warn', 'skill-book', 'skill_book_rejected', {
      character_id: characterId, reason: 'no_ability_id', item_def_id: slot.item_def_id,
    });
    sendError(session, 'Skill book references an unknown ability.');
    return;
  }

  // Get ability name for messages
  const ability = await getAbilityById(abilityId);
  const abilityName = ability?.name ?? 'Unknown Ability';

  // 6. Ownership check
  const ownsAbility = await characterOwnsAbility(characterId, abilityId);
  if (!ownsAbility) {
    log('warn', 'skill-book', 'skill_book_rejected', {
      character_id: characterId, reason: 'ability_not_owned', ability_id: abilityId,
    });
    sendError(session, `You haven't learned ${abilityName} yet.`);
    return;
  }

  // 7. Get current progress
  const progress = await getAbilityProgress(characterId, abilityId);
  const currentLevel = progress?.current_level ?? 1;
  const currentPoints = progress?.current_points ?? 0;

  // 8. Max level check
  if (currentLevel >= MAX_ABILITY_LEVEL) {
    log('warn', 'skill-book', 'skill_book_rejected', {
      character_id: characterId, reason: 'max_level', ability_id: abilityId, current_level: currentLevel,
    });
    sendError(session, `${abilityName} is already at maximum level.`);
    return;
  }

  // 9. Cooldown check
  if (progress?.last_book_used_at) {
    const elapsed = Date.now() - new Date(progress.last_book_used_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - elapsed;
      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
      const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      log('warn', 'skill-book', 'skill_book_rejected', {
        character_id: characterId, reason: 'cooldown', ability_id: abilityId,
        remaining_ms: remainingMs,
      });
      sendError(session, `Cooldown: ${remainingHours}h ${remainingMinutes}m remaining.`);
      return;
    }
  }

  // 10. Consume item
  if (slot.quantity <= 1) {
    await deleteInventoryItem(slot.id, characterId);
  } else {
    await updateInventoryQuantity(slot.id, slot.quantity - 1);
  }

  // 11. Roll points
  const pointsGained = rollPoints();

  // 12. Calculate new progress
  let newLevel = currentLevel;
  let newPoints = currentPoints + pointsGained;
  let leveledUp = false;

  if (newPoints >= POINTS_TO_LEVEL) {
    newLevel = Math.min(newLevel + 1, MAX_ABILITY_LEVEL);
    newPoints -= POINTS_TO_LEVEL;
    leveledUp = true;
  }

  // 13. Upsert progress
  await upsertAbilityProgress(characterId, abilityId, newLevel, newPoints, new Date());

  // 14. Log and send result
  log('info', 'skill-book', 'skill_book_used', {
    character_id: characterId,
    ability_id: abilityId,
    ability_name: abilityName,
    points_gained: pointsGained,
    new_level: newLevel,
    new_points: newPoints,
    leveled_up: leveledUp,
  });

  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  sendToSession(session, 'skill-book.result', {
    ability_id: abilityId,
    ability_name: abilityName,
    points_gained: pointsGained,
    new_points: newPoints,
    new_level: newLevel,
    leveled_up: leveledUp,
    cooldown_until: cooldownUntil,
  });

  // 15. Send updated inventory state
  await sendInventoryState(session);

  // 16. Send updated loadout state (ability stats may have changed with level-up)
  await sendLoadoutState(session, characterId);
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerSkillBookHandlers(): void {
  registerHandler('skill-book.use', handleSkillBookUse);
}
