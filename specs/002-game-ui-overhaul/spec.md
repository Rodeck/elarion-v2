# Feature Specification: Game UI Overhaul & Visual Quality Fix

**Feature Branch**: `002-game-ui-overhaul`
**Created**: 2026-03-01
**Status**: Draft
**Input**: User description: "I want to update game UI, right now this phaser thing looks really bad, and event with small application it has some scaling issues, blurred game visuals etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sharp Visuals at Any Screen Size (Priority: P1)

A player opens the game on their monitor and sees crisp, clear game visuals — tiles, characters, and all UI elements appear sharp without any blurriness or smoothing artifacts, regardless of whether their screen is a small laptop display or a large desktop monitor.

**Why this priority**: Blurry visuals are the most immediately visible quality problem and directly signal a low-quality product. This is the single most impactful fix for player experience.

**Independent Test**: Can be tested by launching the game on screens of different physical sizes and resolutions and visually inspecting that all rendered elements (tiles, sprites, text, UI) are crisp with clean edges.

**Acceptance Scenarios**:

1. **Given** a player opens the game on a 1080p (1920×1080) display, **When** the game canvas renders, **Then** all tiles, characters, and UI text appear crisp with clean edges and no blurriness.
2. **Given** a player opens the game on a 4K (2560×1440) display, **When** the game renders, **Then** game visuals scale up clearly without any blur or smoothing artifacts.
3. **Given** a player opens the game on a 720p (1280×720) display, **When** the game renders, **Then** all visuals remain sharp and text remains legible without blurring.

---

### User Story 2 - Stable Layout When Window Is Small or Resized (Priority: P2)

A player opens the game in a smaller browser window — or resizes their window after launch — and the game canvas and all UI overlay elements (stats bar, chat box, combat log) adjust proportionally. Nothing goes off-screen, overlaps awkwardly, or becomes misaligned.

**Why this priority**: Scaling breakage makes the game unusable in any non-maximized window, which is a common developer and tester scenario and affects first impressions.

**Independent Test**: Can be tested by opening the game in a window approximately 1280×720 and resizing it while all game screens are active, verifying all UI elements remain visible and correctly anchored throughout.

**Acceptance Scenarios**:

1. **Given** the game is running in the main game view, **When** the player resizes the window to a smaller size, **Then** the game canvas scales down proportionally and all UI overlays (stats, chat, combat log) remain anchored to their correct screen positions without going off-screen.
2. **Given** the player opens the game in a small window at the minimum supported resolution (1280×720), **When** the login screen appears, **Then** all form elements and buttons are visible and usable without needing to scroll.
3. **Given** the game canvas has scaled to fit a wide monitor, **When** multiple UI overlays are simultaneously visible, **Then** no overlay element overlaps another or extends beyond the visible game area.

---

### User Story 3 - Visually Coherent UI Presentation (Priority: P3)

A player navigates through all game screens — login, character creation, and in-game HUD — and the UI looks intentional and coherent: readable text, appropriate contrast, consistent visual style, and a layout that matches the dark fantasy theme of the game rather than a prototype or debug build.

**Why this priority**: Beyond the technical fixes, the overall UI needs to look designed rather than placeholder. This affects player trust and retention after the first session.

**Independent Test**: Can be tested by reviewing each game screen (login, character select, game HUD with all overlays active) and checking for consistent colors, readable text at all sizes, and no obviously mismatched or broken visual elements.

**Acceptance Scenarios**:

1. **Given** a player views the login/register screen, **When** they examine the layout, **Then** the title, input fields, tabs, and buttons are visually distinct, text is readable, and the layout is balanced and intentional.
2. **Given** a player is in the main game with the HUD active, **When** stats bar, chat box, and combat log are all visible simultaneously, **Then** each element has clear visual hierarchy, sufficient contrast against the game background, and does not visually interfere with gameplay.
3. **Given** a player is on the character creation screen, **When** they view the class selection cards, **Then** selected and unselected states are visually distinct, class information is readable, and the overall layout is clean.

---

### Edge Cases

- What happens when the browser window is resized to below the minimum supported resolution (e.g., 800px wide)?
- How do multiple overlay elements (stats, chat, combat log) behave simultaneously on a small screen — do they overlap?
- How does the game handle non-standard browser zoom levels (e.g., 150% or 67%)?
- How does the UI behave when the browser is in a very wide aspect ratio (ultrawide monitor, e.g., 21:9)?
- What happens if a player has a system display scaling setting (e.g., 125% or 150% DPI scaling) applied?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Game visuals MUST render without blurriness, smoothing, or scaling artifacts at all supported screen resolutions
- **FR-002**: The game canvas MUST scale proportionally to fill the available browser window while preserving the game's original aspect ratio
- **FR-003**: All fixed UI overlay elements (stats bar, chat box, combat log) MUST remain correctly anchored to their respective screen positions when the viewport is resized
- **FR-004**: Login and character creation screens MUST display all interactive elements (inputs, buttons, labels) without requiring the player to scroll at the minimum supported resolution
- **FR-005**: All game UI text MUST be legible (sufficient size and contrast) at all supported screen resolutions
- **FR-006**: The game MUST support viewport widths from 1280px to 2560px without layout breakage or visual quality degradation
- **FR-007**: All game screens MUST follow a consistent visual style with a coherent color palette and clear visual hierarchy matching the game's dark fantasy aesthetic
- **FR-008**: All game screens (login, character creation, in-game HUD) MUST receive a full visual redesign — new layout, color palette, panel styles, and typography — delivering a cohesive design language that replaces the current placeholder UI from scratch

### Assumptions

- Desktop browsers (Chrome, Firefox, Edge) on Windows and macOS are the primary target; mobile and touch device support is out of scope for this feature
- The existing game mechanics and network behavior remain unchanged; this feature addresses only visual quality and UI presentation
- Players are expected to use the game in landscape orientation on desktop displays

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Game visuals render with no visible blur at all supported resolutions from 1280×720 to 2560×1440 — verifiable by visual inspection on test devices at each resolution
- **SC-002**: All UI overlay elements remain fully within the visible game area when the viewport is set to the minimum supported size (1280×720)
- **SC-003**: All game screens (login, character creation, main game HUD) are fully usable at 1280×720 without scrolling
- **SC-004**: All game screens maintain visual consistency — a reviewer examining any two screens can identify a shared color and typography style without referencing code
- **SC-005**: Viewport resize from maximum to minimum supported size does not leave any UI element outside the visible area or in an overlapping broken state
