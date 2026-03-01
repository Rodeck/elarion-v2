import Phaser from 'phaser';
import { Colors, Fonts } from '../styles/phaser-tokens';

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

    // Placeholder assets — replace with real spritesheets/tilemaps during art pass
    this.load.image('tileset', '/assets/tileset.png');
    this.load.spritesheet('character', '/assets/character.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('monster', '/assets/monster.png', { frameWidth: 32, frameHeight: 32 });
  }

  create(): void {
    this.scene.start('LoginScene');
  }
}
