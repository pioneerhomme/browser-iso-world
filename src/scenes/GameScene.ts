import Phaser from 'phaser';
import { WORLD_SEED, TILE_W, TILE_H, VIEW_RADIUS } from '../core/constants';
import { worldToScreen, screenToWorld } from '../core/iso';
import { TileData, ItemId } from '../core/types';
import { WorldGen } from '../features/world/WorldGen';
import { Inventory } from '../features/inventory/Inventory';
import { BuildManager } from '../features/building/BuildManager';
import { CraftingSystem } from '../features/crafting/CraftingSystem';
import { Hud } from '../ui/Hud';

export class GameScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Hud;

  private inventory = new Inventory({ wood: 10, stone: 0 });
  private build = new BuildManager();
  private crafting = new CraftingSystem(this.inventory);

  private player = {
    x: 0,
    y: 0,
    speed: 4.5
  };

  private playerColor = 0xff5555;

  private buildMode = false;
  private removeMode = false;
  private selectedItem: ItemId = 'wood';

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  private keyW?: Phaser.Input.Keyboard.Key;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;

  private keyBuild?: Phaser.Input.Keyboard.Key;
  private keyRemove?: Phaser.Input.Keyboard.Key;
  private keyCraft?: Phaser.Input.Keyboard.Key;
  private keyOne?: Phaser.Input.Keyboard.Key;
  private keyTwo?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.playerColor = this.registry.get('playerColor', 0xff5555) as number;

    this.graphics = this.add.graphics();

    const keyboard = this.input.keyboard;

    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();

      this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

      this.keyBuild = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
      this.keyRemove = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.keyCraft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

      this.keyOne = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      this.keyTwo = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    }

    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer);
    });

    this.hud = new Hud({
      onToggleBuild: () => this.toggleBuild(),
      onToggleRemove: () => this.toggleRemove(),
      onCraft: () => this.craft(),
      onSelectWood: () => this.selectItem('wood'),
      onSelectStone: () => this.selectItem('stone')
    });

    this.updateHud();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);

    if (this.keyBuild && Phaser.Input.Keyboard.JustDown(this.keyBuild)) {
      this.toggleBuild();
    }

    if (this.keyRemove && Phaser.Input.Keyboard.JustDown(this.keyRemove)) {
      this.toggleRemove();
    }

    if (this.keyCraft && Phaser.Input.Keyboard.JustDown(this.keyCraft)) {
      this.craft();
    }

    if (this.keyOne && Phaser.Input.Keyboard.JustDown(this.keyOne)) {
      this.selectItem('wood');
    }

    if (this.keyTwo && Phaser.Input.Keyboard.JustDown(this.keyTwo)) {
      this.selectItem('stone');
    }

    this.updateMovement(dt);
    this.updateCamera();
    this.renderWorld();
  }

  private updateMovement(dt: number): void {
    let horizontal = 0;
    let vertical = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown) horizontal -= 1;
      if (this.cursors.right.isDown) horizontal += 1;
      if (this.cursors.up.isDown) vertical -= 1;
      if (this.cursors.down.isDown) vertical += 1;
    }

    if (this.keyA?.isDown) horizontal -= 1;
    if (this.keyD?.isDown) horizontal += 1;
    if (this.keyW?.isDown) vertical -= 1;
    if (this.keyS?.isDown) vertical += 1;

    horizontal = Phaser.Math.Clamp(horizontal, -1, 1);
    vertical = Phaser.Math.Clamp(vertical, -1, 1);

    // Экранное управление переводим в изометрические мировые направления
    const dx = horizontal + vertical;
    const dy = vertical - horizontal;

    const length = Math.hypot(dx, dy);

    if (length > 0) {
      this.player.x += (dx / length) * this.player.speed * dt;
      this.player.y += (dy / length) * this.player.speed * dt;
    }
  }

  private updateCamera(): void {
    const p = worldToScreen(this.player.x, this.player.y, 0);
    const cam = this.cameras.main;

    cam.setScroll(
      p.x - cam.width / 2,
      p.y + TILE_H / 2 - cam.height / 2
    );
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const cam = this.cameras.main;

    const px = pointer.x + cam.scrollX;
    const py = pointer.y + cam.scrollY;

    const tilePos = screenToWorld(px, py, 0);

    if (pointer.rightButtonDown() || this.removeMode) {
      this.tryRemove(tilePos.x, tilePos.y);
      return;
    }

    if (this.buildMode) {
      this.tryPlace(tilePos.x, tilePos.y);
    } else {
      this.tryHarvest(tilePos.x, tilePos.y);
    }
  }

  private toggleBuild(): void {
    this.buildMode = !this.buildMode;

    if (this.buildMode) {
      this.removeMode = false;
    }

    this.updateHud();
  }

  private toggleRemove(): void {
    this.removeMode = !this.removeMode;

    if (this.removeMode) {
      this.buildMode = false;
    }

    this.updateHud();
  }

  private selectItem(item: ItemId): void {
    this.selectedItem = item;
    this.buildMode = true;
    this.removeMode = false;

    this.updateHud();
  }

  private craft(): void {
    this.crafting.craftWoodToStone();
    this.updateHud();
  }

  private tryPlace(x: number, y: number): void {
    if (Math.round(this.player.x) === x && Math.round(this.player.y) === y) {
      return;
    }

    const tile = WorldGen.getTile(x, y, WORLD_SEED);

    if (!this.build.canPlaceAt(tile, x, y)) {
      return;
    }

    if (this.inventory.remove(this.selectedItem, 1)) {
      this.build.place(x, y, this.selectedItem);
      this.updateHud();
    }
  }

  private tryRemove(x: number, y: number): void {
    if (this.build.remove(x, y, this.inventory)) {
      this.updateHud();
    }
  }

  private tryHarvest(x: number, y: number): void {
    const tile = WorldGen.getTile(x, y, WORLD_SEED);

    if (this.build.harvest(x, y, tile, this.inventory)) {
      this.updateHud();
    }
  }

  private updateHud(): void {
    const mode = this.removeMode
      ? 'Снос'
      : this.buildMode
        ? 'Строительство'
        : 'Сбор';

    const selected = this.selectedItem === 'wood' ? 'дерево' : 'камень';

    this.hud.setBuildMode(this.buildMode);
    this.hud.setRemoveMode(this.removeMode);
    this.hud.setSelected(this.selectedItem);

    this.hud.setInfo(
      `Дерево: ${this.inventory.get('wood')} | Камень: ${this.inventory.get('stone')}
Режим: ${mode} | Материал: ${selected}
ПК: WASD/стрелки, ЛКМ — действие, ПКМ — снос, B/R/X/1/2
Мобильный: кнопки внизу экрана`
    );
  }

  private renderWorld(): void {
    const g = this.graphics;
    g.clear();

    const radius = VIEW_RADIUS;
    const centerX = Math.round(this.player.x);
    const centerY = Math.round(this.player.y);

    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        const tile = WorldGen.getTile(x, y, WORLD_SEED);
        this.drawTerrain(x, y, tile);
      }
    }

    const drawables: Array<{ depth: number; draw: () => void }> = [];

    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let x = centerX - radius; x <= centerX + radius; x++) {
        const tile = WorldGen.getTile(x, y, WORLD_SEED);
        const placedItem = this.build.getPlaced(x, y);

        if (placedItem) {
          drawables.push({
            depth: x + y,
            draw: () => this.drawBlock(x, y, placedItem)
          });
          continue;
        }

        if (tile.resource && !this.build.isHarvested(x, y)) {
          drawables.push({
            depth: x + y,
            draw: () => this.drawResource(x, y, tile.resource!)
          });
        }
      }
    }

    drawables.push({
      depth: this.player.x + this.player.y + 0.01,
      draw: () => this.drawPlayer()
    });

    drawables.sort((a, b) => a.depth - b.depth);

    for (const drawable of drawables) {
      drawable.draw();
    }
  }

  private drawTerrain(x: number, y: number, tile: TileData): void {
    const p = worldToScreen(x, y, 0);
    const color = this.terrainColor(tile.terrain);

    this.drawDiamond(
      p.x,
      p.y,
      color,
      tile.terrain === 'water' ? 0.95 : 1,
      0x000000,
      0.08
    );
  }

  private terrainColor(terrain: TileData['terrain']): number {
    switch (terrain) {
      case 'water':
        return 0x2c62b8;
      case 'sand':
        return 0xd7c58a;
      case 'grass':
        return 0x4a7f3c;
      case 'stone':
        return 0x7f8791;
      case 'snow':
        return 0xe8f1fb;
      default:
        return 0x000000;
    }
  }

  private drawDiamond(
    topX: number,
    topY: number,
    color: number,
    alpha = 1,
    lineColor = 0x000000,
    lineAlpha = 0
  ): void {
    const g = this.graphics;
    const halfWidth = TILE_W / 2;
    const halfHeight = TILE_H / 2;

    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(topX, topY);
    g.lineTo(topX + halfWidth, topY + halfHeight);
    g.lineTo(topX, topY + TILE_H);
    g.lineTo(topX - halfWidth, topY + halfHeight);
    g.closePath();
    g.fillPath();

    if (lineAlpha > 0) {
      g.lineStyle(1, lineColor, lineAlpha);
      g.strokePath();
    }
  }

  private drawResource(
    x: number,
    y: number,
    resource: 'tree' | 'rock'
  ): void {
    const p = worldToScreen(x, y, 0);
    const centerX = p.x;
    const centerY = p.y + TILE_H / 2;
    const g = this.graphics;

    if (resource === 'tree') {
      g.fillStyle(0x5d4126, 1);
      g.fillRect(centerX - 2, centerY - 16, 4, 14);

      g.fillStyle(0x2f8f3f, 1);
      g.fillCircle(centerX, centerY - 20, 10);
    } else {
      g.fillStyle(0x9aa2ad, 1);
      g.fillCircle(centerX - 3, centerY - 4, 6);

      g.fillStyle(0x7f8791, 1);
      g.fillCircle(centerX + 4, centerY - 2, 5);
    }
  }

  private drawBlock(x: number, y: number, item: ItemId): void {
    const ground = worldToScreen(x, y, 0);
    const top = worldToScreen(x, y, 1);

    const halfWidth = TILE_W / 2;
    const halfHeight = TILE_H / 2;

    const topRight = { x: top.x + halfWidth, y: top.y + halfHeight };
    const topBottom = { x: top.x, y: top.y + TILE_H };
    const topLeft = { x: top.x - halfWidth, y: top.y + halfHeight };

    const groundRight = { x: ground.x + halfWidth, y: ground.y + halfHeight };
    const groundBottom = { x: ground.x, y: ground.y + TILE_H };
    const groundLeft = { x: ground.x - halfWidth, y: ground.y + halfHeight };

    const colors =
      item === 'wood'
        ? {
            top: 0xb08a54,
            right: 0x8c6a3f,
            left: 0x77572f
          }
        : {
            top: 0xaab2bd,
            right: 0x828a95,
            left: 0x6d747d
          };

    this.drawPoly(
      [topRight, topBottom, groundBottom, groundRight],
      colors.right
    );

    this.drawPoly(
      [topLeft, topBottom, groundBottom, groundLeft],
      colors.left
    );

    this.drawDiamond(top.x, top.y, colors.top, 1, 0x000000, 0.16);
  }

  private drawPoly(
    points: Array<{ x: number; y: number }>,
    color: number,
    alpha = 1
  ): void {
    const g = this.graphics;

    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }

    g.closePath();
    g.fillPath();
  }

  private drawPlayer(): void {
    const p = worldToScreen(this.player.x, this.player.y, 0);
    const centerX = p.x;
    const centerY = p.y + TILE_H / 2;
    const g = this.graphics;

    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(centerX, centerY + 6, 20, 9);

    g.fillStyle(this.playerColor, 1);
    g.fillRect(centerX - 5, centerY - 6, 10, 12);
    g.fillCircle(centerX, centerY - 10, 7);
  }
}