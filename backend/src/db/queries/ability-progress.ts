import { query } from '../connection';

export interface AbilityProgressRow {
  character_id: string;
  ability_id: number;
  current_level: number;
  current_points: number;
  last_book_used_at: Date | null;
}

export async function getAbilityProgress(
  characterId: string,
  abilityId: number,
): Promise<AbilityProgressRow | null> {
  const result = await query<AbilityProgressRow>(
    `SELECT character_id, ability_id, current_level, current_points, last_book_used_at
     FROM character_ability_progress
     WHERE character_id = $1 AND ability_id = $2`,
    [characterId, abilityId],
  );
  return result.rows[0] ?? null;
}

export async function getAllAbilityProgress(
  characterId: string,
): Promise<AbilityProgressRow[]> {
  const result = await query<AbilityProgressRow>(
    `SELECT character_id, ability_id, current_level, current_points, last_book_used_at
     FROM character_ability_progress
     WHERE character_id = $1
     ORDER BY ability_id`,
    [characterId],
  );
  return result.rows;
}

export async function upsertAbilityProgress(
  characterId: string,
  abilityId: number,
  level: number,
  points: number,
  lastBookUsedAt: Date,
): Promise<AbilityProgressRow> {
  const result = await query<AbilityProgressRow>(
    `INSERT INTO character_ability_progress (character_id, ability_id, current_level, current_points, last_book_used_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (character_id, ability_id) DO UPDATE
       SET current_level = $3,
           current_points = $4,
           last_book_used_at = $5
     RETURNING character_id, ability_id, current_level, current_points, last_book_used_at`,
    [characterId, abilityId, level, points, lastBookUsedAt],
  );
  return result.rows[0]!;
}
