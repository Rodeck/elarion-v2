# Tasks: Game UI Overhaul & Visual Quality Fix

**Input**: Design documents from `/specs/002-game-ui-overhaul/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. Each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no pending dependencies)
- **[Story]**: User story this task belongs to (US1/US2/US3)
- File paths are exact per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add external font loading and CSS token wiring to the HTML entry point before any design work begins.

- [x] T001 Add Google Fonts `<link rel="preconnect">` and stylesheet for Cinzel (400/600/700), Crimson Text (400/600/italic), and Rajdhani (400/500/600); add `<link rel="stylesheet" href="/src/styles/tokens.css">` in `frontend/index.html` — both links go in `<head>` before the `<script>` tag

**Checkpoint**: Fonts resolve in DevTools → Network → Font; `tokens.css` link present in page source

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the design token system that ALL redesign tasks depend on. No user story implementation should begin until T002 and T003 are complete.

**⚠️ CRITICAL**: All Phase 3+ tasks that touch visual styling depend on these two files existing.

- [x] T002 Create CSS design token file `frontend/src/styles/tokens.css` defining all custom properties on `:root` exactly as listed in `data-model.md` — cover all groups: `--color-bg-*` (6 tokens), `--color-text-*` (4), `--color-gold-*` (4), `--color-hp-*` (4), `--color-mp-*` (2), `--color-xp-*` (2), `--color-chat-*` (3), `--color-combat-*` (4), `--font-display/body/ui-number`, `--type-title/heading/label/value/body/small`
- [x] T003 [P] Create Phaser token constants file `frontend/src/styles/phaser-tokens.ts` exporting a `const Colors` object with hex integer values (e.g. `bgPanel: 0x252119`) and a `const Fonts` object with font-family strings — use the complete tables from `data-model.md` (Phaser Config Change section + Color Tokens)

**Checkpoint**: `tokens.css` file exists with all `:root` custom properties; `phaser-tokens.ts` compiles without errors and exports `Colors` and `Fonts`

---

## Phase 3: User Story 1 — Sharp Visuals at Any Screen Size (Priority: P1) 🎯 MVP

**Goal**: Fix blurry Phaser rendering so all game visuals appear crisp at every supported resolution.

**Independent Test**: Launch the game in Chrome at 1280×720, 1920×1080, and 2560×1440. Zoom into tile edges and character sprites — all edges must be sharp with no blur halo, smoothing gradient, or anti-aliasing fringe. No resize required.

- [x] T004 [US1] Update `frontend/src/main.ts` Phaser `GameConfig` — compute `const dpr = Math.min(window.devicePixelRatio || 1, 2)` above the config; replace fixed `width: 800, height: 600` with `width: 800 * dpr, height: 600 * dpr`; add `zoom: 1 / dpr`; add `pixelArt: true`; add `antialias: false`; add `roundPixels: true`; change `backgroundColor` from `'#1a2a1a'` to `'#1a1814'`

**Checkpoint**: Launch game. Open DevTools → Elements → canvas; canvas `width` attribute should be `1600` on a 2× DPR display (or `800` on standard). Sprites and tiles render with hard pixel edges — no blur visible at any zoom level.

---

## Phase 4: User Story 2 — Stable Layout When Window Is Small or Resized (Priority: P2)

**Goal**: HTML overlay elements (ChatBox, CombatLog) stay anchored to canvas edges at all supported viewport sizes and after any resize.

**Independent Test**: Open the game with all overlays visible (in GameScene). Resize the browser window from 2560px wide to 1280px wide. The chat box must stay anchored to the bottom-left of the canvas; the combat log must stay anchored to the bottom-right. Neither element should go off-screen or drift into pillarbox/letterbox margins.

- [x] T005 [US2] Add a `public reposition(rect: DOMRect): void` method to the `ChatBox` class in `frontend/src/ui/ChatBox.ts` — the method sets `this.panel.style.left = (rect.left + 12) + 'px'` and `this.panel.style.bottom = (window.innerHeight - rect.bottom + 12) + 'px'` and `this.panel.style.position = 'fixed'`; remove the hardcoded `bottom: 10px; left: 10px` from the initial `cssText` (replace with a call to an initial reposition if `rect` is available, otherwise set temporary zero values)
- [x] T006 [P] [US2] Add a `public reposition(rect: DOMRect): void` method to the `CombatLog` class in `frontend/src/ui/CombatLog.ts` — the method sets `this.panel.style.right = (window.innerWidth - rect.right + 12) + 'px'` and `this.panel.style.bottom = (window.innerHeight - rect.bottom + 12) + 'px'` and `this.panel.style.position = 'fixed'`; remove hardcoded `bottom: 80px; right: 10px` from initial `cssText`
- [x] T007 [US2] Add scale-sync to `frontend/src/scenes/GameScene.ts` — add a `private syncOverlays(): void` method that calls `const rect = this.game.canvas.getBoundingClientRect()` then `this.chatBox.reposition(rect)` and `this.combatLog.reposition(rect)`; in the `create()` method, register `this.scale.on(Phaser.Scale.Events.RESIZE, this.syncOverlays, this)` and call `this.syncOverlays()` once immediately after the ChatBox and CombatLog are instantiated

**Checkpoint**: Drag browser window narrower and wider repeatedly while in GameScene. ChatBox and CombatLog visibly track the canvas edges and never enter letterbox/pillarbox areas. Works at both 1280px and 2560px window widths.

---

## Phase 5: User Story 3 — Visually Coherent UI Presentation (Priority: P3)

**Goal**: Full dark fantasy visual redesign of all game screens using the design token system from Phase 2. All tasks in this phase operate on different files and can be done in parallel.

**Independent Test**: Navigate through all screens (BootScene → LoginScene → CharacterCreateScene → GameScene with HUD). Every screen uses dark warm-brown panels, parchment-cream text, gold accents. Cinzel font is visible on all headings/labels. HP bar is crimson, XP bar is gold. No screen uses the old bright-green or flat placeholder styling.

- [x] T008 [P] [US3] Redesign `frontend/src/ui/StatsBar.ts` — import `Colors` and `Fonts` from `../styles/phaser-tokens`; rebuild the background `Graphics` rect with `fillStyle(Colors.bgPanel, 0.92)` and `lineStyle(1, Colors.goldDim, 1.0)`; update all `add.text()` calls: stat labels (HP, XP, Level) use `fontFamily: Fonts.display, fontSize: '11px', color: '#c8b89a'`; stat values use `fontFamily: Fonts.number, fontSize: '14px', color: '#f5e6c8'`; character name/class in `Fonts.display 13px '#d4a84b'`; rebuild HP bar track as `Colors.hpBg` rect and HP fill as `Colors.hpHigh` rect (with ratio-based colour shift: `hpHigh` above 60%, `hpMid` 30–60%, `hpLow` below 30%); rebuild XP bar track as `Colors.xpBg` and fill as `Colors.xpFill`
- [x] T009 [P] [US3] Redesign ChatBox CSS in `frontend/src/ui/ChatBox.ts` — replace the entire `panel.style.cssText` block with styles using `tokens.css` variables: `background: rgba(37,33,25,0.92)`, `border: 1px solid var(--color-gold-dim)`, `border-radius: 3px`, box-shadow (outer drop + inner top highlight from plan.md); tab elements: `font-family: var(--font-display)`, `font-size: 11px`, `text-transform: uppercase`, `letter-spacing: 1px`; active tab `color: var(--color-gold-primary)` and `border-color: var(--color-gold-dim)`; message text: `font-family: var(--font-body)`, `font-size: 13px`; local messages: `var(--color-chat-local)`, global: `var(--color-chat-global)`, system: `var(--color-chat-system)`; add `::webkit-scrollbar` CSS rules (4px wide, `var(--color-gold-subtle)` thumb); input field: `background: var(--color-bg-inset)`, `border: 1px solid var(--color-gold-subtle)`, `focus border: var(--color-gold-primary)`, `color: var(--color-text-primary)`, `font-family: var(--font-body)`
- [x] T010 [P] [US3] Redesign CombatLog CSS in `frontend/src/ui/CombatLog.ts` — replace `panel.style.cssText` block with same dark panel style as ChatBox (same background, border, border-radius, box-shadow); header element: `font-family: var(--font-display)`, `font-size: 11px`, `text-transform: uppercase`, `letter-spacing: 1px`, `color: var(--color-gold-primary)`, bottom border `var(--color-gold-subtle)`; log message elements: `font-family: var(--font-body)`, `font-size: 12px`, `font-style: italic`; add CSS class-based colouring for damage lines (`color: var(--color-combat-dmg)`), heal lines (`var(--color-combat-heal)`), crit lines (`var(--color-combat-crit)`), miss lines (`var(--color-combat-miss)`); apply class to each appended message element based on its type; add dark fantasy scrollbar rules
- [x] T011 [P] [US3] Redesign LoginScene in `frontend/src/scenes/LoginScene.ts` — import `Colors` and `Fonts` from `../styles/phaser-tokens`; change scene background to `0x0f0d0a`; update title text: `fontFamily: Fonts.display`, `fontSize: '48px'`, `color: '#f0c060'`, `fontStyle: 'bold'`; update tab button text objects: `fontFamily: Fonts.display`, `fontSize: '13px'`, uppercase, letter-spacing style; add a `Graphics` underline beneath the active tab in `Colors.goldPrimary`; style HTML `<input>` elements via their `style` property: `backgroundColor: '#1a1612'`, `border: '1px solid #5c4d3d'`, `color: '#f5e6c8'`, `fontFamily: '"Crimson Text", Georgia, serif'`, `fontSize: '14px'`, `padding: '8px 12px'`, `borderRadius: '2px'`; rebuild submit button as a `Graphics` rect (`Colors.bgPanel` fill, `Colors.goldPrimary` border) with Cinzel label text on top; add hover state on button (border brightens to `Colors.goldBright`)
- [x] T012 [P] [US3] Redesign CharacterCreateScene in `frontend/src/scenes/CharacterCreateScene.ts` — import `Colors` and `Fonts` from `../styles/phaser-tokens`; change scene background to `0x0f0d0a`; rebuild each class card panel: unselected state uses `Colors.bgPanel` fill + `Colors.goldDim` border, selected state uses `Colors.bgPanelAlt` fill + `Colors.goldPrimary` border + slight upward `y` offset (−4px); class name text: `fontFamily: Fonts.display`, `fontSize: '20px'`, `color: '#f0c060'`, weight bold; stat label text: `Fonts.display`, `fontSize: '11px'`, `color: '#c8b89a'`; stat value text: `Fonts.number`, `fontSize: '14px'`, `color: '#f5e6c8'`; rebuild stat bars with `Colors.hpBg`/`Colors.hpHigh` for HP, `Colors.xpBg`/`Colors.xpFill` for other bars; style HTML `<input>` (name field) to match LoginScene input style
- [x] T013 [P] [US3] Update BootScene in `frontend/src/scenes/BootScene.ts` — import `Colors` and `Fonts` from `../styles/phaser-tokens`; change `backgroundColor` config passed to the scene (or set via `this.cameras.main.setBackgroundColor`) to `0x0f0d0a`; update the loading progress bar: track fill `Colors.xpBg` (`0x2a2010`), progress fill `Colors.xpFill` (`0xd4a84b`); update progress bar border to `Colors.goldSubtle`; update loading label text to use `fontFamily: Fonts.display`, `color: '#c8b89a'`

**Checkpoint**: Navigate through all screens. Every screen shows dark warm-brown panels. Cinzel font renders on all headings and labels. HP/XP bars use crimson and gold respectively. No bright green or flat grey placeholder elements remain.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature against quickstart.md test scenarios across all supported browsers and resolutions.

- [x] T014 Follow the full quickstart.md validation checklist — open game in Chrome, Firefox, and Edge; at each resolution (1280×720, 1920×1080, 2560×1440): verify no blur on sprites/tiles/text; resize window and verify overlay anchoring; check all screens for visual consistency; confirm Cinzel/Crimson Text/Rajdhani appear in DevTools → Network → Font; verify HP bar shifts from `#c0392b` to `#7b241c` as HP decreases
- [x] T015 [P] Verify `body` background in `frontend/index.html` matches `--color-bg-deepest` (`#0f0d0a`) so letterbox/pillarbox margins are dark rather than the old `#0a1a0a` green — update `body { background: #0f0d0a; }` in the `<style>` block of `index.html` if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001) — **BLOCKS all Phase 3+ tasks that reference tokens**
- **US1 (Phase 3)**: Depends on Phase 1 only (no token dependency) — can start in parallel with Phase 2 if needed
- **US2 (Phase 4)**: Depends on Phase 2 completion (T002, T003 done)
- **US3 (Phase 5)**: Depends on Phase 2 (tokens available) AND Phase 4 (ChatBox/CombatLog have `reposition()` before CSS rebuild)
- **Polish (Phase 6)**: Depends on all prior phases complete

