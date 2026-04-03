import { query, getClient } from '../connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AbilityLevelRow {
  ability_id: number;
  level: number;
  effect_value: number;
  mana_cost: number;
  duration_turns: number;
  cooldown_turns: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get all level rows for an ability, ordered by level ascending. */
export async function getAbilityLevels(abilityId: number): Promise<AbilityLevelRow[]> {
  const result = await query<AbilityLevelRow>(
    `SELECT ability_id, level, effect_value, mana_cost, duration_turns, cooldown_turns
     FROM ability_levels
     WHERE ability_id = $1
     ORDER BY level ASC`,
    [abilityId],
  );
  return result.rows;
}

/**
 * Get stats for a specific ability level with fallback to the highest level
 * at or below the requested level. Returns null if no rows exist at all.
 */
export async function getAbilityLevelStats(
  abilityId: number,
  level: number,
): Promise<AbilityLevelRow | null> {
  const result = await query<AbilityLevelRow>(
    `SELECT ability_id, level, effect_value, mana_cost, duration_turns, cooldown_turns
     FROM ability_levels
     WHERE ability_id = $1 AND level <= $2
     ORDER BY level DESC
     LIMIT 1`,
    [abilityId, level],
  );
  return result.rows[0] ?? null;
}

/**
 * Bulk upsert ability levels using delete-then-insert in a transaction.
 * Replaces all existing level rows for the given ability.
 */
export async function upsertAbilityLevels(
  abilityId: number,
  levels: Array<{
    level: number;
    effect_value: number;
    mana_cost: number;
    duration_turns: number;
    cooldown_turns: number;
  }>,
): Promise<AbilityLevelRow[]> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM ability_levels WHERE ability_id = $1', [abilityId]);

    const inserted: AbilityLevelRow[] = [];
    for (const l of levels) {
      const result = await client.query<AbilityLevelRow>(
        `INSERT INTO ability_levels (ability_id, level, effect_value, mana_cost, duration_turns, cooldown_turns)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ability_id, level, effect_value, mana_cost, duration_turns, cooldown_turns`,
        [abilityId, l.level, l.effect_value, l.mana_cost, l.duration_turns, l.cooldown_turns],
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
