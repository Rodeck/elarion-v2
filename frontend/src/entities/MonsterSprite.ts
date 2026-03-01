import Phaser from 'phaser';

const TILE_SIZE = 32;

export class MonsterSprite extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Rectangle;
  private nameLabel: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  readonly instanceId: string;

  private maxHp: number;
  private readonly HP_BAR_WIDTH = 28;

  constructor(
    scene: Phaser.Scene,
    instanceId: string,
    name: string,
    posX: number,
    posY: number,
    currentHp: number,
    maxHp: number,
  ) {
    const x = posX * TILE_SIZE + TILE_SIZE / 2;
    const y = posY * TILE_SIZE + TILE_SIZE / 2;

    super(scene, x, y);

    this.instanceId = instanceId;
    this.maxHp = maxHp;

    this.sprite = scene.add.rectangle(0, 0, 20, 20, 0xcc4444);
    this.nameLabel = scene.add.text(0, -22, name, {
      fontSize: '9px',
      color: '#ffaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.hpBar = scene.add.rectangle(0, 14, this.HP_BAR_WIDTH, 4, 0x440000).setOrigin(0.5, 0);
    this.hpFill = scene.add.rectangle(-this.HP_BAR_WIDTH / 2, 14, this.HP_BAR_WIDTH, 4, 0xcc3333).setOrigin(0, 0);

    this.add([this.sprite, this.nameLabel, this.hpBar, this.hpFill]);
    scene.add.existing(this);
    this.setDepth(8);

    this.updateHpBar(currentHp);
  }

  takeDamage(newHp: number): void {
    this.updateHpBar(newHp);
    // Brief flash
    this.scene.tweens.add({
      targets: this.sprite,
      fillColor: 0xffffff,
      duration: 60,
      yoyo: true,
      onComplete: () => this.sprite.setFillStyle(0xcc4444),
    });
  }

  private updateHpBar(currentHp: number): void {
    const ratio = this.maxHp > 0 ? Math.max(0, Math.min(1, currentHp / this.maxHp)) : 0;
    this.hpFill.width = this.HP_BAR_WIDTH * ratio;
  }

  moveTo(posX: number, posY: number): void {
    this.setPosition(posX * TILE_SIZE + TILE_SIZE / 2, posY * TILE_SIZE + TILE_SIZE / 2);
  }
}
