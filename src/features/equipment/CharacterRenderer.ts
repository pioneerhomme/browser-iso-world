import Phaser from 'phaser';
import { ITEMS } from './items';
import { Appearance, EquipItemDef } from './types';

// cx — центр по X, feetY — низ персонажа, u — масштаб единицы
export function drawCharacter(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  feetY: number,
  u: number,
  appearance: Appearance
): void {
  const skin = appearance.skin;
  const eq = appearance.equipped;

  const head = eq.head ? ITEMS[eq.head] : null;
  const chest = eq.chest ? ITEMS[eq.chest] : null;
  const legs = eq.legs ? ITEMS[eq.legs] : null;
  const hands = eq.hands ? ITEMS[eq.hands] : null;
  const feet = eq.feet ? ITEMS[eq.feet] : null;

  // ноги
  g.fillStyle(legs ? legs.primary : skin, 1);
  g.fillRect(cx - 0.85 * u, feetY - 2.6 * u, 0.7 * u, 2.0 * u);
  g.fillRect(cx + 0.15 * u, feetY - 2.6 * u, 0.7 * u, 2.0 * u);

  // обувь
  g.fillStyle(feet ? feet.primary : skin, 1);
  g.fillRect(cx - 0.95 * u, feetY - 0.7 * u, 0.85 * u, 0.7 * u);
  g.fillRect(cx + 0.1 * u, feetY - 0.7 * u, 0.85 * u, 0.7 * u);

  // торс
  g.fillStyle(chest ? chest.primary : skin, 1);
  g.fillRect(cx - 1.05 * u, feetY - 5.2 * u, 2.1 * u, 2.6 * u);

  if (chest) {
    g.fillStyle(chest.secondary, 1);
    g.fillRect(cx - 1.05 * u, feetY - 3.0 * u, 2.1 * u, 0.35 * u);
  }

  // руки
  g.fillStyle(skin, 1);
  g.fillRect(cx - 1.6 * u, feetY - 5.1 * u, 0.55 * u, 2.0 * u);
  g.fillRect(cx + 1.05 * u, feetY - 5.1 * u, 0.55 * u, 2.0 * u);

  // перчатки
  g.fillStyle(hands ? hands.primary : skin, 1);
  g.fillRect(cx - 1.6 * u, feetY - 3.3 * u, 0.55 * u, 0.7 * u);
  g.fillRect(cx + 1.05 * u, feetY - 3.3 * u, 0.55 * u, 0.7 * u);

  // голова
  g.fillStyle(skin, 1);
  g.fillCircle(cx, feetY - 6.3 * u, 1.15 * u);

  // головной убор
  if (head) {
    g.fillStyle(head.primary, 1);
    g.fillCircle(cx, feetY - 6.55 * u, 1.2 * u);

    g.fillStyle(skin, 1);
    g.fillRect(cx - 0.9 * u, feetY - 6.3 * u, 1.8 * u, 0.9 * u);

    g.fillStyle(head.secondary, 1);
    g.fillRect(cx - 1.2 * u, feetY - 6.6 * u, 2.4 * u, 0.25 * u);
  }
}

// Иконка вещи, рисуется вокруг (0,0) — для контейнеров инвентаря и слотов
export function drawItemIcon(
  g: Phaser.GameObjects.Graphics,
  def: EquipItemDef,
  s: number
): void {
  const p = def.primary;
  const sec = def.secondary;

  switch (def.slot) {
    case 'head':
      g.fillStyle(p, 1);
      g.fillCircle(0, -s * 0.08, s * 0.34);
      g.fillStyle(sec, 1);
      g.fillRect(-s * 0.4, -s * 0.02, s * 0.8, s * 0.14);
      break;

    case 'chest':
      g.fillStyle(p, 1);
      g.fillRect(-s * 0.26, -s * 0.36, s * 0.52, s * 0.66);
      g.fillRect(-s * 0.46, -s * 0.36, s * 0.16, s * 0.44);
      g.fillRect(s * 0.3, -s * 0.36, s * 0.16, s * 0.44);
      g.fillStyle(sec, 1);
      g.fillRect(-s * 0.26, s * 0.12, s * 0.52, s * 0.12);
      break;

    case 'legs':
      g.fillStyle(p, 1);
      g.fillRect(-s * 0.26, -s * 0.38, s * 0.22, s * 0.76);
      g.fillRect(s * 0.04, -s * 0.38, s * 0.22, s * 0.76);
      g.fillStyle(sec, 1);
      g.fillRect(-s * 0.26, -s * 0.38, s * 0.52, s * 0.12);
      break;

    case 'hands':
      g.fillStyle(p, 1);
      g.fillCircle(-s * 0.2, 0, s * 0.18);
      g.fillCircle(s * 0.2, 0, s * 0.18);
      g.fillStyle(sec, 1);
      g.fillRect(-s * 0.3, -s * 0.22, s * 0.2, s * 0.1);
      g.fillRect(s * 0.1, -s * 0.22, s * 0.2, s * 0.1);
      break;

    case 'feet':
      g.fillStyle(p, 1);
      g.fillRect(-s * 0.34, -s * 0.28, s * 0.26, s * 0.42);
      g.fillRect(-s * 0.34, s * 0.06, s * 0.36, s * 0.14);
      g.fillRect(s * 0.08, -s * 0.28, s * 0.26, s * 0.42);
      g.fillRect(s * 0.02, s * 0.06, s * 0.36, s * 0.14);
      break;
  }
}