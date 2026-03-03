# Quickstart: Adding a New Character Sprite

**Feature**: 004-sprite-animation
**Audience**: Developer adding a new animated character (monster, NPC, or second player class)

---

## What You Need

A character sprite package in the standard format:
```
<character-id>/
├── metadata.json
├── rotations/
│   └── <direction>.png   (one per direction, up to 8)
└── animations/
    └── <animation-name>/
        └── <direction>/
            └── frame_NNN.png  (zero-indexed, any count)
```

The `metadata.json` must match the schema in `data-model.md` (same format as the Medieval Knight example).

---

## Steps

### 1. Place the sprite package

Copy the character folder into:
```
frontend/public/assets/characters/<character-id>/
```

Example:
```
frontend/public/assets/characters/
├── medieval_knight/       ← already exists
└── skeleton_warrior/      ← your new character
    ├── metadata.json
    ├── rotations/
    └── animations/
```

### 2. Register in BootScene

In `frontend/src/scenes/BootScene.ts`, add a `loadCharacterSprite` call in the `preload()` method:

```typescript
// In BootScene.preload():
await SpriteLoader.loadCharacterSprite(this, '/assets/characters/skeleton_warrior');
```

`SpriteLoader.loadCharacterSprite(scene, basePath)`:
- Fetches `metadata.json` from `basePath`
- Registers all PNG textures using the `char:{id}:...` key convention
- Returns the `SpriteDefinition` and adds it to the global registry

### 3. Create an AnimatedSprite instance

Wherever you create the game entity (GameScene, MonsterSprite class, etc.):

```typescript
import { AnimatedSprite } from '../entities/AnimatedSprite';
import { SpriteRegistry } from '../entities/SpriteRegistry';

const def = SpriteRegistry.get('skeleton_warrior');
const sprite = new AnimatedSprite(this, x, y, def);
sprite.setAnimation('breathing-idle');
sprite.setDirection('south');
this.add.existing(sprite);
```

### 4. Update in the scene loop

In the scene's `update(time, delta)` method:

```typescript
update(time: number, delta: number): void {
  this.playerAnimSprite.update(delta);
  // Each AnimatedSprite manages its own frame timing
}
```

### 5. Change direction on movement

When the entity moves, update the facing direction:

```typescript
// When player moves east:
this.playerAnimSprite.setDirection('east');
```

---

## That's it

No changes to the animation system code are needed. Each character sprite package is self-contained and self-describing via `metadata.json`.

---

## Supported Animations (per character)

The animation names are whatever is defined in the character's `metadata.json` under `frames.animations`. The system plays whatever you pass to `setAnimation()`. If the requested animation doesn't exist in the definition, it logs a warning and stays on the current animation.

---

## Handling Missing Direction Frames

If a character sprite only has partial direction coverage (e.g., 4 of 8 directions), the system automatically falls back in this order:

1. Animated frames for the exact direction — play normally
2. Static rotation PNG for the exact direction — display as still image
3. Nearest cardinal direction's rotation PNG — display as still image (last resort)

No configuration needed — this is automatic.
