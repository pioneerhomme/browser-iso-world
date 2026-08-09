import Phaser from 'phaser';
import { hash2 } from '../../core/rng';
import { ITEMS } from '../equipment/items';
import { EquipmentSlot } from '../equipment/types';
import { css, shade, hashString, canvasFromPixelMap, drawRows } from './pixel';
import { TREE_ROWS, ROCK_ROWS, BED_ROWS, AXE_ROWS, PICKAXE_ROWS, overlayRows } from './sprites';

function addTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  const tex = scene.textures.addCanvas(key, canvas);

  if (tex) {
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

function addSpriteWithShadow(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  palette: Record<string, string>,
  px: number
): void {
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w * px;
  canvas.height = rows.length * px + 4;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height - 3, canvas.width * 0.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  drawRows(ctx, rows, palette, px);
  addTexture(scene, key, canvas);
}

function addOutlineTexture(scene: Phaser.Scene, key: string, rows: string[], px: number): void {
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w * px;
  canvas.height = rows.length * px + 4;
  const ctx = canvas.getContext('2d')!;

  const solid = (x: number, y: number): boolean =>
    y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';

  ctx.fillStyle = '#ffef9f';

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x + 1, y) || !solid(x - 1, y) || !solid(x, y + 1) || !solid(x, y - 1)) {
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
  }

  addTexture(scene, key, canvas);
}

function makeBlock(
  scene: Phaser.Scene,
  key: string,
  top: number,
  topAlt: number,
  left: number,
  right: number,
  seed: number
): void {
  const px = 4;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 52;
  const ctx = canvas.getContext('2d')!;

  const diamond = (gx: number, gy: number): number =>
    Math.abs(gx - 7.5) / 8 + Math.abs(gy - 3.5) / 4;

  for (let gy = 0; gy < 13; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      let color: number | null = null;

      if (diamond(gx, gy) <= 1) {
        color = hash2(gx, gy, seed) > 0.6 ? topAlt : top;
      } else if (diamond(gx, gy - 5) <= 1) {
        color = gx < 8 ? left : right;
      }

      if (color === null) continue;
      ctx.fillStyle = css(color);
      ctx.fillRect(gx * px, gy * px, px, px);
    }
  }

  ctx.lineWidth = 1;

  ctx.strokeStyle = css(shade(top, 1.3));
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(32, 0);
  ctx.lineTo(64, 16);
  ctx.stroke();

  ctx.strokeStyle = css(shade(top, 0.75));
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(32, 32);
  ctx.lineTo(64, 16);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, 36);
  ctx.lineTo(32, 52);
  ctx.lineTo(64, 36);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(32, 52);
  ctx.stroke();

  addTexture(scene, key, canvas);
}

export function createBaseTextures(scene: Phaser.Scene): void {
  addSpriteWithShadow(scene, 'tree', TREE_ROWS, {
    G: css(0x2f8f3f),
    g: css(0x277534),
    T: css(0x6b4a2b),
    h: css(0x4fb35f),
    d: css(0x1e5c2b)
  }, 4);

  addSpriteWithShadow(scene, 'rock', ROCK_ROWS, {
    R: css(0x9aa2ad),
    r: css(0x7f8791),
    h: css(0xc4ccd6),
    d: css(0x5d646d)
  }, 4);

  addOutlineTexture(scene, 'outline_tree', TREE_ROWS, 4);
  addOutlineTexture(scene, 'outline_rock', ROCK_ROWS, 4);

  makeBlock(scene, 'block_wood', 0xb08a54, 0xa37f4a, 0x8c6a3f, 0x77572f, 71);
  makeBlock(scene, 'block_stone', 0xb7bec8, 0xaab2bd, 0x828a95, 0x6d747d, 72);

  addTexture(scene, 'spark', canvasFromPixelMap(['11', '11'], { '1': '#ffe9a8' }, 2));

    addTexture(scene, 'icon_axe', canvasFromPixelMap(AXE_ROWS, {
    M: css(0x9aa2ad),
    T: css(0x6b4a2b)
  }, 3));

  addTexture(scene, 'icon_pickaxe', canvasFromPixelMap(PICKAXE_ROWS, {
    M: css(0x9aa2ad),
    T: css(0x6b4a2b)
  }, 3));

  addSpriteWithShadow(scene, 'bed', BED_ROWS, {
    W: css(0xf2f2f2),
    R: css(0xb0483f),
    B: css(0x6b4a2b)
  }, 4);
}

export function getItemIconTexture(scene: Phaser.Scene, itemId: string): string {
  const def = ITEMS[itemId];
  const key = 'icon_' + def.id;
  if (scene.textures.exists(key)) return key;

  const canvas = canvasFromPixelMap(overlayRows(def.slot, false), {
    '1': css(def.primary),
    '2': css(def.secondary)
  }, 2);

  addTexture(scene, key, canvas);
  return key;
}