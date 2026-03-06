import fs from 'fs';
import path from 'path';
import { config } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';

// Write logs to backend/logs/game.log (path relative to backend process CWD)
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'game.log');

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  // Truncate log file on startup so each run starts fresh
  fs.writeFileSync(LOG_FILE, '');
} catch {
  // If we can't create the log file, silently fall back to stdout-only
}

export function log(
  level: Level,
  subsystem: string,
  event: string,
  data?: Record<string, unknown>
): void {
  if (level === 'debug' && !config.isDev) return;
  const entry = { ts: new Date().toISOString(), level, subsystem, event, ...data };
  const line = JSON.stringify(entry) + '\n';
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // Ignore file write errors
  }
}
