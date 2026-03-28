import { query } from '../connection';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Boss {
  id: number;
  name: string;
  description: string | null;
  icon_filename: string | null;
  sprite_filename: string | null;
  max_hp: number;
  min_hp: number;
  attack: number;
  min_attack: number;
  defense: number;
  min_defense: number;
  xp_reward: number;
  min_crowns: number;
  max_crowns: number;
  building_id: number | null;
  respawn_min_seconds: number;
  respawn_max_seconds: number;
  is_active: boolean;
  created_at: Date;
}

export interface BossAbility {
  id: number;
  boss_id: number;
  ability_id: number;
  priority: number;
  // joined fields (optional, present when joining abilities table)
  name?: string;
  effect_type?: string;
  mana_cost?: number;
  effect_value?: number;
  duration_turns?: number;
  cooldown_turns?: number;
  icon_filename?: string | null;
}

export interface BossLootEntry {
  id: number;
  boss_id: number;
  item_def_id: number;
  drop_chance: number; // 0-100
  quantity: number;
  // joined fields
  item_name?: string;
  icon_filename?: string | null;
}

export interface BossInstance {
  id: number;
  boss_id: number;
  current_hp: number;
  status: 'alive' | 'in_combat' | 'defeated';
  fighting_character_id: string | null; // UUID
  total_attempts: number;
  spawned_at: Date;
  defeated_at: Date | null;
  respawn_at: Date | null;
  actual_attack: number | null;
  actual_defense: number | null;
}

// ---------------------------------------------------------------------------
// Boss Definition CRUD
// ---------------------------------------------------------------------------

export async function getAllBosses(): Promise<Boss[]> {
  const result = await query<Boss>(
    'SELECT * FROM bosses ORDER BY name',
  );
  return result.rows;
}