### User Story Dependencies

- **US1 (T004)**: Independent — only needs Phase 1 done
- **US2 (T005–T007)**: T005 and T006 are independent of each other [P]; T007 depends on T005 and T006 being complete
- **US3 (T008–T013)**: All are independent of each other [P]; each depends on Phase 2 (T002/T003) and US2 (T005/T006) being complete

### Parallel Opportunities

Within Phase 2: `T002 ‖ T003`

Within Phase 4: `T005 ‖ T006` → then T007

Within Phase 5 (all [P] — all different files):
```
T008 (StatsBar.ts)
T009 (ChatBox.ts)       ← all 6 can run simultaneously
T010 (CombatLog.ts)
T011 (LoginScene.ts)
T012 (CharacterCreateScene.ts)
T013 (BootScene.ts)
```

Within Phase 6: `T014 ‖ T015`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003 in parallel)
3. Complete Phase 3: US1 — Phaser config fix (T004)
4. **STOP and VALIDATE**: Launch game, confirm visuals are sharp at multiple resolutions
5. Ship/demo: the single most impactful fix is done

### Incremental Delivery

1. Phase 1 + 2 → foundation ready
2. Phase 3 (T004) → blur fixed ✅ demo-able
3. Phase 4 (T005 ‖ T006 → T007) → overlays track canvas on resize ✅ demo-able
4. Phase 5 (T008–T013 all parallel) → full visual redesign ✅ demo-able
5. Phase 6 → cross-browser validation ✅ release-ready

### Parallel Team Strategy

With 2+ developers after Phase 2 completes:
- Developer A: T004 (US1) → T005 + T006 (US2) → T007 → T008 + T010 (US3)
- Developer B: T009 + T011 + T012 + T013 (US3)

---

## Notes

- No tests requested — no test tasks generated
- [P] tasks touch different files and have no dependency on concurrent tasks in the same phase
- US3 tasks (T008–T013) all touch different files and can all be done simultaneously
- T007 (GameScene overlay sync) must be done after T005 and T006 since it calls `reposition()` on both
- T009 and T010 (ChatBox/CombatLog CSS rebuild) should be done after T005/T006 (which add the `reposition()` method) to avoid merge conflicts — sequentially they're in Phase 5 after Phase 4, so this is naturally satisfied
- All Phaser token references (`Colors.*`, `Fonts.*`) require T003 to be complete first
- All CSS token references (`var(--color-*)`) require T002 to be complete first
- Commit after each phase checkpoint at minimum
