import { findByAccountId, insertCharacter, findClassById } from '../../db/queries/characters';
import { getZone } from './zone-loader';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import type { CharacterCreatePayload } from '@elarion/protocol';

const VALID_CLASS_IDS = new Set([1, 2, 3]);
const NAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const STARTER_ZONE_ID = 1;

export async function handleCharacterCreate(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { name, class_id } = payload as CharacterCreatePayload;

  // Guard: account must be authenticated
  if (!session.accountId) {
    sendToSession(session, 'server.error', {
      code: 'NOT_AUTHENTICATED',
      message: 'You must be logged in to create a character.',
    });
    return;
  }

  // Guard: account must not already have a character
  const existing = await findByAccountId(session.accountId);
  if (existing) {
    log('info', 'character', 'create_rejected', { reason: 'character_exists', accountId: session.accountId });
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_EXISTS',
      message: 'Your account already has a character.',
    });
    return;
  }

  // Validate name
  if (!NAME_REGEX.test(name)) {
    log('info', 'character', 'create_rejected', { reason: 'name_invalid', name });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Character name must be 3–32 characters and contain only letters, numbers, and underscores.',
    });
    return;
  }

  // Validate class
  if (!VALID_CLASS_IDS.has(class_id)) {
    log('info', 'character', 'create_rejected', { reason: 'invalid_class_id', class_id });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Invalid class selection.',
    });
    return;
  }

  const cls = await findClassById(class_id);
  if (!cls) {
    log('error', 'character', 'create_error', { reason: 'class_not_found', class_id });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Character class data not found.',
    });
    return;
  }

  const zone = getZone(STARTER_ZONE_ID);
  const spawnX = zone?.spawnX ?? 5;
  const spawnY = zone?.spawnY ?? 5;

  const character = await insertCharacter({
    account_id: session.accountId,
    name,
    class_id,
    max_hp: cls.base_hp,
    current_hp: cls.base_hp,
    attack_power: cls.base_attack,
    defence: cls.base_defence,
    zone_id: STARTER_ZONE_ID,
    pos_x: spawnX,
    pos_y: spawnY,
  });

  session.characterId = character.id;

  log('info', 'character', 'create_success', {
    accountId: session.accountId,
    characterId: character.id,
    name: character.name,
  });

  sendToSession(session, 'character.created', {
    character: {
      id: character.id,
      name: character.name,
      class_id: character.class_id,
      class_name: cls.name,
      level: character.level,
      experience: character.experience,
      max_hp: character.max_hp,
      current_hp: character.current_hp,
      attack_power: character.attack_power,
      defence: character.defence,
      zone_id: character.zone_id,
      pos_x: character.pos_x,
      pos_y: character.pos_y,
    },
  });
}
