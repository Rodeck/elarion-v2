import { findByAccountId, findClassById } from '../../db/queries/characters';
import { log } from '../../logger';
import { sendToSession } from '../server';
import type { AuthenticatedSession } from '../server';

// Zone-registry and monster-registry will be populated in US2 and US3.
// For US1, we return empty arrays as placeholders.
// These are imported lazily to avoid circular deps once implemented.
let getZonePlayers: ((zoneId: number) => { characterId: string; name: string; classId: number; level: number; posX: number; posY: number }[]) | null = null;
let getZoneMonsters: ((zoneId: number) => { instance_id: string; template_id: number; name: string; max_hp: number; current_hp: number; pos_x: number; pos_y: number; in_combat: boolean }[]) | null = null;

export function setZonePlayersGetter(fn: typeof getZonePlayers): void {
  getZonePlayers = fn;
}

export function setZoneMonstersGetter(fn: typeof getZoneMonsters): void {
  getZoneMonsters = fn;
}

export async function sendWorldState(session: AuthenticatedSession): Promise<void> {
  if (!session.accountId) return;

  const character = await findByAccountId(session.accountId);
  if (!character) {
    log('warn', 'world-state', 'no_character', { accountId: session.accountId });
    return;
  }

  const cls = await findClassById(character.class_id);

  const players = getZonePlayers
    ? getZonePlayers(character.zone_id).map((p) => ({
        id: p.characterId,
        name: p.name,
        class_id: p.classId,
        level: p.level,
        pos_x: p.posX,
        pos_y: p.posY,
      }))
    : [];

  const monsters = getZoneMonsters ? getZoneMonsters(character.zone_id) : [];

  log('info', 'world-state', 'sent', {
    accountId: session.accountId,
    zone_id: character.zone_id,
    players: players.length,
    monsters: monsters.length,
  });

  sendToSession(session, 'world.state', {
    zone_id: character.zone_id,
    zone_name: cls ? `Zone ${character.zone_id}` : 'Unknown Zone',
    my_character: {
      id: character.id,
      name: character.name,
      class_id: character.class_id,
      class_name: cls?.name ?? 'Unknown',
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
    players,
    monsters,
  });
}
