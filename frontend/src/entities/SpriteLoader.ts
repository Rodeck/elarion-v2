import Phaser from 'phaser';
import type { SpriteMetadataJson, SpriteDefinition, AnimationDef, Direction8 } from '../types/sprite';
import { registerSprite } from './SpriteRegistry';

const FRAME_DELAY_MS = 150;

function rotationKey(characterId: string, dir: string): string {
  return `char:${characterId}:rotation:${dir}`;
}

function animFrameKey(characterId: string, animName: string, dir: string, frameIdx: number): string {
  return `char:${characterId}:anim:${animName}:${dir}:${frameIdx}`;
}

/**
 * Queues all texture load.image() calls for a sprite package.
 * Call this from inside a filecomplete callback during Phaser preload so the
 * images are included in the same load batch.
 */
export function queueTextures(
  scene: Phaser.Scene,
  meta: SpriteMetadataJson,
  characterId: string,
  basePath: string,
): void {
  // Static rotation images (one per direction)
  for (const [dir, relPath] of Object.entries(meta.frames.rotations)) {
    const key = rotationKey(characterId, dir);
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `${basePath}/${relPath}`);
    }
  }

  // Animated frame images
  for (const [animName, dirs] of Object.entries(meta.frames.animations)) {
    for (const [dir, frames] of Object.entries(dirs)) {
      (frames as string[]).forEach((relPath: string, idx: number) => {
        const key = animFrameKey(characterId, animName, dir, idx);
        if (!scene.textures.exists(key)) {
          scene.load.image(key, `${basePath}/${relPath}`);
        }
      });
    }
  }
}

/**
 * Builds a SpriteDefinition from a previously-loaded metadata JSON cache entry
 * and registers it in the SpriteRegistry under `characterId`.
 *
 * Call this from BootScene.create() after preload() has finished loading textures.
 */
export function buildDefinition(
  scene: Phaser.Scene,
  metaCacheKey: string,
  characterId: string,
): SpriteDefinition {
  const meta = scene.cache.json.get(metaCacheKey) as SpriteMetadataJson;

  // Build rotation map: direction → texture key
  const rotations = new Map<Direction8, string>();
  for (const dir of Object.keys(meta.frames.rotations)) {
    rotations.set(dir as Direction8, rotationKey(characterId, dir));
  }

  // Build animation map: animName → AnimationDef
  const animations = new Map<string, AnimationDef>();
  for (const [animName, dirs] of Object.entries(meta.frames.animations)) {
    const directions = new Map<Direction8, string[]>();
    for (const [dir, frames] of Object.entries(dirs)) {
      directions.set(
        dir as Direction8,
        (frames as string[]).map((_: string, idx: number) =>
          animFrameKey(characterId, animName, dir, idx),
        ),
      );
    }
    animations.set(animName, { name: animName, directions, frameDelay: FRAME_DELAY_MS });
  }

  const def: SpriteDefinition = {
    id: characterId,
    frameWidth: meta.character.size.width,
    frameHeight: meta.character.size.height,
    animations,
    rotations,
  };

  registerSprite(def);
  return def;
}
