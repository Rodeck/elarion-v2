import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: '#1a1814',
  parent: 'canvas-area',
  scene: [BootScene, LoginScene, CharacterCreateScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
};

new Phaser.Game(config);
