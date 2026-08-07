import Phaser from 'phaser';

export class SpritePool {
  private pool: Phaser.GameObjects.Image[] = [];
  private active = new Map<string, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  acquire(key: string, x: number, y: number, texture: string, depth: number): Phaser.GameObjects.Image {
    let img = this.active.get(key);

    if (!img) {
      img = this.pool.pop() ?? this.scene.add.image(0, 0, texture);
      this.active.set(key, img);
    }

    img.setTexture(texture);
    img.setPosition(x, y);
    img.setDepth(depth);
    img.setVisible(true);

    return img;
  }

  flush(usedKeys: Set<string>): void {
    for (const [key, img] of this.active) {
      if (!usedKeys.has(key)) {
        img.setVisible(false);
        this.pool.push(img);
        this.active.delete(key);
      }
    }
  }
}