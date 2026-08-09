import Phaser from 'phaser';
import {
  WORLD_SEED,
  TILE_W,
  TILE_H,
  BLOCK_SCALE,
  CHAR_SCALE,
  TREE_MIN,
  TREE_MAX,
  ROCK_MIN,
  ROCK_MAX,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  RENDER_RADIUS_MAX,
  CHUNK_BUDGET_PER_FRAME
} from '../core/constants';
import { worldToScreen, screenToWorld } from '../core/iso';
import { hash2 } from '../core/rng';
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
import { ToolId, TOOL_FOR_RESOURCE, TOOL_LABELS, STARTER_TOOLS } from '../features/tools/ToolsSystem';
import { HarvestProgress, HITS_REQUIRED } from '../features/harvest/HarvestProgress';
import { getChunkTexture, CHUNK, CHUNK_OFF_X } from '../features/render/ChunkTerrain';

export class GameScene extends Phaser.Scene {
  private hud!: Hud;
  private pool!: SpritePool;

  private inventory!: Inventory;
  private build = new BuildManager();
  private crafting!: CraftingSystem;
  private harvestProgress = new HarvestProgress();

  private tools: ToolId[] = [...STARTER_TOOLS];

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

  private zoom = DEFAULT_ZOOM;
  private targetZoom = DEFAULT_ZOOM;

  private hitTimes = new Map<string, number>();

  private chunkLastUsed = new Map<string, number>();
  private evictTimer = 0;
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
      this.zoom = save.zoom;
      this.targetZoom = save.zoom;

