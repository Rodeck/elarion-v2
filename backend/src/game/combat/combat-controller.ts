import { randomUUID } from 'crypto';
import { getInstance, addParticipant, setInCombat } from '../world/monster-registry';
import { getPlayerState } from '../world/zone-registry';
import { updateCharacter, findByAccountId } from '../../db/queries/characters';
import { query } from '../../db/connection';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import { runCombatAndStream } from './combat-streamer';
import type { AuthenticatedSession } from '../../websocket/server';
import type { CombatStartPayload } from '@elarion/protocol';

export async function handleCombatStart(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { monster_instance_id } = payload as CombatStartPayload;

  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'You need a character to start combat.',
    });
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'server.error', { code: 'INTERNAL_ERROR', message: 'Character not found.' });
    return;
  }

  if (character.in_combat) {
    sendToSession(session, 'server.error', {
      code: 'ALREADY_IN_COMBAT',
      message: 'You are already in combat.',
    });
    return;
  }

  const monster = getInstance(monster_instance_id);

  if (!monster) {
    sendToSession(session, 'server.error', {
      code: 'MONSTER_NOT_FOUND',
      message: 'That monster does not exist or is already dead.',
    });
    return;
  }

  if (monster.inCombat) {
    sendToSession(session, 'server.error', {
      code: 'ALREADY_IN_COMBAT',
      message: 'That monster is already in combat.',
    });
    return;
  }

  // Adjacency check
  const dx = Math.abs(character.pos_x - monster.posX);
  const dy = Math.abs(character.pos_y - monster.posY);
  if (dx + dy > 1) {
    sendToSession(session, 'server.error', {
      code: 'MONSTER_NOT_ADJACENT',
      message: 'Move closer to the monster before attacking.',
    });
    return;
  }

  // Mark both in combat
  await updateCharacter(character.id, { in_combat: true });
  setInCombat(monster_instance_id, true);
  addParticipant(monster_instance_id, character.id);

  // Create DB record
  const combatId = randomUUID();
  await query(
    `INSERT INTO combat_simulations (id, character_id, monster_id, zone_id)
     VALUES ($1, $2, $3, $4)`,
    [combatId, character.id, monster.templateId, monster.zoneId],
  );

  log('info', 'combat', 'started', {
    combatId,
    characterId: character.id,
    monsterInstanceId: monster_instance_id,
    monsterName: monster.name,
  });

  sendToSession(session, 'combat.started', {
    combat_id: combatId,
    monster: {
      instance_id: monster.instanceId,
      name: monster.name,
      max_hp: monster.maxHp,
      current_hp: monster.currentHp,
      attack_power: monster.attackPower,
      defence: monster.defence,
    },
  });

  // Run simulation asynchronously
  void runCombatAndStream(combatId, session, character, monster);
}
