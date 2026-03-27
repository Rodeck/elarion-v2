/**
 * ui-icons.ts
 *
 * Stores custom UI icon URLs (XP, Crowns, Rod Upgrade Points) sent from server via world.state.
 * Falls back to null if not configured — callers use fallback symbols.
 */

let xpIconUrl: string | null = null;
let crownsIconUrl: string | null = null;
let rodUpgradePointsIconUrl: string | null = null;

export function setUiIcons(xp: string | null, crowns: string | null, rodUpgradePoints?: string | null): void {
  xpIconUrl = xp;
  crownsIconUrl = crowns;
  rodUpgradePointsIconUrl = rodUpgradePoints ?? null;
}

export function getXpIconUrl(): string | null {
  return xpIconUrl;
}

export function getCrownsIconUrl(): string | null {
  return crownsIconUrl;
}

export function getRodUpgradePointsIconUrl(): string | null {
  return rodUpgradePointsIconUrl;
}
