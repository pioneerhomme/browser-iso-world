import { Inventory } from '../inventory/Inventory';

export interface Recipe {
  id: string;
  name: string;
  inputs: Record<string, number>;
  output: { id: string; count: number };
  grid: string[]; // 3x3, '.' пусто, W дерево, S камень
}

export const RECIPES: Recipe[] = [
  { id: 'r_wood_block', name: 'Блок дерева', inputs: { wood: 2 }, output: { id: 'wood_block', count: 1 }, grid: ['WW.', 'WW.', '...'] },
  { id: 'r_stone_block', name: 'Блок камня', inputs: { stone: 2 }, output: { id: 'stone_block', count: 1 }, grid: ['SS.', 'SS.', '...'] },
  { id: 'r_bed', name: 'Кровать', inputs: { wood: 4, stone: 2 }, output: { id: 'bed', count: 1 }, grid: ['SS.', 'WW.', 'WW.'] },
  { id: 'r_axe', name: 'Топор', inputs: { wood: 2, stone: 2 }, output: { id: 'axe', count: 1 }, grid: ['SS.', 'WS.', 'W..'] },
  { id: 'r_pickaxe', name: 'Кирка', inputs: { wood: 2, stone: 3 }, output: { id: 'pickaxe', count: 1 }, grid: ['SSS', '.W.', '.W.'] }
];

export class CraftingSystem {
  constructor(private inventory: Inventory) {}

  canCraft(recipe: Recipe): boolean {
    return Object.entries(recipe.inputs).every(([item, count]) => this.inventory.get(item) >= count);
  }

  craft(recipe: Recipe): boolean {
    if (!this.canCraft(recipe)) return false;

    for (const [item, count] of Object.entries(recipe.inputs)) {
      this.inventory.remove(item, count);
    }
    this.inventory.add(recipe.output.id, recipe.output.count);
    return true;
  }
}