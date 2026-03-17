import { query } from '../connection';
import { config } from '../../config';

export interface AbilityRow {
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
  slot_type: 'auto' | 'active' | 'both';
  created_at: Date;
}

export function buildAbilityIconUrl(filename: string | null): string | null {
  return filename ? `${config.adminBaseUrl}/ability-icons/${filename}` : null;
}

export async function getAllAbilities(): Promise<AbilityRow[]> {
  const result = await query<AbilityRow>(
    'SELECT * FROM abilities ORDER BY name',
  );
  return result.rows;
}

export async function getAbilityById(id: number): Promise<AbilityRow | null> {
  const result = await query<AbilityRow>(
    'SELECT * FROM abilities WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createAbility(data: {
  name: string;
  icon_filename?: string | null;
  description?: string;
  effect_type: string;
  mana_cost: number;
  effect_value: number;
  duration_turns?: number;
  cooldown_turns?: number;
  priority_default?: number;
  slot_type?: string;
}): Promise<AbilityRow> {
  const result = await query<AbilityRow>(
    `INSERT INTO abilities
       (name, icon_filename, description, effect_type, mana_cost, effect_value,
        duration_turns, cooldown_turns, priority_default, slot_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.icon_filename ?? null,
      data.description ?? '',
      data.effect_type,
      data.mana_cost,
      data.effect_value,
      data.duration_turns ?? 0,
      data.cooldown_turns ?? 0,
      data.priority_default ?? 1,
      data.slot_type ?? 'both',
    ],
  );
  return result.rows[0]!;
}

export async function updateAbility(
  id: number,
  data: {
    name?: string;
    icon_filename?: string | null;
    description?: string;
    mana_cost?: number;
    effect_value?: number;
    duration_turns?: number;
    cooldown_turns?: number;
    priority_default?: number;
    slot_type?: string;
  },
): Promise<AbilityRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields = [
    'name', 'icon_filename', 'description', 'mana_cost', 'effect_value',
    'duration_turns', 'cooldown_turns', 'priority_default', 'slot_type',
  ] as const;

  for (const field of fields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      values.push(data[field]);
    }
  }

  if (setClauses.length === 0) return getAbilityById(id);

  values.push(id);
  const result = await query<AbilityRow>(
    `UPDATE abilities SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteAbility(id: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM abilities WHERE id = $1',
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export interface MonsterAbilityLootRow {
  id: number;
  monster_id: number;
  ability_id: number;
  drop_chance: number;
}

export async function getAbilityLootByMonsterId(monsterId: number): Promise<Array<MonsterAbilityLootRow & { ability_name: string; icon_filename: string | null }>> {
  const result = await query<MonsterAbilityLootRow & { ability_name: string; icon_filename: string | null }>(
    `SELECT mal.*, a.name AS ability_name, a.icon_filename
     FROM monster_ability_loot mal
     JOIN abilities a ON a.id = mal.ability_id
     WHERE mal.monster_id = $1`,
    [monsterId],
  );
  return result.rows;
}
