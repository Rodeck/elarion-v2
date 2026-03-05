import { query } from '../connection';

export interface Monster {
  id: number;
  name: string;
  icon_filename: string | null;
  attack: number;
  defense: number;
  hp: number;
  xp_reward: number;
  created_at: Date;
}

export async function getAllMonsters(): Promise<Monster[]> {
  const result = await query<Monster>(
    'SELECT * FROM monsters ORDER BY name',
  );
  return result.rows;
}

export async function getMonsterById(id: number): Promise<Monster | null> {
  const result = await query<Monster>(
    'SELECT * FROM monsters WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createMonster(data: {
  name: string;
  icon_filename?: string | null;
  attack: number;
  defense: number;
  hp: number;
  xp_reward: number;
}): Promise<Monster> {
  const result = await query<Monster>(
    `INSERT INTO monsters (name, icon_filename, attack, defense, hp, xp_reward)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.name, data.icon_filename ?? null, data.attack, data.defense, data.hp, data.xp_reward],
  );
  return result.rows[0]!;
}

export async function updateMonster(
  id: number,
  data: {
    name?: string;
    icon_filename?: string | null;
    attack?: number;
    defense?: number;
    hp?: number;
    xp_reward?: number;
  },
): Promise<Monster | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
  if ('icon_filename' in data) { fields.push(`icon_filename = $${paramIdx++}`); values.push(data.icon_filename ?? null); }
  if (data.attack !== undefined) { fields.push(`attack = $${paramIdx++}`); values.push(data.attack); }
  if (data.defense !== undefined) { fields.push(`defense = $${paramIdx++}`); values.push(data.defense); }
  if (data.hp !== undefined) { fields.push(`hp = $${paramIdx++}`); values.push(data.hp); }
  if (data.xp_reward !== undefined) { fields.push(`xp_reward = $${paramIdx++}`); values.push(data.xp_reward); }

  if (fields.length === 0) return getMonsterById(id);

  values.push(id);
  const result = await query<Monster>(
    `UPDATE monsters SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteMonster(id: number): Promise<void> {
  await query('DELETE FROM monsters WHERE id = $1', [id]);
}
