import type { SpriteDefinition } from '../types/sprite';

/** Global registry mapping character IDs to their loaded SpriteDefinitions. */
const spriteRegistry = new Map<string, SpriteDefinition>();

export function registerSprite(def: SpriteDefinition): void {
  spriteRegistry.set(def.id, def);
}

export function getSprite(id: string): SpriteDefinition | undefined {
  return spriteRegistry.get(id);
}

export function hasSprite(id: string): boolean {
  return spriteRegistry.has(id);
}
