/**
 * ui-icons.ts
 *
 * Stores custom UI icon URLs (XP, Crowns) sent from server via world.state.
 * Falls back to null if not configured — callers use fallback symbols.
 */

let xpIconUrl: string | null = null;
let crownsIconUrl: string | null = null;

export function setUiIcons(xp: string | null, crowns: string | null): void {
  xpIconUrl = xp;
  crownsIconUrl = crowns;
}

export function getXpIconUrl(): string | null {
  return xpIconUrl;
}

export function getCrownsIconUrl(): string | null {
  return crownsIconUrl;
}
