# Implementation Plan: Game UI Overhaul & Visual Quality Fix

**Branch**: `002-game-ui-overhaul` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-game-ui-overhaul/spec.md`

## Summary

Fix blurry Phaser 3 rendering by enabling pixel-perfect config (`pixelArt: true`, `antialias: false`, DPR-aware canvas sizing), fix HTML overlay drift by syncing ChatBox and CombatLog positions to the canvas bounding rect on Scale Manager resize events, and perform a full visual redesign of all game screens (Login, CharacterCreate, GameScene HUD) using a dark fantasy design language with warm-dark panels, gold accents, Cinzel/Crimson Text typography, and CSS design tokens.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend only — no backend changes)
**Primary Dependencies**: Phaser 3.60.0, Vite 5.0.12, Google Fonts (Cinzel, Crimson Text, Rajdhani)
**Storage**: N/A — no persistence changes
**Testing**: Visual inspection across Chrome/Firefox/Edge at 1280×720, 1920×1080, 2560×1440; DPR tested on HiDPI hardware
**Target Platform**: Desktop browsers (Chrome, Firefox, Edge) on Windows and macOS; 1280px–2560px viewport width
**Project Type**: Web game client (frontend-only change)
**Performance Goals**: 60fps sustained rendering; no visible blur at supported resolutions
**Constraints**: No backend changes; no mobile; existing game mechanics and WebSocket protocol unchanged
**Scale/Scope**: 4 scenes (Boot, Login, CharacterCreate, Game) + 3 UI overlays (StatsBar, ChatBox, CombatLog) + 1 new CSS token file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

This feature is entirely frontend-only (rendering quality and visual design). No game state is mutated. Evaluation against all quality gates:

| Gate | Requirement | Status | Notes |
|---|---|---|---|
| 1. No REST for game state | No game state mutations introduced | ✅ N/A | Feature does not add any client-server communication |
| 2. Server-side validation | Every player-action feature has server validation | ✅ N/A | No new player actions introduced |
| 3. Structured logging | All game-loop code paths emit structured logs | ✅ N/A | No game loop changes; frontend rendering only |
| 4. Contract documented | New message types documented in `contracts/` | ✅ N/A | No new WebSocket messages; no contracts/ changes needed |
| 5. Graceful rejection | Frontend handles server rejections with rollback | ✅ N/A | No server interactions changed |
| 6. Complexity justified | Violations of Principle III documented | ✅ PASS | Design token system and font loading are proportionate to a full visual redesign; no speculative abstractions added |

**Result: All gates PASS or N/A. No violations requiring Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```text
specs/002-game-ui-overhaul/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── index.html                          # Add Google Fonts preconnect + stylesheet link
└── src/
    ├── main.ts                         # Phaser config: pixelArt, antialias, roundPixels, DPR
    ├── styles/
    │   └── tokens.css                  # NEW: CSS custom property design token system
    ├── scenes/
    │   ├── BootScene.ts                # Minor: update progress bar to use new palette
    │   ├── LoginScene.ts               # Full redesign: new layout, fonts, panel styles
    │   ├── CharacterCreateScene.ts     # Full redesign: new card styles, layout, palette
    │   └── GameScene.ts                # Add overlay sync on Scale Manager resize event
    └── ui/
        ├── StatsBar.ts                 # Full redesign: new Phaser Graphics palette + Cinzel font
        ├── ChatBox.ts                  # Full redesign: new CSS + scale-aware positioning
        └── CombatLog.ts                # Full redesign: new CSS + scale-aware positioning
