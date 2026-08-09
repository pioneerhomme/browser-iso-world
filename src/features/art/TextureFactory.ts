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
  canvas.height = 56;
  const ctx = canvas.getContext('2d')!;

  const diamond = (gx: number, gy: number): number =>
    Math.abs(gx - 7.5) / 8 + Math.abs(gy - 3.5) / 4;

  // 0 пусто, 1 верх, 2 лево, 3 право
  const regionAt = (gx: number, gy: number): number => {
    if (diamond(gx, gy) <= 1) return 1;
    if (diamond(gx, gy - 6) <= 1) return gx < 8 ? 2 : 3;
    return 0;
  };

  for (let gy = 0; gy < 14; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      const region = regionAt(gx, gy);
      if (region === 0) continue;

      let color: number;

      if (region === 1) {
        color = hash2(gx, gy, seed) > 0.75 ? topAlt : top;
        if (regionAt(gx, gy - 1) === 0 || regionAt(gx - 1, gy) === 0) {
          color = shade(top, 1.25);
        }
      } else if (region === 2) {
        color = hash2(gx, gy, seed) > 0.75 ? shade(left, 0.9) : left;
        if (regionAt(gx, gy + 1) === 0) color = shade(left, 0.7);
      } else {
        color = hash2(gx, gy, seed) > 0.75 ? shade(right, 0.9) : right;
        if (regionAt(gx, gy + 1) === 0) color = shade(right, 0.7);
      }

      if (region === 3 && regionAt(gx - 1, gy) === 2) {
        color = shade(right, 0.8);
      }

      ctx.fillStyle = css(color);
      ctx.fillRect(gx * px, gy * px, px, px);
    }
  }

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

  function transposeRows(rows: string[]): string[] {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let line = '';
    for (let y = 0; y < h; y++) {
      line += rows[y][x] ?? '.';
    }
    out.push(line);
  }
  return out;
}

  addSpriteWithShadow(scene, 'rock', ROCK_ROWS, {
    R: css(0x9aa2ad),
    r: css(0x7f8791),
    h: css(0xc4ccd6),
    d: css(0x5d646d)
  }, 4);

  addOutlineTexture(scene, 'outline_tree', TREE_ROWS, 4);
  addOutlineTexture(scene, 'outline_rock', ROCK_ROWS, 4);

  makeBlock(scene, 'block_wood', 0xa3763f, 0x8f6534, 0x7c5a33, 0x5f4222, 71);
  makeBlock(scene, 'block_stone', 0x98a1ad, 0x8b95a1, 0x6f7885, 0x525b67, 72);

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

    addSpriteWithShadow(scene, 'bed_v', transposeRows(BED_ROWS), {
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