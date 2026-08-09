import Phaser from 'phaser';
import { ITEMS } from '../equipment/items';
import { Appearance, EquipmentSlot } from '../equipment/types';
import { css, shade, hashString } from './pixel';

export type HeroFacing = 'down' | 'up' | 'right';

const W = 14;
const H = 20;
const PX = 2;

interface Colors {
  skin: number;
  chest: number;
  belt: number;
  legs: number;
  feet: number;
  hands: number;
  hair: number;
  headTop: number | null;
  headBrim: number | null;
}

function colorsFrom(appearance: Appearance): Colors {
  const eq = appearance.equipped;
  const chest = eq.chest ? ITEMS[eq.chest] : null;
  const legs = eq.legs ? ITEMS[eq.legs] : null;
  const feet = eq.feet ? ITEMS[eq.feet] : null;
  const hands = eq.hands ? ITEMS[eq.hands] : null;
  const head = eq.head ? ITEMS[eq.head] : null;

  return {
    skin: appearance.skin,
    chest: chest ? chest.primary : shade(appearance.skin, 0.92),
    belt: chest ? chest.secondary : shade(appearance.skin, 0.7),
    legs: legs ? legs.primary : shade(appearance.skin, 0.8),
    feet: feet ? feet.primary : shade(appearance.skin, 0.7),
    hands: hands ? hands.primary : shade(appearance.skin, 0.85),
    hair: 0x6b4423,
    headTop: head ? head.primary : null,
    headBrim: head ? head.secondary : null
  };
}

const FRAMES = [
  { ll: 0, rl: 0, la: 0, ra: 0 },
  { ll: 1, rl: 0, la: 1, ra: 0 },
  { ll: 0, rl: 0, la: 0, ra: 0 },
  { ll: 0, rl: 1, la: 0, ra: 1 }
];

function drawHero(ctx: CanvasRenderingContext2D, facing: HeroFacing, frame: number, C: Colors): void {
  const f = FRAMES[frame];

  const px = (x: number, y: number, w: number, h: number, c: number) => {
    ctx.fillStyle = css(c);
    ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
  };
  // деталь с объёмом: светлая левая кромка, тёмная правая
  const part = (x: number, y: number, w: number, h: number, c: number) => {
    px(x, y, w, h, c);
    px(x + w - 1, y, 1, h, shade(c, 0.78));
    px(x, y, 1, h, shade(c, 1.3));
  };

  // тень под ногами
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse((W / 2) * PX, (H - 0.5) * PX, 5 * PX, 1.2 * PX, 0, 0, Math.PI * 2);
  ctx.fill();

  if (facing === 'right') {
    // ноги (профиль, шаг по горизонтали)
    part(6 - f.ll, 13, 2, 5, C.legs);
    px(6 - f.ll, 18, 3, 2, C.feet);
    part(7 + f.rl, 13, 2, 5, C.legs);
    px(7 + f.rl, 18, 3, 2, C.feet);
    // торс
    part(5, 7, 5, 6, C.chest);
    px(5, 12, 5, 1, C.belt);
    // рука (качание)
    const armX = 6 + f.ra - f.la;
    part(armX, 7, 2, 4, C.chest);
    px(armX, 11, 2, 2, C.hands);
    // голова
    part(5, 1, 5, 6, C.skin);
    px(9, 4, 1, 1, 0x262626);
    px(5, 0, 5, 2, C.hair);
    px(5, 2, 2, 3, C.hair);
    if (C.headTop !== null) {
      px(5, 0, 5, 3, C.headTop);
      if (C.headBrim !== null) px(8, 3, 3, 1, C.headBrim);
    }
    return;
  }

  // вид спереди / сзади
  part(5, 13, 2, 5 - f.ll, C.legs);
  px(4, 18 - f.ll, 3, 2, C.feet);
  part(7, 13, 2, 5 - f.rl, C.legs);
  px(7, 18 - f.rl, 3, 2, C.feet);

  part(4, 7, 6, 6, C.chest);
  px(4, 12, 6, 1, C.belt);

  part(2, 7 + f.la, 2, 4, C.chest);
  px(2, 11 + f.la, 2, 2, C.hands);
  part(10, 7 + f.ra, 2, 4, C.chest);
  px(10, 11 + f.ra, 2, 2, C.hands);

  part(4, 1, 6, 6, C.skin);

  if (facing === 'down') {
    px(5, 4, 1, 1, 0x262626);
    px(8, 4, 1, 1, 0x262626);
    px(4, 0, 6, 2, C.hair);
    px(4, 2, 1, 2, C.hair);
    px(9, 2, 1, 2, C.hair);
  } else {
    px(4, 0, 6, 2, C.hair);
    px(4, 1, 6, 4, C.hair);
  }

  if (C.headTop !== null) {
    px(4, 0, 6, 3, C.headTop);
    if (C.headBrim !== null) px(3, 3, 8, 1, C.headBrim);
  }
}

export function getHeroTexture(
  scene: Phaser.Scene,
  appearance: Appearance,
  facing: HeroFacing,
  frame: number
): string {
  const slots: EquipmentSlot[] = ['head', 'chest', 'legs', 'hands', 'feet'];
  const key =
    'hero_' +
    hashString([appearance.skin, ...slots.map((s) => appearance.equipped[s] ?? '-'), facing, frame].join('|'));

  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = W * PX;
  canvas.height = H * PX;
  const ctx = canvas.getContext('2d')!;

  drawHero(ctx, facing, frame, colorsFrom(appearance));

  const tex = scene.textures.addCanvas(key, canvas);
  if (tex) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}