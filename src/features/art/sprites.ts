import { EquipmentSlot } from '../equipment/types';

export const TREE_ROWS = [
  '.....hh.....',
  '....hGGG....',
  '...hGGGGd...',
  '..hGGgGGGd..',
  '...GGGGGd...',
  '....GGGd....',
  '...GGGGGd...',
  '..GGGgGGdd..',
  '.hGGGGGGGdd.',
  '..GGGGGGdd..',
  '....TT......',
  '....TTd.....',
  '....TT......',
  '...TTTT.....'
];

export const ROCK_ROWS = [
  '...hhRR...',
  '..hRRRRd..',
  '.hRrRRRdd.',
  '.RRRRrRdd.',
  '..RRRRdd..',
  '...RRdd...'
];

export function characterBaseRows(spread: boolean): string[] {
  return [
    '....SSSS....',
    '....SSSS....',
    '....SSSS....',
    '....SSSS....',
    '..SSSSSSSS..',
    '..SSCCCCSS..',
    '..SSCCCCSS..',
    '..SSCCCCSS..',
    '..SSCCCCSS..',
    spread ? '...LL..LL...' : '....LLLL....',
    '....LLLL....',
    '....LLLL....',
    '....LLLL....',
    spread ? '...LL..LL...' : '....LLLL....',
    spread ? '..FF....FF..' : '...FF..FF...',
    spread ? '..FF....FF..' : '...FF..FF...'
  ];
}

export function overlayRows(slot: EquipmentSlot, spread: boolean): string[] {
  const out: string[] = Array(16).fill('............');
  const set = (i: number, r: string) => { out[i] = r; };

  switch (slot) {
    case 'head':
      set(0, '....1111....');
      set(1, '...111111...');
      set(2, '...111111...');
      set(3, '...222222...');
      break;
    case 'chest':
      set(4, '..11111111..');
      set(5, '..11111111..');
      set(6, '..11111111..');
      set(7, '..11111111..');
      set(8, '..22222222..');
      break;
    case 'hands':
      set(7, '..11....11..');
      set(8, '..11....11..');
      break;
    case 'legs':
      set(9, spread ? '...11..11...' : '....1111....');
      set(10, spread ? '...11..11...' : '....1111....');
      set(11, '....1111....');
      set(12, '....1111....');
      set(13, spread ? '...11..11...' : '....1111....');
      break;
    case 'feet':
      set(14, spread ? '..11....11..' : '...11..11...');
      set(15, spread ? '..11....11..' : '...11..11...');
      break;
  }

  return out;
}