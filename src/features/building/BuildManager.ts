import { TileData } from '../../core/types';
import { Inventory } from '../inventory/Inventory';
import { ITEM_DEFS } from '../items/ItemCatalog';
import { MAX_STACK } from '../../core/constants';

const REGROW_MS = 90_000;

export class BuildManager {
  private placed = new Map<string, string>();
  private harvested = new Map<string, number>();

  private key3(x: number, y: number, z: number): string {
    return `${x}|${y}|${z}`;
  }

  private key2(x: number, y: number): string {
    return `${x}|${y}`;
  }

  getStack(x: number, y: number): string[] {
    const stack: string[] = [];
    for (let z = 0; z < MAX_STACK; z++) {
      const item = this.placed.get(this.key3(x, y, z));
      if (!item) break;
      stack.push(item);
    }
    return stack;
  }

  topZ(x: number, y: number): number {
    return this.getStack(x, y).length;
  }

  isHarvested(x: number, y: number): boolean {
    const k = this.key2(x, y);
    const t = this.harvested.get(k);

    if (t === undefined) return false;

    if (Date.now() - t >= REGROW_MS) {
      this.harvested.delete(k);
      return false;
    }

    return true;
  }

  deferRegrowth(x: number, y: number): void {
    const k = this.key2(x, y);
    if (this.harvested.has(k)) {
      this.harvested.set(k, Date.now());
    }
  }

  private groundOk(tile: TileData, x: number, y: number): boolean {
    if (tile.terrain === 'water') return false;
    if (tile.resource && !this.isHarvested(x, y)) return false;
    return true;
  }

  canPlaceAt(tile: TileData, x: number, y: number, itemId: string): boolean {
    const def = ITEM_DEFS[itemId];
    if (!def || def.kind !== 'placeable') return false;

    if (itemId === 'bed') {
      return this.topZ(x, y) === 0 && this.groundOk(tile, x, y);
    }

    if (this.topZ(x, y) >= MAX_STACK) return false;
    if (this.getStack(x, y)[0] === 'bed') return false;
    if (this.topZ(x, y) === 0 && !this.groundOk(tile, x, y)) return false;

    return true;
  }

  place(x: number, y: number, itemId: string): boolean {
    if (itemId === 'bed') {
      if (this.topZ(x, y) !== 0) return false;
      this.placed.set(this.key3(x, y, 0), itemId);
      return true;
    }

    const z = this.topZ(x, y);
    if (z >= MAX_STACK) return false;

    this.placed.set(this.key3(x, y, z), itemId);
    return true;
  }

  removeTop(x: number, y: number): string | null {
    const z = this.topZ(x, y) - 1;
    if (z < 0) return null;

    const item = this.placed.get(this.key3(x, y, z))!;
    this.placed.delete(this.key3(x, y, z));
    return item;
  }

  findNearestBed(x: number, y: number, radius: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = radius;

    for (const [key, item] of this.placed) {
      if (item !== 'bed') continue;
      const [bx, by] = key.split('|').map(Number);
      const d = Math.hypot(bx + 0.5 - x, by + 0.5 - y);
      if (d <= bestD) {
        bestD = d;
        best = { x: bx, y: by };
      }
    }

    return best;
  }

  harvest(x: number, y: number, tile: TileData, inventory: Inventory): boolean {
    const k = this.key2(x, y);

    if (!tile.resource || this.isHarvested(x, y)) return false;

    this.harvested.set(k, Date.now());

    if (tile.resource === 'tree') {
      inventory.add('wood', 3);
    } else {
      inventory.add('stone', 3);
    }

    return true;
  }

  serialize(): { placed: Record<string, string>; harvested: Record<string, number> } {
    const harvested: Record<string, number> = {};
    this.harvested.forEach((t, k) => {
      harvested[k] = t;
    });

    return {
      placed: Object.fromEntries(this.placed),
      harvested
    };
  }

  restore(placed: Record<string, string>, harvested: Record<string, number>): void {
    this.placed = new Map(Object.entries(placed));
    this.harvested = new Map(Object.entries(harvested));
  }
}