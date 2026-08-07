import { EquipItemDef } from './types';

export const ITEMS: Record<string, EquipItemDef> = {
  cap_leather: { id: 'cap_leather', name: 'Кожаная шапка', slot: 'head', primary: 0x8a5a33, secondary: 0x6d4526 },
  helm_iron: { id: 'helm_iron', name: 'Железный шлем', slot: 'head', primary: 0x9aa2ad, secondary: 0x6d747d },
  hood_green: { id: 'hood_green', name: 'Капюшон', slot: 'head', primary: 0x3f7a44, secondary: 0x2f5c34 },

  tunic_red: { id: 'tunic_red', name: 'Красная туника', slot: 'chest', primary: 0xb0483f, secondary: 0x7d322c },
  vest_leather: { id: 'vest_leather', name: 'Кожаный жилет', slot: 'chest', primary: 0x8a5a33, secondary: 0x6d4526 },
  shirt_blue: { id: 'shirt_blue', name: 'Синяя рубаха', slot: 'chest', primary: 0x3f6fb0, secondary: 0x2c4e7d },

  pants_brown: { id: 'pants_brown', name: 'Штаны', slot: 'legs', primary: 0x6b4a2b, secondary: 0x523820 },
  leggings_chain: { id: 'leggings_chain', name: 'Кольчужные поножи', slot: 'legs', primary: 0x8f97a2, secondary: 0x6d747d },

  gloves_cloth: { id: 'gloves_cloth', name: 'Тканевые перчатки', slot: 'hands', primary: 0xc9b98a, secondary: 0xa3946c },
  gloves_leather: { id: 'gloves_leather', name: 'Кожаные перчатки', slot: 'hands', primary: 0x8a5a33, secondary: 0x6d4526 },

  boots_leather: { id: 'boots_leather', name: 'Кожаные ботинки', slot: 'feet', primary: 0x7a4a2a, secondary: 0x5c371f },
  boots_iron: { id: 'boots_iron', name: 'Латные сапоги', slot: 'feet', primary: 0x9aa2ad, secondary: 0x6d747d },
  sandals: { id: 'sandals', name: 'Сандалии', slot: 'feet', primary: 0xc9a86a, secondary: 0xa3854e }
};

export const STARTER_ITEMS: string[] = [
  'cap_leather', 'helm_iron', 'hood_green',
  'tunic_red', 'vest_leather', 'shirt_blue',
  'pants_brown', 'leggings_chain',
  'gloves_cloth', 'gloves_leather',
  'boots_leather', 'boots_iron', 'sandals'
];