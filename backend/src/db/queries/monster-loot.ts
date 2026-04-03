import { query } from '../connection';

export interface MonsterLootEntry {
  id: number;
  monster_id: number;
  item_def_id: number | null;
  item_category: string | null;
  drop_chance: number;
  quantity: number;
  item_name: string | null;
  icon_filename: string | null;
}

export async function getLootByMonsterId(monsterId: number): Promise<MonsterLootEntry[]> {
  const result = await query<MonsterLootEntry>(
    `SELECT ml.id, ml.monster_id, ml.item_def_id, ml.item_category, ml.drop_chance, ml.quantity,
            id.name AS item_name, id.icon_filename
     FROM monster_loot ml
     LEFT JOIN item_definitions id ON id.id = ml.item_def_id
     WHERE ml.monster_id = $1
     ORDER BY ml.id`,
    [monsterId],
  );
  return result.rows;
}

export async function addLootEntry(data: {
  monster_id: number;
  item_def_id?: number | null;
  item_category?: string | null;
  drop_chance: number;
  quantity: number;
}): Promise<MonsterLootEntry> {
  const result = await query<MonsterLootEntry>(
    `INSERT INTO monster_loot (monster_id, item_def_id, item_category, drop_chance, quantity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, monster_id, item_def_id, item_category, drop_chance, quantity,
               (SELECT name FROM item_definitions WHERE id = item_def_id) AS item_name,
               (SELECT icon_filename FROM item_definitions WHERE id = item_def_id) AS icon_filename`,
    [data.monster_id, data.item_def_id ?? null, data.item_category ?? null, data.drop_chance, data.quantity],
  );
  return result.rows[0]!;
}

export async function updateLootEntry(
  id: number,
  data: { drop_chance?: number; quantity?: number },
): Promise<MonsterLootEntry | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.drop_chance !== undefined) { fields.push(`drop_chance = $${paramIdx++}`); values.push(data.drop_chance); }
  if (data.quantity !== undefined) { fields.push(`quantity = $${paramIdx++}`); values.push(data.quantity); }

  if (fields.length === 0) {
    const result = await query<MonsterLootEntry>(
      `SELECT ml.id, ml.monster_id, ml.item_def_id, ml.drop_chance, ml.quantity,
              id.name AS item_name, id.icon_filename
       FROM monster_loot ml
       JOIN item_definitions id ON id.id = ml.item_def_id
       WHERE ml.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  values.push(id);
  const result = await query<MonsterLootEntry>(
    `UPDATE monster_loot SET ${fields.join(', ')} WHERE id = $${paramIdx}
     RETURNING id, monster_id, item_def_id, drop_chance, quantity,
               (SELECT name FROM item_definitions WHERE id = item_def_id) AS item_name,
               (SELECT icon_filename FROM item_definitions WHERE id = item_def_id) AS icon_filename`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteLootEntry(id: number): Promise<void> {
  await query('DELETE FROM monster_loot WHERE id = $1', [id]);
}
