import { config } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';

export function log(
  level: Level,
  subsystem: string,
  event: string,
  data?: Record<string, unknown>
): void {
  if (level === 'debug' && !config.isDev) return;
  const entry = { ts: new Date().toISOString(), level, subsystem, event, ...data };
  process.stdout.write(JSON.stringify(entry) + '\n');
}
