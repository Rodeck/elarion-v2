import { query } from '../connection';

export const VALID_IMAGE_GEN_MODELS = [
  'google/gemini-2.5-flash-image',
  'google/gemini-2.5-flash-image-preview',
  'google/gemini-3-pro-image-preview',
  'google/gemini-3.1-flash-image-preview',
  'openai/gpt-5-image-mini',
  'openai/gpt-5-image',
] as const;

export type ImageGenModel = typeof VALID_IMAGE_GEN_MODELS[number];

export const CONFIG_DEFAULTS: Record<string, string> = {
  image_gen_model: 'google/gemini-2.5-flash-image',
  xp_icon_filename: '',
  crowns_icon_filename: '',
};

const KNOWN_KEYS = new Set(Object.keys(CONFIG_DEFAULTS));

export function isKnownKey(key: string): boolean {
  return KNOWN_KEYS.has(key);
}

export async function getConfigValue(key: string): Promise<string> {
  const res = await query<{ value: string }>(
    'SELECT value FROM admin_config WHERE key = $1',
    [key],
  );
  return res.rows[0]?.value ?? CONFIG_DEFAULTS[key] ?? '';
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const res = await query<{ key: string; value: string }>(
    'SELECT key, value FROM admin_config',
    [],
  );
  const dbValues: Record<string, string> = {};
  for (const row of res.rows) {
    dbValues[row.key] = row.value;
  }
  // Merge with defaults (DB values take precedence)
  return { ...CONFIG_DEFAULTS, ...dbValues };
}

export async function upsertConfigValue(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO admin_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}
