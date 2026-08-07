import { hash2 } from './rng';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function valueNoise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);

  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = x - x0;
  const sy = y - y0;

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);

  const ux = sx * sx * (3 - 2 * sx);
  const uy = sy * sy * (3 - 2 * sy);

  const top = lerp(n00, n10, ux);
  const bottom = lerp(n01, n11, ux);

  return lerp(top, bottom, uy);
}

export function fbm2(
  x: number,
  y: number,
  seed: number,
  octaves = 4
): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < octaves; i++) {
    value += valueNoise2(x * frequency, y * frequency, seed + i * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / total;
}