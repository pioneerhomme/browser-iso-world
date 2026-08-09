import Phaser from 'phaser';
import { TILE_W, TILE_H, WORLD_SEED } from '../../core/constants';
import { hash2 } from '../../core/rng';
import { Terrain } from '../../core/types';
import { WorldGen } from '../world/WorldGen';
import { css, shade } from '../art/pixel';

export const CHUNK = 16;
export const CHUNK_OFF_X = 256;

const CANVAS_W = 512;
const CANVAS_H = 256;
const PX = 4;

const COLORS: Record<Terrain, { base: number; alt: number; edge: number; seed: number }> = {
  grass: { base: 0x4a8f3c, alt: 0x3f7a34, edge: 0x35662c, seed: 11 },
  sand: { base: 0xe0cf96, alt: 0xd3bf85, edge: 0xbfa871, seed: 22 },
  water: { base: 0x3f7ad1, alt: 0x3568b8, edge: 0x2c56a0, seed: 33 },
  stone: { base: 0x8d939c, alt: 0x7f8791, edge: 0x6d747d, seed: 44 },
  snow: { base: 0xf4f8ff, alt: 0xe2eaf6, edge: 0xcfd9ea, seed: 55 }
};

export function getChunkTexture(scene: Phaser.Scene, cx: number, cy: number): string {
  const key = `chunk_${cx}_${cy}`;
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;

  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const wx = x0 + tx;
      const wy = y0 + ty;
      const tile = WorldGen.getTile(wx, wy, WORLD_SEED);
      const c = COLORS[tile.terrain];

      const lx = (tx - ty) * (TILE_W / 2) + CHUNK_OFF_X;
      const ly = (tx + ty) * (TILE_H / 2);

      ctx.fillStyle = css(c.base);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + TILE_W / 2, ly + TILE_H / 2);
      ctx.lineTo(lx, ly + TILE_H);
      ctx.lineTo(lx - TILE_W / 2, ly + TILE_H / 2);
      ctx.closePath();
      ctx.fill();

      // объём: светлые верхние грани, тёмные нижние
      ctx.lineWidth = 1;

      ctx.strokeStyle = css(shade(c.base, 1.3));
      ctx.beginPath();
      ctx.moveTo(lx - TILE_W / 2, ly + TILE_H / 2);
      ctx.lineTo(lx, ly);
      ctx.lineTo(lx + TILE_W / 2, ly + TILE_H / 2);
      ctx.stroke();

      ctx.strokeStyle = css(shade(c.base, 0.72));
      ctx.beginPath();
      ctx.moveTo(lx - TILE_W / 2, ly + TILE_H / 2);
      ctx.lineTo(lx, ly + TILE_H);
      ctx.lineTo(lx + TILE_W / 2, ly + TILE_H / 2);
      ctx.stroke();

      ctx.fillStyle = css(c.alt);
      for (let i = 0; i < 3; i++) {
        const dx = Math.floor(hash2(wx, wy, c.seed + i) * 5) - 2;
        const dy = Math.floor(hash2(wy, wx, c.seed + i) * 3) - 1;
        ctx.fillRect(lx + dx * PX - PX / 2, ly + TILE_H / 2 + dy * PX - PX / 2, PX, PX);
      }
    }
  }

  const tex = scene.textures.addCanvas(key, canvas);
  if (tex) {
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  return key;
}