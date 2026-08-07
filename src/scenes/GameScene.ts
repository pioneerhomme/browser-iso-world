import Phaser from 'phaser';
import { WORLD_SEED, TILE_H, VIEW_RADIUS } from '../core/constants';
import { worldToScreen, screenToWorld } from '../core/iso';
import { ItemId } from '../core/types';
import { WorldGen } from '../features/world/WorldGen';
import { Inventory } from '../features/inventory/Inventory';
import { BuildManager } from '../features/building/BuildManager';
import { CraftingSystem } from '../features/crafting/CraftingSystem';
import { Hud } from '../ui/Hud';
import { Appearance } from '../features/equipment/types';
import { getCharacterTexture } from '../features/art/TextureFactory';
import { SaveSystem } from '../features/save/SaveSystem';
import { SpritePool } from '../features/render/SpritePool';

export class GameScene extends Phaser.Scene {
  private hud!: Hud;
  private pool!: SpritePool;

  private inventory!: Inventory;
  private build = new BuildManager();
  private crafting!: CraftingSystem;

  private player = {
    x: 0,
    y: 0,
    speed: 4.5
  };

  private appearance: Appearance = {
    skin: 0xf2c79a,
    equipped: { head: null, chest: null, legs: null, hands: null, feet: null }
  };

  private playerSprite!: Phaser.GameObjects.Image;
  private walkTexA = '';
  private walkTexB = '';
  private walkTimer = 0;
  private walkFrame = 0;
  private moving = false;

  private buildMode = false;
  private removeMode = false;
  private selectedItem: ItemId = 'wood';

  private saveTimer = 0;

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

  private onVisibility = (): void => {
    if (document.hidden) {
      this.persist();
    }
  };

  constructor() {
    super('GameScene');
  }

  create(): void {
    const savedAppearance = this.registry.get('appearance');
    if (savedAppearance) {
      this.appearance = savedAppearance as Appearance;
    }

    const save = SaveSystem.load();

    this.inventory = new Inventory(save?.resources ?? { wood: 10, stone: 0 });
    this.crafting = new CraftingSystem(this.inventory);

    if (save) {
      this.build.restore(save.placed, save.harvested);
      this.player.x = save.player.x;
      this.player.y = save.player.y;
    }

    this.pool = new SpritePool(this);

    this.walkTexA = getCharacterTexture(this, this.appearance, 0);
    this.walkTexB = getCharacterTexture(this, this.appearance, 1);
    this.playerSprite = this.add.image(0, 0, this.walkTexA);
    this.playerSprite.setOrigin(0.5, 1);

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

    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onVisibility);
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

    if (this.keyBuild && Phaser.Input.Keyboard.JustDown(this.keyBuild)) this.toggleBuild();
    if (this.keyRemove && Phaser.Input.Keyboard.JustDown(this.keyRemove)) this.toggleRemove();
    if (this.keyCraft && Phaser.Input.Keyboard.JustDown(this.keyCraft)) this.craft();
    if (this.keyOne && Phaser.Input.Keyboard.JustDown(this.keyOne)) this.selectItem('wood');
    if (this.keyTwo && Phaser.Input.Keyboard.JustDown(this.keyTwo)) this.selectItem('stone');

