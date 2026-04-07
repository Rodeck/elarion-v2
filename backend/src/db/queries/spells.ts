import { query, getClient } from '../connection';
import { config } from '../../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpellRow {
  id: number;
  name: string;
  icon_filename: string | null;
  description: string;
  effect_type: string;
  effect_value: number;
  duration_seconds: number;
  created_at: Date;
}

export interface SpellLevelRow {
  spell_id: number;
  level: number;
  effect_value: number;
  duration_seconds: number;
  gold_cost: number;
}

export interface SpellCostRow {
  spell_id: number;
  level: number;
  item_def_id: number;
  quantity: number;
  item_name?: string;
  item_icon_filename?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildSpellIconUrl(filename: string | null): string | null {
  return filename ? `${config.adminBaseUrl}/spell-icons/${filename}` : null;
}

// ---------------------------------------------------------------------------
// Spell CRUD
// ---------------------------------------------------------------------------

export async function getAllSpells(): Promise<SpellRow[]> {
  const result = await query<SpellRow>(
    'SELECT * FROM spells ORDER BY name',
  );
  return result.rows;
}

export async function getSpellById(id: number): Promise<SpellRow | null> {
  const result = await query<SpellRow>(
    'SELECT * FROM spells WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createSpell(data: {
  name: string;
  icon_filename?: string | null;
  description?: string;
  effect_type: string;
  effect_value: number;
  duration_seconds?: number;
}): Promise<SpellRow> {
  const result = await query<SpellRow>(
    `INSERT INTO spells (name, icon_filename, description, effect_type, effect_value, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.name,
      data.icon_filename ?? null,
      data.description ?? '',
      data.effect_type,
      data.effect_value,
      data.duration_seconds ?? 0,
    ],
  );
  return result.rows[0]!;
}

export async function updateSpell(
  id: number,
  data: {
    name?: string;
    icon_filename?: string | null;
    description?: string;
    effect_type?: string;
    effect_value?: number;
    duration_seconds?: number;
  },
): Promise<SpellRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields = [
    'name', 'icon_filename', 'description', 'effect_type', 'effect_value', 'duration_seconds',
  ] as const;

  for (const field of fields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      values.push(data[field]);
    }
  }

  if (setClauses.length === 0) return getSpellById(id);

  values.push(id);
  const result = await query<SpellRow>(
    `UPDATE spells SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteSpell(id: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM spells WHERE id = $1',
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Spell levels
// ---------------------------------------------------------------------------

export async function getSpellLevels(spellId: number): Promise<SpellLevelRow[]> {
  const result = await query<SpellLevelRow>(
    `SELECT spell_id, level, effect_value, duration_seconds, gold_cost
     FROM spell_levels
     WHERE spell_id = $1
     ORDER BY level ASC`,
    [spellId],
  );
  return result.rows;
}

export async function getSpellLevelStats(
  spellId: number,
  level: number,
): Promise<SpellLevelRow | null> {
  const result = await query<SpellLevelRow>(
    `SELECT spell_id, level, effect_value, duration_seconds, gold_cost
     FROM spell_levels
     WHERE spell_id = $1 AND level <= $2
     ORDER BY level DESC
     LIMIT 1`,
    [spellId, level],
  );
  return result.rows[0] ?? null;
}

export async function upsertSpellLevels(
  spellId: number,
  levels: Array<{
    level: number;
    effect_value: number;
    duration_seconds: number;
    gold_cost: number;
  }>,
): Promise<SpellLevelRow[]> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM spell_levels WHERE spell_id = $1', [spellId]);

    const inserted: SpellLevelRow[] = [];
    for (const l of levels) {
      const result = await client.query<SpellLevelRow>(
        `INSERT INTO spell_levels (spell_id, level, effect_value, duration_seconds, gold_cost)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING spell_id, level, effect_value, duration_seconds, gold_cost`,
        [spellId, l.level, l.effect_value, l.duration_seconds, l.gold_cost],
      );
      inserted.push(result.rows[0]!);
    }

    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Spell costs
// ---------------------------------------------------------------------------

export async function getSpellCosts(spellId: number, level: number): Promise<SpellCostRow[]> {
  const result = await query<SpellCostRow>(
    `SELECT sc.spell_id, sc.level, sc.item_def_id, sc.quantity,
            id.name AS item_name, id.icon_filename AS item_icon_filename
     FROM spell_costs sc
     JOIN item_definitions id ON id.id = sc.item_def_id
     WHERE sc.spell_id = $1 AND sc.level = $2
     ORDER BY sc.item_def_id`,
    [spellId, level],
  );
  return result.rows;
}

export async function getAllSpellCosts(spellId: number): Promise<SpellCostRow[]> {
  const result = await query<SpellCostRow>(
    `SELECT sc.spell_id, sc.level, sc.item_def_id, sc.quantity,
            id.name AS item_name, id.icon_filename AS item_icon_filename
     FROM spell_costs sc
     JOIN item_definitions id ON id.id = sc.item_def_id
     WHERE sc.spell_id = $1
     ORDER BY sc.level, sc.item_def_id`,
    [spellId],
  );
  return result.rows;
}

export async function upsertSpellCosts(
  spellId: number,
  level: number,
  costs: Array<{ item_def_id: number; quantity: number }>,
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM spell_costs WHERE spell_id = $1 AND level = $2',
      [spellId, level],
    );

    for (const c of costs) {
      await client.query(
        `INSERT INTO spell_costs (spell_id, level, item_def_id, quantity)
         VALUES ($1, $2, $3, $4)`,
        [spellId, level, c.item_def_id, c.quantity],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
