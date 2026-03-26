/**
 * squire-grant-service.ts
 *
 * Central service for granting squires to characters and building roster DTOs.
 * Used by combat, quests, gathering, and world-state handlers.
 */

import { log } from '../../logger';
import { config } from '../../config';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import {
  canAcquireSquire,
  createCharacterSquire,
  getSquiresForCharacter,
  getActiveExpeditionsForCharacter,
} from '../../db/queries/squires';
import type { CharacterSquire } from '../../db/queries/squires';
import { query } from '../../db/connection';
import type {
  CharacterSquireDto,
  SquireRosterDto,
  SquireAcquiredPayload,
  SquireAcquisitionFailedPayload,
} from '@elarion/protocol';
import { getSquireRank, MAX_SQUIRE_SLOTS } from '../../../../shared/protocol/index';

// ─── DTO builders ────────────────────────────────────────────────────────────

function buildSquireIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/squire-icons/${iconFilename}`;
}

export function buildCharacterSquireDto(
  squire: CharacterSquire,
  isOnExpedition: boolean,
  expeditionInfo?: { building_name: string; started_at: string; completes_at: string },
): CharacterSquireDto {
  return {
    id: squire.id,
    squire_def_id: squire.squire_def_id,
    name: squire.name,
    icon_url: buildSquireIconUrl(squire.icon_filename),
    level: squire.level,
    rank: getSquireRank(squire.level),
    power_level: squire.power_level,
    status: isOnExpedition ? 'on_expedition' : 'idle',
    expedition: expeditionInfo,
  };
}

export async function buildSquireRosterDto(characterId: string): Promise<SquireRosterDto> {
  const squires = await getSquiresForCharacter(characterId);
  const activeExpeditions = await getActiveExpeditionsForCharacter(characterId);

  // Map squire_id → expedition with building name
  const expeditionBySquireId = new Map<number, { building_name: string; started_at: string; completes_at: string }>();
  for (const exp of activeExpeditions) {
    const bldgResult = await query<{ name: string }>(
      `SELECT name FROM buildings WHERE id = $1`,
      [exp.building_id],
    );
    expeditionBySquireId.set(exp.squire_id, {
      building_name: bldgResult.rows[0]?.name ?? 'Unknown',
      started_at: exp.started_at.toISOString(),
      completes_at: exp.completes_at.toISOString(),
    });
  }

  // Get slots_unlocked from characters table
  const charResult = await query<{ squire_slots_unlocked: number }>(
    `SELECT squire_slots_unlocked FROM characters WHERE id = $1`,
    [characterId],
  );
  const slotsUnlocked = charResult.rows[0]?.squire_slots_unlocked ?? 2;

  return {
    squires: squires.map((s) => {
      const expInfo = expeditionBySquireId.get(s.id);
      return buildCharacterSquireDto(s, !!expInfo, expInfo);
    }),
    slots_unlocked: slotsUnlocked,
    slots_total: MAX_SQUIRE_SLOTS,
  };
}

// ─── Grant squire ────────────────────────────────────────────────────────────

export async function grantSquireToCharacter(
  session: AuthenticatedSession,
  characterId: string,
  squireDefId: number,
  level: number,
  source: SquireAcquiredPayload['source'],
): Promise<boolean> {
  const canAcquire = await canAcquireSquire(characterId);

  if (!canAcquire) {
    // Get squire name for the failure message
    const defResult = await query<{ name: string }>(
      `SELECT name FROM squire_definitions WHERE id = $1`,
      [squireDefId],
    );
    const squireName = defResult.rows[0]?.name ?? 'Unknown';

    log('info', 'squire', 'squire_acquisition_failed', {
      characterId,
      squireDefId,
      level,
      source,
      reason: 'ROSTER_FULL',
    });

    const failPayload: SquireAcquisitionFailedPayload = {
      reason: 'ROSTER_FULL',
      squire_name: squireName,
    };
    sendToSession(session, 'squire.acquisition_failed', failPayload);
    return false;
  }

  const squire = await createCharacterSquire(characterId, squireDefId, level);
  const roster = await buildSquireRosterDto(characterId);
  const squireDto = buildCharacterSquireDto(squire, false);

  log('info', 'squire', 'squire_acquired', {
    characterId,
    squireId: squire.id,
    squireDefId,
    squireName: squire.name,
    level,
    source,
  });

  const acquiredPayload: SquireAcquiredPayload = {
    squire: squireDto,
    source,
    updated_roster: roster,
  };
  sendToSession(session, 'squire.acquired', acquiredPayload);
  return true;
}

// ─── Roster request handler ──────────────────────────────────────────────────

export async function handleSquireRoster(session: AuthenticatedSession): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) return;

  const roster = await buildSquireRosterDto(characterId);
  sendToSession(session, 'squire.roster_update', roster);
}
