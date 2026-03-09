import { broadcastToAll } from '../../websocket/server';
import { log } from '../../logger';
import type { DayNightStateDto } from '@elarion/protocol';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_DURATION_MS  = 45 * 60 * 1000; //  45 minutes
const NIGHT_DURATION_MS = 15 * 60 * 1000; //  15 minutes

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let phase: 'day' | 'night' = 'day';
let phaseStartedAt: number = Date.now();
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function currentDuration(): number {
  return phase === 'day' ? DAY_DURATION_MS : NIGHT_DURATION_MS;
}

function scheduleTransition(): void {
  if (transitionTimer !== null) {
    clearTimeout(transitionTimer);
  }
  const elapsed = Date.now() - phaseStartedAt;
  const remaining = Math.max(0, currentDuration() - elapsed);

  transitionTimer = setTimeout(() => {
    onTransition();
  }, remaining);
}

function onTransition(): void {
  const fromPhase = phase;
  phase = phase === 'day' ? 'night' : 'day';
  phaseStartedAt = Date.now();
  transitionTimer = null;

  log('info', 'day-cycle', 'phase_transition', {
    event: 'phase_transition',
    from_phase: fromPhase,
    to_phase: phase,
  });

  broadcastToAll('world.day_night_changed', getDto());
  scheduleTransition();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getPhase(): 'day' | 'night' {
  return phase;
}

export function getDto(): DayNightStateDto {
  return {
    phase,
    phase_started_at: phaseStartedAt,
    day_duration_ms: DAY_DURATION_MS,
    night_duration_ms: NIGHT_DURATION_MS,
  };
}

/**
 * Force the cycle into a specific phase immediately (admin override).
 * Resets the timer from the moment of the call.
 */
export function forcePhase(newPhase: 'day' | 'night'): void {
  const previous = phase;
  phase = newPhase;
  phaseStartedAt = Date.now();

  log('info', 'day-cycle', 'admin_phase_override', {
    event: 'admin_phase_override',
    previous_phase: previous,
    phase: newPhase,
  });

  broadcastToAll('world.day_night_changed', getDto());
  scheduleTransition();
}

// ---------------------------------------------------------------------------
// Bootstrap — start cycle on module load
// ---------------------------------------------------------------------------

scheduleTransition();
