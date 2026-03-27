/**
 * fishing-minigame.ts
 *
 * Fishing mini-game UI rendered as an HTML overlay.
 * Shows a tension meter bar where the player clicks to keep a cursor in the green zone,
 * then clicks a reel-in button during the catch window.
 */

import type { WSClient } from '../network/WSClient';
import type {
  FishingSessionStartPayload,
  FishingResultPayload,
  FishingRejectedPayload,
  PullPatternDto,
  PullSegmentDto,
  CatchWindowDto,
} from '../../../shared/protocol/index';

export class FishingMinigame {
  private ws: WSClient;
  private container: HTMLDivElement | null = null;
  private meterBar: HTMLDivElement | null = null;
  private cursor: HTMLDivElement | null = null;
  private greenZone: HTMLDivElement | null = null;
  private reelButton: HTMLButtonElement | null = null;
  private statusText: HTMLDivElement | null = null;

  private sessionId: string = '';
  private biteDelayMs: number = 0;
  private pullPattern: PullPatternDto | null = null;
  private catchWindow: CatchWindowDto | null = null;
  private sessionStartTime: number = 0;
  private inputTimestamps: number[] = [];
  private animFrameId: number = 0;
  private cursorPosition: number = 0.5; // 0–1 normalized
  private currentSegmentIndex: number = 0;
  private segmentElapsed: number = 0;
  private phase: 'idle' | 'waiting' | 'tension' | 'done' = 'idle';
  private biteTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFrameTime: number = 0;

  constructor(ws: WSClient) {
    this.ws = ws;
  }

  // ---------------------------------------------------------------------------
  // Public API (called by GameScene message handlers)
  // ---------------------------------------------------------------------------

  onSessionStart(payload: FishingSessionStartPayload): void {
    this.sessionId = payload.session_id;
    this.biteDelayMs = payload.bite_delay_ms;
    this.pullPattern = payload.pull_pattern;
    this.catchWindow = payload.catch_window;
    this.sessionStartTime = Date.now();
    this.inputTimestamps = [];
    this.cursorPosition = 0.5;
    this.currentSegmentIndex = 0;
    this.segmentElapsed = 0;
    this.phase = 'waiting';

    this.createUI();
    this.setStatus(`Waiting for a bite... (${payload.fish_silhouette} shadow)`);

    // After bite delay, start the tension phase
    this.biteTimeout = setTimeout(() => {
      this.phase = 'tension';
      this.lastFrameTime = performance.now();
      this.setStatus('Fish on! Keep the cursor in the green zone!');
      this.showMeter();
      this.animFrameId = requestAnimationFrame((t) => this.updateLoop(t));
    }, this.biteDelayMs);
  }

  onResult(payload: FishingResultPayload): void {
    this.phase = 'done';
    this.stopAnimation();

    if (payload.snap_check_failed) {
      this.setStatus('Line snapped! (suspicious timing detected)');
    } else if (payload.success && payload.fish_name) {
      this.setStatusWithIcon(`Caught: ${payload.fish_name}!`, payload.fish_icon_url);
    } else {
      this.setStatus('The fish got away...');
    }

    if (payload.rod_locked) {
      this.appendStatus('Your rod needs repair!');
    }

    // Auto-close after 2 seconds
    setTimeout(() => this.destroyUI(), 2000);
  }

  onRejected(payload: FishingRejectedPayload): void {
    this.phase = 'done';
    this.stopAnimation();
    this.setStatus(payload.message);
    setTimeout(() => this.destroyUI(), 2000);
  }

  destroy(): void {
    this.stopAnimation();
    this.destroyUI();
  }

  // ---------------------------------------------------------------------------
  // UI creation
  // ---------------------------------------------------------------------------

