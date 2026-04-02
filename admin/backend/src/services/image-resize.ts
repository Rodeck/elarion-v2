import sharp from 'sharp';

interface ResizeResult {
  buffer: Buffer;
  width: number;
  height: number;
  resized: boolean;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Resize a PNG image buffer if it exceeds the max dimension, preserving aspect ratio and alpha channel.
 * Returns the original buffer unchanged if already within limits.
 */
export async function resizeImageIfNeeded(
  buffer: Buffer,
  maxDimension: number,
): Promise<ResizeResult> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return {
      buffer,
      width: originalWidth,
      height: originalHeight,
      resized: false,
      originalWidth,
      originalHeight,
    };
  }

  const resized = await sharp(buffer)
    .resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ quality: 90, compressionLevel: 6 })
    .toBuffer();

  const newMeta = await sharp(resized).metadata();

  return {
    buffer: resized,
    width: newMeta.width ?? 0,
    height: newMeta.height ?? 0,
    resized: true,
    originalWidth,
    originalHeight,
  };
}

/** Max icon dimension for items, monsters, NPCs, bosses, squires, abilities */
export const ICON_MAX_DIMENSION = 512;
