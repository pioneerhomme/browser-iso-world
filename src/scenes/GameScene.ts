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
import { WorldGen } from '../features/world/WorldGen';
import { Inventory } from '../features/inventory/Inventory';
import { BuildManager } from '../features/building/BuildManager';
import { CraftingSystem, RECIPES, Recipe } from '../features/crafting/CraftingSystem';
import { Hud } from '../ui/Hud';
import { Appearance } from '../features/equipment/types';
import { getHeroTexture, HeroFacing } from '../features/art/CharacterSprites';
import { SaveSystem } from '../features/save/SaveSystem';
import { SpritePool } from '../features/render/SpritePool';
import {
  ToolId,
  TOOL_FOR_RESOURCE,
  TOOL_LABELS,
  STARTER_TOOLS,
  TOOL_MAX_DURABILITY
} from '../features/tools/ToolsSystem';
import { HarvestProgress, HITS_REQUIRED } from '../features/harvest/HarvestProgress';
import { getChunkTexture, CHUNK, CHUNK_OFF_X } from '../features/render/ChunkTerrain';
import { ITEM_DEFS, HOTBAR_ITEMS } from '../features/items/ItemCatalog';
import {
  TIME_SCALE,
  DAY_START,
  PASS_OUT,
  MAX_ENERGY,
  COST,
  formatClock,
  darknessAlpha
} from '../features/time/TimeSystem';

type Facing = 'down' | 'up' | 'left' | 'right' | 'downright' | 'downleft' | 'upright' | 'upleft';

export class GameScene extends Phaser.Scene {
  private hud!: Hud;
  private pool!: SpritePool;

  private inventory!: Inventory;
  private build = new BuildManager();
  private crafting!: CraftingSystem;
  private harvestProgress = new HarvestProgress();

  private tools: ToolId[] = [...STARTER_TOOLS];
  private toolDurability: Record<string, number> = { axe: TOOL_MAX_DURABILITY, pickaxe: TOOL_MAX_DURABILITY };

  private player = { x: 0, y: 0, speed: 4.5 };

  private appearance: Appearance = {
    skin: 0xf2c79a,
    equipped: { head: null, chest: null, legs: null, hands: null, feet: null }
  };

  private playerSprite!: Phaser.GameObjects.Image;
  private facing: Facing = 'down';
  private animTimer = 0;
  private animIndex = 0;
  private moving = false;

  private zoom = DEFAULT_ZOOM;
  private targetZoom = DEFAULT_ZOOM;

  private hitTimes = new Map<string, number>();
  private chunkLastUsed = new Map<string, number>();
  private evictTimer = 0;

  private hoverTarget: { x: number; y: number } | null = null;

  // minecraft-взаимодействие
  private placeMode = false;
  private selectedSlot = 0;

  // призрачный превью-блок
  private ghost!: Phaser.GameObjects.Image;
  private ghostCell!: Phaser.GameObjects.Image;
  private lastPointer: { x: number; y: number } | null = null;
  private swingSprite: Phaser.GameObjects.Image | null = null;

  private saveTimer = 0;
  private clockTimer = 0;

  private day = 1;
  private timeMin = DAY_START;
  private energy = MAX_ENERGY;
  private sleeping = false;
  private nightOverlay!: Phaser.GameObjects.Rectangle;

  private inventoryOpen = false;
  private invUI: Array<
    Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text | Phaser.GameObjects.Image
  > = [];
  private invWoodText!: Phaser.GameObjects.Text;
  private invStoneText!: Phaser.GameObjects.Text;
  private invAxeText!: Phaser.GameObjects.Text;
  private invPickText!: Phaser.GameObjects.Text;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  private keyW?: Phaser.Input.Keyboard.Key;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;

  private keyCraft?: Phaser.Input.Keyboard.Key;
  private keyOne?: Phaser.Input.Keyboard.Key;
  private keyTwo?: Phaser.Input.Keyboard.Key;
  private keyThree?: Phaser.Input.Keyboard.Key;
  private keyInv?: Phaser.Input.Keyboard.Key;
  private keySleep?: Phaser.Input.Keyboard.Key;

