import { getMonsterById } from '../../db/queries/monsters';
import { getLootByMonsterId } from '../../db/queries/monster-loot';
import { awardXp } from '../progression/xp-service';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { awardCrowns, rollCrownDrop } from '../currency/crown-service';
import { getPhase } from '../world/day-cycle-service';
import { log } from '../../logger';
import { config } from '../../config';
import type { AuthenticatedSession } from '../../websocket/server';
import type { Character } from '../../db/queries/characters';
import type { ExploreActionConfig } from '../../db/queries/city-maps';
import type { BuildingExploreResultPayload, CombatRoundRecord, ItemDroppedDto } from '../../../../shared/protocol/index';

const NIGHT_STAT_MULTIPLIER = 1.1;

function buildMonsterIconUrl(filename: string | null): string | null {
  return filename ? `${config.adminBaseUrl}/monster-icons/${filename}` : null;
}

function buildItemIconUrl(filename: string | null): string | null {
  return filename ? `${config.adminBaseUrl}/item-icons/${filename}` : null;
}

/** Select a monster_id from the weighted table. Returns null if the array is empty. */
function pickMonster(monsters: { monster_id: number; weight: number }[]): number | null {
  if (monsters.length === 0) return null;
  const totalWeight = monsters.reduce((acc, m) => acc + m.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const m of monsters) {
    roll -= m.weight;
    if (roll <= 0) return m.monster_id;
  }
  return monsters[monsters.length - 1]!.monster_id;
}

/**
 * Resolve an Explore building action for the given character.
 *
 * Returns a BuildingExploreResultPayload that the caller can send via WS.
 * Side effects:
 *   - On win: awards XP via awardXp(), grants any dropped items via grantItemToCharacter().
 */
export async function resolveExplore(
  session: AuthenticatedSession,
  character: Character,
  actionId: number,
  exploreConfig: ExploreActionConfig,
): Promise<BuildingExploreResultPayload> {
  // ── Encounter roll ──────────────────────────────────────────────────────────
  const encounterRoll = Math.random() * 100;
  if (encounterRoll >= exploreConfig.encounter_chance) {
    log('info', 'explore', 'no_encounter', {
      characterId: character.id,
      actionId,
      roll: encounterRoll.toFixed(2),
      chance: exploreConfig.encounter_chance,
    });
    return { action_id: actionId, outcome: 'no_encounter' };
  }

  // ── Pick monster ────────────────────────────────────────────────────────────
  const monsterId = pickMonster(exploreConfig.monsters);
  if (monsterId === null) {
    log('warn', 'explore', 'encounter_but_no_monsters', { characterId: character.id, actionId });
    return { action_id: actionId, outcome: 'no_encounter' };
  }

  const monster = await getMonsterById(monsterId);
  if (!monster) {
    log('warn', 'explore', 'monster_not_found', { characterId: character.id, actionId, monsterId });
    return { action_id: actionId, outcome: 'no_encounter' };
  }

  // Apply 10% night stat bonus to the monster when it's night
  const isNight = getPhase() === 'night';
  const effectiveHp      = isNight ? Math.ceil(monster.hp * NIGHT_STAT_MULTIPLIER)      : monster.hp;
  const effectiveAttack  = isNight ? Math.ceil(monster.attack * NIGHT_STAT_MULTIPLIER)  : monster.attack;
  const effectiveDefense = isNight ? Math.ceil(monster.defense * NIGHT_STAT_MULTIPLIER) : monster.defense;

  log('info', 'explore', 'encounter_started', {
    characterId: character.id,
    actionId,
    monsterId: monster.id,
    monsterName: monster.name,
    isNight,
    effectiveHp,
    effectiveAttack,
    effectiveDefense,
  });

  // ── Combat loop ─────────────────────────────────────────────────────────────
  // Player starts at full HP (no persistent damage across encounters)
  let playerHp = character.max_hp;
  let monsterHp = effectiveHp;
  const rounds: CombatRoundRecord[] = [];

  while (playerHp > 0 && monsterHp > 0) {
    const roundNum = rounds.length + 1;

    // Player attacks first
    const playerDmg = Math.max(1, character.attack_power - effectiveDefense);
    monsterHp = Math.max(0, monsterHp - playerDmg);

    // Monster attacks back (only if still alive)
    let monsterDmg = 0;
    if (monsterHp > 0) {
      monsterDmg = Math.max(1, effectiveAttack - character.defence);
      playerHp = Math.max(0, playerHp - monsterDmg);
    }

    rounds.push({
      round: roundNum,
      player_attack: playerDmg,
      monster_attack: monsterDmg,
      player_hp_after: playerHp,
      monster_hp_after: monsterHp,
    });
  }

  const playerWon = monsterHp <= 0;

  log('info', 'explore', 'combat_resolved', {
    characterId: character.id,
    actionId,
    monsterId: monster.id,
    rounds: rounds.length,
    result: playerWon ? 'win' : 'loss',
  });

  if (!playerWon) {
    return {
      action_id: actionId,
      outcome: 'combat',
      monster: {
        id: monster.id,
        name: monster.name,
        icon_url: buildMonsterIconUrl(monster.icon_filename),
        max_hp: effectiveHp,
        attack: effectiveAttack,
        defense: effectiveDefense,
      },
      rounds,
      combat_result: 'loss',
    };
  }

  // ── Win: award XP ───────────────────────────────────────────────────────────
  await awardXp(character.id, monster.xp_reward);

  // ── Win: roll and award Crowns ──────────────────────────────────────────────
  const crownsDropped = rollCrownDrop(monster);
  if (crownsDropped > 0) {
    await awardCrowns(character.id, crownsDropped);
  }

  // ── Win: roll loot ──────────────────────────────────────────────────────────
  const lootTable = await getLootByMonsterId(monster.id);
  const itemsDropped: ItemDroppedDto[] = [];

  for (const entry of lootTable) {
    const dropRoll = Math.random() * 100;
    if (dropRoll < entry.drop_chance) {
      await grantItemToCharacter(session, character.id, entry.item_def_id, entry.quantity);
      itemsDropped.push({
        item_def_id: entry.item_def_id,
        name: entry.item_name,
        quantity: entry.quantity,
        icon_url: buildItemIconUrl(entry.icon_filename),
      });
    }
  }

  log('info', 'explore', 'combat_win_rewards', {
    characterId: character.id,
    actionId,
    monsterId: monster.id,
    xpAwarded: monster.xp_reward,
    crownsAwarded: crownsDropped,
    itemsDropped: itemsDropped.length,
  });

  return {
    action_id: actionId,
    outcome: 'combat',
    monster: {
      id: monster.id,
      name: monster.name,
      icon_url: buildMonsterIconUrl(monster.icon_filename),
      max_hp: effectiveHp,
      attack: effectiveAttack,
      defense: effectiveDefense,
    },
    rounds,
    combat_result: 'win',
    xp_gained: monster.xp_reward,
    items_dropped: itemsDropped,
    ...(crownsDropped > 0 && { crowns_gained: crownsDropped }),
  };
}
