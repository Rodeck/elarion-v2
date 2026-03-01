import Phaser from 'phaser';

export class StatsBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private levelText: Phaser.GameObjects.Text;
  private hpFill: Phaser.GameObjects.Rectangle;
  private xpFill: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private xpText: Phaser.GameObjects.Text;

  private readonly BAR_WIDTH = 200;
  private readonly BAR_HEIGHT = 14;
  private readonly PAD = 10;

  constructor(scene: Phaser.Scene, name: string, className: string, level: number, hp: number, maxHp: number, xp: number, xpThreshold: number) {
    this.scene = scene;

    const x = this.PAD;
    const y = this.PAD;

    this.container = scene.add.container(x, y).setScrollFactor(0).setDepth(100);

    // Background panel
    const bg = scene.add.rectangle(0, 0, this.BAR_WIDTH + 20, 80, 0x000000, 0.7).setOrigin(0, 0);
    this.container.add(bg);

    // Character name + class
    this.nameText = scene.add.text(10, 8, `${name} (${className})`, {
      fontSize: '13px',
      color: '#e8d5a3',
    });
    this.container.add(this.nameText);

    // Level
    this.levelText = scene.add.text(10, 22, `Level ${level}`, {
      fontSize: '12px',
      color: '#aaaaaa',
    });
    this.container.add(this.levelText);

    // HP bar
    const hpBg = scene.add.rectangle(10, 40, this.BAR_WIDTH, this.BAR_HEIGHT, 0x440000).setOrigin(0, 0);
    this.hpFill = scene.add.rectangle(10, 40, this.BAR_WIDTH, this.BAR_HEIGHT, 0xcc3333).setOrigin(0, 0);
    this.hpText = scene.add.text(10 + this.BAR_WIDTH / 2, 40 + this.BAR_HEIGHT / 2, '', {
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add([hpBg, this.hpFill, this.hpText]);

    // XP bar
    const xpBg = scene.add.rectangle(10, 58, this.BAR_WIDTH, this.BAR_HEIGHT, 0x222244).setOrigin(0, 0);
    this.xpFill = scene.add.rectangle(10, 58, 0, this.BAR_HEIGHT, 0x4466cc).setOrigin(0, 0);
    this.xpText = scene.add.text(10 + this.BAR_WIDTH / 2, 58 + this.BAR_HEIGHT / 2, '', {
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add([xpBg, this.xpFill, this.xpText]);

    this.setHp(hp, maxHp);
    this.setXp(xp, xpThreshold);
    this.setLevel(level);
  }

  setHp(current: number, max: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.hpFill.width = this.BAR_WIDTH * ratio;
    this.hpText.setText(`${current} / ${max}`);
  }

  setXp(current: number, threshold: number): void {
    const ratio = threshold > 0 ? Math.max(0, Math.min(1, current / threshold)) : 0;
    this.xpFill.width = this.BAR_WIDTH * ratio;
    this.xpText.setText(`XP: ${current} / ${threshold}`);
  }

  setLevel(level: number): void {
    this.levelText.setText(`Level ${level}`);
  }

  destroy(): void {
    this.container.destroy();
  }
}