    this.updateMovement(dt);
    this.updateCamera();
    this.renderWorld();
    this.updateWalkAnimation(dt);

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.persist();
    }
  }

  private persist(): void {
    const world = this.build.serialize();

    SaveSystem.update({
      resources: this.inventory.serialize(),
      placed: world.placed,
      harvested: world.harvested,
      player: { x: this.player.x, y: this.player.y }
    });
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

    const dx = horizontal + vertical;
    const dy = vertical - horizontal;
    const length = Math.hypot(dx, dy);

    this.moving = length > 0;

    if (this.moving) {
      this.player.x += (dx / length) * this.player.speed * dt;
      this.player.y += (dy / length) * this.player.speed * dt;
    }
  }

  private updateWalkAnimation(dt: number): void {
    if (this.moving) {
      this.walkTimer += dt;
      if (this.walkTimer > 0.18) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
        this.playerSprite.setTexture(this.walkFrame === 0 ? this.walkTexA : this.walkTexB);
      }
    } else if (this.walkFrame !== 0) {
      this.walkFrame = 0;
      this.playerSprite.setTexture(this.walkTexA);
    }
  }

  private updateCamera(): void {
    const p = worldToScreen(this.player.x, this.player.y, 0);
    const cam = this.cameras.main;

    cam.setScroll(p.x - cam.width / 2, p.y + TILE_H / 2 - cam.height / 2);
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
    if (this.buildMode) this.removeMode = false;
    this.updateHud();
  }

  private toggleRemove(): void {
    this.removeMode = !this.removeMode;
    if (this.removeMode) this.buildMode = false;
    this.updateHud();
  }

  private selectItem(item: ItemId): void {
    this.selectedItem = item;
    this.buildMode = true;
    this.removeMode = false;
    this.updateHud();
  }

  private craft(): void {
    if (this.crafting.craftWoodToStone()) {
      this.updateHud();
      this.persist();
    }
  }

  private tryPlace(x: number, y: number): void {
    if (Math.round(this.player.x) === x && Math.round(this.player.y) === y) return;

    const tile = WorldGen.getTile(x, y, WORLD_SEED);

    if (!this.build.canPlaceAt(tile, x, y)) return;

    if (this.inventory.remove(this.selectedItem, 1)) {
      this.build.place(x, y, this.selectedItem);
      this.updateHud();
      this.persist();
    }
  }

  private tryRemove(x: number, y: number): void {
    if (this.build.remove(x, y, this.inventory)) {
      this.updateHud();
      this.persist();
    }
  }

  private tryHarvest(x: number, y: number): void {
    const tile = WorldGen.getTile(x, y, WORLD_SEED);

    if (this.build.harvest(x, y, tile, this.inventory)) {
      this.updateHud();
      this.persist();
    }
  }

  private updateHud(): void {
    const mode = this.removeMode ? 'Снос' : this.buildMode ? 'Строительство' : 'Сбор';
    const selected = this.selectedItem === 'wood' ? 'дерево' : 'камень';

    this.hud.setBuildMode(this.buildMode);
    this.hud.setRemoveMode(this.removeMode);
    this.hud.setSelected(this.selectedItem);

    this.hud.setInfo(
      `Дерево: ${this.inventory.get('wood')} | Камень: ${this.inventory.get('stone')}\n` +
      `Режим: ${mode} | Материал: ${selected}\n` +
      `ПК: WASD/стрелки, ЛКМ — действие, ПКМ — снос, B/R/X/1/2\n` +
      `Мобильный: кнопки внизу экрана`
    );
  }

  private renderWorld(): void {
    const used = new Set<string>();
    const radius = VIEW_RADIUS;
    const cx = Math.round(this.player.x);
    const cy = Math.round(this.player.y);

    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const tile = WorldGen.getTile(x, y, WORLD_SEED);
        const p = worldToScreen(x, y, 0);

        const tKey = 't' + x + '|' + y;
        used.add(tKey);
        this.pool.acquire(tKey, p.x, p.y, 'tile_' + tile.terrain, x + y).setOrigin(0.5, 0);

        const oKey = 'o' + x + '|' + y;
        const placedItem = this.build.getPlaced(x, y);

        if (placedItem) {
          used.add(oKey);
          this.pool.acquire(oKey, p.x, p.y + TILE_H, 'block_' + placedItem, x + y + 0.5).setOrigin(0.5, 1);
        } else if (tile.resource && !this.build.isHarvested(x, y)) {
          used.add(oKey);
          this.pool.acquire(oKey, p.x, p.y + TILE_H, tile.resource === 'tree' ? 'tree' : 'rock', x + y + 0.5).setOrigin(0.5, 1);
        }
      }
    }

    this.pool.flush(used);

    const p = worldToScreen(this.player.x, this.player.y, 0);
    this.playerSprite.setPosition(p.x, p.y + TILE_H / 2 + 6);
    this.playerSprite.setDepth(this.player.x + this.player.y + 0.5);
  }
}