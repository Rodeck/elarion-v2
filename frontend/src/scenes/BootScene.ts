import Phaser from 'phaser';
import { Colors, Fonts } from '../styles/phaser-tokens';
import { queueTextures, buildDefinition } from '../entities/SpriteLoader';
import type { SpriteMetadataJson } from '../types/sprite';

const KNIGHT_ID = 'medieval_knight';
const KNIGHT_META_KEY = 'medieval_knight_meta';
const KNIGHT_BASE_PATH = '/assets/characters/medieval_knight';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;
    const barWidth = 320;
    const barHeight = 8;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    // Loading label
    const label = this.add.text(width / 2, barY - 24, 'Loading...', {
      fontFamily: Fonts.display,
      fontSize: '14px',
      color: Colors.textSecondary,
    }).setOrigin(0.5);

    // Track
    const bgBar = this.add.graphics();
    bgBar.fillStyle(Colors.xpBg, 1.0);
    bgBar.fillRect(barX, barY, barWidth, barHeight);
    bgBar.lineStyle(1, Colors.goldSubtle, 1.0);
    bgBar.strokeRect(barX, barY, barWidth, barHeight);

    // Fill
    const fgBar = this.add.graphics();

    this.load.on('progress', (value: number) => {
      fgBar.clear();
      fgBar.fillStyle(Colors.xpFill, 1.0);
      fgBar.fillRect(barX, barY, barWidth * value, barHeight);
    });

    this.load.on('complete', () => {
      fgBar.clear();
      fgBar.fillStyle(Colors.xpFill, 1.0);
      fgBar.fillRect(barX, barY, barWidth, barHeight);
    });

    void label;

    // Load sprite metadata JSON — when it completes, queue all frame textures in the
    // same load batch so everything is ready before create() runs.
    this.load.json(KNIGHT_META_KEY, `${KNIGHT_BASE_PATH}/metadata.json`);
    this.load.once(`filecomplete-json-${KNIGHT_META_KEY}`, () => {
      const meta = this.cache.json.get(KNIGHT_META_KEY) as SpriteMetadataJson;
      queueTextures(this, meta, KNIGHT_ID, KNIGHT_BASE_PATH);
    });
  }

  create(): void {
    // Build the SpriteDefinition from the loaded metadata and register it globally.
    buildDefinition(this, KNIGHT_META_KEY, KNIGHT_ID);

    this.scene.start('LoginScene');
  }
}
