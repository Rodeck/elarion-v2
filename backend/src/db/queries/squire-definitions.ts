import { query } from '../connection';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SquireDefinition {
  id: number;
  name: string;
  icon_filename: string | null;
  power_level: number;
  is_active: boolean;
  created_at: Date;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function createSquireDefinition(data: {
  name: string;
  power_level: number;
}): Promise<SquireDefinition> {
  const result = await query<SquireDefinition>(
    `INSERT INTO squire_definitions (name, power_level)
     VALUES ($1, $2)
     RETURNING *`,
    [data.name, data.power_level],
  );
  return result.rows[0]!;
}

export async function getSquireDefinitionById(id: number): Promise<SquireDefinition | null> {
  const result = await query<SquireDefinition>(
    `SELECT * FROM squire_definitions WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getAllSquireDefinitions(): Promise<SquireDefinition[]> {
  const result = await query<SquireDefinition>(
    `SELECT * FROM squire_definitions ORDER BY id`,
  );
  return result.rows;
}

export async function getActiveSquireDefinitions(): Promise<SquireDefinition[]> {
  const result = await query<SquireDefinition>(
    `SELECT * FROM squire_definitions WHERE is_active = true ORDER BY id`,
  );
  return result.rows;
}

export async function updateSquireDefinition(
  id: number,
  data: { name?: string; power_level?: number; icon_filename?: string },
): Promise<SquireDefinition | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.power_level !== undefined) { fields.push(`power_level = $${paramIdx++}`); values.push(data.power_level); }
  if (data.icon_filename !== undefined) { fields.push(`icon_filename = $${paramIdx++}`); values.push(data.icon_filename); }

  if (fields.length === 0) {
    return getSquireDefinitionById(id);
  }

  values.push(id);
  const result = await query<SquireDefinition>(
    `UPDATE squire_definitions SET ${fields.join(', ')} WHERE id = $${paramIdx}
     RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deactivateSquireDefinition(id: number): Promise<SquireDefinition | null> {
  const result = await query<SquireDefinition>(
    `UPDATE squire_definitions SET is_active = false WHERE id = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function hasPlayersOwningDefinition(squireDefId: number): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM character_squires WHERE squire_def_id = $1`,
    [squireDefId],
  );
  return parseInt(result.rows[0]!.count, 10) > 0;
}
