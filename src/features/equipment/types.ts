export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'hands' | 'feet';

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['head', 'chest', 'legs', 'hands', 'feet'];

export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Голова',
  chest: 'Торс',
  legs: 'Ноги',
  hands: 'Перчатки',
  feet: 'Обувь'
};

export interface EquipItemDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  primary: number;
  secondary: number;
}

export interface Appearance {
  skin: number;
  equipped: Record<EquipmentSlot, string | null>;
}