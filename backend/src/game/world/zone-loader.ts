import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { query } from '../../db/connection';
import { log } from '../../logger';

export interface ZoneData {
  id: number;
  name: string;
  widthTiles: number;
  heightTiles: number;
  spawnX: number;
  spawnY: number;
  passability: boolean[][];  // [row][col] — true = walkable
}

const zoneCache = new Map<number, ZoneData>();

const MAPS_DIR = path.resolve(__dirname, '../../../assets/maps');

// tile id 1 (GID=1) is the passable grass tile in starter-plains.tmx;
// tile id 2 (GID=2) is the border/wall tile.
// We consider any tile with GID !== 2 (the wall) as passable for simplicity.
// A proper implementation would read tile properties from the tileset.
function isPassableTile(gid: number): boolean {
  return gid === 1; // GID 1 = passable grass; GID 2 = impassable border
}

function parseTmx(tmxPath: string): { width: number; height: number; passability: boolean[][] } {
  const xml = fs.readFileSync(tmxPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml) as {
    map: {
      '@_width': string;
      '@_height': string;
      layer: {
        data: { '#text': string } | string;
      };
    };
  };

  const mapNode = parsed.map;
  const width = parseInt(mapNode['@_width'], 10);
  const height = parseInt(mapNode['@_height'], 10);

  const rawData =
    typeof mapNode.layer.data === 'object'
      ? (mapNode.layer.data as { '#text': string })['#text']
      : (mapNode.layer.data as string);

  const gids = rawData
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  const passability: boolean[][] = [];
  for (let row = 0; row < height; row++) {
    passability[row] = [];
    for (let col = 0; col < width; col++) {
      const gid = gids[row * width + col] ?? 0;
      passability[row][col] = isPassableTile(gid);
    }
  }

  return { width, height, passability };
}

export async function loadAllZones(): Promise<void> {
  const result = await query<{
    id: number;
    name: string;
    tmx_filename: string;
    width_tiles: number;
    height_tiles: number;
    spawn_x: number;
    spawn_y: number;
  }>('SELECT id, name, tmx_filename, width_tiles, height_tiles, spawn_x, spawn_y FROM map_zones');

  for (const row of result.rows) {
    const tmxPath = path.join(MAPS_DIR, row.tmx_filename);

    if (!fs.existsSync(tmxPath)) {
      log('warn', 'zone-loader', 'tmx_not_found', { zone_id: row.id, path: tmxPath });
      continue;
    }

    try {
      const { width, height, passability } = parseTmx(tmxPath);
      zoneCache.set(row.id, {
        id: row.id,
        name: row.name,
        widthTiles: width,
        heightTiles: height,
        spawnX: row.spawn_x,
        spawnY: row.spawn_y,
        passability,
      });
      log('info', 'zone-loader', 'zone_loaded', { zone_id: row.id, name: row.name, width, height });
    } catch (err) {
      log('error', 'zone-loader', 'zone_parse_error', {
        zone_id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function getZone(id: number): ZoneData | undefined {
  return zoneCache.get(id);
}

export function isPassable(zoneId: number, x: number, y: number): boolean {
  const zone = zoneCache.get(zoneId);
  if (!zone) return false;
  if (y < 0 || y >= zone.heightTiles || x < 0 || x >= zone.widthTiles) return false;
  return zone.passability[y]?.[x] ?? false;
}
