import { TileData, Terrain, ResourceKind } from '../../core/types';
import { fbm2 } from '../../core/noise';
import { hash2 } from '../../core/rng';

export class WorldGen {
  private static cache = new Map<string, TileData>();

  static getTile(x: number, y: number, seed: number): TileData {
    const k = x + '|' + y;
    const hit = WorldGen.cache.get(k);
    if (hit) return hit;

    let tile: TileData;

    if (Math.abs(x) < 4 && Math.abs(y) < 4) {
      tile = { x, y, terrain: 'grass', resource: null };
    } else {
      const elevation = fbm2(x * 0.045, y * 0.045, seed, 4);
      const moisture = fbm2(x * 0.03 + 100, y * 0.03 - 100, seed + 7, 3);

      let terrain: Terrain;

      if (elevation < 0.36) terrain = 'water';
      else if (elevation < 0.42) terrain = 'sand';
      else if (elevation > 0.82) terrain = 'snow';
      else if (elevation > 0.7) terrain = 'stone';
      else terrain = moisture < 0.38 ? 'sand' : 'grass';

      let resource: ResourceKind = null;

      if (terrain === 'grass' && hash2(x, y, seed + 21) > 0.93) resource = 'tree';
      if (terrain === 'stone' && hash2(x, y, seed + 22) > 0.9) resource = 'rock';

      tile = { x, y, terrain, resource };
    }

    if (WorldGen.cache.size > 100000) {
      WorldGen.cache.clear();
    }
    WorldGen.cache.set(k, tile);

    return tile;
  }
}