  private createUI(): void {
    this.destroyUI();

    this.container = document.createElement('div');
    this.container.id = 'fishing-minigame';
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '400px',
      padding: '20px',
      backgroundColor: 'rgba(20, 18, 14, 0.95)',
      border: '2px solid #d4a84b',
      borderRadius: '8px',
      zIndex: '1000',
      fontFamily: '"Crimson Text", serif',
      color: '#e8dcc8',
      textAlign: 'center',
    });

    this.statusText = document.createElement('div');
    Object.assign(this.statusText.style, {
      fontSize: '16px',
      marginBottom: '16px',
      minHeight: '40px',
    });
    this.container.appendChild(this.statusText);

    // Meter bar (hidden initially, shown during tension phase)
    this.meterBar = document.createElement('div');
    Object.assign(this.meterBar.style, {
      position: 'relative',
      width: '100%',
      height: '30px',
      backgroundColor: '#2a2520',
      border: '1px solid #665533',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'none',
      marginBottom: '12px',
      cursor: 'pointer',
    });

    // Green zone
    this.greenZone = document.createElement('div');
    Object.assign(this.greenZone.style, {
      position: 'absolute',
      top: '0',
      height: '100%',
      backgroundColor: 'rgba(80, 180, 80, 0.4)',
      border: '1px solid rgba(80, 180, 80, 0.6)',
    });
    this.meterBar.appendChild(this.greenZone);

    // Cursor
    this.cursor = document.createElement('div');
    Object.assign(this.cursor.style, {
      position: 'absolute',
      top: '0',
      width: '4px',
      height: '100%',
      backgroundColor: '#f0c060',
      transition: 'none',
    });
    this.meterBar.appendChild(this.cursor);

    // Click handler on meter bar — player input
    this.meterBar.addEventListener('click', () => this.onMeterClick());

    this.container.appendChild(this.meterBar);

    // Reel-in button (hidden until catch window)
    this.reelButton = document.createElement('button');
    this.reelButton.textContent = 'REEL IN!';
    Object.assign(this.reelButton.style, {
      display: 'none',
      padding: '8px 24px',
      fontSize: '18px',
      fontFamily: '"Cinzel", serif',
      backgroundColor: '#d4a84b',
      color: '#1a1714',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: 'bold',
    });
    this.reelButton.addEventListener('click', () => this.onReelClick());
    this.container.appendChild(this.reelButton);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      display: 'block',
      marginTop: '8px',
      padding: '4px 12px',
      fontSize: '12px',
      backgroundColor: 'transparent',
      color: '#998866',
      border: '1px solid #665533',
      borderRadius: '4px',
      cursor: 'pointer',
      margin: '8px auto 0',
    });
    cancelBtn.addEventListener('click', () => {
      this.ws.send('fishing.cancel', { session_id: this.sessionId });
      this.destroy();
    });
    this.container.appendChild(cancelBtn);

    document.body.appendChild(this.container);
  }

  private showMeter(): void {
    if (!this.meterBar || !this.greenZone || !this.pullPattern) return;

    this.meterBar.style.display = 'block';

    // Position green zone at center with configured width
    const zoneWidth = this.pullPattern.green_zone_width * 100;
    const zoneLeft = (100 - zoneWidth) / 2;
    this.greenZone.style.left = `${zoneLeft}%`;
    this.greenZone.style.width = `${zoneWidth}%`;
  }

  private destroyUI(): void {
    if (this.biteTimeout) {
      clearTimeout(this.biteTimeout);
      this.biteTimeout = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.phase = 'idle';
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private updateLoop(time: number): void {
    if (this.phase !== 'tension') return;

    const dt = time - this.lastFrameTime;
    this.lastFrameTime = time;

    // Apply pull pattern to cursor position
    this.applyCursorPull(dt);
    this.renderCursor();

    // Check if catch window is active
    const elapsed = Date.now() - this.sessionStartTime - this.biteDelayMs;
    if (this.catchWindow) {
      const windowStart = this.catchWindow.window_start_ms;
      const windowEnd = windowStart + this.catchWindow.window_duration_ms;

      if (elapsed >= windowStart && elapsed <= windowEnd) {
        if (this.reelButton) this.reelButton.style.display = 'inline-block';
      } else if (elapsed > windowEnd) {
        // Catch window passed — auto-complete with failure
        this.sendComplete();
        return;
      }
    }

    // Check if all segments are done and past catch window
    const totalDuration = this.pullPattern!.segments.reduce(
      (sum, s) => sum + s.duration_ms + s.pause_ms, 0,
    );
    if (elapsed > totalDuration + 1000) {
      this.sendComplete();
      return;
    }

    this.animFrameId = requestAnimationFrame((t) => this.updateLoop(t));
  }

  private applyCursorPull(dt: number): void {
    if (!this.pullPattern) return;
    const segments = this.pullPattern.segments;
    if (this.currentSegmentIndex >= segments.length) return;

    const seg = segments[this.currentSegmentIndex]!;
    this.segmentElapsed += dt;

    if (this.segmentElapsed < seg.duration_ms) {
      // Apply pull
      const pullDelta = (seg.speed / 1000) * (dt / 1000);
      if (seg.direction === 'up') {
        this.cursorPosition = Math.min(1, this.cursorPosition + pullDelta);
      } else {
        this.cursorPosition = Math.max(0, this.cursorPosition - pullDelta);
      }
    } else if (this.segmentElapsed >= seg.duration_ms + seg.pause_ms) {
      // Move to next segment
      this.currentSegmentIndex++;
      this.segmentElapsed = 0;
    }
    // else: in pause — no pull
  }

  private renderCursor(): void {
    if (!this.cursor) return;
    this.cursor.style.left = `${this.cursorPosition * 100}%`;
  }

  private stopAnimation(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Player input
  // ---------------------------------------------------------------------------

  private onMeterClick(): void {
    if (this.phase !== 'tension') return;

    const timestamp = Date.now() - this.sessionStartTime;
    this.inputTimestamps.push(timestamp);

    // Player click counteracts the pull — nudge cursor toward center
    const center = 0.5;
    const nudge = 0.08;
    if (this.cursorPosition > center) {
      this.cursorPosition = Math.max(center - 0.02, this.cursorPosition - nudge);
    } else {
      this.cursorPosition = Math.min(center + 0.02, this.cursorPosition + nudge);
    }
  }

  private onReelClick(): void {
    if (this.phase !== 'tension') return;
    this.sendComplete();
  }

  private sendComplete(): void {
    this.phase = 'done';
    this.stopAnimation();

    const reelTimestamp = Date.now() - this.sessionStartTime;
    this.ws.send('fishing.complete', {
      session_id: this.sessionId,
      input_timestamps: this.inputTimestamps,
      reel_timestamp: reelTimestamp,
    });

    this.setStatus('Reeling in...');
  }

  // ---------------------------------------------------------------------------
  // Status display
  // ---------------------------------------------------------------------------

  private setStatus(text: string): void {
    if (this.statusText) this.statusText.textContent = text;
  }

  private setStatusWithIcon(text: string, iconUrl: string | null): void {
    if (!this.statusText) return;
    this.statusText.innerHTML = '';
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.cssText = 'width:32px;height:32px;vertical-align:middle;margin-right:8px;image-rendering:pixelated;';
      this.statusText.appendChild(img);
    }
    this.statusText.appendChild(document.createTextNode(text));
  }

  private appendStatus(text: string): void {
    if (this.statusText) this.statusText.textContent += '\n' + text;
  }
}
