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
            COALESCE(al.mana_cost, a.mana_cost) AS mana_cost,
            COALESCE(al.effect_value, a.effect_value) AS effect_value,
            COALESCE(al.duration_turns, a.duration_turns) AS duration_turns,
            COALESCE(al.cooldown_turns, a.cooldown_turns) AS cooldown_turns,
            a.priority_default, a.slot_type
     FROM character_loadouts cl
     LEFT JOIN abilities a ON a.id = cl.ability_id
     LEFT JOIN character_ability_progress cap ON cap.character_id = cl.character_id AND cap.ability_id = cl.ability_id
     LEFT JOIN LATERAL (
       SELECT al2.effect_value, al2.mana_cost, al2.duration_turns, al2.cooldown_turns
       FROM ability_levels al2
       WHERE al2.ability_id = a.id AND al2.level <= COALESCE(cap.current_level, 1)
       ORDER BY al2.level DESC LIMIT 1
     ) al ON true
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
        level: 1,
        points: 0,
        points_to_next: 100,
        cooldown_until: null,
        current_level_stats: null,
        next_level_stats: null,
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
    skill_level: number | null;
    skill_points: number | null;
    last_book_used_at: string | null;
    al_level: number | null;
    al_effect_value: number | null;
    al_mana_cost: number | null;
    al_duration_turns: number | null;
    al_cooldown_turns: number | null;
    next_level: number | null;
    next_effect_value: number | null;
    next_mana_cost: number | null;
    next_duration_turns: number | null;
    next_cooldown_turns: number | null;
  }>(
    `SELECT a.id, a.name, a.icon_filename, a.description, a.effect_type,
            COALESCE(al.mana_cost, a.mana_cost) AS mana_cost,
            COALESCE(al.effect_value, a.effect_value) AS effect_value,
            COALESCE(al.duration_turns, a.duration_turns) AS duration_turns,
            COALESCE(al.cooldown_turns, a.cooldown_turns) AS cooldown_turns,
            a.priority_default, a.slot_type,
            COALESCE(cap.current_level, 1) AS skill_level,
            COALESCE(cap.current_points, 0) AS skill_points,
            cap.last_book_used_at,
            al.level AS al_level, al.effect_value AS al_effect_value, al.mana_cost AS al_mana_cost,
            al.duration_turns AS al_duration_turns, al.cooldown_turns AS al_cooldown_turns,
            al_next.level AS next_level, al_next.effect_value AS next_effect_value,
            al_next.mana_cost AS next_mana_cost, al_next.duration_turns AS next_duration_turns,
            al_next.cooldown_turns AS next_cooldown_turns
     FROM character_owned_abilities coa
     JOIN abilities a ON a.id = coa.ability_id
     LEFT JOIN character_ability_progress cap ON cap.character_id = coa.character_id AND cap.ability_id = coa.ability_id
     LEFT JOIN LATERAL (
       SELECT al2.level, al2.effect_value, al2.mana_cost, al2.duration_turns, al2.cooldown_turns
       FROM ability_levels al2
       WHERE al2.ability_id = a.id AND al2.level <= COALESCE(cap.current_level, 1)
       ORDER BY al2.level DESC LIMIT 1
     ) al ON true
     LEFT JOIN LATERAL (
       SELECT al3.level, al3.effect_value, al3.mana_cost, al3.duration_turns, al3.cooldown_turns
       FROM ability_levels al3
       WHERE al3.ability_id = a.id AND al3.level = COALESCE(cap.current_level, 1) + 1
     ) al_next ON true
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
    level: row.skill_level ?? 1,
    points: row.skill_points ?? 0,
    points_to_next: (row.skill_level ?? 1) >= 5 ? null : 100,
    cooldown_until: row.last_book_used_at
      ? new Date(new Date(row.last_book_used_at).getTime() + 6 * 60 * 60 * 1000).toISOString()
      : null,
    current_level_stats: row.al_level != null ? {
      level: row.al_level,
      effect_value: row.al_effect_value ?? 0,
      mana_cost: row.al_mana_cost ?? 0,
      duration_turns: row.al_duration_turns ?? 0,
      cooldown_turns: row.al_cooldown_turns ?? 0,
    } : null,
    next_level_stats: row.next_level != null ? {
      level: row.next_level,
      effect_value: row.next_effect_value ?? 0,
      mana_cost: row.next_mana_cost ?? 0,
      duration_turns: row.next_duration_turns ?? 0,
      cooldown_turns: row.next_cooldown_turns ?? 0,
    } : null,
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
