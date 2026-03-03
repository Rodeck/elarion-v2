import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { updateMapImage } from '../../../../backend/src/db/queries/city-maps';

export const uploadRouter = Router();

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const IMAGES_DIR = path.resolve(__dirname, '../../../../backend/assets/maps/images');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

function isValidPng(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES);
}

uploadRouter.post('/:id/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const mapId = parseInt(req.params.id!, 10);

    if (!req.file) {
      console.log(JSON.stringify({
        level: 'warn',
        event: 'upload_rejected',
        reason: 'no_file',
        mapId,
        timestamp: new Date().toISOString(),
      }));
      res.status(400).json({ error: 'No PNG file uploaded' });
      return;
    }

    if (!isValidPng(req.file.buffer)) {
      console.log(JSON.stringify({
        level: 'warn',
        event: 'upload_rejected',
        reason: 'invalid_png',
        mapId,
        originalName: req.file.originalname,
        timestamp: new Date().toISOString(),
      }));
      res.status(400).json({ error: 'File is not a valid PNG' });
      return;
    }

    const filename = `${crypto.randomUUID()}.png`;
    const filePath = path.resolve(IMAGES_DIR, filename);

    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    fs.writeFileSync(filePath, req.file.buffer);

    console.log(JSON.stringify({
      level: 'info',
      event: 'upload_written',
      mapId,
      filename,
      size: req.file.size,
      timestamp: new Date().toISOString(),
    }));

    const result = await updateMapImage(mapId, filename);

    if (result === null) {
      // Clean up the written file since the map doesn't exist
      fs.unlinkSync(filePath);
      console.log(JSON.stringify({
        level: 'warn',
        event: 'upload_rejected',
        reason: 'map_not_found',
        mapId,
        filename,
        timestamp: new Date().toISOString(),
      }));
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    console.log(JSON.stringify({
      level: 'info',
      event: 'upload_complete',
      mapId,
      filename,
      size: req.file.size,
      timestamp: new Date().toISOString(),
    }));

    res.json({ image_url: '/images/' + filename });
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'upload_error',
      mapId: req.params.id,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    }));
    res.status(500).json({ error: 'Internal server error' });
  }
});
