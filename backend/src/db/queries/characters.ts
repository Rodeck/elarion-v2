import { query } from '../connection';

export interface CharacterClass {
  id: number;
  name: string;
  base_hp: number;
  base_attack: number;
  base_defence: number;
  hp_per_level: number;
  attack_per_level: number;
  defence_per_level: number;
  xp_curve: number[];
}

export interface Character {
  id: string;
  account_id: string;
  name: string;
  class_id: number;
  level: number;
  experience: number;
  max_hp: number;
  current_hp: number;
  attack_power: number;
  defence: number;
  zone_id: number;
  pos_x: number;
  pos_y: number;
  current_node_id: number | null;
  in_combat: boolean;
  in_gathering: boolean;
  crowns: number;
  updated_at: Date;
}

export interface InsertCharacterData {
  account_id: string;
  name: string;
  class_id: number;
  max_hp: number;
  current_hp: number;
  attack_power: number;
  defence: number;
  zone_id: number;
  pos_x: number;
  pos_y: number;
}

export async function insertCharacter(data: InsertCharacterData): Promise<Character> {
  const result = await query<Character>(
    `INSERT INTO characters
       (account_id, name, class_id, level, experience, max_hp, current_hp, attack_power, defence, zone_id, pos_x, pos_y)
     VALUES ($1, $2, $3, 1, 0, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.account_id, data.name, data.class_id,
      data.max_hp, data.current_hp, data.attack_power, data.defence,
      data.zone_id, data.pos_x, data.pos_y,
    ],
  );
  return result.rows[0]!;
}

export async function findByAccountId(accountId: string): Promise<Character | null> {
  const result = await query<Character>(
    `SELECT * FROM characters WHERE account_id = $1`,
    [accountId],
  );
  return result.rows[0] ?? null;
}

export async function updateCharacter(
  id: string,
  fields: Partial<Pick<Character, 'level' | 'experience' | 'max_hp' | 'current_hp' | 'attack_power' | 'defence' | 'zone_id' | 'pos_x' | 'pos_y' | 'in_combat' | 'in_gathering'>>,
): Promise<Character> {
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => fields[k]);

  const result = await query<Character>(
    `UPDATE characters SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values],
  );
  return result.rows[0]!;
}

export async function findAllClasses(): Promise<CharacterClass[]> {
  const result = await query<CharacterClass>(`SELECT * FROM character_classes ORDER BY id`);
  return result.rows;
}

export async function findClassById(id: number): Promise<CharacterClass | null> {
  const result = await query<CharacterClass>(
    `SELECT * FROM character_classes WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findByName(name: string): Promise<Character | null> {
  const result = await query<Character>(
    `SELECT * FROM characters WHERE name = $1`,
    [name],
  );
  return result.rows[0] ?? null;
}

export async function addCrowns(characterId: string, amount: number): Promise<number> {
  const result = await query<{ crowns: number }>(
    `UPDATE characters SET crowns = crowns + $2, updated_at = now() WHERE id = $1 RETURNING crowns`,
    [characterId, amount],
  );
  return result.rows[0]!.crowns;
}

export async function deductCrowns(characterId: string, amount: number): Promise<number | null> {
  const result = await query<{ crowns: number }>(
    `UPDATE characters SET crowns = crowns - $2, updated_at = now() WHERE id = $1 AND crowns >= $2 RETURNING crowns`,
    [characterId, amount],
  );
  return result.rows[0]?.crowns ?? null;
}

export async function updateCharacterNode(characterId: string, nodeId: number): Promise<void> {
  await query(
    `UPDATE characters SET current_node_id = $2, updated_at = now() WHERE id = $1`,
    [characterId, nodeId],
  );
}
