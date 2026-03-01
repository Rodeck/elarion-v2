# Data Model: Game UI Overhaul & Visual Quality Fix

**Branch**: `002-game-ui-overhaul` | **Date**: 2026-03-01

---

## Overview

This feature introduces no new backend entities or database schema changes. The data model for this feature is a **UI design token system** — a set of CSS custom properties and Phaser style constants that form the single source of truth for all visual values used across every game screen.

---

## UI Design Token System

### Color Tokens (CSS custom properties)

Defined in `frontend/src/styles/tokens.css` on `:root`. All HTML overlay elements consume these tokens. Phaser in-canvas elements use the hex integer equivalents defined in `frontend/src/styles/phaser-tokens.ts`.

#### Backgrounds

| Token | Value | Usage |
|---|---|---|
| `--color-bg-deepest` | `#0f0d0a` | Outermost page / scene void |
| `--color-bg-base` | `#1a1814` | Canvas background, behind all UI |
| `--color-bg-panel` | `#252119` | All UI panel surfaces |
| `--color-bg-panel-alt` | `#2f2a21` | Elevated / hover / active tab surface |
| `--color-bg-inset` | `#1a1612` | Input fields, recessed areas |
| `--color-bg-overlay` | `rgba(10,8,5,0.82)` | Full-screen modal overlays |

#### Text

| Token | Value | Contrast on panel | Usage |
|---|---|---|---|
| `--color-text-primary` | `#f5e6c8` | 12.5:1 (AAA) | All readable body text |
| `--color-text-secondary` | `#c8b89a` | 7.2:1 (AAA) | Labels, stat names |
| `--color-text-muted` | `#9b8b72` | 4.1:1 (decorative only) | Timestamps, placeholders |
| `--color-text-disabled` | `#5a5040` | — | Greyed-out / locked elements |

#### Gold Accent (primary interactive colour)

| Token | Value | Usage |
|---|---|---|
| `--color-gold-bright` | `#f0c060` | Selected state, focus indicator |
| `--color-gold-primary` | `#d4a84b` | Buttons, active tab underline, XP bar |
| `--color-gold-dim` | `#8b7355` | Panel borders (non-active) |
| `--color-gold-subtle` | `#5c4d3d` | Dividers, input borders (unfocused) |

#### Status Bars

| Token | Value | Usage |
|---|---|---|
| `--color-hp-high` | `#c0392b` | HP bar — full |
| `--color-hp-mid` | `#922b21` | HP bar — 30–60% |
| `--color-hp-low` | `#7b241c` | HP bar — below 30% |
| `--color-hp-bg` | `#2c1010` | HP bar track |
| `--color-mp-high` | `#1f6fa6` | Mana bar fill |
| `--color-mp-bg` | `#0a1a2e` | Mana bar track |
| `--color-xp-fill` | `#d4a84b` | XP bar (matches gold-primary) |
| `--color-xp-bg` | `#2a2010` | XP bar track |

#### Chat & Combat Log

| Token | Value | Usage |
|---|---|---|
| `--color-chat-local` | `#f5e6c8` | Local channel messages |
| `--color-chat-global` | `#8ecae6` | Global channel messages |
| `--color-chat-system` | `#e9c46a` | System announcements |
| `--color-combat-dmg` | `#e74c3c` | Damage dealt lines |
| `--color-combat-heal` | `#52b373` | Healing lines |
| `--color-combat-miss` | `#9b8b72` | Miss / dodge lines |
| `--color-combat-crit` | `#f0c060` | Critical hit lines |

---

### Typography Tokens

| Token | Value | Usage |
|---|---|---|
| `--font-display` | `'Cinzel', 'Palatino Linotype', serif` | Headings, labels, buttons |
| `--font-body` | `'Crimson Text', 'Georgia', serif` | Chat, combat log, body text |
| `--font-ui-number` | `'Rajdhani', 'Oswald', sans-serif` | Numeric stat values |
| `--type-title` | `clamp(28px, 4vw, 48px)` | Screen titles (Login, etc.) |
| `--type-heading` | `clamp(18px, 2.5vw, 24px)` | Panel headers, class names |
| `--type-label` | `14px` | Stat names, input labels |
| `--type-value` | `16px` | Stat numbers |
| `--type-body` | `13px` | Chat, combat log lines |
| `--type-small` | `11px` | Timestamps, channel tags (decorative only) |

---

### Layout Tokens

| Component | Position | Width | Height |
|---|---|---|---|
| Stats bar | `top: 12px; left: 12px` | `clamp(200px, 20vw, 280px)` | auto |
| Chat box | `bottom: 12px; left: 12px` | `clamp(260px, 28vw, 380px)` | `clamp(160px, 20vh, 240px)` |
| Combat log | `bottom: 12px; right: 12px` | `clamp(220px, 24vw, 320px)` | `max clamp(120px, 16vh, 200px)` |
| Class card | — | `clamp(160px, 22vw, 220px)` | `clamp(240px, 30vh, 320px)` |

---

### Phaser Config Change

The following Phaser `GameConfig` properties change as a result of this feature:

| Property | Before | After | Reason |
|---|---|---|---|
| `pixelArt` | missing | `true` | Nearest-neighbour texture sampling — fixes blur |
| `antialias` | missing (default true) | `false` | Disables WebGL antialiasing |
| `roundPixels` | missing (default true) | explicit `true` | Documents intent; prevents sub-pixel drift |
| `width` | `800` | `800 * dpr` | DPR-aware internal resolution |
| `height` | `600` | `600 * dpr` | DPR-aware internal resolution |
| `zoom` | missing | `1 / dpr` | Inverse zoom to maintain visual game size |

Where `dpr = Math.min(window.devicePixelRatio || 1, 2)`.

---

## No New Backend Entities

This feature is frontend-only. No database tables, WebSocket message types, or shared protocol types are added or modified.
