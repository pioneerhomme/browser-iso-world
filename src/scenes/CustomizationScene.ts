import Phaser from 'phaser';

export class CustomizationScene extends Phaser.Scene {
  private selectedColor = 0xff5555;
  private selectedRect?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('CustomizationScene');
  }

  create(): void {
    this.add.text(24, 24, 'Кастомизация персонажа', {
      fontSize: '30px',
      color: '#ffffff'
    });

    this.add.text(24, 70, 'Выбери цвет, затем начни игру', {
      fontSize: '18px',
      color: '#cfd6e6'
    });

    const colors = [
      0xff5555,
      0x55cc77,
      0x5599ff,
      0xffcc55,
      0xdd88ff,
      0xf2f2f2
    ];

    colors.forEach((color, index) => {
      const rect = this.add
        .rectangle(70 + index * 88, 160, 68, 68, color)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      rect.on('pointerdown', () => {
        this.select(rect);
      });

      if (index === 0) {
        this.select(rect);
      }
    });

    const start = this.add
      .text(24, 240, 'Начать игру', {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#274060',
        padding: { left: 12, right: 12, top: 8, bottom: 8 }
      })
      .setInteractive({ useHandCursor: true });

    start.on('pointerdown', () => {
      this.registry.set('playerColor', this.selectedColor);
      this.scene.start('GameScene');
    });
  }

  private select(rect: Phaser.GameObjects.Rectangle): void {
    this.selectedRect?.setStrokeStyle(0);
    this.selectedRect = rect;
    rect.setStrokeStyle(4, 0xffffff);
    this.selectedColor = rect.fillColor;
  }
}