  private onVisibility = (): void => {
    if (document.hidden) {
      this.persist();
    }
  };

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.children.removeAll(true);

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
      this.toolDurability = { ...this.toolDurability, ...(save.toolDurability ?? {}) };

      this.day = save.day;
      this.timeMin = save.timeMin;
      this.energy = save.energy;
    } else {
      // стартовая кровать в мире
      this.build.place(2, 2, 'bed');
    }

    this.pool = new SpritePool(this);

    this.playerSprite = this.add.image(0, 0, getHeroTexture(this, this.appearance, 'down', 0, this.heldTool()));
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.setScale(CHAR_SCALE);

    this.nightOverlay = this.add.rectangle(-1000, -1000, 8000, 6000, 0x0a1030);
    this.nightOverlay.setOrigin(0, 0);
    this.nightOverlay.setScrollFactor(0);
    this.nightOverlay.setDepth(4000);
    this.nightOverlay.setAlpha(darknessAlpha(this.timeMin));

    // текстура-рамка клетки
    if (!this.textures.exists('cell_highlight')) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 32;
      const ctx = c.getContext('2d')!;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(32, 1);
      ctx.lineTo(62, 16);
      ctx.lineTo(32, 31);
      ctx.lineTo(2, 16);
      ctx.closePath();
      ctx.stroke();

      const t = this.textures.addCanvas('cell_highlight', c);
      if (t) t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.ghostCell = this.add.image(0, 0, 'cell_highlight');
    this.ghostCell.setOrigin(0.5, 0);
    this.ghostCell.setAlpha(0.4);
    this.ghostCell.setVisible(false);

    this.ghost = this.add.image(0, 0, 'block_wood');
    this.ghost.setOrigin(0.5, 1);
    this.ghost.setAlpha(0.5);
    this.ghost.setVisible(false);

    const keyboard = this.input.keyboard;

    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();

      this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

      this.keyCraft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
      this.keyOne = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      this.keyTwo = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.keyThree = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
      this.keyInv = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
      this.keySleep = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }

    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.lastPointer = { x: pointer.x, y: pointer.y };
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.hoverTarget = this.findResourceTarget(world.x, world.y);
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.adjustZoom(dy > 0 ? -0.15 : 0.15);
    });

    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onVisibility);
    });

    this.buildInventoryUI();

    this.hud = new Hud({
      onTogglePlace: () => this.togglePlaceMode(),
      onToggleInventory: () => this.toggleInventory(),
      onZoomIn: () => this.adjustZoom(0.25),
      onZoomOut: () => this.adjustZoom(-0.25),
      onSelectSlot: (i) => {
        this.selectedSlot = i;
        this.refreshHotbar();
        this.updateHud();
      }
    });

    this.updateHud();
    this.refreshHotbar();
    this.hud.setClock(`День ${this.day}, ${formatClock(this.timeMin)}`);
    this.hud.setEnergy(this.energy / MAX_ENERGY);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);

    if (!this.sleeping) {
      this.timeMin += dt * TIME_SCALE;
      if (this.timeMin >= PASS_OUT) {
        this.doSleep(true);
      }
      this.nightOverlay.setAlpha(darknessAlpha(this.timeMin));

      this.clockTimer += dt;
      if (this.clockTimer >= 0.25) {
        this.clockTimer = 0;
        this.hud.setClock(`День ${this.day}, ${formatClock(this.timeMin)}`);
        this.hud.setEnergy(this.energy / MAX_ENERGY);
      }
    }

    if (this.keyOne && Phaser.Input.Keyboard.JustDown(this.keyOne)) this.selectSlot(0);
    if (this.keyTwo && Phaser.Input.Keyboard.JustDown(this.keyTwo)) this.selectSlot(1);
    if (this.keyThree && Phaser.Input.Keyboard.JustDown(this.keyThree)) this.selectSlot(2);
    if (this.keyInv && Phaser.Input.Keyboard.JustDown(this.keyInv)) this.toggleInventory();
    if (this.keySleep && Phaser.Input.Keyboard.JustDown(this.keySleep)) {
      const bed = this.build.findNearestBed(this.player.x, this.player.y, 2.5);
      if (bed) this.doSleep(false);
      else this.floatText(this.player.x, this.player.y, 'Нужна кровать рядом', '#ffffff');
    }

    if (Math.abs(this.targetZoom - this.zoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);
    } else {
      this.zoom = this.targetZoom;
    }

    this.updateMovement(dt);

    this.build.deferRegrowth(Math.floor(this.player.x), Math.floor(this.player.y));

    this.updateCamera();
    this.renderWorld();
    this.updateGhost();
    this.updateWalkAnimation(dt);

    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.persist();
    }
  }

  // ── сон/энергия ──

  private spendEnergy(amount: number): boolean {
    if (this.energy < amount) {
      this.floatText(this.player.x, this.player.y, 'Нет сил! Поспи', '#ff8080');
      return false;
    }
    this.energy -= amount;
    return true;
  }

  private doSleep(passOut: boolean): void {
    if (this.sleeping) return;
    this.sleeping = true;

    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.day += 1;
      this.timeMin = DAY_START;
      this.energy = passOut ? Math.floor(MAX_ENERGY * 0.7) : MAX_ENERGY;

      this.persist();
      this.updateHud();
      this.hud.setClock(`День ${this.day}, ${formatClock(this.timeMin)}`);
      this.hud.setEnergy(this.energy / MAX_ENERGY);

      this.cameras.main.fadeIn(600);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.sleeping = false;
        this.floatText(
          this.player.x,
          this.player.y,
          passOut ? 'Отключка! Силы 70%' : 'Новый день!',
          passOut ? '#ff8080' : '#9ff09a'
        );
      });
    });
  }

  // ── хотбар и режимы ──

  private selectSlot(i: number): void {
    this.selectedSlot = i;
    this.refreshHotbar();
    this.updateHud();
  }

  private togglePlaceMode(): void {
    this.placeMode = !this.placeMode;
    this.updateHud();
  }

  private refreshHotbar(): void {
    this.hud.setHotbar(
      HOTBAR_ITEMS.map((id, i) => ({
        label: ITEM_DEFS[id].name,
        count: this.inventory.get(id),
        selected: i === this.selectedSlot
      }))
    );
  }

  private heldTool(): ToolId | null {
    if (this.tools.includes('axe')) return 'axe';
    if (this.tools.includes('pickaxe')) return 'pickaxe';
    return null;
  }

  // ── взаимодействие в стиле Minecraft ──

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tilePos = screenToWorld(world.x, world.y, 0);

    const wantPlace = pointer.rightButtonDown() || this.placeMode;

    if (wantPlace) {
      this.tryPlace(tilePos.x, tilePos.y);
      return;
    }

    // ЛКМ: кровать рядом — спать, иначе сломать; ресурс — рубить; блок — сломать
    const stack = this.build.getStack(tilePos.x, tilePos.y);

    if (stack.length > 0) {
      const topItem = stack[stack.length - 1];

      if (topItem === 'bed') {
        const d = Math.hypot(tilePos.x + 0.5 - this.player.x, tilePos.y + 0.5 - this.player.y);
        if (d <= 2.5) {
          this.doSleep(false);
          return;
        }
      }

      this.tryBreak(tilePos.x, tilePos.y);
      return;
    }

    const target = this.findResourceTarget(world.x, world.y);
    this.hoverTarget = target;
    if (target) {
      this.tryHarvest(target.x, target.y);
    }
  }

  private tryPlace(x: number, y: number): void {
    if (Math.round(this.player.x) === x && Math.round(this.player.y) === y) return;

    const itemId = HOTBAR_ITEMS[this.selectedSlot];
    if (this.inventory.get(itemId) <= 0) {
      this.floatText(x + 0.5, y + 0.5, 'Нет предмета — скрафти', '#ff8080');
      return;
    }

    const tile = WorldGen.getTile(x, y, WORLD_SEED);
    if (!this.build.canPlaceAt(tile, x, y, itemId)) return;

    if (this.build.place(x, y, itemId)) {
      this.playSwing(ITEM_DEFS[itemId].placeTexture ?? 'block_wood');
      this.inventory.remove(itemId, 1);
      this.refreshHotbar();
      if (this.inventoryOpen) this.refreshInventoryUI();
      this.persist();
    }
  }

    private tryBreak(x: number, y: number): void {
    if (this.build.topZ(x, y) <= 0) return;

    const item = this.build.removeTop(x, y);
    if (item) {
      const tool = this.heldTool();
      this.playSwing(tool === 'axe' ? 'icon_axe' : tool === 'pickaxe' ? 'icon_pickaxe' : 'spark');
      this.inventory.add(item, 1);
      this.floatText(x + 0.5, y + 0.5, `+ ${ITEM_DEFS[item]?.name ?? item}`, '#9ff09a');
      this.refreshHotbar();
      if (this.inventoryOpen) this.refreshInventoryUI();
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

    if (!this.spendEnergy(tile.resource === 'tree' ? COST.chop : COST.mine)) return;

    const oKey = `o${x}|${y}|0`;
    this.hitTimes.set(oKey, this.time.now);
    this.spawnHitFx(x, y);
    this.playSwing(tool === 'axe' ? 'icon_axe' : 'icon_pickaxe');

    const hits = this.harvestProgress.hit(x, y);

    const dur = (this.toolDurability[tool] ?? 1) - 1;
    this.toolDurability[tool] = dur;

    if (dur <= 0) {
      this.tools = this.tools.filter((t) => t !== tool);
      delete this.toolDurability[tool];
      this.floatText(x + 0.5, y + 0.5, TOOL_LABELS[tool] + ' сломался!', '#ff8080');
      if (this.inventoryOpen) this.refreshInventoryUI();
    }

    if (hits >= HITS_REQUIRED) {
      this.harvestProgress.clear(x, y);
      this.hitTimes.delete(oKey);
      this.build.harvest(x, y, tile, this.inventory);
      this.floatText(x + 0.5, y + 0.5, tile.resource === 'tree' ? '+3 дерева' : '+3 камня', '#9ff09a');

      if (this.hoverTarget && this.hoverTarget.x === x && this.hoverTarget.y === y) {
        this.hoverTarget = null;
      }

      this.updateHud();
      if (this.inventoryOpen) this.refreshInventoryUI();
      this.persist();
    } else {
      this.floatText(x + 0.5, y + 0.5, `${hits}/${HITS_REQUIRED}`, '#ffffff');
    }
  }

    // ── взмах при действиях ──

  private playSwing(texture: string): void {
    if (this.swingSprite) {
      this.swingSprite.destroy();
      this.swingSprite = null;
    }

    const p = worldToScreen(this.player.x, this.player.y, 0);
    const left =
      this.facing === 'left' || this.facing === 'downleft' || this.facing === 'upleft';
    const dirX = left ? -1 : 1;

    const s = this.add.image(p.x + 10 * dirX, p.y - 14, texture);
    s.setOrigin(0.5, 0.8);
    s.setDepth(1024 + this.player.x + this.player.y + 0.6);
    s.setAlpha(0.95);
    s.setFlipX(left);
    s.setRotation(left ? 1.1 : -1.1);

    this.tweens.add({
      targets: s,
      rotation: left ? -1.1 : 1.1,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => {
        s.destroy();
        if (this.swingSprite === s) this.swingSprite = null;
      }
    });

    this.swingSprite = s;
  }

    // ── призрак перед установкой ──

  private updateGhost(): void {
    const show = this.lastPointer !== null && !this.inventoryOpen && !this.sleeping;

    if (!show) {
      this.ghost.setVisible(false);
      this.ghostCell.setVisible(false);
      return;
    }

    const world = this.cameras.main.getWorldPoint(this.lastPointer!.x, this.lastPointer!.y);
    const tilePos = screenToWorld(world.x, world.y, 0);
    const hx = tilePos.x;
    const hy = tilePos.y;

    const itemId = HOTBAR_ITEMS[this.selectedSlot];
    const def = ITEM_DEFS[itemId];
    const tile = WorldGen.getTile(hx, hy, WORLD_SEED);

    const z = itemId === 'bed' ? 0 : this.build.topZ(hx, hy);

    const valid =
      this.build.canPlaceAt(tile, hx, hy, itemId) &&
      this.inventory.get(itemId) > 0 &&
      !(Math.round(this.player.x) === hx && Math.round(this.player.y) === hy);

    const p = worldToScreen(hx, hy, z);

    this.ghostCell.setPosition(p.x, p.y);
    this.ghostCell.setDepth(1024 + hx + hy + 0.4);
    this.ghostCell.setVisible(true);

    this.ghost.setTexture(def.placeTexture ?? 'block_wood');
    this.ghost.setPosition(p.x, p.y + TILE_H);
    this.ghost.setScale(itemId === 'bed' ? 1 : BLOCK_SCALE);
    this.ghost.setDepth(1024 + hx + hy + 0.5 + z * 0.01 + 0.001);
    this.ghost.setTint(valid ? 0x69f0ae : 0xff5555);
    this.ghost.setVisible(true);
  }

  // ── инвентарь + крафт ──

  private buildInventoryUI(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const pw = 400;
    const ph = 480;
    const x0 = (w - pw) / 2;
    const y0 = (h - ph) / 2;

    type UIObj = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text | Phaser.GameObjects.Image;

    const ui = (o: UIObj): UIObj => {
      o.setScrollFactor(0);
      o.setDepth(5000);
      o.setVisible(false);
      this.invUI.push(o);
      return o;
    };

    ui(this.add.rectangle(x0 + pw / 2, y0 + ph / 2, pw, ph, 0x10141c, 0.95).setStrokeStyle(2, 0x3a4a6a));
    ui(this.add.text(x0 + 16, y0 + 12, 'Инвентарь и крафт', { fontSize: '20px', color: '#ffffff' }));

    this.invWoodText = this.add.text(x0 + 16, y0 + 48, '', { fontSize: '15px', color: '#cfd6e6' });
    ui(this.invWoodText);
    this.invStoneText = this.add.text(x0 + 200, y0 + 48, '', { fontSize: '15px', color: '#cfd6e6' });
    ui(this.invStoneText);

    this.invAxeText = this.add.text(x0 + 16, y0 + 74, '', { fontSize: '15px', color: '#cfd6e6' });
    ui(this.invAxeText);
    this.invPickText = this.add.text(x0 + 200, y0 + 74, '', { fontSize: '15px', color: '#cfd6e6' });
    ui(this.invPickText);

    // рецепты
    RECIPES.forEach((recipe, i) => {
      const ry = y0 + 110 + i * 70;

      // мини-сетка 3x3
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          const ch = recipe.grid[gy][gx];
          const color = ch === 'W' ? 0x8a5a33 : ch === 'S' ? 0x9aa2ad : 0x1a2233;
          ui(this.add.rectangle(x0 + 24 + gx * 16, ry + gy * 16, 14, 14, color).setStrokeStyle(1, 0x3a4a6a));
        }
      }

      const inputs = Object.entries(recipe.inputs)
        .map(([k, v]) => `${v} ${ITEM_DEFS[k].name.toLowerCase()}`)
        .join(' + ');

      ui(this.add.text(x0 + 84, ry, `${recipe.name}`, { fontSize: '15px', color: '#ffffff' }));
      ui(this.add.text(x0 + 84, ry + 20, inputs, { fontSize: '12px', color: '#9fb0cc' }));

      const btn = this.add.text(x0 + pw - 96, ry + 8, 'Создать', {
        fontSize: '14px', color: '#9ff09a', backgroundColor: '#1d2a1d', padding: { left: 10, right: 10, top: 6, bottom: 6 }
      }).setInteractive({ useHandCursor: true });
      ui(btn);
      btn.on('pointerdown', () => this.craftRecipe(recipe));
    });

    const hint = this.add.text(x0 + 16, y0 + ph - 32, 'I — закрыть | ЛКМ ломать/рубить, ПКМ ставить', {
      fontSize: '13px', color: '#9fb0cc'
    });
    ui(hint);
  }

  private craftRecipe(recipe: Recipe): void {
    if (!this.crafting.craft(recipe)) {
      this.floatText(this.player.x, this.player.y, 'Не хватает ресурсов', '#ff8080');
      return;
    }

    const out = recipe.output.id;
    if (out === 'axe' || out === 'pickaxe') {
      const tool = out as ToolId;
      if (!this.tools.includes(tool)) this.tools.push(tool);
      this.toolDurability[tool] = TOOL_MAX_DURABILITY;
    }

    this.floatText(this.player.x, this.player.y, `+ ${ITEM_DEFS[out].name}`, '#9ff09a');
    this.refreshInventoryUI();
    this.refreshHotbar();
    this.updateHud();
    this.persist();
  }

  private refreshInventoryUI(): void {
    this.invWoodText.setText(`Дерево: ${this.inventory.get('wood')}`);
    this.invStoneText.setText(`Камень: ${this.inventory.get('stone')}`);
    this.invAxeText.setText(
      this.tools.includes('axe') ? `Топор: ${this.toolDurability['axe'] ?? 0}/${TOOL_MAX_DURABILITY}` : 'Топор: нет'
    );
    this.invPickText.setText(
      this.tools.includes('pickaxe') ? `Кирка: ${this.toolDurability['pickaxe'] ?? 0}/${TOOL_MAX_DURABILITY}` : 'Кирка: нет'
    );
  }

  private toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    for (const o of this.invUI) {
      o.setVisible(this.inventoryOpen);
    }
    if (this.inventoryOpen) {
      this.refreshInventoryUI();
    }
  }

  // ── прочее ──

  private findResourceTarget(wx: number, wy: number): { x: number; y: number } | null {
    const direct = screenToWorld(wx, wy, 0);

    let best: { x: number; y: number; d: number } | null = null;

    for (let y = direct.y - 2; y <= direct.y + 18; y++) {
      for (let x = direct.x - 18; x <= direct.x + 18; x++) {
        const tile = WorldGen.getTile(x, y, WORLD_SEED);
        if (!tile.resource || this.build.isHarvested(x, y)) continue;

        const isTree = tile.resource === 'tree';
        const scale = isTree
          ? Phaser.Math.Linear(TREE_MIN, TREE_MAX, hash2(x, y, 991))
          : Phaser.Math.Linear(ROCK_MIN, ROCK_MAX, hash2(x, y, 992));

        const p = worldToScreen(x, y, 0);
        const halfW = (isTree ? 24 : 20) * scale;
        const fullH = (isTree ? 56 : 24) * scale;
        const bottom = p.y + TILE_H;

        if (wx >= p.x - halfW && wx <= p.x + halfW && wy >= bottom - fullH && wy <= bottom) {
          const d = x + y;
          if (!best || d > best.d) {
            best = { x, y, d };
          }
        }
      }
    }

    return best ? { x: best.x, y: best.y } : null;
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
      tools: this.tools,
      toolDurability: this.toolDurability,
      day: this.day,
      timeMin: Math.floor(this.timeMin),
      energy: Math.floor(this.energy)
    });
  }

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
      if (horizontal !== 0 && vertical !== 0) {
        this.facing = ((vertical < 0 ? 'up' : 'down') + (horizontal > 0 ? 'right' : 'left')) as Facing;
      } else if (horizontal !== 0) {
        this.facing = horizontal > 0 ? 'right' : 'left';
      } else {
        this.facing = vertical > 0 ? 'down' : 'up';
      }

      const stepX = (dx / length) * this.player.speed * dt;
      const stepY = (dy / length) * this.player.speed * dt;

      if (this.canStandAt(this.player.x + stepX, this.player.y)) {
        this.player.x += stepX;
      }
      if (this.canStandAt(this.player.x, this.player.y + stepY)) {
        this.player.y += stepY;
      }
    }
  }

  private updateWalkAnimation(dt: number): void {
    if (this.moving) {
      this.animTimer += dt;
      if (this.animTimer > 0.12) {
        this.animTimer = 0;
        this.animIndex = (this.animIndex + 1) % 4;
      }
    } else {
      this.animIndex = 0;
    }

    const frame = this.moving ? [1, 2, 3, 2][this.animIndex] : 0;

    let base: HeroFacing;
    let flip = false;

    switch (this.facing) {
      case 'left':
        base = 'right';
        flip = true;
        break;
      case 'downleft':
        base = 'downright';
        flip = true;
        break;
      case 'upleft':
        base = 'upright';
        flip = true;
        break;
      default:
        base = this.facing as HeroFacing;
        break;
    }

    const tex = getHeroTexture(this, this.appearance, base, frame, this.heldTool());

    if (this.playerSprite.texture.key !== tex) {
      this.playerSprite.setTexture(tex);
    }
    this.playerSprite.setFlipX(flip);
  }

  private updateCamera(): void {
    const cam = this.cameras.main;

    cam.setZoom(this.zoom);

    const p = worldToScreen(this.player.x, this.player.y, 0);
    cam.centerOn(p.x, p.y + TILE_H / 2);
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
    const selected = ITEM_DEFS[HOTBAR_ITEMS[this.selectedSlot]].name;
    const place = this.placeMode ? 'тап ставит' : 'тап ломает';

    this.hud.setPlaceMode(this.placeMode);

    this.hud.setInfo(
      `Слот: ${selected} | Режим моб.: ${place}\n` +
      `ЛКМ — ломать/рубить | ПКМ — поставить | 1-3 — слоты | I — крафт | E — спать\n` +
      `Зум: ${this.zoom.toFixed(2)}`
    );
  }

  private renderWorld(): void {
    const used = new Set<string>();
    const cam = this.cameras.main;

    const need =
      Math.ceil(
        (cam.width / (this.zoom * TILE_W) + cam.height / (this.zoom * TILE_H)) / 2
      ) + 4;
    const R = Math.min(need, RENDER_RADIUS_MAX);

    const pcx = Math.round(this.player.x);
    const pcy = Math.round(this.player.y);

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
      this.pool
        .acquire(cKey, p.x - CHUNK_OFF_X, p.y, texKey, 0)
        .setOrigin(0, 0)
        .setScale(1)
        .setAlpha(1);
      this.chunkLastUsed.set(texKey, this.time.now);
    }

    const DEPTH_OFFSET = 1024;

    const pp = worldToScreen(this.player.x, this.player.y, 0);
    const playerSX = pp.x;
    const playerSY = pp.y + TILE_H / 2 - 24;
    const playerDepthSum = this.player.x + this.player.y;

    for (let y = pcy - R; y <= pcy + R; y++) {
      for (let x = pcx - R; x <= pcx + R; x++) {
        const tile = WorldGen.getTile(x, y, WORLD_SEED);

        const stack = this.build.getStack(x, y);

        if (stack.length > 0) {
          stack.forEach((item, z) => {
            const def = ITEM_DEFS[item];
            const tex = def?.placeTexture ?? 'block_wood';
            const scale = item === 'bed' ? 1 : BLOCK_SCALE;

            const oKey = `o${x}|${y}|${z}`;
            used.add(oKey);
            const sp = worldToScreen(x, y, z);
            this.pool
              .acquire(oKey, sp.x, sp.y + TILE_H, tex, DEPTH_OFFSET + x + y + 0.5 + z * 0.01)
              .setOrigin(0.5, 1)
              .setScale(scale)
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

          let alpha = 1;
          if (x + y >= Math.floor(playerDepthSum)) {
            const halfW = (isTree ? 24 : 20) * scale;
            const fullH = (isTree ? 56 : 24) * scale;
            const bottom = p.y + TILE_H;

            if (
              playerSX > p.x + ox - halfW &&
              playerSX < p.x + ox + halfW &&
              playerSY > bottom - fullH &&
              playerSY < bottom
            ) {
              alpha = 0.35;
            }
          }

          this.pool
            .acquire(oKey, p.x + ox, p.y + TILE_H, isTree ? 'tree' : 'rock', DEPTH_OFFSET + x + y + 0.5)
            .setOrigin(0.5, 1)
            .setScale(scale)
            .setAlpha(alpha);

          if (this.hoverTarget && this.hoverTarget.x === x && this.hoverTarget.y === y) {
            const hKey = 'h' + x + '|' + y;
            used.add(hKey);
            this.pool
              .acquire(hKey, p.x + ox, p.y + TILE_H, isTree ? 'outline_tree' : 'outline_rock', DEPTH_OFFSET + x + y + 0.6)
              .setOrigin(0.5, 1)
              .setScale(scale)
              .setAlpha(1);
          }
        }
      }
    }

    this.pool.flush(used);

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
    this.playerSprite.setPosition(p.x, p.y + TILE_H / 2 + 2);
    this.playerSprite.setDepth(DEPTH_OFFSET + this.player.x + this.player.y + 0.5);
  }
}