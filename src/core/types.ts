export type Terrain =
  | 'water'
  | 'sand'
  | 'grass'
  | 'stone'
  | 'snow';

export type ResourceKind =
  | 'tree'
  | 'rock'
  | null;

export type ItemId =
  | 'wood'
  | 'stone';

export interface TileData {
  x: number;
  y: number;
  terrain: Terrain;
  resource: ResourceKind;
}