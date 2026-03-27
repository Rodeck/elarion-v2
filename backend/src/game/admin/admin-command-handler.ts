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
import { getSquireDefinitionById } from '../../db/queries/squire-definitions';
import { grantSquireToCharacter, buildSquireRosterDto } from '../squire/squire-grant-service';
import { getActiveExpeditionsForCharacter } from '../../db/queries/squires';
import { getMapsByType } from '../../db/queries/city-maps';
import { query } from '../../db/connection';
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
    case '/squire':          return handleGiveSquire(session, args, reply);
    case '/expedition_finish': return handleExpeditionFinish(session, args, reply);
    case '/reset_player':      return handleResetPlayer(session, args, reply);
    default:
      reply(false, `Unknown command '${command}'. Available: /level_up, /item, /clear_inventory, /day, /night, /crown, /skill_all, /crafting_finish, /heal, /squire, /expedition_finish, /reset_player`);
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
    const { insertInventoryItem, insertToolInventoryItem, findStackableSlot, updateInventoryQuantity, getInventorySlotCount } = await import('../../db/queries/inventory');

    const isStackable = itemDef.stack_size != null;
    const isTool = itemDef.category === 'tool' && itemDef.max_durability != null;

    if (isStackable) {
      const existingSlot = await findStackableSlot(character.id, itemId);
      if (existingSlot && existingSlot.quantity + quantity <= itemDef.stack_size!) {
        await updateInventoryQuantity(existingSlot.id, existingSlot.quantity + quantity);
        reply(true, `Gave ${quantity}x ${itemDef.name} to ${playerName} (offline, stacked).`);
        return;
      }
    }

    // Non-stackable items each get their own slot
    const unitsToInsert = isStackable ? 1 : quantity;
    const qtyPerSlot = isStackable ? quantity : 1;
    let inserted = 0;

    for (let u = 0; u < unitsToInsert; u++) {
      const slotCount = await getInventorySlotCount(character.id);
      if (slotCount >= 20) {
        break;
      }
      if (isTool) {
        await insertToolInventoryItem(character.id, itemId, itemDef.max_durability!);
      } else {
        await insertInventoryItem(character.id, itemId, qtyPerSlot);
      }
      inserted++;
    }

    if (inserted === 0) {
      reply(false, `${playerName}'s inventory is full.`);
      return;
    }
    if (inserted < unitsToInsert) {
      reply(true, `Gave ${inserted}x ${itemDef.name} to ${playerName} (offline, inventory full — requested ${quantity}).`);
      return;
    }
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

// ---------------------------------------------------------------------------
// /squire <player> <squire_def_id> [level]
// ---------------------------------------------------------------------------

async function handleGiveSquire(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /squire <player> <squire_def_id> [level]');
    return;
  }

  const squireDefId = parseInt(args[1] ?? '', 10);
  if (!Number.isInteger(squireDefId) || squireDefId < 1) {
    reply(false, 'squire_def_id must be a positive number.');
    return;
  }

  const level = parseInt(args[2] ?? '1', 10);
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    reply(false, 'Level must be between 1 and 20.');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const squireDef = await getSquireDefinitionById(squireDefId);
  if (!squireDef) {
    reply(false, `Squire definition with ID ${squireDefId} does not exist.`);
    return;
  }

  const targetSession = getSessionByCharacterId(character.id);
  if (!targetSession) {
    reply(false, `Player '${playerName}' is not currently online.`);
    return;
  }

  const granted = await grantSquireToCharacter(targetSession, character.id, squireDefId, level, 'exploration');

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/squire',
    target_player: playerName,
    target_character_id: character.id,
    args: { squire_def_id: squireDefId, level },
    granted,
    success: true,
  });

  if (granted) {
    reply(true, `Granted squire "${squireDef.name}" (level ${level}) to ${playerName}.`);
  } else {
    reply(false, `${playerName}'s squire roster is full.`);
  }
}

// ---------------------------------------------------------------------------
// /expedition_finish <player>
// ---------------------------------------------------------------------------

