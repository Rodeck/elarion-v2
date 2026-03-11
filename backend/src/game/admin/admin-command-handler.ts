import { sendToSession, getSessionByCharacterId } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByName, findClassById, updateCharacter } from '../../db/queries/characters';
import { getItemDefinitionById, clearAllInventory } from '../../db/queries/inventory';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { forcePhase } from '../world/day-cycle-service';
import { awardCrowns } from '../currency/crown-service';
import { log } from '../../logger';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type ReplyFn = (success: boolean, message: string) => void;

function makeReply(session: AuthenticatedSession): ReplyFn {
  return (success, message) => sendToSession(session, 'admin.command_result', { success, message });
}

// ---------------------------------------------------------------------------
// Entry point — called from chat-handler when a /command is detected
// ---------------------------------------------------------------------------

export async function handleAdminCommand(session: AuthenticatedSession, rawMessage: string): Promise<void> {
  const parts = rawMessage.trim().split(/\s+/);
  const command = (parts[0] ?? '').toLowerCase();
  const args = parts.slice(1);
  const reply = makeReply(session);

  switch (command) {
    case '/level_up':        return handleLevelUp(session, args, reply);
    case '/item':            return handleGiveItem(session, args, reply);
    case '/clear_inventory': return handleClearInventory(session, args, reply);
    case '/day':             return handleForcePhase(session, 'day', reply);
    case '/night':           return handleForcePhase(session, 'night', reply);
    case '/crown':           return handleGiveCrowns(session, args, reply);
    default:
      reply(false, `Unknown command '${command}'. Available: /level_up, /item, /clear_inventory, /day, /night, /crown`);
  }
}

// ---------------------------------------------------------------------------
// /level_up <player> [count]
// ---------------------------------------------------------------------------

async function handleLevelUp(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /level_up <player> [count]');
    return;
  }

  const countRaw = args[1] ?? '1';
  const count = parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count < 1) {
    reply(false, 'Count must be a positive number.');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const cls = await findClassById(character.class_id);
  if (!cls) {
    reply(false, `Could not load class data for '${playerName}'.`);
    return;
  }

  const newLevel = character.level + count;
  const newMaxHp = character.max_hp + cls.hp_per_level * count;
  const newAttackPower = character.attack_power + cls.attack_per_level * count;
  const newDefence = character.defence + cls.defence_per_level * count;

  await updateCharacter(character.id, {
    level: newLevel,
    max_hp: newMaxHp,
    current_hp: newMaxHp,
    attack_power: newAttackPower,
    defence: newDefence,
  });

  // Notify target player if online
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    sendToSession(targetSession, 'character.levelled_up', {
      new_level: newLevel,
      new_max_hp: newMaxHp,
      new_attack_power: newAttackPower,
      new_defence: newDefence,
      new_experience: character.experience,
    });
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: 'level_up',
    target_player: playerName,
    target_character_id: character.id,
    args: { count },
    success: true,
  });

  reply(true, `Levelled up ${playerName} by ${count}. New level: ${newLevel}.`);
}

// ---------------------------------------------------------------------------
// /item <player> <item_id> <quantity>
// ---------------------------------------------------------------------------

async function handleGiveItem(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /item <player> <item_id> <quantity>');
    return;
  }

  const itemId = parseInt(args[1] ?? '', 10);
  if (!Number.isInteger(itemId) || itemId < 1) {
    reply(false, 'item_id must be a positive number.');
    return;
  }

  const quantity = parseInt(args[2] ?? '', 10);
  if (!Number.isInteger(quantity) || quantity < 1) {
    reply(false, 'Quantity must be a positive number.');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const itemDef = await getItemDefinitionById(itemId);
  if (!itemDef) {
    reply(false, `Item with ID ${itemId} does not exist.`);
    return;
  }

  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    await grantItemToCharacter(targetSession, character.id, itemId, quantity);
  } else {
    // Player offline — insert directly without WS notification
    const { insertInventoryItem } = await import('../../db/queries/inventory');
    await insertInventoryItem(character.id, itemId, quantity);
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: 'item',
    target_player: playerName,
    target_character_id: character.id,
    args: { item_id: itemId, quantity },
    success: true,
  });

  reply(true, `Gave ${quantity}x ${itemDef.name} to ${playerName}.`);
}

// ---------------------------------------------------------------------------
// /clear_inventory <player>
// ---------------------------------------------------------------------------

async function handleClearInventory(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /clear_inventory <player>');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const deletedCount = await clearAllInventory(character.id);

  // Notify target player if online
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    await sendInventoryState(targetSession);
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: 'clear_inventory',
    target_player: playerName,
    target_character_id: character.id,
    args: {},
    success: true,
    items_removed: deletedCount,
  });

  reply(true, `Cleared inventory of ${playerName} (${deletedCount} item${deletedCount !== 1 ? 's' : ''} removed).`);
}

// ---------------------------------------------------------------------------
// /day | /night
// ---------------------------------------------------------------------------

async function handleForcePhase(session: AuthenticatedSession, phase: 'day' | 'night', reply: ReplyFn): Promise<void> {
  forcePhase(phase);

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: phase === 'day' ? '/day' : '/night',
    args: {},
    success: true,
  });

  reply(true, `Day/night cycle forced to ${phase}.`);
}

// ---------------------------------------------------------------------------
// /crown <player> <amount>
// ---------------------------------------------------------------------------

async function handleGiveCrowns(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /crown <player> <amount>');
    return;
  }

  const amount = parseInt(args[1] ?? '', 10);
  if (!Number.isInteger(amount) || amount < 1) {
    reply(false, 'Amount must be a positive integer.');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const targetSession = getSessionByCharacterId(character.id);
  if (!targetSession) {
    reply(false, `Player '${playerName}' is not currently online.`);
    return;
  }

  const newBalance = await awardCrowns(character.id, amount);

  sendToSession(targetSession, 'character.crowns_changed', { crowns: newBalance });

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/crown',
    target_player: playerName,
    target_character_id: character.id,
    args: { amount },
    new_balance: newBalance,
    success: true,
  });

  reply(true, `Granted ${amount} Crown${amount !== 1 ? 's' : ''} to ${playerName}. New balance: ${newBalance}.`);
}
