export type ItemKind = 'resource' | 'tool' | 'placeable';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  placeTexture?: string;
  stackMax: number;
}

export const ITEM_DEFS: Record<string, ItemDef> = {
  wood: { id: 'wood', name: 'Дерево', kind: 'resource', stackMax: 999 },
  stone: { id: 'stone', name: 'Камень', kind: 'resource', stackMax: 999 },
  axe: { id: 'axe', name: 'Топор', kind: 'tool', stackMax: 1 },
  pickaxe: { id: 'pickaxe', name: 'Кирка', kind: 'tool', stackMax: 1 },
  wood_block: { id: 'wood_block', name: 'Блок дерева', kind: 'placeable', placeTexture: 'block_wood', stackMax: 999 },
  stone_block: { id: 'stone_block', name: 'Блок камня', kind: 'placeable', placeTexture: 'block_stone', stackMax: 999 },
  bed: { id: 'bed', name: 'Кровать', kind: 'placeable', placeTexture: 'bed', stackMax: 99 }
};

export const HOTBAR_ITEMS = ['wood_block', 'stone_block', 'bed'];