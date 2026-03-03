import 'dotenv/config';

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  editorPort: parseInt(process.env['EDITOR_PORT'] ?? '4001', 10),
  databaseUrl: require_env('DATABASE_URL'),
  jwtSecret: require_env('JWT_SECRET'),
};
