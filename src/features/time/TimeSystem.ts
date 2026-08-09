export const TIME_SCALE = 2;        // игровых минут за реальную секунду
export const DAY_START = 6 * 60;    // 06:00
export const PASS_OUT = 26 * 60;    // 02:00 — отключка
export const MAX_ENERGY = 100;

export const COST = {
  chop: 2,
  mine: 2,
  place: 1,
  remove: 1
};

export function formatClock(timeMin: number): string {
  const h = Math.floor(timeMin / 60) % 24;
  const m = Math.floor(timeMin % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function darknessAlpha(timeMin: number): number {
  const hh = (timeMin / 60) % 24;

  if (hh >= 7 && hh < 17) return 0;
  if (hh >= 17 && hh < 20) return ((hh - 17) / 3) * 0.65;
  if (hh >= 20 || hh < 5) return 0.65;
  return 0.65 - ((hh - 5) / 2) * 0.65; // рассвет 5–7
}