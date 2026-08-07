import Phaser from 'phaser';
import { createBaseTextures } from '../features/art/TextureFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createBaseTextures(this);
    this.scene.start('CharacterScene');
  }
}