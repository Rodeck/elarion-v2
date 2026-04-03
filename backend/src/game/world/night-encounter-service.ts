import { getMonsterById } from '../../db/queries/monsters';
import { getLootByMonsterId } from '../../db/queries/monster-loot';
import { getRandomItemByCategory } from '../../db/queries/inventory';
import { getEncounterTable } from '../../db/queries/encounter-tables';
import { findByAccountId } from '../../db/queries/characters';
import { awardXp } from '../progression/xp-service';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { awardCrowns, rollCrownDrop } from '../currency/crown-service';
import { getPhase } from './day-cycle-service';
import { sendToSession } from '../../websocket/server';
import { log } from '../../logger';
import { config } from '../../config';
import type { AuthenticatedSession } from '../../websocket/server';
import type { Character } from '../../db/queries/characters';
import type { CombatRoundRecord, ItemDroppedDto } from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENCOUNTER_CHANCE = 0.1; // 10% per node step during night
const NIGHT_STAT_MULTIPLIER = 1.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMonsterIconUrl(filename: string | null): string | null {
  return filename ? `${config.adminBaseUrl}/monster-icons/${filename}` : null;
}

function buildItemIconUrl(filename: string | null): string | null {
  return filename ? `${config.adminBaseUrl}/item-icons/${filename}` : null;
}

/** Select a monster_id from a weighted table. Returns null if the table is empty. */
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Roll for a random encounter during night movement.
 *
 * Called once per node step.  Does nothing during daytime.
 * On an encounter, runs the combat loop with a 10% night stat bonus applied
 * to the monster, sends `night.encounter_result` to the player, and returns
 * `true` so the caller can cancel further movement.
 *
 * Returns `true` if an encounter occurred (movement should be cancelled),
 * `false` otherwise.
 */
export async function rollNightEncounter(
  session: AuthenticatedSession,
  character: Character,
  zoneId: number,
): Promise<boolean> {
  if (getPhase() !== 'night') return false;

  const encounterRoll = Math.random();
  if (encounterRoll >= ENCOUNTER_CHANCE) {
    return false;
  }

  // Pick monster from zone encounter table
  const table = await getEncounterTable(zoneId);
  const monsterId = pickMonster(table);
  if (monsterId === null) {
    log('warn', 'night-encounter', 'no_encounter_table', { characterId: character.id, zoneId });
    return false;
  }

  const monster = await getMonsterById(monsterId);
  if (!monster) {
    log('warn', 'night-encounter', 'monster_not_found', { characterId: character.id, monsterId });
    return false;
  }

  // Apply 10% night stat bonus to monster
  const nightHp      = Math.ceil(monster.hp * NIGHT_STAT_MULTIPLIER);
  const nightAttack  = Math.ceil(monster.attack * NIGHT_STAT_MULTIPLIER);
  const nightDefense = Math.ceil(monster.defense * NIGHT_STAT_MULTIPLIER);

  log('info', 'night-encounter', 'encounter_started', {
    characterId: character.id,
    zoneId,
    monsterId: monster.id,
    monsterName: monster.name,
    nightHp,
    nightAttack,
    nightDefense,
  });

  // ── Combat loop ─────────────────────────────────────────────────────────────
  let playerHp = character.max_hp;
  let monsterHp = nightHp;
  const rounds: CombatRoundRecord[] = [];

  while (playerHp > 0 && monsterHp > 0) {
    const roundNum = rounds.length + 1;

    const playerDmg = Math.max(1, character.attack_power - nightDefense);
    monsterHp = Math.max(0, monsterHp - playerDmg);

    let monsterDmg = 0;
    if (monsterHp > 0) {
      monsterDmg = Math.max(1, nightAttack - character.defence);
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

  log('info', 'night-encounter', 'combat_resolved', {
    characterId: character.id,
    monsterId: monster.id,
    rounds: rounds.length,
    result: playerWon ? 'win' : 'loss',
  });

  let xpGained: number | undefined;
  let crownsGained: number | undefined;
  const itemsDropped: ItemDroppedDto[] = [];

  if (playerWon) {
    await awardXp(character.id, monster.xp_reward);
    xpGained = monster.xp_reward;

    const crownsDropped = rollCrownDrop(monster);
    if (crownsDropped > 0) {
      await awardCrowns(character.id, crownsDropped);
      crownsGained = crownsDropped;
    }

    const lootTable = await getLootByMonsterId(monster.id);
    for (const entry of lootTable) {
      if (Math.random() * 100 < entry.drop_chance) {
        let itemDefId = entry.item_def_id;
        let itemName = entry.item_name;
        let iconFilename = entry.icon_filename;

        if (!itemDefId && entry.item_category) {
          const picked = await getRandomItemByCategory(entry.item_category);
          if (!picked) continue;
          itemDefId = picked.id;
          itemName = picked.name;
          iconFilename = picked.icon_filename;
        }
        if (!itemDefId) continue;

        await grantItemToCharacter(session, character.id, itemDefId, entry.quantity);
        itemsDropped.push({
          item_def_id: itemDefId,
          name: itemName ?? 'Unknown',
          quantity: entry.quantity,
          icon_url: buildItemIconUrl(iconFilename),
        });
      }
    }

    log('info', 'night-encounter', 'combat_win_rewards', {
      characterId: character.id,
      monsterId: monster.id,
      xpAwarded: xpGained,
      crownsAwarded: crownsDropped,
      itemsDropped: itemsDropped.length,
    });
  }

  sendToSession(session, 'night.encounter_result', {
    outcome: 'combat',
    monster: {
      id: monster.id,
      name: monster.name,
      icon_url: buildMonsterIconUrl(monster.icon_filename),
      max_hp: nightHp,
      attack: nightAttack,
      defense: nightDefense,
    },
    rounds,
    combat_result: playerWon ? 'win' : 'loss',
    xp_gained: xpGained,
    items_dropped: itemsDropped.length > 0 ? itemsDropped : undefined,
    crowns_gained: crownsGained,
  });

  return true;
}

/**
 * Convenience wrapper for tile-based movement — loads character from DB by accountId.
 * Skips immediately if not night.
 */
export async function rollNightEncounterByAccount(
  session: AuthenticatedSession,
  accountId: string,
  zoneId: number,
): Promise<boolean> {
  if (getPhase() !== 'night') return false;
  const character = await findByAccountId(accountId);
  if (!character) return false;
  return rollNightEncounter(session, character, zoneId);
}
