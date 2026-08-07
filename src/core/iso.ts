import { TILE_W, TILE_H, TILE_Z } from './constants';

export function worldToScreen(x: number, y: number, z = 0) {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2) - z * TILE_Z
  };
}

export function screenToWorld(px: number, py: number, z = 0) {
  const adjustedY = py + z * TILE_Z;

  const gx = px / (TILE_W / 2);
  const gy = adjustedY / (TILE_H / 2);

  return {
    x: Math.floor((gx + gy) / 2),
    y: Math.floor((gy - gx) / 2)
  };
}