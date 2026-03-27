import { randomUUID } from 'node:crypto';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { updateToolDurability } from '../../db/queries/inventory';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { resolveFishingLoot } from './fishing-loot-service';
import type { FishingLootEntry } from '../../db/queries/fishing';
import type {
  FishingSessionStartPayload,
  FishingResultPayload,
  PullPatternDto,
  PullSegmentDto,
  CatchWindowDto,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

interface FishingSession {
  sessionId: string;
  characterId: string;
  wsSession: AuthenticatedSession;
  rodSlotId: number;
  rodTier: number;
  rodDurability: number;
  rodMaxDurability: number;
  lootEntry: FishingLootEntry;
  biteDelayMs: number;
  pullPattern: PullPatternDto;
  catchWindow: CatchWindowDto;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// In-memory session store + anti-bot tracking
// ---------------------------------------------------------------------------

const activeSessions = new Map<string, FishingSession>();

/** Rolling window of recent cast reaction-time profiles per character (for snap checks). */
const reactionHistory = new Map<string, number[]>();
const REACTION_HISTORY_SIZE = 10;
const SNAP_CHECK_MIN_CASTS = 5;
const SNAP_CHECK_STDDEV_THRESHOLD = 15; // ms — below this is suspiciously consistent
const SESSION_TIMEOUT_MS = 60_000; // 60 seconds max per session

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function hasActiveSession(characterId: string): boolean {
  return activeSessions.has(characterId);
}

export async function startSession(
  wsSession: AuthenticatedSession,
  characterId: string,
  rodSlotId: number,
  rodTier: number,
  rodDurability: number,
  rodMaxDurability: number,
): Promise<FishingSessionStartPayload> {
  // Pick a fish from the loot pool
  const lootEntry = await resolveFishingLoot(rodTier);
  if (!lootEntry) {
    throw new Error('No loot entries available for rod tier ' + rodTier);
  }

  const sessionId = randomUUID();
  const biteDelayMs = 2000 + Math.floor(Math.random() * 6001); // 2000–8000

  // Generate pull pattern based on item category (fish vs jewelry affect difficulty)
  const patternType = pickPatternType(lootEntry);
  const pullPattern = generatePullPattern(patternType, rodTier);
  const catchWindow = generateCatchWindow(pullPattern);

  const session: FishingSession = {
    sessionId,
    characterId,
    wsSession,
    rodSlotId,
    rodTier,
    rodDurability,
    rodMaxDurability,
    lootEntry,
    biteDelayMs,
    pullPattern,
    catchWindow,
    createdAt: Date.now(),
  };

  activeSessions.set(characterId, session);

  log('info', 'fishing', 'session_started', {
    characterId,
    sessionId,
    rodTier,
    fish: lootEntry.item_name,
    biteDelayMs,
    patternType,
  });

  const silhouette = lootEntry.item_category === 'ring' || lootEntry.item_category === 'amulet'
    ? 'small'
    : rodTier >= 4 ? 'large' : rodTier >= 2 ? 'medium' : 'small';

  return {
    session_id: sessionId,
    bite_delay_ms: biteDelayMs,
    pull_pattern: pullPattern,
    catch_window: catchWindow,
    fish_silhouette: silhouette,
  };
}

export async function completeSession(
  characterId: string,
  sessionId: string,
  inputTimestamps: number[],
  reelTimestamp: number,
): Promise<FishingResultPayload> {
  const session = activeSessions.get(characterId);
  if (!session || session.sessionId !== sessionId) {
    throw new Error('INVALID_SESSION');
  }

  // Check session timeout
  if (Date.now() - session.createdAt > SESSION_TIMEOUT_MS) {
    await consumeDurabilityAndCleanup(session);
    throw new Error('SESSION_EXPIRED');
  }

  // Consume durability (always, regardless of success)
  const newDurability = await consumeDurabilityAndCleanup(session);
  const rodLocked = newDurability <= 1;

  // Anti-bot snap check
  const snapCheckFailed = runSnapCheck(characterId, inputTimestamps, reelTimestamp);
  if (snapCheckFailed) {
    log('warn', 'fishing', 'snap_check_failed', { characterId, sessionId });
    await sendInventoryState(session.wsSession);
    return {
      success: false,
      fish_name: null,
      fish_icon_url: null,
      items_received: [],
      rod_durability_remaining: newDurability,
      rod_locked: rodLocked,
      snap_check_failed: true,
    };
  }

  // Validate timing against pull pattern and catch window
  const success = validateTiming(session, inputTimestamps, reelTimestamp);

  if (!success) {
    log('info', 'fishing', 'catch_failed', { characterId, sessionId, fish: session.lootEntry.item_name });
    await sendInventoryState(session.wsSession);
    return {
      success: false,
      fish_name: null,
      fish_icon_url: null,
      items_received: [],
      rod_durability_remaining: newDurability,
      rod_locked: rodLocked,
      snap_check_failed: false,
    };
  }

  // Grant loot
  await grantItemToCharacter(
    session.wsSession,
    characterId,
    session.lootEntry.item_def_id,
    1,
  );

  // Refresh client inventory (shows updated rod durability + new fish)
  await sendInventoryState(session.wsSession);

  log('info', 'fishing', 'catch_success', {
    characterId,
    sessionId,
    fish: session.lootEntry.item_name,
    category: session.lootEntry.item_category,
  });

  return {
    success: true,
    fish_name: session.lootEntry.item_name,
    fish_icon_url: session.lootEntry.icon_filename
      ? `/item-icons/${session.lootEntry.icon_filename}`
      : null,
    items_received: [{
      slot_id: 0,
      item_def_id: session.lootEntry.item_def_id,
      item_name: session.lootEntry.item_name,
      icon_url: session.lootEntry.icon_filename
        ? `/item-icons/${session.lootEntry.icon_filename}`
        : '',
      quantity: 1,
      category: session.lootEntry.item_category,
    }],
    rod_durability_remaining: newDurability,
    rod_locked: rodLocked,
    snap_check_failed: false,
  };
}

export async function cancelSession(characterId: string): Promise<void> {
  const session = activeSessions.get(characterId);
  if (!session) return;

  await consumeDurabilityAndCleanup(session);
  log('info', 'fishing', 'session_cancelled', { characterId, sessionId: session.sessionId });
}

export async function cleanupOnDisconnect(characterId: string): Promise<void> {
  const session = activeSessions.get(characterId);
  if (!session) return;

  // Consume durability silently on disconnect
  try {
    const newDurability = Math.max(1, session.rodDurability - 1);
    await updateToolDurability(session.rodSlotId, newDurability);
  } catch {
    // Best-effort durability deduction on disconnect
  }
  activeSessions.delete(characterId);
  log('info', 'fishing', 'session_disconnected', { characterId, sessionId: session.sessionId });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function consumeDurabilityAndCleanup(session: FishingSession): Promise<number> {
  activeSessions.delete(session.characterId);
  const newDurability = Math.max(1, session.rodDurability - 1);
  await updateToolDurability(session.rodSlotId, newDurability);
  return newDurability;
}

function pickPatternType(loot: FishingLootEntry): 'aggressive' | 'erratic' | 'steady' {
  // Rarer items get harder patterns
  if (loot.item_category === 'ring' || loot.item_category === 'amulet') return 'erratic';
  if (loot.drop_weight <= 5) return 'aggressive';
  if (loot.drop_weight <= 15) return 'erratic';
  return 'steady';
}

function generatePullPattern(type: 'aggressive' | 'erratic' | 'steady', rodTier: number): PullPatternDto {
  const segments: PullSegmentDto[] = [];
  const segmentCount = 3 + Math.floor(Math.random() * 3); // 3–5 segments

  for (let i = 0; i < segmentCount; i++) {
    const baseSpeed = type === 'aggressive' ? 120 : type === 'erratic' ? 80 : 50;
    const speedVariance = type === 'erratic' ? 60 : 20;

    segments.push({
      duration_ms: 800 + Math.floor(Math.random() * 1200), // 800–2000ms
      speed: baseSpeed + Math.floor(Math.random() * speedVariance) - speedVariance / 2,
      direction: Math.random() > 0.5 ? 'up' : 'down',
      pause_ms: type === 'steady' ? 200 + Math.floor(Math.random() * 300) : Math.floor(Math.random() * 150),
    });
  }

  // Higher tier = narrower green zone (harder)
  const greenZoneWidth = Math.max(0.15, 0.5 - (rodTier - 1) * 0.07);

  return { type, segments, green_zone_width: greenZoneWidth };
}

function generateCatchWindow(pullPattern: PullPatternDto): CatchWindowDto {
  const totalDuration = pullPattern.segments.reduce(
    (sum, s) => sum + s.duration_ms + s.pause_ms, 0,
  );
  // Catch window opens near the end of the pattern
  const windowStart = totalDuration - 500 - Math.floor(Math.random() * 500);
  const windowDuration = 600 + Math.floor(Math.random() * 400); // 600–1000ms

  return {
    window_start_ms: Math.max(500, windowStart),
    window_duration_ms: windowDuration,
  };
}

function validateTiming(
  session: FishingSession,
  inputTimestamps: number[],
  reelTimestamp: number,
): boolean {
  // Must have some inputs (player was actively playing)
  if (inputTimestamps.length < 2) return false;

  // Reel timestamp must be within the catch window (with some tolerance)
  const windowStart = session.biteDelayMs + session.catchWindow.window_start_ms;
  const windowEnd = windowStart + session.catchWindow.window_duration_ms;
  const tolerance = 200; // 200ms tolerance for network latency

  if (reelTimestamp < windowStart - tolerance || reelTimestamp > windowEnd + tolerance) {
    return false;
  }

  // Basic validation: inputs should span a reasonable time range
  const inputSpan = inputTimestamps[inputTimestamps.length - 1]! - inputTimestamps[0]!;
  if (inputSpan < 500) return false; // Too fast — suspicious

  return true;
}

function runSnapCheck(
  characterId: string,
  inputTimestamps: number[],
  reelTimestamp: number,
): boolean {
  if (inputTimestamps.length < 2) return false;

  // Calculate reaction time (time from session start to first input after bite)
  const reactionTime = inputTimestamps[0]!;

  // Store in rolling window
  let history = reactionHistory.get(characterId);
  if (!history) {
    history = [];
    reactionHistory.set(characterId, history);
  }
  history.push(reactionTime);
  if (history.length > REACTION_HISTORY_SIZE) {
    history.shift();
  }

  // Need enough data for statistical check
  if (history.length < SNAP_CHECK_MIN_CASTS) return false;

  // Calculate standard deviation of reaction times
  const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
  const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
  const stddev = Math.sqrt(variance);

  if (stddev < SNAP_CHECK_STDDEV_THRESHOLD) {
    log('warn', 'fishing', 'snap_check_triggered', {
      characterId,
      stddev: stddev.toFixed(2),
      threshold: SNAP_CHECK_STDDEV_THRESHOLD,
      sampleSize: history.length,
    });
    // Reset history after triggering (don't keep punishing)
    reactionHistory.delete(characterId);
    return true;
  }

  return false;
}
