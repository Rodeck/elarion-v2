import { query } from '../connection';

export interface FatigueConfigRow {
  combat_type: string;
  start_round: number;
  base_damage: number;
  damage_increment: number;
  icon_filename: string | null;
}

export async function getFatigueConfig(combatType: string): Promise<FatigueConfigRow | null> {
  const res = await query<FatigueConfigRow>(
    'SELECT combat_type, start_round, base_damage, damage_increment, icon_filename FROM fatigue_config WHERE combat_type = $1',
    [combatType],
  );
  return res.rows[0] ?? null;
}

export async function getAllFatigueConfigs(): Promise<FatigueConfigRow[]> {
  const res = await query<FatigueConfigRow>(
    'SELECT combat_type, start_round, base_damage, damage_increment, icon_filename FROM fatigue_config ORDER BY combat_type',
    [],
  );
  return res.rows;
}

export async function upsertFatigueConfig(
  combatType: string,
  startRound: number,
  baseDamage: number,
  damageIncrement: number,
): Promise<FatigueConfigRow> {
  const res = await query<FatigueConfigRow>(
    `INSERT INTO fatigue_config (combat_type, start_round, base_damage, damage_increment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (combat_type) DO UPDATE
       SET start_round = EXCLUDED.start_round,
           base_damage = EXCLUDED.base_damage,
           damage_increment = EXCLUDED.damage_increment,
           updated_at = NOW()
     RETURNING combat_type, start_round, base_damage, damage_increment, icon_filename`,
    [combatType, startRound, baseDamage, damageIncrement],
  );
  return res.rows[0]!;
}

export async function updateFatigueIconFilename(
  combatType: string,
  iconFilename: string,
): Promise<FatigueConfigRow> {
  const res = await query<FatigueConfigRow>(
    `UPDATE fatigue_config SET icon_filename = $2, updated_at = NOW()
     WHERE combat_type = $1
     RETURNING combat_type, start_round, base_damage, damage_increment, icon_filename`,
    [combatType, iconFilename],
  );
  return res.rows[0]!;
}
