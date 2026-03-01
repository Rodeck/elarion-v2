import fs from 'fs';
import path from 'path';
import { query } from './connection';

async function migrate(): Promise<void> {
  // Ensure tracking table exists
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await query<{ filename: string }>(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`[migrate] already applied: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await query(sql);
    await query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`[migrate] applied: ${file}`);
  }

  console.log('[migrate] done');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[migrate] error', err);
  process.exit(1);
});
