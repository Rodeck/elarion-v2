import { query } from '../../db/connection';
import { getConfigValue } from '../../db/queries/admin-config';
import { getSessionByCharacterId } from '../../websocket/server';
import { sendToSession } from '../../websocket/server';
import { log } from '../../logger';

interface RegenRow {
  id: string;
  current_hp: number;
  max_hp: number;
}

let currentTimer: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = 0;

async function getHpRegenConfig(): Promise<{ percent: number; intervalMs: number }> {
  const percent = Number(await getConfigValue('hp_regen_percent')) || 10;
  const intervalSeconds = Number(await getConfigValue('hp_tick_interval_seconds')) || 600;
  return { percent, intervalMs: intervalSeconds * 1000 };
}

async function tickRegen(): Promise<void> {
  try {
    const { percent, intervalMs } = await getHpRegenConfig();
    const fraction = percent / 100;

    const result = await query<RegenRow>(
      `UPDATE characters
         SET current_hp = LEAST(max_hp, current_hp + CEIL(max_hp * $1::numeric)::int)::smallint,
             updated_at = now()
       WHERE current_hp < max_hp
         AND in_combat = false
       RETURNING id, current_hp, max_hp`,
      [fraction],
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
      log('info', 'hp-regen', 'tick', { healed: result.rows.length, percent });
    }

    // Reschedule if interval changed
    if (intervalMs !== currentIntervalMs) {
      log('info', 'hp-regen', 'interval_changed', { old_ms: currentIntervalMs, new_ms: intervalMs });
      if (currentTimer) clearInterval(currentTimer);
      currentIntervalMs = intervalMs;
      currentTimer = setInterval(() => void tickRegen(), currentIntervalMs);
    }
  } catch (err) {
    log('error', 'hp-regen', 'tick_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startHpRegenService(): void {
  void getHpRegenConfig().then(({ intervalMs }) => {
    currentIntervalMs = intervalMs;
    void tickRegen();
    currentTimer = setInterval(() => void tickRegen(), currentIntervalMs);
    log('info', 'hp-regen', 'started', { interval_ms: currentIntervalMs });
  });
}
