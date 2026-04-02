import { query } from '../connection';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Arena {
  id: number;
  building_id: number;
  name: string;
  min_stay_seconds: number;
  reentry_cooldown_seconds: number;
  winner_xp: number;
  loser_xp: number;
  winner_crowns: number;
  loser_crowns: number;
  level_bracket: number;
  is_active: boolean;
  created_at: Date;
}

export interface ArenaMonster {
  id: number;
  arena_id: number;
  monster_id: number;
  sort_order: number;
  // joined fields
  name?: string;
  icon_filename?: string | null;
  hp?: number;
  attack?: number;
  defense?: number;
  xp_reward?: number;
}

export interface ArenaParticipant {
  id: number;
  arena_id: number;
  character_id: string;
  entered_at: Date;
  current_hp: number;
  pre_fight_hp: number | null;
  in_combat: boolean;
  fighting_character_id: string | null;
  can_leave_at: Date;
  current_streak: number;
}

// ---------------------------------------------------------------------------
// Arena Definition CRUD
// ---------------------------------------------------------------------------

export async function getAllArenas(): Promise<Arena[]> {
  const result = await query<Arena>(
    'SELECT * FROM arenas ORDER BY name',
  );
  return result.rows;
}

export async function getArenaById(id: number): Promise<Arena | null> {
  const result = await query<Arena>(
    'SELECT * FROM arenas WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getArenaByBuildingId(buildingId: number): Promise<Arena | null> {
  const result = await query<Arena>(
    'SELECT * FROM arenas WHERE building_id = $1',
    [buildingId],
  );
  return result.rows[0] ?? null;
}

export async function createArena(data: {
  building_id: number;
  name: string;
  min_stay_seconds?: number;
  reentry_cooldown_seconds?: number;
  winner_xp?: number;
  loser_xp?: number;
  winner_crowns?: number;
  loser_crowns?: number;
  level_bracket?: number;
  is_active?: boolean;
}): Promise<Arena> {
  const result = await query<Arena>(
    `INSERT INTO arenas (building_id, name, min_stay_seconds, reentry_cooldown_seconds,
       winner_xp, loser_xp, winner_crowns, loser_crowns, level_bracket, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.building_id,
      data.name,
      data.min_stay_seconds ?? 3600,
      data.reentry_cooldown_seconds ?? 1800,
      data.winner_xp ?? 50,
      data.loser_xp ?? 10,
      data.winner_crowns ?? 25,
      data.loser_crowns ?? 0,
      data.level_bracket ?? 5,
      data.is_active ?? true,
    ],
  );
  return result.rows[0];
}

export async function updateArena(id: number, data: Partial<Omit<Arena, 'id' | 'created_at'>>): Promise<Arena | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getArenaById(id);

  values.push(id);
  const result = await query<Arena>(
    `UPDATE arenas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteArena(id: number): Promise<boolean> {
  const result = await query('DELETE FROM arenas WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Arena Monster Assignments
// ---------------------------------------------------------------------------

export async function getArenaMonstersWithDetails(arenaId: number): Promise<ArenaMonster[]> {
  const result = await query<ArenaMonster>(
    `SELECT am.*, m.name, m.icon_filename, m.hp, m.attack, m.defense, m.xp_reward
     FROM arena_monsters am
     JOIN monsters m ON m.id = am.monster_id
     WHERE am.arena_id = $1
     ORDER BY am.sort_order, m.name`,
    [arenaId],
  );
  return result.rows;
}

export async function addArenaMonster(arenaId: number, monsterId: number, sortOrder: number = 0): Promise<ArenaMonster> {
  const result = await query<ArenaMonster>(
    `INSERT INTO arena_monsters (arena_id, monster_id, sort_order)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [arenaId, monsterId, sortOrder],
  );
  return result.rows[0];
}

export async function getArenaMonsterEntry(arenaId: number, monsterId: number): Promise<ArenaMonster | null> {
  const result = await query<ArenaMonster>(
    `SELECT am.*, m.name, m.icon_filename, m.hp, m.attack, m.defense, m.xp_reward
     FROM arena_monsters am
     JOIN monsters m ON m.id = am.monster_id
     WHERE am.arena_id = $1 AND am.monster_id = $2`,
    [arenaId, monsterId],
  );
  return result.rows[0] ?? null;
}

export async function removeArenaMonster(arenaId: number, monsterId: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM arena_monsters WHERE arena_id = $1 AND monster_id = $2',
    [arenaId, monsterId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Arena Participants
// ---------------------------------------------------------------------------

export async function getParticipantsByArena(arenaId: number): Promise<(ArenaParticipant & { name: string; class_id: number; level: number })[]> {
  const result = await query<ArenaParticipant & { name: string; class_id: number; level: number }>(
    `SELECT ap.*, c.name, c.class_id, c.level
     FROM arena_participants ap
     JOIN characters c ON c.id = ap.character_id
     WHERE ap.arena_id = $1
     ORDER BY ap.entered_at`,
    [arenaId],
  );
  return result.rows;
}

export async function getParticipantByCharacterId(characterId: string): Promise<ArenaParticipant | null> {
  const result = await query<ArenaParticipant>(
    'SELECT * FROM arena_participants WHERE character_id = $1',
    [characterId],
  );
  return result.rows[0] ?? null;
}

export async function getAllParticipants(): Promise<(ArenaParticipant & { name: string; class_id: number; level: number; max_hp: number; arena_pvp_wins: number })[]> {
  const result = await query<ArenaParticipant & { name: string; class_id: number; level: number; max_hp: number; arena_pvp_wins: number }>(
    `SELECT ap.*, c.name, c.class_id, c.level, c.max_hp, c.arena_pvp_wins
     FROM arena_participants ap
     JOIN characters c ON c.id = ap.character_id
     ORDER BY ap.arena_id, ap.entered_at`,
  );
  return result.rows;
}

export async function insertParticipant(data: {
  arena_id: number;
  character_id: string;
  current_hp: number;
  can_leave_at: Date;
}): Promise<ArenaParticipant> {
  const result = await query<ArenaParticipant>(
    `INSERT INTO arena_participants (arena_id, character_id, current_hp, can_leave_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.arena_id, data.character_id, data.current_hp, data.can_leave_at],
  );
  return result.rows[0];
}

export async function updateParticipantHp(characterId: string, hp: number): Promise<void> {
  await query(
    'UPDATE arena_participants SET current_hp = $1 WHERE character_id = $2',
    [hp, characterId],
  );
}

export async function updateParticipantCombatState(
  characterId: string,
  inCombat: boolean,
  fightingCharacterId: string | null = null,
): Promise<void> {
  await query(
    'UPDATE arena_participants SET in_combat = $1, fighting_character_id = $2 WHERE character_id = $3',
    [inCombat, fightingCharacterId, characterId],
  );
}

export async function setPreFightHp(characterId: string, hp: number): Promise<void> {
  await query(
    'UPDATE arena_participants SET pre_fight_hp = $1 WHERE character_id = $2',
    [hp, characterId],
  );
}

export async function clearPreFightHp(characterId: string): Promise<void> {
  await query(
    'UPDATE arena_participants SET pre_fight_hp = NULL WHERE character_id = $1',
    [characterId],
  );
}

export async function deleteParticipant(characterId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM arena_participants WHERE character_id = $1',
    [characterId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Character Arena Columns
// ---------------------------------------------------------------------------

export async function setCharacterArenaId(characterId: string, arenaId: number | null): Promise<void> {
  await query(
    'UPDATE characters SET arena_id = $1 WHERE id = $2',
    [arenaId, characterId],
  );
}

export async function setCharacterArenaCooldown(characterId: string, cooldownUntil: Date | null): Promise<void> {
  await query(
    'UPDATE characters SET arena_cooldown_until = $1 WHERE id = $2',
    [cooldownUntil, characterId],
  );
}

export async function getCharacterArenaCooldown(characterId: string): Promise<Date | null> {
  const result = await query<{ arena_cooldown_until: Date | null }>(
    'SELECT arena_cooldown_until FROM characters WHERE id = $1',
    [characterId],
  );
  return result.rows[0]?.arena_cooldown_until ?? null;
}
