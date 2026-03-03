/**
 * Direction types and sprite definition interfaces for the animation system.
 * Used by AnimatedSprite, SpriteLoader, and SpriteRegistry.
 */

/** 8-way compass directions matching the sprite pack format. */
export type Direction8 =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

/** 4-way protocol directions used in player.move messages. */
export type Direction4 = 'n' | 's' | 'e' | 'w';

/** Maps protocol movement directions to sprite compass directions. */
export const DIR4_TO_DIR8: Record<Direction4, Direction8> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
};

/** Schema of the metadata.json file shipped with each character sprite package. */
export interface SpriteMetadataJson {
  character: {
    id: string;
    name: string;
    size: { width: number; height: number };
    directions: number;
    view: string;
  };
  frames: {
    rotations: Partial<Record<Direction8, string>>;
    animations: Record<string, Partial<Record<Direction8, string[]>>>;
  };
}

/** Runtime animation definition: stores resolved Phaser texture keys per direction. */
export interface AnimationDef {
  name: string;
  /** Direction → ordered list of Phaser texture keys for each frame. */
  directions: Map<Direction8, string[]>;
  /** Milliseconds per frame. */
  frameDelay: number;
}

/** Runtime sprite definition built from SpriteMetadataJson after textures are loaded. */
export interface SpriteDefinition {
  /** Identifier used as registry key and in texture key namespacing. */
  id: string;
  frameWidth: number;
  frameHeight: number;
  /** Animation name → AnimationDef. */
  animations: Map<string, AnimationDef>;
  /** Direction → Phaser texture key for static rotation image. */
  rotations: Map<Direction8, string>;
}

/** Per-entity runtime animation state. Each AnimatedSprite owns one independently. */
export interface AnimationState {
  animName: string;
  direction: Direction8;
  frameIndex: number;
  frameTimer: number;
  frameCount: number;
  /** True when the current direction has no animated frames and shows a static rotation. */
  isStaticFrame: boolean;
}
