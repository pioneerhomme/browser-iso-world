import { ItemId, TileData } from '../../core/types';
import { Inventory } from '../inventory/Inventory';
import { MAX_STACK } from '../../core/constants';

const REGROW_MS = 90_000;
const YIELD = 3;

export class BuildManager {
  private placed = new Map<string, ItemId>();
  private harvested = new Map<string, number>();

  private key3(x: number, y: number, z: number): string {
    return `${x}|${y}|${z}`;
  }

  private key2(x: number, y: number): string {
    return `${x}|${y}`;
  }

  getStack(x: number, y: number): ItemId[] {
    const stack: ItemId[] = [];
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

  canPlaceAt(tile: TileData, x: number, y: number): boolean {
    if (this.topZ(x, y) > 0) return true;
    if (tile.terrain === 'water') return false;
    if (tile.resource && !this.isHarvested(x, y)) return false;
    return true;
  }

  place(x: number, y: number, item: ItemId): boolean {
    const z = this.topZ(x, y);
    if (z >= MAX_STACK) return false;

    this.placed.set(this.key3(x, y, z), item);
    return true;
  }

  removeTop(x: number, y: number, inventory: Inventory): boolean {
    const z = this.topZ(x, y) - 1;
    if (z < 0) return false;

    const item = this.placed.get(this.key3(x, y, z))!;
    this.placed.delete(this.key3(x, y, z));
    inventory.add(item, 1);
    return true;
  }

  harvest(x: number, y: number, tile: TileData, inventory: Inventory): boolean {
    const k = this.key2(x, y);

    if (!tile.resource || this.isHarvested(x, y)) return false;

    this.harvested.set(k, Date.now());

    if (tile.resource === 'tree') {
      inventory.add('wood', YIELD);
    } else {
      inventory.add('stone', YIELD);
    }

    return true;
  }

  serialize(): { placed: Record<string, ItemId>; harvested: Record<string, number> } {
    const harvested: Record<string, number> = {};
    this.harvested.forEach((t, k) => {
      harvested[k] = t;
    });

    return {
      placed: Object.fromEntries(this.placed),
      harvested
    };
  }

  restore(placed: Record<string, ItemId>, harvested: Record<string, number>): void {
    this.placed = new Map(Object.entries(placed));
    this.harvested = new Map(Object.entries(harvested));
  }
}