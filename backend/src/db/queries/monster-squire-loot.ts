import { query } from '../connection';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MonsterSquireLootEntry {
  id: number;
  monster_id: number;
  squire_def_id: number;
  drop_chance: number;
  squire_level: number;
  squire_name: string;
  icon_filename: string | null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getSquireLootByMonsterId(monsterId: number): Promise<MonsterSquireLootEntry[]> {
  const result = await query<MonsterSquireLootEntry>(
    `SELECT msl.id, msl.monster_id, msl.squire_def_id, msl.drop_chance, msl.squire_level,
            sd.name AS squire_name, sd.icon_filename
     FROM monster_squire_loot msl
     JOIN squire_definitions sd ON sd.id = msl.squire_def_id
     WHERE msl.monster_id = $1
     ORDER BY msl.id`,
    [monsterId],
  );
  return result.rows;
}

export async function addSquireLootEntry(data: {
  monster_id: number;
  squire_def_id: number;
  drop_chance: number;
  squire_level: number;
}): Promise<MonsterSquireLootEntry> {
  const result = await query<MonsterSquireLootEntry>(
    `INSERT INTO monster_squire_loot (monster_id, squire_def_id, drop_chance, squire_level)
     VALUES ($1, $2, $3, $4)
     RETURNING id, monster_id, squire_def_id, drop_chance, squire_level,
               (SELECT name FROM squire_definitions WHERE id = $2) AS squire_name,
               (SELECT icon_filename FROM squire_definitions WHERE id = $2) AS icon_filename`,
    [data.monster_id, data.squire_def_id, data.drop_chance, data.squire_level],
  );
  return result.rows[0]!;
}

export async function updateSquireLootEntry(
  id: number,
  data: { drop_chance?: number; squire_level?: number },
): Promise<MonsterSquireLootEntry | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.drop_chance !== undefined) { fields.push(`drop_chance = $${paramIdx++}`); values.push(data.drop_chance); }
  if (data.squire_level !== undefined) { fields.push(`squire_level = $${paramIdx++}`); values.push(data.squire_level); }

  if (fields.length === 0) {
    const result = await query<MonsterSquireLootEntry>(
      `SELECT msl.id, msl.monster_id, msl.squire_def_id, msl.drop_chance, msl.squire_level,
              sd.name AS squire_name, sd.icon_filename
       FROM monster_squire_loot msl
       JOIN squire_definitions sd ON sd.id = msl.squire_def_id
       WHERE msl.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  values.push(id);
  const result = await query<MonsterSquireLootEntry>(
    `UPDATE monster_squire_loot SET ${fields.join(', ')} WHERE id = $${paramIdx}
     RETURNING id, monster_id, squire_def_id, drop_chance, squire_level,
               (SELECT name FROM squire_definitions WHERE id = squire_def_id) AS squire_name,
               (SELECT icon_filename FROM squire_definitions WHERE id = squire_def_id) AS icon_filename`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteSquireLootEntry(id: number): Promise<void> {
  await query('DELETE FROM monster_squire_loot WHERE id = $1', [id]);
}