      const savedTools = (save.tools ?? []).filter((t) => t === 'axe' || t === 'pickaxe');
      if (savedTools.length > 0) {
        this.tools = savedTools;
      }
    }

    this.pool = new SpritePool(this);

    this.walkTexA = getCharacterTexture(this, this.appearance, 0);
    this.walkTexB = getCharacterTexture(this, this.appearance, 1);
    this.playerSprite = this.add.image(0, 0, this.walkTexA);
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.setScale(CHAR_SCALE);

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

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.adjustZoom(dy > 0 ? -0.15 : 0.15);
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
      onSelectStone: () => this.selectItem('stone'),
      onZoomIn: () => this.adjustZoom(0.25),
      onZoomOut: () => this.adjustZoom(-0.25)
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

    // плавный зум, точка привязки — персонаж (камера центрирована на нём)
    if (Math.abs(this.targetZoom - this.zoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);
    } else {
      this.zoom = this.targetZoom;
    }

    this.updateMovement(dt);

    // не даём дереву вырасти под ногами игрока
    this.build.deferRegrowth(Math.floor(this.player.x), Math.floor(this.player.y));

    this.updateCamera();
    this.renderWorld();
    this.updateWalkAnimation(dt);

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.persist();
    }
  }

  private adjustZoom(delta: number): void {
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom + delta, MIN_ZOOM, MAX_ZOOM);
  }

  private persist(): void {
    const world = this.build.serialize();

    SaveSystem.update({
      resources: this.inventory.serialize(),
      placed: world.placed,
      harvested: world.harvested,
      player: { x: this.player.x, y: this.player.y },
      zoom: this.targetZoom,
      tools: this.tools
    });
  }

  // ── коллизии ──────────────────────────────────────────────

  private isWalkableTile(tx: number, ty: number): boolean {
    const tile = WorldGen.getTile(tx, ty, WORLD_SEED);

    if (tile.terrain === 'water') return false;
    if (this.build.topZ(tx, ty) > 0) return false;
    if (tile.resource && !this.build.isHarvested(tx, ty)) return false;

    return true;
  }

  private canStandAt(x: number, y: number): boolean {
    const r = 0.3;

    return (
      this.isWalkableTile(Math.floor(x - r), Math.floor(y - r)) &&
      this.isWalkableTile(Math.floor(x + r), Math.floor(y - r)) &&
      this.isWalkableTile(Math.floor(x - r), Math.floor(y + r)) &&
      this.isWalkableTile(Math.floor(x + r), Math.floor(y + r))
    );
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
      const stepX = (dx / length) * this.player.speed * dt;
      const stepY = (dy / length) * this.player.speed * dt;

      // раздельные оси → скольжение вдоль препятствий
      if (this.canStandAt(this.player.x + stepX, this.player.y)) {
        this.player.x += stepX;
      }
      if (this.canStandAt(this.player.x, this.player.y + stepY)) {
        this.player.y += stepY;
      }
    }
  }

  // ── остальное ─────────────────────────────────────────────

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
    const cam = this.cameras.main;

    cam.setZoom(this.zoom);

    const p = worldToScreen(this.player.x, this.player.y, 0);
    cam.centerOn(p.x, p.y + TILE_H / 2);
  }

    private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tilePos = screenToWorld(world.x, world.y, 0);

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
      if (this.build.place(x, y, this.selectedItem)) {
        this.updateHud();
        this.persist();
      } else {
        this.inventory.add(this.selectedItem, 1);
      }
    }
  }

  private tryRemove(x: number, y: number): void {
    if (this.build.removeTop(x, y, this.inventory)) {
      this.updateHud();
      this.persist();
    }
  }

  private tryHarvest(x: number, y: number): void {
    const tile = WorldGen.getTile(x, y, WORLD_SEED);
    if (!tile.resource || this.build.isHarvested(x, y)) return;

    const tool = TOOL_FOR_RESOURCE[tile.resource];

    if (!this.tools.includes(tool)) {
      this.floatText(x + 0.5, y + 0.5, 'Нужен: ' + TOOL_LABELS[tool], '#ff8080');
      return;
    }

    const oKey = `o${x}|${y}|0`;
    this.hitTimes.set(oKey, this.time.now);
    this.spawnHitFx(x, y);

    const hits = this.harvestProgress.hit(x, y);

    if (hits >= HITS_REQUIRED) {
      this.harvestProgress.clear(x, y);
      this.hitTimes.delete(oKey);
      this.build.harvest(x, y, tile, this.inventory);
      this.floatText(x + 0.5, y + 0.5, tile.resource === 'tree' ? '+3 дерева' : '+3 камня', '#9ff09a');
      this.updateHud();
      this.persist();
    } else {
      this.floatText(x + 0.5, y + 0.5, `${hits}/${HITS_REQUIRED}`, '#ffffff');
    }
  }

  private spawnHitFx(x: number, y: number): void {
    const p = worldToScreen(x, y, 0);

    for (let i = 0; i < 3; i++) {
      const s = this.add.image(
        p.x + Phaser.Math.Between(-8, 8),
        p.y + Phaser.Math.Between(-16, 0),
        'spark'
      );
      s.setDepth(9000);

      this.tweens.add({
        targets: s,
        y: s.y + 14,
        alpha: 0,
        duration: 300,
        delay: i * 30,
        onComplete: () => s.destroy()
      });
    }
  }

  private floatText(worldX: number, worldY: number, msg: string, color: string): void {
    const p = worldToScreen(worldX, worldY, 0);

    const t = this.add
      .text(p.x, p.y - 40, msg, { fontSize: '12px', color })
      .setDepth(10000)
      .setOrigin(0.5, 1);

    this.tweens.add({
      targets: t,
      y: t.y - 24,
      alpha: 0,
      duration: 600,
      onComplete: () => t.destroy()
    });
  }

  private updateHud(): void {
    const mode = this.removeMode ? 'Снос' : this.buildMode ? 'Строительство' : 'Сбор';
    const selected = this.selectedItem === 'wood' ? 'дерево' : 'камень';

    this.hud.setBuildMode(this.buildMode);
    this.hud.setRemoveMode(this.removeMode);
    this.hud.setSelected(this.selectedItem);

    this.hud.setInfo(
      `Дерево: ${this.inventory.get('wood')} | Камень: ${this.inventory.get('stone')} | Зум: ${this.zoom.toFixed(2)}\n` +
      `Инструменты: ${this.tools.map((t) => TOOL_LABELS[t]).join(', ')}\n` +
      `Режим: ${mode} | Материал: ${selected} | Дерево рубим топором (3 удара), камень киркой\n` +
      `ПК: WASD, ЛКМ, ПКМ — снос, колесико — зум, B/R/X/1/2`
    );
  }

      private renderWorld(): void {
    const used = new Set<string>();
    const cam = this.cameras.main;

    // радиус рендера: корректная изометрическая оценка видимой области
    const need =
      Math.ceil(
        (cam.width / (this.zoom * TILE_W) + cam.height / (this.zoom * TILE_H)) / 2
      ) + 4;
    const R = Math.min(need, RENDER_RADIUS_MAX);

    const pcx = Math.round(this.player.x);
    const pcy = Math.round(this.player.y);

    // ── чанки земли (глубина 0 — всегда снизу) ──
    const cMinX = Math.floor((pcx - R) / CHUNK);
    const cMaxX = Math.floor((pcx + R) / CHUNK);
    const cMinY = Math.floor((pcy - R) / CHUNK);
    const cMaxY = Math.floor((pcy + R) / CHUNK);

    const chunks: Array<{ cx: number; cy: number; d: number }> = [];
    for (let cy = cMinY; cy <= cMaxY; cy++) {
      for (let cx = cMinX; cx <= cMaxX; cx++) {
        const dx = cx * CHUNK - pcx;
        const dy = cy * CHUNK - pcy;
        chunks.push({ cx, cy, d: dx * dx + dy * dy });
      }
    }
    chunks.sort((a, b) => a.d - b.d);

    let budget = CHUNK_BUDGET_PER_FRAME;
    for (const c of chunks) {
      const texKey = `chunk_${c.cx}_${c.cy}`;

      if (!this.textures.exists(texKey)) {
        if (budget <= 0) continue;
        budget--;
        getChunkTexture(this, c.cx, c.cy);
      }

      const p = worldToScreen(c.cx * CHUNK, c.cy * CHUNK, 0);
      const cKey = 'c' + c.cx + '|' + c.cy;
      used.add(cKey);
      this.pool.acquire(cKey, p.x - CHUNK_OFF_X, p.y, texKey, 0).setOrigin(0, 0);
      this.chunkLastUsed.set(texKey, this.time.now);
    }

    // экранные координаты центра тела игрока — для «прояснения» деревьев
    const pp = worldToScreen(this.player.x, this.player.y, 0);
    const playerSX = pp.x;
    const playerSY = pp.y + TILE_H / 2 - 24;
    const playerDepthSum = this.player.x + this.player.y;

    // ── объекты: глубина со сдвигом +1024, чтобы не было отрицательных ──
    const DEPTH_OFFSET = 1024;

    for (let y = pcy - R; y <= pcy + R; y++) {
      for (let x = pcx - R; x <= pcx + R; x++) {
        const tile = WorldGen.getTile(x, y, WORLD_SEED);

        const stack = this.build.getStack(x, y);

        if (stack.length > 0) {
          stack.forEach((item, z) => {
            const oKey = `o${x}|${y}|${z}`;
            used.add(oKey);
            const sp = worldToScreen(x, y, z);
            this.pool
              .acquire(oKey, sp.x, sp.y + TILE_H, 'block_' + item, DEPTH_OFFSET + x + y + 0.5 + z * 0.01)
              .setOrigin(0.5, 1)
              .setScale(BLOCK_SCALE)
              .setAlpha(1);
          });
        } else if (tile.resource && !this.build.isHarvested(x, y)) {
          const oKey = `o${x}|${y}|0`;
          used.add(oKey);

          const isTree = tile.resource === 'tree';
          const scale = isTree
            ? Phaser.Math.Linear(TREE_MIN, TREE_MAX, hash2(x, y, 991))
            : Phaser.Math.Linear(ROCK_MIN, ROCK_MAX, hash2(x, y, 992));

          let ox = 0;
          const ht = this.hitTimes.get(oKey);
          if (ht !== undefined) {
            const age = this.time.now - ht;
            if (age < 250) {
              ox = Math.sin(age / 25) * 2;
            } else {
              this.hitTimes.delete(oKey);
            }
          }

          const p = worldToScreen(x, y, 0);

          // дерево, закрывающее игрока, становится полупрозрачным
          let alpha = 1;
          if (x + y >= Math.floor(playerDepthSum)) {
            const halfW = (isTree ? 24 : 20) * scale;
            const fullH = (isTree ? 56 : 24) * scale;
            const bottomY = p.y + TILE_H;

            if (
              playerSX > p.x + ox - halfW &&
              playerSX < p.x + ox + halfW &&
              playerSY > bottomY - fullH &&
              playerSY < bottomY
            ) {
              alpha = 0.35;
            }
          }

          this.pool
            .acquire(oKey, p.x + ox, p.y + TILE_H, isTree ? 'tree' : 'rock', DEPTH_OFFSET + x + y + 0.5)
            .setOrigin(0.5, 1)
            .setScale(scale)
            .setAlpha(alpha);
        }
      }
    }

    this.pool.flush(used);

    // ── выгрузка старых чанков ──
    this.evictTimer++;
    if (this.evictTimer >= 300) {
      this.evictTimer = 0;
      const now = this.time.now;
      for (const [texKey, t] of this.chunkLastUsed) {
        if (now - t > 15000) {
          this.textures.remove(texKey);
          this.chunkLastUsed.delete(texKey);
        }
      }
    }

    const p = worldToScreen(this.player.x, this.player.y, 0);
    this.playerSprite.setPosition(p.x, p.y + TILE_H / 2 + 4);
    this.playerSprite.setDepth(DEPTH_OFFSET + this.player.x + this.player.y + 0.5);
  }
}