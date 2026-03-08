import { query } from '../connection';

export interface ImagePromptTemplate {
  id: number;
  name: string;
  body: string;
  created_at: Date;
  updated_at: Date;
}

export async function getAllPrompts(): Promise<ImagePromptTemplate[]> {
  const res = await query<ImagePromptTemplate>(
    'SELECT * FROM image_prompt_templates ORDER BY name ASC',
    [],
  );
  return res.rows;
}

export async function getPromptById(id: number): Promise<ImagePromptTemplate | null> {
  const res = await query<ImagePromptTemplate>(
    'SELECT * FROM image_prompt_templates WHERE id = $1',
    [id],
  );
  return res.rows[0] ?? null;
}

export async function createPrompt(data: { name: string; body: string }): Promise<ImagePromptTemplate> {
  const res = await query<ImagePromptTemplate>(
    `INSERT INTO image_prompt_templates (name, body)
     VALUES ($1, $2)
     RETURNING *`,
    [data.name.trim(), data.body],
  );
  return res.rows[0]!;
}

export async function updatePrompt(
  id: number,
  data: { name?: string; body?: string },
): Promise<ImagePromptTemplate | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name.trim()); }
  if (data.body !== undefined) { fields.push(`body = $${idx++}`); values.push(data.body); }
  if (fields.length === 0) return getPromptById(id);
  fields.push(`updated_at = NOW()`);
  values.push(id);
  const res = await query<ImagePromptTemplate>(
    `UPDATE image_prompt_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return res.rows[0] ?? null;
}

export async function deletePrompt(id: number): Promise<boolean> {
  const res = await query<ImagePromptTemplate>(
    'DELETE FROM image_prompt_templates WHERE id = $1',
    [id],
  );
  return (res.rowCount ?? 0) > 0;
}
