import { query } from '../connection';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Squire {
  id: number;
  character_id: string;
  name: string;
  created_at: Date;
}

export interface ExpeditionRewardSnapshot {
  gold: number;
  exp: number;
  items: { item_def_id: number; name: string; quantity: number }[];
}

export interface ExpeditionActionConfig {
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

export async function createSquire(characterId: string, name: string): Promise<Squire> {
  const result = await query<Squire>(
    `INSERT INTO squires (character_id, name) VALUES ($1, $2) RETURNING *`,
    [characterId, name],
  );
  return result.rows[0]!;
}

export async function getSquiresForCharacter(characterId: string): Promise<Squire[]> {
  const result = await query<Squire>(
    `SELECT * FROM squires WHERE character_id = $1 ORDER BY id`,
    [characterId],
  );
  return result.rows;
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
     JOIN squires s ON s.id = se.squire_id
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
    `SELECT se.*, b.name AS building_name, sq.name AS squire_name
     FROM squire_expeditions se
     JOIN buildings b ON b.id = se.building_id
     JOIN squires sq ON sq.id = se.squire_id
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
