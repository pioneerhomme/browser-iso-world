import { TileData, Terrain, ResourceKind } from '../../core/types';
import { fbm2 } from '../../core/noise';
import { hash2 } from '../../core/rng';

export class WorldGen {
  static getTile(x: number, y: number, seed: number): TileData {
    // Безопасная стартовая зона
    if (Math.abs(x) < 4 && Math.abs(y) < 4) {
      return {
        x,
        y,
        terrain: 'grass',
        resource: null
      };
    }

    const elevation = fbm2(x * 0.045, y * 0.045, seed, 4);
    const moisture = fbm2(x * 0.03 + 100, y * 0.03 - 100, seed + 7, 3);

    let terrain: Terrain;

    if (elevation < 0.36) {
      terrain = 'water';
    } else if (elevation < 0.42) {
      terrain = 'sand';
    } else if (elevation > 0.82) {
      terrain = 'snow';
    } else if (elevation > 0.7) {
      terrain = 'stone';
    } else {
      terrain = moisture < 0.38 ? 'sand' : 'grass';
    }

    let resource: ResourceKind = null;

    if (terrain === 'grass' && hash2(x, y, seed + 21) > 0.93) {
      resource = 'tree';
    }

    if (terrain === 'stone' && hash2(x, y, seed + 22) > 0.9) {
      resource = 'rock';
    }

    return {
      x,
      y,
      terrain,
      resource
    };
  }
}