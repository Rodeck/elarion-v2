# Tasks: Sprite Animation System

**Input**: Design documents from `/specs/004-sprite-animation/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested in spec — no test tasks generated.

**Organization**: Tasks grouped by user story. Each phase is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies within the phase)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in every description

---

## Phase 1: Setup (Assets & Project Structure)

**Purpose**: Copy sprite assets into the Vite static root and create the new `types/` directory so subsequent phases have everything they need.

- [x] T001 Copy sprite package from `C:\Users\pajak\Downloads\Medieval_knight\` into `frontend/public/assets/characters/medieval_knight/` — copy the full directory tree: `metadata.json`, `rotations/*.png` (8 files), `animations/breathing-idle/{south,east,south-east,west}/frame_00{0,1,2,3}.png` (16 files)
- [x] T002 [P] Create empty placeholder file `frontend/src/types/.gitkeep` to establish the `types/` directory (will be replaced by T003)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, registry, and loader that all user stories depend on. Nothing in Phase 3+ can start until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create `frontend/src/types/sprite.ts` — define and export: `Direction8` union type (`'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west'`); `Direction4` union type (`'n' | 's' | 'e' | 'w'`); `DIR4_TO_DIR8` constant mapping (`{ n: 'north', s: 'south', e: 'east', w: 'west' }`); `SpriteMetadataJson` interface matching the `metadata.json` schema (character.id, character.size, frames.rotations, frames.animations); `AnimationDef` interface (`{ name: string; directions: Map<Direction8, string[]>; frameDelay: number }`); `SpriteDefinition` interface (`{ id: string; frameWidth: number; frameHeight: number; animations: Map<string, AnimationDef>; rotations: Map<Direction8, string> }`); `AnimationState` interface (`{ animName: string; direction: Direction8; frameIndex: number; frameTimer: number; frameCount: number; isStaticFrame: boolean }`)
- [x] T004 [P] Create `frontend/src/entities/SpriteRegistry.ts` — export a module-level `Map<string, SpriteDefinition>` called `spriteRegistry`; export `registerSprite(def: SpriteDefinition): void` (adds to map); export `getSprite(id: string): SpriteDefinition | undefined` (returns from map); export `hasSprite(id: string): boolean`; import `SpriteDefinition` from `../types/sprite`
- [x] T005 [P] Create `frontend/src/entities/SpriteLoader.ts` — export `loadCharacterSprite(scene: Phaser.Scene, basePath: string): Promise<SpriteDefinition>` that: (1) fetches `${basePath}/metadata.json` using `fetch()`, parses as `SpriteMetadataJson`; (2) for each rotation entry in `metadata.frames.rotations`, calls `scene.load.image(textureKey, path)` where `textureKey = \`char:${id}:rotation:${dir}\`` and path is `${basePath}/${relPath}`; (3) for each animation name and direction in `metadata.frames.animations`, calls `scene.load.image(textureKey, path)` for each frame where `textureKey = \`char:${id}:anim:${animName}:${dir}:${frameIdx}\``; (4) calls `scene.load.start()` and awaits load completion via a Promise wrapping the `complete` event; (5) builds and returns a `SpriteDefinition` with fully resolved texture keys; (6) calls `registerSprite(def)` before returning; import types from `../types/sprite` and `registerSprite` from `./SpriteRegistry`

**Checkpoint**: Types defined, registry and loader implemented — Phase 3+ can begin.

---

## Phase 3: User Story 1 — Player Character Plays Idle Animation (Priority: P1) 🎯 MVP

**Goal**: Replace the green rectangle player sprite with a looping idle animation using the Medieval Knight sprite pack.

**Independent Test**: Launch the game, log in, enter the world. The player character shows a breathing/idle animation that loops continuously. No green rectangle visible.

- [x] T006 [US1] Create `frontend/src/entities/AnimatedSprite.ts` — export `class AnimatedSprite extends Phaser.GameObjects.Container`: constructor takes `(scene: Phaser.Scene, x: number, y: number, def: SpriteDefinition)` and creates an internal `Phaser.GameObjects.Image` child at `(0, 0)` added to the container; store `def` and init `state: AnimationState` with defaults (animName='', direction='south', frameIndex=0, frameTimer=0, frameCount=0, isStaticFrame=false); implement `setAnimation(name: string): void` — looks up the animation in `def.animations`, resets frameIndex/frameTimer, sets frameCount, updates the image texture to frame 0 of the resolved direction (or static rotation fallback if no frames for direction); implement `setDirection(dir: Direction8): void` — if direction changed: update `state.direction`, reset frameIndex/frameTimer, call `resolveTexture()` to update image; implement `update(delta: number): void` — if `state.isStaticFrame` return early; accumulate `state.frameTimer += delta`; when `frameTimer >= frameDelay (150ms)`: decrement timer, advance `state.frameIndex = (frameIndex + 1) % frameCount`, call `resolveTexture()`; implement private `resolveTexture(): void` — builds texture key `\`char:${def.id}:anim:${animName}:${direction}:${frameIndex}\`` if animation frames exist for current direction, else builds rotation key `\`char:${def.id}:rotation:${direction}\`` and sets `isStaticFrame=true`; import `SpriteDefinition`, `Direction8`, `AnimationState` from `../types/sprite`
- [x] T007 [US1] Modify `frontend/src/scenes/BootScene.ts` — in `preload()`: remove the three placeholder lines (`load.image('tileset', ...)`, `load.spritesheet('character', ...)`, `load.spritesheet('monster', ...)`); add `import { loadCharacterSprite } from '../entities/SpriteLoader'`; add `loadCharacterSprite(this, '/assets/characters/medieval_knight')` call — note: since BootScene.preload() is synchronous in Phaser but the fetch is async, use `this.load.once('start', ...)` pattern OR restructure to pre-fetch metadata in `init()` and synchronously queue load.image() calls in `preload()`; the recommended approach: in `preload()` make the fetch synchronous-style using XMLHttpRequest (avoids async complexity in Phaser preload hook), parse metadata, then queue all `load.image()` calls within the same preload() call; alternatively, load metadata as a JSON asset via `this.load.json('medieval_knight_meta', '/assets/characters/medieval_knight/metadata.json')` and process it in `create()` to register textures dynamically using `this.textures.addImage()` — choose whichever approach keeps the loading bar working correctly
- [x] T008 [US1] Modify `frontend/src/scenes/GameScene.ts` — (1) add import `import { AnimatedSprite } from '../entities/AnimatedSprite'`; (2) add import `import { getSprite } from '../entities/SpriteRegistry'`; (3) add import `import { DIR4_TO_DIR8 } from '../types/sprite'`; (4) replace field `private playerSprite!: Phaser.GameObjects.Container` with `private playerAnimSprite!: AnimatedSprite`; (5) in `placeMyCharacter()`: replace the `this.add.rectangle(...)` + `this.add.text(...)` + `this.add.container(...)` block with: `const def = getSprite('medieval_knight')!; this.playerAnimSprite = new AnimatedSprite(this, x, y, def); this.playerAnimSprite.setAnimation('breathing-idle'); this.playerAnimSprite.setDirection('south'); this.add.existing(this.playerAnimSprite); this.playerAnimSprite.setDepth(10); this.cameras.main.startFollow(this.playerAnimSprite)`; (6) add name label as a separate Text object above the sprite (not inside it), following the camera; (7) add `update(time: number, delta: number): void { this.playerAnimSprite?.update(delta); }` method to the class; (8) update all references from `this.playerSprite` to `this.playerAnimSprite` in the `player.moved` and `player.move_rejected` handlers

**Checkpoint**: Player character displays looping idle animation. Green rectangle is gone. Animation loops without visible jump.

---

## Phase 4: User Story 2 — Character Faces Direction of Movement (Priority: P2)

**Goal**: Character sprite updates to face the direction of the last movement input, selecting the correct directional idle animation variant.

**Independent Test**: Move in each of the 4 cardinal directions (WASD / arrow keys), stop, observe that the sprite faces that direction. Test all 4 directions.

- [x] T009 [US2] Modify `frontend/src/scenes/GameScene.ts` — in `setupInput()`, inside the keydown handler loop that calls `this.client.send('player.move', { direction: dir })`, add immediately after: `this.playerAnimSprite.setDirection(DIR4_TO_DIR8[dir as Direction4])`; add import `{ Direction4 }` from `../types/sprite` if not already imported; verify north direction (dir='n') correctly shows the static rotation PNG fallback (no animation frames exist for north in medieval_knight)
- [x] T010 [US2] Modify `frontend/src/scenes/GameScene.ts` — verify the `player.move_rejected` rollback handler at `this.cameras.main.shake(80, 0.004)` does NOT reset the animation direction (direction should remain as the player intended — only position rolls back, not facing); confirm by reading the handler and adding a code comment documenting this deliberate design choice

**Checkpoint**: Moving in any direction updates sprite facing. North direction shows static rotation image. Direction persists after stopping.

---

## Phase 5: User Story 3 — Animation System Supports Multiple Character Types (Priority: P3)

**Goal**: Validate that the animation system is architecturally ready for monsters and NPCs without code changes.

**Independent Test**: Two independently animated entities exist on screen simultaneously with no interference. Can use two instances of the same knight sprite at different positions.

- [x] T011 [US3] Modify `frontend/src/scenes/GameScene.ts` — in `create()` or after `placeMyCharacter()`, temporarily add a second AnimatedSprite at a fixed position (e.g., tile 5,5): `const def = getSprite('medieval_knight')!; const testSprite = new AnimatedSprite(this, 5 * 32 + 16, 5 * 32 + 16, def); testSprite.setAnimation('breathing-idle'); testSprite.setDirection('east'); this.add.existing(testSprite); testSprite.setDepth(9);`; also call `testSprite.update(delta)` in the `update()` method; verify both sprites animate independently by observing that moving the player does not affect the test sprite's animation, and vice versa
- [x] T012 [US3] After validating independent animation in T011, remove the test sprite code from `frontend/src/scenes/GameScene.ts` — delete the test sprite instantiation and the `testSprite.update(delta)` call; add a comment in GameScene.ts above `placeMyCharacter()` noting that additional AnimatedSprite instances can be added for monsters/NPCs using the same pattern

**Checkpoint**: Architecture validated. System ready for monster/NPC animation with zero core changes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, lint, and verify the whole system hangs together.

- [x] T013 [P] Delete `frontend/src/types/.gitkeep` placeholder file created in T002 (now replaced by `sprite.ts`)
- [x] T014 Run `npm run lint` in `frontend/` — fix any TypeScript errors introduced by the new files; pay particular attention to: unused imports removed from BootScene, `AnimatedSprite` type compatibility with Phaser Container, any `any` types introduced in SpriteLoader's fetch/parse logic
- [x] T015 Run the game end-to-end — log in, enter the world, move in all 4 directions, stop — confirm: idle animation loops, facing updates correctly for s/e/w, north shows static rotation, no console errors, no frame rate drops; record any visual issues for follow-up

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001 and T002 run in parallel
- **Phase 2 (Foundational)**: Requires Phase 1 complete (assets must be in place for T005 path validation); T004 and T005 can run in parallel after T003
- **Phase 3 (US1)**: Requires Phase 2 complete — T006, T007, T008 are sequential (T006 before T008, T007 before T008)
- **Phase 4 (US2)**: Requires Phase 3 complete — T009 before T010
- **Phase 5 (US3)**: Requires Phase 3 complete (needs AnimatedSprite to exist); T011 before T012
- **Phase 6 (Polish)**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2). No dependency on US2 or US3.
- **US2 (P2)**: Depends on US1 (needs `playerAnimSprite` to exist). Cannot run in parallel with US1.
- **US3 (P3)**: Depends on US1 (needs AnimatedSprite class). Can run in parallel with US2.

### Within Each Phase

```
Phase 2:  T003 → [T004 ‖ T005]
Phase 3:  T006 → T008
          T007 → T008
          (T006 and T007 can run in parallel, both must finish before T008)
Phase 4:  T009 → T010
Phase 5:  T011 → T012
Phase 6:  T013 ‖ T014 → T015
```

### Parallel Opportunities

- T001 ‖ T002 (Phase 1)
- T004 ‖ T005 (Phase 2, after T003)
- T006 ‖ T007 (Phase 3, both blocked only on Phase 2 completion)
- T013 ‖ T014 (Phase 6, independent cleanup tasks)

---

## Parallel Example: Phase 3 (US1)

```
# After T003 completes, launch T004 and T005 in parallel:
Task A: "Create SpriteRegistry.ts in frontend/src/entities/SpriteRegistry.ts"
Task B: "Create SpriteLoader.ts in frontend/src/entities/SpriteLoader.ts"

# After T004+T005 complete, launch T006 and T007 in parallel:
Task A: "Create AnimatedSprite.ts in frontend/src/entities/AnimatedSprite.ts"
Task B: "Modify BootScene.ts to load medieval_knight via SpriteLoader"

# After T006+T007 complete:
Task: "Modify GameScene.ts to replace rectangle with AnimatedSprite"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Copy assets
2. Complete Phase 2: Types + Registry + Loader (CRITICAL — blocks everything)
3. Complete Phase 3: AnimatedSprite class + wire into BootScene + wire into GameScene
4. **STOP and VALIDATE**: Load game, verify animated knight appears, idle loops
5. US1 is demonstrable and delivers visible value immediately

### Incremental Delivery

1. Phase 1 + Phase 2 → Infrastructure ready
2. Phase 3 → Animated player visible (MVP!)
3. Phase 4 → Direction-facing on movement
4. Phase 5 → Architecture validated for future entities
5. Phase 6 → Clean and verified

### Notes on T007 (BootScene asset loading)

The trickiest task is integrating the async `fetch()` inside Phaser's synchronous `preload()` hook. Recommended approach in T007: use `this.load.json('medieval_knight_meta', '/assets/characters/medieval_knight/metadata.json')` in `preload()`, then in `create()` parse the cached JSON via `this.cache.json.get('medieval_knight_meta')` and use `this.textures.addImage(key, htmlImageElement)` or simply queue another load pass. The simplest working approach: use `this.load.json` to load metadata, then in `create()` iterate the metadata and use `this.load.image()` + `this.load.start()` with a `once('complete', ...)` callback before transitioning to LoginScene. This keeps loading bar visible and avoids XHR complexity.

---

## Summary

| Phase | Tasks | Parallelizable | Story |
|-------|-------|---------------|-------|
| Phase 1: Setup | T001–T002 | T001 ‖ T002 | — |
| Phase 2: Foundational | T003–T005 | T004 ‖ T005 | — |
| Phase 3: US1 (MVP) | T006–T008 | T006 ‖ T007 | US1 |
| Phase 4: US2 | T009–T010 | — | US2 |
| Phase 5: US3 | T011–T012 | — | US3 |
| Phase 6: Polish | T013–T015 | T013 ‖ T014 | — |

**Total tasks**: 15
**Parallel opportunities**: 4 groups
**MVP scope**: Phases 1–3 (T001–T008), ~8 tasks
