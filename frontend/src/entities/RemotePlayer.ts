import Phaser from 'phaser';

const TILE_SIZE = 32;

export class RemotePlayer extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Rectangle;
  private nameLabel: Phaser.GameObjects.Text;
  readonly characterId: string;

  constructor(scene: Phaser.Scene, characterId: string, name: string, posX: number, posY: number) {
    const x = posX * TILE_SIZE + TILE_SIZE / 2;
    const y = posY * TILE_SIZE + TILE_SIZE / 2;

    super(scene, x, y);

    this.characterId = characterId;

    this.sprite = scene.add.rectangle(0, 0, 20, 20, 0x8888ff).setDepth(9);
    this.nameLabel = scene.add.text(0, -20, name, {
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.add([this.sprite, this.nameLabel]);
    scene.add.existing(this);
    this.setDepth(9);
  }

  moveTo(posX: number, posY: number): void {
    this.setPosition(posX * TILE_SIZE + TILE_SIZE / 2, posY * TILE_SIZE + TILE_SIZE / 2);
  }
}