export async function getBossById(id: number): Promise<Boss | null> {
  const result = await query<Boss>(
    'SELECT * FROM bosses WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getBossForBuilding(buildingId: number): Promise<Boss | null> {
  const result = await query<Boss>(
    'SELECT * FROM bosses WHERE building_id = $1 AND is_active = true',
    [buildingId],
  );
  return result.rows[0] ?? null;
}

export async function createBoss(data: {
  name: string;
  description?: string | null;
  icon_filename?: string | null;
  sprite_filename?: string | null;
  max_hp: number;
  min_hp?: number;
  attack: number;
  min_attack?: number;
  defense: number;
  min_defense?: number;
  xp_reward?: number;
  min_crowns?: number;
  max_crowns?: number;
  building_id?: number | null;
  respawn_min_seconds?: number;
  respawn_max_seconds?: number;
  is_active?: boolean;
}): Promise<Boss> {
  const result = await query<Boss>(
    `INSERT INTO bosses (name, description, icon_filename, sprite_filename, max_hp, min_hp, attack, min_attack, defense, min_defense,
       xp_reward, min_crowns, max_crowns, building_id, respawn_min_seconds, respawn_max_seconds, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      data.name, data.description ?? null, data.icon_filename ?? null, data.sprite_filename ?? null,
      data.max_hp, data.min_hp ?? data.max_hp, data.attack, data.min_attack ?? data.attack,
      data.defense, data.min_defense ?? data.defense, data.xp_reward ?? 0,
      data.min_crowns ?? 0, data.max_crowns ?? 0, data.building_id ?? null,
      data.respawn_min_seconds ?? 3600, data.respawn_max_seconds ?? 7200,
      data.is_active ?? true,
    ],
  );
  return result.rows[0]!;
}

export async function updateBoss(
  id: number,
  data: Partial<Omit<Boss, 'id' | 'created_at'>>,
): Promise<Boss | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getBossById(id);

  values.push(id);
  const result = await query<Boss>(
    `UPDATE bosses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteBoss(id: number): Promise<void> {
  await query('DELETE FROM bosses WHERE id = $1', [id]);
}

// ---------------------------------------------------------------------------
// Boss Abilities
// ---------------------------------------------------------------------------

export async function getBossAbilities(bossId: number): Promise<BossAbility[]> {
  const result = await query<BossAbility>(
    `SELECT ba.*, a.name, a.effect_type, a.mana_cost, a.effect_value,
            a.duration_turns, a.cooldown_turns, a.icon_filename
     FROM boss_abilities ba
     JOIN abilities a ON a.id = ba.ability_id
     WHERE ba.boss_id = $1
     ORDER BY ba.priority DESC`,
    [bossId],
  );
  return result.rows;
}

export async function addBossAbility(bossId: number, abilityId: number, priority: number): Promise<BossAbility> {
  const result = await query<BossAbility>(
    `INSERT INTO boss_abilities (boss_id, ability_id, priority)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [bossId, abilityId, priority],
  );
  return result.rows[0]!;
}

export async function removeBossAbility(bossId: number, abilityId: number): Promise<void> {
  await query('DELETE FROM boss_abilities WHERE boss_id = $1 AND ability_id = $2', [bossId, abilityId]);
}

// ---------------------------------------------------------------------------
// Boss Loot
// ---------------------------------------------------------------------------

export async function getBossLoot(bossId: number): Promise<BossLootEntry[]> {
  const result = await query<BossLootEntry>(
    `SELECT bl.*, i.name AS item_name, i.icon_filename
     FROM boss_loot bl
     JOIN item_definitions i ON i.id = bl.item_def_id
     WHERE bl.boss_id = $1
     ORDER BY bl.drop_chance DESC`,
    [bossId],
  );
  return result.rows;
}

export async function addBossLoot(
  bossId: number,
  itemDefId: number,
  dropChance: number,
  quantity: number,
): Promise<BossLootEntry> {
  const result = await query<BossLootEntry>(
    `INSERT INTO boss_loot (boss_id, item_def_id, drop_chance, quantity)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [bossId, itemDefId, dropChance, quantity],
  );
  return result.rows[0]!;
}

export async function removeBossLoot(lootId: number): Promise<void> {
  await query('DELETE FROM boss_loot WHERE id = $1', [lootId]);
}

// ---------------------------------------------------------------------------
// Boss Instances
// ---------------------------------------------------------------------------

export async function getBossInstance(bossId: number): Promise<BossInstance | null> {
  const result = await query<BossInstance>(
    `SELECT * FROM boss_instances WHERE boss_id = $1 ORDER BY spawned_at DESC LIMIT 1`,
    [bossId],
  );
  return result.rows[0] ?? null;
}

export async function getAllBossInstances(): Promise<(BossInstance & { boss_name: string; building_id: number | null; max_hp: number; fighting_character_name: string | null })[]> {
  const result = await query<BossInstance & { boss_name: string; building_id: number | null; max_hp: number; fighting_character_name: string | null }>(
    `SELECT bi.*, b.name AS boss_name, b.building_id, b.max_hp,
            ch.name AS fighting_character_name
     FROM boss_instances bi
     JOIN bosses b ON b.id = bi.boss_id
     LEFT JOIN characters ch ON ch.id = bi.fighting_character_id
     ORDER BY bi.spawned_at DESC`,
  );
  return result.rows;
}

export async function createBossInstance(
  bossId: number,
  hp: number,
  actualAttack?: number,
  actualDefense?: number,
): Promise<BossInstance> {
  const result = await query<BossInstance>(
    `INSERT INTO boss_instances (boss_id, current_hp, status, actual_attack, actual_defense)
     VALUES ($1, $2, 'alive', $3, $4)
     RETURNING *`,
    [bossId, hp, actualAttack ?? null, actualDefense ?? null],
  );
  return result.rows[0]!;
}

export async function updateBossInstanceHp(instanceId: number, hp: number): Promise<void> {
  await query('UPDATE boss_instances SET current_hp = $1 WHERE id = $2', [hp, instanceId]);
}

/**
 * Atomically lock a boss instance for combat. Returns the instance if lock
 * succeeded (status was 'alive'), or null if someone else got it first.
 */
export async function lockBossInstance(
  instanceId: number,
  characterId: string,
): Promise<BossInstance | null> {
  const result = await query<BossInstance>(
    `UPDATE boss_instances
     SET status = 'in_combat', fighting_character_id = $1, total_attempts = total_attempts + 1
     WHERE id = $2 AND status = 'alive'
     RETURNING *`,
    [characterId, instanceId],
  );
  return result.rows[0] ?? null;
}

export async function unlockBossInstance(instanceId: number): Promise<void> {
  await query(
    `UPDATE boss_instances SET status = 'alive', fighting_character_id = NULL WHERE id = $1`,
    [instanceId],
  );
}

export async function defeatBossInstance(instanceId: number, respawnAt: Date): Promise<void> {
  await query(
    `UPDATE boss_instances
     SET status = 'defeated', fighting_character_id = NULL, defeated_at = NOW(), respawn_at = $1
     WHERE id = $2`,
    [respawnAt, instanceId],
  );
}

export async function getDefeatedInstancesReadyToRespawn(): Promise<BossInstance[]> {
  const result = await query<BossInstance>(
    `SELECT * FROM boss_instances WHERE status = 'defeated' AND respawn_at <= NOW()`,
  );
  return result.rows;
}

export async function deleteBossInstance(bossId: number): Promise<void> {
  await query('DELETE FROM boss_instances WHERE boss_id = $1', [bossId]);
}
