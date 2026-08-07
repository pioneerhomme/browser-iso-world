import { Inventory } from '../inventory/Inventory';

export class CraftingSystem {
  constructor(private inventory: Inventory) {}

  craftWoodToStone(): boolean {
    if (this.inventory.get('wood') < 2) {
      return false;
    }

    this.inventory.remove('wood', 2);
    this.inventory.add('stone', 1);

    return true;
  }
}