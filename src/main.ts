import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CharacterScene } from './scenes/CharacterScene';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e0f13',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  scene: [BootScene, CharacterScene, GameScene]
});