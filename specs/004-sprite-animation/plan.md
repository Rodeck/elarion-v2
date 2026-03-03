# Implementation Plan: Sprite Animation System

**Branch**: `004-sprite-animation` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-sprite-animation/spec.md`

## Summary

Replace the player character's placeholder green rectangle with a live animated sprite sourced from a PNG frame-pack (Medieval Knight, 64×64, 8 directions). Introduce a reusable `AnimatedSprite` entity class — initialized from a metadata JSON definition — that independently manages animation state per entity. For the MVP: idle animation loops while stationary; the character's facing direction updates to match the last movement direction. Monsters and NPCs will be wired in future iterations using the same class without changes to animation code.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend only — no backend changes)
**Primary Dependencies**: Phaser 3.60.0 (game framework, texture loading, game objects, update loop), Vite 5.0.12 (static asset serving from `public/`)
**Storage**: N/A — sprite assets are static files served from Vite's `public/` directory; no database changes
**Testing**: Manual visual verification (no automated test framework currently in frontend)
**Target Platform**: Browser (Chrome/Firefox), served by Vite dev server on port 3000
**Project Type**: Browser game client (Phaser 3 scene-based)
**Performance Goals**: Animation renders at ≥30fps; texture swaps must not cause frame drops (16 textures loaded at startup, swapped on game object — O(1) per frame)
**Constraints**: No build-time asset pipeline additions; assets must work with existing Vite static serving; sprite changes must not affect server-authoritative movement logic
**Scale/Scope**: 1 character type (Medieval Knight) for MVP; system designed for N character types via SpriteRegistry

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **1. No REST for game state** | ✅ PASS | Animation is 100% client-side visual. No REST calls introduced. |
| **2. Server-side validation present** | ✅ PASS (N/A) | No new player actions. Existing movement validation on server is unchanged. |
| **3. Structured logging required** | ✅ PASS (N/A) | Animation touches only the render pipeline — not game loop or player actions. Asset load errors surfaced via Phaser's load event (client console). |
| **4. Contract documented** | ✅ PASS | No new WebSocket message types introduced. Existing `player.moved` / `player.move_rejected` payloads unchanged. Contracts directory not modified. |
| **5. Graceful rejection handling** | ✅ PASS (N/A) | No server messages introduced. Existing rollback on `player.move_rejected` unchanged. |
| **6. Complexity justified** | ✅ PASS (see Complexity Tracking) | `AnimatedSprite` abstraction is required by FR-007/FR-008; documented below. |

**Post-design re-check**: All gates still pass. Implementation is pure client-side visual with zero protocol changes.

## Project Structure

### Documentation (this feature)

```text
specs/004-sprite-animation/
├── plan.md              ← this file
├── research.md          ← Phase 0: loading strategy, size, asset path, direction mapping
├── data-model.md        ← Phase 1: SpriteMetadata, SpriteDefinition, AnimationState types
├── quickstart.md        ← Phase 1: how to add a new character sprite
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code

```text
frontend/
├── public/
│   └── assets/
│       └── characters/
│           └── medieval_knight/          ← NEW: sprite package (copied from Downloads)
│               ├── metadata.json
│               ├── rotations/
│               │   └── *.png             (8 static direction images)
│               └── animations/
│                   └── breathing-idle/
│                       ├── south/        frame_000–003.png
│                       ├── east/         frame_000–003.png
│                       ├── south-east/   frame_000–003.png
│                       └── west/         frame_000–003.png
└── src/
    ├── types/
    │   └── sprite.ts                     ← NEW: SpriteMetadata, SpriteDefinition, Direction types
    ├── entities/
    │   ├── AnimatedSprite.ts             ← NEW: reusable animated entity class
    │   ├── SpriteLoader.ts              ← NEW: loads metadata.json + registers Phaser textures
    │   ├── SpriteRegistry.ts            ← NEW: global Map<id, SpriteDefinition>
    │   ├── MonsterSprite.ts             ← UNCHANGED
    │   └── RemotePlayer.ts              ← UNCHANGED
    └── scenes/
        ├── BootScene.ts                 ← MODIFIED: load medieval_knight via SpriteLoader
        └── GameScene.ts                 ← MODIFIED: player rectangle → AnimatedSprite; track facing direction
```

**Structure Decision**: Frontend-only modification. Web application layout (Option 2 from template) applies — changes live entirely in `frontend/src/` and `frontend/public/`. No backend, shared, or admin changes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `AnimatedSprite` class (new abstraction) | FR-007 and FR-008 explicitly require the animation system to be reusable for monsters/NPCs without code changes | Inline animation logic in `GameScene.ts` would require duplication per entity type; has no reuse path when MonsterSprite and RemotePlayer need animation |
| `SpriteLoader` + `SpriteRegistry` (two new files) | Separation needed: loader handles async Phaser texture registration; registry provides a global lookup for instantiation | Combining into one file or adding to BootScene directly couples asset loading to scene lifecycle and prevents future use from other scenes |

## Design Notes

### AnimatedSprite contract

```typescript
class AnimatedSprite extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, def: SpriteDefinition)
  setAnimation(name: string): void       // switch to named animation; resets frame
  setDirection(dir: Direction8): void    // update facing; resets frame if changed
  update(delta: number): void            // call from scene update() each tick
}
```

- Owns a single `Phaser.GameObjects.Image` child that texture-swaps each frame
- `update(delta)` accumulates elapsed time; advances frame when `frameTimer >= frameDelay`
- Static-rotation fallback: when the requested direction has no animated frames, `isStaticFrame=true` and `update()` is a no-op for frame advancement

### Direction resolution priority

```
1. Animated frames for exact direction  → play animation
2. Static rotation PNG for exact direction → static display
3. (Future) Nearest cardinal, optionally flipped → static display
```

### GameScene changes (minimal)

1. `placeMyCharacter()`: replace `this.add.rectangle(...)` with `new AnimatedSprite(...)` initialized to `'breathing-idle'` / `'south'`
2. `setupInput()` keydown handler: after sending `player.move`, call `this.playerAnimSprite.setDirection(DIR_MAP[dir])`
3. `update(time, delta)`: add `this.playerAnimSprite.update(delta)`
4. Remove `private playerSprite: Phaser.GameObjects.Container` — replaced by `private playerAnimSprite: AnimatedSprite`

### BootScene changes (minimal)

Replace placeholder `load.spritesheet('character', ...)` with `SpriteLoader.loadCharacterSprite(this, '/assets/characters/medieval_knight')`.

`SpriteLoader.loadCharacterSprite` is synchronous in intent but uses Phaser's loader queue: it adds all `load.image(key, path)` calls during preload, which Phaser resolves before `create()` runs. No async handling needed.
