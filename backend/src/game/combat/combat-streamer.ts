import { runSimulation } from './combat-engine';
import { handleCombatEnd } from './combat-end-handler';
import { getParticipants } from '../world/monster-registry';
import { getSessionByCharacterId, sendToSocket } from '../../websocket/server';
import { log } from '../../logger';
import type { AuthenticatedSession } from '../../websocket/server';
import type { MonsterInstance } from '../world/monster-registry';
import type { Character } from '../../db/queries/characters';

const ROUND_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendToParticipants(instanceId: string, type: string, payload: unknown): void {
  for (const characterId of getParticipants(instanceId)) {
    const session = getSessionByCharacterId(characterId);
    if (session) {
      sendToSocket(session.socket, type, payload);
    }
  }
}

export async function runCombatAndStream(
  combatId: string,
  _session: AuthenticatedSession,
  character: Character,
  monster: MonsterInstance,
): Promise<void> {
  const rounds = runSimulation(
    { name: character.name, hp: character.current_hp, attackPower: character.attack_power, defence: character.defence },
    { name: monster.name, hp: monster.currentHp, attackPower: monster.attackPower, defence: monster.defence },
  );

  log('info', 'combat', 'simulation_computed', {
    combatId,
    totalRounds: rounds.length,
    characterId: character.id,
  });

  for (const round of rounds) {
    await delay(ROUND_DELAY_MS);

    sendToParticipants(monster.instanceId, 'combat.round', {
      combat_id: combatId,
      round_number: round.roundNumber,
      attacker: round.attacker,
      attacker_name: round.attackerName,
      action: round.action,
      damage: round.damage,
      player_hp_after: round.playerHpAfter,
      monster_hp_after: round.monsterHpAfter,
    });
  }

  const lastRound = rounds[rounds.length - 1];
  const playerSurvived = lastRound ? lastRound.playerHpAfter > 0 : false;
  const finalPlayerHp = lastRound?.playerHpAfter ?? 0;

  await handleCombatEnd(combatId, character, monster, rounds, playerSurvived, finalPlayerHp);
}