```

**Structure Decision**: Frontend-only web application (Option 2 base, frontend subtree only). Backend and shared directories are untouched. A new `frontend/src/styles/` directory is introduced to hold the CSS design token file — this is the only new directory created.

## Complexity Tracking

> No constitution violations. Table not required.

---

## Phase 0: Research Output

See [research.md](research.md) for full findings. Summary of decisions:

| Unknown | Decision |
|---|---|
| Cause of blurry rendering | Missing `pixelArt: true` and `antialias: false` in Phaser config |
| DPR handling | Scale canvas by `Math.min(devicePixelRatio, 2)` with inverse `zoom` |
| Scale mode | Keep `Phaser.Scale.FIT` — correct choice, not the cause of blur |
| HTML overlay drift | Reposition on `Phaser.Scale.Events.RESIZE` using `canvas.getBoundingClientRect()` |
| Visual design language | Warm-dark palette, Cinzel + Crimson Text, CSS custom property tokens |

---

## Phase 1: Design

### Key Technical Decisions

#### A — Phaser Config Changes (`main.ts`)

```typescript
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800 * dpr,
  height: 600 * dpr,
  zoom: 1 / dpr,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: '#1a1814',
  parent: 'game',
  scene: [BootScene, LoginScene, CharacterCreateScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

#### B — CSS Design Token System (`frontend/src/styles/tokens.css`)

Single file imported in `index.html`. Provides all `--color-*`, `--font-*`, and `--type-*` CSS custom properties for use by all HTML overlay elements. See [data-model.md](data-model.md) for the full token table.

#### C — Phaser Token Constants (`frontend/src/styles/phaser-tokens.ts`)

Exports matching hex integer constants for use in Phaser `Graphics.fillStyle()` and `Text` style objects:

```typescript
export const Colors = {
  bgPanel:      0x252119,
  bgPanelAlt:   0x2f2a21,
  bgInset:      0x1a1612,
  textPrimary:  '#f5e6c8',
  textSecondary:'#c8b89a',
  goldPrimary:  0xd4a84b,
  goldBright:   0xf0c060,
  goldDim:      0x8b7355,
  goldSubtle:   0x5c4d3d,
  hpHigh:       0xc0392b,
  hpMid:        0x922b21,
  hpLow:        0x7b241c,
  hpBg:         0x2c1010,
  xpFill:       0xd4a84b,
  xpBg:         0x2a2010,
} as const;

export const Fonts = {
  display: 'Cinzel, "Palatino Linotype", serif',
  body:    '"Crimson Text", Georgia, serif',
  number:  'Rajdhani, Oswald, sans-serif',
} as const;
```

#### D — Scale-Aware Overlay Positioning

ChatBox and CombatLog are updated to expose a `reposition(rect: DOMRect)` method. GameScene calls it on init and on `this.scale.on('resize', ...)`:

```typescript
// In GameScene
private syncOverlays(): void {
  const rect = this.game.canvas.getBoundingClientRect();
  this.chatBox.reposition(rect);
  this.combatLog.reposition(rect);
}

// Called in create() and on Scale resize event
this.scale.on(Phaser.Scale.Events.RESIZE, this.syncOverlays, this);
this.syncOverlays();
```

Each overlay's `reposition` calculates:
- ChatBox: `left = rect.left + 12`, `bottom = window.innerHeight - rect.bottom + 12`
- CombatLog: `right = window.innerWidth - rect.right + 12`, `bottom = window.innerHeight - rect.bottom + 12`

#### E — Screen-by-Screen Redesign Scope

| Screen | Changes |
|---|---|
| **BootScene** | Progress bar recoloured to gold-on-dark; background updated to `#1a1814` |
| **LoginScene** | Full rebuild: Cinzel title, styled tabs (LOCAL tab pattern repurposed for LOGIN/REGISTER), dark panel, gold-border inputs, gold submit button, `tokens.css` used |
| **CharacterCreateScene** | Full rebuild: three class cards with gradient gold borders, Cinzel class names, Crimson Text descriptions, redesigned stat bars using new palette |
| **StatsBar** | Full Phaser Graphics rebuild: new panel background, Cinzel labels via Phaser Text, numeric values in Rajdhani, redesigned HP/XP bars using new Phaser palette constants |
| **ChatBox** | Full CSS rebuild using `tokens.css`: dark panel, Cinzel tab labels, Crimson Text messages, colour-coded channels (local/global), styled scrollbar, gold input border; add `reposition()` method |
| **CombatLog** | Full CSS rebuild using `tokens.css`: dark panel with Cinzel header, colour-coded log lines (dmg/heal/miss/crit), styled scrollbar; add `reposition()` method |

### Contracts

No new WebSocket message types are introduced. No changes to `shared/protocol/`. The `contracts/` directory is not modified.

### Font Loading

Google Fonts loaded in `index.html` before the game script:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet">
```

Phaser scenes that use web fonts in `add.text()` must load after fonts are available. The existing `BootScene` provides a natural loading gate — fonts loaded via `<link rel="stylesheet">` with `display=swap` will be available before user-facing scenes render.
