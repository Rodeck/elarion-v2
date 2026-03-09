import { query } from '../connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncounterEntry {
  id: number;
  zone_id: number;
  monster_id: number;
  weight: number;
}

export interface EncounterEntryWithName extends EncounterEntry {
  monster_name: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns monster_id + weight pairs for the given zone (used by encounter roll). */
export async function getEncounterTable(zoneId: number): Promise<{ monster_id: number; weight: number }[]> {
  const result = await query<{ monster_id: number; weight: number }>(
    `SELECT monster_id, weight FROM map_random_encounter_tables WHERE zone_id = $1`,
    [zoneId],
  );
  return result.rows;
}

/** Returns full entries including monster name — for the admin UI. */
export async function getEncounterEntriesForAdmin(zoneId: number): Promise<EncounterEntryWithName[]> {
  const result = await query<EncounterEntryWithName>(
    `SELECT e.id, e.zone_id, e.monster_id, e.weight, m.name AS monster_name
     FROM map_random_encounter_tables e
     JOIN monsters m ON m.id = e.monster_id
     WHERE e.zone_id = $1
     ORDER BY e.id`,
    [zoneId],
  );
  return result.rows;
}

/** Insert or update an encounter entry for a zone/monster pair. */
export async function upsertEncounterEntry(
  zoneId: number,
  monsterId: number,
  weight: number,
): Promise<EncounterEntry> {
  const result = await query<EncounterEntry>(
    `INSERT INTO map_random_encounter_tables (zone_id, monster_id, weight)
     VALUES ($1, $2, $3)
     ON CONFLICT (zone_id, monster_id) DO UPDATE SET weight = EXCLUDED.weight
     RETURNING *`,
    [zoneId, monsterId, weight],
  );
  return result.rows[0]!;
}

/** Delete a single encounter entry by its id. */
export async function deleteEncounterEntry(entryId: number): Promise<void> {
  await query(
    `DELETE FROM map_random_encounter_tables WHERE id = $1`,
    [entryId],
  );
}
