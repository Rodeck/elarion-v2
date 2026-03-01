# Research: Game UI Overhaul & Visual Quality Fix

**Branch**: `002-game-ui-overhaul` | **Date**: 2026-03-01

---

## Decision 1: Pixel-Perfect Rendering Config

**Decision**: Enable `pixelArt: true`, `antialias: false`, and explicit `roundPixels: true` in the Phaser 3 game config.

**Rationale**: The current config is missing `pixelArt: true`, which means Phaser uses linear interpolation (bilinear smoothing) when scaling textures — the direct cause of blurry sprites and tiles. Setting `pixelArt: true` switches to nearest-neighbour interpolation, giving crisp pixel edges. `antialias: false` disables WebGL-level antialiasing. `roundPixels: true` prevents sub-pixel rendering at fractional camera positions (another source of blur on tile-based maps).

**Alternatives considered**:
- CSS `image-rendering: pixelated` on the canvas — Partial fix; only affects CSS scaling, not WebGL texture sampling. Does not address the root issue.
- Keeping current config and increasing base resolution — Does not fix smoothing; only changes the resolution at which blurring occurs.

---

## Decision 2: Device Pixel Ratio (DPR) Handling

**Decision**: Scale the Phaser canvas internal resolution by `Math.min(window.devicePixelRatio, 2)` and apply an inverse `zoom` to maintain visual game size. Cap at 2× to avoid excessive GPU load.

**Rationale**: Phaser 3 does not automatically account for high-DPI (Retina) displays. Without DPR scaling, the canvas renders at 800×600 logical pixels and is CSS-scaled up on HiDPI screens, causing blurriness. Multiplying `width` and `height` by DPR and setting `zoom: 1/dpr` makes the canvas render at native screen pixel density while keeping all game coordinates unchanged. Capping at `2` prevents the 9× pixel cost of a 3× DPR display.

**Alternatives considered**:
- Loading separate `@2x` / `@3x` asset variants — More complex asset pipeline; overkill for a project currently using placeholder rectangles and a single spritesheet.
- Ignoring DPR — Leaves Retina/HiDPI displays noticeably blurry even after `pixelArt: true`.

---

## Decision 3: Scale Mode — Keep FIT

**Decision**: Retain `Phaser.Scale.FIT` with `autoCenter: Phaser.Scale.CENTER_BOTH`.

**Rationale**: FIT mode scales the canvas to the largest size that fits the viewport while preserving aspect ratio. It does not cause inherent blur — the blur in the current project comes from missing `pixelArt` config, not the scale mode. FIT is the correct choice for a fixed-aspect game that must work across monitor sizes without stretching.

**Alternatives considered**:
- `RESIZE` mode — Stretches canvas to fill any aspect ratio; would distort the 800×600 game world on ultrawide or portrait viewports.
- `NO_SCALE` — Leaves a fixed 800×600 canvas that does not fill larger displays; fails the SC-001 and SC-006 requirements.
- `EXPAND` — Shows more world area on larger screens; desirable long-term but changes game geometry and is out of scope for this feature.

---

## Decision 4: HTML Overlay Positioning Strategy

**Decision**: Reposition HTML overlay elements (ChatBox, CombatLog) using the Phaser Scale Manager `resize` event. On each resize, read `canvas.getBoundingClientRect()` to determine actual canvas screen position, then set overlay `left`/`right`/`bottom` CSS values relative to canvas edges rather than the viewport.

**Rationale**: The current ChatBox and CombatLog use `position: fixed` with offsets relative to the viewport. When Phaser's FIT mode centres the canvas (with letterboxing/pillarboxing margins), the overlays drift away from the canvas edges. Listening to `Phaser.Scale.Events.RESIZE` and computing positions from the canvas bounding rect solves this without changing the rest of the HTML structure.

**Alternatives considered**:
- Wrapping overlays in a transform-mirroring container — Cleaner CSS architecture but requires matching the exact CSS transform Phaser applies to the canvas, which is fragile across Phaser versions.
- Converting overlays to Phaser `DOMElement` objects — These sit in Phaser's own DOM container (already positioned correctly over the canvas), but `DOMElement` has known limitations with scrollable content and event handling; would require rewriting the ChatBox scroll and input logic.
- Converting overlays to native Phaser GameObjects (Text + Graphics) — Eliminates the HTML positioning problem entirely and is the cleanest long-term solution, but is a larger rewrite than strictly needed for this feature.

---

## Decision 5: Visual Design Language

**Decision**: Dark fantasy palette with warm-dark backgrounds, parchment-cream text, gold accents, and crimson/sapphire status bars. Two-font system: Cinzel (display) + Crimson Text (body). CSS custom property tokens shared across all HTML overlay panels.

**Rationale**: Dark fantasy RPG UIs conventionally use warm near-black backgrounds (not pure black), gold as the primary interactive accent, and high-contrast cream text. This avoids the "modern flat UI" feel of the current placeholder while staying consistent with the game's existing `#1a2a1a` / `#0a1a0a` dark-green base. Cinzel is a Google Font with no license restrictions, works at all weights for display use, and is the de-facto standard for fantasy game UIs in the browser. Crimson Text provides legibility for scrolling chat and combat log at 12-13px.

**Palette tokens** (see data-model.md for full token set):
- Background panel: `#252119` at 92% opacity
- Primary text: `#f5e6c8` (12.5:1 contrast on panel — WCAG AAA)
- Gold accent: `#d4a84b` (6.8:1 — WCAG AAA)
- HP bar: `#c0392b` → `#7b241c` (full → low)
- XP bar: `#d4a84b` (gold, matches accent)

**Alternatives considered**:
- Cold blue-grey palette (Diablo/dark sci-fi aesthetic) — Does not match the existing green-earthy base colours of the game world.
- Pure CSS framework (e.g., RPG UI) — Third-party UI kits add maintenance burden and reduce design control; custom tokens are simpler for a project this size.

---

## Decision 6: Phaser In-Canvas vs CSS/HTML for HUD

**Decision**: Keep the existing hybrid approach — Phaser GameObjects for StatsBar (already in-canvas), CSS HTML panels for ChatBox and CombatLog — but fix the scale-awareness of the HTML panels.

**Rationale**: Rewriting StatsBar as HTML or ChatBox as Phaser GameObjects is out of scope. The existing split is reasonable: stats bars are simple graphics best drawn in-canvas; chat with scrollable message lists and text input is best handled by the browser's native DOM. The fix needed is only the positioning sync, not an architectural change.

**Alternatives considered**:
- Full conversion of all overlays to Phaser GameObjects — Eliminates CSS/canvas mismatch entirely; would be ideal architecture but is a significantly larger change deferred to a future feature.

---

## Unresolved Items

None. All NEEDS CLARIFICATION markers from the spec are resolved. Scope is confirmed as full visual redesign including technical fixes.
