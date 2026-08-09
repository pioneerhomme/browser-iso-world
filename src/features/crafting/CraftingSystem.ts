import { Inventory } from '../inventory/Inventory';

export class CraftingSystem {
  constructor(private inventory: Inventory) {}

  craftWoodToStone(): boolean {
    if (this.inventory.get('wood') < 2) return false;
    this.inventory.remove('wood', 2);
    this.inventory.add('stone', 1);
    return true;
  }

  canCraftTool(): boolean {
    return this.inventory.get('wood') >= 3 && this.inventory.get('stone') >= 2;
  }

  craftAxe(): boolean {
    if (!this.canCraftTool()) return false;
    this.inventory.remove('wood', 3);
    this.inventory.remove('stone', 2);
    return true;
  }

  craftPickaxe(): boolean {
    if (!this.canCraftTool()) return false;
    this.inventory.remove('wood', 3);
    this.inventory.remove('stone', 2);
    return true;
  }
}