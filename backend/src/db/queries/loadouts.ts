import { query } from '../connection';
import type { OwnedAbilityDto, LoadoutSlotDto } from '../../../../shared/protocol/index';
import { buildAbilityIconUrl } from './abilities';

export async function getCharacterLoadout(characterId: string): Promise<LoadoutSlotDto[]> {
  const result = await query<{
    slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
    ability_id: number | null;
    priority: number;
    id: number | null;
    name: string | null;
    icon_filename: string | null;
    description: string | null;
    effect_type: string | null;
    mana_cost: number | null;
    effect_value: number | null;
    duration_turns: number | null;
    cooldown_turns: number | null;
    priority_default: number | null;
    slot_type: string | null;
  }>(
    `SELECT cl.slot_name, cl.ability_id, cl.priority,
            a.id, a.name, a.icon_filename, a.description, a.effect_type,
            a.mana_cost, a.effect_value, a.duration_turns, a.cooldown_turns,
            a.priority_default, a.slot_type
     FROM character_loadouts cl
     LEFT JOIN abilities a ON a.id = cl.ability_id
     WHERE cl.character_id = $1
     ORDER BY cl.slot_name`,
    [characterId],
  );

  return result.rows.map((row) => {
    const slot: LoadoutSlotDto = {
      slot_name: row.slot_name,
      ability_id: row.ability_id,
      priority: row.priority,
    };
    if (row.id !== null && row.name !== null) {
      slot.ability = {
        id: row.id,
        name: row.name,
        icon_url: buildAbilityIconUrl(row.icon_filename),
        description: row.description ?? '',
        effect_type: row.effect_type ?? '',
        mana_cost: row.mana_cost ?? 0,
        effect_value: row.effect_value ?? 0,
        duration_turns: row.duration_turns ?? 0,
        cooldown_turns: row.cooldown_turns ?? 0,
        priority_default: row.priority_default ?? 1,
        slot_type: (row.slot_type ?? 'both') as 'auto' | 'active' | 'both',
      };
    }
    return slot;
  });
}

export async function getOwnedAbilities(characterId: string): Promise<OwnedAbilityDto[]> {
  const result = await query<{
    id: number;
    name: string;
    icon_filename: string | null;
    description: string;
    effect_type: string;
    mana_cost: number;
    effect_value: number;
    duration_turns: number;
    cooldown_turns: number;
    priority_default: number;
    slot_type: string;
  }>(
    `SELECT a.id, a.name, a.icon_filename, a.description, a.effect_type,
            a.mana_cost, a.effect_value, a.duration_turns, a.cooldown_turns,
            a.priority_default, a.slot_type
     FROM character_owned_abilities coa
     JOIN abilities a ON a.id = coa.ability_id
     WHERE coa.character_id = $1
     ORDER BY a.name`,
    [characterId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon_url: buildAbilityIconUrl(row.icon_filename),
    description: row.description,
    effect_type: row.effect_type,
    mana_cost: row.mana_cost,
    effect_value: row.effect_value,
    duration_turns: row.duration_turns,
    cooldown_turns: row.cooldown_turns,
    priority_default: row.priority_default,
    slot_type: row.slot_type as 'auto' | 'active' | 'both',
  }));
}

export async function upsertLoadoutSlot(
  characterId: string,
  slotName: 'auto_1' | 'auto_2' | 'auto_3' | 'active',
  abilityId: number | null,
  priority: number,
): Promise<void> {
  await query(
    `INSERT INTO character_loadouts (character_id, slot_name, ability_id, priority)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (character_id, slot_name)
     DO UPDATE SET ability_id = EXCLUDED.ability_id, priority = EXCLUDED.priority`,
    [characterId, slotName, abilityId, priority],
  );
}

export async function grantAbilityToCharacter(
  characterId: string,
  abilityId: number,
): Promise<void> {
  await query(
    `INSERT INTO character_owned_abilities (character_id, ability_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [characterId, abilityId],
  );
}

export async function characterOwnsAbility(
  characterId: string,
  abilityId: number,
): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM character_owned_abilities
       WHERE character_id = $1 AND ability_id = $2
     ) AS exists`,
    [characterId, abilityId],
  );
  return result.rows[0]?.exists ?? false;
}

export async function setCharacterInCombat(
  characterId: string,
  inCombat: boolean,
): Promise<void> {
  await query(
    'UPDATE characters SET in_combat = $1 WHERE id = $2',
    [inCombat, characterId],
  );
}
