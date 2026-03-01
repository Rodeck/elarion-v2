import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show a loading bar while assets load
    const { width, height } = this.scale;
    const barWidth = 320;
    const barHeight = 16;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    const bgBar = this.add.rectangle(barX, barY, barWidth, barHeight, 0x333333).setOrigin(0, 0);
    const fgBar = this.add.rectangle(barX, barY, 0, barHeight, 0x44bb88).setOrigin(0, 0);

    this.load.on('progress', (value: number) => {
      fgBar.width = barWidth * value;
    });

    // Placeholder assets — replace with real spritesheets/tilemaps during art pass
    this.load.image('tileset', '/assets/tileset.png');
    this.load.spritesheet('character', '/assets/character.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('monster', '/assets/monster.png', { frameWidth: 32, frameHeight: 32 });

    void bgBar; // suppress unused warning

    this.load.on('complete', () => {
      fgBar.width = barWidth;
    });
  }

  create(): void {
    this.scene.start('LoginScene');
  }
}
