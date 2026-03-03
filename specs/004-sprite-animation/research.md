# Research: Sprite Animation System

**Feature**: 004-sprite-animation
**Date**: 2026-03-03
**Status**: Complete — no NEEDS CLARIFICATION items from spec

---

## Decision 1: Phaser 3 loading strategy for individual PNG frames

**Question**: The Medieval Knight sprite pack ships as individual PNG files per frame (e.g., `animations/breathing-idle/south/frame_000.png`). Phaser typically expects a spritesheet (single PNG grid) or a texture atlas (JSON + packed PNG). How should individual frames be loaded?

**Decision**: Load each frame as a named `Phaser.Image` texture via `this.load.image(key, path)` in BootScene. At runtime, a `Phaser.GameObjects.Image` game object swaps its texture key each frame tick.

**Rationale**:
- No build-time atlas generation step required — assets can be dropped directly into `public/assets/characters/`
- Phaser's texture cache handles many individual textures efficiently
- Swapping textures on a single Image object is zero-allocation per frame
- Spritesheet/atlas optimization can be added later if profiling shows it's needed (YAGNI)

**Alternatives considered**:
- **Build-time spritesheet generation** (using `sharp` or similar at `npm run build`): More efficient GPU upload but adds build complexity for an MVP with 4 × 4 = 16 frames
- **Phaser RenderTexture**: Requires manual canvas drawing per frame — unnecessary complexity
- **Phaser texture atlas** (`this.load.multiatlas`): Optimal for production but requires a separate atlas packer tool

---

## Decision 2: Sprite size vs tile grid (64×64 sprite on 32px tile)

**Question**: The Medieval Knight sprite is 64×64 pixels. The game tile is 32×32 pixels. Should the sprite be rendered at native size (overlapping 4 tiles) or scaled down to 32×32?

**Decision**: Render at native 64×64, centered on the character's tile position.

**Rationale**:
- Top-down RPG sprites conventionally bleed into adjacent tiles for visual richness — a character's head/shoulders extend above the tile, feet at the bottom
- Scaling to 32×32 would make the knight 8px tall — unreadably small and artistically wrong
- Phaser depth sorting (already at depth 10 for player) ensures sprites render above the tile map layer
- Pixel art mode (`pixelArt: true`, `antialias: false`) in main.ts is already set, so 64×64 assets will scale cleanly with the FIT scale mode

**Alternatives considered**:
- **Scale to 32×32**: Discarded — would require upscaling the art at a later stage and the character would be indistinguishable
- **Scale to 48×48**: A compromise, but deviates from the native asset dimensions without a strong reason

---

## Decision 3: Asset location in Vite project

**Question**: Where should the character sprite assets (PNG files and metadata.json) live in the frontend project?

**Decision**: `frontend/public/assets/characters/<character-id>/` (e.g., `medieval_knight/`). Vite serves the `public/` directory as static root, making assets accessible at `/assets/characters/medieval_knight/...` at runtime.

**Rationale**:
- Vite's `public/` convention requires zero configuration — files are copied verbatim to `dist/` on build
- The existing BootScene already loads from `/assets/` (`this.load.image('tileset', '/assets/tileset.png')`), confirming this is the intended path
- No Vite plugin or import alias needed; Phaser's loader fetches via URL

**Alternatives considered**:
- **Imported via ES module**: `import knightPng from './assets/...'` — Vite would hash the filename and break the path-based metadata JSON references
- **External CDN / admin server**: Unnecessary indirection for static game assets

---

## Decision 4: Direction handling — 8-way sprite, 4-way movement

**Question**: The sprite pack supports 8 directions. The current movement protocol only supports 4 (`'n' | 's' | 'e' | 'w'`). The breathing-idle animation only has frames for 4 of 8 directions (south, east, south-east, west). How should this be resolved?

**Decision**:
- For MVP: map protocol directions to their exact compass equivalents (n→north, s→south, e→east, w→west)
- For directions missing animated frames (north): fall back to the static rotation PNG for that direction, displayed as a single-frame "animation"
- The AnimatedSprite class stores a direction-resolution map that can be extended when diagonal movement is added

**Rationale**:
- The breathing-idle animation has exactly the 4 cardinal directions the MVP uses (south=s, east=e, west=w, and north falls back to static)
- No mirroring of frames is needed for 4-directional movement — all cardinal directions either have frames or a static rotation available
- Mirroring logic (e.g., north-east = flipped north-west) will be added when diagonal movement protocol is introduced

**Alternatives considered**:
- **Mirror south to north**: Would show character facing wrong way in the game world
- **Synthesize north frames from south frames with flip**: Same problem — south and north faces differ in top-down view

---

## Decision 5: AnimatedSprite class scope

**Question**: The spec requires the system to be extensible to monsters/NPCs (FR-007, FR-008). How much abstraction is justified for MVP?

**Decision**: A single `AnimatedSprite` class (extends `Phaser.GameObjects.Container`) that owns its own animation state and can be instantiated with any `SpriteDefinition`. GameScene creates one for the player character; monsters/NPCs will each instantiate their own in future iterations.

**Rationale**:
- The extensibility requirement is explicitly specified (FR-007, FR-008) — this abstraction is not speculative
- A class-based approach matches the existing `MonsterSprite` and `RemotePlayer` entities in the codebase
- The alternative (inlining animation logic in GameScene) would require duplication for every future entity type and has no path to reuse
- The class boundary is minimal: constructor takes `scene + SpriteDefinition`, exposes `setAnimation()`, `setDirection()`, `update(delta)` — no layer of indirection beyond what's needed

---

## Decision 6: Texture key naming convention

**Decision**: Texture keys follow the pattern `char:{characterId}:{animOrRotation}:{direction}:{frameIndex}`.

Examples:
- `char:medieval_knight:anim:breathing-idle:south:0`
- `char:medieval_knight:rotation:north`

**Rationale**:
- Namespaced to avoid collision with existing Phaser textures (`tileset`, `character`, `monster`)
- Deterministic — the AnimatedSprite can construct keys without a lookup table at runtime
- Human-readable in Phaser's texture cache inspector during debugging

---

## Summary Table

| Decision | Chosen Approach | Why |
|----------|----------------|-----|
| Frame loading | `load.image` per frame, texture swap at runtime | Zero build steps, YAGNI |
| Sprite size | Native 64×64, centered on tile | Artistic correctness, pixel art mode compatible |
| Asset path | `frontend/public/assets/characters/` | Vite convention, matches existing BootScene pattern |
| Direction mapping | 4-way protocol → 4 sprite directions, static PNG for north | Matches available animation frames exactly |
| Abstraction scope | Single `AnimatedSprite` class | Explicitly required by spec, consistent with existing entity classes |
| Texture key format | `char:{id}:{type}:{name}:{dir}:{frame}` | Collision-safe, debuggable |
