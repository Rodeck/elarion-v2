interface RateWindow {
  count: number;
  windowStart: number;
}

const LIMIT = 5;
const WINDOW_MS = 3000;

const windows = new Map<string, RateWindow>();

export function checkChatRateLimit(characterId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = windows.get(characterId);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    windows.set(characterId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (existing.count < LIMIT) {
    existing.count++;
    return { allowed: true };
  }

  const retryAfterMs = WINDOW_MS - (now - existing.windowStart);
  return { allowed: false, retryAfterMs };
}
