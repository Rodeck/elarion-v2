# Data Model: Sprite Animation System

**Feature**: 004-sprite-animation
**Date**: 2026-03-03
**Scope**: Frontend only — no backend or database changes

---

## Overview

All entities in this model are runtime client-side constructs. No persistence, no server communication. The canonical source of truth for sprite definitions is the `metadata.json` file shipped with each character's sprite package.

---

## Entities

### SpriteMetadata (from JSON file)

Deserialized directly from `metadata.json`. Read-only after load.

| Field | Type | Description |
|-------|------|-------------|
| `character.id` | `string` | Unique character identifier (used in texture key namespacing) |
| `character.name` | `string` | Human-readable name (e.g., "Medieval knight") |
| `character.size.width` | `number` | Frame width in pixels (64) |
| `character.size.height` | `number` | Frame height in pixels (64) |
| `character.directions` | `number` | Total directions supported (8) |
| `frames.rotations` | `Record<Direction8, string>` | Relative paths to static rotation PNGs, keyed by direction name |
| `frames.animations` | `Record<string, Record<Direction8, string[]>>` | Animation name → direction → array of frame paths |

**Example `frames.animations` entry:**
```
"breathing-idle": {
  "south": ["animations/breathing-idle/south/frame_000.png", ...],
  "east":  ["animations/breathing-idle/east/frame_000.png", ...],
  "west":  ["animations/breathing-idle/west/frame_000.png", ...]
}
```

---

### SpriteDefinition (runtime resolved)

Derived from `SpriteMetadata` after assets are loaded into Phaser. Stored in a registry keyed by character ID.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Character ID (from metadata) |
| `frameWidth` | `number` | Frame width in pixels |
| `frameHeight` | `number` | Frame height in pixels |
| `animations` | `Map<string, AnimationDef>` | Animation definitions, keyed by animation name |
| `rotations` | `Map<Direction8, string>` | Phaser texture keys for static rotation images |

---

### AnimationDef (per animation, per direction)

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Animation name (e.g., "breathing-idle") |
| `directions` | `Map<Direction8, string[]>` | Direction → ordered list of Phaser texture keys |
| `frameDelay` | `number` | Milliseconds per frame (default: 150ms = ~6.7fps) |

---

### AnimationState (per-entity runtime)

Mutable state owned by each `AnimatedSprite` instance. Completely independent per entity.

| Field | Type | Description |
|-------|------|-------------|
| `animName` | `string` | Currently playing animation name |
| `direction` | `Direction8` | Currently facing direction |
| `frameIndex` | `number` | Index of the currently displayed frame (0-based) |
| `frameTimer` | `number` | Milliseconds elapsed since last frame advance |
| `frameCount` | `number` | Total frames in the current direction's animation |
| `isStaticFrame` | `boolean` | True when direction falls back to a static rotation PNG (no animation loop) |

---

## Type Definitions

### Direction Types

```
Direction8 = 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west'

Direction4 = 'n' | 's' | 'e' | 'w'   (protocol direction from server/input)
```

**Protocol-to-Sprite Mapping (MVP — 4-directional):**

| Protocol Direction | Sprite Direction | Has Animation Frames | Fallback |
|-------------------|-----------------|---------------------|---------|
| `'n'`             | `'north'`       | No (Medieval Knight) | Static rotation PNG |
| `'s'`             | `'south'`       | Yes                  | — |
| `'e'`             | `'east'`        | Yes                  | — |
| `'w'`             | `'west'`        | Yes                  | — |

---

## Texture Key Convention

All Phaser texture keys loaded by the animation system follow this pattern:

```
char:{characterId}:anim:{animationName}:{direction}:{frameIndex}

char:{characterId}:rotation:{direction}
```

**Examples (Medieval Knight):**
```
char:medieval_knight:anim:breathing-idle:south:0
char:medieval_knight:anim:breathing-idle:south:1
char:medieval_knight:anim:breathing-idle:south:2
char:medieval_knight:anim:breathing-idle:south:3
char:medieval_knight:anim:breathing-idle:east:0
char:medieval_knight:rotation:north
char:medieval_knight:rotation:north-east
```

Total textures for Medieval Knight MVP: 3 animated directions × 4 frames + 8 static rotations = **20 textures**.

---

## Asset File Structure

```
frontend/public/assets/characters/
└── medieval_knight/
    ├── metadata.json                          ← canonical SpriteMetadata source
    ├── rotations/
    │   ├── north.png
    │   ├── north-east.png
    │   ├── east.png
    │   ├── south-east.png
    │   ├── south.png
    │   ├── south-west.png
    │   ├── west.png
    │   └── north-west.png
    └── animations/
        └── breathing-idle/
            ├── south/
            │   ├── frame_000.png
            │   ├── frame_001.png
            │   ├── frame_002.png
            │   └── frame_003.png
            ├── east/
            │   └── frame_000.png ... frame_003.png
            ├── south-east/
            │   └── frame_000.png ... frame_003.png
            └── west/
                └── frame_000.png ... frame_003.png
```

---

## Entity Relationships

```
SpriteMetadata (JSON file)
    │
    │  parsed and loaded by SpriteLoader
    ▼
SpriteDefinition (runtime registry)
    │
    │  passed to constructor
    ▼
AnimatedSprite (Phaser Container)
    │  owns
    ├─ AnimationState  (mutable per-entity)
    └─ Phaser.Image    (the visible game object, texture swapped each frame)
```

---

## State Transitions

```
AnimationState transitions:

[created] → setAnimation("breathing-idle") + setDirection("south")
    → animName="breathing-idle", direction="south", frameIndex=0, frameTimer=0

update(delta):
    frameTimer += delta
    if frameTimer >= frameDelay:
        frameTimer -= frameDelay
        frameIndex = (frameIndex + 1) % frameCount
        image.setTexture(resolvedKey)

setDirection("east"):
    direction = "east"
    frameIndex = 0       ← reset to first frame of new direction
    frameTimer = 0
    isStaticFrame = false

setDirection("north"):  ← no animated frames for this direction
    direction = "north"
    isStaticFrame = true
    image.setTexture(rotationKey)   ← static, no frame advancement
```
