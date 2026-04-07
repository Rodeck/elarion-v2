import { query } from '../connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpellProgressRow {
  character_id: string;
  spell_id: number;
  current_level: number;
  current_points: number;
  last_book_used_at: Date | null;
  obtained_at: Date;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getSpellProgress(
  characterId: string,
  spellId: number,
): Promise<SpellProgressRow | null> {
  const result = await query<SpellProgressRow>(
    `SELECT character_id, spell_id, current_level, current_points, last_book_used_at, obtained_at
     FROM character_spells
     WHERE character_id = $1 AND spell_id = $2`,
    [characterId, spellId],
  );
  return result.rows[0] ?? null;
}

export async function getAllSpellProgress(
  characterId: string,
): Promise<SpellProgressRow[]> {
  const result = await query<SpellProgressRow>(
    `SELECT character_id, spell_id, current_level, current_points, last_book_used_at, obtained_at
     FROM character_spells
     WHERE character_id = $1
     ORDER BY spell_id`,
    [characterId],
  );
  return result.rows;
}

export async function upsertSpellProgress(
  characterId: string,
  spellId: number,
  level: number,
  points: number,
  lastBookUsedAt: Date,
): Promise<SpellProgressRow> {
  const result = await query<SpellProgressRow>(
    `INSERT INTO character_spells (character_id, spell_id, current_level, current_points, last_book_used_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (character_id, spell_id) DO UPDATE
       SET current_level = $3,
           current_points = $4,
           last_book_used_at = $5
     RETURNING character_id, spell_id, current_level, current_points, last_book_used_at, obtained_at`,
    [characterId, spellId, level, points, lastBookUsedAt],
  );
  return result.rows[0]!;
}

export async function grantSpellToCharacter(
  characterId: string,
  spellId: number,
): Promise<void> {
  await query(
    `INSERT INTO character_spells (character_id, spell_id, current_level, current_points)
     VALUES ($1, $2, 1, 0)
     ON CONFLICT (character_id, spell_id) DO NOTHING`,
    [characterId, spellId],
  );
}

export async function grantAllSpells(characterId: string): Promise<number> {
  const result = await query(
    `INSERT INTO character_spells (character_id, spell_id, current_level, current_points)
     SELECT $1, id, 1, 0 FROM spells
     ON CONFLICT (character_id, spell_id) DO NOTHING`,
    [characterId],
  );
  return result.rowCount ?? 0;
}

export async function characterOwnsSpell(
  characterId: string,
  spellId: number,
): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM character_spells WHERE character_id = $1 AND spell_id = $2
     ) AS exists`,
    [characterId, spellId],
  );
  return result.rows[0]?.exists ?? false;
}
