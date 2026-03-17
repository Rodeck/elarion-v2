import { getMonsterById } from '../../db/queries/monsters';
import { getPhase } from '../world/day-cycle-service';
import { log } from '../../logger';
import { CombatSessionManager } from './combat-session-manager';
import type { AuthenticatedSession } from '../../websocket/server';
import type { Character } from '../../db/queries/characters';
import type { Monster } from '../../db/queries/monsters';
import type { ExploreActionConfig } from '../../db/queries/city-maps';
import type { BuildingExploreResultPayload } from '../../../../shared/protocol/index';

const NIGHT_STAT_MULTIPLIER = 1.1;

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

  // ── Start real-time combat session ──────────────────────────────────────────
  // Build a night-adjusted monster snapshot so CombatSession uses the correct stats.
  const effectiveMonster: Monster = {
    ...monster,
    hp:      effectiveHp,
    attack:  effectiveAttack,
    defense: effectiveDefense,
  };

  // Non-blocking: session runs its own async turn loop internally.
  void CombatSessionManager.start(session, character, effectiveMonster);

  return { action_id: actionId, outcome: 'combat_started' };
}
