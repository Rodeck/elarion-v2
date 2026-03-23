import { sendToSession, getSessionByCharacterId } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByName, findClassById, updateCharacter } from '../../db/queries/characters';
import { getItemDefinitionById, clearAllInventory } from '../../db/queries/inventory';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { forcePhase } from '../world/day-cycle-service';
import { awardCrowns } from '../currency/crown-service';
import { getAllAbilities } from '../../db/queries/abilities';
import { grantAbilityToCharacter, getOwnedAbilities, getCharacterLoadout } from '../../db/queries/loadouts';
import { completeAllSessionsForCharacter } from '../../db/queries/crafting';
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
    case '/skill_all':       return handleSkillAll(session, args, reply);
    case '/crafting_finish': return handleCraftingFinish(session, args, reply);
    case '/heal':            return handleHeal(session, args, reply);
    default:
      reply(false, `Unknown command '${command}'. Available: /level_up, /item, /clear_inventory, /day, /night, /crown, /skill_all, /crafting_finish, /heal`);
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

// ---------------------------------------------------------------------------
// /skill_all <player>
// ---------------------------------------------------------------------------

async function handleSkillAll(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /skill_all <player>');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const allAbilities = await getAllAbilities();
  if (allAbilities.length === 0) {
    reply(false, 'No abilities exist in the database yet.');
    return;
  }

  const owned = await getOwnedAbilities(character.id);
  const ownedIds = new Set(owned.map((a) => a.id));

  let granted = 0;
  for (const ability of allAbilities) {
    if (!ownedIds.has(ability.id)) {
      await grantAbilityToCharacter(character.id, ability.id);
      granted++;
    }
  }

  // Push updated loadout state if the player is online
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    const [slots, ownedAbilities] = await Promise.all([
      getCharacterLoadout(character.id),
      getOwnedAbilities(character.id),
    ]);
    sendToSession(targetSession, 'loadout:state', { slots, owned_abilities: ownedAbilities });
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/skill_all',
    target_player: playerName,
    target_character_id: character.id,
    args: {},
    granted,
    already_owned: allAbilities.length - granted,
    success: true,
  });

  const skipped = allAbilities.length - granted;
  reply(true, `Granted ${granted} abilit${granted !== 1 ? 'ies' : 'y'} to ${playerName}${skipped > 0 ? ` (${skipped} already owned)` : ''}.`);
}

// ---------------------------------------------------------------------------
// /crafting_finish <player>
// ---------------------------------------------------------------------------

async function handleCraftingFinish(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /crafting_finish <player>');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const count = await completeAllSessionsForCharacter(character.id);

  if (count === 0) {
    reply(true, `${playerName} has no in-progress crafting sessions.`);
    return;
  }

  // Notify target player if online
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    sendToSession(targetSession, 'crafting.sessions_updated', {
      finished_count: count,
      message: `An admin completed ${count} crafting session${count !== 1 ? 's' : ''} for you.`,
    });
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/crafting_finish',
    target_player: playerName,
    target_character_id: character.id,
    sessions_finished: count,
    success: true,
  });

  reply(true, `Completed ${count} crafting session${count !== 1 ? 's' : ''} for ${playerName}.`);
}

// ---------------------------------------------------------------------------
// /heal <player>
// ---------------------------------------------------------------------------

async function handleHeal(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /heal <player>');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  if (character.current_hp >= character.max_hp) {
    reply(true, `${playerName} is already at full HP (${character.max_hp}).`);
    return;
  }

  await updateCharacter(character.id, { current_hp: character.max_hp });

  // Notify target player if online
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    sendToSession(targetSession, 'character.hp_changed', {
      current_hp: character.max_hp,
      max_hp: character.max_hp,
    });
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/heal',
    target_player: playerName,
    target_character_id: character.id,
    old_hp: character.current_hp,
    new_hp: character.max_hp,
    success: true,
  });

  reply(true, `Healed ${playerName} to full HP (${character.current_hp} → ${character.max_hp}).`);
}
