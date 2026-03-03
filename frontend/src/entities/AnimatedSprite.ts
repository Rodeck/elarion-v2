import Phaser from 'phaser';
import type { SpriteDefinition, Direction8, AnimationState } from '../types/sprite';

/**
 * A Phaser Container that manages a single animated sprite.
 * Owns its animation state independently — multiple instances never share state.
 *
 * Usage:
 *   const sprite = new AnimatedSprite(scene, x, y, def);
 *   sprite.setAnimation('breathing-idle');
 *   sprite.setDirection('south');
 *   scene.children.add(sprite);
 *   // In scene update():
 *   sprite.update(delta);
 */
export class AnimatedSprite extends Phaser.GameObjects.Container {
  private readonly def: SpriteDefinition;
  private readonly image: Phaser.GameObjects.Image;
  // Named 'animState' to avoid shadowing Phaser.GameObjects.GameObject.state (string | number)
  private readonly animState: AnimationState;

  constructor(scene: Phaser.Scene, x: number, y: number, def: SpriteDefinition) {
    super(scene, x, y);

    this.def = def;
    this.animState = {
      animName: '',
      direction: 'south',
      frameIndex: 0,
      frameTimer: 0,
      frameCount: 0,
      isStaticFrame: false,
    };

    // Use Phaser's built-in white pixel as placeholder until setAnimation() is called
    this.image = scene.add.image(0, 0, '__WHITE');
    this.image.setAlpha(0); // invisible until a real texture is assigned
    this.add(this.image);
  }

  /** Switch to a named animation. Resets frame to 0. No-op if already playing. */
  setAnimation(name: string): void {
    if (this.animState.animName === name) return;

    const animDef = this.def.animations.get(name);
    if (!animDef) {
      console.warn(`[AnimatedSprite] Animation '${name}' not found in sprite '${this.def.id}'`);
      return;
    }

    this.animState.animName = name;
    this.animState.frameIndex = 0;
    this.animState.frameTimer = 0;
    this.image.setAlpha(1);
    this.resolveTexture();
  }

  /** Update the facing direction. Resets to frame 0 of the new direction. No-op if unchanged. */
  setDirection(dir: Direction8): void {
    if (this.animState.direction === dir) return;
    this.animState.direction = dir;
    this.animState.frameIndex = 0;
    this.animState.frameTimer = 0;
    this.resolveTexture();
  }

  /**
   * Advance animation frame based on elapsed time.
   * Call from the scene's update(time, delta) method every tick.
   */
  update(delta: number): void {
    if (this.animState.isStaticFrame || this.animState.frameCount <= 1) return;

    const animDef = this.def.animations.get(this.animState.animName);
    if (!animDef) return;

    this.animState.frameTimer += delta;
    if (this.animState.frameTimer >= animDef.frameDelay) {
      this.animState.frameTimer -= animDef.frameDelay;
      this.animState.frameIndex = (this.animState.frameIndex + 1) % this.animState.frameCount;
      this.resolveTexture();
    }
  }

  /**
   * Resolves which Phaser texture key to display based on current animation + direction.
   * Priority:
   *   1. Animated frames for exact direction
   *   2. Static rotation PNG for exact direction
   *   3. Any available rotation PNG (last resort fallback)
   */
  private resolveTexture(): void {
    const { animName, direction, frameIndex } = this.animState;

    // 1. Try animated frames for the current direction
    if (animName) {
      const animDef = this.def.animations.get(animName);
      const frames = animDef?.directions.get(direction);
      if (frames && frames.length > 0) {
        this.animState.frameCount = frames.length;
        this.animState.isStaticFrame = false;
        const safeIdx = Math.min(frameIndex, frames.length - 1);
        this.image.setTexture(frames[safeIdx]!);
        return;
      }
    }

    // 2. Fall back to static rotation PNG for this direction
    const rotKey = this.def.rotations.get(direction);
    if (rotKey) {
      this.animState.frameCount = 1;
      this.animState.isStaticFrame = true;
      this.image.setTexture(rotKey);
      return;
    }

    // 3. Last resort: any rotation available
    const fallback = this.def.rotations.values().next().value as string | undefined;
    if (fallback) {
      this.animState.frameCount = 1;
      this.animState.isStaticFrame = true;
      this.image.setTexture(fallback);
    }
  }
}
