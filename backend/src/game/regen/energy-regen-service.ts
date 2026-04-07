import { query } from '../../db/connection';
import { getConfigValue } from '../../db/queries/admin-config';
import { getSessionByCharacterId } from '../../websocket/server';
import { sendToSession } from '../../websocket/server';
import { log } from '../../logger';

interface EnergyRegenRow {
  id: string;
  current_energy: number;
  max_energy: number;
}

let currentTimer: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = 0;

async function getRegenConfig(): Promise<{ amount: number; intervalMs: number }> {
  const amount = Number(await getConfigValue('energy_regen_per_tick')) || 50;
  const intervalSeconds = Number(await getConfigValue('energy_tick_interval_seconds')) || 300;
  return { amount, intervalMs: intervalSeconds * 1000 };
}

async function tickEnergyRegen(): Promise<void> {
  try {
    const { amount, intervalMs } = await getRegenConfig();

    const result = await query<EnergyRegenRow>(
      `UPDATE characters
         SET current_energy = LEAST(max_energy, current_energy + $1)::smallint,
             updated_at = now()
       WHERE current_energy < max_energy
       RETURNING id, current_energy, max_energy`,
      [amount],
    );

    for (const row of result.rows) {
      const session = getSessionByCharacterId(row.id);
      if (session) {
        sendToSession(session, 'character.energy_changed', {
          current_energy: row.current_energy,
          max_energy: row.max_energy,
        });
      }
    }

    if (result.rows.length > 0) {
      log('info', 'energy-regen', 'tick', { restored: result.rows.length, amount });
    }

    // Reschedule if interval changed
    if (intervalMs !== currentIntervalMs) {
      log('info', 'energy-regen', 'interval_changed', { old_ms: currentIntervalMs, new_ms: intervalMs });
      if (currentTimer) clearInterval(currentTimer);
      currentIntervalMs = intervalMs;
      currentTimer = setInterval(() => void tickEnergyRegen(), currentIntervalMs);
    }
  } catch (err) {
    log('error', 'energy-regen', 'tick_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startEnergyRegenService(): void {
  void getRegenConfig().then(({ intervalMs }) => {
    currentIntervalMs = intervalMs;
    void tickEnergyRegen();
    currentTimer = setInterval(() => void tickEnergyRegen(), currentIntervalMs);
    log('info', 'energy-regen', 'started', { interval_ms: currentIntervalMs });
  });
}
