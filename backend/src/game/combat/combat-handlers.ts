/**
 * combat-handlers.ts
 *
 * WebSocket message handlers for combat and loadout operations.
 * Registered in backend/src/index.ts.
 */

import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import { CombatSessionManager } from './combat-session-manager';
import {
  getCharacterLoadout,
  getOwnedAbilities,
  upsertLoadoutSlot,
  characterOwnsAbility,
} from '../../db/queries/loadouts';
import { findByAccountId } from '../../db/queries/characters';
import type { AuthenticatedSession } from '../../websocket/server';
import type { LoadoutStatePayload, LoadoutUpdatedPayload, LoadoutUpdateRejectedPayload } from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Shared helper: build and send loadout:state for a character
// ---------------------------------------------------------------------------

export async function sendLoadoutState(session: AuthenticatedSession, characterId: string): Promise<void> {
  const [slots, ownedAbilities] = await Promise.all([
    getCharacterLoadout(characterId),
    getOwnedAbilities(characterId),
  ]);

  const payload: LoadoutStatePayload = { slots, owned_abilities: ownedAbilities };
  sendToSession(session, 'loadout:state', payload);
}

// ---------------------------------------------------------------------------
// combat:trigger_active
// ---------------------------------------------------------------------------

export async function handleCombatTriggerActive(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { combat_id } = payload as { combat_id: string };

  if (!session.characterId) return; // silently ignore

  const combatSession = CombatSessionManager.get(session.characterId);
  if (!combatSession) return; // no active session — silently ignore

  combatSession.triggerActive(combat_id);
}

// ---------------------------------------------------------------------------
// loadout:request
// ---------------------------------------------------------------------------

export async function handleLoadoutRequest(
  session: AuthenticatedSession,
  _payload: unknown,
): Promise<void> {
  if (!session.characterId) return;
  await sendLoadoutState(session, session.characterId);
}

// ---------------------------------------------------------------------------
// loadout:update
// ---------------------------------------------------------------------------

export async function handleLoadoutUpdate(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { slot_name, ability_id, priority } = payload as {
    slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
    ability_id: number | null;
    priority?: number;
  };

  if (!session.characterId) return;
  const characterId = session.characterId;

  // Load current character to check in_combat flag
  const character = await findByAccountId(session.accountId);
  if (!character) return;

  // Validation: cannot update while in combat
  if (character.in_combat) {
    const rejected: LoadoutUpdateRejectedPayload = {
      slot_name,
      reason: 'in_combat',
      message: 'Loadout cannot be changed during combat.',
    };
    sendToSession(session, 'loadout:update_rejected', rejected);
    return;
  }

  // Validation: if ability_id provided, character must own it
  if (ability_id !== null) {
    const owns = await characterOwnsAbility(characterId, ability_id);
    if (!owns) {
      const rejected: LoadoutUpdateRejectedPayload = {
        slot_name,
        reason: 'ability_not_owned',
        message: 'Your character does not own this ability.',
      };
      sendToSession(session, 'loadout:update_rejected', rejected);
      return;
    }
  }

  // Validation: slot type compatibility is enforced by the DB query layer
  // (auto slots accept slot_type 'auto'/'both'; active accepts 'active'/'both')
  // Application-level check:
  if (ability_id !== null) {
    const owned = await getOwnedAbilities(characterId);
    const ability = owned.find((a) => a.id === ability_id);
    if (ability) {
      const isAutoSlot = slot_name.startsWith('auto_');
      const slotTypeOk = isAutoSlot
        ? ability.slot_type === 'auto' || ability.slot_type === 'both'
        : ability.slot_type === 'active' || ability.slot_type === 'both';

      if (!slotTypeOk) {
        const rejected: LoadoutUpdateRejectedPayload = {
          slot_name,
          reason: 'slot_type_mismatch',
          message: `Ability "${ability.name}" cannot be placed in a ${isAutoSlot ? 'auto' : 'active'} slot.`,
        };
        sendToSession(session, 'loadout:update_rejected', rejected);
        return;
      }
    }
  }

  // Determine effective priority (default to 1)
  const effectivePriority = priority ?? 1;

  await upsertLoadoutSlot(characterId, slot_name, ability_id, effectivePriority);

  log('info', 'loadout', 'slot_updated', { characterId, slot_name, ability_id, priority: effectivePriority });

  // Send acknowledgement
  const updated: LoadoutUpdatedPayload = {
    slot_name,
    ability_id,
    priority: effectivePriority,
  };
  sendToSession(session, 'loadout:updated', updated);

  // Send full state refresh
  await sendLoadoutState(session, characterId);
}
