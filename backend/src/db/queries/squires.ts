import { query } from '../connection';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CharacterSquire {
  id: number;
  character_id: string;
  squire_def_id: number;
  level: number;
  created_at: Date;
  /** Joined from squire_definitions */
  name: string;
  icon_filename: string | null;
  power_level: number;
}

export interface ExpeditionRewardSnapshot {
  gold: number;
  exp: number;
  items: { item_def_id: number; name: string; quantity: number }[];
}

export interface ExpeditionActionConfig {
  name?: string;
  base_gold: number;
  base_exp: number;
  items: { item_def_id: number; base_quantity: number }[];
}

export interface SquireExpedition {
  id: number;
  squire_id: number;
  character_id: string;
  building_id: number;
  action_id: number;
  duration_hours: 1 | 3 | 6;
  reward_snapshot: ExpeditionRewardSnapshot;
  started_at: Date;
  completes_at: Date;
  collected_at: Date | null;
  notified_at: Date | null;
}

export interface CompletedExpeditionRow extends SquireExpedition {
  building_name: string;
  squire_name: string;
}

// ─── Squire queries ───────────────────────────────────────────────────────────

const SQUIRE_SELECT = `
  cs.id, cs.character_id, cs.squire_def_id, cs.level, cs.created_at,
  sd.name, sd.icon_filename, sd.power_level
`;

const SQUIRE_JOIN = `
  FROM character_squires cs
  JOIN squire_definitions sd ON sd.id = cs.squire_def_id
`;

export async function createCharacterSquire(
  characterId: string,
  squireDefId: number,
  level: number,
): Promise<CharacterSquire> {
  const result = await query<CharacterSquire>(
    `INSERT INTO character_squires (character_id, squire_def_id, level)
     VALUES ($1, $2, $3)
     RETURNING id, character_id, squire_def_id, level, created_at,
       (SELECT name FROM squire_definitions WHERE id = $2) AS name,
       (SELECT icon_filename FROM squire_definitions WHERE id = $2) AS icon_filename,
       (SELECT power_level FROM squire_definitions WHERE id = $2) AS power_level`,
    [characterId, squireDefId, level],
  );
  return result.rows[0]!;
}

export async function getSquiresForCharacter(characterId: string): Promise<CharacterSquire[]> {
  const result = await query<CharacterSquire>(
    `SELECT ${SQUIRE_SELECT} ${SQUIRE_JOIN}
     WHERE cs.character_id = $1
     ORDER BY cs.id`,
    [characterId],
  );
  return result.rows;
}

export async function getCharacterSquireById(squireId: number): Promise<CharacterSquire | null> {
  const result = await query<CharacterSquire>(
    `SELECT ${SQUIRE_SELECT} ${SQUIRE_JOIN}
     WHERE cs.id = $1`,
    [squireId],
  );
  return result.rows[0] ?? null;
}

export async function getSquireCount(characterId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM character_squires WHERE character_id = $1`,
    [characterId],
  );
  return parseInt(result.rows[0]!.count, 10);
}

export async function canAcquireSquire(characterId: string): Promise<boolean> {
  const result = await query<{ can_acquire: boolean }>(
    `SELECT (COUNT(cs.id) < c.squire_slots_unlocked) AS can_acquire
     FROM characters c
     LEFT JOIN character_squires cs ON cs.character_id = c.id
     WHERE c.id = $1
     GROUP BY c.squire_slots_unlocked`,
    [characterId],
  );
  return result.rows[0]?.can_acquire ?? true;
}

/** Returns idle squires (not currently on an uncollected expedition). */
export async function getIdleSquiresForCharacter(characterId: string): Promise<CharacterSquire[]> {
  const result = await query<CharacterSquire>(
    `SELECT ${SQUIRE_SELECT} ${SQUIRE_JOIN}
     WHERE cs.character_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM squire_expeditions se
         WHERE se.squire_id = cs.id AND se.collected_at IS NULL
       )
     ORDER BY cs.id`,
    [characterId],
  );
  return result.rows;
}

export async function deleteSquire(squireId: number): Promise<void> {
  await query('DELETE FROM character_squires WHERE id = $1', [squireId]);
}

// ─── Expedition queries ───────────────────────────────────────────────────────

/** Returns the current uncollected expedition for a squire, or null if idle. */
export async function getActiveExpeditionForSquire(squireId: number): Promise<SquireExpedition | null> {
  const result = await query<SquireExpedition>(
    `SELECT * FROM squire_expeditions
     WHERE squire_id = $1 AND collected_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    [squireId],
  );
  return result.rows[0] ?? null;
}

/** Returns all uncollected expeditions across all squires belonging to a character. */
export async function getActiveExpeditionsForCharacter(characterId: string): Promise<SquireExpedition[]> {
  const result = await query<SquireExpedition>(
    `SELECT se.*
     FROM squire_expeditions se
     JOIN character_squires cs ON cs.id = se.squire_id
     WHERE se.character_id = $1 AND se.collected_at IS NULL`,
    [characterId],
  );
  return result.rows;
}

export async function createExpedition(
  squireId: number,
  characterId: string,
  buildingId: number,
  actionId: number,
  durationHours: 1 | 3 | 6,
  snapshot: ExpeditionRewardSnapshot,
): Promise<SquireExpedition> {
  const completesAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  const result = await query<SquireExpedition>(
    `INSERT INTO squire_expeditions
       (squire_id, character_id, building_id, action_id, duration_hours, reward_snapshot, completes_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [squireId, characterId, buildingId, actionId, durationHours, JSON.stringify(snapshot), completesAt],
  );
  return result.rows[0]!;
}

export async function getExpeditionById(id: number): Promise<SquireExpedition | null> {
  const result = await query<SquireExpedition>(
    `SELECT * FROM squire_expeditions WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

/** Returns completed, uncollected, unnotified expeditions for the character. */
export async function getUnnotifiedCompletedExpeditions(
  characterId: string,
): Promise<CompletedExpeditionRow[]> {
  const result = await query<CompletedExpeditionRow>(
    `SELECT se.*, b.name AS building_name, sd.name AS squire_name
     FROM squire_expeditions se
     JOIN buildings b ON b.id = se.building_id
     JOIN character_squires cs ON cs.id = se.squire_id
     JOIN squire_definitions sd ON sd.id = cs.squire_def_id
     WHERE se.character_id = $1
       AND se.collected_at IS NULL
       AND se.completes_at <= now()
       AND se.notified_at IS NULL`,
    [characterId],
  );
  return result.rows;
}

export async function markExpeditionNotified(id: number): Promise<void> {
  await query(
    `UPDATE squire_expeditions SET notified_at = now() WHERE id = $1`,
    [id],
  );
}

export async function markExpeditionCollected(id: number): Promise<void> {
  await query(
    `UPDATE squire_expeditions SET collected_at = now() WHERE id = $1`,
    [id],
  );
}
