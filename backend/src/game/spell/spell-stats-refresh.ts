import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId } from '../../db/queries/characters';
import { getCharacterEffectiveStats } from '../../db/queries/inventory';
import { computeCombatStats } from '../combat/combat-stats-service';
import { getActiveSpellBuffModifiers } from './spell-buff-service';

/**
 * Send a lightweight character stats refresh to the client.
 * Used after spell cast to update stats display without re-sending full world state.
 */
export async function sendCharacterStatsRefresh(
  session: AuthenticatedSession,
  characterId: string,
): Promise<void> {
  const character = await findByAccountId(session.accountId);
  if (!character) return;

  const effectiveStats = await getCharacterEffectiveStats(characterId);
  const combatStats = await computeCombatStats(characterId);
  const spellMods = await getActiveSpellBuffModifiers(characterId);

  sendToSession(session, 'character.stats_refresh', {
    attack_power: effectiveStats.effective_attack,
    defence: effectiveStats.effective_defence,
    movement_speed: character.movement_speed + spellMods.movementSpeed,
    gear_crit_chance: Math.round(combatStats.critChance - character.attr_dexterity * 0.1),
    armor_penetration: combatStats.armorPenetration,
    additional_attacks: combatStats.additionalAttacks,
    current_hp: character.current_hp,
    max_hp: character.max_hp,
    current_energy: character.current_energy,
    max_energy: character.max_energy,
    crowns: character.crowns,
  });
}
