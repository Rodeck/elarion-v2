import { query } from '../connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveSpellBuffRow {
  id: number;
  character_id: string;
  spell_id: number;
  caster_id: string;
  level: number;
  effect_type: string;
  effect_value: number;
  expires_at: Date;
  created_at: Date;
  // Joined fields (optional)
  spell_name?: string;
  spell_icon_filename?: string | null;
  caster_name?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get all active (non-expired) buffs on a character, joined with spell + caster names. */
export async function getActiveBuffs(characterId: string): Promise<ActiveSpellBuffRow[]> {
  const result = await query<ActiveSpellBuffRow>(
    `SELECT asb.*, s.name AS spell_name, s.icon_filename AS spell_icon_filename,
            c.name AS caster_name
     FROM active_spell_buffs asb
     JOIN spells s ON s.id = asb.spell_id
     JOIN characters c ON c.id = asb.caster_id
     WHERE asb.character_id = $1 AND asb.expires_at > NOW()
     ORDER BY asb.created_at`,
    [characterId],
  );
  return result.rows;
}

/** Get a specific active buff for a character + spell combo. */
export async function getBuffBySpell(
  characterId: string,
  spellId: number,
): Promise<ActiveSpellBuffRow | null> {
  const result = await query<ActiveSpellBuffRow>(
    `SELECT * FROM active_spell_buffs
     WHERE character_id = $1 AND spell_id = $2 AND expires_at > NOW()`,
    [characterId, spellId],
  );
  return result.rows[0] ?? null;
}

/** Insert or replace a buff (upsert on character_id + spell_id). */
export async function upsertBuff(
  characterId: string,
  spellId: number,
  casterId: string,
  level: number,
  effectType: string,
  effectValue: number,
  expiresAt: Date,
): Promise<void> {
  await query(
    `INSERT INTO active_spell_buffs (character_id, spell_id, caster_id, level, effect_type, effect_value, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (character_id, spell_id) DO UPDATE
       SET caster_id = $3,
           level = $4,
           effect_type = $5,
           effect_value = $6,
           expires_at = $7,
           created_at = NOW()`,
    [characterId, spellId, casterId, level, effectType, effectValue, expiresAt],
  );
}

/** Delete a specific buff. */
export async function deleteBuff(characterId: string, spellId: number): Promise<void> {
  await query(
    'DELETE FROM active_spell_buffs WHERE character_id = $1 AND spell_id = $2',
    [characterId, spellId],
  );
}

/** Cleanup expired buff rows. */
export async function deleteExpiredBuffs(): Promise<number> {
  const result = await query(
    'DELETE FROM active_spell_buffs WHERE expires_at <= NOW()',
  );
  return result.rowCount ?? 0;
}