async function handleExpeditionFinish(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /expedition_finish <player>');
    return;
  }

  const character = await findByName(playerName);
  if (!character) {
    reply(false, `Player '${playerName}' not found.`);
    return;
  }

  const expeditions = await getActiveExpeditionsForCharacter(character.id);
  if (expeditions.length === 0) {
    reply(true, `${playerName} has no active expeditions.`);
    return;
  }

  // Set completes_at to now for all active expeditions
  for (const exp of expeditions) {
    await query(
      `UPDATE squire_expeditions SET completes_at = now() WHERE id = $1`,
      [exp.id],
    );
  }

  // Notify the target player if online
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    for (const exp of expeditions) {
      const squireRow = await query<{ name: string }>(
        `SELECT sd.name FROM character_squires cs
         JOIN squire_definitions sd ON sd.id = cs.squire_def_id
         WHERE cs.id = $1`,
        [exp.squire_id],
      );
      const bldgRow = await query<{ name: string }>(
        `SELECT name FROM buildings WHERE id = $1`,
        [exp.building_id],
      );
      sendToSession(targetSession, 'expedition.completed', {
        expedition_id: exp.id,
        squire_name: squireRow.rows[0]?.name ?? 'Unknown',
        building_name: bldgRow.rows[0]?.name ?? 'Unknown',
      });
    }

    // Send updated roster
    const roster = await buildSquireRosterDto(character.id);
    sendToSession(targetSession, 'squire.roster_update', roster);
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/expedition_finish',
    target_player: playerName,
    target_character_id: character.id,
    expeditions_finished: expeditions.length,
    success: true,
  });

  reply(true, `Finished ${expeditions.length} expedition${expeditions.length !== 1 ? 's' : ''} for ${playerName}.`);
}

// ---------------------------------------------------------------------------
// /reset_player <player>
// ---------------------------------------------------------------------------

async function handleResetPlayer(session: AuthenticatedSession, args: string[], reply: ReplyFn): Promise<void> {
  const playerName = args[0];
  if (!playerName) {
    reply(false, 'Usage: /reset_player <player>');
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

  // Find starter zone (first city map)
  const cityMaps = await getMapsByType('city');
  const starterZoneId = cityMaps.length > 0 ? cityMaps[0]!.id : character.zone_id;

  // Delete all dependent data (order matters for FK constraints without CASCADE)
  await query(`DELETE FROM crafting_sessions WHERE character_id = $1`, [character.id]);
  await query(`DELETE FROM character_quests WHERE character_id = $1`, [character.id]);
  await query(`DELETE FROM character_squires WHERE character_id = $1`, [character.id]);
  await query(`DELETE FROM character_owned_abilities WHERE character_id = $1`, [character.id]);
  await query(`DELETE FROM character_loadouts WHERE character_id = $1`, [character.id]);
  await query(`DELETE FROM inventory_items WHERE character_id = $1`, [character.id]);

  // Reset character stats to level 1 defaults
  await query(
    `UPDATE characters
     SET level = 1,
         experience = 0,
         max_hp = $2,
         current_hp = $2,
         attack_power = $3,
         defence = $4,
         zone_id = $5,
         pos_x = 0,
         pos_y = 0,
         current_node_id = NULL,
         in_combat = false,
         in_gathering = false,
         crowns = 0,
         squire_slots_unlocked = 2,
         updated_at = now()
     WHERE id = $1`,
    [character.id, cls.base_hp, cls.base_attack, cls.base_defence, starterZoneId],
  );

  // Notify the target player if online — they should re-login to get fresh state
  const targetSession = getSessionByCharacterId(character.id);
  if (targetSession) {
    sendToSession(targetSession, 'server.error', {
      code: 'CHARACTER_RESET',
      message: 'Your character has been reset by an admin. Please re-login.',
    });
  }

  log('info', 'admin', 'admin_command', {
    event: 'admin_command',
    admin_account_id: session.accountId,
    admin_character_id: session.characterId,
    command: '/reset_player',
    target_player: playerName,
    target_character_id: character.id,
    args: {},
    success: true,
  });

  reply(true, `Reset ${playerName} to initial state (level 1, empty inventory, no squires/quests/abilities).`);
}
