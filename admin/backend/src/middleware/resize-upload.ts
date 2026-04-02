import { Request, Response, NextFunction } from 'express';
import { resizeImageIfNeeded, ICON_MAX_DIMENSION } from '../services/image-resize';

/**
 * Express middleware that auto-resizes uploaded PNG images to fit within maxDimension.
 * Runs after multer — modifies req.file.buffer in place before the route handler.
 * Skipped if no file is uploaded.
 */
export function resizeUpload(maxDimension: number = ICON_MAX_DIMENSION) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Handle multipart file upload
      if (req.file?.buffer) {
        const result = await resizeImageIfNeeded(req.file.buffer, maxDimension);
        if (result.resized) {
          req.file.buffer = result.buffer;
          req.file.size = result.buffer.length;
          console.log(JSON.stringify({
            level: 'info',
            event: 'image_resized',
            originalSize: `${result.originalWidth}x${result.originalHeight}`,
            newSize: `${result.width}x${result.height}`,
            maxDimension,
          }));
        }
      }

      // Handle base64 field (icon_base64)
      if (req.body?.icon_base64 && typeof req.body.icon_base64 === 'string') {
        const buf = Buffer.from(req.body.icon_base64, 'base64');
        const result = await resizeImageIfNeeded(buf, maxDimension);
        if (result.resized) {
          req.body.icon_base64 = result.buffer.toString('base64');
          console.log(JSON.stringify({
            level: 'info',
            event: 'base64_image_resized',
            originalSize: `${result.originalWidth}x${result.originalHeight}`,
            newSize: `${result.width}x${result.height}`,
            maxDimension,
          }));
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
