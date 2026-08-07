import Phaser from 'phaser';
import { hash2 } from '../../core/rng';
import { Terrain } from '../../core/types';
import { ITEMS } from '../equipment/items';
import { Appearance, EquipmentSlot } from '../equipment/types';
import { css, shade, hashString, canvasFromPixelMap, drawRows } from './pixel';
import { TREE_ROWS, ROCK_ROWS, characterBaseRows, overlayRows } from './sprites';

const TILE_COLORS: Record<Terrain, { base: number; alt: number; edge: number; seed: number }> = {
  grass: { base: 0x4a8f3c, alt: 0x3f7a34, edge: 0x35662c, seed: 11 },
  sand: { base: 0xe0cf96, alt: 0xd3bf85, edge: 0xbfa871, seed: 22 },
  water: { base: 0x3f7ad1, alt: 0x3568b8, edge: 0x2c56a0, seed: 33 },
  stone: { base: 0x8d939c, alt: 0x7f8791, edge: 0x6d747d, seed: 44 },
  snow: { base: 0xf4f8ff, alt: 0xe2eaf6, edge: 0xcfd9ea, seed: 55 }
};

function diamond(gx: number, gy: number): number {
  return Math.abs(gx - 7.5) / 8 + Math.abs(gy - 3.5) / 4;
}

function addTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  const tex = scene.textures.addCanvas(key, canvas);

  if (tex) {
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

function makeIsoTile(scene: Phaser.Scene, key: string, c: { base: number; alt: number; edge: number; seed: number }): void {
  const px = 4;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      const d = diamond(gx, gy);
      if (d > 1) continue;

      let color = c.base;
      if (d > 0.82) color = c.edge;
      else if (hash2(gx, gy, c.seed) > 0.62) color = c.alt;

      ctx.fillStyle = css(color);
      ctx.fillRect(gx * px, gy * px, px, px);
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

  addTexture(scene, key, canvas);
}

export function createBaseTextures(scene: Phaser.Scene): void {
  for (const terrain of Object.keys(TILE_COLORS) as Terrain[]) {
    makeIsoTile(scene, 'tile_' + terrain, TILE_COLORS[terrain]);
  }

  addTexture(scene, 'tree', canvasFromPixelMap(TREE_ROWS, {
    G: css(0x2f8f3f),
    g: css(0x277534),
    T: css(0x6b4a2b)
  }, 4));

  addTexture(scene, 'rock', canvasFromPixelMap(ROCK_ROWS, {
    R: css(0x9aa2ad),
    r: css(0x7f8791)
  }, 4));

  makeBlock(scene, 'block_wood', 0xb08a54, 0xa37f4a, 0x8c6a3f, 0x77572f, 71);
  makeBlock(scene, 'block_stone', 0xb7bec8, 0xaab2bd, 0x828a95, 0x6d747d, 72);
}

export function getCharacterTexture(
  scene: Phaser.Scene,
  appearance: Appearance,
  spread: 0 | 1
): string {
  const keySource = [
    appearance.skin,
    spread,
    ...(['head', 'chest', 'legs', 'hands', 'feet'] as EquipmentSlot[])
      .map((s) => appearance.equipped[s] ?? '-')
  ].join('|');

  const key = 'char_' + hashString(keySource);
  if (scene.textures.exists(key)) return key;

  const canvas = canvasFromPixelMap(characterBaseRows(spread === 1), {
    S: css(appearance.skin),
    C: css(shade(appearance.skin, 0.92)),
    L: css(shade(appearance.skin, 0.8)),
    F: css(shade(appearance.skin, 0.7))
  }, 2);

  const ctx = canvas.getContext('2d')!;

  const order: EquipmentSlot[] = ['legs', 'feet', 'chest', 'hands', 'head'];
  for (const slot of order) {
    const id = appearance.equipped[slot];
    if (!id) continue;

    const def = ITEMS[id];
    drawRows(ctx, overlayRows(slot, spread === 1), {
      '1': css(def.primary),
      '2': css(def.secondary)
    }, 2);
  }

  addTexture(scene, key, canvas);
  return key;
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