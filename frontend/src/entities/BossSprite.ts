import Phaser from 'phaser';
import { Colors, Fonts } from '../styles/phaser-tokens';
import type { BossDto } from '@elarion/protocol';

export interface BossSpriteConfig {
  scene: Phaser.Scene;
  boss: BossDto;
  x: number;
  y: number;
}

/**
 * A Phaser Container that renders a boss sprite on the city map.
 * Shows a pulsing glow, name label, and responds to clicks.
 */
export class BossSprite extends Phaser.GameObjects.Container {
  private bossId: number;
  private bossData: BossDto;
  private glowCircle: Phaser.GameObjects.Arc;
  private outerRing: Phaser.GameObjects.Arc;
  private spriteImage: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private nameLabel: Phaser.GameObjects.Text;
  private skullLabel: Phaser.GameObjects.Text;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private ringTween: Phaser.Tweens.Tween | null = null;
  private floatTween: Phaser.Tweens.Tween | null = null;

  private static readonly SPRITE_SIZE = 80;
  private static readonly GLOW_RADIUS = 56;
  private static readonly RING_RADIUS = 50;

  constructor(config: BossSpriteConfig) {
    super(config.scene, config.x, config.y);
    this.bossId = config.boss.id;
    this.bossData = config.boss;

    const S = BossSprite.SPRITE_SIZE;

    // Outer rotating ring — dark red dashed circle effect
    this.outerRing = config.scene.add.circle(0, 0, BossSprite.RING_RADIUS, 0x000000, 0);
    this.outerRing.setStrokeStyle(2, 0xcc3333, 0.5);
    this.add(this.outerRing);

    this.ringTween = config.scene.tweens.add({
      targets: this.outerRing,
      angle: 360,
      duration: 6000,
      repeat: -1,
      ease: 'Linear',
    });

    // Pulsing glow circle behind the sprite
    this.glowCircle = config.scene.add.circle(0, 0, BossSprite.GLOW_RADIUS, 0x8b0000, 0.25);
    this.add(this.glowCircle);

    this.glowTween = config.scene.tweens.add({
      targets: this.glowCircle,
      alpha: { from: 0.2, to: 0.6 },
      scaleX: { from: 1.0, to: 1.15 },
      scaleY: { from: 1.0, to: 1.15 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Boss sprite image or placeholder (2x size)
    const spriteKey = `boss_sprite_${config.boss.id}`;
    if (config.boss.sprite_url && config.scene.textures.exists(spriteKey)) {
      this.spriteImage = config.scene.add.image(0, 0, spriteKey).setDisplaySize(S, S);
    } else {
      // Dark red placeholder rectangle with border
      this.spriteImage = config.scene.add.rectangle(0, 0, S, S, 0x8b0000, 1);
      (this.spriteImage as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xcc4444);
    }
    this.add(this.spriteImage);

    // Skull icon above the sprite
    this.skullLabel = config.scene.add.text(0, -(S / 2) - 10, '\u2620', {
      fontSize: '18px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
    this.add(this.skullLabel);

    // Name label below sprite — larger and more prominent
    this.nameLabel = config.scene.add.text(0, (S / 2) + 4, config.boss.name, {
      fontFamily: Fonts.display,
      fontSize: '13px',
      color: '#ff6666',
      stroke: '#0a0806',
      strokeThickness: 5,
      shadow: {
        offsetX: 0,
        offsetY: 2,
        color: '#330000',
        blur: 6,
        fill: true,
      },
    }).setOrigin(0.5, 0);
    this.add(this.nameLabel);

    // Gentle floating animation on the whole container
    this.floatTween = config.scene.tweens.add({
      targets: this,
      y: config.y - 3,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Make interactive — larger hit area
    const hitSize = S + 16;
    this.setSize(hitSize, hitSize);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-hitSize / 2, -hitSize / 2, hitSize, hitSize),
      Phaser.Geom.Rectangle.Contains,
    );

    // Hover cursor
    this.on('pointerover', () => {
      config.scene.input.setDefaultCursor('pointer');
    });
    this.on('pointerout', () => {
      config.scene.input.setDefaultCursor('default');
    });

    this.setDepth(8);

    // Apply initial status
    this.updateStatus(config.boss.status);
  }

  getBossId(): number {
    return this.bossId;
  }

  getBossData(): BossDto {
    return this.bossData;
  }

  setBossData(data: BossDto): void {
    this.bossData = data;
  }

  /**
   * Load the boss sprite texture asynchronously.
   * Called after creating the container so the scene loader can run.
   */
  loadSprite(): void {
    if (!this.bossData.sprite_url) return;
    const spriteKey = `boss_sprite_${this.bossId}`;
    if (this.scene.textures.exists(spriteKey)) return;

    const S = BossSprite.SPRITE_SIZE;
    this.scene.load.image(spriteKey, this.bossData.sprite_url);
    this.scene.load.once('complete', () => {
      if (!this.scene || !this.active) return;
      const oldSprite = this.spriteImage;
      this.spriteImage = this.scene.add.image(0, 0, spriteKey).setDisplaySize(S, S);
      this.addAt(this.spriteImage, 2); // after ring + glow, before skull + label
      oldSprite.destroy();
    });
    this.scene.load.start();
  }

  updateStatus(status: 'alive' | 'in_combat' | 'defeated' | 'inactive'): void {
    switch (status) {
      case 'alive':
        this.setVisible(true);
        this.setAlpha(1);
        if (this.spriteImage instanceof Phaser.GameObjects.Image) {
          this.spriteImage.clearTint();
        }
        this.skullLabel.setColor('#ff4444');
        this.outerRing.setStrokeStyle(2, 0xcc3333, 0.5);
        if (this.glowTween && !this.glowTween.isPlaying()) this.glowTween.resume();
        if (this.ringTween && !this.ringTween.isPlaying()) this.ringTween.resume();
        if (this.floatTween && !this.floatTween.isPlaying()) this.floatTween.resume();
        break;

      case 'in_combat':
        this.setVisible(true);
        this.setAlpha(0.85);
        if (this.spriteImage instanceof Phaser.GameObjects.Image) {
          this.spriteImage.setTint(0xff4444);
        }
        this.skullLabel.setColor('#ffaa44');
        this.outerRing.setStrokeStyle(2, 0xff6600, 0.6);
        break;

      case 'defeated':
      case 'inactive':
        this.setVisible(false);
        if (this.glowTween && this.glowTween.isPlaying()) this.glowTween.pause();
        if (this.ringTween && this.ringTween.isPlaying()) this.ringTween.pause();
        if (this.floatTween && this.floatTween.isPlaying()) this.floatTween.pause();
        break;
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.glowTween) { this.glowTween.destroy(); this.glowTween = null; }
    if (this.ringTween) { this.ringTween.destroy(); this.ringTween = null; }
    if (this.floatTween) { this.floatTween.destroy(); this.floatTween = null; }
    this.scene?.input?.setDefaultCursor('default');
    super.destroy(fromScene);
  }
}
