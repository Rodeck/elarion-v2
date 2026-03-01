import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a2a1a',
  parent: 'game',
  scene: [BootScene, LoginScene, CharacterCreateScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
