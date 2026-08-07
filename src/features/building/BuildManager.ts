import { ItemId, TileData } from '../../core/types';
import { Inventory } from '../inventory/Inventory';

export class BuildManager {
  private placed = new Map<string, ItemId>();
  private harvested = new Set<string>();

  private key(x: number, y: number): string {
    return `${x}|${y}`;
  }

  getPlaced(x: number, y: number): ItemId | undefined {
    return this.placed.get(this.key(x, y));
  }

  isHarvested(x: number, y: number): boolean {
    return this.harvested.has(this.key(x, y));
  }

  canPlaceAt(tile: TileData, x: number, y: number): boolean {
    if (tile.terrain === 'water') {
      return false;
    }

    if (this.placed.has(this.key(x, y))) {
      return false;
    }

    if (tile.resource && !this.harvested.has(this.key(x, y))) {
      return false;
    }

    return true;
  }

  place(x: number, y: number, item: ItemId): void {
    this.placed.set(this.key(x, y), item);
  }

  remove(x: number, y: number, inventory: Inventory): boolean {
    const k = this.key(x, y);
    const item = this.placed.get(k);

    if (!item) {
      return false;
    }

    this.placed.delete(k);
    inventory.add(item, 1);

    return true;
  }

  harvest(
    x: number,
    y: number,
    tile: TileData,
    inventory: Inventory
  ): boolean {
    const k = this.key(x, y);

    if (!tile.resource || this.harvested.has(k)) {
      return false;
    }

    this.harvested.add(k);

    if (tile.resource === 'tree') {
      inventory.add('wood', 2);
    } else {
      inventory.add('stone', 2);
    }

    return true;
  }
}