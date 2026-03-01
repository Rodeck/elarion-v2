# Quickstart: Game UI Overhaul & Visual Quality Fix

**Branch**: `002-game-ui-overhaul` | **Date**: 2026-03-01

---

## Prerequisites

- Node.js 20 LTS installed
- Backend running (for login to work; optional for visual-only testing)
- A modern browser (Chrome, Firefox, or Edge)

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Testing the Visual Fixes

### 1. Verify pixel-perfect rendering

1. Open the game in Chrome at any resolution
2. Open DevTools → right-click the canvas → Inspect
3. With the game loaded in BootScene or LoginScene, zoom into tile/sprite edges
4. **Expected**: Clean, sharp pixel edges — no blur or anti-aliasing halo

### 2. Test scaling across window sizes

Resize the browser window from wide to narrow. At each size:
- Stats bar should remain anchored top-left **relative to the canvas edge** (not the viewport edge)
- Chat box should remain anchored bottom-left relative to canvas
- Combat log should remain anchored bottom-right relative to canvas
- No element should disappear or overlap another

**Quick test sizes**:
- 1920×1080 (full HD)
- 1280×720 (minimum supported)
- 1600×900 (common laptop)

### 3. Test at the minimum supported resolution

Set the browser to 1280px wide (use DevTools device toolbar or resize manually):
- Login screen: all elements (title, tabs, inputs, button) visible without scrolling
- Character creation: all 3 class cards visible without horizontal scroll
- Game HUD: stats bar, chat, and combat log all fit without overlap

### 4. Test DPR handling (if on HiDPI display)

On a MacBook Retina or Windows display with scaling:
- Open DevTools Console
- Run: `console.log(window.devicePixelRatio)` — should be 2.0 on Retina
- Verify game canvas renders at `1600×1200` internal resolution (800×600 × 2)
- Text and sprites should appear sharper than before the fix

### 5. Check visual consistency across screens

Navigate through all screens and verify:
- All panels use the dark warm-brown palette (not pure black, not the old dark green)
- All headings use Cinzel font
- All chat/body text uses Crimson Text
- Gold (`#d4a84b`) is the only accent colour on interactive elements
- HP bar is crimson, XP bar is gold, mana bar is blue
- Combat log damage lines are red, heal lines are green, crits are gold

---

## Font Loading Verification

Open browser DevTools → Network tab, filter by "Font":
- `Cinzel` should load from Google Fonts
- `Crimson Text` should load from Google Fonts
- `Rajdhani` should load from Google Fonts

If fonts do not load (offline dev environment), the UI will fall back to `Palatino Linotype` / `Georgia` — visually acceptable but not the final design.

---

## Known Non-Issues

- The `#game` div background visible in letterboxed areas (black bars on ultrawide) is intentional — the body background is `#0f0d0a`.
- At DPR=1 (standard display), the game renders at 800×600 internally with `pixelArt: true` — this is correct.
- The combat log is hidden by default and only appears when combat starts.
