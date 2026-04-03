import { query } from '../../db/connection';
import { getSessionByCharacterId } from '../../websocket/server';
import { sendToSession } from '../../websocket/server';
import { log } from '../../logger';

const REGEN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
interface RegenRow {
  id: string;
  current_hp: number;
  max_hp: number;
}

async function tickRegen(): Promise<void> {
  try {
    const result = await query<RegenRow>(
      `UPDATE characters
         SET current_hp = LEAST(max_hp, current_hp + CEIL(max_hp * 0.10)::smallint)::smallint,
             updated_at = now()
       WHERE current_hp < max_hp
         AND in_combat = false
       RETURNING id, current_hp, max_hp`,
    );

    for (const row of result.rows) {
      const session = getSessionByCharacterId(row.id);
      if (session) {
        sendToSession(session, 'character.hp_changed', {
          current_hp: row.current_hp,
          max_hp: row.max_hp,
        });
      }
    }

    if (result.rows.length > 0) {
      log('info', 'hp-regen', 'tick', { healed: result.rows.length });
    }
  } catch (err) {
    log('error', 'hp-regen', 'tick_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startHpRegenService(): void {
  void tickRegen();
  setInterval(tickRegen, REGEN_INTERVAL_MS);
  log('info', 'hp-regen', 'started', { interval_ms: REGEN_INTERVAL_MS });
}
